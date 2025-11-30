/**
 * 红线对比趋势服务
 * 计算多周红线趋势对比数据
 */

import prisma from '../../config/prisma';
import conversationCountService from './conversationCountService';

interface ComparisonQueryParams {
  weekStarts: Date[];
  weekEnds: Date[];
  departments?: string[];
  redLineTypes?: string[];
}

interface OverallTrendData {
  weeks: string[];
  series: {
    [department: string]: {
      ratios: number[];
    };
  };
}

interface RedLineTrendData {
  weeks: string[];
  redLineTypes: string[];
  series: {
    [week: string]: {
      [redLineType: string]: {
        count: number;
        percentage: number;
      };
    };
  };
}

const comparisonService = {
  /**
   * 获取对比趋势数据
   */
  async getComparisonTrend(params: ComparisonQueryParams) {
    const { weekStarts, weekEnds, departments, redLineTypes } = params;

    // 1. 查询红线记录
    const weekConditions = weekStarts.map((start, i) => ({
      weekStart: start,
      weekEnd: weekEnds[i],
    }));

    const redLineRecords = await prisma.redLineRecord.findMany({
      where: {
        OR: weekConditions,
        ...(departments?.length ? { department: { in: departments } } : {}),
        ...(redLineTypes?.length ? { redLineType: { in: redLineTypes } } : {}),
      },
      select: {
        weekStart: true,
        weekEnd: true,
        department: true,
        redLineType: true,
        conversationId: true,
      },
    });

    // 2. 查询会话总数
    const conversationCounts = await conversationCountService.getCounts(
      weekStarts,
      weekEnds,
      departments
    );

    // 3. 计算总红线趋势
    const overallTrend = this.calculateOverallTrend(
      redLineRecords,
      conversationCounts,
      departments || ['cc', 'ss', 'lp']
    );

    // 4. 计算各红线趋势
    const redLineTrend = this.calculateRedLineTrend(
      redLineRecords,
      departments || ['cc', 'ss', 'lp']
    );

    return { overallTrend, redLineTrend };
  },

  /**
   * 计算总红线趋势(红线占会话比例)
   */
  calculateOverallTrend(
    redLineRecords: any[],
    conversationCounts: any[],
    departments: string[]
  ): OverallTrendData {
    // 按周+部门分组统计红线数
    const redLineMap = new Map<string, Map<string, number>>();

    for (const record of redLineRecords) {
      const weekKey = `${record.weekStart.toISOString().split('T')[0]}~${
        record.weekEnd.toISOString().split('T')[0]
      }`;
      if (!redLineMap.has(weekKey)) {
        redLineMap.set(weekKey, new Map());
      }
      const deptMap = redLineMap.get(weekKey)!;
      deptMap.set(record.department, (deptMap.get(record.department) || 0) + 1);
    }

    // 构建会话总数Map
    const conversationMap = new Map<string, Map<string, number>>();

    for (const count of conversationCounts) {
      const weekKey = `${count.weekStart.toISOString().split('T')[0]}~${
        count.weekEnd.toISOString().split('T')[0]
      }`;
      if (!conversationMap.has(weekKey)) {
        conversationMap.set(weekKey, new Map());
      }
      conversationMap.get(weekKey)!.set(count.department, count.conversationCount);
    }

    // 计算比例
    const weeks = Array.from(redLineMap.keys()).sort();
    const series: OverallTrendData['series'] = {};

    for (const dept of departments) {
      series[dept] = { ratios: [] };

      for (const week of weeks) {
        const redLineCount = redLineMap.get(week)?.get(dept) || 0;
        const conversationCount = conversationMap.get(week)?.get(dept) || 0;
        const ratio = conversationCount > 0 ? (redLineCount / conversationCount) * 100 : 0;
        series[dept].ratios.push(Number(ratio.toFixed(2)));
      }
    }

    // 计算"所有部门"的汇总数据
    series['all'] = { ratios: [] };
    for (const week of weeks) {
      let totalRedLines = 0;
      let totalConversations = 0;

      for (const dept of departments) {
        totalRedLines += redLineMap.get(week)?.get(dept) || 0;
        totalConversations += conversationMap.get(week)?.get(dept) || 0;
      }

      const ratio = totalConversations > 0 ? (totalRedLines / totalConversations) * 100 : 0;
      series['all'].ratios.push(Number(ratio.toFixed(2)));
    }

    return { weeks, series };
  },

  /**
   * 计算各红线趋势(各类型占总红线比例)
   */
  calculateRedLineTrend(
    redLineRecords: any[],
    departments: string[]
  ): RedLineTrendData {
    // 按周+类型分组统计
    const typeCountMap = new Map<string, Map<string, number>>();
    const weekTotalMap = new Map<string, number>();

    for (const record of redLineRecords) {
      if (!departments.includes(record.department)) continue;

      const weekKey = `${record.weekStart.toISOString().split('T')[0]}~${
        record.weekEnd.toISOString().split('T')[0]
      }`;

      // 统计该类型数量
      if (!typeCountMap.has(weekKey)) {
        typeCountMap.set(weekKey, new Map());
      }
      const typeMap = typeCountMap.get(weekKey)!;
      typeMap.set(record.redLineType, (typeMap.get(record.redLineType) || 0) + 1);

      // 统计周总数
      weekTotalMap.set(weekKey, (weekTotalMap.get(weekKey) || 0) + 1);
    }

    // 获取所有红线类型
    const allTypes = new Set<string>();
    for (const typeMap of typeCountMap.values()) {
      for (const type of typeMap.keys()) {
        allTypes.add(type);
      }
    }
    const redLineTypes = Array.from(allTypes).sort();

    // 计算百分比
    const weeks = Array.from(typeCountMap.keys()).sort();
    const series: RedLineTrendData['series'] = {};

    for (const week of weeks) {
      series[week] = {};
      const total = weekTotalMap.get(week) || 0;
      const typeMap = typeCountMap.get(week)!;

      for (const type of redLineTypes) {
        const count = typeMap.get(type) || 0;
        const percentage = total > 0 ? (count / total) * 100 : 0;
        series[week][type] = {
          count,
          percentage: Number(percentage.toFixed(2)),
        };
      }
    }

    return { weeks, redLineTypes, series };
  },
};

export default comparisonService;
