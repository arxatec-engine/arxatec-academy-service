CREATE TABLE "teachers" (
    "id" TEXT NOT NULL,
    "full_name" VARCHAR(120) NOT NULL,
    "biography" TEXT NOT NULL,
    "photo_url" TEXT,
    CONSTRAINT "teachers_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "courses" ADD COLUMN "teacher_id" TEXT;
CREATE INDEX "courses_teacher_id_idx" ON "courses"("teacher_id");
ALTER TABLE "courses" ADD CONSTRAINT "courses_teacher_id_fkey"
    FOREIGN KEY ("teacher_id") REFERENCES "teachers"("id") ON DELETE SET NULL ON UPDATE CASCADE;
