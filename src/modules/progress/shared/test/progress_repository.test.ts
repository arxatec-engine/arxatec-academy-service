jest.mock('@/modules/progress/shared/data/certificates.repository', () => ({
  issueCourseCertificate: jest.fn(),
}));

jest.mock('@/config/prisma_client', () => {
  const client: Record<string, unknown> = {
    enrollments: {
      findUnique: jest.fn(),
      findUniqueOrThrow: jest.fn(),
      findMany: jest.fn(),
      createMany: jest.fn(),
      updateMany: jest.fn(),
      deleteMany: jest.fn(),
      count: jest.fn(),
    },
    lesson_progress: {
      findMany: jest.fn(),
      findUniqueOrThrow: jest.fn(),
      createMany: jest.fn(),
      updateMany: jest.fn(),
      deleteMany: jest.fn(),
      count: jest.fn(),
    },
  };

  client['$transaction'] = jest.fn((run: (tx: unknown) => unknown) => run(client));

  return { prisma: client };
});

import { prisma } from '@/config/prisma_client';
import { issueCourseCertificate } from '@/modules/progress/shared/data/certificates.repository';
import {
  completeLesson,
  countCompletedEnrollments,
  deleteUserProgress,
  enrollInCourse,
  findCompletedLessonIds,
  findEnrollmentsByUser,
  saveLessonProgress,
  uncompleteLesson,
} from '@/modules/progress/shared/data/progress.repository';

const enrollmentsCreateMany = jest.spyOn(prisma.enrollments, 'createMany');
const enrollmentsUpdateMany = jest.spyOn(prisma.enrollments, 'updateMany');
const enrollmentsFindMany = jest.spyOn(prisma.enrollments, 'findMany');
const enrollmentsFindUnique = jest.spyOn(prisma.enrollments, 'findUnique');
const enrollmentsFindUniqueOrThrow = jest.spyOn(prisma.enrollments, 'findUniqueOrThrow');
const progressCreateMany = jest.spyOn(prisma.lesson_progress, 'createMany');
const progressUpdateMany = jest.spyOn(prisma.lesson_progress, 'updateMany');
const progressFindMany = jest.spyOn(prisma.lesson_progress, 'findMany');
const progressFindUniqueOrThrow = jest.spyOn(prisma.lesson_progress, 'findUniqueOrThrow');
const progressCount = jest.spyOn(prisma.lesson_progress, 'count');

const ENROLLMENT_SELECT = {
  certificate: { select: { id: true } },
  course_id: true,
  started_at: true,
  completed_at: true,
  last_lesson_id: true,
};

const LESSON_PROGRESS_SELECT = {
  lesson_id: true,
  completed_at: true,
  last_position_seconds: true,
  updated_at: true,
};

const PROGRESS_ROW = {
  id: 'prg_1',
  user_id: 'usr_1',
  lesson_id: 'les_3',
  completed_at: null,
  last_position_seconds: 252,
  updated_at: new Date('2026-07-02T10:00:05.000Z'),
};

const ENROLLMENT_ROW = {
  id: 'enr_1',
  user_id: 'usr_1',
  course_id: 'crs_1',
  started_at: new Date('2026-07-01T10:00:00.000Z'),
  completed_at: null,
  last_lesson_id: 'les_3',
};

const COMPLETED_AT = new Date('2026-07-03T00:00:00.000Z');

beforeEach(() => {
  jest.clearAllMocks();
  enrollmentsCreateMany.mockResolvedValue({ count: 1 });
  enrollmentsUpdateMany.mockResolvedValue({ count: 1 });
  enrollmentsFindMany.mockResolvedValue([]);
  enrollmentsFindUnique.mockResolvedValue(null);
  enrollmentsFindUniqueOrThrow.mockResolvedValue(ENROLLMENT_ROW);
  progressCreateMany.mockResolvedValue({ count: 1 });
  progressUpdateMany.mockResolvedValue({ count: 1 });
  progressFindMany.mockResolvedValue([]);
  progressFindUniqueOrThrow.mockResolvedValue(PROGRESS_ROW);
  progressCount.mockResolvedValue(0);
});

