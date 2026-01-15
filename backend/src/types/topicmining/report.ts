export interface CsvRawRow {
  sourceSessionId: string;
  sourceSessionName: string;
  topicName: string;
  parentCategory: string;
  childCategory: string;
  response: string;
  context: string;
}

export interface CsvParseWarning {
  type: 'missing_required_columns' | 'invalid_row' | 'empty_field' | 'duplicate_removed' | 'info';
  message: string;
}

export interface ParentStat {
  name: string;
  count: number;
  percentage: number;
  rank: number;
  children: ChildStat[];
}

export interface ChildStat {
  name: string;
  count: number;
  percentage: number;
  parentPercentage: number;
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

export interface SampleSelectionRequest {
  parentSamples?: Record<string, number[]>;
  childSamples?: Record<string, Record<string, number[]>>;
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
