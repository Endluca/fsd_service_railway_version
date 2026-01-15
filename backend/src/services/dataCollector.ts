import moment from 'moment-timezone';
import prisma from '../config/prisma';
import swApiClient from './swApi';
import analyzer from './analyzer';
import salesSync from './salesSync';
import { batchProcess } from '../utils/concurrency';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';

// 获取日志文件路径
const LOG_DIR = path.join(process.cwd(), 'logs');
if (!fs.existsSync(LOG_DIR)) {
  fs.mkdirSync(LOG_DIR, { recursive: true });
}
const INVALID_ASR_LOG = path.join(LOG_DIR, `invalid_asr_${Date.now()}.log`);

/**
 * 数据采集服务
 * 负责从深维API采集数据并存储到数据库
 */
export class DataCollectorService {
  // 当天已同步的销售ID（内存缓存，每日清空）
  private syncedSales = new Set<string>();

  // 部门信息缓存（内存缓存，key=departmentId）
  private departmentCache = new Map<number, {
    name: string;
    parentId: number;
    leadId: string;
  }>();

  private groupNameMap: Map<string, string> = new Map();

  /**
   * 初始化服务（加载人员信息）
   */
  async initialize() {
    try {
      // 查询数据库中的实际人员数量
      const totalSales = await prisma.salesPerson.count();
      console.log(`数据库中共有 ${totalSales} 个销售人员`);

      console.log('数据采集服务初始化完成');
    } catch (error) {
      console.error('数据采集服务初始化失败:', error);
    }
  }

  /**
   * 执行每日数据采集
   * 获取昨天2点到今天2点的数据
   */
  async collectDailyData() {
    console.log('========== 开始每日数据采集 ==========');
    const startTime = Date.now();

    try {
      // 计算时间范围（北京时间）
      const now = moment().tz('Asia/Shanghai');
      const endTime = now.format('YYYY-MM-DD 02:00:00');
      const beginTime = now.subtract(1, 'day').format('YYYY-MM-DD 02:00:00');
      const date = moment(beginTime).tz('Asia/Shanghai').format('YYYY-MM-DD');

      console.log(`采集时间范围: ${beginTime} ~ ${endTime}`);
      console.log(`数据日期: ${date}`);

      // 1. 获取所有doc类型的会话
      const conversations = await swApiClient.getAllConversations(
        beginTime,
        endTime
      );
      console.log(`共获取 ${conversations.length} 条会话`);

      if (conversations.length === 0) {
        console.log('没有数据需要采集');
        return;
      }

      // 2. 按销售分组会话
      const conversationsBySales = this.groupConversationsBySales(conversations);

      // 3. 并发处理每个销售的数据（50个并发）
      const salesEntries = Array.from(conversationsBySales.entries());
      let processedCount = 0;
      let failedCount = 0;

      await batchProcess(
        salesEntries,
        async ([openUserId, salesConversations]) => {
          try {
            await this.processSalesData(openUserId, salesConversations, date);
            processedCount++;
          } catch (error) {
            failedCount++;
            console.error(`处理销售 ${openUserId} 的数据失败:`, error);
          }
        },
        {
          concurrency: 50, // 50个并发
        }
      );

      const duration = ((Date.now() - startTime) / 1000).toFixed(2);
      console.log(`========== 数据采集完成 ==========`);
      console.log(
        `处理销售数: ${processedCount}/${salesEntries.length} (失败: ${failedCount})`
      );
      console.log(`耗时: ${duration}秒`);
    } catch (error) {
      console.error('每日数据采集失败:', error);
      throw error;
    } finally {
      // 清理当日缓存（重要！）
      this.clearDayCache();
    }
  }

  /**
   * 按销售分组会话
   */
  private groupConversationsBySales(conversations: any[]): Map<string, any[]> {
    const map = new Map<string, any[]>();

    for (const conv of conversations) {
      const { open_user_id } = conv;
      if (!map.has(open_user_id)) {
        map.set(open_user_id, []);
      }
      map.get(open_user_id)!.push(conv);
    }

    return map;
  }

