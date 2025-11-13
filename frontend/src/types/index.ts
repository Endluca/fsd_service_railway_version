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
  groupName?: string;
  openUserId?: string;
}
