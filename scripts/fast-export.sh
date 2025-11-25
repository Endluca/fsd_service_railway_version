#!/bin/bash

# 快速数据导出脚本（使用自定义二进制格式）
# 用法: ./scripts/fast-export.sh

echo "=== 快速导出本地数据库（二进制格式） ==="

# 导出路径
EXPORT_FILE="database_export_$(date +%Y%m%d_%H%M%S).dump"

# 本地数据库配置
DB_HOST="localhost"
DB_PORT="5432"
DB_USER="postgres"
DB_NAME="bashboard"

echo "导出文件: $EXPORT_FILE"
echo "数据库: $DB_NAME @ $DB_HOST:$DB_PORT"
echo "格式: PostgreSQL 自定义二进制格式（最快）"
echo ""

# 使用自定义格式导出数据（比 SQL 格式快 5-10 倍）
pg_dump \
  -h $DB_HOST \
  -p $DB_PORT \
  -U $DB_USER \
  -d $DB_NAME \
  -Fc \
  --data-only \
  --no-owner \
  --no-acl \
  --verbose \
  -f "$EXPORT_FILE"

if [ $? -eq 0 ]; then
  echo ""
  echo "✅ 导出成功！"

  # 显示文件大小
  FILE_SIZE=$(ls -lh "$EXPORT_FILE" | awk '{print $5}')
  echo "文件位置: $(pwd)/$EXPORT_FILE"
  echo "文件大小: $FILE_SIZE"
  echo ""
  echo "下一步："
  echo "  ./scripts/fast-import-railway.sh $EXPORT_FILE"
else
  echo ""
  echo "❌ 导出失败，请检查："
  echo "  1. PostgreSQL 是否运行"
  echo "  2. 数据库 '$DB_NAME' 是否存在"
  echo "  3. 用户 '$DB_USER' 是否有权限"
  exit 1
fi
