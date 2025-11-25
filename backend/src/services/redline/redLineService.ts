/**
 * 红线数据管理服务
 * 负责数据导入、查询、删除等操作
 */

import { PrismaClient } from '@prisma/client';
import type {
  ParsedRedLineRow,
  WeekRange,
  CheckWeekResult,
  WeekItem,
} from '../../types/redline';

const prisma = new PrismaClient();

/**
 * 验证周日期范围
 * 开始日期必须是周一，结束日期必须是周日，且间隔6天
 */
export function validateWeekRange(start: Date, end: Date): boolean {
  const dayOfWeekStart = start.getDay(); // 0=Sunday, 1=Monday, ...
  const dayOfWeekEnd = end.getDay();

  // 检查开始日期是周一，结束日期是周日
  if (dayOfWeekStart !== 1 || dayOfWeekEnd !== 0) {
    return false;
  }

  // 检查间隔是6天
  const diffMs = end.getTime() - start.getTime();
  const diffDays = diffMs / (1000 * 60 * 60 * 24);

  return diffDays === 6;
}

/**
 * 检查指定周是否已有数据
 */
export async function checkWeekExists(weekStart: Date, weekEnd: Date): Promise<CheckWeekResult> {
  const count = await prisma.redLineRecord.count({
    where: {
      weekStart,
      weekEnd,
    },
  });

  if (count > 0) {
    return {
      exists: true,
      recordCount: count,
      weekStart: weekStart.toISOString().split('T')[0],
      weekEnd: weekEnd.toISOString().split('T')[0],
    };
  }

  return {
    exists: false,
  };
}

/**
 * 批量导入红线数据
 * @param data 解析后的数据
 * @param weekRange 周范围
 * @param replace 是否替换已有数据（默认false）
 */
export async function importData(
  data: ParsedRedLineRow[],
  weekRange: WeekRange,
  replace: boolean = false
): Promise<{ success: boolean; imported: number; message?: string }> {
  try {
    const { weekStart, weekEnd } = weekRange;

    // 使用事务处理
    const result = await prisma.$transaction(async (tx) => {
      // 如果需要替换，先删除该周的所有数据
      if (replace) {
        await tx.redLineRecord.deleteMany({
          where: {
            weekStart,
            weekEnd,
          },
        });
      } else {
        // 如果不替换，事务级别检查是否已有数据
        const existingCount = await tx.redLineRecord.count({
          where: {
            weekStart,
            weekEnd,
          },
        });

        if (existingCount > 0) {
          throw new Error(`该周已有 ${existingCount} 条数据，无法导入`);
        }
      }

      // 批量插入数据
      // skipDuplicates 设为 false，确保事务全部成功或全部失败
      const created = await tx.redLineRecord.createMany({
        data: data.map(row => ({
          conversationId: row.conversationId,
          customer: row.customer,
          sales: row.sales,
          department: row.department,
          originalDepartment: row.originalDepartment,
          redLineType: row.redLineType,
          content: row.content,
          weekStart,
          weekEnd,
        })),
        skipDuplicates: false, // 不跳过重复，确保数据完整性
      });

      return created.count;
    });

    return {
      success: true,
      imported: result,
      message: `成功导入 ${result} 条红线记录`,
    };
  } catch (error) {
    console.error('导入数据失败:', error);
    return {
      success: false,
      imported: 0,
      message: `导入失败: ${error instanceof Error ? error.message : '未知错误'}`,
    };
  }
}

/**
 * 获取所有已有数据的周列表
 */
export async function getWeekList(): Promise<WeekItem[]> {
  const records = await prisma.redLineRecord.groupBy({
    by: ['weekStart', 'weekEnd'],
    _count: {
      id: true,
    },
    orderBy: {
      weekStart: 'desc',
    },
  });

  return records.map(record => ({
    weekStart: record.weekStart.toISOString().split('T')[0],
    weekEnd: record.weekEnd.toISOString().split('T')[0],
    recordCount: record._count.id,
  }));
}

/**
 * 获取指定条件下的销售列表
 */
export async function getSalesList(
  weekStarts: Date[],
  weekEnds: Date[],
  department?: string
): Promise<string[]> {
  // 构建 OR 条件：weekStart 和 weekEnd 必须成对匹配
  const weekConditions = weekStarts.map((start, index) => ({
    weekStart: start,
    weekEnd: weekEnds[index],
  }));

  const records = await prisma.redLineRecord.findMany({
    where: {
      OR: weekConditions,
      ...(department ? { department } : {}),
    },
    select: {
      sales: true,
    },
    distinct: ['sales'],
    orderBy: {
      sales: 'asc',
    },
  });

  return records.map(r => r.sales);
}

const redLineService = {
  validateWeekRange,
  checkWeekExists,
  importData,
  getWeekList,
  getSalesList,
};

export default redLineService;
