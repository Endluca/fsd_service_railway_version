/**
 * 社媒监控 API 服务
 */

import axios from 'axios';
import type { SearchResult, ApiResponse, Platform } from '../types/socialmedia';

// 根据环境使用不同的 API 地址
const baseURL = import.meta.env.VITE_API_BASE_URL
  ? `${import.meta.env.VITE_API_BASE_URL}/api`
  : '/api';

const client = axios.create({
  baseURL,
  timeout: 120000, // 2 分钟（Apify 调用可能较慢）
});

/**
 * 执行社媒搜索
 */
export const searchSocialMedia = async (
  keywords: string[],
  platforms: Platform[],
  maxCount: number
): Promise<ApiResponse<SearchResult>> => {
  const response = await client.post('/socialmedia/search', {
    keywords,
    platforms,
    maxCount,
  });
  return response.data;
};

/**
 * 健康检查
 */
export const healthCheck = async (): Promise<ApiResponse<{ tokenValid: boolean }>> => {
  const response = await client.get('/socialmedia/health');
  return response.data;
};
