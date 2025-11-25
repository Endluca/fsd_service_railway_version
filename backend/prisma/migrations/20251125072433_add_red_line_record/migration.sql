-- CreateTable
CREATE TABLE "red_line_record" (
    "id" SERIAL NOT NULL,
    "conversation_id" VARCHAR(200) NOT NULL,
    "customer" VARCHAR(200) NOT NULL,
    "sales" VARCHAR(200) NOT NULL,
    "department" VARCHAR(20) NOT NULL,
    "original_department" VARCHAR(200) NOT NULL,
    "red_line_type" VARCHAR(200) NOT NULL,
    "content" TEXT NOT NULL,
    "week_start" DATE NOT NULL,
    "week_end" DATE NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "red_line_record_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "red_line_record_week_start_week_end_idx" ON "red_line_record"("week_start", "week_end");

-- CreateIndex
CREATE INDEX "red_line_record_department_idx" ON "red_line_record"("department");

-- CreateIndex
CREATE INDEX "red_line_record_sales_idx" ON "red_line_record"("sales");

-- CreateIndex
CREATE INDEX "red_line_record_conversation_id_idx" ON "red_line_record"("conversation_id");

-- CreateIndex
CREATE UNIQUE INDEX "red_line_record_week_start_week_end_conversation_id_red_lin_key" ON "red_line_record"("week_start", "week_end", "conversation_id", "red_line_type");
