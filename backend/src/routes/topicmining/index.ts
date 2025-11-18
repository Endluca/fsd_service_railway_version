import { Router } from 'express';
import { reportsRouter } from './reports';

const router = Router();

// 报告管理路由
router.use('/reports', reportsRouter);

export default router;
