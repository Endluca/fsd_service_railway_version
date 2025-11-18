import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import dayjs, { type Dayjs } from 'dayjs';
import type { SalesData } from '../types';

interface DashboardState {
  // 状态
  dateRange: [Dayjs, Dayjs];
  selectedGroups: string[];
  selectedSales: string[];
  data: SalesData[];
  pagination: {
    current: number;
    pageSize: number;
    total: number;
  };

  // Actions
  setDateRange: (range: [Dayjs, Dayjs]) => void;
  setSelectedGroups: (groups: string[]) => void;
  setSelectedSales: (sales: string[]) => void;
  setData: (data: SalesData[]) => void;
  setPagination: (pagination: { current: number; pageSize: number; total: number }) => void;
  reset: () => void;
}

// 初始状态
const initialState = {
  dateRange: [dayjs().subtract(10, 'days'), dayjs()] as [Dayjs, Dayjs],
  selectedGroups: [] as string[],
  selectedSales: [] as string[],
  data: [] as SalesData[],
  pagination: { current: 1, pageSize: 10, total: 0 },
};

export const useDashboardStore = create<DashboardState>()(
  persist(
    (set) => ({
      ...initialState,

      setDateRange: (range) => set({ dateRange: range }),
      setSelectedGroups: (groups) => set({ selectedGroups: groups }),
      setSelectedSales: (sales) => set({ selectedSales: sales }),
      setData: (data) => set({ data }),
      setPagination: (pagination) => set({ pagination }),
      reset: () => set(initialState),
    }),
    {
      name: 'dashboard-storage',
      storage: {
        getItem: (name) => {
          const str = localStorage.getItem(name);
          if (!str) return null;

          try {
            const parsed = JSON.parse(str);
            // 反序列化Dayjs对象，返回state对象
            return {
              ...parsed,
              state: {
                ...parsed.state,
                dateRange: [
                  dayjs(parsed.state.dateRange[0]),
                  dayjs(parsed.state.dateRange[1]),
                ],
              },
            };
          } catch (error) {
            console.error('Failed to parse dashboard storage:', error);
            return null;
          }
        },
        setItem: (name, value) => {
          try {
            // 序列化Dayjs对象为ISO字符串
            const toSave = {
              ...value,
              state: {
                ...value.state,
                dateRange: [
                  value.state.dateRange[0].toISOString(),
                  value.state.dateRange[1].toISOString(),
                ],
              },
            };
            localStorage.setItem(name, JSON.stringify(toSave));
          } catch (error) {
            console.error('Failed to save dashboard storage:', error);
          }
        },
        removeItem: (name) => localStorage.removeItem(name),
      },
    }
  )
);
