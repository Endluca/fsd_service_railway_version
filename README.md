# 51Talk CM团队服务及时性监控看板

## 项目简介

这是一个为51Talk客户经理（CM）团队打造的服务及时性监控看板系统。系统自动采集和分析客户对话数据，统计销售人员的响应速度和服务质量指标。

## 核心功能

- **自动数据采集**：每天北京时间5点自动采集前一天的对话数据
- **多维度统计**：
  - 客户发言总轮次
  - 及时回复率（≤1小时）
  - 超时回复率（>1小时）
  - 平均回复时长
- **灵活筛选**：支持按日期范围、小组、销售人员筛选数据
- **智能缓存**：相同日期范围的查询结果自动缓存，提升查询速度

## 技术栈

### 后端
- **Node.js + TypeScript**：现代化的JavaScript运行时
- **Express**：Web框架
- **Prisma**：类型安全的ORM
- **PostgreSQL**：关系型数据库
- **node-cron**：定时任务调度
- **axios**：HTTP客户端

### 前端
- **React + TypeScript**：组件化UI框架
- **Ant Design**：企业级UI组件库
- **Vite**：快速的前端构建工具
- **dayjs**：轻量级日期处理库

## 项目结构

```
bashboard/
├── backend/                 # 后端服务
│   ├── prisma/
│   │   └── schema.prisma   # 数据库模型定义
│   ├── src/
│   │   ├── config/         # 配置管理
│   │   ├── services/       # 业务逻辑
│   │   │   ├── auth.ts     # API鉴权（token自动刷新）
│   │   │   ├── swApi.ts    # 深维API调用封装
│   │   │   ├── analyzer.ts # ASR数据分析
│   │   │   ├── dataCollector.ts  # 数据采集
│   │   │   ├── scheduler.ts      # 定时任务
│   │   │   ├── salesSync.ts      # 销售信息同步
│   │   │   └── dataService.ts    # 数据查询服务
│   │   ├── routes/         # API路由
│   │   └── index.ts        # 入口文件
│   ├── package.json
│   └── .env               # 环境变量配置
├── frontend/              # 前端应用
│   ├── src/
│   │   ├── components/    # React组件
│   │   ├── services/      # API调用
│   │   ├── types/         # TypeScript类型定义
│   │   ├── App.tsx        # 主页面
│   │   └── main.tsx       # 入口文件
│   └── package.json
├── 人员信息.md            # 销售人员和小组信息
└── README.md             # 项目文档
```

## 数据库设计

### 1. sales_person（销售人员信息表）
- `open_user_id`：深维平台用户ID（主键）
- `name`：销售姓名
- `group_name`：所属小组

### 2. daily_metrics（每日元数据表）
- `date`：数据日期
- `open_user_id`：销售ID
- `customer_turn_count`：客户发言总轮次
- `timely_reply_count`：及时回复轮次
- `overtime_reply_count`：超时回复轮次
- `total_reply_duration`：总回复时间（秒）

### 3. date_range_cache（日期范围缓存表）
- `start_date` + `end_date` + `open_user_id`：缓存键
- 预计算的各项指标

### 4. api_tokens（API令牌管理表）
- `access_token`：访问令牌
- `expires_at`：过期时间

## 部署指南

### 1. 环境要求

- Node.js >= 18.x
- PostgreSQL >= 14.x
- npm 或 yarn

### 2. 安装依赖

```bash
# 后端
cd backend
npm install

# 前端
cd ../frontend
npm install
```

### 3. 配置环境变量

复制 `backend/.env.example` 为 `backend/.env`，并填写以下配置：

```env
# 数据库配置
DATABASE_URL="postgresql://username:password@localhost:5432/bashboard?schema=public"

# 深维API配置（从密钥信息.json获取）
SWAPI_BASE_URL="https://open.megaview.com"
SWAPI_APP_KEY="your_app_key"
SWAPI_APP_SECRET="your_app_secret"

# 服务器配置
PORT=3005
NODE_ENV=production

# 定时任务配置（北京时间每天5点）
CRON_SCHEDULE="0 5 * * *"
TIMEZONE="Asia/Shanghai"
```

### 4. 初始化数据库

```bash
cd backend

# 生成Prisma Client
npm run prisma:generate

# 运行数据库迁移
npm run prisma:migrate
```

### 5. 启动服务

#### 开发模式

```bash
# 后端（端口3005）
cd backend
npm run dev

# 前端（端口5175）
cd frontend
npm run dev
```

访问：http://localhost:5175

#### 生产模式

```bash
# 构建前端
cd frontend
npm run build

# 构建后端
cd ../backend
npm run build

# 启动后端
npm start
```

### 6. 使用PM2管理进程（推荐）

```bash
# 安装PM2
npm install -g pm2

# 启动后端
cd backend
pm2 start dist/index.js --name "bashboard-backend"

# 查看日志
pm2 logs bashboard-backend

# 设置开机自启
pm2 startup
pm2 save
```

## API文档

### 数据查询接口

#### 查询数据看板
```
GET /api/dashboard
Query Parameters:
  - startDate: 开始日期 (YYYY-MM-DD)
  - endDate: 结束日期 (YYYY-MM-DD)
  - groupName: 小组名称（可选）
  - openUserId: 销售ID（可选）

Response:
{
  "code": 0,
  "message": "success",
  "data": [
    {
      "openUserId": "xxx",
      "name": "张三",
      "groupName": "EGLP06小组",
      "customerTurnCount": 100,
      "timelyReplyRate": 85.5,
      "overtimeReplyRate": 14.5,
      "avgReplyDuration": 45.2,
      "conversationCount": 50
    }
  ]
}
```

