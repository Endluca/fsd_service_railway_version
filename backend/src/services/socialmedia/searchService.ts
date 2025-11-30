/**
 * 社媒搜索服务
 * 编排多平台、多关键词的搜索逻辑
 */

import apifyClient from './apifyClient';
import type {
  SearchRequest,
  SearchResult,
  Platform,
  PlatformError,
  TikTokItem,
  TwitterItem,
  InstagramItem,
} from '../../types/socialmedia';

class SearchService {
  /**
   * 执行多平台搜索
   */
  async search(request: SearchRequest): Promise<SearchResult> {
    const startTime = Date.now();
    const { keywords, platforms, maxCount } = request;

    // 初始化结果容器
    const tiktokResults: TikTokItem[] = [];
    const twitterResults: TwitterItem[] = [];
    const instagramResults: InstagramItem[] = [];
    const errors: PlatformError[] = [];

    // 并行搜索所有平台
    await Promise.all(
      platforms.map(async (platform) => {
        try {
          const { data, errors: platformErrors } = await this.searchPlatform(
            platform,
            keywords,
            maxCount
          );

          // 收集结果
          if (platform === 'tiktok') {
            tiktokResults.push(...(data as TikTokItem[]));
          } else if (platform === 'twitter') {
            twitterResults.push(...(data as TwitterItem[]));
          } else if (platform === 'instagram') {
            instagramResults.push(...(data as InstagramItem[]));
          }

          // 收集错误
          errors.push(...platformErrors);
        } catch (error) {
          console.error(`平台 ${platform} 搜索失败:`, error);
          // 平台级别的错误（所有关键词都失败）
          keywords.forEach((keyword) => {
            errors.push({
              platform,
              keyword,
              error: error instanceof Error ? error.message : '未知错误',
            });
          });
        }
      })
    );

    const duration = Date.now() - startTime;
    const totalResults = tiktokResults.length + twitterResults.length + instagramResults.length;

    return {
      tiktok: tiktokResults,
      twitter: twitterResults,
      instagram: instagramResults,
      metadata: {
        totalResults,
        duration,
        errors,
      },
    };
  }

  /**
   * 搜索单个平台的多个关键词
   */
  private async searchPlatform(
    platform: Platform,
    keywords: string[],
    maxCount: number
  ): Promise<{ data: (TikTokItem | TwitterItem | InstagramItem)[]; errors: PlatformError[] }> {
    const data: (TikTokItem | TwitterItem | InstagramItem)[] = [];
    const errors: PlatformError[] = [];

    // 串行搜索每个关键词（避免 API 限流）
    for (const keyword of keywords) {
      try {
        let results: TikTokItem[] | TwitterItem[] | InstagramItem[] = [];

        if (platform === 'tiktok') {
          results = await apifyClient.searchTikTok(keyword, maxCount);
        } else if (platform === 'twitter') {
          results = await apifyClient.searchTwitter(keyword, maxCount);
        } else if (platform === 'instagram') {
          results = await apifyClient.searchInstagram(keyword, maxCount);
        }

        data.push(...results);
      } catch (error) {
        console.error(`平台 ${platform} 关键词 ${keyword} 搜索失败:`, error);
        errors.push({
          platform,
          keyword,
          error: error instanceof Error ? error.message : '未知错误',
        });
      }
    }

    return { data, errors };
  }
}

// 导出单例
export default new SearchService();
