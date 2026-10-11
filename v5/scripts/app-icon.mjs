import { mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const source = resolve(root, 'public/apple-touch-icon.png.base64');
const generated = resolve(root, 'public/apple-touch-icon.png');
const copiedSource = resolve(root, 'dist/apple-touch-icon.png.base64');
const mode = process.argv[2];

if (mode === 'prepare') {
  const encoded = (await readFile(source, 'utf8')).trim();
  await mkdir(dirname(generated), { recursive: true });
  await writeFile(generated, Buffer.from(encoded, 'base64'));
} else if (mode === 'cleanup') {
  await Promise.all([
    rm(generated, { force: true }),
    rm(copiedSource, { force: true }),
  ]);
} else {
  throw new Error('Expected prepare or cleanup.');
}
