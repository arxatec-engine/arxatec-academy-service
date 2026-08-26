import { FrontendRoutes } from '@/constants/endpoints';
import { isSafeRedirect, sanitizeRedirect } from '@/utils/safe_redirect';

describe('isSafeRedirect', () => {
  it.each(['/', '/curso/fundamentos', '/curso/fundamentos?leccion=3', '/curso/fundamentos#video'])(
    'acepta el path relativo %s',
    (value) => {
      expect(isSafeRedirect(value)).toBe(true);
    },
  );

  it.each([
    '//malo.pe',
    '///malo.pe',
    '//malo.pe/curso',
    'https://malo.pe',
    'http://malo.pe',
    'javascript:alert(1)',
    '/\\malo.pe',
    '/curso\\malo',
    'curso/fundamentos',
    '',
    ' /curso',
    '/curso con espacio',
  ])('rechaza %s', (value) => {
    expect(isSafeRedirect(value)).toBe(false);
  });

  it.each([undefined, null, 42, {}, ['/curso']])('rechaza lo que no es string: %s', (value) => {
    expect(isSafeRedirect(value)).toBe(false);
  });

  it('rechaza un path con caracteres de control', () => {
    expect(isSafeRedirect(`/curso${String.fromCharCode(7)}/x`)).toBe(false);
  });

  it('rechaza un path más largo que el límite', () => {
    expect(isSafeRedirect(`/${'a'.repeat(600)}`)).toBe(false);
  });
});

describe('sanitizeRedirect', () => {
  it('devuelve el valor cuando es seguro', () => {
    expect(sanitizeRedirect('/curso/fundamentos')).toBe('/curso/fundamentos');
  });

  it('cae al inicio cuando no es seguro', () => {
    expect(sanitizeRedirect('https://malo.pe')).toBe(FrontendRoutes.home);
  });

  it('respeta el fallback recibido', () => {
    expect(sanitizeRedirect('//malo.pe', FrontendRoutes.login)).toBe(FrontendRoutes.login);
  });
});
