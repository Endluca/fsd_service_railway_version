# 数据库迁移到 Railway 指南

## 快速迁移步骤

### 1. 确保 Railway 有正确的表结构

```bash
# 在 backend 目录下，使用 Railway 的 DATABASE_URL 运行 migrations
cd backend
DATABASE_URL="你的Railway数据库URL" npm run prisma:migrate
```

### 2. 导出本地数据

```bash
# 方式1: 导出为 SQL（推荐，兼容性好）
pg_dump -h localhost -p 5432 -U postgres -d bashboard --data-only --column-inserts > local_data.sql

# 方式2: 导出为 dump（更快，但需要 pg_restore）
pg_dump -h localhost -p 5432 -U postgres -d bashboard -F c -b -v -f local_data.dump
```

### 3. 导入到 Railway

```bash
# 如果用方式1（SQL文件）
psql "你的Railway数据库URL" < local_data.sql

# 如果用方式2（dump文件）
pg_restore --verbose --no-acl --no-owner -d "你的Railway数据库URL" local_data.dump
```

## 获取 Railway DATABASE_URL

1. 登录 Railway.app
2. 进入你的项目
3. 点击 PostgreSQL 服务
4. 在 Variables 标签找到 `DATABASE_URL`

格式类似：
```
postgresql://postgres:密码@region.railway.app:端口/railway
```

## 注意事项

1. **使用 `--data-only` 选项**：避免重复创建表结构，因为 Prisma migrations 已经创建了
2. **使用 `--column-inserts` 选项**：生成更兼容的 INSERT 语句
3. **先运行 migrations**：确保 Railway 数据库有正确的表结构
4. **测试连接**：先用 `psql "你的DATABASE_URL"` 测试能否连接

## 检查导入结果

导入完成后，可以用 Prisma Studio 检查：

```bash
DATABASE_URL="你的Railway数据库URL" npx prisma studio
```

或者在 Railway 中添加 Railway CLI 并使用：

```bash
railway run npx prisma studio
```

## 常见问题

### 权限错误
如果遇到权限错误，导出时添加 `--no-owner --no-acl` 选项：
```bash
pg_dump -h localhost -p 5432 -U postgres -d bashboard --data-only --no-owner --no-acl > local_data.sql
```

### 外键约束错误
如果导入时外键冲突，可以临时禁用外键检查：
```sql
-- 在导入前运行
BEGIN;
SET CONSTRAINTS ALL DEFERRED;
-- 然后导入数据
COMMIT;
```

### 数据量大的情况
如果数据量很大，可以分表导出：
```bash
pg_dump -h localhost -p 5432 -U postgres -d bashboard -t SalesPerson --data-only > salespeople.sql
pg_dump -h localhost -p 5432 -U postgres -d bashboard -t DailyMetric --data-only > metrics.sql
# 依此类推...
```
