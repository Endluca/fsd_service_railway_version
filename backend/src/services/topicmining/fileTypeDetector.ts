import * as path from 'path';

export type FileType = 'csv' | 'xlsx' | 'xls' | 'unknown';

/**
 * 检测文件类型
 * 使用三层检测机制: Magic Number > MIME类型 > 文件扩展名
 *
 * @param buffer 文件二进制数据
 * @param filename 文件名
 * @param mimetype MIME类型(可选)
 * @returns 文件类型
 */
export function detectFileType(
  buffer: Buffer,
  filename: string,
  mimetype?: string
): FileType {
  // 第1层: Magic Number检测(最可靠)
  const magicType = checkMagicNumber(buffer);
  if (magicType !== 'unknown') {
    return magicType;
  }

  // 第2层: MIME类型验证
  if (mimetype) {
    const mimeType = detectByMimeType(mimetype);
    if (mimeType !== 'unknown') {
      return mimeType;
    }
  }

  // 第3层: 文件扩展名(兜底)
  const extType = detectByExtension(filename);
  if (extType !== 'unknown') {
    return extType;
  }

  // 默认尝试CSV解析
  return 'csv';
}

/**
 * 通过Magic Number检测文件类型
 *
 * @param buffer 文件二进制数据
 * @returns 文件类型
 */
function checkMagicNumber(buffer: Buffer): FileType {
  if (buffer.length < 4) {
    return 'unknown';
  }

  // XLSX: PK\x03\x04 (ZIP文件头,因为XLSX本质是ZIP压缩包)
  if (
    buffer[0] === 0x50 && // P
    buffer[1] === 0x4b && // K
    buffer[2] === 0x03 &&
    buffer[3] === 0x04
  ) {
    return 'xlsx';
  }

  // XLS: D0 CF 11 E0 (OLE2文件头)
  if (
    buffer[0] === 0xd0 &&
    buffer[1] === 0xcf &&
    buffer[2] === 0x11 &&
    buffer[3] === 0xe0
  ) {
    return 'xls';
  }

  return 'unknown';
}

/**
 * 通过MIME类型检测文件类型
 *
 * @param mimetype MIME类型字符串
 * @returns 文件类型
 */
function detectByMimeType(mimetype: string): FileType {
  const mime = mimetype.toLowerCase();

  // XLSX MIME类型
  if (mime.includes('officedocument.spreadsheetml.sheet')) {
    return 'xlsx';
  }

  // XLS MIME类型
  if (mime.includes('vnd.ms-excel') || mime.includes('application/excel')) {
    return 'xls';
  }

  // CSV MIME类型
  if (mime.includes('csv') || mime.includes('text/plain')) {
    return 'csv';
  }

  return 'unknown';
}

/**
 * 通过文件扩展名检测文件类型
 *
 * @param filename 文件名
 * @returns 文件类型
 */
function detectByExtension(filename: string): FileType {
  const ext = path.extname(filename).toLowerCase();

  if (ext === '.xlsx') {
    return 'xlsx';
  }

  if (ext === '.xls') {
    return 'xls';
  }

  if (ext === '.csv') {
    return 'csv';
  }

  return 'unknown';
}
