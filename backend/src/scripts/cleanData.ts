import prisma from '../config/prisma';

/**
 * 清理 SalesPerson 表中的重复数据
 * 删除 openUserId = name 的错误记录
 */
async function cleanData() {
  console.log('开始清理数据...\n');

  try {
    // 删除 openUserId = name 的记录
    // 并且该 name 在数据库中出现了多次（即有重复）
    const result = await prisma.$executeRaw`
      DELETE FROM sales_person
      WHERE open_user_id = name
        AND name IN (
          SELECT name
          FROM sales_person
          GROUP BY name
          HAVING COUNT(*) > 1
        );
    `;

    console.log(`✓ 成功删除 ${result} 条错误记录\n`);

    // 验证清理结果
    const remaining = await prisma.$queryRaw<Array<{ name: string; open_user_id: string }>>`
      SELECT name, open_user_id
      FROM sales_person
      WHERE open_user_id = name;
    `;

    if (remaining.length > 0) {
      console.log(`⚠️  还有 ${remaining.length} 条 openUserId = name 的记录：`);
      remaining.forEach((r) => {
        console.log(`  - ${r.name} (${r.open_user_id})`);
      });
    } else {
      console.log('✓ 所有错误记录已清理完毕');
    }

    // 检查是否还有重复的 name
    const duplicateCheck = await prisma.$queryRaw<Array<{ name: string; count: bigint }>>`
      SELECT name, COUNT(*) as count
      FROM sales_person
      GROUP BY name
      HAVING COUNT(*) > 1;
    `;

    if (duplicateCheck.length > 0) {
      console.log(`\n⚠️  还有 ${duplicateCheck.length} 个重复的 name：`);
      duplicateCheck.forEach((d) => {
        console.log(`  - ${d.name} (出现 ${d.count} 次)`);
      });
    } else {
      console.log('\n✓ 没有重复的 name，数据已完全清理');
    }

    // 显示最终统计
    const total = await prisma.salesPerson.count();
    console.log(`\n总销售人员数: ${total}`);

  } catch (error) {
    console.error('清理失败:', error);
    throw error;
  }
}

cleanData()
  .catch((e) => {
    console.error('清理失败:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
