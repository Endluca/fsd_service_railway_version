import dotenv from 'dotenv';

dotenv.config();

export const config = {
  // 服务器配置
  port: parseInt(process.env.PORT || '3005', 10),
  nodeEnv: process.env.NODE_ENV || 'development',

  // 数据库配置
  databaseUrl: process.env.DATABASE_URL || '',

  // 深维API配置
  swApi: {
    baseUrl: process.env.SWAPI_BASE_URL || 'https://open.megaview.com',
    appKey: process.env.SWAPI_APP_KEY || '',
    appSecret: process.env.SWAPI_APP_SECRET || '',
  },

  // 定时任务配置
  cron: {
    schedule: process.env.CRON_SCHEDULE || '0 5 * * *', // 默认每天5点
    timezone: process.env.TIMEZONE || 'Asia/Shanghai',
  },
};

// 验证必需的配置项
export function validateConfig() {
  const required = [
    'DATABASE_URL',
    'SWAPI_APP_KEY',
    'SWAPI_APP_SECRET',
  ];

  const missing = required.filter(key => !process.env[key]);

  if (missing.length > 0) {
    throw new Error(`Missing required environment variables: ${missing.join(', ')}`);
  }
}
