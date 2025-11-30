/**
 * 愤怒小鸟模块前端类型定义
 */

export type Department = 'cc' | 'ss' | 'lp' | '';

/**
 * 周范围项
 */
export interface WeekItem {
  weekStart: string;
  weekEnd: string;
  recordCount: number;
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

/**
 * 上传响应
 */
export interface UploadResponse {
  code: number;
  message?: string;
  data?: {
    importedCount?: number;
    totalRecords?: number;
    recordCount?: number;
    errors?: any[];
  };
}
