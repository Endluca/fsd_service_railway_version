/**
 * ASR数据分析服务
 * 负责分析对话轮次和回复时间
 */

interface AsrItem {
  entity_id: number;
  name: string;
  entity_type: 'host_salesman' | 'customer_contact';
  content: string;
  begin_time: number;
  end_time: number;
  order: number;
}

interface Turn {
  entityType: 'host_salesman' | 'customer_contact';
  items: AsrItem[];
}

interface AnalysisResult {
  customerTurnCount: number; // 客户发言轮次（旧规则）
  timelyReplyCount: number; // 及时回复次数（≤1小时）
  overtimeReplyCount: number; // 超时回复次数（>1小时）
  totalReplyDuration: number; // 总回复时间（秒）
  newRuleCustomerTurnCount: number; // 新规则总消息数
  overtimeNoReplyCount: number; // 超时未回复数
}

export class ConversationAnalyzer {
  /**
   * 分析单个会话的ASR数据
   * @param asrData ASR数据数组
   * @param date 数据日期 (YYYY-MM-DD)，用于计算1点的时间戳
   */
  analyzeConversation(asrData: AsrItem[], date: string): AnalysisResult {
    if (!asrData || asrData.length === 0) {
      return {
        customerTurnCount: 0,
        timelyReplyCount: 0,
        overtimeReplyCount: 0,
        totalReplyDuration: 0,
        newRuleCustomerTurnCount: 0,
        overtimeNoReplyCount: 0,
      };
    }

    // 按order排序（确保顺序正确）
    const sortedData = [...asrData].sort((a, b) => a.order - b.order);

    // 将连续的发言合并为轮次
    const turns = this.groupIntoTurns(sortedData);

    // 计算数据日期当天1点的时间戳（北京时间）
    // 例如：date = "2024-08-16" -> "2024-08-16 01:00:00" Asia/Shanghai
    const onePmTimestamp = new Date(`${date}T01:00:00+08:00`).getTime() / 1000;

    // 如果第一轮是销售发言，忽略
    if (turns.length > 0 && turns[0].entityType === 'host_salesman') {
      turns.shift();
    }

    // 记录最后一轮是否是客户发言
    let lastCustomerTurn: Turn | null = null;
    if (turns.length > 0 && turns[turns.length - 1].entityType === 'customer_contact') {
      lastCustomerTurn = turns.pop()!;
    }

    // 计算指标（基于已处理的turns，用于旧规则）
    const oldRuleMetrics = this.calculateMetrics(turns);

    // 新规则：重新处理最后一轮客户发言
    let newRuleCustomerTurnCount = oldRuleMetrics.customerTurnCount;
    let overtimeNoReplyCount = 0;

    if (lastCustomerTurn) {
      const lastBeginTime = lastCustomerTurn.items[lastCustomerTurn.items.length - 1].begin_time;

      if (lastBeginTime >= onePmTimestamp) {
        // 最后一句在1点之后，按新规则移除（不计入统计）
        // newRuleCustomerTurnCount 保持不变
      } else {
        // 最后一句在1点之前，按新规则保留并计入"超时未回复"
        newRuleCustomerTurnCount++;
        overtimeNoReplyCount++;
      }
    }

    return {
      ...oldRuleMetrics,
      newRuleCustomerTurnCount,
      overtimeNoReplyCount,
    };
  }

  /**
   * 将ASR数据按轮次分组
   * 同一角色的连续发言合并为一轮
   */
  private groupIntoTurns(asrData: AsrItem[]): Turn[] {
    const turns: Turn[] = [];
    let currentTurn: Turn | null = null;

    for (const item of asrData) {
      if (!currentTurn || currentTurn.entityType !== item.entity_type) {
        // 开始新的轮次
        currentTurn = {
          entityType: item.entity_type,
          items: [item],
        };
        turns.push(currentTurn);
      } else {
        // 追加到当前轮次
        currentTurn.items.push(item);
      }
    }

    return turns;
  }

  /**
   * 计算各项指标（旧规则）
   * @param turns 轮次数组
   */
  private calculateMetrics(turns: Turn[]): Omit<AnalysisResult, 'newRuleCustomerTurnCount' | 'overtimeNoReplyCount'> {
    let customerTurnCount = 0;
    let timelyReplyCount = 0;
    let overtimeReplyCount = 0;
    let totalReplyDuration = 0;

    for (let i = 0; i < turns.length; i++) {
      const turn = turns[i];

      if (turn.entityType === 'customer_contact') {
        // 客户发言轮次
        customerTurnCount++;

        // 检查下一轮是否是销售回复
        if (i + 1 < turns.length) {
          const nextTurn = turns[i + 1];
          if (nextTurn.entityType === 'host_salesman') {
            // 计算回复时间
            const customerLastBeginTime = turn.items[turn.items.length - 1].begin_time;
            const salesmanFirstBeginTime = nextTurn.items[0].begin_time;
            const replyDuration = salesmanFirstBeginTime - customerLastBeginTime;

            totalReplyDuration += replyDuration;

            // 判断是否及时回复（1小时 = 3600秒）
            if (replyDuration <= 3600) {
              timelyReplyCount++;
            } else {
              overtimeReplyCount++;
            }
          }
        }
      }
    }

    return {
      customerTurnCount,
      timelyReplyCount,
      overtimeReplyCount,
      totalReplyDuration,
    };
  }

  /**
   * 批量分析多个会话
   * @param conversations 会话数组，每个包含asrData
   * @param date 数据日期 (YYYY-MM-DD)
   */
  analyzeMultipleConversations(conversations: { asrData: AsrItem[] }[], date: string): AnalysisResult {
    const totalResult: AnalysisResult = {
      customerTurnCount: 0,
      timelyReplyCount: 0,
      overtimeReplyCount: 0,
      totalReplyDuration: 0,
      newRuleCustomerTurnCount: 0,
      overtimeNoReplyCount: 0,
    };

    for (const conv of conversations) {
      const result = this.analyzeConversation(conv.asrData, date);
      totalResult.customerTurnCount += result.customerTurnCount;
      totalResult.timelyReplyCount += result.timelyReplyCount;
      totalResult.overtimeReplyCount += result.overtimeReplyCount;
      totalResult.totalReplyDuration += result.totalReplyDuration;
      totalResult.newRuleCustomerTurnCount += result.newRuleCustomerTurnCount;
      totalResult.overtimeNoReplyCount += result.overtimeNoReplyCount;
    }

    return totalResult;
  }
}

export default new ConversationAnalyzer();
