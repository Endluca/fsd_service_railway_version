-- AlterTable
ALTER TABLE "daily_metrics" ADD COLUMN     "new_rule_customer_turn_count" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "overtime_no_reply_count" INTEGER NOT NULL DEFAULT 0;

-- AlterTable
ALTER TABLE "date_range_cache" ADD COLUMN     "new_rule_customer_turn_count" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "overtime_no_reply_count" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "overtime_reply_count" INTEGER NOT NULL DEFAULT 0;
