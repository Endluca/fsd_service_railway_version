-- CreateTable
CREATE TABLE "week_conversation_count" (
    "id" SERIAL NOT NULL,
    "week_start" DATE NOT NULL,
    "week_end" DATE NOT NULL,
    "department" VARCHAR(20) NOT NULL,
    "conversation_count" INTEGER NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "week_conversation_count_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "week_conversation_count_week_start_week_end_idx" ON "week_conversation_count"("week_start", "week_end");

-- CreateIndex
CREATE INDEX "week_conversation_count_department_idx" ON "week_conversation_count"("department");

-- CreateIndex
CREATE UNIQUE INDEX "week_conversation_count_week_start_week_end_department_key" ON "week_conversation_count"("week_start", "week_end", "department");
