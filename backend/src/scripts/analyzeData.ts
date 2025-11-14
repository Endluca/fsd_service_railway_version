import prisma from '../config/prisma';

/**
 * 分析 SalesPerson 表中的重复数据
 */
async function analyzeData() {
  console.log('开始分析数据...\n');

  // 1. 查找所有 name 重复的记录
  const allSales = await prisma.salesPerson.findMany({
    orderBy: { name: 'asc' },
  });

  // 按 name 分组
  const nameMap = new Map<string, typeof allSales>();
  for (const sale of allSales) {
    if (!nameMap.has(sale.name)) {
      nameMap.set(sale.name, []);
    }
    nameMap.get(sale.name)!.push(sale);
  }

  // 找出重复的 name
  const duplicates = Array.from(nameMap.entries()).filter(([_, sales]) => sales.length > 1);

  console.log(`总销售人员数: ${allSales.length}`);
  console.log(`重复的 name 数量: ${duplicates.length}\n`);

  if (duplicates.length === 0) {
    console.log('没有发现重复的 name');
    return;
  }

  // 2. 分析每个重复的 name
  console.log('=== 重复 name 详情 ===\n');
  const toDelete: string[] = [];

  for (const [name, sales] of duplicates) {
    console.log(`Name: ${name} (出现 ${sales.length} 次)`);

    for (const sale of sales) {
      const isError = sale.openUserId === sale.name;
      console.log(`  - openUserId: ${sale.openUserId}, groupName: ${sale.groupName || '未分配'}`);

      if (isError) {
        console.log(`    ⚠️  错误记录 (openUserId = name)，应该删除`);
        toDelete.push(sale.openUserId);
      } else {
        console.log(`    ✓  正确记录`);
      }
    }
    console.log('');
  }

  // 3. 检查这些记录在 DailyMetric 中的引用
  console.log('\n=== 外键依赖检查 ===\n');

  for (const openUserId of toDelete) {
    const count = await prisma.dailyMetric.count({
      where: { openUserId },
    });

    if (count > 0) {
      console.log(`⚠️  openUserId: ${openUserId} 在 DailyMetric 中有 ${count} 条记录`);
    } else {
      console.log(`✓  openUserId: ${openUserId} 在 DailyMetric 中无记录，可以安全删除`);
    }
  }

  console.log(`\n共需要删除 ${toDelete.length} 条错误记录`);
}

analyzeData()
  .catch((e) => {
    console.error('分析失败:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
