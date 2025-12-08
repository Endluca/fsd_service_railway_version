/**
 * 红线看板路由
 */

import express from 'express';
import multer from 'multer';
import { parseXlsxFile } from '../../services/redline/xlsxParser';
import redLineService from '../../services/redline/redLineService';
import statisticsService from '../../services/redline/statisticsService';
import conversationCountService from '../../services/redline/conversationCountService';
import comparisonService from '../../services/redline/comparisonService';

const router = express.Router();

// 配置 multer 用于文件上传（内存存储）
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB 限制
  },
  fileFilter: (req, file, cb) => {
    // 只允许 xlsx 文件
    if (
      file.mimetype === 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' ||
      file.originalname.endsWith('.xlsx')
    ) {
      cb(null, true);
    } else {
      cb(new Error('只支持 .xlsx 格式的文件'));
    }
  },
});

/**
 * POST /api/redline/upload
 * 上传并导入红线数据
 */
router.post('/upload', upload.single('file'), async (req, res) => {
  try {
    const file = req.file;
    const { weekStart, weekEnd, replace, ccConversationCount, lpConversationCount, ssConversationCount } = req.body;

    // 验证文件
    if (!file) {
      return res.json({
        code: 1,
        message: '请上传文件',
      });
    }

    // 验证参数
    if (!weekStart || !weekEnd) {
      return res.json({
        code: 1,
        message: '请指定周范围（weekStart 和 weekEnd）',
      });
    }

    // 解析日期
    const weekStartDate = new Date(weekStart);
    const weekEndDate = new Date(weekEnd);

    // 验证日期格式
    if (isNaN(weekStartDate.getTime()) || isNaN(weekEndDate.getTime())) {
      return res.json({
        code: 1,
        message: '日期格式错误',
      });
    }

    // 验证周范围
    if (!redLineService.validateWeekRange(weekStartDate, weekEndDate)) {
      return res.json({
        code: 1,
        message: '时间范围必须是完整的一周（周一到周日）',
      });
    }

    // 验证会话总数: 必须填写所有部门的会话总数
    const conversationCounts = [];
    if (ccConversationCount) {
      const count = parseInt(ccConversationCount);
      if (isNaN(count) || count <= 0) {
        return res.json({
          code: 1,
          message: 'CC会话总数必须是正整数',
        });
      }
      conversationCounts.push({
        weekStart: weekStartDate,
        weekEnd: weekEndDate,
        department: 'cc',
        conversationCount: count,
      });
    }
    if (lpConversationCount) {
      const count = parseInt(lpConversationCount);
      if (isNaN(count) || count <= 0) {
        return res.json({
          code: 1,
          message: 'LP会话总数必须是正整数',
        });
      }
      conversationCounts.push({
        weekStart: weekStartDate,
        weekEnd: weekEndDate,
        department: 'lp',
        conversationCount: count,
      });
    }
    if (ssConversationCount) {
      const count = parseInt(ssConversationCount);
      if (isNaN(count) || count <= 0) {
        return res.json({
          code: 1,
          message: 'SS会话总数必须是正整数',
        });
      }
      conversationCounts.push({
        weekStart: weekStartDate,
        weekEnd: weekEndDate,
        department: 'ss',
        conversationCount: count,
      });
    }

    if (conversationCounts.length !== 3) {
      return res.json({
        code: 1,
        message: '请填写所有部门（CC、SS、LP）的会话总数',
      });
    }

    // 检查该周是否已有数据（如果不是替换模式）
    // 提前检查，避免解析大文件后才发现数据已存在
    if (replace !== 'true' && replace !== true) {
      const checkResult = await redLineService.checkWeekExists(weekStartDate, weekEndDate);
      if (checkResult.exists) {
        return res.json({
          code: 2, // 特殊代码表示需要确认
          message: '该周已有数据',
          data: checkResult,
        });
      }
    }

    // 解析 Excel 文件
    const parseResult = parseXlsxFile(file.buffer);

    if (!parseResult.success) {
      return res.json({
        code: 1,
        message: parseResult.message,
        data: {
          errors: parseResult.errors,
        },
      });
    }

    // 导入数据 - 在事务中同时处理红线记录和会话总数
    const importResult = await redLineService.importData(
      parseResult.data!,
      { weekStart: weekStartDate, weekEnd: weekEndDate },
      replace === 'true' || replace === true
    );

    if (!importResult.success) {
      return res.json({
        code: 1,
        message: importResult.message,
      });
    }

    // 导入会话总数
    const conversationCountResult = await conversationCountService.upsertCounts(conversationCounts);

    return res.json({
      code: 0,
      message: '导入成功',
      data: {
        imported: importResult.imported,
        conversationCountsUpserted: conversationCountResult,
        weekStart,
        weekEnd,
      },
    });
  } catch (error) {
    console.error('上传文件失败:', error);
    return res.json({
      code: 1,
      message: error instanceof Error ? error.message : '上传失败',
    });
  }
});

