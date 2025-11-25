/**
 * 红线看板类型定义
 */

// 部门类型
export type Department = 'cc' | 'ss' | 'lp';

// Excel 原始行数据
export interface XlsxRawRow {
  '会话ID': string;
  '客户': string;
  '销售': string;
  '成员所属部门': string;
  '红线类型': string;
  '原文': string;
}

// 解析后的数据行
export interface ParsedRedLineRow {
  conversationId: string;
  customer: string;
  sales: string;
  department: Department;
  originalDepartment: string;
  redLineType: string;
  content: string;
}

// 解析错误信息
export interface ParseError {
  row: number;
  field: string;
  value: string;
  reason: string;
}

// 解析结果
export interface XlsxParseResult {
  success: boolean;
  data?: ParsedRedLineRow[];
  errors?: ParseError[];
  message?: string;
}

// 部门提取结果
export interface DepartmentExtractResult {
  department: Department | null;
  error: string | null;
}

// 上传请求参数
export interface UploadRequest {
  weekStart: string; // YYYY-MM-DD format
  weekEnd: string;   // YYYY-MM-DD format
}

// 周范围
export interface WeekRange {
  weekStart: Date;
  weekEnd: Date;
}

// 检查周是否存在的结果
export interface CheckWeekResult {
  exists: boolean;
  recordCount?: number;
  weekStart?: string;
  weekEnd?: string;
}

// 红线记录（数据库实体）
export interface RedLineRecordEntity {
  id: number;
  conversationId: string;
  customer: string;
  sales: string;
  department: Department;
  originalDepartment: string;
  redLineType: string;
  content: string;
  weekStart: Date;
  weekEnd: Date;
  createdAt: Date;
  updatedAt: Date;
}

// 统计查询参数
export interface StatisticsQueryParams {
  weekStarts: string[];  // YYYY-MM-DD format array
  weekEnds: string[];    // YYYY-MM-DD format array
  department?: Department;
  sales?: string;
}

// 红线类型统计
export interface RedLineTypeStat {
  redLineType: string;
  violationCount: number;              // 违规数量（该类型的记录数）
  violationConversationCount: number;  // 有该违规的会话数（去重后）
  percentageOfTotal: number;           // 占总红线数的比例
  percentageOfConversations: number;   // 占总会话数的比例
}

// 统计结果
export interface StatisticsResult {
  stats: RedLineTypeStat[];
  totalViolations: number;             // 总红线数（所有记录数）
  totalConversations: number;          // 总会话数（按会话ID去重）
}

// 详情查询参数
export interface DetailsQueryParams {
  weekStarts: string[];
  weekEnds: string[];
  redLineType: string;
  department?: Department;
  sales?: string;
  page: number;
  pageSize: number;
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

// 销售列表查询参数
export interface SalesListQueryParams {
  weekStarts: string[];
  weekEnds: string[];
  department?: Department;
}

// 周列表项
export interface WeekItem {
  weekStart: string;
  weekEnd: string;
  recordCount: number;
}
