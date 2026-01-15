# AGENTS.md - AI编码助手指南

## 项目概述

51Talk CM团队服务及时性监控看板是一个全栈数据分析和监控系统，专门为51Talk客户经理（CM）团队设计。系统通过自动化数据采集、对话分析和可视化展示，帮助团队监控销售人员的客户服务质量指标。

**核心功能模块：**
- **服务及时性监控**：统计销售人员对客户的响应速度（≤1小时为及时回复）
- **话题挖掘分析**：对对话内容进行话题分类和趋势分析  
- **红线违规检测**：识别销售对话中的违规内容
- **愤怒小鸟记录**：识别和统计客户负面情绪对话
- **社交媒体监控**：监控品牌相关的社媒讨论

## 技术栈

### 后端架构
- **运行时**：Node.js 20+ + TypeScript
- **Web框架**：Express.js
- **数据库**：PostgreSQL + Prisma ORM
- **定时任务**：node-cron
- **外部API**：深维API（Megaview）用于数据采集
- **部署平台**：Railway（推荐）

### 前端架构  
- **框架**：React 18 + TypeScript
- **构建工具**：Vite
- **UI组件库**：Ant Design
- **状态管理**：Zustand
- **图表库**：Ant Design Charts + D3.js
- **日期处理**：dayjs

### 数据存储
- **主数据库**：PostgreSQL（业务数据、指标统计）
- **缓存机制**：PostgreSQL表级缓存（date_range_cache）

## 项目结构

```
bashboard/
├── backend/                     # 后端服务
│   ├── prisma/
│   │   ├── schema.prisma       # 数据库模型定义
│   │   └── migrations/         # 数据库迁移文件
│   ├── src/
│   │   ├── config/             # 配置管理
│   │   │   ├── index.ts        # 环境变量配置
│   │   │   └── prisma.ts       # Prisma客户端配置
│   │   ├── routes/             # API路由
│   │   │   ├── index.ts        # 主路由入口
│   │   │   ├── angrybird/      # 愤怒小鸟功能路由
│   │   │   ├── redline/        # 红线功能路由
│   │   │   ├── socialmedia/    # 社媒监控路由
│   │   │   └── topicmining/    # 话题挖掘路由
│   │   ├── services/           # 业务逻辑服务
│   │   │   ├── auth.ts         # API认证（token管理）
│   │   │   ├── swApi.ts        # 深维API调用封装
│   │   │   ├── analyzer.ts     # ASR对话分析引擎
│   │   │   ├── dataCollector.ts # 数据采集服务
│   │   │   ├── scheduler.ts    # 定时任务调度
│   │   │   ├── salesSync.ts    # 销售人员信息同步
│   │   │   ├── dataService.ts  # 数据查询服务
│   │   │   ├── angrybird/      # 愤怒小鸟业务逻辑
│   │   │   ├── redline/        # 红线检测业务逻辑
│   │   │   ├── socialmedia/    # 社媒监控业务逻辑
│   │   │   └── topicmining/    # 话题挖掘业务逻辑
│   │   ├── types/              # TypeScript类型定义
│   │   ├── utils/              # 工具函数
│   │   └── index.ts            # 应用入口
│   ├── nixpacks.toml          # Railway部署配置
│   └── package.json
├── frontend/                    # 前端应用
│   ├── src/
│   │   ├── components/         # 可复用组件
│   │   │   └── Layout/         # 布局组件
│   │   ├── pages/              # 页面组件
│   │   │   ├── Dashboard/      # 服务及时性看板
│   │   │   ├── Trend/          # 趋势分析
│   │   │   ├── TopicMining/    # 话题挖掘
│   │   │   ├── RedLine/        # 红线检测
│   │   │   ├── AngryBird/      # 愤怒小鸟
│   │   │   └── SocialMedia/    # 社媒监控
│   │   ├── services/           # API调用服务
│   │   ├── stores/             # 状态管理
│   │   ├── types/              # TypeScript类型
│   │   ├── App.tsx             # 主应用组件
│   │   └── main.tsx            # 应用入口
│   ├── vite.config.ts         # Vite配置
│   └── package.json
├── scripts/                     # 运维脚本
│   ├── export-data.sh          # 数据导出脚本
│   ├── import-to-railway.sh    # 数据导入Railway脚本
│   ├── clear-railway-db.sh     # 清空Railway数据库脚本
│   └── fast-*.sh               # 快速导入导出脚本
├── 人员信息.md                 # 销售人员和小组信息
└── README.md                   # 项目文档
```

