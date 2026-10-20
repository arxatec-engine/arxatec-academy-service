import { ErrorCodes } from '@/constants/error_codes';
import { HttpStatusCodes } from '@/constants/http_status_codes';
import { CourseMessages } from '@/constants/messages/courses';
import { course_level, course_topic, lesson_type, video_provider } from '@/generated/enums';
import { storage } from '@/infrastructure/storage/storage';
import { getDetailService } from '@/modules/courses/features/lessons/get_detail/presentation/get_detail.service';
import {
  findPublishedCourseBySlug,
  findPublishedLessonLocked,
  findPublishedLessonUnlocked,
  findPublishedLessonsByCourseId,
} from '@/modules/courses/shared/data/courses.repository';
import type {
  CourseDetailRecord,
  LessonSummaryRecord,
} from '@/modules/courses/shared/domain/course.types';
import type {
  LessonLockedRecord,
  LessonUnlockedRecord,
} from '@/modules/courses/shared/domain/lesson.types';
import { isAppError, type AppError } from '@/utils/errors';

jest.mock('@/modules/courses/shared/data/courses.repository', () => ({
  findPublishedCourseBySlug: jest.fn(),
  findPublishedLessonsByCourseId: jest.fn(),
  findPublishedLessonLocked: jest.fn(),
  findPublishedLessonUnlocked: jest.fn(),
}));

const findPublishedCourseBySlugMock = jest.mocked(findPublishedCourseBySlug);
const findPublishedLessonsByCourseIdMock = jest.mocked(findPublishedLessonsByCourseId);
const findPublishedLessonLockedMock = jest.mocked(findPublishedLessonLocked);
const findPublishedLessonUnlockedMock = jest.mocked(findPublishedLessonUnlocked);

const COURSE: CourseDetailRecord = {
  teacher: null,
  id: 'crs_1',
  slug: 'fundamentos-de-legal-tech',
  title: 'Fundamentos de legal tech',
  long_description: 'Seis lecciones para entender de qué hablan cuando hablan de legal tech.',
  topic: course_topic.FIRST_STEPS,
  level: course_level.INTRODUCTORY,
  cover_image_key: null, cover_image_url: null,
  published_at: new Date('2026-06-01T12:00:00.000Z'),
};

const SAMPLE_SLUG = 'que-es-legal-tech-y-que-no';
const ARTICLE_SLUG = 'el-costo-oculto-de-trabajar-en-word-y-correo';
const VIDEO_SLUG = 'las-cuatro-herramientas-que-ya-usas-sin-saberlo';
const LAST_SLUG = 'tu-primera-semana-con-un-sistema';

const TEMARIO: readonly LessonSummaryRecord[] = [
  {
    id: 'lesson-1',
    slug: SAMPLE_SLUG,
    title: 'Qué es legal tech y qué no',
    description: 'Separamos tres cosas que suelen ir revueltas.',
    type: lesson_type.VIDEO,
    position: 1,
    duration_seconds: 480,
    reading_minutes: null,
    is_free_sample: true,
  },
  {
    id: 'lesson-2',
    slug: ARTICLE_SLUG,
    title: 'El costo oculto de trabajar en Word y correo',
    description: 'Cuánto tiempo se pierde buscando la última versión.',
    type: lesson_type.ARTICLE,
    position: 2,
    duration_seconds: null,
    reading_minutes: 2,
    is_free_sample: false,
  },
  {
    id: 'lesson-3',
    slug: VIDEO_SLUG,
    title: 'Las cuatro herramientas que ya usas sin saberlo',
    description: 'Firma digital, notificaciones electrónicas y dos más.',
    type: lesson_type.VIDEO,
    position: 3,
    duration_seconds: 664,
    reading_minutes: null,
    is_free_sample: false,
  },
  {
    id: 'lesson-4',
    slug: LAST_SLUG,
    title: 'Tu primera semana con un sistema',
    description: 'Un plan de cinco días.',
    type: lesson_type.VIDEO,
    position: 5,
    duration_seconds: 720,
    reading_minutes: null,
    is_free_sample: false,
  },
];

const LOCKED: LessonLockedRecord = {
  id: 'locked-lesson-id',
  slug: VIDEO_SLUG,
  title: 'Las cuatro herramientas que ya usas sin saberlo',
  description: 'Firma digital, notificaciones electrónicas y dos más.',
  type: lesson_type.VIDEO,
  position: 3,
  is_free_sample: false,
  duration_seconds: 664,
  reading_minutes: null,
};

