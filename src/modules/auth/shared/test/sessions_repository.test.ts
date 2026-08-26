jest.mock('@/config/prisma_client', () => ({
  prisma: {
    auth_sessions: {
      create: jest.fn(),
      findUnique: jest.fn(),
      updateMany: jest.fn(),
    },
  },
}));

import { prisma } from '@/config/prisma_client';
import {
  revokeAllUserSessions,
  revokeOtherUserSessions,
} from '@/modules/auth/shared/data/sessions.repository';

const updateMany = jest.spyOn(prisma.auth_sessions, 'updateMany');

const NOW = new Date('2026-08-21T12:00:00.000Z');

beforeEach(() => {
  updateMany.mockResolvedValue({ count: 2 });
});

describe('revokeOtherUserSessions', () => {
  it('revoca todas las sesiones vivas del usuario MENOS la que hace el cambio', async () => {
    const revoked = await revokeOtherUserSessions({
      user_id: 'usr_1',
      except_session_id: 'ses_1',
      revoked_at: NOW,
    });

    expect(updateMany).toHaveBeenCalledWith({
      where: { user_id: 'usr_1', revoked_at: null, id: { not: 'ses_1' } },
      data: { revoked_at: NOW },
    });
    expect(revoked).toBe(2);
  });

  it('no toca las que ya estaban revocadas: la fecha de revocacion es la primera', async () => {
    await revokeOtherUserSessions({ user_id: 'usr_1', except_session_id: 'ses_1' });

    expect(updateMany.mock.calls[0]?.[0].where).toMatchObject({ revoked_at: null });
  });

  it('es distinta de revokeAllUserSessions, que si se lleva la actual', async () => {
    await revokeAllUserSessions('usr_1', NOW);

    expect(updateMany).toHaveBeenCalledWith({
      where: { user_id: 'usr_1', revoked_at: null },
      data: { revoked_at: NOW },
    });
    expect(JSON.stringify(updateMany.mock.calls[0])).not.toContain('not');
  });
});
