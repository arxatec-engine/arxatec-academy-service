CREATE TABLE "storage_deletions" (
    "file_key" TEXT NOT NULL,
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "next_attempt_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lease_token" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "storage_deletions_pkey" PRIMARY KEY ("file_key")
);

CREATE INDEX "storage_deletions_next_attempt_at_created_at_idx"
ON "storage_deletions"("next_attempt_at", "created_at");

-- Capture detached keys in the same transaction, including cascading deletes.
-- External URLs and legacy rows without a storage key never enter the queue.
CREATE FUNCTION queue_detached_storage_file() RETURNS TRIGGER AS $$
DECLARE
    old_key TEXT;
BEGIN
    old_key := to_jsonb(OLD) ->> TG_ARGV[0];
    IF TG_OP = 'UPDATE' THEN
        IF old_key IS NOT DISTINCT FROM (to_jsonb(NEW) ->> TG_ARGV[0]) THEN
            RETURN NULL;
        END IF;
    END IF;

    IF old_key ~ '^(?:(?:public|private)/)?[a-z0-9_]+/[a-z0-9-]+\.[a-z0-9]+$' THEN
        INSERT INTO "storage_deletions" ("file_key") VALUES (old_key)
        ON CONFLICT ("file_key") DO NOTHING;
    END IF;
    RETURN NULL;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER queue_lesson_resource_file
AFTER DELETE OR UPDATE OF file_key ON "lesson_resources"
FOR EACH ROW EXECUTE FUNCTION queue_detached_storage_file('file_key');

CREATE TRIGGER queue_course_cover_file
AFTER DELETE OR UPDATE OF cover_image_key ON "courses"
FOR EACH ROW EXECUTE FUNCTION queue_detached_storage_file('cover_image_key');

CREATE TRIGGER queue_user_avatar_file
AFTER DELETE OR UPDATE OF avatar_key ON "users"
FOR EACH ROW EXECUTE FUNCTION queue_detached_storage_file('avatar_key');
