import prisma from '../config/prisma';
import { Prisma } from '@prisma/client';

/**
 * 数据查询服务
 * 负责查询和聚合数据（实时计算，不使用缓存）
 */
export class DataService {
  /**
   * 查询日期范围内的数据
   * @param startDate 开始日期 (YYYY-MM-DD)
   * @param endDate 结束日期 (YYYY-MM-DD)
   * @param groupNames 小组名称数组（可选）
   * @param openUserIds 销售ID数组（可选）
   */
  async queryDateRange(
    startDate: string,
    endDate: string,
    groupNames?: string[],
    openUserIds?: string[]
  ) {
    console.log(`查询数据: ${startDate} ~ ${endDate}, 小组: ${groupNames?.join(',') || '全部'}, 销售: ${openUserIds?.join(',') || '全部'}`);

    // 直接从数据库实时计算
    const results = await this.calculateResults(startDate, endDate, groupNames, openUserIds);

    return results;
  }

  /**
   * 从缓存获取结果（已禁用）
   * 注释掉的代码保留以便未来需要重新启用缓存功能
   */
  // private async getCachedResults(
  //   startDate: string,
  //   endDate: string,
  //   groupName?: string,
  //   openUserId?: string
  // ) {
  //   // 如果指定了销售ID，从缓存表查询
  //   if (openUserId) {
  //     const cache = await prisma.dateRangeCache.findUnique({
  //       where: {
  //         startDate_endDate_openUserId: {
  //           startDate: new Date(startDate),
  //           endDate: new Date(endDate),
  //           openUserId,
  //         },
  //       },
  //       include: {
  //         salesPerson: true,
  //       },
  //     });

  //     if (cache) {
  //       return [{
  //         openUserId: cache.openUserId,
  //         name: cache.salesPerson.name,
  //         groupName: cache.salesPerson.groupName,
  //         customerTurnCount: cache.customerTurnCount,
  //         timelyReplyRate: Number(cache.timelyReplyRate),
  //         overtimeReplyRate: Number(cache.overtimeReplyRate),
  //         avgReplyDuration: Number(cache.avgReplyDuration),
  //         newRuleCustomerTurnCount: cache.newRuleCustomerTurnCount,
  //         overtimeReplyCount: cache.overtimeReplyCount,
  //         overtimeNoReplyCount: cache.overtimeNoReplyCount,
  //         conversationCount: cache.conversationCount,
  //       }];
  //     }
  //   }

  //   // 如果没有指定销售，检查是否所有销售都有缓存
  //   const allSales = await this.getAllSalesInDateRange(startDate, endDate, groupName ? [groupName] : undefined);
  //   if (allSales.length === 0) {
  //     return [];
  //   }

  //   const caches = await prisma.dateRangeCache.findMany({
  //     where: {
  //       startDate: new Date(startDate),
  //       endDate: new Date(endDate),
  //       openUserId: {
  //         in: allSales.map(s => s.openUserId),
  //       },
  //     },
  //     include: {
  //       salesPerson: true,
  //     },
  //   });

  //   // 如果缓存数量匹配，返回缓存
  //   if (caches.length === allSales.length) {
  //     return caches
  //       .filter(c => !groupName || c.salesPerson.groupName === groupName)
  //       .map(cache => ({
  //         openUserId: cache.openUserId,
  //         name: cache.salesPerson.name,
  //         groupName: cache.salesPerson.groupName,
  //         customerTurnCount: cache.customerTurnCount,
  //         timelyReplyRate: Number(cache.timelyReplyRate),
  //         overtimeReplyRate: Number(cache.overtimeReplyRate),
  //         avgReplyDuration: Number(cache.avgReplyDuration),
  //         newRuleCustomerTurnCount: cache.newRuleCustomerTurnCount,
  //         overtimeReplyCount: cache.overtimeReplyCount,
  //         overtimeNoReplyCount: cache.overtimeNoReplyCount,
  //         conversationCount: cache.conversationCount,
  //       }));
  //   }

  //   return null;
  // }

