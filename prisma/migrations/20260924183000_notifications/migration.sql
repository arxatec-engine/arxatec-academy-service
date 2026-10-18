CREATE TABLE "notification_signups" (
  "id" TEXT NOT NULL,
  "email" VARCHAR(254) NOT NULL,
  "course_id" TEXT,
  "user_id" TEXT,
  "notified_at" TIMESTAMP(3),
  "ip_hash" VARCHAR(64),
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "notification_signups_pkey" PRIMARY KEY ("id")
);
CREATE TABLE "topic_requests" (
  "id" TEXT NOT NULL,
  "email" VARCHAR(254) NOT NULL,
  "search_term" VARCHAR(120) NOT NULL,
  "search_term_normalized" VARCHAR(120) NOT NULL,
  "request_count" INTEGER NOT NULL DEFAULT 1,
  "user_id" TEXT,
  "ip_hash" VARCHAR(64),
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "last_requested_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "topic_requests_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "notification_signups_email_course_id_key" ON "notification_signups"("email", "course_id");
CREATE UNIQUE INDEX "notification_signups_email_catalog_key" ON "notification_signups"("email") WHERE "course_id" IS NULL;
CREATE INDEX "notification_signups_course_id_notified_at_idx" ON "notification_signups"("course_id", "notified_at");
CREATE INDEX "notification_signups_user_id_idx" ON "notification_signups"("user_id");
CREATE UNIQUE INDEX "topic_requests_email_search_term_normalized_key" ON "topic_requests"("email", "search_term_normalized");
CREATE INDEX "topic_requests_search_term_normalized_idx" ON "topic_requests"("search_term_normalized");
CREATE INDEX "topic_requests_user_id_idx" ON "topic_requests"("user_id");
ALTER TABLE "notification_signups" ADD CONSTRAINT "notification_signups_course_id_fkey" FOREIGN KEY ("course_id") REFERENCES "courses"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "notification_signups" ADD CONSTRAINT "notification_signups_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "topic_requests" ADD CONSTRAINT "topic_requests_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
