/**
 * 愤怒小鸟模块类型定义
 */

export type Department = 'cc' | 'ss' | 'lp' | '';

/**
 * Excel 原始行数据结构
 */
export interface XlsxRawRow {
  '会话ID': string;
  '会话开始时间': string;
  '客户': string;
  '销售': string;
  '成员所属部门': string;
  '识别客户情绪': string;
  '原文': string;
}

/**
 * 解析后的愤怒小鸟行数据
 */
export interface ParsedAngryBirdRow {
  conversationId: string;
  conversationStartTime: Date;
  customer: string;
  sales: string;
  department: Department;
  originalDepartment: string;
  customerEmotion: string;
  content: string; // 原文可为空字符串
}

/**
 * 解析错误信息
 */
export interface ParseError {
  row: number;
  field: string;
  value: string;
  reason: string;
}

/**
 * XLSX 解析结果
 */
export interface XlsxParseResult {
  success: boolean;
  data?: ParsedAngryBirdRow[];
  errors?: ParseError[];
  message?: string;
}

/**
 * 周范围项
 */
export interface WeekItem {
  weekStart: string;
  weekEnd: string;
  recordCount: number;
}

/**
 * 部门提取结果
 */
export interface DepartmentExtractResult {
  department: Department | null;
  error: string | null;
}

/**
 * 客户情绪统计
 */
export interface EmotionStat {
  emotion: string;
  count: number;
  percentage: number;
}

/**
 * 愤怒小鸟详情
 */
export interface AngryBirdDetail {
  conversationId: string;
  conversationStartTime: string;
  customer: string;
  sales: string;
  originalDepartment: string;
  customerEmotion: string;
  content: string | null; // 原文可为空
}
