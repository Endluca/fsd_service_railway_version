import prisma from '../config/prisma';
import { Prisma } from '@prisma/client';

/**
 * 数据查询服务
 * 负责查询和聚合数据，支持缓存
 */
export class DataService {
  /**
   * 查询日期范围内的数据
   * @param startDate 开始日期 (YYYY-MM-DD)
   * @param endDate 结束日期 (YYYY-MM-DD)
   * @param groupName 小组名称（可选）
   * @param openUserId 销售ID（可选）
   */
  async queryDateRange(
    startDate: string,
    endDate: string,
    groupName?: string,
    openUserId?: string
  ) {
    console.log(`查询数据: ${startDate} ~ ${endDate}, 小组: ${groupName || '全部'}, 销售: ${openUserId || '全部'}`);

    // 1. 先尝试从缓存获取
    const cachedResults = await this.getCachedResults(startDate, endDate, groupName, openUserId);
    if (cachedResults) {
      console.log('使用缓存数据');
      return cachedResults;
    }

    // 2. 从数据库计算
    const results = await this.calculateResults(startDate, endDate, groupName, openUserId);

    // 3. 保存缓存
    await this.saveCacheResults(results, startDate, endDate);

    return results;
  }

  /**
   * 从缓存获取结果
   */
  private async getCachedResults(
    startDate: string,
    endDate: string,
    groupName?: string,
    openUserId?: string
  ) {
    // 如果指定了销售ID，从缓存表查询
    if (openUserId) {
      const cache = await prisma.dateRangeCache.findUnique({
        where: {
          startDate_endDate_openUserId: {
            startDate: new Date(startDate),
            endDate: new Date(endDate),
            openUserId,
          },
        },
        include: {
          salesPerson: true,
        },
      });

      if (cache) {
        return [{
          openUserId: cache.openUserId,
          name: cache.salesPerson.name,
          groupName: cache.salesPerson.groupName,
          customerTurnCount: cache.customerTurnCount,
          timelyReplyRate: Number(cache.timelyReplyRate),
          overtimeReplyRate: Number(cache.overtimeReplyRate),
          avgReplyDuration: Number(cache.avgReplyDuration),
          newRuleCustomerTurnCount: cache.newRuleCustomerTurnCount,
          overtimeReplyCount: cache.overtimeReplyCount,
          overtimeNoReplyCount: cache.overtimeNoReplyCount,
          conversationCount: cache.conversationCount,
        }];
      }
    }

    // 如果没有指定销售，检查是否所有销售都有缓存
    const allSales = await this.getAllSalesInDateRange(startDate, endDate, groupName);
    if (allSales.length === 0) {
      return [];
    }

    const caches = await prisma.dateRangeCache.findMany({
      where: {
        startDate: new Date(startDate),
        endDate: new Date(endDate),
        openUserId: {
          in: allSales.map(s => s.openUserId),
        },
      },
      include: {
        salesPerson: true,
      },
    });

    // 如果缓存数量匹配，返回缓存
    if (caches.length === allSales.length) {
      return caches
        .filter(c => !groupName || c.salesPerson.groupName === groupName)
        .map(cache => ({
          openUserId: cache.openUserId,
          name: cache.salesPerson.name,
          groupName: cache.salesPerson.groupName,
          customerTurnCount: cache.customerTurnCount,
          timelyReplyRate: Number(cache.timelyReplyRate),
          overtimeReplyRate: Number(cache.overtimeReplyRate),
          avgReplyDuration: Number(cache.avgReplyDuration),
          newRuleCustomerTurnCount: cache.newRuleCustomerTurnCount,
          overtimeReplyCount: cache.overtimeReplyCount,
          overtimeNoReplyCount: cache.overtimeNoReplyCount,
          conversationCount: cache.conversationCount,
        }));
    }

    return null;
  }

