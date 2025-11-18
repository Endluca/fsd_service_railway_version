# Railway 部署指南

本文档提供将 **51Talk CM 团队服务及时性监控看板** 部署到 Railway 的详细步骤。

## 📋 部署架构

采用**双服务架构**：
- **服务 1**：PostgreSQL 数据库
- **服务 2**：后端服务（Node.js + Express + Prisma）
- **服务 3**：前端服务（React + Vite）

## 🚀 部署步骤

### 步骤 1：创建 Railway 项目

1. 访问 [Railway.app](https://railway.app)
2. 点击 **"New Project"**
3. 选择 **"Deploy from GitHub repo"**
4. 选择仓库：`Endluca/fsd_service_railway_version`
5. Railway 会自动识别项目结构

### 步骤 2：添加 PostgreSQL 数据库

1. 在项目中点击 **"+ New"**
2. 选择 **"Database"** → **"PostgreSQL"**
3. Railway 会自动创建数据库并生成 `DATABASE_URL` 环境变量

> ⚠️ **重要**：记下数据库服务的名称（默认为 `Postgres`），后端服务需要引用它的环境变量。

### 步骤 3：创建后端服务

#### 3.1 配置服务
1. 点击 **"+ New"** → **"GitHub Repo"**
2. 选择仓库和分支（`main`）
3. 配置以下设置：

   **Service Name**: `backend`

   **Settings → General**:
   - **Root Directory**: `backend`
   - **Watch Paths**: `backend/**`

   **Settings → Deploy**:
   - **Build Command**: 留空（使用 package.json 的 build）
   - **Start Command**: `npx prisma migrate deploy && node dist/index.js`

#### 3.2 配置环境变量

在 **Variables** 标签页添加以下环境变量：

| 变量名 | 值 | 说明 |
|--------|-----|------|
| `DATABASE_URL` | `${{Postgres.DATABASE_URL}}` | 引用数据库服务的连接字符串 |
| `SWAPI_BASE_URL` | `https://open.megaview.com` | Megaview API 地址 |
| `SWAPI_APP_KEY` | `你的 API Key` | Megaview API 密钥 |
| `SWAPI_APP_SECRET` | `你的 API Secret` | Megaview API 密钥 |
| `PORT` | `3005` | 后端服务端口 |
| `NODE_ENV` | `production` | 运行环境 |
| `CRON_SCHEDULE` | `0 5 * * *` | 定时任务规则（每天 5:00） |
| `TIMEZONE` | `Asia/Shanghai` | 时区设置 |
| `ALLOWED_ORIGINS` | 待设置 | 前端域名（稍后更新） |

> 📝 **注意**：`ALLOWED_ORIGINS` 暂时留空，待前端服务创建后再填写。

#### 3.3 生成公共域名
1. 进入 **Settings → Networking**
2. 点击 **"Generate Domain"**
3. 记下生成的域名（例如：`https://backend-production-xxxx.up.railway.app`）

### 步骤 4：创建前端服务

#### 4.1 配置服务
1. 点击 **"+ New"** → **"GitHub Repo"**（选择同一个仓库）
2. 配置以下设置：

   **Service Name**: `frontend`

   **Settings → General**:
   - **Root Directory**: `frontend`
   - **Watch Paths**: `frontend/**`

   **Settings → Deploy**:
   - **Build Command**: 留空（使用 package.json 的 build）
   - **Start Command**: 留空（Railway 自动识别静态文件）

#### 4.2 配置环境变量

在 **Variables** 标签页添加：

| 变量名 | 值 | 说明 |
|--------|-----|------|
| `VITE_API_BASE_URL` | `https://backend-production-xxxx.up.railway.app` | 后端服务域名（步骤 3.3 中记录的） |

> ⚠️ **重要**：确保使用步骤 3.3 中生成的后端域名。

#### 4.3 生成公共域名
1. 进入 **Settings → Networking**
2. 点击 **"Generate Domain"**
3. 记下生成的域名（例如：`https://frontend-production-xxxx.up.railway.app`）

### 步骤 5：更新后端 CORS 配置

1. 回到 **后端服务** 的 Variables 标签页
2. 更新 `ALLOWED_ORIGINS` 环境变量：
   ```
   https://frontend-production-xxxx.up.railway.app,http://localhost:5175
   ```
   （使用步骤 4.3 中生成的前端域名）

3. 保存后，后端服务会自动重新部署

## ✅ 验证部署

### 5.1 检查后端服务

1. **查看部署日志**
   - 进入后端服务的 **Deployments** 标签页
   - 查看最新部署的日志
   - 确认看到以下成功信息：
     ```
     ✓ 配置验证通过
     ✓ 认证服务初始化完成
     ✓ 数据采集服务初始化完成
     ✓ Web服务器已启动
     ✓ 定时任务已启动
     ✓ 系统启动完成！
     ```

2. **测试 API 端点**
   - 访问：`https://your-backend.railway.app/api/groups`
   - 应该返回 JSON 数据（如果有数据）或空数组

### 5.2 检查前端服务

1. **访问前端页面**
   - 访问：`https://your-frontend.railway.app`
   - 页面应该正常加载

2. **测试前后端通信**
   - 打开浏览器开发者工具（F12）
   - 切换到 **Network** 标签页
   - 在前端页面操作，查看 API 请求
   - 确认请求成功且没有 CORS 错误

### 5.3 检查数据库

1. **查看 Prisma 迁移**
   - 在后端服务日志中搜索 "Prisma Migrate"
   - 确认看到迁移成功信息

2. **使用 Prisma Studio（可选）**
   - 在本地项目中配置 Railway 数据库 URL
   - 运行 `npm run prisma:studio`
   - 查看数据库表结构

### 5.4 测试核心功能

1. **手动触发数据采集**
   - 使用 API 工具（如 Postman）或 curl：
     ```bash
     curl -X POST https://your-backend.railway.app/api/collect \
       -H "Content-Type: application/json" \
       -d '{}'
     ```
   - 查看后端日志，确认数据采集流程正常

2. **查看定时任务**
   - 等待到北京时间 5:00（或修改 CRON_SCHEDULE 测试）
   - 查看后端日志，确认定时任务自动执行

## 🔧 常见问题排查

### 问题 1：数据库迁移失败

**症状**：后端服务启动失败，日志显示 Prisma 错误

**解决方案**：
1. 检查 `DATABASE_URL` 环境变量是否正确引用数据库服务
2. 确保 `prisma/migrations` 目录已提交到 Git
3. 在 Railway 后端服务的 Shell 中手动运行：
   ```bash
   npx prisma migrate deploy
   ```

### 问题 2：前端无法访问后端 API

**症状**：浏览器控制台显示 CORS 错误或 Network Error

**解决方案**：
1. 检查前端 `VITE_API_BASE_URL` 是否正确设置为后端域名
2. 检查后端 `ALLOWED_ORIGINS` 是否包含前端域名
3. 在浏览器开发者工具中查看请求的 URL 是否正确
4. 重新部署前端服务（触发重新构建）

### 问题 3：环境变量未生效

**症状**：应用行为与预期不符

**解决方案**：
1. 确认环境变量已正确添加到对应服务
2. 修改环境变量后，Railway 会自动重新部署
3. 对于前端环境变量（`VITE_*`），必须重新构建才能生效
4. 在服务日志中查看环境变量是否正确读取

### 问题 4：定时任务未执行

**症状**：到了预定时间，数据采集未自动运行

**解决方案**：
1. 检查 `CRON_SCHEDULE` 和 `TIMEZONE` 环境变量
2. 查看后端日志，确认看到 "定时任务已启动"
3. 验证 node-cron 表达式是否正确
4. 手动触发一次数据采集测试功能是否正常

### 问题 5：构建超时或失败

**症状**：Railway 部署卡在构建阶段

**解决方案**：
1. 检查 `.railwayignore` 是否正确排除了 `node_modules`
2. 清理 Git 仓库中的大文件
3. 升级到 Railway Pro 计划（更长的构建时间）
4. 在本地测试构建是否成功：
   ```bash
   npm run build
   ```

## 📊 监控和维护

### 日志查看
- Railway 提供实时日志查看
- 路径：服务 → Deployments → 点击部署版本 → View Logs

### 性能监控
- Railway 提供基础的 CPU/内存监控
- 路径：服务 → Metrics

### 数据库备份（推荐）
1. 进入 PostgreSQL 服务
2. Settings → Backups
3. 配置自动备份策略

### 更新部署
- **自动部署**：推送代码到 `main` 分支会自动触发部署
- **手动部署**：在 Railway 控制台点击 "Redeploy"

## 💰 成本估算

基于 Railway 当前定价（2025）：

| 资源 | 预估成本 |
|------|---------|
| 后端服务 | $5-10/月 |
| 前端服务 | $0-5/月 |
| PostgreSQL | $5/月 |
| **总计** | **$10-20/月** |

> 💡 **提示**：使用 Hobby Plan 每月有 $5 免费额度，小型项目可能在免费额度内。

## 🔗 相关链接

- [Railway 官方文档](https://docs.railway.app/)
- [Prisma 部署指南](https://www.prisma.io/docs/guides/deployment)
- [Vite 生产环境部署](https://vitejs.dev/guide/build.html)

## 📝 部署检查清单

部署前：
- [ ] 所有代码已推送到 GitHub
- [ ] `.env` 文件未提交到 Git
- [ ] Prisma migrations 已生成并提交
- [ ] 本地测试构建成功

部署中：
- [ ] Railway 项目已创建
- [ ] PostgreSQL 数据库已添加
- [ ] 后端服务已配置（Root Directory, Watch Paths）
- [ ] 前端服务已配置（Root Directory, Watch Paths）
- [ ] 所有环境变量已设置
- [ ] 后端和前端域名已生成

部署后：
- [ ] 数据库迁移成功
- [ ] 后端 API 返回正常
- [ ] 前端页面可访问
- [ ] 前端可调用后端 API（无 CORS 错误）
- [ ] 定时任务已启动
- [ ] 手动数据采集功能正常

---

**部署完成！** 🎉

如有问题，请查看 [常见问题排查](#-常见问题排查) 或联系技术支持。
