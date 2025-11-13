-- CreateTable
CREATE TABLE "sales_person" (
    "id" SERIAL NOT NULL,
    "open_user_id" VARCHAR(100) NOT NULL,
    "name" VARCHAR(100) NOT NULL,
    "group_name" VARCHAR(100),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "sales_person_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "daily_metrics" (
    "id" SERIAL NOT NULL,
    "date" DATE NOT NULL,
    "open_user_id" VARCHAR(100) NOT NULL,
    "customer_turn_count" INTEGER NOT NULL DEFAULT 0,
    "timely_reply_count" INTEGER NOT NULL DEFAULT 0,
    "overtime_reply_count" INTEGER NOT NULL DEFAULT 0,
    "total_reply_duration" BIGINT NOT NULL DEFAULT 0,
    "processed_conversation_ids" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "daily_metrics_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "date_range_cache" (
    "id" SERIAL NOT NULL,
    "start_date" DATE NOT NULL,
    "end_date" DATE NOT NULL,
    "open_user_id" VARCHAR(100) NOT NULL,
    "customer_turn_count" INTEGER NOT NULL,
    "timely_reply_rate" DECIMAL(5,2) NOT NULL,
    "overtime_reply_rate" DECIMAL(5,2) NOT NULL,
    "avg_reply_duration" DECIMAL(10,2) NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "date_range_cache_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "api_tokens" (
    "id" SERIAL NOT NULL,
    "token_type" VARCHAR(50) NOT NULL DEFAULT 'app_access_token',
    "access_token" TEXT NOT NULL,
    "expires_at" TIMESTAMP(3) NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "api_tokens_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "sales_person_open_user_id_key" ON "sales_person"("open_user_id");

-- CreateIndex
CREATE INDEX "daily_metrics_date_idx" ON "daily_metrics"("date");

-- CreateIndex
CREATE INDEX "daily_metrics_open_user_id_idx" ON "daily_metrics"("open_user_id");

-- CreateIndex
CREATE UNIQUE INDEX "daily_metrics_date_open_user_id_key" ON "daily_metrics"("date", "open_user_id");

-- CreateIndex
CREATE INDEX "date_range_cache_start_date_end_date_idx" ON "date_range_cache"("start_date", "end_date");

-- CreateIndex
CREATE UNIQUE INDEX "date_range_cache_start_date_end_date_open_user_id_key" ON "date_range_cache"("start_date", "end_date", "open_user_id");

-- AddForeignKey
ALTER TABLE "daily_metrics" ADD CONSTRAINT "daily_metrics_open_user_id_fkey" FOREIGN KEY ("open_user_id") REFERENCES "sales_person"("open_user_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "date_range_cache" ADD CONSTRAINT "date_range_cache_open_user_id_fkey" FOREIGN KEY ("open_user_id") REFERENCES "sales_person"("open_user_id") ON DELETE RESTRICT ON UPDATE CASCADE;
