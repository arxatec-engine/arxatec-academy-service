import { user_role } from '@/generated/enums';
import type { CommentRecord } from '@/modules/comments/shared/domain/comment.types';
import { buildThreads } from '@/modules/comments/shared/domain/comment_thread';

const preserveFileUrl = <T extends string | null>(url: T): T => url;

const at = (
  id: string,
  minute: number,
  parent_id: string | null = null,
  role: user_role = user_role.STUDENT,
): CommentRecord => ({
  id,
  parent_id,
  body: `Cuerpo de ${id}`,
  created_at: new Date(`2026-07-01T10:${String(minute).padStart(2, '0')}:00.000Z`),
  user: {
    full_name: 'Jorge Ramírez',
    avatar_url: null, avatar_key: null,
    organization: null,
    is_independent: true,
    role,
  },
});

describe('buildThreads', () => {
  it('una lección sin comentarios devuelve una lista vacía, no un error (E5)', () => {
    expect(buildThreads([], preserveFileUrl)).toEqual([]);
  });

  it('agrupa cada respuesta bajo su raíz y respeta el orden de llegada', () => {
    const threads = buildThreads([
      at('raiz_1', 1),
      at('raiz_2', 2),
      at('resp_1a', 3, 'raiz_1'),
      at('resp_2a', 4, 'raiz_2'),
      at('resp_1b', 5, 'raiz_1'),
    ], preserveFileUrl);

    expect(threads.map((thread) => thread.id)).toEqual(['raiz_1', 'raiz_2']);
    expect(threads[0]?.replies.map((reply) => reply.id)).toEqual(['resp_1a', 'resp_1b']);
    expect(threads[1]?.replies.map((reply) => reply.id)).toEqual(['resp_2a']);
  });

  it('un hilo sin respuestas trae la lista vacía', () => {
    expect(buildThreads([at('raiz_1', 1)], preserveFileUrl)[0]?.replies).toEqual([]);
  });

  it('una respuesta cuya raíz no está en la lista no se cuela como hilo suelto', () => {
    const threads = buildThreads([at('raiz_1', 1), at('huerfana', 2, 'raiz_oculta')], preserveFileUrl);

    expect(threads.map((thread) => thread.id)).toEqual(['raiz_1']);
    expect(threads[0]?.replies).toEqual([]);
  });

  it('la insignia del equipo viaja en la respuesta, no en la raíz', () => {
    const threads = buildThreads([at('raiz_1', 1), at('resp_1a', 2, 'raiz_1', user_role.ADMIN)], preserveFileUrl);

    expect(threads[0]?.author?.is_team).toBe(false);
    expect(threads[0]?.replies[0]?.author?.is_team).toBe(true);
  });

  it('el árbol serializado no contiene ninguna arroba', () => {
    const threads = buildThreads([at('raiz_1', 1), at('resp_1a', 2, 'raiz_1')], preserveFileUrl);

    expect(JSON.stringify(threads)).not.toContain('@');
  });
});
