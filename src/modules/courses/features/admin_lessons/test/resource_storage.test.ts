import { MimeTypes } from '@/constants/files';
import { storage } from '@/infrastructure/storage/storage';
import { removeStoredFile } from '@/infrastructure/storage/cleanup';
import {
  createAdminResourceService, deleteAdminLessonService, deleteAdminResourceService,
} from '@/modules/courses/features/admin_lessons/presentation/admin_lessons.service';
import {
  createAdminResource,
  deleteAdminLesson,
  deleteAdminResource,
  getAdminLesson,
  getAdminResource,
  lessonStudentDataCounts,
  type AdminLessonRecord,
} from '@/modules/courses/shared/data/admin_lessons.repository';

jest.mock('@/modules/courses/shared/data/admin_lessons.repository', () => ({
  createAdminResource: jest.fn(),
  getAdminLesson: jest.fn(),
  deleteAdminLesson: jest.fn(),
  deleteAdminResource: jest.fn(),
  getAdminResource: jest.fn(),
  lessonStudentDataCounts: jest.fn(),
}));
jest.mock('@/infrastructure/storage/storage', () => ({
  storage: { save: jest.fn(), remove: jest.fn(), readUrl: jest.fn() },
}));
jest.mock('@/infrastructure/storage/cleanup', () => ({ removeStoredFile: jest.fn() }));

const lesson: AdminLessonRecord = {
  id: 'lesson-1',
  course_id: 'course-1',
  slug: 'lesson',
  title: 'Lesson',
  description: '',
  type: 'VIDEO',
  position: 1,
  status: 'DRAFT',
  is_free_sample: false,
  video_provider: null,
  video_external_id: null,
  duration_seconds: null,
  article_body: null,
  article_word_count: null,
  reading_minutes: null,
  transcript: null,
  updated_at: new Date('2026-10-19T12:00:00Z'),
  resources: [],
  course: { id: 'course-1', title: 'Course', status: 'DRAFT' },
};
const key = 'lesson_resources/uuid.pdf';
const url = `https://cdn.test/${key}`;
const content = Buffer.from('%PDF-1.7');
const file = { content, mime_type: MimeTypes.pdf, size_bytes: content.byteLength };
const save = jest.spyOn(storage, 'save');
const remove = jest.mocked(removeStoredFile);
const readUrl = jest.spyOn(storage, 'readUrl');
const create = jest.mocked(createAdminResource);

beforeEach(() => {
  jest.mocked(getAdminLesson).mockResolvedValue(lesson);
  jest.mocked(lessonStudentDataCounts).mockResolvedValue({ progress_count: 0, comment_count: 0 });
  save.mockResolvedValue({ key, url, mime_type: MimeTypes.pdf, size_bytes: content.byteLength });
  remove.mockResolvedValue(undefined);
  create.mockResolvedValue({
    id: 'resource-1',
    title: 'Document',
    file_key: key,
    file_url: url,
    mime_type: MimeTypes.pdf,
    size_bytes: content.byteLength,
    position: 1,
  });
  readUrl.mockReturnValue(`${url}?Signature=temporary`);
});

describe('persistencia y firma de recursos administrativos', () => {
  it('guarda URL estable y clave, pero entrega al admin una lectura firmada', async () => {
    const result = await createAdminResourceService(lesson.id, 'Document', file);
    expect(create).toHaveBeenCalledWith(
      lesson.id,
      expect.objectContaining({ file_url: url, file_key: key }),
    );
    expect(result.resource.file_url).toBe(`${url}?Signature=temporary`);
    expect(result.resource).not.toHaveProperty('file_key');
    expect(remove).not.toHaveBeenCalled();
  });

  it('compensa una escritura fallida en base de datos', async () => {
    create.mockRejectedValue(new Error('database failed'));
    await expect(createAdminResourceService(lesson.id, 'Document', file)).rejects.toThrow(
      'database failed',
    );
    expect(remove).toHaveBeenCalledWith(key);
    expect(readUrl).not.toHaveBeenCalled();
  });

  it('no borra un objeto ya persistido si falla la firma de su respuesta', async () => {
    readUrl.mockImplementation(() => {
      throw new Error('signer failed');
    });
    await expect(createAdminResourceService(lesson.id, 'Document', file)).rejects.toThrow(
      'signer failed',
    );
    expect(create).toHaveBeenCalledTimes(1);
    expect(remove).not.toHaveBeenCalled();
  });

  it('al borrar una lección procesa cada clave después de confirmar la eliminación', async () => {
    jest.mocked(deleteAdminLesson).mockResolvedValue([key, key]);
    await deleteAdminLessonService(lesson.id, false);
    expect(deleteAdminLesson).toHaveBeenCalledWith(lesson.id, lesson.course_id);
    expect(remove).toHaveBeenCalledTimes(1);
    expect(remove).toHaveBeenCalledWith(key);
    expect(remove.mock.invocationCallOrder[0]).toBeGreaterThan(
      jest.mocked(deleteAdminLesson).mock.invocationCallOrder[0] ?? 0,
    );
  });

  it('no borra archivos si la eliminación de la lección falla', async () => {
    jest.mocked(deleteAdminLesson).mockRejectedValueOnce(new Error('database failed'));
    await expect(deleteAdminLessonService(lesson.id, false)).rejects.toThrow('database failed');
    expect(remove).not.toHaveBeenCalled();
  });

  it('no inicia la limpieza si faltó confirmar la eliminación con datos de alumnos', async () => {
    jest.mocked(lessonStudentDataCounts).mockResolvedValue({ progress_count: 1, comment_count: 0 });
    await expect(deleteAdminLessonService(lesson.id, false)).rejects.toMatchObject({ statusCode: 409 });
    expect(deleteAdminLesson).not.toHaveBeenCalled();
    expect(remove).not.toHaveBeenCalled();
  });

  it('al borrar un recurso inicia la limpieza de su archivo asociado', async () => {
    const resource = await createAdminResourceService(lesson.id, 'Document', file);
    const row = jest.mocked(createAdminResource).mock.results[0];
    if (row?.type !== 'return') {
      throw new Error('Expected created resource');
    }
    const saved = await row.value;
    jest.mocked(getAdminResource).mockResolvedValue(saved);
    jest.mocked(deleteAdminResource).mockResolvedValue(saved);
    await deleteAdminResourceService(lesson.id, resource.resource.id);
    expect(remove).toHaveBeenCalledWith(key);
    expect(remove.mock.invocationCallOrder[0]).toBeGreaterThan(
      jest.mocked(deleteAdminResource).mock.invocationCallOrder[0] ?? 0,
    );
  });
});
