import moment from 'moment-timezone';
import prisma from '../config/prisma';
import { Prisma } from '@prisma/client';

/**
 * 趋势数据服务
 * 提供时间序列的趋势对比分析
 */
export class TrendService {
  /**
   * 获取趋势数据
   * @param params 查询参数
   */
  async getTrendData(params: {
    startDate: string;
    endDate: string;
    granularity: 'day' | 'week';
    comparisonType: 'all' | 'group' | 'person';
    groupName?: string;
    metric: 'timelyReplyRate' | 'overtimeReplyRate' | 'avgReplyDuration' | 'conversationCount';
  }) {
    const { startDate, endDate, granularity, comparisonType, groupName, metric } = params;

    // 验证参数
    if (comparisonType === 'person' && !groupName) {
      throw new Error('选择个人对比时必须指定小组');
    }

    // 查询数据
    const dailyMetrics = await this.queryDailyMetrics(startDate, endDate, groupName, comparisonType);

    // 按颗粒度和对比类型处理数据
    if (granularity === 'day') {
      return this.processDailyData(dailyMetrics, comparisonType, metric);
    } else {
      return this.processWeeklyData(dailyMetrics, comparisonType, metric, startDate, endDate);
    }
  }

  /**
   * 查询每日指标数据
   */
  private async queryDailyMetrics(
    startDate: string,
    endDate: string,
    groupName?: string,
    comparisonType?: string
  ) {
    const where: Prisma.DailyMetricWhereInput = {
      date: {
        gte: new Date(startDate),
        lte: new Date(endDate),
      },
    };

    const dailyMetrics = await prisma.dailyMetric.findMany({
      where,
      include: {
        salesPerson: true,
      },
      orderBy: {
        date: 'asc',
      },
    });

    // 根据对比类型过滤
    if (comparisonType === 'person' && groupName) {
      return dailyMetrics.filter(m => m.salesPerson.groupName === groupName);
    } else if (comparisonType === 'group' && groupName) {
      return dailyMetrics.filter(m => m.salesPerson.groupName === groupName);
    }

    return dailyMetrics;
  }

  /**
   * 处理日粒度数据
   */
  private processDailyData(
    dailyMetrics: any[],
    comparisonType: string,
    metric: string
  ) {
    if (comparisonType === 'all') {
      return this.processAllPeopleDaily(dailyMetrics, metric);
    } else if (comparisonType === 'group') {
      return this.processGroupDaily(dailyMetrics, metric);
    } else {
      return this.processPersonDaily(dailyMetrics, metric);
    }
  }

  /**
   * 全部人对比 - 日粒度
   */
  private processAllPeopleDaily(dailyMetrics: any[], metric: string) {
    const dateMap = new Map<string, {
      customerTurnCount: number;
      timelyReplyCount: number;
      overtimeReplyCount: number;
      totalReplyDuration: number;
      conversationCount: number;
    }>();

    // 按日期聚合所有人的数据
    for (const m of dailyMetrics) {
      const dateStr = moment(m.date).format('YYYY-MM-DD');

      if (!dateMap.has(dateStr)) {
        dateMap.set(dateStr, {
          customerTurnCount: 0,
          timelyReplyCount: 0,
          overtimeReplyCount: 0,
          totalReplyDuration: 0,
          conversationCount: 0,
        });
      }

      const data = dateMap.get(dateStr)!;
      data.customerTurnCount += m.customerTurnCount;
      data.timelyReplyCount += m.timelyReplyCount;
      data.overtimeReplyCount += m.overtimeReplyCount;
      data.totalReplyDuration += Number(m.totalReplyDuration);
      data.conversationCount += m.processedConversationIds.length;
    }

    // 计算指标并返回时间序列
    const series = Array.from(dateMap.entries()).map(([date, data]) => ({
      date,
      value: this.calculateMetric(data, metric),
      name: '全公司',
    }));

    return {
      series,
      lines: ['全公司'],
    };
  }

  /**
   * 组对比 - 日粒度
   */
  private processGroupDaily(dailyMetrics: any[], metric: string) {
    const groupDateMap = new Map<string, Map<string, {
      customerTurnCount: number;
      timelyReplyCount: number;
      overtimeReplyCount: number;
      totalReplyDuration: number;
      conversationCount: number;
    }>>();

    // 按小组和日期聚合
    for (const m of dailyMetrics) {
      const groupName = m.salesPerson.groupName || '未分配小组';
      const dateStr = moment(m.date).format('YYYY-MM-DD');

      if (!groupDateMap.has(groupName)) {
        groupDateMap.set(groupName, new Map());
      }

      const dateMap = groupDateMap.get(groupName)!;
      if (!dateMap.has(dateStr)) {
        dateMap.set(dateStr, {
          customerTurnCount: 0,
          timelyReplyCount: 0,
          overtimeReplyCount: 0,
          totalReplyDuration: 0,
          conversationCount: 0,
        });
      }

      const data = dateMap.get(dateStr)!;
      data.customerTurnCount += m.customerTurnCount;
      data.timelyReplyCount += m.timelyReplyCount;
      data.overtimeReplyCount += m.overtimeReplyCount;
      data.totalReplyDuration += Number(m.totalReplyDuration);
      data.conversationCount += m.processedConversationIds.length;
    }

    // 转换为时间序列格式
    const series: any[] = [];
    const lines: string[] = [];

    for (const [groupName, dateMap] of groupDateMap.entries()) {
      lines.push(groupName);
      for (const [date, data] of dateMap.entries()) {
        series.push({
          date,
          value: this.calculateMetric(data, metric),
          name: groupName,
        });
      }
    }

    return { series, lines };
  }