const UNLOCKED: LessonUnlockedRecord = {
  ...LOCKED,
  video_provider: video_provider.VIMEO,
  video_external_id: '901000003',
  article_body: null,
  transcript: 'Firma digital, notificaciones electrónicas, expediente y plantillas.',
  updated_at: new Date('2026-06-12T00:00:00.000Z'),
  resources: [
    {
      title: 'Mapa de las tres capas',
      file_key: null, file_url: 'http://localhost:3010/files/lesson_resources/mapa.pdf',
      mime_type: 'application/pdf',
      size_bytes: 184320,
    },
    {
      title: 'Checklist: qué revisar antes de comprar software',
      file_key: null, file_url: 'http://localhost:3010/files/lesson_resources/checklist.pdf',
      mime_type: 'application/pdf',
      size_bytes: 96256,
    },
  ],
};

const captureError = async (promise: Promise<unknown>): Promise<AppError> => {
  try {
    await promise;
  } catch (error) {
    if (isAppError(error)) {
      return error;
    }

    throw error;
  }

  throw new Error('Se esperaba un AppError y la promesa se resolvio');
};

beforeEach(() => {
  jest.clearAllMocks();
  findPublishedCourseBySlugMock.mockResolvedValue(COURSE);
  findPublishedLessonsByCourseIdMock.mockResolvedValue(TEMARIO);
  findPublishedLessonLockedMock.mockResolvedValue(LOCKED);
  findPublishedLessonUnlockedMock.mockResolvedValue(UNLOCKED);
});

describe('getDetailService · lo que no existe es 404', () => {
  it('un curso en borrador, archivado o inexistente responde 404 con el mensaje del curso', async () => {
    findPublishedCourseBySlugMock.mockResolvedValue(null);

    const error = await captureError(
      getDetailService({
        course_slug: 'curso-en-borrador',
        lesson_slug: SAMPLE_SLUG,
        has_session: true,
      }),
    );

    expect(error.statusCode).toBe(HttpStatusCodes.NOT_FOUND.code);
    expect(error.meta).toEqual({ code: ErrorCodes.NOT_FOUND });
    expect(error.message).toBe(CourseMessages.course.not_found);
    expect(findPublishedLessonsByCourseIdMock).not.toHaveBeenCalled();
  });

  it('una lección en borrador o inexistente responde 404, no 403', async () => {
    const error = await captureError(
      getDetailService({
        course_slug: COURSE.slug,
        lesson_slug: 'leccion-en-borrador',
        has_session: false,
      }),
    );

    expect(error.statusCode).toBe(HttpStatusCodes.NOT_FOUND.code);
    expect(error.meta).toEqual({ code: ErrorCodes.NOT_FOUND });
    expect(error.message).toBe(CourseMessages.lesson.not_found);
  });

  it('una lección que no existe no llega a pedir ninguna de las dos formas', async () => {
    await captureError(
      getDetailService({
        course_slug: COURSE.slug,
        lesson_slug: 'leccion-en-borrador',
        has_session: true,
      }),
    );

    expect(findPublishedLessonLockedMock).not.toHaveBeenCalled();
    expect(findPublishedLessonUnlockedMock).not.toHaveBeenCalled();
  });
});

describe('getDetailService · los cuatro cruces de la tabla de acceso', () => {
  it('visitante sin cuenta + muestra gratuita → contenido completo', async () => {
    findPublishedLessonUnlockedMock.mockResolvedValue({ ...UNLOCKED, slug: SAMPLE_SLUG });

    const result = await getDetailService({
      course_slug: COURSE.slug,
      lesson_slug: SAMPLE_SLUG,
      has_session: false,
    });

    expect(result.locked).toBe(false);
    expect(findPublishedLessonUnlockedMock).toHaveBeenCalledWith('crs_1', SAMPLE_SLUG);
  });

  it('visitante sin cuenta + lección normal → bloqueada', async () => {
    const result = await getDetailService({
      course_slug: COURSE.slug,
      lesson_slug: VIDEO_SLUG,
      has_session: false,
    });

    expect(result.locked).toBe(true);
  });

  it('con sesión + muestra gratuita → contenido completo', async () => {
    findPublishedLessonUnlockedMock.mockResolvedValue({ ...UNLOCKED, slug: SAMPLE_SLUG });

    const result = await getDetailService({
      course_slug: COURSE.slug,
      lesson_slug: SAMPLE_SLUG,
      has_session: true,
    });

    expect(result.locked).toBe(false);
  });

  it('con sesión + lección normal → contenido completo', async () => {
    const result = await getDetailService({
      course_slug: COURSE.slug,
      lesson_slug: VIDEO_SLUG,
      has_session: true,
    });

    expect(result.locked).toBe(false);
  });
});

