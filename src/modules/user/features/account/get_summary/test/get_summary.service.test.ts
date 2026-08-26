import { ErrorCodes } from '@/constants/error_codes';
import { HttpStatusCodes } from '@/constants/http_status_codes';
import { countCompletedEnrollments } from '@/modules/progress/shared/data/progress.repository';
import { getSummaryService } from '@/modules/user/features/account/get_summary/presentation/get_summary.service';
import { findUserSummary } from '@/modules/user/shared/data/user_account.repository';

jest.mock('@/modules/user/shared/data/user_account.repository', () => ({
  findUserSummary: jest.fn(),
}));

jest.mock('@/modules/progress/shared/data/progress.repository', () => ({
  countCompletedEnrollments: jest.fn(),
}));

const findSummaryMock = jest.mocked(findUserSummary);
const countCompletedMock = jest.mocked(countCompletedEnrollments);

beforeEach(() => {
  findSummaryMock.mockResolvedValue({ created_at: new Date('2026-05-12T10:00:00.000Z') });
  countCompletedMock.mockResolvedValue(1);
});

describe('getSummaryService', () => {
  it('devuelve la fecha de alta en ISO y los cursos terminados', async () => {
    await expect(getSummaryService({ user_id: 'usr_1' })).resolves.toEqual({
      member_since: '2026-05-12T10:00:00.000Z',
      completed_courses: 1,
    });
  });

  it('cuenta las inscripciones terminadas por la fachada de progreso', async () => {
    await getSummaryService({ user_id: 'usr_1' });

    expect(countCompletedMock).toHaveBeenCalledWith('usr_1');
  });

  it('una cuenta sin cursos terminados devuelve cero, no null', async () => {
    countCompletedMock.mockResolvedValue(0);

    await expect(getSummaryService({ user_id: 'usr_1' })).resolves.toMatchObject({
      completed_courses: 0,
    });
  });

  it('un usuario que ya no existe responde 404 y no cuenta nada', async () => {
    findSummaryMock.mockResolvedValue(null);

    await expect(getSummaryService({ user_id: 'usr_1' })).rejects.toMatchObject({
      statusCode: HttpStatusCodes.NOT_FOUND.code,
      meta: { code: ErrorCodes.NOT_FOUND },
    });
    expect(countCompletedMock).not.toHaveBeenCalled();
  });
});
