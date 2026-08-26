import { ValidationKeys } from '@/constants/validation_keys';
import { requestPasswordResetSchema } from '@/modules/auth/features/password_reset/request/domain/request.schema';

const messagesOf = (input: unknown): string[] => {
  const result = requestPasswordResetSchema.safeParse(input);

  return result.success ? [] : result.error.issues.map((issue) => issue.message);
};

describe('requestPasswordResetSchema', () => {
  it('normaliza el correo a minusculas y sin espacios', () => {
    const result = requestPasswordResetSchema.parse({ email: '  MaRia@EstudioQP.PE  ' });

    expect(result.email).toBe('maria@estudioqp.pe');
    expect(result.redirect_to).toBeUndefined();
  });

  it('acepta un redirect_to relativo', () => {
    expect(
      requestPasswordResetSchema.parse({ email: 'maria@x.pe', redirect_to: '/curso/fundamentos' })
        .redirect_to,
    ).toBe('/curso/fundamentos');
  });

  it('rechaza un correo invalido con la clave i18n del contrato', () => {
    expect(messagesOf({ email: 'maria' })).toEqual([ValidationKeys.auth.email_invalid]);
  });

  it('rechaza que falte el correo', () => {
    expect(messagesOf({})).toEqual([ValidationKeys.auth.email_invalid]);
  });

  it('rechaza un redirect_to absoluto: seria un redirector abierto', () => {
    for (const redirect_to of ['https://malo.pe', '//malo.pe', 'curso/fundamentos', '/a\\b']) {
      expect(messagesOf({ email: 'maria@x.pe', redirect_to })).toEqual([
        ValidationKeys.auth.redirect_to_invalid,
      ]);
    }
  });

  it('rechaza un correo mas largo que la columna', () => {
    const email = `${'a'.repeat(250)}@x.pe`;

    expect(messagesOf({ email })).toEqual([ValidationKeys.auth.email_too_long]);
  });
});
