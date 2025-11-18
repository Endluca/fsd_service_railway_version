import type { DialogueMessage } from '../../types/topicmining/report';

/**
 * 解析上下文片段中的对话内容
 * 格式示例: "1客户：احتاج رقم المشرف\n2客户：عندنا مشكله\n3销售：اهلا حبيبتي"
 */
export function parseDialogues(context: string): DialogueMessage[] {
  if (!context || typeof context !== 'string') {
    return [];
  }

  const dialogues: DialogueMessage[] = [];
  const lines = context.split('\n').map(line => line.trim()).filter(Boolean);

  for (const line of lines) {
    // 匹配格式: 数字+角色（客户或销售）+冒号+内容
    const match = line.match(/^\d+([客户销售]+)[：:](.*)/);

    if (match) {
      const rolePart = match[1].trim();
      const text = match[2].trim();

      if (text) {
        const role = rolePart.includes('客户') ? 'customer' : 'sales';
        dialogues.push({ role, text });
      }
    }
  }

  return dialogues;
}

/**
 * 计算对话轮次数
 * 规则：
 * - 连续的同角色消息算一组
 * - 一方连续输出 + 另一方连续输出 = 1轮完整对话
 * - 如果最后只剩一方输出（无对方回应）= 0.5轮
 *
 * 示例1：客户(3条) → 销售(2条) → 客户(2条) → 销售(1条) = 2轮
 * 示例2：客户(3条) → 销售(2条) → 客户(2条) = 1.5轮
 */
export function countTurns(dialogues: DialogueMessage[]): number {
  if (dialogues.length === 0) {
    return 0;
  }

  // 将连续的同角色消息归为一组
  const groups: Array<'customer' | 'sales'> = [];
  let lastRole: 'customer' | 'sales' | null = null;

  for (const dialogue of dialogues) {
    if (dialogue.role !== lastRole) {
      groups.push(dialogue.role);
      lastRole = dialogue.role;
    }
  }

  // 计算轮次
  // 每2组 = 1轮，如果是奇数组，最后一组 = 0.5轮
  const fullTurns = Math.floor(groups.length / 2);
  const hasHalfTurn = groups.length % 2 === 1;

  return fullTurns + (hasHalfTurn ? 0.5 : 0);
}

/**
 * 判断片段是否符合筛选条件
 * @param context 上下文片段
 * @param minTurns 最小轮次（默认5）
 * @param maxTurns 最大轮次（默认10）
 * @param maxChars 最大字符数（默认2000）
 */
export function isValidSnippet(
  context: string,
  minTurns: number = 5,
  maxTurns: number = 10,
  maxChars: number = 2000
): { valid: boolean; turnCount: number; charCount: number; dialogues: DialogueMessage[] } {
  const charCount = context.length;
  const dialogues = parseDialogues(context);
  const turnCount = countTurns(dialogues);

  const valid = turnCount >= minTurns && turnCount <= maxTurns && charCount <= maxChars;

  return {
    valid,
    turnCount,
    charCount,
    dialogues
  };
}

/**
 * 根据条件筛选片段，返回优先级排序的结果
 * 优先级：优先选择轮次和字符数都符合条件的，如果不足则放宽条件
 */
export function filterAndRankSnippets(
  contexts: string[],
  targetCount: number = 10,
  minTurns: number = 5,
  maxTurns: number = 10,
  maxChars: number = 2000
): Array<{
  context: string;
  dialogues: DialogueMessage[];
  turnCount: number;
  charCount: number;
  priority: 'high' | 'low';
}> {
  const results: Array<{
    context: string;
    dialogues: DialogueMessage[];
    turnCount: number;
    charCount: number;
    priority: 'high' | 'low';
  }> = [];

  // 第一遍：收集符合所有条件的片段
  const highPriority: typeof results = [];
  const lowPriority: typeof results = [];

  for (const context of contexts) {
    const validation = isValidSnippet(context, minTurns, maxTurns, maxChars);

    if (validation.valid) {
      highPriority.push({
        context,
        dialogues: validation.dialogues,
        turnCount: validation.turnCount,
        charCount: validation.charCount,
        priority: 'high'
      });
    } else {
      lowPriority.push({
        context,
        dialogues: validation.dialogues,
        turnCount: validation.turnCount,
        charCount: validation.charCount,
        priority: 'low'
      });
    }
  }

  // 优先添加符合条件的片段
  results.push(...highPriority);

  // 如果不足目标数量，添加不符合条件的片段
  if (results.length < targetCount) {
    results.push(...lowPriority.slice(0, targetCount - results.length));
  }

  // 只返回目标数量
  return results.slice(0, targetCount);
}
