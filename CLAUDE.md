# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

This is a **51Talk CM Team Service Timeliness Monitoring Dashboard** - a full-stack TypeScript application with two main modules:

1. **Service Timeliness Monitoring**: Automatically collects and analyzes customer conversation data to monitor sales representatives' response times and service quality
2. **Topic Mining Reports**: Analyzes CSV exports from Megaview platform to generate professional topic analysis reports with visualizations and AI-generated summaries

The system consists of a Node.js/Express backend with PostgreSQL (via Prisma ORM) and a React/Ant Design frontend.

## Key API Endpoints

### Timeliness Monitoring APIs
- `GET /api/groups` - List all sales groups
- `GET /api/sales` - List all sales people
- `GET /api/metrics?startDate=YYYY-MM-DD&endDate=YYYY-MM-DD&groupName=...` - Query metrics
- `POST /api/collect` - Manually trigger data collection (optional: `{ date: "YYYY-MM-DD" }`)
- `POST /api/sales/sync` - Sync sales people from `人员信息.md`

### Topic Mining APIs
- `POST /api/topicmining/analyze` - Analyze CSV data
- `POST /api/topicmining/reports` - Save report
- `GET /api/topicmining/reports` - List saved reports
- `GET /api/topicmining/reports/:id` - Get report by ID
- `DELETE /api/topicmining/reports/:id` - Delete report

### Health Check
- `GET /api/health` - Service health status

All API responses follow format:
```json
{
  "code": 0,           // 0 = success, non-zero = error
  "message": "OK",     // Status message
  "data": { ... }      // Response payload
}
```

## Project Structure

This is a monorepo with two main applications:

```
├── backend/          # Node.js/Express API server
│   ├── prisma/       # Database schema and migrations
│   │   └── schema.prisma          # Database models
│   ├── src/
│   │   ├── config/   # Database and environment config
│   │   ├── services/ # Core business logic (singleton pattern)
│   │   │   ├── dataCollector.ts   # Timeliness data collection orchestrator
│   │   │   ├── analyzer.ts        # ASR data analysis (turn detection, reply time)
│   │   │   ├── dataService.ts     # Query layer with caching strategy
│   │   │   ├── auth.ts            # Megaview API token management
│   │   │   ├── swApi.ts           # Megaview API client wrapper
│   │   │   ├── salesSync.ts       # Sync sales data from 人员信息.md
│   │   │   ├── scheduler.ts       # Cron job scheduler
│   │   │   ├── trendService.ts    # Trend analysis calculations
│   │   │   └── topicmining/       # Topic mining services
│   │   │       ├── csvParser.ts   # CSV parsing logic
│   │   │       ├── statistics.ts  # Category statistics calculations
│   │   │       └── reportService.ts  # Report CRUD operations
│   │   ├── routes/   # API endpoints
│   │   │   ├── index.ts           # Main routes + timeliness APIs
│   │   │   └── topicmining/       # Topic mining routes
│   │   ├── types/    # TypeScript type definitions
│   │   └── utils/    # Helper utilities
│   └── package.json
├── frontend/         # React/Vite SPA
│   ├── src/
│   │   ├── components/Layout/      # Main layout components
│   │   ├── pages/
│   │   │   ├── Dashboard/          # Service timeliness dashboard
│   │   │   ├── Trend/              # Trend analysis page
│   │   │   └── TopicMining/        # Topic mining report generator
│   │   │       ├── components/     # Topic mining UI components
│   │   │       │   ├── CsvUploader.tsx       # CSV upload & parse
│   │   │       │   ├── ChartViewer.tsx       # D3.js pie charts
│   │   │       │   ├── StatisticsPanel.tsx   # Statistics display
│   │   │       │   └── ReportGenerator.tsx   # Report generation UI
│   │   ├── services/               # API clients
│   │   │   └── api.ts              # Axios instance with proxy
│   │   ├── types/                  # TypeScript definitions
│   │   └── App.tsx                 # Main app with routing
│   └── package.json
├── 人员信息.md       # Sales team roster (synced to database on startup)
├── CLAUDE.md         # This file - Claude Code guidance
├── DEPLOYMENT.md     # Detailed Railway deployment guide
├── MIGRATION.md      # Database migration to Railway guide
└── scripts/          # Utility scripts (database export, etc.)
```

## Development Commands

### Backend (port 3005)
```bash
cd backend
npm install
npm run dev                # Start dev server with hot reload
npm run build              # Compile TypeScript to dist/
npm start                  # Run production build
npm run prisma:generate    # Generate Prisma client
npm run prisma:migrate     # Run database migrations
npm run prisma:studio      # Open Prisma Studio GUI
```

### Frontend (port 5175)
```bash
cd frontend
npm install
npm run dev        # Start Vite dev server
npm run build      # Build for production
npm run preview    # Preview production build
npm run lint       # Run ESLint
```

