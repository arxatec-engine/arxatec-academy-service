import { sanitizeArticleBody } from '@/modules/courses/shared/domain/sanitize_article_body';
import { readingTime } from '@/modules/courses/shared/policy/reading_time';

describe('artículos del editor', () => {
  it('conserva solo formato permitido y elimina contenido activo', () => {
    const input = '<script>alert(1)</script><div class="c7"><h1>Título</h1>'
      + '<h2>Hola</h2><img src=x onerror=alert(1)><a href="javascript:alert(1)">enlace</a>'
      + '<p><strong>texto</strong> <em>útil</em></p></div>';
    const clean = sanitizeArticleBody(input);
    expect(clean).not.toContain('alert');
    expect(clean).not.toContain('<img');
    expect(clean).not.toContain('javascript:');
    expect(clean).toContain('<h2>Hola</h2>');
    expect(clean).toContain('<strong>texto</strong>');
    expect(clean).toContain('<em>útil</em>');
    expect(clean).toContain('Título');
  });

  it('calcula 1180 palabras como 6 minutos', () => {
    const body = `<p>${Array.from({ length: 1180 }, () => 'palabra').join(' ')}</p>`;
    expect(readingTime(body)).toEqual({ article_word_count: 1180, reading_minutes: 6 });
    expect(readingTime('')).toEqual({ article_word_count: 0, reading_minutes: 0 });
  });
});
