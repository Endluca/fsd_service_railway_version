const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function checkData() {
  try {
    // 查询19日的数据
    const date = '2025-11-19';
    
    const dailyMetrics = await prisma.dailyMetric.findMany({
      where: {
        date: new Date(date)
      },
      include: {
        salesPerson: true
      }
    });
    
    console.log('=== 数据统计 ===');
    console.log(`销售人员数量: ${dailyMetrics.length}`);
    
    let totalProcessedConversations = 0;
    let totalWithEmpty = 0;
    
    dailyMetrics.forEach(metric => {
      const count = metric.processedConversationIds.length;
      totalProcessedConversations += count;
      
      if (count === 0) {
        totalWithEmpty++;
        console.log(`- ${metric.salesPerson.megName || metric.openUserId}: 0 条`);
      }
    });
    
    console.log(`总处理会话数: ${totalProcessedConversations}`);
    console.log(`没有会话的销售: ${totalWithEmpty} 人`);
    
    // 按小组分组
    const groupStats = {};
    dailyMetrics.forEach(metric => {
      const groupName = metric.salesPerson.departmentName || '未分配';
      if (!groupStats[groupName]) {
        groupStats[groupName] = {
          salesCount: 0,
          conversationCount: 0
        };
      }
      groupStats[groupName].salesCount++;
      groupStats[groupName].conversationCount += metric.processedConversationIds.length;
    });
    
    console.log('\n=== 按小组统计 ===');
    Object.entries(groupStats)
      .sort((a, b) => b[1].conversationCount - a[1].conversationCount)
      .forEach(([group, stats]) => {
        console.log(`${group}: ${stats.conversationCount} 条（${stats.salesCount} 人）`);
      });
    
  } catch (error) {
    console.error('查询失败:', error);
  } finally {
    await prisma.$disconnect();
  }
}

checkData();
