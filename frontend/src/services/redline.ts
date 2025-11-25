/**
 * 红线看板 API 客户端
 */

import axios from 'axios';
import type {
  WeekItem,
  CheckWeekResult,
  StatisticsResult,
  DetailsResult,
  ApiResponse,
  UploadResponse,
} from '../types/redline';

// 创建独立的 axios 实例，不使用拦截器
// 因为 api.ts 的拦截器只返回 response.data.data，但红线 API 需要完整响应（包括 code、message）
const baseURL = import.meta.env.VITE_API_BASE_URL
  ? `${import.meta.env.VITE_API_BASE_URL}/api`
  : '/api';

const redlineClient = axios.create({
  baseURL,
  timeout: 30000,
});

// 辅助函数：使用独立客户端发送请求
const requestWithoutInterceptor = async <T>(config: any): Promise<T> => {
  const response = await redlineClient.request<T>(config);
  return response.data;
};

// 上传文件并导入数据
export const uploadFile = async (
  file: File,
  weekStart: string,
  weekEnd: string,
  replace: boolean = false
): Promise<UploadResponse> => {
  const formData = new FormData();
  formData.append('file', file);
  formData.append('weekStart', weekStart);
  formData.append('weekEnd', weekEnd);
  formData.append('replace', replace.toString());

  return requestWithoutInterceptor<UploadResponse>({
    url: '/redline/upload',
    method: 'POST',
    data: formData,
    headers: {
      'Content-Type': 'multipart/form-data',
    },
  });
};

// 检查周是否已有数据
export const checkWeek = async (
  weekStart: string,
  weekEnd: string
): Promise<ApiResponse<CheckWeekResult>> => {
  return requestWithoutInterceptor<ApiResponse<CheckWeekResult>>({
    url: '/redline/check-week',
    method: 'POST',
    data: { weekStart, weekEnd },
  });
};

// 获取已有数据的周列表
export const getWeekList = async (): Promise<ApiResponse<WeekItem[]>> => {
  return requestWithoutInterceptor<ApiResponse<WeekItem[]>>({
    url: '/redline/weeks',
    method: 'GET',
  });
};

// 获取销售列表
export const getSalesList = async (
  weekStarts: string[],
  weekEnds: string[],
  department?: string
): Promise<ApiResponse<string[]>> => {
  return requestWithoutInterceptor<ApiResponse<string[]>>({
    url: '/redline/sales-list',
    method: 'GET',
    params: {
      weekStarts,
      weekEnds,
      department,
    },
    paramsSerializer: {
      indexes: null, // 使用 weekStarts[]=xxx 格式
    },
  });
};

// 获取统计数据
export const getStatistics = async (
  weekStarts: string[],
  weekEnds: string[],
  department?: string,
  sales?: string
): Promise<ApiResponse<StatisticsResult>> => {
  return requestWithoutInterceptor<ApiResponse<StatisticsResult>>({
    url: '/redline/statistics',
    method: 'GET',
    params: {
      weekStarts,
      weekEnds,
      department,
      sales,
    },
    paramsSerializer: {
      indexes: null,
    },
  });
};

// 获取详情（分页）
export const getDetails = async (
  weekStarts: string[],
  weekEnds: string[],
  redLineType: string,
  department?: string,
  sales?: string,
  page: number = 1,
  pageSize: number = 10
): Promise<ApiResponse<DetailsResult>> => {
  return requestWithoutInterceptor<ApiResponse<DetailsResult>>({
    url: '/redline/details',
    method: 'GET',
    params: {
      weekStarts,
      weekEnds,
      redLineType,
      department,
      sales,
      page,
      pageSize,
    },
    paramsSerializer: {
      indexes: null,
    },
  });
};
