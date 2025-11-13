import axios from 'axios';
import prisma from '../config/prisma';
import { config } from '../config';

/**
 * 深维API鉴权服务
 * 负责获取和自动刷新access_token
 */
export class AuthService {
  private static instance: AuthService;
  private refreshTimer: NodeJS.Timeout | null = null;

  // 内存缓存：减少99%的数据库查询
  private cachedToken: string | null = null;
  private cachedTokenExpiry: Date | null = null;

  private constructor() {}

  static getInstance(): AuthService {
    if (!AuthService.instance) {
      AuthService.instance = new AuthService();
    }
    return AuthService.instance;
  }

  /**
   * 获取有效的access_token
   * 优先从内存缓存获取，然后从数据库获取，如果不存在或已过期则重新获取
   */
  async getAccessToken(): Promise<string> {
    // 1. 检查内存缓存（99%的情况都会命中）
    if (this.cachedToken && this.cachedTokenExpiry) {
      if (this.cachedTokenExpiry > new Date()) {
        return this.cachedToken;
      }
    }

    // 2. 从数据库获取最新的token
    const tokenRecord = await prisma.apiToken.findFirst({
      where: {
        tokenType: 'app_access_token',
        expiresAt: {
          gt: new Date(), // 未过期
        },
      },
      orderBy: {
        createdAt: 'desc',
      },
    });

    if (tokenRecord) {
      console.log('从数据库加载access_token到内存');
      // 更新内存缓存
      this.cachedToken = tokenRecord.accessToken;
      this.cachedTokenExpiry = tokenRecord.expiresAt;
      return tokenRecord.accessToken;
    }

    // 3. 没有有效token，重新获取
    console.log('获取新的access_token');
    return await this.refreshAccessToken();
  }

  /**
   * 刷新access_token
   * 调用深维API获取新的token并存储到数据库
   */
  async refreshAccessToken(): Promise<string> {
    try {
      const response = await axios.post(
        `${config.swApi.baseUrl}/openapi/auth/v1/app_access_token/internal`,
        {
          app_key: config.swApi.appKey,
          app_secret: config.swApi.appSecret,
        },
        {
          headers: {
            'Content-Type': 'application/json',
          },
        }
      );

      if (response.data.code !== 0) {
        throw new Error(`获取token失败: ${response.data.msg}`);
      }

      const { app_access_token, expire } = response.data.data;
      const expiresAt = new Date(Date.now() + expire * 1000);

      // 存储到数据库
      await prisma.apiToken.create({
        data: {
          tokenType: 'app_access_token',
          accessToken: app_access_token,
          expiresAt,
        },
      });

      // 更新内存缓存
      this.cachedToken = app_access_token;
      this.cachedTokenExpiry = expiresAt;

      console.log(`access_token已更新，过期时间: ${expiresAt.toISOString()}`);

      // 设置自动刷新（提前5分钟刷新）
      this.scheduleTokenRefresh(expire - 300); // 300秒 = 5分钟

      return app_access_token;
    } catch (error) {
      console.error('刷新access_token失败:', error);
      throw error;
    }
  }

  /**
   * 设置定时刷新任务
   * @param delaySeconds 延迟多少秒后刷新
   */
  private scheduleTokenRefresh(delaySeconds: number) {
    // 清除旧的定时器
    if (this.refreshTimer) {
      clearTimeout(this.refreshTimer);
    }

    // 设置新的定时器
    this.refreshTimer = setTimeout(async () => {
      try {
        await this.refreshAccessToken();
      } catch (error) {
        console.error('自动刷新token失败:', error);
        // 5分钟后重试
        this.scheduleTokenRefresh(300);
      }
    }, delaySeconds * 1000);

    console.log(`已设置token自动刷新，将在 ${delaySeconds} 秒后执行`);
  }

  /**
   * 初始化认证服务
   * 确保有可用的token
   */
  async initialize() {
    try {
      await this.getAccessToken();
      console.log('认证服务初始化完成');
    } catch (error) {
      console.error('认证服务初始化失败:', error);
      throw error;
    }
  }

  /**
   * 清理资源
   */
  destroy() {
    if (this.refreshTimer) {
      clearTimeout(this.refreshTimer);
      this.refreshTimer = null;
    }
  }
}

export default AuthService.getInstance();