## Core Architecture

### Module 1: Service Timeliness Monitoring

#### Data Flow

1. **Scheduled Collection** (Daily at 5:00 AM Beijing Time)
   - `scheduler.ts` triggers `dataCollector.ts`
   - Collects conversations from yesterday 2:00 AM to today 2:00 AM
   - Only processes `type = "doc"` (IM) conversations

2. **ASR Analysis Pipeline** (`analyzer.ts`)
   - Groups consecutive messages by speaker into "turns"
   - Special rules:
     - Ignores first turn if salesperson speaks first
     - Excludes customer's last turn if no sales reply follows
   - Calculates reply time: `sales_turn.begin_time - customer_turn_last_message.begin_time`
   - Categorizes: Timely (≤1 hour) vs Overtime (>1 hour)

3. **Data Storage** (Prisma models in `schema.prisma`)
   - `SalesPerson`: Sales rep info with group assignment
     - `openUserId`: Unique identifier from Megaview system
     - `groupName`: Team/group assignment (synced from `人员信息.md`)
   - `DailyMetric`: Raw daily data per sales rep
     - `customerTurnCount`: Number of customer speaking turns (旧规则)
     - `newRuleCustomerTurnCount`: Total customer messages (新规则)
     - `overtimeReplyCount`: Replied but >1 hour
     - `overtimeNoReplyCount`: Never replied and >1 hour since last customer message
     - `processedConversationIds`: Array of conversation IDs to prevent duplicate processing
   - `DateRangeCache`: Pre-calculated aggregates for date ranges
     - Stores pre-aggregated results for common date range queries
     - Significantly improves dashboard performance
   - `ApiToken`: Auto-refreshing access tokens for SW API
     - `expiresAt`: Token expiration timestamp
   - `Report`: Topic mining report storage (see Topic Mining Module)

4. **Query Layer** (`dataService.ts`)
   - Checks `DateRangeCache` first for performance
   - Falls back to aggregating `DailyMetric` if not cached
   - Caches new queries for future use

### Module 2: Topic Mining Reports

#### Data Flow

1. **CSV Upload & Parsing** (`CsvUploader.tsx`)
   - User uploads CSV file exported from Megaview platform
   - Frontend parses CSV using PapaParse library
   - Validates required columns: `话题名称`, `所属父类`, `所属子类`, `上下文片段`

2. **Statistical Analysis** (`topicmining/analyzer.ts`)
   - Calculates parent category distribution (count & percentage)
   - For each parent category, calculates child category distribution
   - Identifies top 4 parent categories by volume
   - Extracts representative samples for each category

3. **Visualization** (`ChartViewer.tsx`)
   - D3.js-powered interactive pie charts
   - One chart for parent category distribution
   - Individual charts for child categories within top 4 parents
   - Hover interactions show detailed statistics

4. **Report Generation** (`ReportGenerator.tsx`)
   - Generates structured HTML report with statistics and charts
   - Optionally calls LLM API to generate executive summary
   - User can edit report title and summary

5. **Data Persistence** (`Report` model in `schema.prisma`)
   - Reports saved to PostgreSQL database
   - Stores: title, summary, statistics JSON, samples JSON, metadata
   - Backend API: `/api/topicmining/reports/*`

### External API Integration

- **SW API Client** (`swApi.ts`): Wrapper for Megaview (深维) API
- **Authentication** (`auth.ts`): Auto-refreshes app access tokens stored in DB
- **Sales Sync** (`salesSync.ts`): Loads group assignments from `人员信息.md`

### Frontend Architecture

- **Multi-page SPA** (`App.tsx`): React Router with 3 main routes
  - `/dashboard`: Service timeliness monitoring with Ant Design Table
  - `/trend`: Trend analysis with line charts
  - `/topicmining`: Topic mining report generator
- **Layout**: `MainLayout` component wraps all pages with navigation menu
- **API Service** (`services/api.ts`): Axios client proxied through Vite
- **Proxy Config**: Vite proxies `/api/*` to `http://localhost:3005` (see `vite.config.ts`)
- **Visualization Libraries**:
  - `@ant-design/charts`: Used for trend analysis charts
  - `d3`: Used for topic mining pie charts
  - `papaparse`: CSV parsing for topic mining

## Key Business Logic

### Service Timeliness Module

#### Reply Time Calculation
- Time between customer's last message in their turn and salesperson's first message in response turn
- "Turn" = consecutive messages by same speaker (not individual messages)

#### Metrics Calculated
- **Customer Turn Count**: Number of customer speaking turns (excluding unresponded last turn)
- **Timely Reply Rate**: (timely_count / customer_turn_count) × 100%
- **Overtime Reply Rate**: (overtime_count / customer_turn_count) × 100%
- **Average Reply Duration**: total_reply_duration / customer_turn_count (in minutes)

