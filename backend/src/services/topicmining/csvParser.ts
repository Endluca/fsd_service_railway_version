const REQUIRED_COLUMNS = ['话题名称', '所属父类', '所属子类', '上下文片段'];

export function splitCsvLines(content: string): string[] {
  const normalized = content.replace(/\r\n/g, '\n').replace(/\r/g, '\n');
  const lines: string[] = [];
  let current = '';
  let inQuotes = false;

  for (let i = 0; i < normalized.length; i++) {
    const char = normalized[i];
    const nextChar = normalized[i + 1];

    if (char === '"') {
      if (inQuotes && nextChar === '"') {
        current += '"';
        i++;
      } else {
        inQuotes = !inQuotes;
        current += char;
      }
      continue;
    }

    if (char === '\n' && !inQuotes) {
      lines.push(current);
      current = '';
      continue;
    }

    current += char;
  }

  if (current.length > 0) {
    lines.push(current);
  }

  return lines;
}

export function parseCsvLine(line: string): string[] {
  const result: string[] = [];
  let current = '';
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    const nextChar = line[i + 1];

    if (char === '"') {
      if (inQuotes && nextChar === '"') {
        current += '"';
        i++;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (char === ',' && !inQuotes) {
      result.push(current.trim());
      current = '';
    } else {
      current += char;
    }
  }

  result.push(current.trim());
  return result.map((value) => value.replace(/^"|"$/g, ''));
}

export function validateHeaders(headers: string[]): { missing: string[] } {
  const missing = REQUIRED_COLUMNS.filter((col) => !headers.includes(col));
  return { missing };
}

export function normalizeColumns(row: Record<string, string>): Record<string, string> {
  return {
    sourceSessionId: row['来源会话ID'] || row['sourceSessionId'] || '',
    sourceSessionName: row['来源会话名称'] || row['sourceSessionName'] || '',
    topicName: row['话题名称'] || row['topicName'] || '',
    parentCategory: row['所属父类'] || row['parentCategory'] || '',
    childCategory: row['所属子类'] || row['childCategory'] || '',
    response: row['话题回应'] || row['response'] || '',
    context: row['上下文片段'] || row['context'] || ''
  };
}

export function hashRecord(values: string[]): string {
  return Buffer.from(encodeURIComponent(values.join('|'))).toString('base64');
}
