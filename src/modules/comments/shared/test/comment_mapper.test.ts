import { CommentMessages } from '@/constants/messages/comments';
import { user_role } from '@/generated/enums';
import type {
  CommentAuthorRecord,
  CommentRecord,
} from '@/modules/comments/shared/domain/comment.types';
import { toApiComment, toApiCommentAuthor } from '@/modules/comments/shared/domain/comment_mapper';

const author = (overrides: Partial<CommentAuthorRecord> = {}): CommentAuthorRecord => ({
  full_name: 'Jorge Ramírez',
  avatar_url: null,
  organization: 'Estudio Ramírez Abogados',
  is_independent: false,
  role: user_role.STUDENT,
  ...overrides,
});

const comment = (overrides: Partial<CommentRecord> = {}): CommentRecord => ({
  id: 'cmt_1',
  parent_id: null,
  body: '¿Esto aplica a un estudio de dos personas?',
  created_at: new Date('2026-07-01T10:00:00.000Z'),
  user: author(),
  ...overrides,
});

describe('toApiCommentAuthor', () => {
  it('la afiliación sale de la organización', () => {
    expect(toApiCommentAuthor(author())?.affiliation).toBe('Estudio Ramírez Abogados');
  });

  it('sin organización y con is_independent usa el texto de independiente', () => {
    expect(
      toApiCommentAuthor(author({ organization: null, is_independent: true }))?.affiliation,
    ).toBe(CommentMessages.author.independent);
  });

  it('una organización en blanco cuenta como ausente', () => {
    expect(
      toApiCommentAuthor(author({ organization: '   ', is_independent: true }))?.affiliation,
    ).toBe(CommentMessages.author.independent);
  });

  it('sin organización y sin is_independent la afiliación es null', () => {
    expect(
      toApiCommentAuthor(author({ organization: null, is_independent: false }))?.affiliation,
    ).toBeNull();
  });

  it('is_team es true para un ADMIN', () => {
    expect(toApiCommentAuthor(author({ role: user_role.ADMIN }))?.is_team).toBe(true);
  });

  it('is_team cambia al bajarle el rol al mismo usuario: no se guarda, se calcula', () => {
    const equipo = author({ role: user_role.ADMIN });
    const degradado = { ...equipo, role: user_role.STUDENT };

    expect(toApiCommentAuthor(equipo)?.is_team).toBe(true);
    expect(toApiCommentAuthor(degradado)?.is_team).toBe(false);
  });

  it('una cuenta borrada deja el autor en null', () => {
    expect(toApiCommentAuthor(null)).toBeNull();
  });

  it('el autor solo lleva las cuatro claves que pinta la pantalla 08', () => {
    expect(Object.keys(toApiCommentAuthor(author()) ?? {}).sort()).toEqual([
      'affiliation',
      'avatar_url',
      'full_name',
      'is_team',
    ]);
  });
});

describe('toApiComment', () => {
  it('serializa la fecha en ISO y conserva el cuerpo tal cual', () => {
    expect(toApiComment(comment())).toEqual({
      id: 'cmt_1',
      parent_id: null,
      body: '¿Esto aplica a un estudio de dos personas?',
      created_at: '2026-07-01T10:00:00.000Z',
      author: {
        full_name: 'Jorge Ramírez',
        avatar_url: null,
        affiliation: 'Estudio Ramírez Abogados',
        is_team: false,
      },
    });
  });

  it('el cuerpo no se escapa ni se sanea: se guarda y se devuelve como texto plano', () => {
    const raw = '<b>ojo</b> & <script>alert(1)</script>';

    expect(toApiComment(comment({ body: raw })).body).toBe(raw);
  });

  it('el JSON serializado de un comentario no contiene ninguna arroba', () => {
    expect(JSON.stringify(toApiComment(comment()))).not.toContain('@');
  });
});
