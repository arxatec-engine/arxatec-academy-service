import { cpSync, rmSync } from 'node:fs';

const destination = new URL('../dist/infrastructure/certificates/assets/', import.meta.url);
rmSync(destination, { recursive: true, force: true });

cpSync(new URL('../src/infrastructure/certificates/assets/', import.meta.url), destination, {
  recursive: true,
});