  /**
   * 计算结果
   */
  private async calculateResults(
    startDate: string,
    endDate: string,
    groupNames?: string[],
    openUserIds?: string[]
  ) {
    // 查询条件
    const where: Prisma.DailyMetricWhereInput = {
      date: {
        gte: new Date(startDate),
        lte: new Date(endDate),
      },
    };

    if (openUserIds && openUserIds.length > 0) {
      where.openUserId = { in: openUserIds };
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
      const { megName: name, departmentName: salesGroupName } = metric.salesPerson;

      // 如果指定了小组过滤
      if (groupNames && groupNames.length > 0 && !groupNames.includes(salesGroupName || '')) {
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
   * 保存缓存结果（已禁用）
   * 注释掉的代码保留以便未来需要重新启用缓存功能
   */
  // private async saveCacheResults(
  //   results: any[],
  //   startDate: string,
  //   endDate: string
  // ) {
  //   for (const result of results) {
  //     try {
  //       await prisma.dateRangeCache.upsert({
  //         where: {
  //           startDate_endDate_openUserId: {
  //             startDate: new Date(startDate),
  //             endDate: new Date(endDate),
  //             openUserId: result.openUserId,
  //           },
  //         },
  //         create: {
  //           startDate: new Date(startDate),
  //           endDate: new Date(endDate),
  //           openUserId: result.openUserId,
  //           customerTurnCount: result.customerTurnCount,
  //           timelyReplyRate: result.timelyReplyRate,
  //           overtimeReplyRate: result.overtimeReplyRate,
  //           avgReplyDuration: result.avgReplyDuration,
  //           newRuleCustomerTurnCount: result.newRuleCustomerTurnCount,
  //           overtimeReplyCount: result.overtimeReplyCount,
  //           overtimeNoReplyCount: result.overtimeNoReplyCount,
  //           conversationCount: result.conversationCount,
  //         },
  //         update: {
  //           customerTurnCount: result.customerTurnCount,
  //           timelyReplyRate: result.timelyReplyRate,
  //           overtimeReplyRate: result.overtimeReplyRate,
  //           avgReplyDuration: result.avgReplyDuration,
  //           newRuleCustomerTurnCount: result.newRuleCustomerTurnCount,
  //           overtimeReplyCount: result.overtimeReplyCount,
  //           overtimeNoReplyCount: result.overtimeNoReplyCount,
  //           conversationCount: result.conversationCount,
  //         },
  //       });
  //     } catch (error) {
  //       console.error(`保存缓存失败 (${result.openUserId}):`, error);
  //     }
  //   }

  //   console.log(`已缓存 ${results.length} 条数据`);
  // }

  /**
   * 获取日期范围内的所有销售（已禁用）
   * 注释掉的代码保留以便未来需要重新启用缓存功能
   */
  // private async getAllSalesInDateRange(
  //   startDate: string,
  //   endDate: string,
  //   groupNames?: string[]
  // ) {
  //   const where: Prisma.DailyMetricWhereInput = {
  //     date: {
  //       gte: new Date(startDate),
  //       lte: new Date(endDate),
  //     },
  //   };

  //   const metrics = await prisma.dailyMetric.findMany({
  //     where,
  //     select: {
  //       openUserId: true,
  //     },
  //     distinct: ['openUserId'],
  //   });

  //   return metrics;
  // }

  /**
   * 获取所有部门列表（用于前端小组筛选）
   * 修改：从department_name去重，而不是group_name
   */
  async getGroups() {
    const departments = await prisma.salesPerson.findMany({
      where: {
        departmentName: {
          not: '默认值', // 排除未成功获取部门信息的记录
        },
      },
      select: {
        departmentName: true,
      },
      distinct: ['departmentName'],
      orderBy: {
        departmentName: 'asc',
      },
    });

    return departments
      .map((d) => d.departmentName)
      .filter(Boolean)
      .filter((dept) => dept !== '默认值');
  }

  /**
   * 获取销售列表
   * @param groupNames 部门名称数组（可选）
   * @param startDate 开始日期（可选，格式：YYYY-MM-DD）
   * @param endDate 结束日期（可选，格式：YYYY-MM-DD）
   * @returns 销售列表。如果提供日期范围，则只返回该时间范围内有数据的销售
   * 修改：字段名从name/groupName改为megName/departmentName
   */
  async getSalesList(groupNames?: string[], startDate?: string, endDate?: string) {
    // 如果提供了日期范围，只返回该时间范围内有数据的销售
    if (startDate && endDate) {
      const where: Prisma.SalesPersonWhereInput = {
        dailyMetrics: {
          some: {
            date: {
              gte: new Date(startDate),
              lte: new Date(endDate),
            },
          },
        },
      };

      if (groupNames && groupNames.length > 0) {
        where.departmentName = { in: groupNames }; // 从groupName改为departmentName
      }

      const sales = await prisma.salesPerson.findMany({
        where,
        select: {
          openUserId: true,
          megName: true, // 从name改为megName
          departmentName: true, // 从groupName改为departmentName
          status: true, // 新增状态字段
        },
        orderBy: {
          megName: 'asc', // 从name改为megName
        },
      });

      return sales;
    }

    // 如果没有提供日期范围，返回所有销售（原有逻辑）
    const where: Prisma.SalesPersonWhereInput = {};
    if (groupNames && groupNames.length > 0) {
      where.departmentName = { in: groupNames }; // 从groupName改为departmentName
    }

    const sales = await prisma.salesPerson.findMany({
      where,
      select: {
        openUserId: true,
        megName: true, // 从name改为megName
        departmentName: true, // 从groupName改为departmentName
        status: true, // 新增状态字段
      },
      orderBy: {
        megName: 'asc', // 从name改为megName
      },
    });

    return sales;
  }
}

export default new DataService();
