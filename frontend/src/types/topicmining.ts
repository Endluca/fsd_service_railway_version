export interface CsvParseWarning {
  type: 'missing_required_columns' | 'invalid_row' | 'empty_field' | 'duplicate_removed';
  message: string;
}

export interface ChildStat {
  name: string;
  count: number;
  percentage: number;
  parentPercentage: number;
}

export interface ParentStat {
  name: string;
  count: number;
  percentage: number;
  rank: number;
  children?: ChildStat[];
}

export interface DialogueMessage {
  role: 'customer' | 'sales';
  text: string;
}

export interface SampleSnippet {
  topicName: string;
  context: string;
  sourceSessionId?: string;
  childCategory?: string;
  dialogues?: DialogueMessage[];
  turnCount?: number;
  charCount?: number;
}

export interface CsvAnalysisResult {
  totalCount: number;
  parents: ParentStat[];
  childStats: Record<string, ChildStat[]>;
  topParents: string[];
  samples: Record<string, SampleSnippet[]>;
  childSamples: Record<string, Record<string, SampleSnippet[]>>;
  skippedEmptyParent: number;
}

export interface CsvParseResult {
  statistics: CsvAnalysisResult;
  warnings: CsvParseWarning[];
  metadata: {
    originalRowCount: number;
    validRowCount: number;
    removedDuplicates: number;
    removedEmptyRows: number;
    executionTimeMs: number;
  };
}

export interface SampleSelectionResult {
  parentSamples: Record<string, SampleSnippet[]>;
  childSamples: Record<string, Record<string, SampleSnippet[]>>;
}

export interface ReportMetadata {
  sourceFileName?: string;
  sourceUploadedAt?: string;
  totalSessions?: number;
  timeRange?: {
    start: string;
    end: string;
  };
}

export interface ReportPayload {
  title: string;
  summary?: string;
  statistics: CsvAnalysisResult;
  selectedSamples?: SampleSelectionResult;
  metadata?: ReportMetadata;
  generatedAt?: string;
}

export interface ReportEntity {
  id: string;
  title: string;
  summary?: string;
  statistics: CsvAnalysisResult;
  samples: SampleSelectionResult;
  metadata?: ReportMetadata;
  generatedAt: string;
  createdAt: string;
  updatedAt: string;
}

export interface ReportListItem {
  id: string;
  title: string;
  generatedAt: string;
  createdAt: string;
  summary?: string;
}

// ========== 月度对比相关类型 ==========

/**
 * 月份信息
 */
export interface MonthInfo {
  month: string;          // YYYY-MM格式
  reportCount: number;    // 该月份的报告数量
  reportIds: string[];    // 该月份的报告ID列表
}

/**
 * 类别数据(父类或子类)
 */
export interface CategoryData {
  count: number;          // 该类别的数量
  percentage: number;     // 该类别在当月的占比
  parent?: string;        // 所属父类(仅子类需要)
}

/**
 * 对比图表数据
 */
export interface ComparisonChartData {
  categories: string[];   // 所有类别名称(合并去重后)
  months: string[];       // 所有月份
  series: {               // 按月份-类别组织的数据
    [month: string]: {
      [category: string]: CategoryData;
    };
  };
}

/**
 * 对比结果(包含父类和子类对比)
 */
export interface ComparisonResult {
  parentComparison: ComparisonChartData;
  childComparison: ComparisonChartData;
}
