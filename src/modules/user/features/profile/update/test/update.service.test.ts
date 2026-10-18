import { updateProfileService } from '@/modules/user/features/profile/update/presentation/update.service';
import { updateUserProfile } from '@/modules/user/shared/data/user_account.repository';
import { userRecord } from '@/modules/user/shared/test/user_fixtures';

jest.mock('@/modules/user/shared/data/user_account.repository', () => ({
  updateUserProfile: jest.fn(),
}));

const updateUserProfileMock = jest.mocked(updateUserProfile);

const payload = {
  user_id: 'usr_1',
  full_name: 'Maria Quispe Rojas',
};

beforeEach(() => {
  updateUserProfileMock.mockResolvedValue(userRecord());
});

describe('updateProfileService', () => {
  it('actualiza solo el nombre del usuario autenticado', async () => {
    await updateProfileService(payload);

    expect(updateUserProfileMock).toHaveBeenCalledWith({
      user_id: 'usr_1',
      full_name: 'Maria Quispe Rojas',
    });
  });

  it('nunca manda el correo al repositorio: aqui no se cambia', async () => {
    await updateProfileService(payload);

    expect(updateUserProfileMock.mock.calls[0]?.[0]).not.toHaveProperty('email');
  });

  it('devuelve el usuario del contrato y sin rastro del hash', async () => {
    const result = await updateProfileService(payload);

    expect(result.user.email).toBe('maria@estudioqp.pe');
    expect(JSON.stringify(result)).not.toContain('password');
  });
});
