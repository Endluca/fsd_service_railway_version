import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { get, set as idbSet, del } from 'idb-keyval';
import type { CsvParseResult } from '../types/topicmining';

interface TopicMiningState {
  // 状态
  parseResult: CsvParseResult | null;
  fileName: string;
  activeTab: string;

  // Actions
  setParseResult: (result: CsvParseResult | null) => void;
  setFileName: (name: string) => void;
  setActiveTab: (tab: string) => void;
  reset: () => void;
}

// 初始状态
const initialState = {
  parseResult: null as CsvParseResult | null,
  fileName: '',
  activeTab: 'upload',
};

// 创建 IndexedDB storage（支持大数据）
const createIndexedDBStorage = () => {
  return {
    getItem: async (name: string): Promise<any> => {
      try {
        const value = await get(name);
        if (!value) return null;

        // 如果存储的是字符串，解析为对象
        if (typeof value === 'string') {
          return JSON.parse(value);
        }
        return value;
      } catch (error) {
        console.error('Failed to get from IndexedDB:', error);
        return null;
      }
    },
    setItem: async (name: string, value: any): Promise<void> => {
      try {
        // 将对象序列化为字符串后存储
        const stringValue = typeof value === 'string' ? value : JSON.stringify(value);
        await idbSet(name, stringValue);
      } catch (error) {
        console.error('Failed to save to IndexedDB:', error);
        // IndexedDB 失败时不抛出错误，避免中断应用
      }
    },
    removeItem: async (name: string): Promise<void> => {
      try {
        await del(name);
      } catch (error) {
        console.error('Failed to remove from IndexedDB:', error);
      }
    },
  };
};

export const useTopicMiningStore = create<TopicMiningState>()(
  persist(
    (set) => ({
      ...initialState,

      setParseResult: (result) => set({ parseResult: result }),
      setFileName: (name) => set({ fileName: name }),
      setActiveTab: (tab) => set({ activeTab: tab }),
      reset: () => set(initialState),
    }),
    {
      name: 'topicmining-storage',
      storage: createIndexedDBStorage(),
    }
  )
);