  /**
   * 个人对比 - 日粒度
   */
  private processPersonDaily(dailyMetrics: any[], metric: string) {
    const personDateMap = new Map<string, Map<string, {
      customerTurnCount: number;
      timelyReplyCount: number;
      overtimeReplyCount: number;
      totalReplyDuration: number;
      conversationCount: number;
    }>>();

    // 按个人和日期聚合
    for (const m of dailyMetrics) {
      const personName = m.salesPerson.name;
      const dateStr = moment(m.date).format('YYYY-MM-DD');

      if (!personDateMap.has(personName)) {
        personDateMap.set(personName, new Map());
      }

      const dateMap = personDateMap.get(personName)!;
      if (!dateMap.has(dateStr)) {
        dateMap.set(dateStr, {
          customerTurnCount: 0,
          timelyReplyCount: 0,
          overtimeReplyCount: 0,
          totalReplyDuration: 0,
          conversationCount: 0,
        });
      }

      const data = dateMap.get(dateStr)!;
      data.customerTurnCount += m.customerTurnCount;
      data.timelyReplyCount += m.timelyReplyCount;
      data.overtimeReplyCount += m.overtimeReplyCount;
      data.totalReplyDuration += Number(m.totalReplyDuration);
      data.conversationCount += m.processedConversationIds.length;
    }

    // 转换为时间序列格式
    const series: any[] = [];
    const lines: string[] = [];

    for (const [personName, dateMap] of personDateMap.entries()) {
      lines.push(personName);
      for (const [date, data] of dateMap.entries()) {
        series.push({
          date,
          value: this.calculateMetric(data, metric),
          name: personName,
        });
      }
    }

    return { series, lines };
  }

  /**
   * 处理周粒度数据
   */
  private processWeeklyData(
    dailyMetrics: any[],
    comparisonType: string,
    metric: string,
    startDate: string,
    endDate: string
  ) {
    if (comparisonType === 'all') {
      return this.processAllPeopleWeekly(dailyMetrics, metric);
    } else if (comparisonType === 'group') {
      return this.processGroupWeekly(dailyMetrics, metric);
    } else {
      return this.processPersonWeekly(dailyMetrics, metric);
    }
  }

  /**
   * 全部人对比 - 周粒度
   */
  private processAllPeopleWeekly(dailyMetrics: any[], metric: string) {
    const weekMap = new Map<string, {
      customerTurnCount: number;
      timelyReplyCount: number;
      overtimeReplyCount: number;
      totalReplyDuration: number;
      conversationCount: number;
    }>();

    // 按周聚合
    for (const m of dailyMetrics) {
      const weekKey = this.getWeekKey(m.date);

      if (!weekMap.has(weekKey)) {
        weekMap.set(weekKey, {
          customerTurnCount: 0,
          timelyReplyCount: 0,
          overtimeReplyCount: 0,
          totalReplyDuration: 0,
          conversationCount: 0,
        });
      }

      const data = weekMap.get(weekKey)!;
      data.customerTurnCount += m.customerTurnCount;
      data.timelyReplyCount += m.timelyReplyCount;
      data.overtimeReplyCount += m.overtimeReplyCount;
      data.totalReplyDuration += Number(m.totalReplyDuration);
      data.conversationCount += m.processedConversationIds.length;
    }

    // 计算指标并返回
    const series = Array.from(weekMap.entries()).map(([week, data]) => ({
      date: week,
      value: this.calculateMetric(data, metric),
      name: '全公司',
    }));

    return {
      series,
      lines: ['全公司'],
    };
  }

