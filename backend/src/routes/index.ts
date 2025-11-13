import express, { Request, Response } from 'express';
import dataService from '../services/dataService';
import scheduler from '../services/scheduler';
import dataCollector from '../services/dataCollector';

const router = express.Router();

/**
 * 查询数据看板
 * GET /api/dashboard
 * Query params: startDate, endDate, groupName (optional), openUserId (optional)
 */
router.get('/dashboard', async (req: Request, res: Response) => {
  try {
    const { startDate, endDate, groupName, openUserId } = req.query;

    if (!startDate || !endDate) {
      return res.status(400).json({
        code: 400,
        message: '缺少必需参数: startDate, endDate',
      });
    }

    const results = await dataService.queryDateRange(
      startDate as string,
      endDate as string,
      groupName as string | undefined,
      openUserId as string | undefined
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
 * Query params: groupName (optional)
 */
router.get('/sales', async (req: Request, res: Response) => {
  try {
    const { groupName } = req.query;
    const sales = await dataService.getSalesList(groupName as string | undefined);
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
