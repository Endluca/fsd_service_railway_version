/**
 * 愤怒小鸟统计服务
 * 负责查询、统计和数据分析
 */

import { PrismaClient, Prisma } from '@prisma/client';
import type { Department, EmotionStat, AngryBirdDetail } from '../../types/angrybird';

const prisma = new PrismaClient();

class StatisticsService {
  /**
   * 获取销售列表（第一次查询后的筛选项）
   */
  async getSalesList(
    weekStarts: Date[],
    weekEnds: Date[],
    department?: Department
  ): Promise<string[]> {
    const where: Prisma.AngryBirdRecordWhereInput = {
      OR: weekStarts.map((start, i) => ({
        weekStart: start,
        weekEnd: weekEnds[i],
      })),
    };

    if (department) {
      where.department = department;
    }

    const result = await prisma.angryBirdRecord.findMany({
      where,
      select: { sales: true },
      distinct: ['sales'],
      orderBy: { sales: 'asc' },
    });

    return result.map(r => r.sales);
  }

  /**
   * 获取客户情绪统计
   */
  async getEmotionStats(
    weekStarts: Date[],
    weekEnds: Date[],
    department?: Department,
    sales?: string[]
  ): Promise<{ stats: EmotionStat[]; totalRecords: number }> {
    const where: Prisma.AngryBirdRecordWhereInput = {
      OR: weekStarts.map((start, i) => ({
        weekStart: start,
        weekEnd: weekEnds[i],
      })),
    };

    if (department) {
      where.department = department;
    }

    if (sales && sales.length > 0) {
      where.sales = { in: sales };
    }

    // 获取总记录数
    const totalRecords = await prisma.angryBirdRecord.count({ where });

    // 按情绪分组统计
    const emotionGroups = await prisma.angryBirdRecord.groupBy({
      by: ['customerEmotion'],
      where,
      _count: { id: true },
      orderBy: {
        _count: { id: 'desc' },
      },
    });

    const stats: EmotionStat[] = emotionGroups.map(group => ({
      emotion: group.customerEmotion,
      count: group._count.id,
      percentage: totalRecords > 0 ? (group._count.id / totalRecords) * 100 : 0,
    }));

    return { stats, totalRecords };
  }

  /**
   * 获取详情列表（分页）
   */
  async getDetails(
    weekStarts: Date[],
    weekEnds: Date[],
    department?: Department,
    sales?: string[],
    page: number = 1,
    pageSize: number = 10
  ): Promise<{ details: AngryBirdDetail[]; total: number }> {
    const where: Prisma.AngryBirdRecordWhereInput = {
      OR: weekStarts.map((start, i) => ({
        weekStart: start,
        weekEnd: weekEnds[i],
      })),
    };

    if (department) {
      where.department = department;
    }

    if (sales && sales.length > 0) {
      where.sales = { in: sales };
    }

    const [records, total] = await Promise.all([
      prisma.angryBirdRecord.findMany({
        where,
        select: {
          conversationId: true,
          conversationStartTime: true,
          customer: true,
          sales: true,
          originalDepartment: true,
          customerEmotion: true,
          content: true,
        },
        orderBy: {
          conversationStartTime: 'desc',
        },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      prisma.angryBirdRecord.count({ where }),
    ]);

    const details: AngryBirdDetail[] = records.map(r => ({
      conversationId: r.conversationId,
      conversationStartTime: r.conversationStartTime.toISOString().replace('T', ' ').substring(0, 19),
      customer: r.customer,
      sales: r.sales,
      originalDepartment: r.originalDepartment,
      customerEmotion: r.customerEmotion,
      content: r.content,
    }));

    return { details, total };
  }
}

export default new StatisticsService();