  /**
   * 处理单个销售的数据
   */
  private async processSalesData(
    openUserId: string,
    conversations: any[],
    date: string
  ) {
    console.log(`\n处理销售 ${openUserId}，会话数: ${conversations.length}`);

    // 检查是否已处理过今天的数据
    const existing = await prisma.dailyMetric.findUnique({
      where: {
        date_openUserId: {
          date: new Date(date),
          openUserId,
        },
      },
    });

    if (existing) {
      console.log(`销售 ${openUserId} 的数据已存在，跳过`);
      return;
    }

    // 同步销售人员信息（使用内存缓存）
    await salesSync.syncFromConversation(
      openUserId,
      this.syncedSales,
      this.departmentCache
    );

    // 获取并分析每个会话的ASR数据（并发处理，10个并发）
    const results = await batchProcess(
      conversations,
      async (conv, index) => {
        const asrResult = await swApiClient.getConversationAsr(
          conv.origin_conversation_id
        );
        return { asrResult, conversationId: conv.origin_conversation_id, convData: conv };
      },
      {
        concurrency: 10,
      }
    );

    // 收集成功的结果
    const asrDataList: any[] = [];
    const processedIds: string[] = [];
    const invalidAsrLogs: string[] = [];

    for (const result of results) {
      const convId = result.data?.conversationId || 'unknown';
      const openUserId = result.data?.convData?.open_user_id || 'unknown';
      const asrResult = result.data?.asrResult;
      
      if (result.success && asrResult?.success && asrResult?.asrData) {
        asrDataList.push({ asrData: asrResult.asrData });
        processedIds.push(result.data.conversationId);
      } else {
        // 记录无效的ASR数据，包含详细原因
        let reason = '';
        let details = '';
        
        if (!result.success) {
          // batchProcess层面的失败
          reason = 'API请求执行失败';
          details = result.error?.message || 'Unknown error';
        } else if (!asrResult) {
          // asrResult整体为null/undefined
          reason = 'ASR结果为null或undefined';
          details = '深维API未返回ASR结果';
        } else if (asrResult.success === false) {
          // ASR获取失败，记录详细错误信息
          reason = asrResult.errorReason || 'ASR获取失败';
          
          // 构建详细信息
          const detailParts = [];
          if (asrResult.errorCode) {
            detailParts.push(`错误码: ${asrResult.errorCode}`);
          }
          if (asrResult.errorMessage) {
            detailParts.push(`消息: ${asrResult.errorMessage}`);
          }
          if (asrResult.httpStatus) {
            detailParts.push(`HTTP状态: ${asrResult.httpStatus}`);
          }
          details = detailParts.join(', ') || '无详细信息';
        } else if (!asrResult.asrData) {
          // asrData为空
          reason = 'ASR数据为空';
          details = 'asrData字段为null、undefined或空数组';
        } else {
          // 其他未知情况
          reason = '未知错误';
          details = '数据结构异常';
        }
        
        const logEntry = `[${new Date().toISOString()}] 会话ID: ${convId}, 销售ID: ${openUserId}, 原因: ${reason}, 详情: ${details}`;
        invalidAsrLogs.push(logEntry);
      }
    }

    // 保存无效ASR日志（带统计信息）
    if (invalidAsrLogs.length > 0) {
      // 统计各类错误的数量
      const errorStats = new Map<string, number>();
      invalidAsrLogs.forEach(log => {
        const match = log.match(/原因: ([^,]+)/);
        if (match) {
          const reason = match[1];
          errorStats.set(reason, (errorStats.get(reason) || 0) + 1);
        }
      });

      // 写入日志文件，包含统计摘要
      const logHeader = [
        '='.repeat(80),
        `数据采集日志 - ${new Date().toISOString()}`,
        `销售ID: ${openUserId}`,
        `总会话数: ${conversations.length}`,
        `成功获取: ${asrDataList.length}`,
        `失败数量: ${invalidAsrLogs.length}`,
        '',
        '失败原因统计:',
        ...Array.from(errorStats.entries()).map(([reason, count]) => `  - ${reason}: ${count}条`),
        '='.repeat(80),
        ''
      ].join('\n');

      fs.appendFileSync(INVALID_ASR_LOG, logHeader + invalidAsrLogs.join('\n') + '\n\n');
      console.log(`⚠️ 检测到 ${invalidAsrLogs.length} 个无效ASR数据，已保存到: ${INVALID_ASR_LOG}`);
      
      // 在控制台输出失败原因统计
      console.log('\n失败原因统计:');
      errorStats.forEach((count, reason) => {
        console.log(`  ${reason}: ${count}条`);
      });
    }

    console.log(
      `✓ 成功获取 ${asrDataList.length}/${conversations.length} 个会话的ASR数据`
    );

    // 分析数据
    const metrics = analyzer.analyzeMultipleConversations(asrDataList, date);

    // 保存到数据库
    await prisma.dailyMetric.create({
      data: {
        date: new Date(date),
        openUserId,
        customerTurnCount: metrics.customerTurnCount,
        timelyReplyCount: metrics.timelyReplyCount,
        overtimeReplyCount: metrics.overtimeReplyCount,
        totalReplyDuration: BigInt(metrics.totalReplyDuration),
        newRuleCustomerTurnCount: metrics.newRuleCustomerTurnCount,
        overtimeNoReplyCount: metrics.overtimeNoReplyCount,
        processedConversationIds: processedIds,
      },
    });

    console.log(`已保存销售 ${openUserId} 的数据:`, {
      customerTurnCount: metrics.customerTurnCount,
      timelyReplyCount: metrics.timelyReplyCount,
      overtimeReplyCount: metrics.overtimeReplyCount,
      totalReplyDuration: metrics.totalReplyDuration,
      newRuleCustomerTurnCount: metrics.newRuleCustomerTurnCount,
      overtimeNoReplyCount: metrics.overtimeNoReplyCount,
      conversationCount: processedIds.length,
    });
  }

  /**
   * 清理当日缓存
   */
  private clearDayCache(): void {
    this.syncedSales.clear();
    this.departmentCache.clear();
    console.log('✓ 已清空当日销售和部门缓存');
  }

  /**
   * 手动触发数据采集（用于测试或补采数据）
   * @param date 数据日期 (YYYY-MM-DD)
   */
  async collectDataForDate(date: string) {
    console.log(`手动采集数据: ${date}`);

    const beginTime = `${date} 02:00:00`;
    const endDate = moment(date).add(1, 'day').format('YYYY-MM-DD');
    const endTime = `${endDate} 02:00:00`;

    const conversations = await swApiClient.getAllConversations(
      beginTime,
      endTime
    );
    console.log(`共获取 ${conversations.length} 条会话`);

    const conversationsBySales = this.groupConversationsBySales(conversations);

    for (const [openUserId, salesConversations] of conversationsBySales.entries()) {
      await this.processSalesData(openUserId, salesConversations, date);
    }
  }
}

export default new DataCollectorService();
