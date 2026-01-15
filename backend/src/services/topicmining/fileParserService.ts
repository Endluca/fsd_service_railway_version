import { performance } from 'perf_hooks';
import {
  hashRecord,
  normalizeColumns,
  parseCsvLine,
  splitCsvLines,
  validateHeaders,
} from './csvParser';
import { analyzeCsvRows } from './statistics';
import { detectFileType } from './fileTypeDetector';
import { parseExcel } from './excelParser';
import type {
  CsvAnalysisResult,
  CsvParseResult,
  CsvRawRow,
} from '../../types/topicmining/report';

export class FileParserService {
  /**
   * 解析数据文件(支持CSV、XLSX、XLS格式)
   *
   * @param buffer 文件二进制数据
   * @param filename 文件名
   * @param mimetype MIME类型(可选)
   * @returns 解析结果
   */
  async parseFile(
    buffer: Buffer,
    filename: string,
    mimetype?: string
  ): Promise<CsvParseResult> {
    const startedAt = performance.now();

    // 1. 检测文件类型
    const fileType = detectFileType(buffer, filename, mimetype);

    // 2. 根据文件类型选择解析器
    let rows: CsvRawRow[];
    let extraWarnings: string[] = [];
    let originalRowCount = 0;

    if (fileType === 'xlsx' || fileType === 'xls') {
      // Excel解析
      const excelResult = parseExcel(buffer);
      rows = excelResult.rows;
      extraWarnings = excelResult.warnings;
      originalRowCount = rows.length;
    } else {
      // CSV解析(保持原有逻辑)
      const csvResult = this.parseCsvInternal(buffer);
      rows = csvResult.rows;
      originalRowCount = csvResult.originalRowCount;
    }

    // 3. 验证必需列
    if (rows.length === 0) {
      return {
        statistics: emptyAnalysisResult(),
        warnings: [
          {
            type: 'missing_required_columns',
            message: `文件数据为空或格式错误`,
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

    // 4. 统一的数据清洗流程
    const cleanResult = this.cleanData(rows);

    // 5. 统计分析
    const statistics = analyzeCsvRows(cleanResult.validRows);

    // 6. 合并警告信息
    const warnings: CsvParseResult['warnings'] = [
      ...extraWarnings.map((msg) => ({
        type: 'info' as const,
        message: msg,
      })),
      ...cleanResult.warnings,
    ];

    if (cleanResult.duplicates > 0) {
      warnings.push({
        type: 'duplicate_removed',
        message: `已移除 ${cleanResult.duplicates} 条重复记录`,
      });
    }

    return {
      statistics,
      warnings,
      metadata: {
        originalRowCount,
        validRowCount: cleanResult.validRows.length,
        removedDuplicates: cleanResult.duplicates,
        removedEmptyRows: cleanResult.emptyRows,
        executionTimeMs: performance.now() - startedAt,
      },
    };
  }

  /**
   * CSV文件内部解析逻辑(保持原有逻辑)
   */
  private parseCsvInternal(buffer: Buffer): {
    rows: CsvRawRow[];
    originalRowCount: number;
  } {
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
      // 返回空行数组,让后续统一处理
      return {
        rows: [],
        originalRowCount: 0,
      };
    }

    const rows: CsvRawRow[] = [];

    for (let i = 1; i < lines.length; i++) {
      const line = lines[i];
      if (!line.trim()) {
        continue;
      }

      const values = parseCsvLine(line);
      if (values.length !== headerRow.length) {
        // 跳过列数不匹配的行
        continue;
      }

      const row: Record<string, string> = {};
      headerRow.forEach((header, index) => {
        row[header] = values[index];
      });

      const normalized: CsvRawRow = {
        sourceSessionId: row['来源会话ID'] || row['sourceSessionId'] || '',
        sourceSessionName: row['来源会话名称'] || row['sourceSessionName'] || '',
        topicName: row['话题名称'] || row['topicName'] || '',
        parentCategory: row['所属父类'] || row['parentCategory'] || '',
        childCategory: row['所属子类'] || row['childCategory'] || '',
        response: row['话题回应'] || row['response'] || '',
        context: row['上下文片段'] || row['context'] || '',
      };
      rows.push(normalized);
    }

    return {
      rows,
      originalRowCount: lines.length - 1,
    };
  }

  /**
   * 数据清洗:去重、移除空行、验证必填字段
   */
  private cleanData(rows: CsvRawRow[]): {
    validRows: CsvRawRow[];
    warnings: CsvParseResult['warnings'];
    duplicates: number;
    emptyRows: number;
  } {
    const validRows: CsvRawRow[] = [];
    const warnings: CsvParseResult['warnings'] = [];
    const duplicates = new Set<string>();
    const seenHashes = new Set<string>();
    let emptyRows = 0;

    for (let i = 0; i < rows.length; i++) {
      const normalized = rows[i];

      // 检查必填字段
      if (REQUIRED_FIELDS.some((field) => !normalized[field]?.trim())) {
        emptyRows += 1;
        // 不为每一行都添加警告,只在最后汇总
        continue;
      }

      // 去重
      const hash = hashRecord(Object.values(normalized));
      if (seenHashes.has(hash)) {
        duplicates.add(hash);
        continue;
      }

      seenHashes.add(hash);
      validRows.push(normalized);
    }

    // 如果有空行,添加汇总警告
    if (emptyRows > 0) {
      warnings.push({
        type: 'empty_field',
        message: `已忽略 ${emptyRows} 行必填字段为空的数据`,
      });
    }

    return {
      validRows,
      warnings,
      duplicates: duplicates.size,
      emptyRows,
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

export default new FileParserService();