describe('saveLessonProgress · el upsert que aguanta la carrera', () => {
  it('inserta con ON CONFLICT DO NOTHING en vez de mirar antes si la fila existe', async () => {
    await saveLessonProgress({ user_id: 'usr_1', lesson_id: 'les_3', last_position_seconds: 252 });

    expect(progressCreateMany).toHaveBeenCalledWith({
      data: { user_id: 'usr_1', lesson_id: 'les_3', last_position_seconds: 252 },
      skipDuplicates: true,
    });
  });

  it('el minuto solo avanza: el UPDATE lleva el guardo lt en el where', async () => {
    await saveLessonProgress({ user_id: 'usr_1', lesson_id: 'les_3', last_position_seconds: 252 });

    expect(progressUpdateMany).toHaveBeenCalledWith({
      where: { user_id: 'usr_1', lesson_id: 'les_3', last_position_seconds: { lt: 252 } },
      data: { last_position_seconds: 252 },
    });
  });

  it('devuelve la fila con select explícito', async () => {
    const progress = await saveLessonProgress({
      user_id: 'usr_1',
      lesson_id: 'les_3',
      last_position_seconds: 252,
    });

    expect(progressFindUniqueOrThrow).toHaveBeenCalledWith({
      where: { user_id_lesson_id: { user_id: 'usr_1', lesson_id: 'les_3' } },
      select: LESSON_PROGRESS_SELECT,
    });
    expect(progress).toEqual(PROGRESS_ROW);
  });
});

describe('enrollInCourse · idempotente', () => {
  it('no lanza si la inscripción ya existe: inserta saltando duplicados', async () => {
    await enrollInCourse({ user_id: 'usr_1', course_id: 'crs_1' });

    expect(enrollmentsCreateMany).toHaveBeenCalledWith({
      data: { user_id: 'usr_1', course_id: 'crs_1' },
      skipDuplicates: true,
    });
    expect(enrollmentsFindUniqueOrThrow).toHaveBeenCalledWith({
      where: { user_id_course_id: { user_id: 'usr_1', course_id: 'crs_1' } },
      select: ENROLLMENT_SELECT,
    });
  });
});

describe('completeLesson · la última que faltaba', () => {
  it('sella la lección solo si no estaba sellada y no reescribe la fecha', async () => {
    await completeLesson({
      user_id: 'usr_1',
      lesson_id: 'les_3',
      course_id: 'crs_1',
      published_lesson_ids: ['les_1', 'les_2', 'les_3'],
      completed_at: COMPLETED_AT,
    });

    expect(progressUpdateMany).toHaveBeenCalledWith({
      where: { user_id: 'usr_1', lesson_id: 'les_3', completed_at: null },
      data: { completed_at: COMPLETED_AT },
    });
  });

  it('cuenta las completadas SOLO entre las publicadas de ese momento', async () => {
    await completeLesson({
      user_id: 'usr_1',
      lesson_id: 'les_3',
      course_id: 'crs_1',
      published_lesson_ids: ['les_1', 'les_2', 'les_3'],
      completed_at: COMPLETED_AT,
    });

    expect(progressCount).toHaveBeenCalledWith({
      where: {
        user_id: 'usr_1',
        lesson_id: { in: ['les_1', 'les_2', 'les_3'] },
        completed_at: { not: null },
      },
    });
  });

  it('si faltan lecciones, no sella el curso', async () => {
    progressCount.mockResolvedValue(2);

    await completeLesson({
      user_id: 'usr_1',
      lesson_id: 'les_3',
      course_id: 'crs_1',
      published_lesson_ids: ['les_1', 'les_2', 'les_3'],
      completed_at: COMPLETED_AT,
    });

    expect(enrollmentsUpdateMany).toHaveBeenCalledTimes(1);
    expect(issueCourseCertificate).not.toHaveBeenCalled();
    expect(enrollmentsUpdateMany).toHaveBeenCalledWith({
      where: { user_id: 'usr_1', course_id: 'crs_1' },
      data: { last_lesson_id: 'les_3' },
    });
  });

  it('si era la última que faltaba, sella el curso sin pisar una fecha anterior', async () => {
    progressCount.mockResolvedValue(3);

    await completeLesson({
      user_id: 'usr_1',
      lesson_id: 'les_3',
      course_id: 'crs_1',
      published_lesson_ids: ['les_1', 'les_2', 'les_3'],
      completed_at: COMPLETED_AT,
    });

    expect(enrollmentsUpdateMany).toHaveBeenLastCalledWith({
      where: { user_id: 'usr_1', course_id: 'crs_1', completed_at: null },
      data: { completed_at: COMPLETED_AT },
    });
    expect(issueCourseCertificate).not.toHaveBeenCalled();
  });

  it('marcar una lección deja al alumno inscrito aunque no hubiera pulsado "Empezar curso"', async () => {
    await completeLesson({
      user_id: 'usr_1',
      lesson_id: 'les_3',
      course_id: 'crs_1',
      published_lesson_ids: ['les_3'],
      completed_at: COMPLETED_AT,
    });

    expect(enrollmentsCreateMany).toHaveBeenCalledWith({
      data: { user_id: 'usr_1', course_id: 'crs_1', last_lesson_id: 'les_3' },
      skipDuplicates: true,
    });
  });
});

