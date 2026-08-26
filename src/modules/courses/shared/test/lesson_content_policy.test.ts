import { LessonContentIssues } from '@/constants/courses';
import { lesson_type, video_provider } from '@/generated/enums';
import type { LessonContentDraft } from '@/modules/courses/shared/domain/lesson_content.types';
import {
  computeReadingMinutes,
  countArticleWords,
  resolveLessonContent,
} from '@/modules/courses/shared/policy/lesson_content_policy';

const article_body = '<h2>Donde se va el tiempo</h2><p>Un abogado con veinte casos activos.</p>';

const video_draft: LessonContentDraft = {
  type: lesson_type.VIDEO,
  video_provider: video_provider.VIMEO,
  video_external_id: '901000003',
  duration_seconds: 664,
};

const article_draft: LessonContentDraft = {
  type: lesson_type.ARTICLE,
  article_body,
};

describe('resolveLessonContent', () => {
  it('acepta una leccion de video y deja los campos de articulo en null', () => {
    const result = resolveLessonContent(video_draft);

    expect(result).toEqual({
      valid: true,
      content: {
        video_provider: video_provider.VIMEO,
        video_external_id: '901000003',
        duration_seconds: 664,
        article_body: null,
        article_word_count: null,
        reading_minutes: null,
      },
    });
  });

  it('acepta una leccion de articulo y deja los campos de video en null', () => {
    const result = resolveLessonContent(article_draft);

    expect(result).toEqual({
      valid: true,
      content: {
        video_provider: null,
        video_external_id: null,
        duration_seconds: null,
        article_body,
        article_word_count: countArticleWords(article_body),
        reading_minutes: computeReadingMinutes(countArticleWords(article_body)),
      },
    });
  });

  it('rechaza una leccion de video sin proveedor, sin id externo o sin duracion', () => {
    expect(resolveLessonContent({ ...video_draft, video_provider: null })).toEqual({
      valid: false,
      issue: LessonContentIssues.video_fields_missing,
    });

    expect(resolveLessonContent({ ...video_draft, video_external_id: '   ' })).toEqual({
      valid: false,
      issue: LessonContentIssues.video_fields_missing,
    });

    expect(resolveLessonContent({ ...video_draft, duration_seconds: 0 })).toEqual({
      valid: false,
      issue: LessonContentIssues.video_fields_missing,
    });
  });

  it('rechaza una leccion de articulo con el cuerpo vacio o solo con etiquetas', () => {
    expect(resolveLessonContent({ type: lesson_type.ARTICLE, article_body: null })).toEqual({
      valid: false,
      issue: LessonContentIssues.article_body_missing,
    });

    expect(
      resolveLessonContent({ type: lesson_type.ARTICLE, article_body: '<p></p><p>  </p>' }),
    ).toEqual({ valid: false, issue: LessonContentIssues.article_body_missing });
  });

  it('rechaza la leccion que trae los dos tipos a la vez si le falta lo del tipo declarado', () => {
    const mixed: LessonContentDraft = {
      type: lesson_type.VIDEO,
      article_body,
      video_provider: null,
      video_external_id: null,
      duration_seconds: null,
    };

    expect(resolveLessonContent(mixed)).toEqual({
      valid: false,
      issue: LessonContentIssues.video_fields_missing,
    });
  });

  it('limpia los campos del tipo anterior cuando la leccion cambia de tipo', () => {
    const was_video_now_article: LessonContentDraft = {
      type: lesson_type.ARTICLE,
      video_provider: video_provider.VIMEO,
      video_external_id: '901000003',
      duration_seconds: 664,
      article_body,
    };

    expect(resolveLessonContent(was_video_now_article)).toEqual({
      valid: true,
      content: {
        video_provider: null,
        video_external_id: null,
        duration_seconds: null,
        article_body,
        article_word_count: countArticleWords(article_body),
        reading_minutes: computeReadingMinutes(countArticleWords(article_body)),
      },
    });

    const was_article_now_video: LessonContentDraft = {
      type: lesson_type.VIDEO,
      video_provider: video_provider.VIMEO,
      video_external_id: '901000003',
      duration_seconds: 664,
      article_body,
    };

    expect(resolveLessonContent(was_article_now_video)).toEqual({
      valid: true,
      content: {
        video_provider: video_provider.VIMEO,
        video_external_id: '901000003',
        duration_seconds: 664,
        article_body: null,
        article_word_count: null,
        reading_minutes: null,
      },
    });
  });
});

describe('lectura calculada', () => {
  it('reproduce el 6 min con 1 180 palabras de la pantalla 14b', () => {
    expect(computeReadingMinutes(1180)).toBe(6);
  });

  it('nunca baja de un minuto', () => {
    expect(computeReadingMinutes(1)).toBe(1);
  });

  it('cuenta palabras ignorando las etiquetas HTML del editor', () => {
    expect(countArticleWords('<p>una <strong>sola</strong> frase corta</p>')).toBe(4);
  });
});
