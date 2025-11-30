/**
 * Apify API 客户端服务
 * 封装 TikTok、Twitter、Instagram 平台的数据抓取
 */

import { ApifyClient } from 'apify-client';
import type {
  TikTokItem,
  TwitterItem,
  InstagramItem,
  ApifyTikTokRawItem,
  ApifyTwitterRawItem,
  ApifyInstagramRawItem,
} from '../../types/socialmedia';

class ApifyClientService {
  private client: ApifyClient;

  // Actor IDs (from app.py)
  private readonly TIKTOK_ACTOR_ID = 'GdWCkxBtKWOsKjdch';
  private readonly TWITTER_ACTOR_ID = '61RPP7dywgiy0JPD0';
  private readonly INSTAGRAM_ACTOR_ID = 'reGe1ST3OBgYZSsZJ';

  constructor() {
    const token = process.env.APIFY_API_TOKEN;
    if (!token) {
      throw new Error('APIFY_API_TOKEN 未配置');
    }
    this.client = new ApifyClient({ token });
  }

  /**
   * 搜索 TikTok 视频
   */
  async searchTikTok(keyword: string, maxCount: number): Promise<TikTokItem[]> {
    try {
      const runInput = {
        searchQueries: [keyword],
        resultsPerPage: Math.max(maxCount, 10), // TikTok actor 最小值约为 10
        searchSection: '/video',
        profileScrapeSections: ['videos'],
        shouldDownloadVideos: false,
        shouldDownloadCovers: false,
      };

      const run = await this.client.actor(this.TIKTOK_ACTOR_ID).call(runInput);
      const dataset = await this.client.dataset(run.defaultDatasetId).listItems();
      const items = dataset.items as ApifyTikTokRawItem[];

      // 截断到用户指定的数量
      const results = items.map((item) => ({
        keyword,
        author: item.authorMeta?.nickName || null,
        description: item.text || null,
        diggs: item.diggCount || null,
        coverUrl: item.videoMeta?.coverUrl || null,
        videoUrl: item.webVideoUrl || null,
      }));

      return results.slice(0, maxCount);
    } catch (error) {
      console.error(`TikTok 搜索失败 (${keyword}):`, error);
      throw error;
    }
  }

  /**
   * 搜索 Twitter 推文
   */
  async searchTwitter(keyword: string, maxCount: number): Promise<TwitterItem[]> {
    try {
      const runInput = {
        searchTerms: [keyword],
        maxItems: maxCount,
        sort: 'Latest',
        tweetLanguage: 'en',
        minimumRetweets: 0,
        minimumFavorites: 0,
      };

      const run = await this.client.actor(this.TWITTER_ACTOR_ID).call(runInput);

      // 优雅降级：检查是否是免费版限制
      if (run.status === 'SUCCEEDED' && run.statusMessage?.includes('You cannot use the API with the Free Plan')) {
        console.warn('Twitter: 免费版限制，返回空结果');
        return [];
      }

      const dataset = await this.client.dataset(run.defaultDatasetId).listItems();
      const items = dataset.items as ApifyTwitterRawItem[];

      const results: TwitterItem[] = [];
      for (const item of items) {
        const text = item.full_text || item.text;
        if (text) {
          results.push({
            keyword,
            user: item.user?.name || null,
            text,
            createdAt: item.created_at || null,
            url: item.url || null,
          });
        }
      }

      return results;
    } catch (error) {
      console.error(`Twitter 搜索失败 (${keyword}):`, error);
      throw error;
    }
  }

  /**
   * 搜索 Instagram 帖子
   */
  async searchInstagram(keyword: string, maxCount: number): Promise<InstagramItem[]> {
    try {
      const runInput = {
        hashtags: [keyword],
        resultsLimit: maxCount,
        resultsType: 'posts',
        keywordSearch: false,
      };

      const run = await this.client.actor(this.INSTAGRAM_ACTOR_ID).call(runInput);
      const dataset = await this.client.dataset(run.defaultDatasetId).listItems();
      const items = dataset.items as ApifyInstagramRawItem[];

      // 截断到用户指定的数量（免费版可能返回固定数量）
      const results = items.map((item) => ({
        keyword,
        caption: item.caption || item.text || null,
        imageUrl: item.displayUrl || item.imageUrl || null,
        postUrl: item.url || item.postUrl || null,
      }));

      return results.slice(0, maxCount);
    } catch (error) {
      console.error(`Instagram 搜索失败 (${keyword}):`, error);
      throw error;
    }
  }

  /**
   * 健康检查：验证 API Token 是否有效
   */
  async healthCheck(): Promise<boolean> {
    try {
      // 尝试获取用户信息
      await this.client.user('me').get();
      return true;
    } catch (error) {
      console.error('Apify API 健康检查失败:', error);
      return false;
    }
  }
}

// 导出单例
export default new ApifyClientService();