## 数据库设计

### 核心表结构

#### sales_person（销售人员信息表）
- `open_user_id`：深维平台用户ID（主键）
- `name`：销售姓名
- `group_name`：所属小组

#### daily_metrics（每日元数据表）
- `date`：数据日期
- `open_user_id`：销售ID（外键）
- `customer_turn_count`：客户发言总轮次（旧规则）
- `timely_reply_count`：及时回复轮次（≤1小时）
- `overtime_reply_count`：超时回复轮次（>1小时）
- `total_reply_duration`：总回复时间（秒）
- `new_rule_customer_turn_count`：新规则总消息数
- `overtime_no_reply_count`：超时未回复数

#### date_range_cache（日期范围缓存表）
预计算的日期范围指标，提升查询性能

#### 业务扩展表
- `reports`：话题挖掘报告
- `red_line_record`：红线违规记录
- `angry_bird_record`：客户负面情绪记录
- `week_conversation_count`：周会话总数统计

## 核心业务流程

### 1. 数据采集流程（每日自动）
```
定时任务触发 → 计算时间范围 → 调用深维API → 分析对话数据 → 存储指标 → 更新缓存
```

**时间规则**：每天北京时间5点执行，采集**昨天2点到今天2点**的24小时数据

**轮次识别规则**：
- 同一角色的连续发言算一轮
- 会话首轮如果是销售发言，忽略该轮
- 客户最后一轮如果没有销售回复，不计入客户发言轮次

**回复时间计算**：销售本轮第一句的begin_time - 客户上一轮最后一句的begin_time

### 2. 指标计算逻辑
- **及时回复率** = 及时回复次数 / 客户发言总轮次 × 100%
- **超时回复率** = 超时回复次数 / 客户发言总轮次 × 100%  
- **平均回复时长** = 总回复时间 / 客户发言总轮次（单位：分钟）

### 3. 数据缓存策略
- 相同日期范围的查询结果自动缓存到`date_range_cache`表
- 缓存键：start_date + end_date + open_user_id
- 数据更新时自动清除相关缓存

## 环境配置

### 后端环境变量（backend/.env）
```env
# 数据库配置
DATABASE_URL="postgresql://username:password@localhost:5432/bashboard?schema=public"

# 深维API配置
SWAPI_BASE_URL="https://open.megaview.com"
SWAPI_APP_KEY="your_app_key"
SWAPI_APP_SECRET="your_app_secret"

# 服务器配置
PORT=3005
NODE_ENV=production

# 定时任务配置（北京时间每天5点）
CRON_SCHEDULE="0 5 * * *"
TIMEZONE="Asia/Shanghai"

# Apify API 配置（社媒监控）
APIFY_API_TOKEN="your_apify_api_token"

# CORS配置（Railway部署时）
ALLOWED_ORIGINS="https://your-frontend.railway.app,http://localhost:5175"
```

### 前端环境变量（frontend/.env.production）
```env
VITE_API_BASE_URL=https://your-backend-service.railway.app
```

## 开发指南

### 本地开发启动

#### 后端开发
```bash
cd backend
npm install
npm run dev        # 启动开发服务器（端口3005）
```

#### 前端开发
```bash
cd frontend
npm install
npm run dev        # 启动开发服务器（端口5175）
```

### 数据库操作

#### 生成迁移
```bash
cd backend
npm run prisma:generate  # 生成Prisma Client
npm run prisma:migrate   # 创建并应用迁移
```

