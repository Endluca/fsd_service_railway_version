#!/bin/bash

# 清空 Railway 数据库脚本
# 用法: ./scripts/clear-railway-db.sh

echo "=== 清空 Railway 数据库 ==="
echo ""

# Railway 数据库 URL
if [ -z "$RAILWAY_DATABASE_URL" ]; then
  echo "请输入 Railway 的 DATABASE_URL:"
  echo "（或设置环境变量: export RAILWAY_DATABASE_URL='...'）"
  read -r RAILWAY_DATABASE_URL
  echo ""
fi

# 测试连接
echo "测试数据库连接..."
psql "$RAILWAY_DATABASE_URL" -c "SELECT current_database();" > /dev/null 2>&1

if [ $? -ne 0 ]; then
  echo "❌ 无法连接到 Railway 数据库，请检查 DATABASE_URL"
  exit 1
fi
echo "✅ 数据库连接成功"
echo ""

# 显示当前数据量
echo "📊 当前数据量："
psql "$RAILWAY_DATABASE_URL" -t <<EOF
SELECT
  'sales_person: ' || COUNT(*) || ' 条记录' FROM sales_person
UNION ALL
SELECT
  'daily_metrics: ' || COUNT(*) || ' 条记录' FROM daily_metrics
UNION ALL
SELECT
  'date_range_cache: ' || COUNT(*) || ' 条记录' FROM date_range_cache
UNION ALL
SELECT
  'api_tokens: ' || COUNT(*) || ' 条记录' FROM api_tokens
UNION ALL
SELECT
  'reports: ' || COUNT(*) || ' 条记录' FROM reports;
EOF

echo ""
echo "⚠️  警告: 这将删除 Railway 数据库中的所有数据（保留表结构）"
echo "⚠️  包括: sales_person, daily_metrics, date_range_cache, api_tokens, reports"
read -p "确认继续? (yes/N) " -r
echo ""

if [[ ! $REPLY == "yes" ]]; then
  echo "已取消"
  exit 0
fi

# 清空数据
echo "清空数据中..."
psql "$RAILWAY_DATABASE_URL" <<EOF
-- 禁用外键约束检查（加速）
SET session_replication_role = 'replica';

-- 清空数据表（CASCADE 自动处理依赖关系）
TRUNCATE TABLE date_range_cache CASCADE;
TRUNCATE TABLE daily_metrics CASCADE;
TRUNCATE TABLE reports CASCADE;
TRUNCATE TABLE api_tokens CASCADE;
TRUNCATE TABLE sales_person CASCADE;

-- 恢复外键约束检查
SET session_replication_role = 'origin';

-- 显示结果
SELECT 'sales_person: ' || COUNT(*) || ' 条记录' FROM sales_person
UNION ALL
SELECT 'daily_metrics: ' || COUNT(*) || ' 条记录' FROM daily_metrics
UNION ALL
SELECT 'date_range_cache: ' || COUNT(*) || ' 条记录' FROM date_range_cache
UNION ALL
SELECT 'api_tokens: ' || COUNT(*) || ' 条记录' FROM api_tokens
UNION ALL
SELECT 'reports: ' || COUNT(*) || ' 条记录' FROM reports;
EOF

if [ $? -eq 0 ]; then
  echo ""
  echo "✅ 数据清空成功！"
  echo ""
  echo "注意: 表结构和 _prisma_migrations 记录已保留"
else
  echo ""
  echo "❌ 清空失败"
  exit 1
fi
