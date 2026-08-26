import { revokeCurrentSession } from '@/modules/auth/features/session/logout/data/logout.repository';
import { logoutService } from '@/modules/auth/features/session/logout/presentation/logout.service';

jest.mock('@/modules/auth/features/session/logout/data/logout.repository', () => ({
  revokeCurrentSession: jest.fn(),
}));

const revokeCurrentSessionMock = jest.mocked(revokeCurrentSession);

describe('logoutService', () => {
  it('revoca la sesion que viene en el payload', async () => {
    revokeCurrentSessionMock.mockResolvedValue(1);

    await logoutService({ session_id: 'ses_1' });

    expect(revokeCurrentSessionMock).toHaveBeenCalledTimes(1);
    expect(revokeCurrentSessionMock).toHaveBeenCalledWith('ses_1');
  });

  it('marca already_revoked en false cuando la revocacion toco la fila', async () => {
    revokeCurrentSessionMock.mockResolvedValue(1);

    await expect(logoutService({ session_id: 'ses_1' })).resolves.toEqual({
      already_revoked: false,
    });
  });

  it('es idempotente: una sesion ya revocada resuelve, no lanza', async () => {
    revokeCurrentSessionMock.mockResolvedValue(0);

    await expect(logoutService({ session_id: 'ses_1' })).resolves.toEqual({
      already_revoked: true,
    });
  });
});
