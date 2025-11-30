/**
 * 社媒监控模块前端类型定义
 */

// 平台类型
export type Platform = 'tiktok' | 'twitter' | 'instagram';

// 平台标签映射
export const PLATFORM_LABELS: Record<Platform, string> = {
  tiktok: 'TikTok',
  twitter: 'Twitter',
  instagram: 'Instagram',
};

// 搜索表单数据
export interface SearchFormData {
  keywordsInput: string;      // 关键词输入（逗号分隔）
  platforms: Platform[];      // 选中的平台
  maxCount: number;           // 抓取数量
  showImages: boolean;        // 是否显示图片
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
    duration: number;
    errors: PlatformError[];
  };
}

// API 响应
export interface ApiResponse<T> {
  code: number;
  message?: string;
  data?: T;
}

// 搜索历史项
export interface SearchHistoryItem {
  id: string;
  timestamp: number;
  keywords: string[];
  platforms: Platform[];
  maxCount: number;
  results: SearchResult;
  metadata: {
    totalResults: number;
    duration: number;
    status: 'success' | 'partial' | 'failed';
    errors?: PlatformError[];
  };
}
