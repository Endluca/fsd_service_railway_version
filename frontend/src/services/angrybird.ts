/**
 * 愤怒小鸟 API 客户端
 */

import axios from 'axios';
import type { WeekItem, EmotionStat, AngryBirdDetail, Department, UploadResponse } from '../types/angrybird';

const baseURL = import.meta.env.VITE_API_BASE_URL
  ? `${import.meta.env.VITE_API_BASE_URL}/api`
  : '/api';

const client = axios.create({
  baseURL,
  timeout: 30000,
});

/**
 * 上传并导入 Excel 文件
 */
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

  const response = await client.post<UploadResponse>('/angrybird/upload', formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
  });
  return response.data;
};

/**
 * 获取已导入数据的周列表
 */
export const getWeekList = async () => {
  const response = await client.get<{ code: number; data?: WeekItem[] }>('/angrybird/weeks');
  return response.data;
};

/**
 * 获取销售列表（用于二次筛选）
 */
export const getSalesList = async (
  weekStarts: string[],
  weekEnds: string[],
  department?: Department
) => {
  const response = await client.get<{ code: number; data?: string[] }>('/angrybird/sales-list', {
    params: {
      weekStarts: weekStarts.join(','),
      weekEnds: weekEnds.join(','),
      department,
    },
  });
  return response.data;
};

/**
 * 获取客户情绪统计
 */
export const getEmotionStats = async (
  weekStarts: string[],
  weekEnds: string[],
  department?: Department,
  sales?: string[]
) => {
  const response = await client.get<{
    code: number;
    data?: { stats: EmotionStat[]; totalRecords: number };
  }>('/angrybird/emotion-stats', {
    params: {
      weekStarts: weekStarts.join(','),
      weekEnds: weekEnds.join(','),
      department,
      sales: sales?.join(','),
    },
  });
  return response.data;
};

/**
 * 获取详情列表（分页）
 */
export const getDetails = async (
  weekStarts: string[],
  weekEnds: string[],
  department?: Department,
  sales?: string[],
  page: number = 1,
  pageSize: number = 10
) => {
  const response = await client.get<{
    code: number;
    data?: { details: AngryBirdDetail[]; total: number };
  }>('/angrybird/details', {
    params: {
      weekStarts: weekStarts.join(','),
      weekEnds: weekEnds.join(','),
      department,
      sales: sales?.join(','),
      page,
      pageSize,
    },
  });
  return response.data;
};
