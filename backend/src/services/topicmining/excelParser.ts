import * as XLSX from 'xlsx';
import type { CsvRawRow } from '../../types/topicmining/report';
import { normalizeColumns } from './csvParser';

export interface ExcelParseResult {
  rows: CsvRawRow[];
  warnings: string[];
  sheetInfo?: {
    totalSheets: number;
    selectedSheet: string;
  };
}

/**
 * 解析Excel文件(支持.xlsx和.xls格式)
 *
 * @param buffer Excel文件的二进制数据
 * @returns 解析结果,包含行数据和警告信息
 * @throws Error 当文件无法解析或格式错误时
 */
export function parseExcel(buffer: Buffer): ExcelParseResult {
  let workbook: XLSX.WorkBook;

  // 1. 读取工作簿
  try {
    workbook = XLSX.read(buffer, {
      type: 'buffer',
      cellDates: true, // 自动将日期格式化
      cellText: false, // 保留数值类型
      cellFormula: false, // 不解析公式,只取计算结果值
    });
  } catch (error: any) {
    throw new Error(`无法解析Excel文件: ${error.message}`);
  }

  // 2. 检查工作表是否存在
  if (!workbook.SheetNames || workbook.SheetNames.length === 0) {
    throw new Error('Excel文件中没有找到工作表');
  }

  // 3. 选择第一个工作表
  const sheetName = workbook.SheetNames[0];
  const sheet = workbook.Sheets[sheetName];

  const warnings: string[] = [];
  const sheetInfo = {
    totalSheets: workbook.SheetNames.length,
    selectedSheet: sheetName,
  };

  // 4. 如果有多个工作表,添加提示信息
  if (workbook.SheetNames.length > 1) {
    warnings.push(
      `检测到${workbook.SheetNames.length}个工作表,已自动选择第一个工作表"${sheetName}"进行解析`
    );
  }

  // 5. 将工作表转换为JSON数组
  const jsonData = XLSX.utils.sheet_to_json(sheet, {
    header: 1, // 返回二维数组格式 [[row1], [row2], ...]
    raw: false, // 将所有值转换为字符串
    defval: '', // 空单元格的默认值
    blankrows: false, // 跳过完全空白的行
  }) as string[][];

  // 6. 检查数据量
  if (jsonData.length < 2) {
    throw new Error('Excel文件数据量不足(至少需要表头行和一行数据)');
  }

  // 7. 提取表头和数据行
  const headerRow = jsonData[0];
  const dataRows = jsonData.slice(1);

  // 8. 转换为标准化的行对象数组
  const rows: CsvRawRow[] = [];

  for (const row of dataRows) {
    // 构建行对象
    const rowObj: Record<string, string> = {};

    headerRow.forEach((header, index) => {
      // 获取单元格值,并进行字符串处理
      let value = row[index] || '';

      // 如果是非空值,转换为字符串并trim
      if (value) {
        value = String(value).trim();
      }

      rowObj[header] = value;
    });

    // 使用现有的标准化函数进行列名映射
    const normalized: CsvRawRow = {
      sourceSessionId: rowObj['来源会话ID'] || rowObj['sourceSessionId'] || '',
      sourceSessionName: rowObj['来源会话名称'] || rowObj['sourceSessionName'] || '',
      topicName: rowObj['话题名称'] || rowObj['topicName'] || '',
      parentCategory: rowObj['所属父类'] || rowObj['parentCategory'] || '',
      childCategory: rowObj['所属子类'] || rowObj['childCategory'] || '',
      response: rowObj['话题回应'] || rowObj['response'] || '',
      context: rowObj['上下文片段'] || rowObj['context'] || '',
    };
    rows.push(normalized);
  }

  return {
    rows,
    warnings,
    sheetInfo,
  };
}
