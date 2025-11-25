#!/bin/bash

# 快速导入数据到 Railway（并行导入）
# 用法: ./scripts/fast-import-railway.sh <导出的dump文件>

if [ -z "$1" ]; then
  echo "❌ 请提供导出的 dump 文件路径"
  echo "用法: ./scripts/fast-import-railway.sh database_export.dump"
  exit 1
fi

DUMP_FILE="$1"

if [ ! -f "$DUMP_FILE" ]; then
  echo "❌ 文件不存在: $DUMP_FILE"
  exit 1
fi

echo "=== 快速导入数据到 Railway（并行模式） ==="
echo ""

# Railway 数据库 URL
if [ -z "$RAILWAY_DATABASE_URL" ]; then
  echo "请输入 Railway 的 DATABASE_URL:"
  echo "（或设置环境变量: export RAILWAY_DATABASE_URL='...'）"
  read -r RAILWAY_DATABASE_URL
  echo ""
fi

# 显示信息
FILE_SIZE=$(ls -lh "$DUMP_FILE" | awk '{print $5}')
echo "导入文件: $DUMP_FILE ($FILE_SIZE)"
echo "目标数据库: Railway PostgreSQL"
echo "并行任务数: 4 (可加速 4-10 倍)"
echo ""

# 测试数据库连接
echo "步骤 1/4: 测试 Railway 数据库连接..."
psql "$RAILWAY_DATABASE_URL" -c "SELECT version();" > /dev/null 2>&1

if [ $? -ne 0 ]; then
  echo "❌ 无法连接到 Railway 数据库，请检查 DATABASE_URL"
  exit 1
fi
echo "✅ 数据库连接成功"
echo ""

# 确认清空数据
echo "⚠️  警告: 导入前需要清空 Railway 数据库现有数据"
read -p "是否继续? (y/N) " -n 1 -r
echo ""

if [[ ! $REPLY =~ ^[Yy]$ ]]; then
  echo "已取消"
  exit 0
fi

# 清空数据
echo ""
echo "步骤 2/4: 清空 Railway 数据库现有数据..."
psql "$RAILWAY_DATABASE_URL" <<EOF
-- 禁用外键约束检查
SET session_replication_role = 'replica';

-- 清空数据表（保留结构）
TRUNCATE TABLE date_range_cache CASCADE;
TRUNCATE TABLE daily_metrics CASCADE;
TRUNCATE TABLE reports CASCADE;
TRUNCATE TABLE api_tokens CASCADE;
TRUNCATE TABLE sales_person CASCADE;

-- 恢复外键约束检查
SET session_replication_role = 'origin';
EOF

if [ $? -eq 0 ]; then
  echo "✅ 数据清空成功"
else
  echo "❌ 数据清空失败"
  exit 1
fi

# 确保表结构最新
echo ""
echo "步骤 3/4: 确保表结构最新..."
cd backend
DATABASE_URL="$RAILWAY_DATABASE_URL" npx prisma migrate deploy --schema=./prisma/schema.prisma > /dev/null 2>&1
cd ..
echo "✅ 表结构检查完成"

# 并行导入数据
echo ""
echo "步骤 4/4: 并行导入数据（这可能需要几秒到几分钟）..."
echo "开始时间: $(date '+%H:%M:%S')"

pg_restore \
  --dbname="$RAILWAY_DATABASE_URL" \
  --data-only \
  --no-owner \
  --no-acl \
  --disable-triggers \
  --jobs=4 \
  --verbose \
  "$DUMP_FILE" 2>&1 | grep -E "processing|restoring|finished"

RESTORE_EXIT_CODE=$?

echo "结束时间: $(date '+%H:%M:%S')"
echo ""

if [ $RESTORE_EXIT_CODE -eq 0 ] || [ $RESTORE_EXIT_CODE -eq 1 ]; then
  # 退出码 1 可能是警告，不一定失败
  echo "✅ 导入完成！"
  echo ""
  echo "📊 验证导入结果："

  # 统计各表记录数
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
  echo "🎉 数据迁移完成！现在可以访问 Railway 应用查看数据"
  echo ""
  echo "提示: 如需查看数据库内容，运行:"
  echo "  DATABASE_URL=\"$RAILWAY_DATABASE_URL\" npx prisma studio"
else
  echo "❌ 导入失败（退出码: $RESTORE_EXIT_CODE）"
  exit 1
fi
