CREATE TABLE "course_exams" (
  "id" TEXT NOT NULL,
  "course_id" TEXT NOT NULL,
  "version" INTEGER NOT NULL DEFAULT 1,
  "enabled" BOOLEAN NOT NULL DEFAULT false,
  "passing_score" INTEGER NOT NULL DEFAULT 12,
  "questions" JSONB NOT NULL,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "course_exams_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "course_exams_question_count" CHECK (jsonb_typeof("questions") = 'array' AND jsonb_array_length("questions") = 15),
  CONSTRAINT "course_exams_passing_score" CHECK ("passing_score" BETWEEN 1 AND 15),
  CONSTRAINT "course_exams_version" CHECK ("version" >= 1)
);
CREATE UNIQUE INDEX "course_exams_course_id_key" ON "course_exams"("course_id");
ALTER TABLE "course_exams" ADD CONSTRAINT "course_exams_course_id_fkey" FOREIGN KEY ("course_id") REFERENCES "courses"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "exam_attempts" (
  "id" TEXT NOT NULL,
  "exam_id" TEXT NOT NULL,
  "user_id" TEXT NOT NULL,
  "course_id" TEXT NOT NULL,
  "exam_version" INTEGER NOT NULL,
  "questions_snapshot" JSONB NOT NULL,
  "answers" JSONB NOT NULL,
  "score" INTEGER NOT NULL,
  "passing_score" INTEGER NOT NULL,
  "passed" BOOLEAN NOT NULL,
  "submitted_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "exam_attempts_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "exam_attempts_answer_count" CHECK (jsonb_typeof("answers") = 'array' AND jsonb_array_length("answers") = 15),
  CONSTRAINT "exam_attempts_question_count" CHECK (jsonb_typeof("questions_snapshot") = 'array' AND jsonb_array_length("questions_snapshot") = 15),
  CONSTRAINT "exam_attempts_score" CHECK ("score" BETWEEN 0 AND 15 AND "passing_score" BETWEEN 1 AND 15 AND "passed" = ("score" >= "passing_score"))
);
CREATE INDEX "exam_attempts_user_id_course_id_submitted_at_idx" ON "exam_attempts"("user_id", "course_id", "submitted_at");
CREATE INDEX "exam_attempts_exam_id_idx" ON "exam_attempts"("exam_id");
ALTER TABLE "exam_attempts" ADD CONSTRAINT "exam_attempts_exam_id_fkey" FOREIGN KEY ("exam_id") REFERENCES "course_exams"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "exam_attempts" ADD CONSTRAINT "exam_attempts_user_id_course_id_fkey" FOREIGN KEY ("user_id", "course_id") REFERENCES "enrollments"("user_id", "course_id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "certificates" ADD COLUMN "exam_attempt_id" TEXT;
CREATE UNIQUE INDEX "certificates_exam_attempt_id_key" ON "certificates"("exam_attempt_id");
ALTER TABLE "certificates" ADD CONSTRAINT "certificates_exam_attempt_id_fkey" FOREIGN KEY ("exam_attempt_id") REFERENCES "exam_attempts"("id") ON DELETE SET NULL ON UPDATE CASCADE;
