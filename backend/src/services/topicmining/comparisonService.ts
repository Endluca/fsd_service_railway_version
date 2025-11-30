/**
 * 话题挖掘月度对比服务
 * 负责聚合和计算多个月份的话题对比数据
 */

import prisma from '../../config/prisma';
import type {
  MonthInfo,
  ComparisonQueryParams,
  ComparisonResult,
  ComparisonChartData,
  CategoryData,
} from '../../types/topicmining/comparison';
import type {
  CsvAnalysisResult,
  ParentStat,
  ChildStat,
  ReportMetadata,
} from '../../types/topicmining/report';

class ComparisonService {
  /**
   * 获取所有可用月份列表
   */
  async getAvailableMonths(): Promise<MonthInfo[]> {
    // 查询所有报告
    const reports = await prisma.report.findMany({
      select: {
        id: true,
        metadataJson: true,
        generatedAt: true,
      },
      orderBy: {
        generatedAt: 'desc',
      },
    });

    // 按月份分组
    const monthMap = new Map<string, string[]>();

    for (const report of reports) {
      const month = this.extractMonth(report);
      if (!monthMap.has(month)) {
        monthMap.set(month, []);
      }
      monthMap.get(month)!.push(report.id);
    }

    // 转换为MonthInfo数组并按月份降序排序
    const months: MonthInfo[] = Array.from(monthMap.entries())
      .map(([month, reportIds]) => ({
        month,
        reportCount: reportIds.length,
        reportIds,
      }))
      .sort((a, b) => b.month.localeCompare(a.month));

    return months;
  }

  /**
   * 获取对比数据
   */
  async getComparisonData(
    params: ComparisonQueryParams
  ): Promise<ComparisonResult> {
    const { months, parentTopN, childTopN } = params;

    // 1. 查询对应月份的Report(每月取最新)
    const monthlyReports = await this.getReportsForMonths(months);

    // 2. 提取每月的TopN父类和子类
    const monthlyParents = new Map<string, ParentStat[]>();
    const monthlyChildren = new Map<string, ChildStat[]>();

    for (const [month, report] of monthlyReports.entries()) {
      const statistics = report.statisticsJson as CsvAnalysisResult;
      monthlyParents.set(month, this.getTopParents(statistics, parentTopN));
      monthlyChildren.set(month, this.getTopChildren(statistics, childTopN));
    }

    // 3. 合并类别(去重)
    const allParentCategories = this.mergeCategories(
      Array.from(monthlyParents.values())
    );
    const allChildCategories = this.mergeCategories(
      Array.from(monthlyChildren.values())
    );

    // 4. 构建对比数据
    const parentComparison = this.buildComparisonData(
      months,
      allParentCategories,
      monthlyReports,
      'parent'
    );

    const childComparison = this.buildComparisonData(
      months,
      allChildCategories,
      monthlyReports,
      'child'
    );

    return {
      parentComparison,
      childComparison,
    };
  }

  /**
   * 提取Report的月份
   * 优先使用metadata.timeRange,fallback到generatedAt
   */
  private extractMonth(report: {
    metadataJson: any;
    generatedAt: Date;
  }): string {
    const metadata = report.metadataJson as ReportMetadata | undefined;

    // 优先从timeRange提取
    if (metadata?.timeRange?.start) {
      return metadata.timeRange.start.slice(0, 7); // YYYY-MM
    }

    // fallback到generatedAt
    const dateStr = report.generatedAt.toISOString();
    return dateStr.slice(0, 7); // YYYY-MM
  }

  /**
   * 获取指定月份的Report(每月取最新)
   */
  private async getReportsForMonths(
    months: string[]
  ): Promise<
    Map<
      string,
      { id: string; statisticsJson: any; metadataJson: any; generatedAt: Date }
    >
  > {
    // 查询所有报告
    const allReports = await prisma.report.findMany({
      select: {
        id: true,
        statisticsJson: true,
        metadataJson: true,
        generatedAt: true,
        createdAt: true,
      },
      orderBy: {
        createdAt: 'desc',
      },
    });

    const result = new Map<
      string,
      { id: string; statisticsJson: any; metadataJson: any; generatedAt: Date }
    >();

    for (const month of months) {
      // 找到该月份的所有报告
      const monthReports = allReports.filter((r) => {
        const reportMonth = this.extractMonth(r);
        return reportMonth === month;
      });

      // 取最新的一个(按createdAt已排序,取第一个)
      if (monthReports.length > 0) {
        result.set(month, monthReports[0]);
      }
    }

    return result;
  }

  /**
   * 取TopN父类
   */
  private getTopParents(
    statistics: CsvAnalysisResult,
    topN: number
  ): ParentStat[] {
    const parents = statistics.parents || [];
    // 按count降序排序,取前topN个
    const sorted = [...parents].sort((a, b) => b.count - a.count);
    return sorted.slice(0, topN);
  }

  /**
   * 取TopN子类
   */
  private getTopChildren(
    statistics: CsvAnalysisResult,
    topN: number
  ): ChildStat[] {
    const childStats = statistics.childStats || {};

    // 收集所有子类
    const allChildren: (ChildStat & { parent: string })[] = [];
    for (const [parentName, children] of Object.entries(childStats)) {
      for (const child of children) {
        allChildren.push({
          ...child,
          parent: parentName,
        });
      }
    }

    // 按count降序排序,取前topN个
    const sorted = allChildren.sort((a, b) => b.count - a.count);
    return sorted.slice(0, topN);
  }

  /**
   * 合并类别列表(去重)
   */
  private mergeCategories(
    categoryLists: Array<Array<{ name: string }>>
  ): string[] {
    const categorySet = new Set<string>();

    for (const list of categoryLists) {
      for (const item of list) {
        categorySet.add(item.name);
      }
    }

    return Array.from(categorySet).sort();
  }

  /**
   * 构建对比数据
   */
  private buildComparisonData(
    months: string[],
    categories: string[],
    monthlyReports: Map<
      string,
      { id: string; statisticsJson: any; metadataJson: any; generatedAt: Date }
    >,
    type: 'parent' | 'child'
  ): ComparisonChartData {
    const series: ComparisonChartData['series'] = {};

    for (const month of months) {
      const report = monthlyReports.get(month);
      series[month] = {};

      if (!report) {
        // 该月份没有报告,所有类别都是0
        for (const category of categories) {
          series[month][category] = {
            count: 0,
            percentage: 0,
          };
        }
        continue;
      }

      const statistics = report.statisticsJson as CsvAnalysisResult;

      for (const category of categories) {
        let categoryData: CategoryData | null = null;

        if (type === 'parent') {
          // 查找父类数据
          const parent = statistics.parents?.find((p) => p.name === category);
          if (parent) {
            categoryData = {
              count: parent.count,
              percentage: parent.percentage,
            };
          }
        } else {
          // 查找子类数据
          const childStats = statistics.childStats || {};
          for (const [parentName, children] of Object.entries(childStats)) {
            const child = children.find((c) => c.name === category);
            if (child) {
              categoryData = {
                count: child.count,
                percentage: child.parentPercentage, // 使用总体占比
                parent: parentName,
              };
              break;
            }
          }
        }

        // 如果找不到,则为0
        series[month][category] = categoryData || {
          count: 0,
          percentage: 0,
        };
      }
    }

    return {
      categories,
      months,
      series,
    };
  }
}

export default new ComparisonService();
