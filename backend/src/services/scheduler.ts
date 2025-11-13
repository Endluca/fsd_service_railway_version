import cron from 'node-cron';
import { config } from '../config';
import dataCollector from './dataCollector';

/**
 * 定时任务调度器
 */
export class SchedulerService {
  private task: cron.ScheduledTask | null = null;

  /**
   * 启动定时任务
   */
  start() {
    console.log('启动定时任务调度器...');
    console.log(`定时规则: ${config.cron.schedule} (${config.cron.timezone})`);

    this.task = cron.schedule(
      config.cron.schedule,
      async () => {
        console.log('\n' + '='.repeat(60));
        console.log(`定时任务触发: ${new Date().toLocaleString('zh-CN', { timeZone: config.cron.timezone })}`);
        console.log('='.repeat(60));

        try {
          await dataCollector.collectDailyData();
        } catch (error) {
          console.error('定时任务执行失败:', error);
        }
      },
      {
        scheduled: true,
        timezone: config.cron.timezone,
      }
    );

    console.log('定时任务已启动');
  }

  /**
   * 停止定时任务
   */
  stop() {
    if (this.task) {
      this.task.stop();
      this.task = null;
      console.log('定时任务已停止');
    }
  }

  /**
   * 手动执行一次任务（用于测试）
   */
  async runNow() {
    console.log('手动触发定时任务...');
    try {
      await dataCollector.collectDailyData();
      console.log('手动任务执行完成');
    } catch (error) {
      console.error('手动任务执行失败:', error);
      throw error;
    }
  }
}

export default new SchedulerService();