#### 获取小组列表
```
GET /api/groups

Response:
{
  "code": 0,
  "message": "success",
  "data": ["EGLP06小组", "EGLP07小组", ...]
}
```

#### 获取销售列表
```
GET /api/sales
Query Parameters:
  - groupName: 小组名称（可选，不传则返回所有销售）

Response:
{
  "code": 0,
  "message": "success",
  "data": [
    {
      "openUserId": "xxx",
      "name": "张三",
      "groupName": "EGLP06小组"
    }
  ]
}
```

### 数据采集接口

#### 1. 手动触发单日数据采集
```
POST /api/collect

Body (可选):
{
  "date": "2025-11-10"  // 不传则采集昨天的数据
}

说明：
- 不传date参数：采集昨天2点到今天2点的数据
- 传date参数：采集指定日期2点到次日2点的数据

Response:
{
  "code": 0,
  "message": "数据采集完成"
}

示例：
# 采集昨天的数据
curl -X POST http://localhost:3005/api/collect

# 采集指定日期的数据
curl -X POST http://localhost:3005/api/collect \
  -H "Content-Type: application/json" \
  -d '{"date": "2025-11-10"}'
```

#### 2. 批量采集日期范围数据
```
POST /api/collect-range

Body (必填):
{
  "startDate": "2025-11-01",  // 开始日期
  "endDate": "2025-11-10"     // 结束日期
}

说明：
- 会循环采集每一天的数据
- 自动跳过已存在的数据
- 返回采集结果统计

Response:
{
  "code": 0,
  "message": "批量数据采集完成",
  "data": {
    "total": 10,        // 总天数
    "success": 9,       // 成功天数
    "failed": 1,        // 失败天数
    "failedDates": ["2025-11-05"]  // 失败的日期列表
  }
}

示例：
curl -X POST http://localhost:3005/api/collect-range \
  -H "Content-Type: application/json" \
  -d '{"startDate": "2025-11-01", "endDate": "2025-11-10"}'
```

### 系统接口

#### 健康检查
```
GET /api/health

Response:
{
  "code": 0,
  "message": "OK",
  "data": {
    "status": "healthy",
    "timestamp": "2025-11-11T08:00:00.000Z"
  }
}
```

## 数据采集逻辑

### 时间范围
每天北京时间5点执行，采集**昨天2点到今天2点**的24小时数据。

例如：2025-08-16 05:00 执行时，采集 2025-08-15 02:00:00 至 2025-08-16 02:00:00 的数据。

### 会话筛选
只采集 `type = "doc"` 的IM会话。

### 轮次识别
- **轮次定义**：同一角色的连续发言算一轮
- **特殊规则**：
  1. 如果会话首轮是销售发言，忽略该轮
  2. 如果客户最后一轮没有销售回复，该轮不计入客户发言轮次

### 回复时间计算
- **公式**：销售本轮第一句的 `begin_time` - 客户上一轮最后一句的 `begin_time`
- **及时回复**：回复时间 ≤ 1小时
- **超时回复**：回复时间 > 1小时

### 指标计算
- **及时回复率** = 及时回复次数 / 客户发言总轮次 × 100%
- **超时回复率** = 超时回复次数 / 客户发言总轮次 × 100%
- **平均回复时长** = 总回复时间 / 客户发言总轮次（单位：分钟）

## 常见问题

### 1. 数据库连接失败
确保PostgreSQL服务正在运行，并且DATABASE_URL配置正确。

### 2. API请求失败
检查深维API密钥是否正确，网络是否可以访问 `https://open.megaview.com`。

### 3. 定时任务未执行
- 检查服务器时区是否设置为Asia/Shanghai
- 查看后端日志确认任务是否被触发
- 可以通过 `POST /api/collect` 手动触发数据采集进行测试

### 4. 前端无法访问后端
确保后端服务已启动，端口3005未被占用。前端代理配置在 `frontend/vite.config.ts`。

### 5. 如何手动补采历史数据
使用批量采集接口：
```bash
# 采集2025年11月1日到10日的数据
curl -X POST http://localhost:3005/api/collect-range \
  -H "Content-Type: application/json" \
  -d '{"startDate": "2025-11-01", "endDate": "2025-11-10"}'
```

### 6. 如何重新采集某一天的数据
先删除该日期的数据，再重新采集：
```bash
# 1. 在数据库中删除该日期的记录
psql -d bashboard -c "DELETE FROM daily_metrics WHERE date = '2025-11-10';"
psql -d bashboard -c "DELETE FROM date_range_cache WHERE start_date <= '2025-11-10' AND end_date >= '2025-11-10';"

# 2. 重新采集
curl -X POST http://localhost:3005/api/collect \
  -H "Content-Type: application/json" \
  -d '{"date": "2025-11-10"}'
```

## 维护建议

1. **定期备份数据库**：每天自动备份PostgreSQL数据
2. **监控磁盘空间**：ASR数据可能较大，注意磁盘使用情况
3. **查看日志**：定期检查应用日志，及时发现问题
4. **更新依赖**：定期更新npm包以修复安全漏洞

## 开发团队

- 开发者：Claude Code
- 技术支持：请联系系统管理员

## 许可证

MIT License
