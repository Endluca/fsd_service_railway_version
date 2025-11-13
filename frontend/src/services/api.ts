import axios from 'axios';
import type { SalesData, QueryParams } from '../types';

const client = axios.create({
  baseURL: '/api',
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
 */
export async function getSales(groupName?: string): Promise<{ openUserId: string; name: string; groupName: string | null }[]> {
  return client.get('/sales', { params: { groupName } });
}

/**
 * 手动触发数据采集
 */
export async function triggerCollect(date?: string) {
  return client.post('/collect', { date });
}
