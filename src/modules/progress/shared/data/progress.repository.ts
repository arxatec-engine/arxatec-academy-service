import { prisma } from '@/config/prisma_client';
import type { Prisma } from '@/generated/client';
import type {
  EnrollmentRecord,
  LessonProgressRecord,
} from '@/modules/progress/shared/domain/progress.types';
import { isCourseCompleted } from '@/modules/progress/shared/policy/completion';

const ENROLLMENT_SELECT = {
  course_id: true,
  started_at: true,
  completed_at: true,
  last_lesson_id: true,
} as const;

const LESSON_PROGRESS_SELECT = {
  lesson_id: true,
  completed_at: true,
  last_position_seconds: true,
  updated_at: true,
} as const;

export interface EnrollmentKey {
  user_id: string;
  course_id: string;
}

export interface SaveLessonProgressInput {
  user_id: string;
  lesson_id: string;
  last_position_seconds: number;
}

export interface CompleteLessonInput extends EnrollmentKey {
  lesson_id: string;
  published_lesson_ids: readonly string[];
  completed_at: Date;
}

export interface UncompleteLessonInput extends EnrollmentKey {
  lesson_id: string;
}

export interface LessonCompletionResult {
  progress: LessonProgressRecord;
  enrollment: EnrollmentRecord;
}

export const findEnrollment = async ({
  user_id,
  course_id,
}: EnrollmentKey): Promise<EnrollmentRecord | null> =>
  prisma.enrollments.findUnique({
    where: { user_id_course_id: { user_id, course_id } },
    select: ENROLLMENT_SELECT,
  });

export const findEnrollmentsByUser = async (
  user_id: string,
): Promise<readonly EnrollmentRecord[]> =>
  prisma.enrollments.findMany({
    where: { user_id },
    select: ENROLLMENT_SELECT,
    orderBy: { started_at: 'desc' },
  });

export const enrollInCourse = async ({
  user_id,
  course_id,
}: EnrollmentKey): Promise<EnrollmentRecord> => {
  await prisma.enrollments.createMany({ data: { user_id, course_id }, skipDuplicates: true });

  return prisma.enrollments.findUniqueOrThrow({
    where: { user_id_course_id: { user_id, course_id } },
    select: ENROLLMENT_SELECT,
  });
};

export const findCompletedLessonIds = async (
  user_id: string,
  lesson_ids: readonly string[],
): Promise<readonly string[]> => {
  const rows = await prisma.lesson_progress.findMany({
    where: { user_id, lesson_id: { in: [...lesson_ids] }, completed_at: { not: null } },
    select: { lesson_id: true },
  });

  return rows.map((row) => row.lesson_id);
};

export const saveLessonProgress = async ({
  user_id,
  lesson_id,
  last_position_seconds,
}: SaveLessonProgressInput): Promise<LessonProgressRecord> => {
  await prisma.lesson_progress.createMany({
    data: { user_id, lesson_id, last_position_seconds },
    skipDuplicates: true,
  });

  await prisma.lesson_progress.updateMany({
    where: { user_id, lesson_id, last_position_seconds: { lt: last_position_seconds } },
    data: { last_position_seconds },
  });

  return prisma.lesson_progress.findUniqueOrThrow({
    where: { user_id_lesson_id: { user_id, lesson_id } },
    select: LESSON_PROGRESS_SELECT,
  });
};

export const completeLesson = async ({
  user_id,
  lesson_id,
  course_id,
  published_lesson_ids,
  completed_at,
}: CompleteLessonInput): Promise<LessonCompletionResult> =>
  prisma.$transaction(async (tx) => {
    await tx.lesson_progress.createMany({
      data: { user_id, lesson_id, completed_at },
      skipDuplicates: true,
    });

    await tx.lesson_progress.updateMany({
      where: { user_id, lesson_id, completed_at: null },
      data: { completed_at },
    });

    await tx.enrollments.createMany({
      data: { user_id, course_id, last_lesson_id: lesson_id },
      skipDuplicates: true,
    });

    await tx.enrollments.updateMany({
      where: { user_id, course_id },
      data: { last_lesson_id: lesson_id },
    });

    const completed_lesson_count = await tx.lesson_progress.count({
      where: {
        user_id,
        lesson_id: { in: [...published_lesson_ids] },
        completed_at: { not: null },
      },
    });

    if (
      isCourseCompleted({
        published_lesson_count: published_lesson_ids.length,
        completed_lesson_count,
      })
    ) {
      await tx.enrollments.updateMany({
        where: { user_id, course_id, completed_at: null },
        data: { completed_at },
      });
    }

    const progress = await tx.lesson_progress.findUniqueOrThrow({
      where: { user_id_lesson_id: { user_id, lesson_id } },
      select: LESSON_PROGRESS_SELECT,
    });
    const enrollment = await tx.enrollments.findUniqueOrThrow({
      where: { user_id_course_id: { user_id, course_id } },
      select: ENROLLMENT_SELECT,
    });

    return { progress, enrollment };
  });

export const uncompleteLesson = async ({
  user_id,
  lesson_id,
  course_id,
}: UncompleteLessonInput): Promise<EnrollmentRecord | null> =>
  prisma.$transaction(async (tx) => {
    await tx.lesson_progress.updateMany({
      where: { user_id, lesson_id },
      data: { completed_at: null },
    });

    await tx.enrollments.updateMany({
      where: { user_id, course_id },
      data: { completed_at: null },
    });

    return tx.enrollments.findUnique({
      where: { user_id_course_id: { user_id, course_id } },
      select: ENROLLMENT_SELECT,
    });
  });

export const countCompletedEnrollments = async (user_id: string): Promise<number> =>
  prisma.enrollments.count({ where: { user_id, completed_at: { not: null } } });

export const deleteUserProgress = async (
  user_id: string,
  client: Prisma.TransactionClient = prisma,
): Promise<void> => {
  await client.lesson_progress.deleteMany({ where: { user_id } });
  await client.enrollments.deleteMany({ where: { user_id } });
};
