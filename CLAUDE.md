# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

This is a **51Talk CM Team Service Timeliness Monitoring Dashboard** - a full-stack TypeScript application that automatically collects and analyzes customer conversation data to monitor sales representatives' response times and service quality. The system consists of a Node.js/Express backend with PostgreSQL (via Prisma ORM) and a React/Ant Design frontend.

## Project Structure

This is a monorepo with two main applications:

```
├── backend/          # Node.js/Express API server
│   ├── prisma/       # Database schema and migrations
│   ├── src/
│   │   ├── config/   # Database and environment config
│   │   ├── services/ # Core business logic
│   │   ├── routes/   # API endpoints
│   │   └── utils/    # Helper utilities
│   └── package.json
└── frontend/         # React/Vite SPA
    ├── src/
    │   ├── services/ # API client
    │   ├── types/    # TypeScript definitions
    │   └── App.tsx   # Main dashboard UI
    └── package.json
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

### Data Flow

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
   - `DailyMetric`: Raw daily data per sales rep
   - `DateRangeCache`: Pre-calculated aggregates for date ranges
   - `ApiToken`: Auto-refreshing access tokens for SW API

4. **Query Layer** (`dataService.ts`)
   - Checks `DateRangeCache` first for performance
   - Falls back to aggregating `DailyMetric` if not cached
   - Caches new queries for future use

### External API Integration

- **SW API Client** (`swApi.ts`): Wrapper for Megaview (深维) API
- **Authentication** (`auth.ts`): Auto-refreshes app access tokens stored in DB
- **Sales Sync** (`salesSync.ts`): Loads group assignments from `人员信息.md`

### Frontend Architecture

- **Single-page dashboard** (`App.tsx`): Ant Design Table with filters
- **API Service** (`services/api.ts`): Axios client proxied through Vite
- **Proxy Config**: Vite proxies `/api/*` to `http://localhost:3005` (see `vite.config.ts`)

## Key Business Logic

### Reply Time Calculation
- Time between customer's last message in their turn and salesperson's first message in response turn
- "Turn" = consecutive messages by same speaker (not individual messages)

### Metrics Calculated
- **Customer Turn Count**: Number of customer speaking turns (excluding unresponded last turn)
- **Timely Reply Rate**: (timely_count / customer_turn_count) × 100%
- **Overtime Reply Rate**: (overtime_count / customer_turn_count) × 100%
- **Average Reply Duration**: total_reply_duration / customer_turn_count (in minutes)

### Caching Strategy
- Date range queries are expensive (join across multiple `DailyMetric` rows)
- System caches results in `DateRangeCache` table
- Cache key: `(start_date, end_date, open_user_id)`
- Always check cache first before querying raw metrics

## Environment Configuration

Backend requires `.env` file:
```env
DATABASE_URL="postgresql://user:pass@localhost:5432/bashboard?schema=public"
SWAPI_BASE_URL="https://open.megaview.com"
SWAPI_APP_KEY="your_app_key"
SWAPI_APP_SECRET="your_app_secret"
PORT=3005
CRON_SCHEDULE="0 5 * * *"  # 5 AM daily
TIMEZONE="Asia/Shanghai"
```

## Important Implementation Notes

### When Working with Services
- All service files export singleton instances (lowercase names), not classes
- Example: `import authService from './services/auth'` (not `new AuthService()`)
- Services are initialized in sequence during `bootstrap()` in `index.ts`

### When Modifying Database Schema
1. Edit `backend/prisma/schema.prisma`
2. Run `npm run prisma:migrate` to create migration
3. Run `npm run prisma:generate` to update Prisma client types
4. Restart backend dev server

### When Adding API Endpoints
- Add routes to `backend/src/routes/index.ts`
- Routes are mounted at `/api/*`
- All responses follow format: `{ code: number, message?: string, data?: any }`

### When Modifying Data Collection Logic
- Core analysis in `analyzer.ts` - handles turn detection and reply time calculation
- Data fetching in `dataCollector.ts` - orchestrates API calls and DB updates
- Changes here affect historical data interpretation - consider cache invalidation

### Testing Data Collection
- Manual trigger: `POST /api/collect` with optional `{ date: "YYYY-MM-DD" }`
- Use this for testing without waiting for scheduled run
- Check backend console logs for detailed collection progress

## Production Deployment

Recommended: Use PM2 for process management
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

- **Database connection errors**: Verify PostgreSQL is running and `DATABASE_URL` is correct
- **API authentication failures**: Check `SWAPI_APP_KEY` and `SWAPI_APP_SECRET` in `.env`
- **Cron job not running**: Verify server timezone is `Asia/Shanghai` or adjust `CRON_SCHEDULE`
- **Frontend can't reach backend**: Ensure backend is running on port 3005 (Vite proxy target)
- **Prisma errors**: Run `npm run prisma:generate` after pulling schema changes
