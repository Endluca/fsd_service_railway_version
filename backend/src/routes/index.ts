import express, { Request, Response } from 'express';
import dataService from '../services/dataService';
import scheduler from '../services/scheduler';
import dataCollector from '../services/dataCollector';
import trendService from '../services/trendService';
import topicminingRoutes from './topicmining';
import redlineRoutes from './redline';

const router = express.Router();

/**
 * 解析查询参数为数组
 * 支持逗号分隔的字符串和重复的查询参数
 */
function parseArrayParam(param: string | string[] | undefined): string[] | undefined {
  if (!param) return undefined;

  if (Array.isArray(param)) {
    return param;
  }

  // 逗号分隔的字符串
  return param.split(',').map(s => s.trim()).filter(Boolean);
}

/**
 * 查询数据看板
 * GET /api/dashboard
 * Query params: startDate, endDate, groupNames (optional, comma-separated), openUserIds (optional, comma-separated)
 */
router.get('/dashboard', async (req: Request, res: Response) => {
  try {
    const { startDate, endDate, groupNames, openUserIds } = req.query;

    if (!startDate || !endDate) {
      return res.status(400).json({
        code: 400,
        message: '缺少必需参数: startDate, endDate',
      });
    }

    const groupNamesArray = parseArrayParam(groupNames as string | string[] | undefined);
    const openUserIdsArray = parseArrayParam(openUserIds as string | string[] | undefined);

    const results = await dataService.queryDateRange(
      startDate as string,
      endDate as string,
      groupNamesArray,
      openUserIdsArray
    );

    res.json({
      code: 0,
      message: 'success',
      data: results,
    });
  } catch (error: any) {
    console.error('查询失败:', error);
    res.status(500).json({
      code: 500,
      message: error.message || '服务器错误',
    });
  }
});

/**
 * 获取所有小组列表
 * GET /api/groups
 */
router.get('/groups', async (req: Request, res: Response) => {
  try {
    const groups = await dataService.getGroups();
    res.json({
      code: 0,
      message: 'success',
      data: groups,
    });
  } catch (error: any) {
    console.error('获取小组列表失败:', error);
    res.status(500).json({
      code: 500,
      message: error.message || '服务器错误',
    });
  }
});

/**
 * 获取销售列表
 * GET /api/sales
 * Query params: groupNames (optional, comma-separated), startDate (optional), endDate (optional)
 * 当提供 startDate 和 endDate 时，只返回该时间范围内有数据的销售
 */
router.get('/sales', async (req: Request, res: Response) => {
  try {
    const { groupNames, startDate, endDate } = req.query;
    const groupNamesArray = parseArrayParam(groupNames as string | string[] | undefined);

    const sales = await dataService.getSalesList(
      groupNamesArray,
      startDate as string | undefined,
      endDate as string | undefined
    );
    res.json({
      code: 0,
      message: 'success',
      data: sales,
    });
  } catch (error: any) {
    console.error('获取销售列表失败:', error);
    res.status(500).json({
      code: 500,
      message: error.message || '服务器错误',
    });
  }
});

/**
 * 手动触发数据采集
 * POST /api/collect
 * Body: { date?: string } (可选，默认采集昨天的数据)
 */
router.post('/collect', async (req: Request, res: Response) => {
  try {
    const { date } = req.body;

    if (date) {
      await dataCollector.collectDataForDate(date);
    } else {
      await scheduler.runNow();
    }

    res.json({
      code: 0,
      message: '数据采集完成',
    });
  } catch (error: any) {
    console.error('数据采集失败:', error);
    res.status(500).json({
      code: 500,
      message: error.message || '数据采集失败',
    });
  }
});

/**
 * 批量采集日期范围数据
 * POST /api/collect-range
 * Body: { startDate: string, endDate: string }
 * 例如: { "startDate": "2024-11-01", "endDate": "2024-11-25" }
 *
 * 实际采集时间范围：
 * - 开始时间：startDate 02:00:00
 * - 结束时间：(endDate + 1天) 02:00:00
 * 例如：2024-11-01 02:00:00 ~ 2024-11-26 02:00:00
 */
router.post('/collect-range', async (req: Request, res: Response) => {
  try {
    const { startDate, endDate } = req.body;

    // 参数验证
    if (!startDate || !endDate) {
      return res.status(400).json({
        code: 400,
        message: '缺少必需参数: startDate, endDate',
      });
    }

    // 执行批量采集
    const result = await dataCollector.collectDataForRange(startDate, endDate);

    res.json({
      code: 0,
      message: '批量数据采集完成',
      data: result,
    });
  } catch (error: any) {
    console.error('批量数据采集失败:', error);
    res.status(500).json({
      code: 500,
      message: error.message || '批量数据采集失败',
    });
  }
});

/**
 * 获取趋势数据
 * GET /api/trend
 * Query params:
 *   - startDate: 开始日期 (YYYY-MM-DD)
 *   - endDate: 结束日期 (YYYY-MM-DD)
 *   - granularity: 时间颗粒度 ('day' | 'week')
 *   - comparisonType: 对比类型 ('all' | 'group' | 'person')
 *   - groupName: 小组名称 (当 comparisonType='person' 时必填)
 *   - metric: 指标类型 ('timelyReplyRate' | 'overtimeReplyRate' | 'avgReplyDuration' | 'conversationCount')
 */
router.get('/trend', async (req: Request, res: Response) => {
  try {
    const { startDate, endDate, granularity, comparisonType, groupName, metric } = req.query;

    // 参数验证
    if (!startDate || !endDate || !granularity || !comparisonType || !metric) {
      return res.status(400).json({
        code: 400,
        message: '缺少必需参数: startDate, endDate, granularity, comparisonType, metric',
      });
    }

    if (comparisonType === 'person' && !groupName) {
      return res.status(400).json({
        code: 400,
        message: '选择个人对比时必须指定 groupName',
      });
    }

    const trendData = await trendService.getTrendData({
      startDate: startDate as string,
      endDate: endDate as string,
      granularity: granularity as 'day' | 'week',
      comparisonType: comparisonType as 'all' | 'group' | 'person',
      groupName: groupName as string | undefined,
      metric: metric as 'timelyReplyRate' | 'overtimeReplyRate' | 'avgReplyDuration' | 'conversationCount',
    });

    res.json({
      code: 0,
      message: 'success',
      data: trendData,
    });
  } catch (error: any) {
    console.error('获取趋势数据失败:', error);
    res.status(500).json({
      code: 500,
      message: error.message || '服务器错误',
    });
  }
});

/**
 * 获取可用的日期范围
 * GET /api/trend/date-range
 */
router.get('/trend/date-range', async (req: Request, res: Response) => {
  try {
    const dateRange = await trendService.getAvailableDateRange();

    res.json({
      code: 0,
      message: 'success',
      data: dateRange,
    });
  } catch (error: any) {
    console.error('获取日期范围失败:', error);
    res.status(500).json({
      code: 500,
      message: error.message || '服务器错误',
    });
  }
});

/**
 * TopicMining 话题挖掘路由
 * /api/topicmining/*
 */
router.use('/topicmining', topicminingRoutes);

/**
 * RedLine 红线看板路由
 * /api/redline/*
 */
router.use('/redline', redlineRoutes);

/**
 * 健康检查
 * GET /api/health
 */
router.get('/health', (req: Request, res: Response) => {
  res.json({
    code: 0,
    message: 'OK',
    data: {
      status: 'healthy',
      timestamp: new Date().toISOString(),
    },
  });
});

export default router;
