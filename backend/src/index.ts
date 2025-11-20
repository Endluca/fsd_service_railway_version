import express from 'express';
import cors from 'cors';
import { config, validateConfig } from './config';
import authService from './services/auth';
import dataCollector from './services/dataCollector';
import scheduler from './services/scheduler';
import router from './routes';

async function bootstrap() {
  console.log('========================================');
  console.log('51Talk CM团队服务及时性监控看板');
  console.log('========================================\n');

  try {
    // 1. 验证配置
    console.log('验证配置...');
    validateConfig();
    console.log('✓ 配置验证通过\n');

    // 2. 初始化认证服务
    console.log('初始化认证服务...');
    await authService.initialize();
    console.log('✓ 认证服务初始化完成\n');

    // 3. 初始化数据采集服务
    console.log('初始化数据采集服务...');
    await dataCollector.initialize();
    console.log('✓ 数据采集服务初始化完成\n');

    // 4. 启动Express服务器
    console.log('启动Web服务器...');
    const app = express();

    // 中间件
    // CORS 配置：支持通过环境变量配置允许的域名
    const allowedOrigins = process.env.ALLOWED_ORIGINS
      ? process.env.ALLOWED_ORIGINS.split(',').map(origin => origin.trim())
      : ['http://localhost:5175', '*'];

    // 确保开发环境下允许所有跨域
    if (!allowedOrigins.includes('*')) {
      allowedOrigins.push('*');
    }

    app.use(cors({
      origin: (origin, callback) => {
        // 允许无 origin 的请求（如移动应用、Postman 等）
        if (!origin) return callback(null, true);

        if (allowedOrigins.includes('*') || allowedOrigins.includes(origin)) {
          callback(null, true);
        } else {
          callback(new Error('Not allowed by CORS'));
        }
      },
      credentials: true,
    }));

    app.use(express.json({ limit: '50mb' }));
    app.use(express.urlencoded({ extended: true, limit: '50mb' }));

    // 请求日志
    app.use((req, res, next) => {
      console.log(`[${new Date().toISOString()}] ${req.method} ${req.path}`);
      next();
    });

    // 路由
    app.use('/api', router);

    // 404处理
    app.use((req, res) => {
      res.status(404).json({
        code: 404,
        message: 'Not Found',
      });
    });

    // 启动服务器
    app.listen(config.port, '0.0.0.0', () => {
      console.log(`✓ Web服务器已启动: http://0.0.0.0:${config.port}\n`);
    });

    // 5. 启动定时任务
    console.log('启动定时任务...');
    scheduler.start();
    console.log('✓ 定时任务已启动\n');

    console.log('========================================');
    console.log('系统启动完成！');
    console.log('========================================\n');

    // 优雅关闭
    process.on('SIGINT', async () => {
      console.log('\n正在关闭服务...');
      scheduler.stop();
      authService.destroy();
      process.exit(0);
    });

  } catch (error) {
    console.error('启动失败:', error);
    process.exit(1);
  }
}

// 启动应用
bootstrap();
