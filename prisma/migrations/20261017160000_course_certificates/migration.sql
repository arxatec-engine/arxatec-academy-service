CREATE TABLE "certificates" (
    "id" UUID NOT NULL,
    "user_id" TEXT NOT NULL,
    "course_id" TEXT NOT NULL,
    "recipient_name" VARCHAR(120) NOT NULL,
    "course_title" VARCHAR(140) NOT NULL,
    "completed_at" TIMESTAMP(3) NOT NULL,
    "issued_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "certificates_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "certificates_user_id_course_id_key" ON "certificates"("user_id", "course_id");

ALTER TABLE "certificates" ADD CONSTRAINT "certificates_user_id_course_id_fkey"
    FOREIGN KEY ("user_id", "course_id") REFERENCES "enrollments"("user_id", "course_id")
    ON DELETE CASCADE ON UPDATE CASCADE;

-- Preserve completions earned before certificates were introduced.
INSERT INTO "certificates" ("id", "user_id", "course_id", "recipient_name", "course_title", "completed_at")
SELECT gen_random_uuid(), e."user_id", e."course_id", u."full_name", c."title", e."completed_at"
FROM "enrollments" e
JOIN "users" u ON u."id" = e."user_id"
JOIN "courses" c ON c."id" = e."course_id"
WHERE e."completed_at" IS NOT NULL;
