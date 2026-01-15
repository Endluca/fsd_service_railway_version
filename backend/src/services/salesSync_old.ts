import fs from 'fs/promises';
import path from 'path';
import prisma from '../config/prisma';
import swApiClient from './swApi';

/**
 * 销售信息同步服务
 * 从人员信息文件同步销售人员和小组信息
 */
export class SalesSyncService {
  /**
   * 从人员信息.md文件导入销售信息
   * @param filePath 人员信息文件路径
   */
  async syncFromFile(filePath: string) {
    console.log('开始同步销售信息...');

    try {
      // 读取文件内容
      const content = await fs.readFile(filePath, 'utf-8');
      const lines = content.split('\n').filter(line => line.trim());

      // 跳过表头
      const dataLines = lines.slice(1);

      let successCount = 0;
      let errorCount = 0;

      for (const line of dataLines) {
        try {
          // 解析每行数据
          const match = line.match(/^(.+?)\s+(.+)$/);
          if (!match) {
            console.warn(`无法解析行: ${line}`);
            continue;
          }

          const [, salesName, groupName] = match;
          const cleanGroupName = groupName.replace(/"/g, '').trim(); // 移除引号

          // 通过深维API获取销售的完整信息
          // 这里假设sales_name就是深维系统中的name
          // 实际情况可能需要调整
          await this.syncSalesPerson(salesName.trim(), cleanGroupName);

          successCount++;
          console.log(`已同步: ${salesName} -> ${cleanGroupName}`);
        } catch (error) {
          console.error(`同步失败: ${line}`, error);
          errorCount++;
        }
      }

      console.log(`同步完成！成功: ${successCount}, 失败: ${errorCount}`);
    } catch (error) {
      console.error('同步销售信息失败:', error);
      throw error;
    }
  }

  /**
   * 同步单个销售人员
   * @param name 销售姓名
   * @param groupName 小组名称
   */
  private async syncSalesPerson(name: string, groupName: string) {
    // 由于我们只有name，没有open_user_id，这里需要从数据库中查找
    // 或者在数据采集时自动创建

    // 先尝试通过name查找
    const existing = await prisma.salesPerson.findFirst({
      where: { name },
    });

    if (existing) {
      // 更新小组信息
      await prisma.salesPerson.update({
        where: { id: existing.id },
        data: { groupName },
      });
    } else {
      // 新销售人员，暂时不创建，等待数据采集时创建
      // 因为我们需要open_user_id
      console.log(`销售人员 ${name} 尚未在系统中，将在数据采集时创建`);
    }
  }

  /**
   * 从会话数据中同步销售信息
   * @param openUserId 销售ID
   * @param groupNameMap 姓名到小组的映射（仅用于新增人员时的默认分配）
   */
  async syncFromConversation(openUserId: string, groupNameMap: Map<string, string>) {
    try {
      // 先检查数据库中是否已存在
      const existing = await prisma.salesPerson.findUnique({
        where: { openUserId },
      });

      if (existing) {
        // 已存在于数据库，直接使用数据库中的信息，不做任何修改
        return;
      }

      // 不存在，需要创建新记录
      // 尝试从API获取销售信息
      const userInfo = await swApiClient.getUserInfo(openUserId);
      if (!userInfo) {
        console.warn(`无法获取用户信息: ${openUserId}`);
        // 创建一个默认记录
        await prisma.salesPerson.create({
          data: {
            openUserId,
            name: openUserId,
            groupName: '未分配小组',
          },
        });
        console.log(`已创建销售: ${openUserId} -> 未分配小组（无法获取API信息）`);
        return;
      }

      const { name } = userInfo;
      // 只在创建时使用文件映射，如果文件中没有则设为"未分配小组"
      const groupName = groupNameMap.get(name) || '未分配小组';

      await prisma.salesPerson.create({
        data: {
          openUserId,
          name,
          groupName,
        },
      });

      console.log(`已创建销售: ${name} (${openUserId}) -> ${groupName}`);
    } catch (error) {
      console.error(`同步销售信息失败 (${openUserId}):`, error);
    }
  }

  /**
   * 加载人员信息文件，构建姓名到小组的映射
   * @param filePath 人员信息文件路径
   */
  async loadGroupNameMap(filePath: string): Promise<Map<string, string>> {
    const map = new Map<string, string>();

    try {
      const content = await fs.readFile(filePath, 'utf-8');
      const lines = content.split('\n').filter(line => line.trim());

      // 跳过表头
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
}

export default new SalesSyncService();
