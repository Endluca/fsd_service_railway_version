/**
 * 社媒声音 API 路由
 */

import express from 'express';
import searchService from '../../services/socialmedia/searchService';
import apifyClient from '../../services/socialmedia/apifyClient';
import type { SearchRequest } from '../../types/socialmedia';

const router = express.Router();

/**
 * POST /api/socialmedia/search
 * 执行社媒搜索
 */
router.post('/search', async (req, res) => {
  try {
    const { keywords, platforms, maxCount } = req.body as SearchRequest;

    // 参数验证
    if (!keywords || !Array.isArray(keywords) || keywords.length === 0) {
      return res.json({
        code: 1,
        message: '请至少输入一个关键词',
      });
    }

    if (keywords.length > 10) {
      return res.json({
        code: 1,
        message: '关键词数量不能超过 10 个',
      });
    }

    if (!platforms || !Array.isArray(platforms) || platforms.length === 0) {
      return res.json({
        code: 1,
        message: '请至少选择一个平台',
      });
    }

    if (!maxCount || maxCount < 1 || maxCount > 20) {
      return res.json({
        code: 1,
        message: '抓取数量必须在 1-20 之间',
      });
    }

    // 执行搜索
    const result = await searchService.search({
      keywords,
      platforms,
      maxCount,
    });

    return res.json({
      code: 0,
      message: '搜索完成',
      data: result,
    });
  } catch (error) {
    console.error('搜索失败:', error);
    return res.json({
      code: 1,
      message: error instanceof Error ? error.message : '搜索失败',
    });
  }
});

/**
 * GET /api/socialmedia/health
 * 健康检查：验证 Apify API Token 是否有效
 */
router.get('/health', async (req, res) => {
  try {
    const isValid = await apifyClient.healthCheck();
    return res.json({
      code: 0,
      data: {
        tokenValid: isValid,
        timestamp: new Date().toISOString(),
      },
    });
  } catch (error) {
    console.error('健康检查失败:', error);
    return res.json({
      code: 1,
      message: '健康检查失败',
      data: {
        tokenValid: false,
        timestamp: new Date().toISOString(),
      },
    });
  }
});

export default router;
