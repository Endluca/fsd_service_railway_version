/**
 * 愤怒小鸟核心业务服务
 * 负责数据导入、检查、删除等核心业务逻辑
 */

import { PrismaClient } from '@prisma/client';
import type { ParsedAngryBirdRow, WeekItem } from '../../types/angrybird';

const prisma = new PrismaClient();

class AngryBirdService {
  /**
   * 检查指定周是否已有数据
   */
  async checkWeekExists(weekStart: Date, weekEnd: Date): Promise<{ exists: boolean; recordCount: number }> {
    const count = await prisma.angryBirdRecord.count({
      where: {
        weekStart,
        weekEnd,
      },
    });

    return {
      exists: count > 0,
      recordCount: count,
    };
  }

  /**
   * 删除指定周的所有数据（用于覆盖）
   */
  async deleteWeekData(weekStart: Date, weekEnd: Date): Promise<number> {
    const result = await prisma.angryBirdRecord.deleteMany({
      where: {
        weekStart,
        weekEnd,
      },
    });

    console.log(`删除了 ${result.count} 条记录 (周: ${weekStart.toISOString().split('T')[0]} ~ ${weekEnd.toISOString().split('T')[0]})`);
    return result.count;
  }

  /**
   * 批量导入数据
   */
  async importData(
    data: ParsedAngryBirdRow[],
    weekRange: { weekStart: Date; weekEnd: Date },
    replace: boolean = false
  ): Promise<{ importedCount: number; totalRecords: number }> {
    const { weekStart, weekEnd } = weekRange;

    // 如果是覆盖模式，先删除旧数据
    if (replace) {
      await this.deleteWeekData(weekStart, weekEnd);
    }

    // 批量插入新数据
    const records = data.map(row => ({
      conversationId: row.conversationId,
      conversationStartTime: row.conversationStartTime,
      customer: row.customer,
      sales: row.sales,
      department: row.department,
      originalDepartment: row.originalDepartment,
      customerEmotion: row.customerEmotion,
      content: row.content,
      weekStart,
      weekEnd,
    }));

    const result = await prisma.angryBirdRecord.createMany({
      data: records,
      skipDuplicates: true,
    });

    console.log(`成功导入 ${result.count} 条记录 (周: ${weekStart.toISOString().split('T')[0]} ~ ${weekEnd.toISOString().split('T')[0]})`);

    return {
      importedCount: result.count,
      totalRecords: data.length,
    };
  }

  /**
   * 获取所有已导入数据的周列表
   */
  async getWeekList(): Promise<WeekItem[]> {
    const weeks = await prisma.angryBirdRecord.groupBy({
      by: ['weekStart', 'weekEnd'],
      _count: { id: true },
      orderBy: {
        weekStart: 'desc',
      },
    });

    return weeks.map(w => ({
      weekStart: w.weekStart.toISOString().split('T')[0],
      weekEnd: w.weekEnd.toISOString().split('T')[0],
      recordCount: w._count.id,
    }));
  }
}

export default new AngryBirdService();
