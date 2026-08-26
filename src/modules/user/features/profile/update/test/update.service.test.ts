import { user_city } from '@/generated/enums';
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
  organization: 'Estudio Quispe & Rojas',
  is_independent: false,
  city: user_city.LIMA,
  city_other: null,
};

beforeEach(() => {
  updateUserProfileMock.mockResolvedValue(userRecord());
});

describe('updateProfileService', () => {
  it('guarda los campos tal y como llegan cuando no hay regla que aplicar', async () => {
    await updateProfileService(payload);

    expect(updateUserProfileMock).toHaveBeenCalledWith({
      user_id: 'usr_1',
      full_name: 'Maria Quispe Rojas',
      organization: 'Estudio Quispe & Rojas',
      is_independent: false,
      city: user_city.LIMA,
      city_other: null,
    });
  });

  it('is_independent: true limpia la organizacion aunque venga rellena', async () => {
    await updateProfileService({
      ...payload,
      is_independent: true,
      organization: 'Estudio Que Ya No Es',
    });

    expect(updateUserProfileMock).toHaveBeenCalledWith(
      expect.objectContaining({ organization: null, is_independent: true }),
    );
  });

  it('una organizacion de solo espacios se guarda como null', async () => {
    await updateProfileService({ ...payload, organization: '   ' });

    expect(updateUserProfileMock).toHaveBeenCalledWith(
      expect.objectContaining({ organization: null }),
    );
  });

  it('city_other solo sobrevive con city OTHER', async () => {
    await updateProfileService({ ...payload, city: user_city.LIMA, city_other: 'Cusco' });

    expect(updateUserProfileMock).toHaveBeenCalledWith(
      expect.objectContaining({ city_other: null }),
    );

    await updateProfileService({ ...payload, city: user_city.OTHER, city_other: '  Cusco  ' });

    expect(updateUserProfileMock).toHaveBeenLastCalledWith(
      expect.objectContaining({ city: user_city.OTHER, city_other: 'Cusco' }),
    );
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
