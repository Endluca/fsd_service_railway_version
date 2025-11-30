/**
 * 周会话总数管理服务
 * 用于红线对比功能的会话总数存储和查询
 */

import prisma from '../../config/prisma';

interface ConversationCountData {
  weekStart: Date;
  weekEnd: Date;
  department: string;
  conversationCount: number;
}

const conversationCountService = {
  /**
   * 批量插入或更新会话总数
   * @param data 会话总数数组
   * @returns 受影响的记录数
   */
  async upsertCounts(data: ConversationCountData[]): Promise<number> {
    let count = 0;

    for (const item of data) {
      await prisma.weekConversationCount.upsert({
        where: {
          weekStart_weekEnd_department: {
            weekStart: item.weekStart,
            weekEnd: item.weekEnd,
            department: item.department,
          },
        },
        update: {
          conversationCount: item.conversationCount,
          updatedAt: new Date(),
        },
        create: {
          weekStart: item.weekStart,
          weekEnd: item.weekEnd,
          department: item.department,
          conversationCount: item.conversationCount,
        },
      });
      count++;
    }

    return count;
  },

  /**
   * 查询指定周范围的会话总数
   * @param weekStarts 周开始日期数组
   * @param weekEnds 周结束日期数组
   * @param departments 可选的部门筛选
   * @returns 会话总数记录数组
   */
  async getCounts(
    weekStarts: Date[],
    weekEnds: Date[],
    departments?: string[]
  ) {
    const weekConditions = weekStarts.map((start, i) => ({
      weekStart: start,
      weekEnd: weekEnds[i],
    }));

    return prisma.weekConversationCount.findMany({
      where: {
        OR: weekConditions,
        ...(departments?.length ? { department: { in: departments } } : {}),
      },
      orderBy: [
        { weekStart: 'asc' },
        { department: 'asc' },
      ],
    });
  },

  /**
   * 删除指定周范围的会话总数记录
   * @param weekStart 周开始日期
   * @param weekEnd 周结束日期
   * @returns 删除的记录数
   */
  async deleteCounts(weekStart: Date, weekEnd: Date): Promise<number> {
    const result = await prisma.weekConversationCount.deleteMany({
      where: {
        weekStart,
        weekEnd,
      },
    });

    return result.count;
  },
};

export default conversationCountService;