#### 数据库GUI工具
```bash
npm run prisma:studio    # 打开Prisma Studio
```

### 构建和部署

#### 本地构建
```bash
# 前端构建
cd frontend
npm run build

# 后端构建
cd backend
npm run build
```

#### Railway部署
项目已配置Nixpacks，支持自动部署到Railway：
- 后端服务：自动运行数据库迁移和启动
- 前端服务：自动构建静态文件

详细部署步骤参考：`DEPLOYMENT.md`

## 代码规范

### TypeScript规范
- 严格模式启用（strict: true）
- 所有接口必须定义明确的类型
- 数据库模型使用Prisma生成类型
- 业务逻辑必须包含错误处理

### 命名约定
- **文件命名**：使用PascalCase（组件）或camelCase（工具函数）
- **变量命名**：camelCase
- **常量命名**：UPPER_SNAKE_CASE
- **接口命名**：I前缀或清晰的后缀（如Service、Repository）

### 目录结构规范
- 按功能模块组织代码（不是按技术层次）
- 每个主要功能有独立的service目录
- 共享工具放在utils目录
- 类型定义集中在types目录

## 测试策略

当前项目采用**手动测试**为主：
- API接口通过Postman或curl测试
- 前端功能通过浏览器手动验证
- 定时任务通过手动触发测试

**测试数据准备**：
- 使用真实深维API数据进行集成测试
- 本地开发可手动触发数据采集验证

## 监控和日志

### 日志规范
- 使用console.log进行关键操作记录
- 错误使用console.error并包含堆栈信息
- 定时任务执行记录开始和结束时间
- API请求记录方法和路径

### 健康检查
- 提供`/api/health`端点用于健康检查
- 返回服务状态和时间戳

## 安全和性能

### 安全考虑
- 环境变量必须配置，不允许硬编码敏感信息
- CORS配置通过环境变量控制，生产环境需明确指定域名
- API请求包含数据大小限制（50MB）

### 性能优化
- 数据库查询使用索引优化
- 日期范围查询结果自动缓存
- 批量处理使用并发控制（batchProcess工具）
- 前端构建启用代码分割和压缩

## 故障排查

### 常见问题

1. **数据库连接失败**
   - 检查PostgreSQL服务是否运行
   - 验证DATABASE_URL配置
   - 确认数据库存在且用户有权限

2. **API认证失败**
   - 检查SWAPI_APP_KEY和SWAPI_APP_SECRET
   - 确认API密钥未过期
   - 验证网络能否访问深维API

3. **定时任务未执行**
   - 检查时区设置（Asia/Shanghai）
   - 验证CRON表达式格式
   - 查看后端日志确认任务启动

4. **前端无法访问后端**
   - 检查CORS配置（ALLOWED_ORIGINS）
   - 验证VITE_API_BASE_URL设置
   - 确认后端服务正常运行

## 数据迁移

项目提供完整的数据迁移脚本：
- `scripts/export-data.sh`：导出本地数据
- `scripts/import-to-railway.sh`：导入到Railway
- `scripts/clear-railway-db.sh`：清空Railway数据库

详细迁移步骤参考：`MIGRATION.md`

## 扩展开发

### 新增功能模块
1. 在backend/src/services/创建新服务目录
2. 在backend/src/routes/创建对应路由
3. 在frontend/src/pages/创建前端页面
4. 更新主路由配置

### 数据库扩展
1. 修改prisma/schema.prisma
2. 生成迁移：npm run prisma:migrate
3. 更新相关服务逻辑
4. 前端同步更新类型定义

## 项目维护

### 定期维护任务
- 监控磁盘空间（ASR数据可能较大）
- 检查定时任务执行状态
- 备份PostgreSQL数据
- 更新npm依赖包

### 性能监控
- 数据库查询性能监控
- API响应时间监控
- 前端加载性能优化

---

**开发团队**：AI效率中心 - 杨世文
**技术支持**：系统管理员
**许可证**：MIT License