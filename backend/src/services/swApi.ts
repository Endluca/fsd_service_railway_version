import axios, { AxiosInstance } from 'axios';
import axiosRetry from 'axios-retry';
import authService from './auth';
import { config } from '../config';

/**
 * 深维API客户端
 * 封装所有深维API调用
 */
class SwApiClient {
  private client: AxiosInstance;
  private downloadClient: AxiosInstance; // 专门用于下载ASR文件的客户端

  constructor() {
    this.client = axios.create({
      baseURL: config.swApi.baseUrl,
      headers: {
        'Content-Type': 'application/json',
      },
      timeout: 90000, // 90秒超时（优化：从30秒增加到90秒）
    });

    // 配置重试策略（优化：增强重试机制）
    axiosRetry(this.client, {
      retries: 10, // 重试10次（网络问题重试，业务错误不重试）
      retryDelay: axiosRetry.exponentialDelay,
      retryCondition: (error) => {
        // 只重试网络错误、超时、限流，不重试业务错误（如404）
        return axiosRetry.isNetworkOrIdempotentRequestError(error) ||
          error.response?.status === 429 || // 限流
          error.code === 'ECONNABORTED' || // 超时
          error.code === 'ETIMEDOUT'; // 超时
      },
    });

    // 创建专门用于下载ASR文件的客户端（带重试）
    this.downloadClient = axios.create({
      timeout: 120000, // 120秒超时（ASR文件可能很大）
      validateStatus: (status) => status < 500, // 5xx才算失败
    });

    // 为下载客户端配置重试
    axiosRetry(this.downloadClient, {
      retries: 10, // ASR文件下载重试10次
      retryDelay: axiosRetry.exponentialDelay,
      retryCondition: (error) => {
        return axiosRetry.isNetworkOrIdempotentRequestError(error) ||
          error.code === 'ECONNABORTED' ||
          error.code === 'ETIMEDOUT';
      },
    });

    // 请求拦截器：自动添加access_token
    this.client.interceptors.request.use(async (config) => {
      const token = await authService.getAccessToken();
      config.headers.Authorization = `Bearer ${token}`;
      return config;
    });

    // 响应拦截器：处理业务错误
    this.client.interceptors.response.use(
      (response) => {
        if (response.data.code !== 0) {
          console.error('API业务错误:', response.data);
          throw new Error(`API错误: ${response.data.msg}`);
        }
        return response;
      },
      (error) => {
        console.error('API请求失败:', error.message);
        throw error;
      }
    );
  }

  /**
   * 批量查询会话
   * @param params 查询参数
   */
  async listConversations(params: {
    begin_time: string;
    end_time: string;
    page_token?: string;
    page_size?: number;
    open_user_id?: string;
  }) {
    const response = await this.client.post('/openapi/conversation/v1/conversations/list', params);
    return response.data.data;
  }

  /**
   * 获取所有会话（自动处理分页）
   * @param begin_time 开始时间
   * @param end_time 结束时间
   */
  async getAllConversations(begin_time: string, end_time: string) {
    const allConversations: any[] = [];
    let pageToken: string | undefined = undefined;
    let page = 1;

    do {
      console.log(`正在获取会话列表，第 ${page} 页...`);
      const data = await this.listConversations({
        begin_time,
        end_time,
        page_token: pageToken,
        page_size: 100, // 每页100条
      });

      // 只保留type为doc的会话
      const docConversations = data.conversations.filter((conv: any) => conv.type === 'doc');
      allConversations.push(...docConversations);

      console.log(`第 ${page} 页获取到 ${docConversations.length} 条doc类型会话`);

      pageToken = data.has_more ? data.page_token : undefined;
      page++;
    } while (pageToken);

    console.log(`共获取到 ${allConversations.length} 条doc类型会话`);
    return allConversations;
  }

  /**
   * 获取会话ASR数据
   * @param originConversationId 原始会话ID
   */
  async getConversationAsr(originConversationId: string) {
    try {
      // 1. 获取ASR文件URL（带重试）
      const response = await this.client.get(
        `/openapi/conversation/v1/origin_conversations/${originConversationId}/asr_data`
      );

      const { asr_file_url, conversation_type } = response.data.data;

      // 2. 下载ASR文件内容（优化：使用带重试的downloadClient）
      const asrResponse = await this.downloadClient.get(asr_file_url);

      return {
        conversationType: conversation_type,
        asrData: asrResponse.data, // ASR数据数组
        success: true,
      };
    } catch (error: any) {
      // 返回详细的错误信息
      const errorInfo: any = {
        success: false,
        conversationType: null,
        asrData: null,
      };

      // 转录未完成
      if (error.response?.data?.code === 501200) {
        console.warn(`会话 ${originConversationId} 转录未完成`);
        errorInfo.errorCode = 501200;
        errorInfo.errorReason = '转录未完成';
        errorInfo.errorMessage = error.response?.data?.msg || '会话转录正在进行中，尚未完成';
        return errorInfo;
      }

      // 获取ASR文件URL失败
      if (error.config?.url?.includes('/asr_data')) {
        errorInfo.errorReason = '获取ASR文件URL失败';
        errorInfo.errorCode = error.response?.data?.code || error.code || 'UNKNOWN';
        errorInfo.errorMessage = error.response?.data?.msg || error.message || '未知错误';
        errorInfo.httpStatus = error.response?.status;
        console.warn(`会话 ${originConversationId} 获取ASR文件URL失败: ${errorInfo.errorMessage}`);
        return errorInfo;
      }

      // 下载ASR文件内容失败
      errorInfo.errorReason = '下载ASR文件失败';
      errorInfo.errorCode = error.code || 'UNKNOWN';
      errorInfo.errorMessage = error.message || '未知错误';
      errorInfo.httpStatus = error.response?.status;
      
      // 检查是否是超时
      if (error.code === 'ECONNABORTED' || error.code === 'ETIMEDOUT') {
        errorInfo.errorReason = '下载ASR文件超时';
      }
      
      // 检查是否是网络错误
      if (error.code === 'ENOTFOUND' || error.code === 'ECONNREFUSED') {
        errorInfo.errorReason = '网络连接失败';
      }

      console.warn(`会话 ${originConversationId} ${errorInfo.errorReason}: ${errorInfo.errorMessage}`);
      return errorInfo;
    }
  }

  /**
   * 获取销售信息
   * @param openUserId 销售ID
   */
  async getUserInfo(openUserId: string) {
    try {
      const response = await this.client.get(`/openapi/organization/v1/users/${openUserId}`);
      return response.data.data.user;
    } catch (error: any) {
      if (error.response?.data?.code === 401154) {
        console.warn(`用户 ${openUserId} 不存在`);
        return null;
      }
      throw error;
    }
  }

  /**
   * 获取部门信息
   * @param departmentId 部门ID
   */
  async getDepartmentInfo(departmentId: number) {
    try {
      const response = await this.client.get(
        `/openapi/organization/v1/departments/${departmentId}`
      );
      return response.data.data.department;
    } catch (error: any) {
      // 部门不存在
      if (error.response?.data?.code === 401103) {
        console.warn(`部门 ${departmentId} 不存在`);
        return null;
      }
      throw error;
    }
  }
}

export default new SwApiClient();
