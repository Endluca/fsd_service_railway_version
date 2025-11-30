-- CreateTable
CREATE TABLE "angry_bird_record" (
    "id" SERIAL NOT NULL,
    "conversation_id" VARCHAR(200) NOT NULL,
    "conversation_start_time" TIMESTAMP NOT NULL,
    "customer" VARCHAR(200) NOT NULL,
    "sales" VARCHAR(200) NOT NULL,
    "department" VARCHAR(20) NOT NULL,
    "original_department" VARCHAR(200) NOT NULL,
    "customer_emotion" VARCHAR(200) NOT NULL,
    "content" TEXT NOT NULL,
    "week_start" DATE NOT NULL,
    "week_end" DATE NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "angry_bird_record_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "angry_bird_record_week_start_week_end_idx" ON "angry_bird_record"("week_start", "week_end");

-- CreateIndex
CREATE INDEX "angry_bird_record_department_idx" ON "angry_bird_record"("department");

-- CreateIndex
CREATE INDEX "angry_bird_record_sales_idx" ON "angry_bird_record"("sales");

-- CreateIndex
CREATE INDEX "angry_bird_record_customer_emotion_idx" ON "angry_bird_record"("customer_emotion");

-- CreateIndex
CREATE INDEX "angry_bird_record_conversation_id_idx" ON "angry_bird_record"("conversation_id");

-- CreateIndex
CREATE UNIQUE INDEX "angry_bird_record_week_start_week_end_conversation_id_key" ON "angry_bird_record"("week_start", "week_end", "conversation_id");