/**
 * POST /api/redline/check-week
 * 检查指定周是否已有数据
 */
router.post('/check-week', async (req, res) => {
  try {
    const { weekStart, weekEnd } = req.body;

    if (!weekStart || !weekEnd) {
      return res.json({
        code: 1,
        message: '请指定周范围',
      });
    }

    const weekStartDate = new Date(weekStart);
    const weekEndDate = new Date(weekEnd);

    if (isNaN(weekStartDate.getTime()) || isNaN(weekEndDate.getTime())) {
      return res.json({
        code: 1,
        message: '日期格式错误',
      });
    }

    if (!redLineService.validateWeekRange(weekStartDate, weekEndDate)) {
      return res.json({
        code: 1,
        message: '时间范围必须是完整的一周',
      });
    }

    const result = await redLineService.checkWeekExists(weekStartDate, weekEndDate);

    return res.json({
      code: 0,
      data: result,
    });
  } catch (error) {
    console.error('检查周数据失败:', error);
    return res.json({
      code: 1,
      message: error instanceof Error ? error.message : '检查失败',
    });
  }
});

/**
 * GET /api/redline/weeks
 * 获取已有数据的周列表
 */
router.get('/weeks', async (req, res) => {
  try {
    const weeks = await redLineService.getWeekList();

    return res.json({
      code: 0,
      data: weeks,
    });
  } catch (error) {
    console.error('获取周列表失败:', error);
    return res.json({
      code: 1,
      message: error instanceof Error ? error.message : '查询失败',
    });
  }
});

/**
 * GET /api/redline/sales-list
 * 获取销售列表
 * Query 参数: weekStarts[], weekEnds[], department?
 */
router.get('/sales-list', async (req, res) => {
  try {
    const { weekStarts, weekEnds, department } = req.query;

    // 参数验证
    if (!weekStarts || !weekEnds) {
      return res.json({
        code: 1,
        message: '请指定周范围',
      });
    }

    // 转换为数组
    const weekStartArray = Array.isArray(weekStarts) ? weekStarts : [weekStarts];
    const weekEndArray = Array.isArray(weekEnds) ? weekEnds : [weekEnds];

    if (weekStartArray.length !== weekEndArray.length) {
      return res.json({
        code: 1,
        message: '周开始和结束日期数量不匹配',
      });
    }

    // 解析日期
    const weekStartDates = weekStartArray.map(d => new Date(d as string));
    const weekEndDates = weekEndArray.map(d => new Date(d as string));

    // 验证日期
    for (let i = 0; i < weekStartDates.length; i++) {
      if (isNaN(weekStartDates[i].getTime()) || isNaN(weekEndDates[i].getTime())) {
        return res.json({
          code: 1,
          message: '日期格式错误',
        });
      }
    }

    const salesList = await redLineService.getSalesList(
      weekStartDates,
      weekEndDates,
      department as string | undefined
    );

    return res.json({
      code: 0,
      data: salesList,
    });
  } catch (error) {
    console.error('获取销售列表失败:', error);
    return res.json({
      code: 1,
      message: error instanceof Error ? error.message : '查询失败',
    });
  }
});

/**
 * GET /api/redline/statistics
 * 获取统计数据
 * Query 参数: weekStarts[], weekEnds[], department?, sales?
 */
router.get('/statistics', async (req, res) => {
  try {
    const { weekStarts, weekEnds, department, sales } = req.query;

    if (!weekStarts || !weekEnds) {
      return res.json({
        code: 1,
        message: '请指定周范围',
      });
    }

    const weekStartArray = Array.isArray(weekStarts) ? weekStarts : [weekStarts];
    const weekEndArray = Array.isArray(weekEnds) ? weekEnds : [weekEnds];

    if (weekStartArray.length !== weekEndArray.length) {
      return res.json({
        code: 1,
        message: '周开始和结束日期数量不匹配',
      });
    }

    const weekStartDates = weekStartArray.map(d => new Date(d as string));
    const weekEndDates = weekEndArray.map(d => new Date(d as string));

    for (let i = 0; i < weekStartDates.length; i++) {
      if (isNaN(weekStartDates[i].getTime()) || isNaN(weekEndDates[i].getTime())) {
        return res.json({
          code: 1,
          message: '日期格式错误',
        });
      }
    }

    const result = await statisticsService.getStatistics(
      weekStartDates,
      weekEndDates,
      department as string | undefined,
      sales as string | undefined
    );

    return res.json({
      code: 0,
      data: result,
    });
  } catch (error) {
    console.error('获取统计数据失败:', error);
    return res.json({
      code: 1,
      message: error instanceof Error ? error.message : '查询失败',
    });
  }
});