describe('uncompleteLesson · desmarcar', () => {
  it('borra la marca de la lección y la del curso', async () => {
    await uncompleteLesson({ user_id: 'usr_1', lesson_id: 'les_3', course_id: 'crs_1' });

    expect(progressUpdateMany).toHaveBeenCalledWith({
      where: { user_id: 'usr_1', lesson_id: 'les_3' },
      data: { completed_at: null },
    });
    expect(enrollmentsUpdateMany).toHaveBeenCalledWith({
      where: { user_id: 'usr_1', course_id: 'crs_1' },
      data: { completed_at: null },
    });
  });
});

describe('lecturas del progreso', () => {
  it('las completadas se piden acotadas a las lecciones publicadas', async () => {
    await findCompletedLessonIds('usr_1', ['les_1', 'les_2']);

    expect(progressFindMany).toHaveBeenCalledWith({
      where: {
        user_id: 'usr_1',
        lesson_id: { in: ['les_1', 'les_2'] },
        completed_at: { not: null },
      },
      select: { lesson_id: true },
    });
  });

  it('las inscripciones salen de la más reciente a la más antigua', async () => {
    await findEnrollmentsByUser('usr_1');

    expect(enrollmentsFindMany).toHaveBeenCalledWith({
      where: { user_id: 'usr_1' },
      select: ENROLLMENT_SELECT,
      orderBy: { started_at: 'desc' },
    });
  });
});

describe('la fachada que usa modules/user para la baja de cuenta', () => {
  const enrollmentsDeleteMany = jest.spyOn(prisma.enrollments, 'deleteMany');
  const progressDeleteMany = jest.spyOn(prisma.lesson_progress, 'deleteMany');
  const enrollmentsCount = jest.spyOn(prisma.enrollments, 'count');

  it('borra el avance antes que las inscripciones, y acepta el cliente de la transaccion', async () => {
    await deleteUserProgress('usr_1', prisma);

    expect(progressDeleteMany).toHaveBeenCalledWith({ where: { user_id: 'usr_1' } });
    expect(enrollmentsDeleteMany).toHaveBeenCalledWith({ where: { user_id: 'usr_1' } });
    expect(progressDeleteMany.mock.invocationCallOrder[0] ?? 0).toBeLessThan(
      enrollmentsDeleteMany.mock.invocationCallOrder[0] ?? 0,
    );
  });

  it('cuenta como terminado solo lo que tiene fecha de fin', async () => {
    enrollmentsCount.mockResolvedValue(2);

    await expect(countCompletedEnrollments('usr_1')).resolves.toBe(2);
    expect(enrollmentsCount).toHaveBeenCalledWith({
      where: { user_id: 'usr_1', completed_at: { not: null } },
    });
  });
});
