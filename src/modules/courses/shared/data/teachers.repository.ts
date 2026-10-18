import { prisma } from '@/config/prisma_client';
import type { Prisma } from '@/generated/client';
import type { TeacherInput } from '@/modules/courses/shared/domain/teacher.schema';

export const TEACHER_SELECT = {
  id: true,
  full_name: true,
  biography: true,
  photo_url: true,
} as const satisfies Prisma.teachersSelect;

export const listTeachers = () =>
  prisma.teachers.findMany({
    select: TEACHER_SELECT,
    orderBy: [{ full_name: 'asc' }, { id: 'asc' }],
  });

export const findTeacherById = (id: string) =>
  prisma.teachers.findUnique({
    where: { id },
    select: { id: true },
  });

export const writeCourseTeacher = async (
  tx: Prisma.TransactionClient,
  courseId: string,
  teacher: TeacherInput | null | undefined,
  updatedAt: Date,
): Promise<void> => {
  if (teacher === undefined) {
    return;
  }
  let teacherId: string | null = null;
  if (teacher !== null) {
    const { id, ...data } = teacher;
    const saved =
      id === undefined
        ? await tx.teachers.create({ data, select: { id: true } })
        : await tx.teachers.update({ where: { id }, data, select: { id: true } });
    teacherId = saved.id;
  }
  await tx.courses.update({
    where: { id: courseId },
    data: { teacher_id: teacherId, updated_at: updatedAt },
    select: { id: true },
  });
};
