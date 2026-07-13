import { readFile, rm, mkdir, writeFile, stat } from 'node:fs/promises';
import { gunzipSync } from 'node:zlib';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const projectRoot = fileURLToPath(new URL('..', import.meta.url));
const workoutDirectory = path.join(projectRoot, 'src', 'features', 'workout');
const manifestPath = path.join(workoutDirectory, 'phase2ExerciseMediaManifest.json');
const bundlePath = path.join(workoutDirectory, 'phase2ExerciseMediaSprites.b64');
const generatedDirectory = path.join(projectRoot, 'public', 'exercise-media', 'generated');
const distDirectory = path.join(projectRoot, 'dist', 'exercise-media', 'generated');
const roles = ['hero', 'start', 'finish'];
const expectedWidth = 800;
const expectedHeight = 450;

function assertManifest(value) {
  if (!Array.isArray(value) || value.length === 0) {
    throw new Error('Phase 2 exercise media manifest must be a non-empty array.');
  }

  const seen = new Set();
  for (const [index, entry] of value.entries()) {
    if (!entry || typeof entry !== 'object') {
      throw new Error(`Manifest entry ${index} must be an object.`);
    }
    if (typeof entry.slug !== 'string' || !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(entry.slug)) {
      throw new Error(`Manifest entry ${index} has an invalid slug.`);
    }
    if (seen.has(entry.slug)) {
      throw new Error(`Duplicate exercise media slug: ${entry.slug}`);
    }
    seen.add(entry.slug);

    if (!entry.alts || typeof entry.alts !== 'object') {
      throw new Error(`Manifest entry ${entry.slug} is missing alt text.`);
    }
    for (const role of roles) {
      const alt = entry.alts[role];
      if (typeof alt !== 'string' || alt.trim().length < 20) {
        throw new Error(`Manifest entry ${entry.slug} has invalid ${role} alt text.`);
      }
    }
  }

  return value;
}

async function readManifest() {
  const raw = await readFile(manifestPath, 'utf8');
  return assertManifest(JSON.parse(raw));
}

async function readSprites() {
  const encoded = (await readFile(bundlePath, 'utf8')).trim();
  const decoded = gunzipSync(Buffer.from(encoded, 'base64')).toString('utf8');
  const value = JSON.parse(decoded);

  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new Error('Phase 2 exercise media bundle must decode to a slug map.');
  }

  return value;
}

function extractPanels(sprite, slug) {
  const pattern =
    /<svg x="0" y="\d+" width="800" height="450" viewBox="0 0 800 450">([\s\S]*?)<\/svg>/g;
  const panels = Array.from(sprite.matchAll(pattern), (match) => match[1]);

  if (panels.length !== roles.length) {
    throw new Error(`${slug} contains ${panels.length} panels; expected ${roles.length}.`);
  }

  return panels;
}

function standaloneSvg(panel) {
  return [
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${expectedWidth} ${expectedHeight}" role="img" aria-hidden="true">`,
    panel,
    '</svg>',
    '',
  ].join('\n');
}

async function generate() {
  const [manifest, sprites] = await Promise.all([readManifest(), readSprites()]);
  const expectedSlugs = new Set(manifest.map((entry) => entry.slug));
  const bundledSlugs = Object.keys(sprites);

  for (const slug of expectedSlugs) {
    if (typeof sprites[slug] !== 'string') {
      throw new Error(`Exercise media bundle is missing ${slug}.`);
    }
  }
  for (const slug of bundledSlugs) {
    if (!expectedSlugs.has(slug)) {
      throw new Error(`Exercise media bundle contains unexpected slug ${slug}.`);
    }
  }

  await rm(generatedDirectory, { recursive: true, force: true });

  let generatedCount = 0;
  for (const entry of manifest) {
    const panels = extractPanels(sprites[entry.slug], entry.slug);
    const outputDirectory = path.join(generatedDirectory, entry.slug);
    await mkdir(outputDirectory, { recursive: true });

    for (const [index, role] of roles.entries()) {
      await writeFile(
        path.join(outputDirectory, `${role}.svg`),
        standaloneSvg(panels[index]),
        'utf8',
      );
      generatedCount += 1;
    }
  }

  const expectedCount = manifest.length * roles.length;
  if (generatedCount !== expectedCount) {
    throw new Error(`Generated ${generatedCount} files; expected ${expectedCount}.`);
  }

  console.log(`Generated ${generatedCount} professional exercise media files.`);
}

async function verifyDist() {
  const manifest = await readManifest();
  let verifiedCount = 0;

  for (const entry of manifest) {
    for (const role of roles) {
      const filePath = path.join(distDirectory, entry.slug, `${role}.svg`);
      const details = await stat(filePath);
      if (!details.isFile() || details.size < 500) {
        throw new Error(`Invalid built exercise media file: ${filePath}`);
      }
      verifiedCount += 1;
    }
  }

  console.log(`Verified ${verifiedCount} built exercise media files.`);
}

const command = process.argv[2] ?? 'generate';

if (command === 'generate') {
  await generate();
} else if (command === 'verify-dist') {
  await verifyDist();
} else {
  throw new Error(`Unknown exercise media command: ${command}`);
}