/**
 * GET /api/redline/details
 * 获取红线详情（分页）
 * Query 参数: weekStarts[], weekEnds[], redLineType, department?, sales?, page, pageSize
 */
router.get('/details', async (req, res) => {
  try {
    const { weekStarts, weekEnds, redLineType, department, sales, page, pageSize } = req.query;

    if (!weekStarts || !weekEnds || !redLineType) {
      return res.json({
        code: 1,
        message: '缺少必需参数',
      });
    }

    const weekStartArray = Array.isArray(weekStarts) ? weekStarts : [weekStarts];
    const weekEndArray = Array.isArray(weekEnds) ? weekEnds : [weekEnds];

    if (weekStartArray.length !== weekEndArray.length) {
      return res.json({
        code: 1,
        message: '周开始和结束日期数量不匹配',
      });
    }

    const weekStartDates = weekStartArray.map(d => new Date(d as string));
    const weekEndDates = weekEndArray.map(d => new Date(d as string));

    for (let i = 0; i < weekStartDates.length; i++) {
      if (isNaN(weekStartDates[i].getTime()) || isNaN(weekEndDates[i].getTime())) {
        return res.json({
          code: 1,
          message: '日期格式错误',
        });
      }
    }

    const pageNum = parseInt(page as string) || 1;
    const pageSizeNum = parseInt(pageSize as string) || 10;

    const result = await statisticsService.getDetails(
      weekStartDates,
      weekEndDates,
      redLineType as string,
      department as string | undefined,
      sales as string | undefined,
      pageNum,
      pageSizeNum
    );

    return res.json({
      code: 0,
      data: result,
    });
  } catch (error) {
    console.error('获取详情失败:', error);
    return res.json({
      code: 1,
      message: error instanceof Error ? error.message : '查询失败',
    });
  }
});

/**
 * GET /api/redline/comparison-trend
 * 获取红线对比趋势数据
 * Query 参数: weekStarts[], weekEnds[], departments[]?, redLineTypes[]?
 */
router.get('/comparison-trend', async (req, res) => {
  try {
    const { weekStarts, weekEnds, departments, redLineTypes } = req.query;

    // 参数验证
    if (!weekStarts || !weekEnds) {
      return res.json({
        code: 1,
        message: '请指定周范围',
      });
    }

    // 转换为数组
    const weekStartArray = Array.isArray(weekStarts) ? weekStarts : [weekStarts];
    const weekEndArray = Array.isArray(weekEnds) ? weekEnds : [weekEnds];

    if (weekStartArray.length !== weekEndArray.length) {
      return res.json({
        code: 1,
        message: '周开始和结束日期数量不匹配',
      });
    }

    // 解析日期
    const weekStartDates = weekStartArray.map(d => new Date(d as string));
    const weekEndDates = weekEndArray.map(d => new Date(d as string));

    // 验证日期
    for (let i = 0; i < weekStartDates.length; i++) {
      if (isNaN(weekStartDates[i].getTime()) || isNaN(weekEndDates[i].getTime())) {
        return res.json({
          code: 1,
          message: '日期格式错误',
        });
      }
    }

    // 转换部门和红线类型参数
    const departmentArray = departments
      ? (Array.isArray(departments) ? departments : [departments]) as string[]
      : undefined;

    const redLineTypeArray = redLineTypes
      ? (Array.isArray(redLineTypes) ? redLineTypes : [redLineTypes]) as string[]
      : undefined;

    // 调用服务层
    const result = await comparisonService.getComparisonTrend({
      weekStarts: weekStartDates,
      weekEnds: weekEndDates,
      departments: departmentArray,
      redLineTypes: redLineTypeArray,
    });

    return res.json({
      code: 0,
      data: result,
    });
  } catch (error) {
    console.error('获取对比趋势失败:', error);
    return res.json({
      code: 1,
      message: error instanceof Error ? error.message : '查询失败',
    });
  }
});

export default router;
