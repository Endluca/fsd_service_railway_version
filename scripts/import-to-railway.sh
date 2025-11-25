#!/bin/bash

# 数据导入到 Railway 脚本
# 用法: ./scripts/import-to-railway.sh <导出的SQL文件>

if [ -z "$1" ]; then
  echo "❌ 请提供导出的 SQL 文件路径"
  echo "用法: ./scripts/import-to-railway.sh database_export.sql"
  exit 1
fi

SQL_FILE="$1"

if [ ! -f "$SQL_FILE" ]; then
  echo "❌ 文件不存在: $SQL_FILE"
  exit 1
fi

echo "=== 导入数据到 Railway ==="
echo ""

# 检查是否设置了 RAILWAY_DATABASE_URL
if [ -z "$RAILWAY_DATABASE_URL" ]; then
  echo "请输入 Railway 的 DATABASE_URL:"
  echo "（格式: postgresql://postgres:密码@host:port/railway）"
  read -r RAILWAY_DATABASE_URL
  echo ""
fi

echo "准备导入文件: $SQL_FILE"
echo "目标数据库: Railway PostgreSQL"
echo ""
echo "⚠️  注意：这将把数据插入到 Railway 数据库中"
read -p "确认继续? (y/N) " -n 1 -r
echo ""

if [[ ! $REPLY =~ ^[Yy]$ ]]; then
  echo "已取消"
  exit 0
fi

# 先确保 Railway 有表结构
echo ""
echo "步骤 1: 确保 Railway 数据库有正确的表结构..."
cd backend
DATABASE_URL="$RAILWAY_DATABASE_URL" npx prisma migrate deploy

if [ $? -ne 0 ]; then
  echo "❌ Prisma migrate 失败"
  exit 1
fi

echo ""
echo "步骤 2: 导入数据..."
cd ..
psql "$RAILWAY_DATABASE_URL" < "$SQL_FILE"

if [ $? -eq 0 ]; then
  echo ""
  echo "✅ 导入成功！"
  echo ""
  echo "验证数据："
  echo "DATABASE_URL=\"$RAILWAY_DATABASE_URL\" npx prisma studio"
else
  echo ""
  echo "❌ 导入失败"
  exit 1
fi
