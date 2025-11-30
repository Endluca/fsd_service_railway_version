/**
 * 类型定义
 */

export interface SalesData {
  openUserId: string;
  name: string;
  groupName: string | null;
  customerTurnCount: number; // 总消息数（客户发言总轮次-旧规则）
  timelyReplyRate: number; // 及时回复率（%）
  overtimeReplyRate: number; // 超时回复率（%）
  avgReplyDuration: number; // 平均回复时长（分钟）
  newRuleCustomerTurnCount: number; // 新规则总消息数
  overtimeReplyCount: number; // 超时回复数
  overtimeNoReplyCount: number; // 超时未回复数
  conversationCount: number; // 会话数
}

export interface Group {
  name: string;
}

export interface Sales {
  openUserId: string;
  name: string;
  groupName: string | null;
}

export interface QueryParams {
  startDate: string;
  endDate: string;
  groupNames?: string[];
  openUserIds?: string[];
}

// 趋势数据相关类型
export type Granularity = 'day' | 'week';
export type ComparisonType = 'all' | 'group' | 'person';
export type MetricType = 'timelyReplyRate' | 'overtimeReplyRate' | 'avgReplyDuration' | 'conversationCount';

export interface TrendQueryParams {
  startDate: string;
  endDate: string;
  granularity: Granularity;
  comparisonType: ComparisonType;
  groupNames?: string[];      // 组间对比时的组列表（多选）
  openUserIds?: string[];     // 组内人员对比时的人员ID列表（多选，支持跨组）
  metric: MetricType;
}

export interface TrendDataPoint {
  date: string; // YYYY-MM-DD 或 YYYY-WW (周格式)
  value: number;
  name: string; // 线的名称（整体/组名/人名）
}

export interface TrendResponse {
  series: TrendDataPoint[]; // 时间序列数据点
  lines: string[]; // 所有线的名称列表
}

export interface DateRange {
  startDate: string;
  endDate: string;
}
