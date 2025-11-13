import { PrismaClient } from '@prisma/client';

// 创建 Prisma 客户端实例（优化：减少日志输出）
const prisma = new PrismaClient({
  log: process.env.NODE_ENV === 'development' ? ['warn', 'error'] : ['error'],
});

export default prisma;

// 优雅关闭
process.on('beforeExit', async () => {
  await prisma.$disconnect();
});
