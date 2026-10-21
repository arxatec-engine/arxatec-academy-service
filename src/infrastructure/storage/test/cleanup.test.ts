import { logger } from '@/config/logger';
import { StorageCleanupPolicy } from '@/constants/files';
import {
  drainStorageDeletions,
  removeStoredFile,
  startStorageCleanupWorker,
} from '@/infrastructure/storage/cleanup';
import {
  claimStorageDeletion,
  completeStorageDeletion,
  hasStoredFileReferences,
  queueStorageDeletion,
  retryStorageDeletion,
  type StorageDeletion,
} from '@/infrastructure/storage/cleanup.repository';
import { storage } from '@/infrastructure/storage/storage';

jest.mock('@/config/logger', () => ({ logger: { warn: jest.fn() } }));
jest.mock('@/infrastructure/storage/storage', () => ({ storage: { remove: jest.fn() } }));
jest.mock('@/infrastructure/storage/cleanup.repository', () => ({
  claimStorageDeletion: jest.fn(),
  completeStorageDeletion: jest.fn(),
  hasStoredFileReferences: jest.fn(),
  queueStorageDeletion: jest.fn(),
  retryStorageDeletion: jest.fn(),
}));

const job: StorageDeletion = {
  file_key: 'private/lesson_resources/test.pdf',
  attempts: 1,
  lease_token: 'worker-1',
};
const claim = jest.mocked(claimStorageDeletion);
const complete = jest.mocked(completeStorageDeletion);
const referenced = jest.mocked(hasStoredFileReferences);
const queue = jest.mocked(queueStorageDeletion);
const retry = jest.mocked(retryStorageDeletion);
const remove = jest.spyOn(storage, 'remove');

beforeEach(() => {
  jest.resetAllMocks();
  claim.mockResolvedValue(null).mockResolvedValueOnce(job);
  complete.mockResolvedValue({ count: 1 });
  referenced.mockResolvedValue(false);
  queue.mockResolvedValue(undefined);
  retry.mockResolvedValue({ count: 1 });
  remove.mockResolvedValue(undefined);
});

afterEach(() => jest.useRealTimers());

describe('limpieza persistente de archivos', () => {
  it('registra la clave, borra el archivo y confirma el trabajo en ese orden', async () => {
    await removeStoredFile(job.file_key);
    expect(queue).toHaveBeenCalledWith(job.file_key);
    expect(remove).toHaveBeenCalledWith(job.file_key);
    expect(complete).toHaveBeenCalledWith(job);
    expect(queue.mock.invocationCallOrder[0]).toBeLessThan(remove.mock.invocationCallOrder[0] ?? 0);
    expect(remove.mock.invocationCallOrder[0]).toBeLessThan(
      complete.mock.invocationCallOrder[0] ?? 0,
    );
    expect(retry).not.toHaveBeenCalled();
  });

  it('conserva archivos que todavía tienen referencias y retira el trabajo pendiente', async () => {
    referenced.mockResolvedValue(true);
    await removeStoredFile(job.file_key);
    expect(remove).not.toHaveBeenCalled();
    expect(complete).toHaveBeenCalledWith(job);
  });

  it('mantiene un reintento persistente cuando S3 falla', async () => {
    remove.mockRejectedValue(new Error('S3 unavailable'));
    await expect(removeStoredFile(job.file_key)).resolves.toBeUndefined();
    expect(retry).toHaveBeenCalledWith(job);
    expect(complete).not.toHaveBeenCalled();
  });

  it('reintenta también si el objeto se borró pero no se pudo confirmar en la base', async () => {
    complete.mockRejectedValue(new Error('DB unavailable'));
    await removeStoredFile(job.file_key);
    expect(remove).toHaveBeenCalledWith(job.file_key);
    expect(retry).toHaveBeenCalledWith(job);
  });

  it('no oculta el error original de una subida si la cola no está disponible', async () => {
    queue.mockRejectedValue(new Error('DB unavailable'));
    await expect(removeStoredFile(job.file_key)).resolves.toBeUndefined();
    expect(remove).not.toHaveBeenCalled();
    expect(logger.warn).toHaveBeenCalled();
  });

  it.each([null, '../test.pdf', 'https://external.test/test.pdf'])(
    'ignora la clave nula o externa %s',
    async (key) => {
      await removeStoredFile(key);
      expect(queue).not.toHaveBeenCalled();
      expect(remove).not.toHaveBeenCalled();
    },
  );

  it('no compite con un trabajo que ya tiene una reserva activa', async () => {
    claim.mockReset().mockResolvedValue(null);
    await removeStoredFile(job.file_key);
    expect(remove).not.toHaveBeenCalled();
    expect(complete).not.toHaveBeenCalled();
  });

  it('descarta claves inválidas de la cola sin enviarlas a S3', async () => {
    claim
      .mockReset()
      .mockResolvedValue(null)
      .mockResolvedValueOnce({ ...job, file_key: '../file' });
    await drainStorageDeletions();
    expect(remove).not.toHaveBeenCalled();
    expect(complete).toHaveBeenCalled();
  });

  it('procesa los trabajos registrados antes de reiniciar el servidor', async () => {
    await drainStorageDeletions();
    expect(queue).not.toHaveBeenCalled();
    expect(remove).toHaveBeenCalledWith(job.file_key);
    expect(claim).toHaveBeenCalledTimes(2);
  });

  it('no solapa ciclos del worker y espera el trabajo activo antes de cerrarse', async () => {
    jest.useFakeTimers();
    let release: (value: StorageDeletion | null) => void = () => undefined;
    claim.mockReset().mockReturnValue(
      new Promise((resolve) => {
        release = resolve;
      }),
    );
    const worker = startStorageCleanupWorker();
    await jest.advanceTimersByTimeAsync(StorageCleanupPolicy.interval_ms * 2);
    expect(claim).toHaveBeenCalledTimes(1);
    const closing = worker.close();
    release(null);
    await closing;
    await jest.advanceTimersByTimeAsync(StorageCleanupPolicy.interval_ms * 2);
    expect(claim).toHaveBeenCalledTimes(1);
  });
});
