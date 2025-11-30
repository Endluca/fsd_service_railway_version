/**
 * XLSX 文件解析服务
 * 负责解析上传的 xlsx 文件并提取愤怒小鸟数据
 */

import * as XLSX from 'xlsx';
import type {
  XlsxRawRow,
  ParsedAngryBirdRow,
  ParseError,
  XlsxParseResult,
  DepartmentExtractResult,
  Department,
} from '../../types/angrybird';

// 必需的列名（原文列可选，允许为空）
const REQUIRED_COLUMNS = [
  '会话ID',
  '会话开始时间',
  '客户',
  '销售',
  '成员所属部门',
  '识别客户情绪',
  '原文',
];

// 部门关键字
const DEPARTMENT_KEYWORDS: Department[] = ['cc', 'ss', 'lp'];

/**
 * 解析时间字符串
 * 输入格式: "2025/11/25 03:56:27 UTC+0800"
 * 处理: 移除 "UTC+0800" 后缀
 */
function parseConversationTime(timeStr: string): Date | null {
  if (!timeStr) return null;

  // 移除时区后缀 "UTC+0800" 或 "UTC-0500" 等
  const cleanedStr = timeStr.replace(/\s*UTC[+-]\d{4}\s*$/, '').trim();

  try {
    const date = new Date(cleanedStr);
    if (isNaN(date.getTime())) {
      return null;
    }
    return date;
  } catch {
    return null;
  }
}

/**
 * 从"成员所属部门"字段提取部门
 * 规则：
 * - 不区分大小写匹配 cc/ss/lp
 * - 如果同时包含多个关键字，返回错误
 * - 如果不包含任何关键字，返回错误
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
 * 解析 XLSX 文件
 */
export function parseXlsxFile(buffer: Buffer): XlsxParseResult {
  try {
    // 读取 workbook
    const workbook = XLSX.read(buffer, { type: 'buffer' });

    // 获取第一个 sheet
    const sheetName = workbook.SheetNames[0];
    if (!sheetName) {
      return {
        success: false,
        message: 'Excel 文件中没有找到工作表',
      };
    }

    const sheet = workbook.Sheets[sheetName];

    // 转换为 JSON 格式
    const rawData: any[] = XLSX.utils.sheet_to_json(sheet, {
      raw: false,  // 将所有值转换为字符串
      defval: '',  // 空单元格默认值
    });

    if (rawData.length === 0) {
      return {
        success: false,
        message: 'Excel 文件中没有数据',
      };
    }

    // 验证列名
    const headers = Object.keys(rawData[0]);
    const columnValidation = validateColumns(headers);

    if (!columnValidation.valid) {
      return {
        success: false,
        message: `Excel 文件缺少必需的列: ${columnValidation.missing.join(', ')}`,
      };
    }

    // 解析每一行数据
    const parsedData: ParsedAngryBirdRow[] = [];
    const errors: ParseError[] = [];

    for (let i = 0; i < rawData.length; i++) {
      const row = rawData[i] as XlsxRawRow;
      const rowNumber = i + 2; // Excel 行号（第1行是标题，数据从第2行开始）

      // 检查必填字段是否为空
      const conversationId = String(row['会话ID'] || '').trim();
      const conversationStartTimeStr = String(row['会话开始时间'] || '').trim();
      const customer = String(row['客户'] || '').trim();
      const sales = String(row['销售'] || '').trim();
      const originalDepartment = String(row['成员所属部门'] || '').trim();
      const customerEmotion = String(row['识别客户情绪'] || '').trim();
      const content = String(row['原文'] || '').trim();

      // 验证会话ID
      if (!conversationId) {
        errors.push({
          row: rowNumber,
          field: '会话ID',
          value: '',
          reason: '该字段不能为空',
        });
        continue;
      }

      // 验证和解析会话开始时间
      if (!conversationStartTimeStr) {
        errors.push({
          row: rowNumber,
          field: '会话开始时间',
          value: '',
          reason: '该字段不能为空',
        });
        continue;
      }

      const conversationStartTime = parseConversationTime(conversationStartTimeStr);
      if (!conversationStartTime) {
        errors.push({
          row: rowNumber,
          field: '会话开始时间',
          value: conversationStartTimeStr,
          reason: '时间格式无效（期望格式: 2025/11/25 03:56:27 UTC+0800）',
        });
        continue;
      }

      // 验证客户
      if (!customer) {
        errors.push({
          row: rowNumber,
          field: '客户',
          value: '',
          reason: '该字段不能为空',
        });
        continue;
      }

      // 验证销售
      if (!sales) {
        errors.push({
          row: rowNumber,
          field: '销售',
          value: '',
          reason: '该字段不能为空',
        });
        continue;
      }

      // 验证成员所属部门
      if (!originalDepartment) {
        errors.push({
          row: rowNumber,
          field: '成员所属部门',
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

      // 验证客户情绪
      if (!customerEmotion) {
        errors.push({
          row: rowNumber,
          field: '识别客户情绪',
          value: '',
          reason: '该字段不能为空',
        });
        continue;
      }

      // 原文字段允许为空，不做验证

      // 添加到结果
      parsedData.push({
        conversationId,
        conversationStartTime,
        customer,
        sales,
        department: deptResult.department,
        originalDepartment,
        customerEmotion,
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
  } catch (error) {
    console.error('解析 XLSX 文件失败:', error);
    return {
      success: false,
      message: `解析文件失败: ${error instanceof Error ? error.message : '未知错误'}`,
    };
  }
}
