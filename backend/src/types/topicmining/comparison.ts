/**
 * 话题挖掘月度对比功能类型定义
 */

/**
 * 月份信息
 */
export interface MonthInfo {
  month: string;          // YYYY-MM格式
  reportCount: number;    // 该月份的报告数量
  reportIds: string[];    // 该月份的报告ID列表
}

/**
 * 对比查询参数
 */
export interface ComparisonQueryParams {
  months: string[];       // 月份数组,格式 YYYY-MM
  parentTopN: number;     // 每月取前N个父类
  childTopN: number;      // 每月取前N个子类
}

/**
 * 类别数据(父类或子类)
 */
export interface CategoryData {
  count: number;          // 该类别的数量
  percentage: number;     // 该类别在当月的占比
  parent?: string;        // 所属父类(仅子类需要)
}

/**
 * 对比图表数据
 */
export interface ComparisonChartData {
  categories: string[];   // 所有类别名称(合并去重后)
  months: string[];       // 所有月份
  series: {               // 按月份-类别组织的数据
    [month: string]: {
      [category: string]: CategoryData;
    };
  };
}

/**
 * 对比结果(包含父类和子类对比)
 */
export interface ComparisonResult {
  parentComparison: ComparisonChartData;
  childComparison: ComparisonChartData;
}
