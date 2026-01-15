import { create } from 'zustand';
import dayjs, { type Dayjs } from 'dayjs';
import type { SalesData } from '../types';

interface DashboardState {
  // 状态
  dateRange: [Dayjs, Dayjs];
  selectedTeams: string[];
  selectedRegions: string[];
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
  setSelectedTeams: (teams: string[]) => void;
  setSelectedRegions: (regions: string[]) => void;
  setSelectedGroups: (groups: string[]) => void;
  setSelectedSales: (sales: string[]) => void;
  setData: (data: SalesData[]) => void;
  setPagination: (pagination: { current: number; pageSize: number; total: number }) => void;
  reset: () => void;
}

// 初始状态
const initialState = {
  dateRange: [dayjs().subtract(10, 'days'), dayjs()] as [Dayjs, Dayjs],
  selectedTeams: [] as string[],
  selectedRegions: [] as string[],
  selectedGroups: [] as string[],
  selectedSales: [] as string[],
  data: [] as SalesData[],
  pagination: { current: 1, pageSize: 10, total: 0 },
};

export const useDashboardStore = create<DashboardState>()((set) => ({
  ...initialState,

  setDateRange: (range) => set({ dateRange: range }),
  setSelectedTeams: (teams) => set({ selectedTeams: teams }),
  setSelectedRegions: (regions) => set({ selectedRegions: regions }),
  setSelectedGroups: (groups) => set({ selectedGroups: groups }),
  setSelectedSales: (sales) => set({ selectedSales: sales }),
  setData: (data) => set({ data }),
  setPagination: (pagination) => set({ pagination }),
  reset: () => set(initialState),
}));
