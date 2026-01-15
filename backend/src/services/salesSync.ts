import fs from 'fs/promises';
import path from 'path';
import prisma from '../config/prisma';
import swApiClient from './swApi';

interface SyncLogEntry {
  time: string;
  error: string;
  code: number;
}

/**
 * 销售信息同步服务
 * 从深维API同步销售人员和部门信息
 */
export class SalesSyncService {
  private groupNameMap: Map<string, string> = new Map();

  /**
   * 从人员信息.md文件导入销售信息（仅在创建时使用）
   */
  async loadGroupNameMap(filePath: string): Promise<Map<string, string>> {
    const map = new Map<string, string>();

    try {
      const content = await fs.readFile(filePath, 'utf-8');
      const lines = content.split('\n').filter((line) => line.trim());
      const dataLines = lines.slice(1);

      for (const line of dataLines) {
        const match = line.match(/^(.+?)\s+(.+)$/);
        if (match) {
          const [, salesName, groupName] = match;
          const cleanGroupName = groupName.replace(/"/g, '').trim();
          map.set(salesName.trim(), cleanGroupName);
        }
      }

      console.log(`已加载 ${map.size} 条小组分配规则（仅用于新增人员时的默认分配）`);
    } catch (error) {
      console.error('加载人员信息失败:', error);
      throw error;
    }

    return map;
  }

  /**
   * 从会话中同步销售信息到数据库
   * @param openUserId 销售ID
   * @param syncedSales 已同步销售集合（内存缓存）
   * @param departmentCache 部门缓存（内存缓存）
   */
  async syncFromConversation(
    openUserId: string,
    syncedSales: Set<string>,
    departmentCache: Map<number, any>
  ): Promise<void> {
    // 如果当天已同步，直接返回
    if (syncedSales.has(openUserId)) {
      return;
    }

    console.log(`正在同步销售信息: ${openUserId}`);

    const syncLogs: SyncLogEntry[] = [];
    const timestamp = new Date().toISOString();

    try {
      // 1. 获取销售信息
      let userInfo = null;
      let isUserExist = true;

      try {
        userInfo = await swApiClient.getUserInfo(openUserId);
      } catch (error: any) {
        // 判断是否是"用户不存在"错误
        if (error.response?.data?.code === 401154) {
          isUserExist = false;
          syncLogs.push({
            time: timestamp,
            error: `用户 ${openUserId} 不存在`,
            code: 401154,
          });
          console.warn(`用户 ${openUserId} 不存在，将使用默认值创建记录`);
        } else {
          // 其他错误（网络超时等），不要创建记录，直接抛出
          throw error;
        }
      }

      // 2. 准备基础数据
      let megName = '默认值';
      let mainDepartmentId = 0;
      let isDelete = false;
      let status = '正常';

      if (userInfo) {
        megName = userInfo.name || '默认值';
        mainDepartmentId = userInfo.main_department_id || 0;
        isDelete = userInfo.status?.is_delete || false;
        status = '正常';
      } else if (!isUserExist) {
        status = '用户不存在';
      }

      // 3. 获取部门信息（只有主部门ID有效时才调用）
      let departmentName = '默认值';
      let parentDepartmentId = 0;
      let leadOpenUserId = '默认值';

      if (mainDepartmentId > 0) {
        // 检查部门缓存
        if (departmentCache.has(mainDepartmentId)) {
          const dept = departmentCache.get(mainDepartmentId);
          departmentName = dept.name;
          parentDepartmentId = dept.parentId;
          leadOpenUserId = dept.leadId;
        } else {
          try {
            const deptInfo = await swApiClient.getDepartmentInfo(
              mainDepartmentId
            );

            if (deptInfo) {
              departmentName = deptInfo.name || '默认值';
              parentDepartmentId = deptInfo.parent_department_id || 0;
              leadOpenUserId = deptInfo.lead_open_user_id || '默认值';

              // 添加到缓存
              departmentCache.set(mainDepartmentId, {
                name: departmentName,
                parentId: parentDepartmentId,
                leadId: leadOpenUserId,
              });
            } else {
              // 部门不存在
              syncLogs.push({
                time: timestamp,
                error: `部门 ${mainDepartmentId} 不存在`,
                code: 401103,
              });
            }
          } catch (error: any) {
            // 部门API调用失败（网络超时等）
            syncLogs.push({
              time: timestamp,
              error: `获取部门 ${mainDepartmentId} 信息失败: ${
                error.message
              }`,
              code: error.response?.data?.code || 500,
            });
          }
        }
      }

      // 4. 准备log_info
      const logInfo = syncLogs.length > 0 ? JSON.stringify(syncLogs) : null;

      // 5. 检查数据库中是否已存在
      const existing = await prisma.salesPerson.findUnique({
        where: { openUserId },
      });

      if (existing) {
        // 更新现有记录（每次都更新，保证信息最新）
        await prisma.salesPerson.update({
          where: { openUserId },
          data: {
            megName,
            mainDepartmentId,
            isDelete,
            status,
            departmentName,
            parentDepartmentId,
            leadOpenUserId,
            // 追加日志（如果有新错误）
            logInfo: syncLogs.length > 0 ? logInfo : existing.logInfo,
          },
        });
        console.log(`✓ 已更新销售: ${openUserId}`);
      } else {
        // 创建新记录
        await prisma.salesPerson.create({
          data: {
            openUserId,
            megName,
            mainDepartmentId,
            isDelete,
            status,
            departmentName,
            parentDepartmentId,
            leadOpenUserId,
            logInfo,
          },
        });
        console.log(`✓ 已创建销售: ${openUserId} (${megName})`);
      }

      // 6. 添加到已同步集合
      syncedSales.add(openUserId);
    } catch (error) {
      console.error(`同步销售信息失败 (${openUserId}):`, error);
      // 外层会有错误处理
      throw error;
    }
  }
}

export default new SalesSyncService();
