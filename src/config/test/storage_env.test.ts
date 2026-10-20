import { readStorageEnvironment, storageEnvSchema } from '@/config/storage_env';

const s3 = {
  STORAGE_DRIVER: 's3',
  AWS_REGION: 'us-east-1',
  AWS_S3_BUCKET: 'academy-test',
  STORAGE_PUBLIC_URL: 'https://cdn.example.test',
  CLOUDFRONT_KEY_PAIR_ID: 'KTEST',
  CLOUDFRONT_PRIVATE_KEY: 'private-key-from-secrets',
};

describe('configuración S3/CloudFront', () => {
  it('reconoce los nombres de producto usados en Academy con precedencia sobre los genéricos', () => {
    const normalized = readStorageEnvironment({
      STORAGE_DRIVER: 's3',
      STORAGE_PUBLIC_URL: 'http://localhost:3001/files',
      AWS_REGION: 'us-east-1',
      AWS_S3_BUCKET: 'old-bucket',
      S3_ACADEMY_PRODUCT_BUCKET: 'academy-development',
      CDN_ACADEMY_PRODUCT_BASE_URL: 'https://cdn.academy.test',
      CLOUDFRONT_ACADEMY_PRODUCT_KEY_PAIR_ID: 'KACADEMY',
      CLOUDFRONT_ACADEMY_PRODUCT_PRIVATE_KEY_PATH: '/run/secrets/academy.pem',
      CLOUDFRONT_SIGNED_URL_TTL_SECONDS: '300',
    });
    expect(storageEnvSchema.parse(normalized)).toMatchObject({
      AWS_S3_BUCKET: 'academy-development',
      STORAGE_PUBLIC_URL: 'https://cdn.academy.test',
      CLOUDFRONT_KEY_PAIR_ID: 'KACADEMY',
      CLOUDFRONT_PRIVATE_KEY_PATH: '/run/secrets/academy.pem',
      CLOUDFRONT_URL_TTL_SECONDS: 300,
    });
  });

  it('mantiene el dominio local aunque haya variables de producto al seleccionar local', () => {
    const normalized = readStorageEnvironment({
      STORAGE_DRIVER: 'local',
      STORAGE_PUBLIC_URL: 'http://localhost:3001/files',
      CDN_ACADEMY_PRODUCT_BASE_URL: 'https://cdn.academy.test',
    });
    expect(storageEnvSchema.parse(normalized).STORAGE_PUBLIC_URL).toBe(
      'http://localhost:3001/files',
    );
  });

  it('mantiene local como predeterminado sin exigir secretos de AWS', () => {
    expect(storageEnvSchema.parse({ AWS_REGION: '', CLOUDFRONT_PRIVATE_KEY: ' ' })).toMatchObject({
      STORAGE_DRIVER: 'local',
      CLOUDFRONT_URL_TTL_SECONDS: 300,
    });
  });

  it('permite IAM/default credential chain sin claves estáticas', () => {
    expect(storageEnvSchema.safeParse(s3).success).toBe(true);
  });

  it('admite credenciales temporales completas', () => {
    expect(
      storageEnvSchema.parse({
        ...s3,
        AWS_ACCESS_KEY_ID: 'id',
        AWS_SECRET_ACCESS_KEY: 'secret',
        AWS_SESSION_TOKEN: 'token',
      }).AWS_SESSION_TOKEN,
    ).toBe('token');
  });

  it.each(['AWS_REGION', 'AWS_S3_BUCKET', 'CLOUDFRONT_KEY_PAIR_ID', 'CLOUDFRONT_PRIVATE_KEY'])(
    'requiere %s con el driver S3',
    (field) => {
      expect(storageEnvSchema.safeParse({ ...s3, [field]: '' }).success).toBe(false);
    },
  );

  it('rechaza credenciales incompletas y el localhost predeterminado para CDN', () => {
    expect(storageEnvSchema.safeParse({ ...s3, AWS_ACCESS_KEY_ID: 'id' }).success).toBe(false);
    expect(storageEnvSchema.safeParse({ ...s3, AWS_SECRET_ACCESS_KEY: 'secret' }).success).toBe(
      false,
    );
    expect(storageEnvSchema.safeParse({ ...s3, STORAGE_PUBLIC_URL: undefined }).success).toBe(
      false,
    );
  });

  it('permite exactamente una fuente para la clave privada', () => {
    expect(
      storageEnvSchema.safeParse({
        ...s3,
        CLOUDFRONT_PRIVATE_KEY: undefined,
        CLOUDFRONT_PRIVATE_KEY_PATH: '/run/secrets/cdn.pem',
      }).success,
    ).toBe(true);
    expect(
      storageEnvSchema.safeParse({ ...s3, CLOUDFRONT_PRIVATE_KEY_PATH: '/run/secrets/cdn.pem' })
        .success,
    ).toBe(false);
  });

  it.each([0, -1, 1.5, 86401])('rechaza el TTL inválido %s', (ttl) => {
    expect(storageEnvSchema.safeParse({ ...s3, CLOUDFRONT_URL_TTL_SECONDS: ttl }).success).toBe(
      false,
    );
  });
});