#### Caching Strategy
- Date range queries are expensive (join across multiple `DailyMetric` rows)
- System caches results in `DateRangeCache` table
- Cache key: `(start_date, end_date, open_user_id)`
- Always check cache first before querying raw metrics

### Topic Mining Module

#### CSV Data Requirements
Expected columns from Megaview export:
- `来源会话ID`: Conversation ID
- `来源会话名称`: Conversation name
- `话题名称`: Topic name (required)
- `所属父类`: Parent category (required)
- `所属子类`: Child category (required)
- `话题回应`: Topic response
- `上下文片段`: Context snippet (required)

#### Analysis Algorithm
1. **Parent Category Statistics**:
   - Count occurrences of each parent category
   - Calculate percentage: (category_count / total_records) × 100%
   - Sort by count descending

2. **Child Category Statistics**:
   - For each parent category, count child categories
   - Calculate percentage within parent: (child_count / parent_count) × 100%
   - Calculate percentage in total: (child_count / total_records) × 100%

3. **Sample Extraction**:
   - Extract representative samples for each category
   - Prioritize samples with longer context snippets
   - Deduplicate by topic name

#### Report Structure
- **Title**: User-defined or auto-generated
- **Executive Summary**: User-written or LLM-generated
- **Overall Statistics**: Total records, date range, parent distribution
- **Detailed Analysis**: For each top 4 parent categories:
  - Parent statistics with pie chart
  - Child category breakdown with pie chart
  - Representative sample topics (up to 10 per category)

## Environment Configuration

Backend requires `.env` file:
```env
# Database
DATABASE_URL="postgresql://user:pass@localhost:5432/bashboard?schema=public"

# Megaview API
SWAPI_BASE_URL="https://open.megaview.com"
SWAPI_APP_KEY="your_app_key"
SWAPI_APP_SECRET="your_app_secret"

# Server
PORT=3005
NODE_ENV="development"

# CORS - comma-separated list of allowed origins
ALLOWED_ORIGINS="http://localhost:5175,https://your-frontend-domain.railway.app"

# Cron
CRON_SCHEDULE="0 5 * * *"  # 5 AM daily (Beijing Time)
TIMEZONE="Asia/Shanghai"
```

Frontend (Vite) environment variables (optional):
```env
# API endpoint - defaults to Vite proxy in dev mode
VITE_API_BASE_URL="http://localhost:3005"  # or Railway backend URL in production
```

## Important Implementation Notes

### When Working with Services
- All service files export singleton instances (lowercase names), not classes
- Example: `import authService from './services/auth'` (not `new AuthService()`)
- Services are initialized in sequence during `bootstrap()` in `index.ts`
- Bootstrap order: validateConfig() → authService → dataCollector → Express → scheduler

### When Modifying Database Schema
1. Edit `backend/prisma/schema.prisma`
2. Run `npm run prisma:migrate` to create migration
3. Run `npm run prisma:generate` to update Prisma client types
4. Restart backend dev server

### When Adding API Endpoints
- For timeliness monitoring: Add routes to `backend/src/routes/index.ts`
- For topic mining: Add routes to `backend/src/routes/topicmining/`
- All routes are mounted at `/api/*` (configured in `backend/src/index.ts`)
- All responses follow format: `{ code: number, message?: string, data?: any }`
- Error responses: `code` > 0 indicates error; `message` contains error description
- Success responses: `code` = 0; `data` contains result payload

### When Modifying Data Collection Logic (Timeliness Module)
- Core analysis in `analyzer.ts` - handles turn detection and reply time calculation
- Data fetching in `dataCollector.ts` - orchestrates API calls and DB updates
- Changes here affect historical data interpretation - consider cache invalidation

### When Working with Topic Mining Module
- **Frontend data flow**: CSV parsing happens entirely in browser (no server upload)
- **Analysis logic**: `backend/src/services/topicmining/analyzer.ts` contains statistical algorithms
- **Report storage**: Reports saved to PostgreSQL via `/api/topicmining/reports` endpoint
- **Chart rendering**: D3.js charts are generated client-side in `ChartViewer.tsx`
- **Type definitions**: Topic mining types are in `backend/src/types/topicmining.ts` and `frontend/src/types/topicmining.ts`

### Testing Data Collection (Timeliness Module)
- Manual trigger: `POST /api/collect` with optional `{ date: "YYYY-MM-DD" }`
- Use this for testing without waiting for scheduled run
- Check backend console logs for detailed collection progress

### Testing Topic Mining Reports
- Use sample CSV file from Megaview platform export
- Test with various data sizes (small: 100 records, medium: 1000, large: 20000+)
- Verify chart rendering for categories with many children (>10)
- Test report saving/loading from database via API endpoints

