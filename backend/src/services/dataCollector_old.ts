import moment from 'moment-timezone';
import prisma from '../config/prisma';
import swApiClient from './swApi';
import analyzer from './analyzer';
import salesSync from './salesSync';
import { batchProcess } from '../utils/concurrency';
import path from 'path';

/**
 * 数据采集服务
 * 负责从深维API采集数据并存储到数据库
 */
export class DataCollectorService {
  private groupNameMap: Map<string, string> = new Map();

  /**
   * 初始化服务（加载人员信息）
   * 注意：人员信息.md仅用于新增销售人员时的默认小组分配
   * 数据采集时以数据库中的信息为准
   */
  async initialize() {
    try {
      // 加载人员信息文件（仅用于新增人员时的默认小组分配）
      const filePath = path.join(process.cwd(), '..', '人员信息.md');
      this.groupNameMap = await salesSync.loadGroupNameMap(filePath);

      // 查询数据库中的实际人员数量
      const totalSales = await prisma.salesPerson.count();
      console.log(`数据库中共有 ${totalSales} 个销售人员`);

      console.log('数据采集服务初始化完成');
    } catch (error) {
      console.error('数据采集服务初始化失败:', error);
      // 继续运行，但小组信息可能缺失
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
      const conversations = await swApiClient.getAllConversations(beginTime, endTime);
      console.log(`共获取 ${conversations.length} 条会话`);

      if (conversations.length === 0) {
        console.log('没有数据需要采集');
        return;
      }

      // 2. 按销售分组会话
      const conversationsBySales = this.groupConversationsBySales(conversations);

      // 3. 处理每个销售的数据
      let processedCount = 0;
      for (const [openUserId, salesConversations] of conversationsBySales.entries()) {
        try {
          await this.processSalesData(openUserId, salesConversations, date);
          processedCount++;
        } catch (error) {
          console.error(`处理销售 ${openUserId} 的数据失败:`, error);
        }
      }

      const duration = ((Date.now() - startTime) / 1000).toFixed(2);
      console.log(`========== 数据采集完成 ==========`);
      console.log(`处理销售数: ${processedCount}/${conversationsBySales.size}`);
      console.log(`耗时: ${duration}秒`);
    } catch (error) {
      console.error('每日数据采集失败:', error);
      throw error;
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
  private async processSalesData(openUserId: string, conversations: any[], date: string) {
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

    // 同步销售人员信息
    await salesSync.syncFromConversation(openUserId, this.groupNameMap);

    // 获取并分析每个会话的ASR数据（优化：并发处理）
    console.log(`开始获取 ${conversations.length} 个会话的ASR数据（并发数：10）...`);

    const results = await batchProcess(
      conversations,
      async (conv, index) => {
        const asrResult = await swApiClient.getConversationAsr(conv.origin_conversation_id);
        return { asrResult, conversationId: conv.origin_conversation_id };
      },
      {
        concurrency: 10, // 并发数：10
        onProgress: (completed, total, success, failed) => {
          // 每完成10个或最后一个，显示进度
          if (completed % 10 === 0 || completed === total) {
            console.log(`  进度: ${completed}/${total} (成功: ${success}, 失败: ${failed})`);
          }
        },
      }
    );

    // 收集成功的结果
    const asrDataList: any[] = [];
    const processedIds: string[] = [];

    for (const result of results) {
      if (result.success && result.data?.asrResult?.asrData) {
        asrDataList.push({ asrData: result.data.asrResult.asrData });
        processedIds.push(result.data.conversationId);
      }
    }

    console.log(`✓ 成功获取 ${asrDataList.length}/${conversations.length} 个会话的ASR数据`);

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
    });
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

    console.log(`时间范围: ${beginTime} ~ ${endTime}`);

    // 获取会话
    const conversations = await swApiClient.getAllConversations(beginTime, endTime);
    console.log(`共获取 ${conversations.length} 条会话`);

    // 按销售分组
    const conversationsBySales = this.groupConversationsBySales(conversations);

    // 处理数据
    for (const [openUserId, salesConversations] of conversationsBySales.entries()) {
      try {
        await this.processSalesData(openUserId, salesConversations, date);
      } catch (error) {
        console.error(`处理销售 ${openUserId} 失败:`, error);
      }
    }

    console.log('手动数据采集完成');
  }

  /**
   * 批量采集指定日期范围的数据
   * @param startDate 开始日期 (YYYY-MM-DD)
   * @param endDate 结束日期 (YYYY-MM-DD)
   */
  async collectDataForRange(startDate: string, endDate: string) {
    console.log('========== 开始批量数据采集 ==========');
    console.log(`日期范围: ${startDate} ~ ${endDate}`);

    const start = moment(startDate);
    const end = moment(endDate);

    // 验证日期
    if (!start.isValid() || !end.isValid()) {
      throw new Error('日期格式无效，请使用 YYYY-MM-DD 格式');
    }

    if (start.isAfter(end)) {
      throw new Error('开始日期不能晚于结束日期');
    }

    // 计算天数
    const totalDays = end.diff(start, 'days') + 1;
    console.log(`共需采集 ${totalDays} 天的数据\n`);

    let successCount = 0;
    let failCount = 0;
    const failedDates: string[] = [];

    // 循环处理每一天
    const current = start.clone();
    let dayIndex = 1;

    while (current.isSameOrBefore(end)) {
      const dateStr = current.format('YYYY-MM-DD');

      console.log(`[${dayIndex}/${totalDays}] 开始采集 ${dateStr} 的数据...`);

      try {
        await this.collectDataForDate(dateStr);
        successCount++;
        console.log(`✓ ${dateStr} 采集成功\n`);
      } catch (error: any) {
        failCount++;
        failedDates.push(dateStr);
        console.error(`✗ ${dateStr} 采集失败: ${error.message}\n`);
      }

      current.add(1, 'day');
      dayIndex++;
    }

    console.log('========== 批量数据采集完成 ==========');
    console.log(`总计: ${totalDays} 天`);
    console.log(`成功: ${successCount} 天`);
    console.log(`失败: ${failCount} 天`);

    if (failedDates.length > 0) {
      console.log(`失败日期: ${failedDates.join(', ')}`);
    }

    console.log('========================================\n');

    return {
      total: totalDays,
      success: successCount,
      failed: failCount,
      failedDates,
    };
  }
}

export default new DataCollectorService();
