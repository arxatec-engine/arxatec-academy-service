import { lesson_type, video_provider } from '@/generated/enums';
import type {
  LessonLockedRecord,
  LessonUnlockedRecord,
} from '@/modules/courses/shared/domain/lesson.types';
import {
  toApiLessonCourse,
  toApiLessonLocked,
  toApiLessonUnlocked,
} from '@/modules/courses/shared/domain/lesson_mapper';

const LOCKED: LessonLockedRecord = {
  id: 'locked-lesson-id',
  slug: 'las-cuatro-herramientas-que-ya-usas-sin-saberlo',
  title: 'Las cuatro herramientas que ya usas sin saberlo',
  description: 'Firma digital, notificaciones electrónicas y dos más.',
  type: lesson_type.VIDEO,
  position: 3,
  is_free_sample: false,
  duration_seconds: 664,
  reading_minutes: null,
};

const VIDEO: LessonUnlockedRecord = {
  ...LOCKED,
  video_provider: video_provider.VIMEO,
  video_external_id: '901000003',
  article_body: null,
  transcript: 'Hola, en esta lección vemos las cuatro herramientas.',
  updated_at: new Date('2026-06-12T00:00:00.000Z'),
  resources: [
    {
      title: 'Tabla comparativa de las cuatro herramientas',
      file_url: 'http://localhost:3001/files/lesson_resources/tabla.pdf',
      mime_type: 'application/pdf',
      size_bytes: 245760,
    },
  ],
};

const ARTICLE: LessonUnlockedRecord = {
  id: 'article-lesson-id',
  slug: 'el-costo-oculto-de-trabajar-en-word-y-correo',
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
};

describe('toApiLessonLocked · la forma bloqueada', () => {
  it('entrega lo que la pantalla necesita para pintar el muro', () => {
    expect(toApiLessonLocked(LOCKED)).toEqual({
      id: LOCKED.id,
      slug: LOCKED.slug,
      title: LOCKED.title,
      description: LOCKED.description,
      type: lesson_type.VIDEO,
      position: 3,
      is_free_sample: false,
      duration_seconds: 664,
      reading_minutes: null,
    });
  });

  it('no tiene forma de expresar el contenido: su tipo de entrada no lo lleva', () => {
    const serialized = JSON.stringify(toApiLessonLocked(LOCKED));

    expect(serialized).not.toContain('"video"');
    expect(serialized).not.toContain('article_body');
    expect(serialized).not.toContain('transcript');
    expect(serialized).not.toContain('resources');
  });
});

describe('toApiLessonUnlocked · la forma abierta', () => {
  it('un video viaja como referencia, no como archivo, y con su transcripción (E6)', () => {
    const lesson = toApiLessonUnlocked(VIDEO);

    expect(lesson.video).toEqual({ provider: video_provider.VIMEO, external_id: '901000003' });
    expect(lesson.transcript).toBe('Hola, en esta lección vemos las cuatro herramientas.');
    expect(lesson.article_body).toBeNull();
    expect(lesson.updated_at).toBe('2026-06-12T00:00:00.000Z');
  });

  it('un artículo trae cuerpo y minutos de lectura, y video en null', () => {
    const lesson = toApiLessonUnlocked(ARTICLE);

    expect(lesson.video).toBeNull();
    expect(lesson.article_body).toBe(
      '<p>Un estudio mediano pierde horas buscando la última versión.</p>',
    );
    expect(lesson.reading_minutes).toBe(2);
    expect(lesson.duration_seconds).toBeNull();
  });

  it('conserva el orden en el que llegan los recursos', () => {
    const lesson = toApiLessonUnlocked({
      ...VIDEO,
      resources: [
        { title: 'Primero', file_url: 'a', mime_type: 'application/pdf', size_bytes: 1 },
        { title: 'Segundo', file_url: 'b', mime_type: 'application/pdf', size_bytes: 2 },
      ],
    });

    expect(lesson.resources.map((resource) => resource.title)).toEqual(['Primero', 'Segundo']);
  });

  it('expone el id de la lección para progreso y comentarios, pero no ids de recursos', () => {
    const serialized = JSON.stringify(toApiLessonUnlocked(VIDEO));

    expect(toApiLessonUnlocked(VIDEO).id).toBe(VIDEO.id);
    expect(serialized).not.toContain('"lesson_id"');
    expect(serialized).not.toContain('lesson_id');
    expect(serialized).not.toContain('course_id');
    expect(serialized).not.toContain('status');
  });
});

describe('toApiLessonCourse', () => {
  it('del curso solo salen el slug, el título y el número de lecciones', () => {
    expect(
      toApiLessonCourse(
        { slug: 'fundamentos-de-legal-tech', title: 'Fundamentos de legal tech' },
        6,
      ),
    ).toEqual({
      slug: 'fundamentos-de-legal-tech',
      title: 'Fundamentos de legal tech',
      lesson_count: 6,
    });
  });
});