### Local Development Setup
1. **Database Setup**:
   ```bash
   # Install PostgreSQL if not already installed
   # Create database
   createdb bashboard

   # Run migrations
   cd backend
   npm run prisma:migrate
   ```

2. **Start Backend**:
   ```bash
   cd backend
   npm install
   npm run dev  # Runs on http://localhost:3005
   ```

3. **Start Frontend** (in separate terminal):
   ```bash
   cd frontend
   npm install
   npm run dev  # Runs on http://localhost:5175
   ```

4. **Sync Sales Data** (first time setup):
   - Ensure `人员信息.md` exists in project root with sales team data
   - Backend auto-syncs on startup
   - Manual trigger: POST to `/api/sales/sync`

## Production Deployment

### Railway Deployment (Recommended)

This project is optimized for Railway deployment with a monorepo structure. See `DEPLOYMENT.md` for comprehensive Railway setup guide.

**Quick Deploy Steps**:
1. Create empty Railway project with PostgreSQL database
2. Add backend service (GitHub repo, root: `backend`, watch: `backend/**`)
3. Add frontend service (GitHub repo, root: `frontend`, watch: `frontend/**`)
4. Configure environment variables and generate domains
5. Update CORS settings with frontend domain

**Critical Railway Settings**:
- Backend Start Command: `npx prisma migrate deploy && node dist/index.js`
- Frontend needs `VITE_API_BASE_URL` pointing to backend domain
- Backend needs `ALLOWED_ORIGINS` with frontend domain
- Watch Paths must use absolute paths from repo root

**Data Migration to Railway**:
See `MIGRATION.md` for detailed steps to migrate local PostgreSQL data to Railway:
```bash
# Export local data
pg_dump -h localhost -U postgres -d bashboard --data-only --column-inserts > local_data.sql

# Import to Railway
psql "Railway_DATABASE_URL" < local_data.sql
```

### Alternative: PM2 Deployment

For VPS/dedicated server deployment:
```bash
# Build both apps
cd frontend && npm run build
cd ../backend && npm run build

# Start with PM2
cd backend
pm2 start dist/index.js --name "bashboard-backend"
pm2 startup  # Configure auto-start
pm2 save
```

Frontend build output goes to `frontend/dist/` - serve with nginx or similar.

## Troubleshooting

### Common Issues - All Modules

- **Database connection errors**: Verify PostgreSQL is running and `DATABASE_URL` is correct
- **Frontend can't reach backend**: Ensure backend is running on port 3005 (Vite proxy target)
- **Prisma errors**: Run `npm run prisma:generate` after pulling schema changes

### Service Timeliness Module

- **API authentication failures**: Check `SWAPI_APP_KEY` and `SWAPI_APP_SECRET` in `.env`
- **Cron job not running**: Verify server timezone is `Asia/Shanghai` or adjust `CRON_SCHEDULE`
- **Missing data for certain dates**: Check if data collection job failed; manually trigger with `POST /api/collect`
- **Incorrect metrics**: Verify ASR data format from Megaview API matches expected structure in `analyzer.ts`

### Railway Deployment Issues

- **502 Error on frontend**:
  - Check Start Command uses `$PORT` variable: `npm run preview -- --host 0.0.0.0 --port $PORT`
  - Verify `VITE_API_BASE_URL` is set to backend domain (without `/api` suffix)
  - Ensure Build Command is set: `npm run build`
- **Backend 404 is normal**: Root path `/` returns 404; use `/api/*` endpoints instead
- **Build plan errors with Railpack**:
  - Don't use "Deploy from GitHub repo" auto-detect for monorepos
  - Create empty project first, then manually add services with Root Directory set
- **Watch Paths critical**: Must use absolute paths from repo root (e.g., `backend/**` not `**`)
- **CORS errors**: Update backend `ALLOWED_ORIGINS` with frontend domain after deployment

### Topic Mining Module

- **CSV parsing errors**:
  - Ensure CSV is exported from Megaview with correct encoding (UTF-8)
  - Verify required columns exist: `话题名称`, `所属父类`, `所属子类`, `上下文片段`
  - Check for malformed CSV (unclosed quotes, inconsistent column counts)
- **Charts not rendering**:
  - Check browser console for D3.js errors
  - Verify data contains valid numeric values
  - Ensure parent categories have at least 1 record
- **Report save failures**:
  - Check PostgreSQL connection
  - Verify `Report` table exists (run migrations if needed)
  - Check if JSON data exceeds PostgreSQL's JSON size limits
- **LLM API errors** (if using AI summary generation):
  - Verify API key is valid
  - Check network connectivity to LLM provider
  - Ensure request doesn't exceed token limits
  - Fallback: User can manually write summary if API fails
