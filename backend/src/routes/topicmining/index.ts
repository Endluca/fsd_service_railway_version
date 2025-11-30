import { Router } from 'express';
import { reportsRouter } from './reports';
import comparisonRouter from './comparison';

const router = Router();

// 报告管理路由
router.use('/reports', reportsRouter);

// 月度对比路由
router.use('/comparison', comparisonRouter);

export default router;
