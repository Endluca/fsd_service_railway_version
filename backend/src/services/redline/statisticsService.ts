/**
 * 红线统计查询服务
 * 负责统计计算和详情查询
 */

import { PrismaClient } from '@prisma/client';
import type {
  StatisticsResult,
  RedLineTypeStat,
  DetailsResult,
  RedLineDetail,
} from '../../types/redline';

const prisma = new PrismaClient();

/**
 * 查询统计数据
 * @param weekStarts 周开始日期数组
 * @param weekEnds 周结束日期数组
 * @param department 部门筛选（可选）
 * @param sales 销售筛选（可选）
 */
export async function getStatistics(
  weekStarts: Date[],
  weekEnds: Date[],
  department?: string,
  sales?: string
): Promise<StatisticsResult> {
  // 构建 OR 条件：weekStart 和 weekEnd 必须成对匹配
  const weekConditions = weekStarts.map((start, index) => ({
    weekStart: start,
    weekEnd: weekEnds[index],
  }));

  // 查询所有符合条件的记录
  const records = await prisma.redLineRecord.findMany({
    where: {
      OR: weekConditions,
      ...(department ? { department } : {}),
      ...(sales ? { sales } : {}),
    },
    select: {
      conversationId: true,
      redLineType: true,
    },
  });

  // 总会话数（按会话ID去重）
  const uniqueConversations = new Set(records.map(r => r.conversationId));
  const totalConversations = uniqueConversations.size;

  // 总红线数
  const totalViolations = records.length;

  // 按红线类型分组统计
  const typeMap = new Map<string, {
    count: number;
    conversations: Set<string>;
  }>();

  for (const record of records) {
    const { redLineType, conversationId } = record;

    if (!typeMap.has(redLineType)) {
      typeMap.set(redLineType, {
        count: 0,
        conversations: new Set(),
      });
    }

    const stat = typeMap.get(redLineType)!;
    stat.count++;
    stat.conversations.add(conversationId);
  }

  // 转换为结果格式
  const stats: RedLineTypeStat[] = Array.from(typeMap.entries()).map(([redLineType, data]) => ({
    redLineType,
    violationCount: data.count,
    violationConversationCount: data.conversations.size,
    percentageOfTotal: totalViolations > 0 ? (data.count / totalViolations) * 100 : 0,
    percentageOfConversations: totalConversations > 0
      ? (data.conversations.size / totalConversations) * 100
      : 0,
  }));

  // 按违规数量降序排序
  stats.sort((a, b) => b.violationCount - a.violationCount);

  return {
    stats,
    totalViolations,
    totalConversations,
  };
}

/**
 * 查询红线详情（支持分页）
 * @param weekStarts 周开始日期数组
 * @param weekEnds 周结束日期数组
 * @param redLineType 红线类型
 * @param department 部门筛选（可选）
 * @param sales 销售筛选（可选）
 * @param page 页码（从1开始）
 * @param pageSize 每页数量
 */
export async function getDetails(
  weekStarts: Date[],
  weekEnds: Date[],
  redLineType: string,
  department: string | undefined,
  sales: string | undefined,
  page: number,
  pageSize: number
): Promise<DetailsResult> {
  // 构建 OR 条件
  const weekConditions = weekStarts.map((start, index) => ({
    weekStart: start,
    weekEnd: weekEnds[index],
  }));

  // 构建查询条件
  const where = {
    OR: weekConditions,
    redLineType,
    ...(department ? { department } : {}),
    ...(sales ? { sales } : {}),
  };

  // 查询总数
  const total = await prisma.redLineRecord.count({ where });

  // 计算分页参数
  const skip = (page - 1) * pageSize;
  const totalPages = Math.ceil(total / pageSize);

  // 查询分页数据
  const records = await prisma.redLineRecord.findMany({
    where,
    select: {
      conversationId: true,
      customer: true,
      sales: true,
      originalDepartment: true,
      redLineType: true,
      content: true,
    },
    orderBy: {
      conversationId: 'asc',
    },
    skip,
    take: pageSize,
  });

  const details: RedLineDetail[] = records.map(r => ({
    conversationId: r.conversationId,
    customer: r.customer,
    sales: r.sales,
    originalDepartment: r.originalDepartment,
    redLineType: r.redLineType,
    content: r.content,
  }));

  return {
    details,
    total,
    page,
    pageSize,
    totalPages,
  };
}

const statisticsService = {
  getStatistics,
  getDetails,
};

export default statisticsService;