describe('getDetailService · la lección bloqueada', () => {
  it('el contenido no se lee de la base de datos: solo se pide la forma bloqueada', async () => {
    await getDetailService({
      course_slug: COURSE.slug,
      lesson_slug: VIDEO_SLUG,
      has_session: false,
    });

    expect(findPublishedLessonLockedMock).toHaveBeenCalledWith('crs_1', VIDEO_SLUG);
    expect(findPublishedLessonUnlockedMock).not.toHaveBeenCalled();
  });

  it('entrega el muro con el temario y sin nada de contenido', async () => {
    const result = await getDetailService({
      course_slug: COURSE.slug,
      lesson_slug: VIDEO_SLUG,
      has_session: false,
    });

    if (!result.locked) {
      throw new Error('Se esperaba una lección bloqueada');
    }

    expect(result.view.lesson).toEqual({
      id: LOCKED.id,
      slug: VIDEO_SLUG,
      title: LOCKED.title,
      description: LOCKED.description,
      type: lesson_type.VIDEO,
      position: 3,
      is_free_sample: false,
      duration_seconds: 664,
      reading_minutes: null,
    });
    expect(result.view.course).toEqual({
      slug: COURSE.slug,
      title: COURSE.title,
      lesson_count: 4,
    });
    expect(result.view.lessons.map((lesson) => lesson.is_unlocked)).toEqual([
      true,
      false,
      false,
      false,
    ]);
  });

  it('el JSON del muro no lleva video, article_body ni transcript', () => {
    const serialized = JSON.stringify(LOCKED);

    expect(serialized).not.toContain('article_body');
    expect(serialized).not.toContain('transcript');
    expect(serialized).not.toContain('video_external_id');
  });
});

