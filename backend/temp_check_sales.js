const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

(async () => {
  try {
    console.log('========== 当前数据库人员情况 ==========\n');

    // 查询所有人员
    const allSales = await prisma.salesPerson.findMany({
      orderBy: [
        { groupName: 'asc' },
        { openUserId: 'asc' }
      ],
      select: {
        openUserId: true,
        name: true,
        groupName: true
      }
    });

    // 按小组分类显示
    let currentGroup = null;
    let groupCount = 0;

    allSales.forEach((person) => {
      const group = person.groupName || '(无小组)';

      if (group !== currentGroup) {
        if (currentGroup !== null) {
          console.log(`  小计: ${groupCount} 人\n`);
        }
        console.log(`【${group}】`);
        currentGroup = group;
        groupCount = 0;
      }

      groupCount++;
      console.log(`  ${groupCount}. ${person.openUserId}`);
    });

    console.log(`  小计: ${groupCount} 人\n`);
    console.log(`\n总计: ${allSales.length} 人`);

    await prisma.$disconnect();
  } catch (error) {
    console.error('查询失败:', error);
    await prisma.$disconnect();
    process.exit(1);
  }
})();
