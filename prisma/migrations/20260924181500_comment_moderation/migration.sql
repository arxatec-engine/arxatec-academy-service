ALTER TABLE "comments" ADD COLUMN "hidden_at" TIMESTAMP(3);
ALTER TABLE "comments" ADD COLUMN "hidden_by_user_id" TEXT;
ALTER TABLE "comments" ADD COLUMN "deleted_at" TIMESTAMP(3);
ALTER TABLE "comments" ADD COLUMN "deleted_by_user_id" TEXT;
ALTER TABLE "comment_reports" ADD COLUMN "reviewed_at" TIMESTAMP(3);
ALTER TABLE "comment_reports" ADD COLUMN "reviewed_by_user_id" TEXT;

ALTER TABLE "comments" ADD CONSTRAINT "comments_hidden_by_user_id_fkey"
  FOREIGN KEY ("hidden_by_user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "comments" ADD CONSTRAINT "comments_deleted_by_user_id_fkey"
  FOREIGN KEY ("deleted_by_user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "comment_reports" ADD CONSTRAINT "comment_reports_reviewed_by_user_id_fkey"
  FOREIGN KEY ("reviewed_by_user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

CREATE INDEX "comments_status_created_at_idx" ON "comments"("status", "created_at");
CREATE INDEX "comments_status_hidden_at_idx" ON "comments"("status", "hidden_at");
CREATE INDEX "comment_reports_comment_id_reviewed_at_idx" ON "comment_reports"("comment_id", "reviewed_at");
