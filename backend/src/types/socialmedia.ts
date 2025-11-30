/**
 * 社媒监控模块类型定义
 */

// 平台类型
export type Platform = 'tiktok' | 'twitter' | 'instagram';

// 搜索请求
export interface SearchRequest {
  keywords: string[];      // 关键词数组
  platforms: Platform[];   // 平台数组
  maxCount: number;        // 每个平台每个关键词的抓取数量
}

// TikTok 数据项
export interface TikTokItem {
  keyword: string;
  author: string | null;
  description: string | null;
  diggs: number | null;
  coverUrl: string | null;
  videoUrl: string | null;
}

// Twitter 数据项
export interface TwitterItem {
  keyword: string;
  user: string | null;
  text: string | null;
  createdAt: string | null;
  url: string | null;
}

// Instagram 数据项
export interface InstagramItem {
  keyword: string;
  caption: string | null;
  imageUrl: string | null;
  postUrl: string | null;
}

// 平台错误
export interface PlatformError {
  platform: Platform;
  keyword: string;
  error: string;
}

// 搜索结果
export interface SearchResult {
  tiktok: TikTokItem[];
  twitter: TwitterItem[];
  instagram: InstagramItem[];
  metadata: {
    totalResults: number;
    duration: number;      // 毫秒
    errors: PlatformError[];
  };
}

// Apify Actor 响应类型（原始数据）
export interface ApifyTikTokRawItem {
  authorMeta?: {
    nickName?: string;
  };
  text?: string;
  diggCount?: number;
  videoMeta?: {
    coverUrl?: string;
  };
  webVideoUrl?: string;
}

export interface ApifyTwitterRawItem {
  user?: {
    name?: string;
  };
  full_text?: string;
  text?: string;
  created_at?: string;
  url?: string;
}

export interface ApifyInstagramRawItem {
  caption?: string;
  text?: string;
  displayUrl?: string;
  imageUrl?: string;
  url?: string;
  postUrl?: string;
}
