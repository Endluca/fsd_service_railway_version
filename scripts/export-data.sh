#!/bin/bash

# 数据导出脚本
# 用法: ./scripts/export-data.sh

echo "=== 开始导出本地数据库 ==="

# 导出路径
EXPORT_FILE="database_export_$(date +%Y%m%d_%H%M%S).sql"

# 本地数据库配置（从 .env 读取）
DB_HOST="localhost"
DB_PORT="5432"
DB_USER="postgres"
DB_NAME="bashboard"

echo "导出文件: $EXPORT_FILE"
echo "数据库: $DB_NAME @ $DB_HOST:$DB_PORT"
echo ""

# 导出数据（不包含表结构，使用列名插入方式）
pg_dump \
  -h $DB_HOST \
  -p $DB_PORT \
  -U $DB_USER \
  -d $DB_NAME \
  --data-only \
  --column-inserts \
  --no-owner \
  --no-acl \
  --verbose \
  > "$EXPORT_FILE"

if [ $? -eq 0 ]; then
  echo ""
  echo "✅ 导出成功！"
  echo "文件位置: $(pwd)/$EXPORT_FILE"
  echo ""
  echo "下一步："
  echo "1. 获取 Railway 的 DATABASE_URL"
  echo "2. 运行: ./scripts/import-to-railway.sh $EXPORT_FILE"
else
  echo ""
  echo "❌ 导出失败，请检查数据库连接"
  exit 1
fi
