import axios from 'axios';
import type { SalesData, QueryParams, TrendQueryParams, TrendResponse, DateRange } from '../types';

// 根据环境使用不同的 API 地址
// 开发环境：使用相对路径 /api（通过 Vite proxy 转发）
// 生产环境：使用环境变量配置的完整 URL
const baseURL = import.meta.env.VITE_API_BASE_URL
  ? `${import.meta.env.VITE_API_BASE_URL}/api`
  : '/api';

const client = axios.create({
  baseURL,
  timeout: 30000,
});

// 响应拦截器
client.interceptors.response.use(
  (response) => {
    if (response.data.code !== 0) {
      throw new Error(response.data.message || '请求失败');
    }
    return response.data.data;
  },
  (error) => {
    console.error('API请求失败:', error);
    throw error;
  }
);

/**
 * 查询数据看板
 */
export async function queryDashboard(params: QueryParams): Promise<SalesData[]> {
  return client.get('/dashboard', { params });
}

/**
 * 获取所有小组列表
 */
export async function getGroups(): Promise<string[]> {
  return client.get('/groups');
}

/**
 * 获取销售列表
 * @param groupNames 小组名称数组（可选）
 * @param startDate 开始日期（可选，格式：YYYY-MM-DD）
 * @param endDate 结束日期（可选，格式：YYYY-MM-DD）
 * @returns 销售列表。如果提供日期范围，则只返回该时间范围内有数据的销售
 */
export async function getSales(
  groupNames?: string[],
  startDate?: string,
  endDate?: string
): Promise<{ openUserId: string; name: string; groupName: string | null }[]> {
  return client.get('/sales', { params: { groupNames, startDate, endDate } });
}

/**
 * 手动触发数据采集
 */
export async function triggerCollect(date?: string) {
  return client.post('/collect', { date });
}

/**
 * 获取趋势数据
 */
export async function getTrendData(params: TrendQueryParams): Promise<TrendResponse> {
  return client.get('/trend', { params });
}

/**
 * 获取可用的日期范围
 */
export async function getTrendDateRange(): Promise<DateRange | null> {
  return client.get('/trend/date-range');
}

// 导出 axios client 实例供其他服务使用
export default client;