describe('getDetailService · la lección abierta', () => {
  it('firma los recursos autorizados y mantiene sus claves fuera del DTO', async () => {
    findPublishedLessonUnlockedMock.mockResolvedValue({ ...UNLOCKED,
      resources: [{ ...UNLOCKED.resources[0], file_key: 'lesson_resources/uuid.pdf' }] });
    const readUrl = jest.spyOn(storage, 'readUrl').mockReturnValue('https://cdn.test/file?Signature=one');
    const result = await getDetailService({ course_slug: COURSE.slug,
      lesson_slug: VIDEO_SLUG, has_session: true });
    expect(result.locked).toBe(false);
    if (result.locked) {throw new Error('Expected unlocked lesson');}
    expect(readUrl).toHaveBeenCalledWith('lesson_resources/uuid.pdf');
    expect(result.view.lesson.resources[0]?.file_url).toBe('https://cdn.test/file?Signature=one');
    expect(result.view.lesson.resources[0]).not.toHaveProperty('file_key');
  });

  it('no genera enlaces cuando la lección está bloqueada', async () => {
    const readUrl = jest.spyOn(storage, 'readUrl');
    const result = await getDetailService({ course_slug: COURSE.slug,
      lesson_slug: VIDEO_SLUG, has_session: false });
    expect(result.locked).toBe(true);
    expect(readUrl).not.toHaveBeenCalled();
    expect(findPublishedLessonUnlockedMock).not.toHaveBeenCalled();
  });

  it('un video viaja como referencia y con su transcripción (la red de E6)', async () => {
    const result = await getDetailService({
      course_slug: COURSE.slug,
      lesson_slug: VIDEO_SLUG,
      has_session: true,
    });

    if (result.locked) {
      throw new Error('Se esperaba una lección abierta');
    }

    expect(result.view.lesson.video).toEqual({
      provider: video_provider.VIMEO,
      external_id: '901000003',
    });
    expect(result.view.lesson.transcript).toBe(
      'Firma digital, notificaciones electrónicas, expediente y plantillas.',
    );
    expect(result.view.lesson.article_body).toBeNull();
  });

  it('una lección de artículo trae cuerpo y minutos de lectura, y video en null', async () => {
    findPublishedLessonUnlockedMock.mockResolvedValue({
      id: 'article-lesson-id',
      slug: ARTICLE_SLUG,
      title: 'El costo oculto de trabajar en Word y correo',
      description: 'Cuánto tiempo se pierde buscando la última versión.',
      type: lesson_type.ARTICLE,
      position: 2,
      is_free_sample: false,
      duration_seconds: null,
      reading_minutes: 2,
      video_provider: null,
      video_external_id: null,
      article_body: '<p>Un estudio mediano pierde horas buscando la última versión.</p>',
      transcript: null,
      updated_at: new Date('2026-06-12T00:00:00.000Z'),
      resources: [],
    });

    const result = await getDetailService({
      course_slug: COURSE.slug,
      lesson_slug: ARTICLE_SLUG,
      has_session: true,
    });

    if (result.locked) {
      throw new Error('Se esperaba una lección abierta');
    }

    expect(result.view.lesson.video).toBeNull();
    expect(result.view.lesson.article_body).toBe(
      '<p>Un estudio mediano pierde horas buscando la última versión.</p>',
    );
    expect(result.view.lesson.reading_minutes).toBe(2);
    expect(result.view.lesson.duration_seconds).toBeNull();
  });

  it('los recursos salen en el orden en que los entrega el repositorio', async () => {
    const result = await getDetailService({
      course_slug: COURSE.slug,
      lesson_slug: VIDEO_SLUG,
      has_session: true,
    });

    if (result.locked) {
      throw new Error('Se esperaba una lección abierta');
    }

    expect(result.view.lesson.resources.map((resource) => resource.title)).toEqual([
      'Mapa de las tres capas',
      'Checklist: qué revisar antes de comprar software',
    ]);
  });

  it('si la lección desaparece entre las dos consultas, responde 404 y no una lección a medias', async () => {
    findPublishedLessonUnlockedMock.mockResolvedValue(null);

    const error = await captureError(
      getDetailService({
        course_slug: COURSE.slug,
        lesson_slug: VIDEO_SLUG,
        has_session: true,
      }),
    );

    expect(error.statusCode).toBe(HttpStatusCodes.NOT_FOUND.code);
    expect(error.message).toBe(CourseMessages.lesson.not_found);
  });

  it('si la lección bloqueada desaparece entre las dos consultas, también responde 404', async () => {
    findPublishedLessonLockedMock.mockResolvedValue(null);

    const error = await captureError(
      getDetailService({
        course_slug: COURSE.slug,
        lesson_slug: VIDEO_SLUG,
        has_session: false,
      }),
    );

    expect(error.statusCode).toBe(HttpStatusCodes.NOT_FOUND.code);
    expect(error.message).toBe(CourseMessages.lesson.not_found);
  });
});

describe('getDetailService · navigation', () => {
  it('salta la lección en borrador: la siguiente de la 3 es la 5, no un hueco', async () => {
    const result = await getDetailService({
      course_slug: COURSE.slug,
      lesson_slug: VIDEO_SLUG,
      has_session: true,
    });

    if (result.locked) {
      throw new Error('Se esperaba una lección abierta');
    }

    expect(result.view.navigation).toEqual({
      previous: { slug: ARTICLE_SLUG, title: 'El costo oculto de trabajar en Word y correo' },
      next: { slug: LAST_SLUG, title: 'Tu primera semana con un sistema' },
    });
  });

  it('en la primera lección, previous es null', async () => {
    findPublishedLessonUnlockedMock.mockResolvedValue({ ...UNLOCKED, slug: SAMPLE_SLUG });

    const result = await getDetailService({
      course_slug: COURSE.slug,
      lesson_slug: SAMPLE_SLUG,
      has_session: true,
    });

    if (result.locked) {
      throw new Error('Se esperaba una lección abierta');
    }

    expect(result.view.navigation.previous).toBeNull();
    expect(result.view.navigation.next).toEqual({
      slug: ARTICLE_SLUG,
      title: 'El costo oculto de trabajar en Word y correo',
    });
  });

  it('en la última lección, next es null', async () => {
    findPublishedLessonUnlockedMock.mockResolvedValue({ ...UNLOCKED, slug: LAST_SLUG });

    const result = await getDetailService({
      course_slug: COURSE.slug,
      lesson_slug: LAST_SLUG,
      has_session: true,
    });

    if (result.locked) {
      throw new Error('Se esperaba una lección abierta');
    }

    expect(result.view.navigation.next).toBeNull();
    expect(result.view.navigation.previous).toEqual({
      slug: VIDEO_SLUG,
      title: 'Las cuatro herramientas que ya usas sin saberlo',
    });
  });
});
