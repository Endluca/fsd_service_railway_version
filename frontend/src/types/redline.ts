/**
 * 红线看板前端类型定义
 */

// 部门类型
export type Department = 'cc' | 'ss' | 'lp' | '';

// 周范围
export interface WeekRange {
  weekStart: string; // YYYY-MM-DD
  weekEnd: string;   // YYYY-MM-DD
}

// 周列表项
export interface WeekItem {
  weekStart: string;
  weekEnd: string;
  recordCount: number;
}

// 上传响应
export interface UploadResponse {
  code: number;
  message?: string;
  data?: {
    imported?: number;
    weekStart?: string;
    weekEnd?: string;
    recordCount?: number;
    errors?: ParseError[];
  };
}

// 解析错误
export interface ParseError {
  row: number;
  field: string;
  value: string;
  reason: string;
}

// 检查周结果
export interface CheckWeekResult {
  exists: boolean;
  recordCount?: number;
  weekStart?: string;
  weekEnd?: string;
}

// 红线类型统计
export interface RedLineTypeStat {
  redLineType: string;
  violationCount: number;
  violationConversationCount: number;
  percentageOfTotal: number;
  percentageOfConversations: number;
}

// 统计结果
export interface StatisticsResult {
  stats: RedLineTypeStat[];
  totalViolations: number;
  totalConversations: number;
}

// 详情记录
export interface RedLineDetail {
  conversationId: string;
  customer: string;
  sales: string;
  originalDepartment: string;
  redLineType: string;
  content: string;
}

// 分页详情结果
export interface DetailsResult {
  details: RedLineDetail[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

// API 响应基础类型
export interface ApiResponse<T = any> {
  code: number;
  message?: string;
  data?: T;
}
