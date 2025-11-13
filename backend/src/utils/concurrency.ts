/**
 * 并发控制工具函数
 * 用于控制Promise的并发执行数量
 */

/**
 * 批量执行异步任务，控制并发数量
 * @param tasks 任务数组
 * @param handler 处理每个任务的函数
 * @param concurrency 并发数量（默认10）
 * @param onProgress 进度回调函数
 * @returns 所有任务的结果数组
 */
export async function batchProcess<T, R>(
  tasks: T[],
  handler: (task: T, index: number) => Promise<R>,
  options: {
    concurrency?: number;
    onProgress?: (completed: number, total: number, success: number, failed: number) => void;
  } = {}
): Promise<Array<{ success: boolean; data?: R; error?: any; index: number }>> {
  const { concurrency = 10, onProgress } = options;
  const results: Array<{ success: boolean; data?: R; error?: any; index: number }> = [];

  let completed = 0;
  let success = 0;
  let failed = 0;

  // 将任务分批
  const batches: T[][] = [];
  for (let i = 0; i < tasks.length; i += concurrency) {
    batches.push(tasks.slice(i, i + concurrency));
  }

  // 逐批执行
  for (const batch of batches) {
    const batchPromises = batch.map(async (task, batchIndex) => {
      const globalIndex = batches.indexOf(batch) * concurrency + batchIndex;
      try {
        const data = await handler(task, globalIndex);
        completed++;
        success++;
        if (onProgress) {
          onProgress(completed, tasks.length, success, failed);
        }
        return { success: true, data, index: globalIndex };
      } catch (error) {
        completed++;
        failed++;
        if (onProgress) {
          onProgress(completed, tasks.length, success, failed);
        }
        return { success: false, error, index: globalIndex };
      }
    });

    const batchResults = await Promise.all(batchPromises);
    results.push(...batchResults);
  }

  return results;
}

/**
 * 并发执行Promise数组，限制并发数量
 * @param promises Promise生成函数数组
 * @param concurrency 并发数量
 */
export async function promisePool<T>(
  promiseFns: Array<() => Promise<T>>,
  concurrency: number = 10
): Promise<T[]> {
  const results: T[] = [];
  const executing: Promise<void>[] = [];

  for (const [index, promiseFn] of promiseFns.entries()) {
    const promise = promiseFn().then((result) => {
      results[index] = result;
    });

    const e: Promise<void> = promise.then(() => {
      executing.splice(executing.indexOf(e), 1);
    });

    executing.push(e);

    if (executing.length >= concurrency) {
      await Promise.race(executing);
    }
  }

  await Promise.all(executing);
  return results;
}

/**
 * 延迟函数
 * @param ms 延迟毫秒数
 */
export function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * 带重试的异步函数执行
 * @param fn 要执行的异步函数
 * @param retries 重试次数
 * @param delay 重试延迟（毫秒）
 */
export async function retry<T>(
  fn: () => Promise<T>,
  retries: number = 3,
  delay: number = 1000
): Promise<T> {
  try {
    return await fn();
  } catch (error) {
    if (retries <= 0) {
      throw error;
    }
    await sleep(delay);
    return retry(fn, retries - 1, delay * 2); // 指数退避
  }
}