  /**
   * 计算结果
   */
  private async calculateResults(
    startDate: string,
    endDate: string,
    groupName?: string,
    openUserId?: string
  ) {
    // 查询条件
    const where: Prisma.DailyMetricWhereInput = {
      date: {
        gte: new Date(startDate),
        lte: new Date(endDate),
      },
    };

    if (openUserId) {
      where.openUserId = openUserId;
    }

    // 查询所有相关的每日数据
    const dailyMetrics = await prisma.dailyMetric.findMany({
      where,
      include: {
        salesPerson: true,
      },
    });

    // 按销售分组聚合
    const salesMap = new Map<string, {
      name: string;
      groupName: string | null;
      customerTurnCount: number;
      timelyReplyCount: number;
      overtimeReplyCount: number;
      totalReplyDuration: number;
      newRuleCustomerTurnCount: number;
      overtimeNoReplyCount: number;
      conversationCount: number;
    }>();

    for (const metric of dailyMetrics) {
      const { openUserId, customerTurnCount, timelyReplyCount, overtimeReplyCount, totalReplyDuration, newRuleCustomerTurnCount, overtimeNoReplyCount } = metric;
      const { name, groupName: salesGroupName } = metric.salesPerson;

      // 如果指定了小组过滤
      if (groupName && salesGroupName !== groupName) {
        continue;
      }

      if (!salesMap.has(openUserId)) {
        salesMap.set(openUserId, {
          name,
          groupName: salesGroupName,
          customerTurnCount: 0,
          timelyReplyCount: 0,
          overtimeReplyCount: 0,
          totalReplyDuration: 0,
          newRuleCustomerTurnCount: 0,
          overtimeNoReplyCount: 0,
          conversationCount: 0,
        });
      }

      const sales = salesMap.get(openUserId)!;
      sales.customerTurnCount += customerTurnCount;
      sales.timelyReplyCount += timelyReplyCount;
      sales.overtimeReplyCount += overtimeReplyCount;
      sales.totalReplyDuration += Number(totalReplyDuration);
      sales.newRuleCustomerTurnCount += newRuleCustomerTurnCount;
      sales.overtimeNoReplyCount += overtimeNoReplyCount;
      sales.conversationCount += metric.processedConversationIds.length;
    }

    // 计算比率和平均值
    const results = Array.from(salesMap.entries()).map(([openUserId, data]) => {
      const totalReplies = data.timelyReplyCount + data.overtimeReplyCount;
      const timelyReplyRate = totalReplies > 0
        ? (data.timelyReplyCount / data.customerTurnCount) * 100
        : 0;
      const overtimeReplyRate = totalReplies > 0
        ? (data.overtimeReplyCount / data.customerTurnCount) * 100
        : 0;
      const avgReplyDuration = data.customerTurnCount > 0
        ? data.totalReplyDuration / data.customerTurnCount / 60 // 转换为分钟
        : 0;

      return {
        openUserId,
        name: data.name,
        groupName: data.groupName,
        customerTurnCount: data.customerTurnCount,
        timelyReplyRate: Number(timelyReplyRate.toFixed(2)),
        overtimeReplyRate: Number(overtimeReplyRate.toFixed(2)),
        avgReplyDuration: Number(avgReplyDuration.toFixed(2)),
        newRuleCustomerTurnCount: data.newRuleCustomerTurnCount,
        overtimeReplyCount: data.overtimeReplyCount,
        overtimeNoReplyCount: data.overtimeNoReplyCount,
        conversationCount: data.conversationCount,
      };
    });

    return results;
  }

  /**
   * 保存缓存结果
   */
  private async saveCacheResults(
    results: any[],
    startDate: string,
    endDate: string
  ) {
    for (const result of results) {
      try {
        await prisma.dateRangeCache.upsert({
          where: {
            startDate_endDate_openUserId: {
              startDate: new Date(startDate),
              endDate: new Date(endDate),
              openUserId: result.openUserId,
            },
          },
          create: {
            startDate: new Date(startDate),
            endDate: new Date(endDate),
            openUserId: result.openUserId,
            customerTurnCount: result.customerTurnCount,
            timelyReplyRate: result.timelyReplyRate,
            overtimeReplyRate: result.overtimeReplyRate,
            avgReplyDuration: result.avgReplyDuration,
            newRuleCustomerTurnCount: result.newRuleCustomerTurnCount,
            overtimeReplyCount: result.overtimeReplyCount,
            overtimeNoReplyCount: result.overtimeNoReplyCount,
            conversationCount: result.conversationCount,
          },
          update: {
            customerTurnCount: result.customerTurnCount,
            timelyReplyRate: result.timelyReplyRate,
            overtimeReplyRate: result.overtimeReplyRate,
            avgReplyDuration: result.avgReplyDuration,
            newRuleCustomerTurnCount: result.newRuleCustomerTurnCount,
            overtimeReplyCount: result.overtimeReplyCount,
            overtimeNoReplyCount: result.overtimeNoReplyCount,
            conversationCount: result.conversationCount,
          },
        });
      } catch (error) {
        console.error(`保存缓存失败 (${result.openUserId}):`, error);
      }
    }

    console.log(`已缓存 ${results.length} 条数据`);
  }

  /**
   * 获取日期范围内的所有销售
   */
  private async getAllSalesInDateRange(
    startDate: string,
    endDate: string,
    groupName?: string
  ) {
    const where: Prisma.DailyMetricWhereInput = {
      date: {
        gte: new Date(startDate),
        lte: new Date(endDate),
      },
    };

    const metrics = await prisma.dailyMetric.findMany({
      where,
      select: {
        openUserId: true,
      },
      distinct: ['openUserId'],
    });

    return metrics;
  }

  /**
   * 获取所有小组列表
   */
  async getGroups() {
    const groups = await prisma.salesPerson.findMany({
      where: {
        groupName: {
          not: null,
        },
      },
      select: {
        groupName: true,
      },
      distinct: ['groupName'],
    });

    return groups.map(g => g.groupName).filter(Boolean);
  }

  /**
   * 获取所有销售列表
   */
  async getSalesList(groupName?: string) {
    const where: Prisma.SalesPersonWhereInput = {};
    if (groupName) {
      where.groupName = groupName;
    }

    const sales = await prisma.salesPerson.findMany({
      where,
      select: {
        openUserId: true,
        name: true,
        groupName: true,
      },
      orderBy: {
        name: 'asc',
      },
    });

    return sales;
  }
}

export default new DataService();
