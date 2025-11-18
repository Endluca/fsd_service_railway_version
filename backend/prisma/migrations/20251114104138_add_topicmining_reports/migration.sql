-- CreateTable
CREATE TABLE "reports" (
    "id" TEXT NOT NULL,
    "title" VARCHAR(255) NOT NULL,
    "summary" TEXT,
    "statistics_json" JSONB NOT NULL,
    "samples_json" JSONB NOT NULL,
    "metadata_json" JSONB,
    "generated_at" TIMESTAMP(3) NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "reports_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "reports_created_at_idx" ON "reports"("created_at" DESC);
