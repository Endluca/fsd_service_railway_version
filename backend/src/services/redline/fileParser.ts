/**
 * 红线数据文件解析服务
 * 支持 CSV、XLSX、XLS 格式
 */

import * as XLSX from 'xlsx';
import type {
  ParsedRedLineRow,
  ParseError,
  XlsxParseResult,
  DepartmentExtractResult,
  Department,
} from '../../types/redline';

// 必需的列名
const REQUIRED_COLUMNS = [
  '会话ID',
  '客户',
  '销售',
  '成员所属部门',
  '红线类型',
  '原文',
];

// 部门关键字
const DEPARTMENT_KEYWORDS: Department[] = ['cc', 'ss', 'lp'];

/**
 * 从"成员所属部门"字段提取部门
 */
export function extractDepartment(originalDept: string): DepartmentExtractResult {
  if (!originalDept || typeof originalDept !== 'string') {
    return {
      department: null,
      error: '成员所属部门字段为空或无效',
    };
  }

  const lower = originalDept.toLowerCase();
  const matches = DEPARTMENT_KEYWORDS.filter(keyword => lower.includes(keyword));

  if (matches.length === 0) {
    return {
      department: null,
      error: `"${originalDept}" 未包含有效部门关键字 (cc/ss/lp)`,
    };
  }

  if (matches.length > 1) {
    return {
      department: null,
      error: `"${originalDept}" 同时包含多个部门关键字: ${matches.join(', ')}`,
    };
  }

  return {
    department: matches[0],
    error: null,
  };
}

/**
 * 验证列名是否完全匹配
 */
function validateColumns(headers: string[]): { valid: boolean; missing: string[] } {
  const missing = REQUIRED_COLUMNS.filter(col => !headers.includes(col));
  return {
    valid: missing.length === 0,
    missing,
  };
}

/**
 * 检测文件类型
 */
function detectFileType(buffer: Buffer, filename: string): 'csv' | 'xlsx' | 'xls' | 'unknown' {
  // Magic Number 检测
  if (buffer.length >= 4) {
    // XLSX: PK\x03\x04 (ZIP 文件头)
    if (buffer[0] === 0x50 && buffer[1] === 0x4b && buffer[2] === 0x03 && buffer[3] === 0x04) {
      return 'xlsx';
    }
    // XLS: D0 CF 11 E0 (OLE2 文件头)
    if (buffer[0] === 0xd0 && buffer[1] === 0xcf && buffer[2] === 0x11 && buffer[3] === 0xe0) {
      return 'xls';
    }
  }

  // 文件扩展名检测
  const ext = filename.toLowerCase();
  if (ext.endsWith('.xlsx')) return 'xlsx';
  if (ext.endsWith('.xls')) return 'xls';
  if (ext.endsWith('.csv')) return 'csv';

  return 'unknown';
}

/**
 * 解析 CSV 文件
 */
function parseCsvFile(buffer: Buffer): XlsxParseResult {
  try {
    // 使用 xlsx 库解析 CSV
    const workbook = XLSX.read(buffer, {
      type: 'buffer',
      raw: false,
    });

    const sheetName = workbook.SheetNames[0];
    if (!sheetName) {
      return {
        success: false,
        message: 'CSV 文件中没有数据',
      };
    }

    const sheet = workbook.Sheets[sheetName];
    const rawData: any[] = XLSX.utils.sheet_to_json(sheet, {
      raw: false,
      defval: '',
    });

    return parseRowData(rawData);
  } catch (error) {
    console.error('解析 CSV 文件失败:', error);
    return {
      success: false,
      message: `解析 CSV 文件失败: ${error instanceof Error ? error.message : '未知错误'}`,
    };
  }
}

/**
 * 解析 Excel 文件 (XLSX/XLS)
 */
