/**
 * 话题挖掘月度对比路由
 */

import { Router } from 'express';
import comparisonService from '../../services/topicmining/comparisonService';

const router = Router();

/**
 * GET /api/topicmining/comparison/months
 * 获取所有可用月份列表
 */
router.get('/months', async (req, res) => {
  try {
    const months = await comparisonService.getAvailableMonths();
    res.json({
      code: 0,
      message: 'success',
      data: { months },
    });
  } catch (error) {
    console.error('获取月份列表失败:', error);
    res.status(500).json({
      code: 1,
      message: '获取月份列表失败',
    });
  }
});

/**
 * GET /api/topicmining/comparison
 * 获取月度对比数据
 *
 * Query参数:
 * - months[]: 月份数组,格式 YYYY-MM
 * - parentTopN: 每月取前N个父类,默认5
 * - childTopN: 每月取前N个子类,默认5
 */
router.get('/', async (req, res) => {
  try {
    const { months, parentTopN, childTopN } = req.query;

    // 参数验证
    if (!months || (Array.isArray(months) && months.length === 0)) {
      return res.status(400).json({
        code: 1,
        message: '至少选择一个月份',
      });
    }

    // 确保months是数组
    const monthsArray = Array.isArray(months) ? months : [months];

    // 转换topN参数
    const parentTopNValue = parentTopN ? Number(parentTopN) : 5;
    const childTopNValue = childTopN ? Number(childTopN) : 5;

    // 调用服务
    const data = await comparisonService.getComparisonData({
      months: monthsArray as string[],
      parentTopN: parentTopNValue,
      childTopN: childTopNValue,
    });

    res.json({
      code: 0,
      message: 'success',
      data,
    });
  } catch (error) {
    console.error('获取对比数据失败:', error);
    res.status(500).json({
      code: 1,
      message: '获取对比数据失败',
    });
  }
});

export default router;
