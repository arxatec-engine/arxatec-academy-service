import { prisma } from '@/config/prisma_client';
import { ExamPolicy } from '@/constants/exams';
import { course_status, lesson_status } from '@/generated/enums';
import { issueCourseCertificate } from './certificates.repository';
import {
  examQuestionsSchema,
  type SaveExamInput,
  type SubmitExamInput,
} from '../domain/exam.schema';
import type { ExamResult } from '../domain/exam.types';
import { isCourseCompleted } from '../policy/completion';
import { gradeExam } from '../policy/grade_exam';

const EXAM_SELECT = {
  id: true,
  version: true,
  enabled: true,
  passing_score: true,
  questions: true,
  updated_at: true,
} as const;
const RESULT_SELECT = { score: true, passed: true, passing_score: true } as const;

export const findCourseExam = (course_id: string) =>
  prisma.course_exams.findUnique({
    where: { course_id },
    select: EXAM_SELECT,
  });

export const saveCourseExam = (course_id: string, input: SaveExamInput) =>
  prisma.$transaction(async (tx) => {
    await tx.$queryRaw`SELECT id FROM courses WHERE id = ${course_id} FOR UPDATE`;
    const course = await tx.courses.findUnique({
      where: { id: course_id },
      select: { status: true },
    });
    if (!course || course.status === course_status.ARCHIVED) {
      return { state: 'archived' as const };
    }
    const current = await tx.course_exams.findUnique({
      where: { course_id },
      select: { version: true },
    });
    if ((current?.version ?? 0) !== input.expected_version) {
      return { state: 'stale' as const };
    }
    const data = {
      enabled: input.enabled,
      passing_score: input.passing_score,
      questions: input.questions,
    };
    const exam = current
      ? await tx.course_exams.update({
          where: { course_id },
          data: { ...data, version: { increment: 1 } },
          select: EXAM_SELECT,
        })
      : await tx.course_exams.create({ data: { ...data, course_id }, select: EXAM_SELECT });
    return { state: 'saved' as const, exam };
  });

export const readExamProgress = async (user_id: string, course_id: string) => {
  const published = { course_id, status: lesson_status.PUBLISHED };
  const [enrollment, lesson_count, completed_count, latest] = await Promise.all([
    prisma.enrollments.findUnique({
      where: { user_id_course_id: { user_id, course_id } },
      select: {
        completed_at: true,
        certificate: { select: { id: true, exam_attempt: { select: RESULT_SELECT } } },
      },
    }),
    prisma.lessons.count({ where: published }),
    prisma.lessons.count({
      where: { ...published, lesson_progress: { some: { user_id, completed_at: { not: null } } } },
    }),
    prisma.exam_attempts.findFirst({
      where: { user_id, course_id },
      select: RESULT_SELECT,
      orderBy: [{ submitted_at: 'desc' }, { id: 'desc' }],
    }),
  ]);
  return {
    enrollment,
    ready:
      enrollment !== null &&
      enrollment.completed_at !== null &&
      isCourseCompleted({
        published_lesson_count: lesson_count,
        completed_lesson_count: completed_count,
      }),
    latest,
  };
};

type SubmissionOutcome =
  | { state: 'unavailable' | 'locked' | 'stale' | 'not_found' }
  | { state: 'graded'; result: ExamResult };

// Lock configuration while grading so edits cannot change the answer key halfway through a submission.
export const submitCourseExam = (
  user_id: string,
  course_id: string,
  input: SubmitExamInput,
): Promise<SubmissionOutcome> =>
  prisma.$transaction(async (tx) => {
    await tx.$queryRaw`SELECT id FROM course_exams WHERE course_id = ${course_id} FOR UPDATE`;
    await tx.$queryRaw`SELECT id FROM enrollments WHERE user_id = ${user_id} AND course_id = ${course_id} FOR UPDATE`;
    const exam = await tx.course_exams.findUnique({ where: { course_id }, select: EXAM_SELECT });
    const enrollment = await tx.enrollments.findUnique({
      where: { user_id_course_id: { user_id, course_id } },
      select: {
        completed_at: true,
        certificate: { select: { id: true, exam_attempt: { select: RESULT_SELECT } } },
        course: {
          select: {
            status: true,
            lessons: { where: { status: lesson_status.PUBLISHED }, select: { id: true } },
          },
        },
      },
    });
    if (enrollment && enrollment.course.status !== course_status.PUBLISHED) {
      return { state: 'not_found' };
    }
    if (enrollment?.certificate) {
      const previous = enrollment.certificate.exam_attempt;
      return {
        state: 'graded',
        result: {
          score: previous?.score ?? null,
          passed: true,
          passing_score: previous?.passing_score ?? ExamPolicy.passing_score,
          question_count: ExamPolicy.question_count,
          certificate_id: enrollment.certificate.id,
        },
      };
    }
    if (!exam?.enabled) {
      return { state: 'unavailable' };
    }
    if (exam.version !== input.version) {
      return { state: 'stale' };
    }
    if (!enrollment?.completed_at) {
      return { state: 'locked' };
    }
    const completed_count = await tx.lesson_progress.count({
      where: {
        user_id,
        lesson_id: { in: enrollment.course.lessons.map((lesson) => lesson.id) },
        completed_at: { not: null },
      },
    });
    if (
      !isCourseCompleted({
        published_lesson_count: enrollment.course.lessons.length,
        completed_lesson_count: completed_count,
      })
    ) {
      return { state: 'locked' };
    }
    const questions = examQuestionsSchema.parse(exam.questions);
    const result = gradeExam(questions, input.answers, exam.passing_score);
    const attempt = await tx.exam_attempts.create({
      data: {
        user_id,
        course_id,
        exam_id: exam.id,
        exam_version: exam.version,
        questions_snapshot: questions,
        answers: input.answers,
        score: result.score,
        passed: result.passed,
        passing_score: exam.passing_score,
      },
      select: { id: true },
    });
    let certificate_id: string | null = null;
    if (result.passed) {
      await issueCourseCertificate(tx, { user_id, course_id }, attempt.id);
      const certificate = await tx.certificates.findUniqueOrThrow({
        where: { user_id_course_id: { user_id, course_id } },
        select: { id: true },
      });
      certificate_id = certificate.id;
    }
    return {
      state: 'graded',
      result: {
        ...result,
        passing_score: exam.passing_score,
        question_count: ExamPolicy.question_count,
        certificate_id,
      },
    };
  });