function parseExcelFile(buffer: Buffer): XlsxParseResult {
  try {
    const workbook = XLSX.read(buffer, {
      type: 'buffer',
      cellDates: true,
      cellText: false,
      cellFormula: false,
    });

    const sheetName = workbook.SheetNames[0];
    if (!sheetName) {
      return {
        success: false,
        message: 'Excel 文件中没有找到工作表',
      };
    }

    const sheet = workbook.Sheets[sheetName];
    const rawData: any[] = XLSX.utils.sheet_to_json(sheet, {
      raw: false,
      defval: '',
    });

    return parseRowData(rawData);
  } catch (error) {
    console.error('解析 Excel 文件失败:', error);
    return {
      success: false,
      message: `解析 Excel 文件失败: ${error instanceof Error ? error.message : '未知错误'}`,
    };
  }
}

/**
 * 解析行数据(CSV和Excel共用)
 */
function parseRowData(rawData: any[]): XlsxParseResult {
  if (rawData.length === 0) {
    return {
      success: false,
      message: '文件中没有数据',
    };
  }

  // 验证列名
  const headers = Object.keys(rawData[0]);
  const columnValidation = validateColumns(headers);

  if (!columnValidation.valid) {
    return {
      success: false,
      message: `文件缺少必需的列: ${columnValidation.missing.join(', ')}`,
    };
  }

  // 解析每一行数据
  const parsedData: ParsedRedLineRow[] = [];
  const errors: ParseError[] = [];

  for (let i = 0; i < rawData.length; i++) {
    const row = rawData[i];
    const rowNumber = i + 2; // 行号（第1行是标题，数据从第2行开始）

    // 检查必填字段是否为空
    const conversationId = String(row['会话ID'] || '').trim();
    const customer = String(row['客户'] || '').trim();
    const sales = String(row['销售'] || '').trim();
    const originalDepartment = String(row['成员所属部门'] || '').trim();
    const redLineType = String(row['红线类型'] || '').trim();
    const content = String(row['原文'] || '').trim();

    // 验证必填字段
    if (!conversationId) {
      errors.push({
        row: rowNumber,
        field: '会话ID',
        value: '',
        reason: '该字段不能为空',
      });
      continue;
    }

    if (!customer) {
      errors.push({
        row: rowNumber,
        field: '客户',
        value: '',
        reason: '该字段不能为空',
      });
      continue;
    }

    if (!sales) {
      errors.push({
        row: rowNumber,
        field: '销售',
        value: '',
        reason: '该字段不能为空',
      });
      continue;
    }

    if (!originalDepartment) {
      errors.push({
        row: rowNumber,
        field: '成员所属部门',
        value: '',
        reason: '该字段不能为空',
      });
      continue;
    }

    if (!redLineType) {
      errors.push({
        row: rowNumber,
        field: '红线类型',
        value: '',
        reason: '该字段不能为空',
      });
      continue;
    }

    if (!content) {
      errors.push({
        row: rowNumber,
        field: '原文',
        value: '',
        reason: '该字段不能为空',
      });
      continue;
    }

    // 提取部门
    const deptResult = extractDepartment(originalDepartment);
    if (deptResult.error || !deptResult.department) {
      errors.push({
        row: rowNumber,
        field: '成员所属部门',
        value: originalDepartment,
        reason: deptResult.error || '部门提取失败',
      });
      continue;
    }

    // 添加到结果
    parsedData.push({
      conversationId,
      customer,
      sales,
      department: deptResult.department,
      originalDepartment,
      redLineType,
      content,
    });
  }

  // 如果有任何错误，返回失败
  if (errors.length > 0) {
    return {
      success: false,
      errors,
      message: `发现 ${errors.length} 个数据错误，请修正后重新上传`,
    };
  }

  // 成功
  return {
    success: true,
    data: parsedData,
  };
}

/**
 * 统一的文件解析入口
 * 支持 CSV、XLSX、XLS 格式
 */
export function parseFile(buffer: Buffer, filename: string): XlsxParseResult {
  const fileType = detectFileType(buffer, filename);

  switch (fileType) {
    case 'csv':
      return parseCsvFile(buffer);
    case 'xlsx':
    case 'xls':
      return parseExcelFile(buffer);
    default:
      return {
        success: false,
        message: '不支持的文件格式，仅支持 CSV、XLSX、XLS 格式',
      };
  }
}
