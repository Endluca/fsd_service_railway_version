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

      // 2. 准备基础数据（线上库仅有 name、group_name）
      let salesName = openUserId;  // 默认用 openUserId
      let mainDepartmentId = 0;

      if (userInfo) {
        salesName = userInfo.name || openUserId;
        mainDepartmentId = userInfo.main_department_id || 0;
      }

      // 3. 获取部门/小组名称（从 API）
      let groupName = '未分配小组';
      if (mainDepartmentId > 0 && departmentCache.has(mainDepartmentId)) {
        groupName = departmentCache.get(mainDepartmentId)!.name || '未分配小组';
      } else if (mainDepartmentId > 0) {
        try {
          const deptInfo = await swApiClient.getDepartmentInfo(mainDepartmentId);
          if (deptInfo?.name) {
            groupName = deptInfo.name;
            departmentCache.set(mainDepartmentId, {
              name: groupName,
              parentId: deptInfo.parent_department_id || 0,
              leadId: deptInfo.lead_open_user_id || '默认值',
            });
          }
        } catch (error: any) {
          console.warn(`获取部门 ${mainDepartmentId} 失败:`, error.message);
        }
      }

      // 4. 检查数据库中是否已存在
      const existing = await prisma.salesPerson.findUnique({
        where: { openUserId },
      });

      if (existing) {
        await prisma.salesPerson.update({
          where: { openUserId },
          data: { name: salesName, groupName },
        });
        console.log(`✓ 已更新销售: ${openUserId}`);
      } else {
        await prisma.salesPerson.create({
          data: { openUserId, name: salesName, groupName },
        });
        console.log(`✓ 已创建销售: ${openUserId} (${salesName})`);
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
