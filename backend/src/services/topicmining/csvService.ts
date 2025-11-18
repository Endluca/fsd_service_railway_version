import { performance } from 'perf_hooks';
import {
  hashRecord,
  normalizeColumns,
  parseCsvLine,
  splitCsvLines,
  validateHeaders,
} from './csvParser';
import { analyzeCsvRows } from './statistics';
import type {
  CsvAnalysisResult,
  CsvParseResult,
  CsvRawRow,
} from '../../types/topicmining/report';

export class CsvService {
  async parseCsv(buffer: Buffer): Promise<CsvParseResult> {
    const startedAt = performance.now();
    const text = buffer.toString('utf-8');

    if (!text.trim()) {
      throw createError(400, 'CSV 文件内容为空');
    }

    const lines = splitCsvLines(text.trim());
    if (lines.length < 2) {
      throw createError(400, 'CSV 文件数据量不足');
    }

    const headerRow = parseCsvLine(lines[0]);
    const { missing } = validateHeaders(headerRow);

    if (missing.length > 0) {
      return {
        statistics: emptyAnalysisResult(),
        warnings: [
          {
            type: 'missing_required_columns',
            message: `缺少必需列: ${missing.join(', ')}`,
          },
        ],
        metadata: {
          originalRowCount: 0,
          validRowCount: 0,
          removedDuplicates: 0,
          removedEmptyRows: 0,
          executionTimeMs: performance.now() - startedAt,
        },
      };
    }

    const dataMap: CsvRawRow[] = [];
    const warnings: CsvParseResult['warnings'] = [];
    const duplicates = new Set<string>();
    const seenHashes = new Set<string>();

    let removedEmptyRows = 0;

    for (let i = 1; i < lines.length; i++) {
      const line = lines[i];
      if (!line.trim()) {
        continue;
      }

      const values = parseCsvLine(line);
      if (values.length !== headerRow.length) {
        warnings.push({
          type: 'invalid_row',
          message: `第 ${i + 1} 行列数量不匹配`,
        });
        continue;
      }

      const row: Record<string, string> = {};
      headerRow.forEach((header, index) => {
        row[header] = values[index];
      });

      const normalized = normalizeColumns(row);
      if (REQUIRED_FIELDS.some((field) => !normalized[field]?.trim())) {
        removedEmptyRows += 1;
        warnings.push({
          type: 'empty_field',
          message: `第 ${i + 1} 行存在必填字段为空，已忽略`,
        });
        continue;
      }

      const hash = hashRecord(Object.values(normalized));
      if (seenHashes.has(hash)) {
        duplicates.add(hash);
        continue;
      }

      seenHashes.add(hash);
      dataMap.push({
        sourceSessionId: normalized.sourceSessionId,
        sourceSessionName: normalized.sourceSessionName,
        topicName: normalized.topicName,
        parentCategory: normalized.parentCategory,
        childCategory: normalized.childCategory,
        response: normalized.response,
        context: normalized.context,
      });
    }

    const statistics = analyzeCsvRows(dataMap);

    if (duplicates.size > 0) {
      warnings.push({
        type: 'duplicate_removed',
        message: `已移除 ${duplicates.size} 条重复记录`,
      });
    }

    return {
      statistics,
      warnings,
      metadata: {
        originalRowCount: lines.length - 1,
        validRowCount: dataMap.length,
        removedDuplicates: duplicates.size,
        removedEmptyRows,
        executionTimeMs: performance.now() - startedAt,
      },
    };
  }
}

const REQUIRED_FIELDS: (keyof CsvRawRow)[] = [
  'topicName',
  'parentCategory',
  'childCategory',
  'context',
];

function createError(status: number, message: string) {
  const error = new Error(message) as Error & { status: number };
  error.status = status;
  return error;
}

function emptyAnalysisResult(): CsvAnalysisResult {
  return {
    totalCount: 0,
    parents: [],
    childStats: {},
    topParents: [],
    samples: {},
    childSamples: {},
    skippedEmptyParent: 0,
  };
}

export default new CsvService();