  /**
   * 组对比 - 周粒度
   */
  private processGroupWeekly(dailyMetrics: any[], metric: string) {
    const groupWeekMap = new Map<string, Map<string, {
      customerTurnCount: number;
      timelyReplyCount: number;
      overtimeReplyCount: number;
      totalReplyDuration: number;
      conversationCount: number;
    }>>();

    // 按小组和周聚合
    for (const m of dailyMetrics) {
      const groupName = m.salesPerson.groupName || '未分配小组';
      const weekKey = this.getWeekKey(m.date);

      if (!groupWeekMap.has(groupName)) {
        groupWeekMap.set(groupName, new Map());
      }

      const weekMap = groupWeekMap.get(groupName)!;
      if (!weekMap.has(weekKey)) {
        weekMap.set(weekKey, {
          customerTurnCount: 0,
          timelyReplyCount: 0,
          overtimeReplyCount: 0,
          totalReplyDuration: 0,
          conversationCount: 0,
        });
      }

      const data = weekMap.get(weekKey)!;
      data.customerTurnCount += m.customerTurnCount;
      data.timelyReplyCount += m.timelyReplyCount;
      data.overtimeReplyCount += m.overtimeReplyCount;
      data.totalReplyDuration += Number(m.totalReplyDuration);
      data.conversationCount += m.processedConversationIds.length;
    }

    // 转换为时间序列
    const series: any[] = [];
    const lines: string[] = [];

    for (const [groupName, weekMap] of groupWeekMap.entries()) {
      lines.push(groupName);
      for (const [week, data] of weekMap.entries()) {
        series.push({
          date: week,
          value: this.calculateMetric(data, metric),
          name: groupName,
        });
      }
    }

    return { series, lines };
  }

  /**
   * 个人对比 - 周粒度
   */
  private processPersonWeekly(dailyMetrics: any[], metric: string) {
    const personWeekMap = new Map<string, Map<string, {
      customerTurnCount: number;
      timelyReplyCount: number;
      overtimeReplyCount: number;
      totalReplyDuration: number;
      conversationCount: number;
    }>>();

    // 按个人和周聚合
    for (const m of dailyMetrics) {
      const personName = m.salesPerson.name;
      const weekKey = this.getWeekKey(m.date);

      if (!personWeekMap.has(personName)) {
        personWeekMap.set(personName, new Map());
      }

      const weekMap = personWeekMap.get(personName)!;
      if (!weekMap.has(weekKey)) {
        weekMap.set(weekKey, {
          customerTurnCount: 0,
          timelyReplyCount: 0,
          overtimeReplyCount: 0,
          totalReplyDuration: 0,
          conversationCount: 0,
        });
      }

      const data = weekMap.get(weekKey)!;
      data.customerTurnCount += m.customerTurnCount;
      data.timelyReplyCount += m.timelyReplyCount;
      data.overtimeReplyCount += m.overtimeReplyCount;
      data.totalReplyDuration += Number(m.totalReplyDuration);
      data.conversationCount += m.processedConversationIds.length;
    }

    // 转换为时间序列
    const series: any[] = [];
    const lines: string[] = [];

    for (const [personName, weekMap] of personWeekMap.entries()) {
      lines.push(personName);
      for (const [week, data] of weekMap.entries()) {
        series.push({
          date: week,
          value: this.calculateMetric(data, metric),
          name: personName,
        });
      }
    }

    return { series, lines };
  }

  /**
   * 获取周标识（格式：YYYY-WW，例如 2025-W02）
   */
  private getWeekKey(date: Date): string {
    const m = moment(date).tz('Asia/Shanghai');
    // 获取 ISO 周（周一为一周开始）
    const year = m.isoWeekYear();
    const week = m.isoWeek();
    return `${year}-W${String(week).padStart(2, '0')}`;
  }

  /**
   * 计算指定指标
   */
  private calculateMetric(data: {
    customerTurnCount: number;
    timelyReplyCount: number;
    overtimeReplyCount: number;
    totalReplyDuration: number;
    conversationCount: number;
  }, metric: string): number {
    switch (metric) {
      case 'timelyReplyRate':
        return data.customerTurnCount > 0
          ? (data.timelyReplyCount / data.customerTurnCount) * 100
          : 0;
      case 'overtimeReplyRate':
        return data.customerTurnCount > 0
          ? (data.overtimeReplyCount / data.customerTurnCount) * 100
          : 0;
      case 'avgReplyDuration':
        return data.customerTurnCount > 0
          ? data.totalReplyDuration / data.customerTurnCount / 60 // 转换为分钟
          : 0;
      case 'conversationCount':
        return data.conversationCount;
      default:
        return 0;
    }
  }

  /**
   * 获取可用的日期范围（有数据的日期）
   */
  async getAvailableDateRange() {
    const earliest = await prisma.dailyMetric.findFirst({
      orderBy: { date: 'asc' },
      select: { date: true },
    });

    const latest = await prisma.dailyMetric.findFirst({
      orderBy: { date: 'desc' },
      select: { date: true },
    });

    if (!earliest || !latest) {
      return null;
    }

    return {
      startDate: moment(earliest.date).format('YYYY-MM-DD'),
      endDate: moment(latest.date).format('YYYY-MM-DD'),
    };
  }
}

export default new TrendService();
