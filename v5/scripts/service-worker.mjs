import { readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';

const TOKEN = '__BIOTRACK_BUILD_ID__';
const swPath = resolve(process.cwd(), 'dist', 'sw.js');
const buildId =
  process.env.CF_PAGES_COMMIT_SHA ??
  process.env.GITHUB_SHA ??
  `local-${Date.now().toString(36)}`;

const source = await readFile(swPath, 'utf8');
if (!source.includes(TOKEN)) {
  throw new Error(`Service worker build token was not found in ${swPath}.`);
}

const stamped = source.replaceAll(
  TOKEN,
  buildId.replace(/[^a-zA-Z0-9._-]/g, '-'),
);
await writeFile(swPath, stamped, 'utf8');
console.log(`Stamped BioTrack service worker build ${buildId}.`);
