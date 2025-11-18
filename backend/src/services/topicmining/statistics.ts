import type { ChildStat, CsvRawRow, CsvAnalysisResult, SampleSnippet } from '../../types/topicmining/report';
import { parseDialogues, countTurns, filterAndRankSnippets } from './dialogueParser';

interface ParentAccumulator {
  name: string;
  count: number;
  samples: SampleSnippet[];
  children: Map<string, ChildAccumulator>;
}

interface ChildAccumulator {
  name: string;
  count: number;
  samples: SampleSnippet[];
  allContexts: string[]; // 保存所有上下文用于后续过滤
}

const SAMPLE_LIMIT = 10;
const CHILD_SAMPLE_LIMIT = 10; // 改为10以收集足够的候选样本

export function analyzeCsvRows(rows: CsvRawRow[]): CsvAnalysisResult {
  const parentMap = new Map<string, ParentAccumulator>();
  let skippedEmptyParent = 0;

  rows.forEach((row) => {
    const parentName = row.parentCategory?.trim();
    if (!parentName) {
      skippedEmptyParent += 1;
      return;
    }

    const childName = row.childCategory?.trim() || '未分类';

    // 解析对话信息
    const dialogues = parseDialogues(row.context);
    const turnCount = countTurns(dialogues);
    const charCount = row.context?.length || 0;

    const snippet: SampleSnippet = {
      topicName: row.topicName,
      context: row.context,
      sourceSessionId: row.sourceSessionId || undefined,
      childCategory: childName,
      dialogues,
      turnCount,
      charCount
    };

    if (!parentMap.has(parentName)) {
      parentMap.set(parentName, {
        name: parentName,
        count: 0,
        samples: [],
        children: new Map<string, ChildAccumulator>()
      });
    }

    const parentAcc = parentMap.get(parentName)!;
    parentAcc.count += 1;
    pushSample(parentAcc.samples, snippet, SAMPLE_LIMIT);

    if (!parentAcc.children.has(childName)) {
      parentAcc.children.set(childName, {
        name: childName,
        count: 0,
        samples: [],
        allContexts: []
      });
    }

    const childAcc = parentAcc.children.get(childName)!;
    childAcc.count += 1;

    // 收集所有样本用于后续过滤
    childAcc.samples.push(snippet);
    childAcc.allContexts.push(row.context);
  });

  const totalCount = rows.length;
  const parents = Array.from(parentMap.values())
    .map((parent) => {
      const children = Array.from(parent.children.values()).map((child) => toChildStat(child, parent.count, totalCount));
      children.sort((a, b) => b.count - a.count);
      return {
        name: parent.name,
        count: parent.count,
        children,
        percentage: roundPercentage((parent.count / totalCount) * 100),
        samples: parent.samples
      };
    })
    .sort((a, b) => b.count - a.count)
    .map((parent, index) => ({
      name: parent.name,
      count: parent.count,
      percentage: parent.percentage,
      rank: index + 1,
      children: parent.children
    }));

  const childStats: Record<string, ChildStat[]> = {};
  const samples: Record<string, SampleSnippet[]> = {};
  const childSamples: Record<string, Record<string, SampleSnippet[]>> = {};

  parents.forEach((parent) => {
    const parentAcc = parentMap.get(parent.name)!;
    childStats[parent.name] = parent.children;
    samples[parent.name] = parentAcc.samples;
    childSamples[parent.name] = {};

    parentAcc.children.forEach((child) => {
      // 对每个child category的samples进行智能过滤和排序
      const filteredSnippets = filterChildSamples(child.samples, CHILD_SAMPLE_LIMIT);
      childSamples[parent.name][child.name] = filteredSnippets;
    });
  });

  return {
    totalCount,
    parents,
    childStats,
    topParents: parents.slice(0, 4).map((p) => p.name),
    samples,
    childSamples,
    skippedEmptyParent
  };
}

function roundPercentage(value: number): number {
  return Number.isFinite(value) ? Math.round(value * 100) / 100 : 0;
}

function pushSample(list: SampleSnippet[], snippet: SampleSnippet, limit: number) {
  if (list.length >= limit) {
    return;
  }

  if (!snippet.topicName && !snippet.context) {
    return;
  }

  const differentTopicExists = list.every((item) => item.topicName !== snippet.topicName);
  if (differentTopicExists || list.length === 0) {
    list.push(snippet);
  }
}

function toChildStat(acc: ChildAccumulator, parentTotal: number, overallTotal: number): ChildStat {
  return {
    name: acc.name,
    count: acc.count,
    percentage: roundPercentage((acc.count / parentTotal) * 100),
    parentPercentage: roundPercentage((acc.count / overallTotal) * 100)
  };
}

/**
 * 智能过滤child samples
 * 优先选择符合条件的片段（轮次5-10，字符数<=2000），不足时放宽条件
 */
function filterChildSamples(samples: SampleSnippet[], targetCount: number): SampleSnippet[] {
  // 去重：基于topicName
  const uniqueSamples = new Map<string, SampleSnippet>();
  samples.forEach(sample => {
    const key = sample.topicName || Math.random().toString();
    if (!uniqueSamples.has(key)) {
      uniqueSamples.set(key, sample);
    }
  });

  const dedupedSamples = Array.from(uniqueSamples.values());

  // 分为高优先级和低优先级
  const highPriority: SampleSnippet[] = [];
  const lowPriority: SampleSnippet[] = [];

  dedupedSamples.forEach(sample => {
    const turnCount = sample.turnCount || 0;
    const charCount = sample.charCount || 0;

    if (turnCount >= 5 && turnCount <= 10 && charCount <= 2000) {
      highPriority.push(sample);
    } else {
      lowPriority.push(sample);
    }
  });

  // 优先使用符合条件的，不足时补充不符合条件的
  const result: SampleSnippet[] = [];

  // 先添加高优先级，优先选择上下文内容更长的（更有信息量）
  highPriority.sort((a, b) => (b.charCount || 0) - (a.charCount || 0));
  result.push(...highPriority.slice(0, targetCount));

  // 如果不足，添加低优先级
  if (result.length < targetCount) {
    lowPriority.sort((a, b) => (b.charCount || 0) - (a.charCount || 0));
    result.push(...lowPriority.slice(0, targetCount - result.length));
  }

  return result;
}




