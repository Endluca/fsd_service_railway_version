/**
 * 社媒监控 IndexedDB 存储服务
 */

import { get, set, del, keys } from 'idb-keyval';
import type { SearchHistoryItem } from '../types/socialmedia';

const STORAGE_PREFIX = 'socialmedia-history-';

/**
 * 保存搜索历史
 */
export const saveSearchHistory = async (item: SearchHistoryItem): Promise<void> => {
  try {
    await set(`${STORAGE_PREFIX}${item.id}`, item);
  } catch (error) {
    console.error('保存搜索历史失败:', error);
    throw error;
  }
};

/**
 * 获取所有搜索历史（按时间倒序）
 */
export const getSearchHistory = async (): Promise<SearchHistoryItem[]> => {
  try {
    const allKeys = await keys();
    const historyKeys = allKeys.filter(
      (k) => typeof k === 'string' && k.startsWith(STORAGE_PREFIX)
    );

    const items = await Promise.all(
      historyKeys.map((key) => get<SearchHistoryItem>(key))
    );

    return items
      .filter((item): item is SearchHistoryItem => item !== undefined)
      .sort((a, b) => b.timestamp - a.timestamp);
  } catch (error) {
    console.error('获取搜索历史失败:', error);
    return [];
  }
};

/**
 * 删除单条搜索历史
 */
export const deleteSearchHistory = async (id: string): Promise<void> => {
  try {
    await del(`${STORAGE_PREFIX}${id}`);
  } catch (error) {
    console.error('删除搜索历史失败:', error);
    throw error;
  }
};

/**
 * 清空所有搜索历史
 */
export const clearAllHistory = async (): Promise<void> => {
  try {
    const allKeys = await keys();
    const historyKeys = allKeys.filter(
      (k) => typeof k === 'string' && k.startsWith(STORAGE_PREFIX)
    );

    await Promise.all(historyKeys.map((key) => del(key)));
  } catch (error) {
    console.error('清空搜索历史失败:', error);
    throw error;
  }
};
