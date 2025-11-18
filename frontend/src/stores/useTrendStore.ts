import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { get, set as idbSet, del } from 'idb-keyval';
import dayjs, { type Dayjs } from 'dayjs';
import type { Granularity, ComparisonType, MetricType, TrendResponse } from '../types';

interface TrendState {
  // 状态
  comparisonType: ComparisonType;
  granularity: Granularity;
  metric: MetricType;
  dateRange: [Dayjs, Dayjs] | null;
  selectedGroup: string | undefined;
  trendData: TrendResponse | null;

  // Actions
  setComparisonType: (type: ComparisonType) => void;
  setGranularity: (granularity: Granularity) => void;
  setMetric: (metric: MetricType) => void;
  setDateRange: (range: [Dayjs, Dayjs] | null) => void;
  setSelectedGroup: (group: string | undefined) => void;
  setTrendData: (data: TrendResponse | null) => void;
  reset: () => void;
}

// 初始状态
const initialState = {
  comparisonType: 'all' as ComparisonType,
  granularity: 'day' as Granularity,
  metric: 'timelyReplyRate' as MetricType,
  dateRange: null as [Dayjs, Dayjs] | null,
  selectedGroup: undefined as string | undefined,
  trendData: null as TrendResponse | null,
};

// 创建 IndexedDB storage（支持大数据）
const createIndexedDBStorage = () => {
  return {
    getItem: async (name: string): Promise<any> => {
      try {
        const value = await get(name);
        if (!value) return null;

        // 如果存储的是字符串，解析为对象
        const parsed = typeof value === 'string' ? JSON.parse(value) : value;

        // 反序列化 Dayjs 对象
        if (parsed.state?.dateRange) {
          parsed.state.dateRange = [
            dayjs(parsed.state.dateRange[0]),
            dayjs(parsed.state.dateRange[1]),
          ];
        }

        return parsed;
      } catch (error) {
        console.error('Failed to get from IndexedDB:', error);
        return null;
      }
    },
    setItem: async (name: string, value: any): Promise<void> => {
      try {
        // 序列化 Dayjs 对象为 ISO 字符串
        let serializedDateRange = null;
        if (value.state?.dateRange && Array.isArray(value.state.dateRange)) {
          const [start, end] = value.state.dateRange;
          if (start && end) {
            serializedDateRange = [
              dayjs.isDayjs(start) ? start.toISOString() : dayjs(start).toISOString(),
              dayjs.isDayjs(end) ? end.toISOString() : dayjs(end).toISOString(),
            ];
          }
        }

        const toSave = {
          ...value,
          state: {
            ...value.state,
            dateRange: serializedDateRange,
          },
        };

        // 将对象序列化为字符串后存储
        const stringValue = JSON.stringify(toSave);
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

export const useTrendStore = create<TrendState>()(
  persist(
    (set) => ({
      ...initialState,

      setComparisonType: (type) => set({ comparisonType: type }),
      setGranularity: (granularity) => set({ granularity }),
      setMetric: (metric) => set({ metric }),
      setDateRange: (range) => set({ dateRange: range }),
      setSelectedGroup: (group) => set({ selectedGroup: group }),
      setTrendData: (data) => set({ trendData: data }),
      reset: () => set(initialState),
    }),
    {
      name: 'trend-storage',
      storage: createIndexedDBStorage(),
    }
  )
);
