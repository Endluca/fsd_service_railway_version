/**
 * 愤怒小鸟 API 路由
 */

import express from 'express';
import multer from 'multer';
import { parseXlsxFile } from '../../services/angrybird/xlsxParser';
import angryBirdService from '../../services/angrybird/angryBirdService';
import statisticsService from '../../services/angrybird/statisticsService';

const router = express.Router();

// 文件上传配置
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB
  fileFilter: (req, file, cb) => {
    if (file.originalname.endsWith('.xlsx')) {
      cb(null, true);
    } else {
      cb(new Error('只支持 .xlsx 格式的文件'));
    }
  },
});

/**
 * POST /api/angrybird/upload
 * 上传并导入数据
 */
router.post('/upload', upload.single('file'), async (req, res) => {
  try {
    const file = req.file;
    if (!file) {
      return res.json({ code: 1, message: '未选择文件' });
    }

    const { weekStart, weekEnd, replace } = req.body;
    if (!weekStart || !weekEnd) {
      return res.json({ code: 1, message: '缺少日期范围参数' });
    }

    const weekStartDate = new Date(weekStart);
    const weekEndDate = new Date(weekEnd);

    // 验证是否为完整的一周（周一到周日）
    const startDay = weekStartDate.getDay();
    const endDay = weekEndDate.getDay();
    const daysDiff = Math.floor((weekEndDate.getTime() - weekStartDate.getTime()) / (1000 * 60 * 60 * 24));

    if (startDay !== 1 || endDay !== 0 || daysDiff !== 6) {
      return res.json({
        code: 1,
        message: '日期范围必须是完整的一周（周一到周日）',
      });
    }

    // 解析 Excel 文件
    const parseResult = parseXlsxFile(file.buffer);
    if (!parseResult.success) {
      return res.json({
        code: 1,
        message: parseResult.message,
        data: { errors: parseResult.errors },
      });
    }

    // 检查该周是否已有数据
    const existsCheck = await angryBirdService.checkWeekExists(weekStartDate, weekEndDate);

    if (existsCheck.exists && replace !== 'true') {
      // 返回特殊代码，前端弹出确认对话框
      return res.json({
        code: 2,
        message: '该周已有数据',
        data: { recordCount: existsCheck.recordCount },
      });
    }

    // 导入数据
    const importResult = await angryBirdService.importData(
      parseResult.data!,
      { weekStart: weekStartDate, weekEnd: weekEndDate },
      replace === 'true'
    );

    return res.json({
      code: 0,
      message: '导入成功',
      data: importResult,
    });
  } catch (error) {
    console.error('上传失败:', error);
    return res.json({
      code: 1,
      message: error instanceof Error ? error.message : '上传失败',
    });
  }
});

/**
 * GET /api/angrybird/weeks
 * 获取已导入数据的周列表
 */
router.get('/weeks', async (req, res) => {
  try {
    const weeks = await angryBirdService.getWeekList();
    return res.json({ code: 0, data: weeks });
  } catch (error) {
    console.error('获取周列表失败:', error);
    return res.json({ code: 1, message: '获取周列表失败' });
  }
});

/**
 * GET /api/angrybird/sales-list
 * 获取销售列表（用于二次筛选）
 */
router.get('/sales-list', async (req, res) => {
  try {
    const { weekStarts, weekEnds, department } = req.query;

    if (!weekStarts || !weekEnds) {
      return res.json({ code: 1, message: '缺少日期范围参数' });
    }

    const weekStartDates = (weekStarts as string).split(',').map(d => new Date(d));
    const weekEndDates = (weekEnds as string).split(',').map(d => new Date(d));

    const salesList = await statisticsService.getSalesList(
      weekStartDates,
      weekEndDates,
      department as any
    );

    return res.json({ code: 0, data: salesList });
  } catch (error) {
    console.error('获取销售列表失败:', error);
    return res.json({ code: 1, message: '获取销售列表失败' });
  }
});

/**
 * GET /api/angrybird/emotion-stats
 * 获取客户情绪统计
 */
router.get('/emotion-stats', async (req, res) => {
  try {
    const { weekStarts, weekEnds, department, sales } = req.query;

    if (!weekStarts || !weekEnds) {
      return res.json({ code: 1, message: '缺少日期范围参数' });
    }

    const weekStartDates = (weekStarts as string).split(',').map(d => new Date(d));
    const weekEndDates = (weekEnds as string).split(',').map(d => new Date(d));
    const salesArray = sales ? (sales as string).split(',') : undefined;

    const result = await statisticsService.getEmotionStats(
      weekStartDates,
      weekEndDates,
      department as any,
      salesArray
    );

    return res.json({ code: 0, data: result });
  } catch (error) {
    console.error('获取情绪统计失败:', error);
    return res.json({ code: 1, message: '获取情绪统计失败' });
  }
});

/**
 * GET /api/angrybird/details
 * 获取详情列表（分页）
 */
router.get('/details', async (req, res) => {
  try {
    const { weekStarts, weekEnds, department, sales, page = '1', pageSize = '10' } = req.query;

    if (!weekStarts || !weekEnds) {
      return res.json({ code: 1, message: '缺少日期范围参数' });
    }

    const weekStartDates = (weekStarts as string).split(',').map(d => new Date(d));
    const weekEndDates = (weekEnds as string).split(',').map(d => new Date(d));
    const salesArray = sales ? (sales as string).split(',') : undefined;

    const result = await statisticsService.getDetails(
      weekStartDates,
      weekEndDates,
      department as any,
      salesArray,
      parseInt(page as string),
      parseInt(pageSize as string)
    );

    return res.json({ code: 0, data: result });
  } catch (error) {
    console.error('获取详情失败:', error);
    return res.json({ code: 1, message: '获取详情失败' });
  }
});

export default router;
