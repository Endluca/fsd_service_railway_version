import axios from 'axios';
import type {
  CsvParseResult,
  ReportPayload,
  ReportEntity,
  ReportListItem,
  MonthInfo,
  ComparisonResult,
} from '../types/topicmining';

const client = axios.create({
  baseURL: '/api/topicmining',
  timeout: 60000, // CSV 解析可能需要较长时间
});

// 响应拦截器：提取 data 字段
client.interceptors.response.use(
  (response) => response.data.data,
  (error) => {
    const message = error.response?.data?.message || error.message || '请求失败';
    return Promise.reject(new Error(message));
  }
);

/**
 * 解析 CSV 文件
 */
export async function parseCsvFile(file: File): Promise<CsvParseResult> {
  const formData = new FormData();
  formData.append('file', file);

  return client.post('/reports/parse', formData, {
    headers: {
      'Content-Type': 'multipart/form-data',
    },
  });
}

/**
 * 创建报告
 */
export async function createReport(payload: ReportPayload): Promise<{ id: string; generatedAt: string }> {
  return client.post('/reports', payload);
}

/**
 * 获取报告列表
 */
export async function getReports(): Promise<ReportListItem[]> {
  return client.get('/reports');
}

/**
 * 获取报告详情
 */
export async function getReportById(id: string): Promise<ReportEntity> {
  return client.get(`/reports/${id}`);
}

/**
 * 删除报告
 */
export async function deleteReport(id: string): Promise<void> {
  return client.delete(`/reports/${id}`);
}

// ========== 月度对比相关API ==========

/**
 * 获取可用月份列表
 */
export async function getAvailableMonths(): Promise<{ months: MonthInfo[] }> {
  return client.get('/comparison/months');
}

/**
 * 获取月度对比数据
 */
export async function getMonthlyComparison(
  months: string[],
  parentTopN: number,
  childTopN: number
): Promise<ComparisonResult> {
  // 使用 URLSearchParams 手动构建查询字符串
  const params = new URLSearchParams();
  months.forEach((month) => params.append('months[]', month));
  params.append('parentTopN', parentTopN.toString());
  params.append('childTopN', childTopN.toString());

  return client.get(`/comparison?${params.toString()}`);
}
