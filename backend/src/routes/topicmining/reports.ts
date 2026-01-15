import { Router, Request, Response, NextFunction } from 'express';
import multer from 'multer';
import fileParserService from '../../services/topicmining/fileParserService';
import reportService from '../../services/topicmining/reportService';
import type { ReportPayload } from '../../types/topicmining/report';

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 150 * 1024 * 1024 }, // 150MB
});

export const reportsRouter = Router();

// POST /api/topicmining/reports/parse - 解析数据文件(支持CSV、XLSX、XLS)
reportsRouter.post(
  '/parse',
  upload.single('file'),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      if (!req.file) {
        return res.status(400).json({
          code: 400,
          message: '缺少文件',
        });
      }

      const result = await fileParserService.parseFile(
        req.file.buffer,
        req.file.originalname,
        req.file.mimetype
      );
      res.json({
        code: 0,
        message: 'success',
        data: result,
      });
    } catch (error: any) {
      console.error('文件解析失败:', error);
      res.status(error.status || 500).json({
        code: error.status || 500,
        message: error.message || '服务器错误',
      });
    }
  }
);

// POST /api/topicmining/reports - 创建报告
reportsRouter.post(
  '/',
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const payload = req.body as ReportPayload;

      if (!payload || typeof payload !== 'object') {
        return res.status(400).json({
          code: 400,
          message: '请求体格式不正确',
        });
      }

      if (!payload.title?.trim()) {
        return res.status(400).json({
          code: 400,
          message: 'title 为必填项',
        });
      }

      if (!payload.statistics) {
        return res.status(400).json({
          code: 400,
          message: '缺少统计数据 statistics',
        });
      }

      const report = await reportService.createReport(payload);
      res.status(201).json({
        code: 0,
        message: 'success',
        data: {
          id: report.id,
          generatedAt: report.generatedAt,
        },
      });
    } catch (error: any) {
      console.error('创建报告失败:', error);
      res.status(500).json({
        code: 500,
        message: error.message || '服务器错误',
      });
    }
  }
);

// GET /api/topicmining/reports - 获取报告列表
reportsRouter.get('/', async (req: Request, res: Response) => {
  try {
    const items = await reportService.listReports();
    res.json({
      code: 0,
      message: 'success',
      data: items,
    });
  } catch (error: any) {
    console.error('获取报告列表失败:', error);
    res.status(500).json({
      code: 500,
      message: error.message || '服务器错误',
    });
  }
});

// GET /api/topicmining/reports/:id - 获取报告详情
reportsRouter.get('/:id', async (req: Request, res: Response) => {
  try {
    const report = await reportService.getReportById(req.params.id);
    if (!report) {
      return res.status(404).json({
        code: 404,
        message: '报告不存在',
      });
    }
    res.json({
      code: 0,
      message: 'success',
      data: report,
    });
  } catch (error: any) {
    console.error('获取报告详情失败:', error);
    res.status(500).json({
      code: 500,
      message: error.message || '服务器错误',
    });
  }
});

// DELETE /api/topicmining/reports/:id - 删除报告
reportsRouter.delete('/:id', async (req: Request, res: Response) => {
  try {
    const deleted = await reportService.deleteReport(req.params.id);
    if (!deleted) {
      return res.status(404).json({
        code: 404,
        message: '报告不存在或已删除',
      });
    }
    res.status(204).send();
  } catch (error: any) {
    console.error('删除报告失败:', error);
    res.status(500).json({
      code: 500,
      message: error.message || '服务器错误',
    });
  }
});
