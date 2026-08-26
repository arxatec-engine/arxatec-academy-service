-- CreateEnum
CREATE TYPE "course_topic" AS ENUM ('FIRST_STEPS', 'LEGAL_ENGINEERING', 'APPLIED_AI', 'ARXATEC_PRODUCT');

-- CreateEnum
CREATE TYPE "course_level" AS ENUM ('INTRODUCTORY', 'INTERMEDIATE');

-- CreateEnum
CREATE TYPE "course_status" AS ENUM ('DRAFT', 'PUBLISHED', 'ARCHIVED');

-- CreateEnum
CREATE TYPE "lesson_type" AS ENUM ('VIDEO', 'ARTICLE');

-- CreateEnum
CREATE TYPE "lesson_status" AS ENUM ('DRAFT', 'PUBLISHED');

-- CreateEnum
CREATE TYPE "video_provider" AS ENUM ('VIMEO');

-- CreateTable
CREATE TABLE "courses" (
    "id" TEXT NOT NULL,
    "slug" VARCHAR(160) NOT NULL,
    "title" VARCHAR(140) NOT NULL,
    "short_description" VARCHAR(140) NOT NULL,
    "long_description" TEXT NOT NULL,
    "topic" "course_topic" NOT NULL,
    "level" "course_level" NOT NULL,
    "cover_image_url" TEXT,
    "status" "course_status" NOT NULL DEFAULT 'DRAFT',
    "catalog_order" INTEGER NOT NULL,
    "published_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "courses_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "lessons" (
    "id" TEXT NOT NULL,
    "course_id" TEXT NOT NULL,
    "slug" VARCHAR(160) NOT NULL,
    "title" VARCHAR(160) NOT NULL,
    "description" TEXT NOT NULL,
    "type" "lesson_type" NOT NULL,
    "position" INTEGER NOT NULL,
    "is_free_sample" BOOLEAN NOT NULL DEFAULT false,
    "status" "lesson_status" NOT NULL DEFAULT 'DRAFT',
    "video_provider" "video_provider",
    "video_external_id" VARCHAR(64),
    "duration_seconds" INTEGER,
    "article_body" TEXT,
    "article_word_count" INTEGER,
    "reading_minutes" INTEGER,
    "transcript" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "lessons_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "lesson_resources" (
    "id" TEXT NOT NULL,
    "lesson_id" TEXT NOT NULL,
    "title" VARCHAR(160) NOT NULL,
    "file_url" TEXT NOT NULL,
    "mime_type" VARCHAR(128) NOT NULL,
    "size_bytes" INTEGER NOT NULL,
    "position" INTEGER NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "lesson_resources_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "courses_slug_key" ON "courses"("slug");

-- CreateIndex
CREATE INDEX "courses_status_catalog_order_idx" ON "courses"("status", "catalog_order");

-- CreateIndex
CREATE INDEX "courses_topic_idx" ON "courses"("topic");

-- CreateIndex
CREATE INDEX "courses_level_idx" ON "courses"("level");

-- CreateIndex
CREATE INDEX "lessons_course_id_status_idx" ON "lessons"("course_id", "status");

-- CreateIndex
CREATE UNIQUE INDEX "lessons_course_id_slug_key" ON "lessons"("course_id", "slug");

-- CreateIndex
CREATE UNIQUE INDEX "lessons_course_id_position_key" ON "lessons"("course_id", "position");

-- CreateIndex
CREATE INDEX "lesson_resources_lesson_id_idx" ON "lesson_resources"("lesson_id");

-- CreateIndex
CREATE UNIQUE INDEX "lesson_resources_lesson_id_position_key" ON "lesson_resources"("lesson_id", "position");

-- AddForeignKey
ALTER TABLE "lessons" ADD CONSTRAINT "lessons_course_id_fkey" FOREIGN KEY ("course_id") REFERENCES "courses"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "lesson_resources" ADD CONSTRAINT "lesson_resources_lesson_id_fkey" FOREIGN KEY ("lesson_id") REFERENCES "lessons"("id") ON DELETE CASCADE ON UPDATE CASCADE;
