import { readFile, rm, mkdir, writeFile, stat } from 'node:fs/promises';
import { gunzipSync } from 'node:zlib';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const projectRoot = fileURLToPath(new URL('..', import.meta.url));
const workoutDirectory = path.join(projectRoot, 'src', 'features', 'workout');
const generatedDirectory = path.join(
  projectRoot,
  'public',
  'exercise-media',
  'generated',
);
const distExerciseMediaDirectory = path.join(
  projectRoot,
  'dist',
  'exercise-media',
);
const professionalMediaDirectory = path.join(
  distExerciseMediaDirectory,
  'professional',
);
const roles = ['hero', 'start', 'finish'];
const expectedWidth = 800;
const expectedHeight = 450;

const individualSlugs = [
  'goblet-squat',
  'push-up',
  'incline-dumbbell-press',
  'lat-pulldown',
  'seated-cable-row',
  'romanian-deadlift',
  'leg-press',
  'dumbbell-lateral-raise',
];

const mediaPacks = [
  {
    name: 'phase2',
    manifestPath: path.join(
      workoutDirectory,
      'phase2ExerciseMediaManifest.json',
    ),
    bundlePaths: [
      path.join(workoutDirectory, 'phase2ExerciseMediaSprites.b64'),
    ],
  },
  {
    name: 'phase3',
    manifestPath: path.join(
      workoutDirectory,
      'phase3ExerciseMediaManifest.json',
    ),
    bundlePaths: Array.from({ length: 9 }, (_, index) =>
      path.join(
        workoutDirectory,
        `phase3ExerciseMediaSprites.part${index + 1}.b64`,
      ),
    ),
  },
];

const expectedExerciseCount = 35;

function assertManifest(value, packName) {
  if (!Array.isArray(value) || value.length === 0) {
    throw new Error(
      `${packName} exercise media manifest must be a non-empty array.`,
    );
  }

  const seen = new Set();
  for (const [index, entry] of value.entries()) {
    if (!entry || typeof entry !== 'object') {
      throw new Error(`${packName} manifest entry ${index} must be an object.`);
    }
    if (
      typeof entry.slug !== 'string' ||
      !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(entry.slug)
    ) {
      throw new Error(
        `${packName} manifest entry ${index} has an invalid slug.`,
      );
    }
    if (seen.has(entry.slug)) {
      throw new Error(
        `Duplicate ${packName} exercise media slug: ${entry.slug}`,
      );
    }
    seen.add(entry.slug);

    if (!entry.alts || typeof entry.alts !== 'object') {
      throw new Error(
        `${packName} manifest entry ${entry.slug} is missing alt text.`,
      );
    }
    for (const role of roles) {
      const alt = entry.alts[role];
      if (typeof alt !== 'string' || alt.trim().length < 20) {
        throw new Error(
          `${packName} manifest entry ${entry.slug} has invalid ${role} alt text.`,
        );
      }
    }
  }

  return value;
}

async function readPack(pack) {
  const [manifestRaw, encodedParts] = await Promise.all([
    readFile(pack.manifestPath, 'utf8'),
    Promise.all(
      pack.bundlePaths.map((bundlePath) => readFile(bundlePath, 'utf8')),
    ),
  ]);

  const manifest = assertManifest(JSON.parse(manifestRaw), pack.name);
  const encoded = encodedParts.map((part) => part.trim()).join('');
  const decoded = gunzipSync(Buffer.from(encoded, 'base64')).toString('utf8');
  const sprites = JSON.parse(decoded);

  if (!sprites || typeof sprites !== 'object' || Array.isArray(sprites)) {
    throw new Error(
      `${pack.name} exercise media bundle must decode to a slug map.`,
    );
  }

  const expectedSlugs = new Set(manifest.map((entry) => entry.slug));
  for (const slug of expectedSlugs) {
    if (typeof sprites[slug] !== 'string') {
      throw new Error(`${pack.name} exercise media bundle is missing ${slug}.`);
    }
  }
  for (const slug of Object.keys(sprites)) {
    if (!expectedSlugs.has(slug)) {
      throw new Error(
        `${pack.name} exercise media bundle contains unexpected slug ${slug}.`,
      );
    }
  }

  return { ...pack, manifest, sprites };
}

async function readAllPacks() {
  const packs = await Promise.all(mediaPacks.map((pack) => readPack(pack)));
  const allSlugs = new Set(individualSlugs);

  for (const pack of packs) {
    for (const entry of pack.manifest) {
      if (allSlugs.has(entry.slug)) {
        throw new Error(
          `Duplicate exercise media slug across packs: ${entry.slug}`,
        );
      }
      allSlugs.add(entry.slug);
    }
  }

  if (allSlugs.size !== expectedExerciseCount) {
    throw new Error(
      `Exercise media coverage contains ${allSlugs.size} exercises; expected ${expectedExerciseCount}.`,
    );
  }

  return packs;
}

function extractPanels(sprite, slug) {
  const pattern =
    /<svg x="0" y="\d+" width="800" height="450" viewBox="0 0 800 450">([\s\S]*?)<\/svg>/g;
  const panels = Array.from(sprite.matchAll(pattern), (match) => match[1]);

  if (panels.length !== roles.length) {
    throw new Error(
      `${slug} contains ${panels.length} panels; expected ${roles.length}.`,
    );
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
  const packs = await readAllPacks();
  await rm(generatedDirectory, { recursive: true, force: true });

  let generatedCount = 0;
  for (const pack of packs) {
    for (const entry of pack.manifest) {
      const panels = extractPanels(pack.sprites[entry.slug], entry.slug);
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
  }

  const expectedGeneratedCount =
    packs.reduce((count, pack) => count + pack.manifest.length, 0) *
    roles.length;

  if (generatedCount !== expectedGeneratedCount) {
    throw new Error(
      `Generated ${generatedCount} files; expected ${expectedGeneratedCount}.`,
    );
  }

  console.log(
    `Generated ${generatedCount} professional media files for ${expectedExerciseCount} covered exercises.`,
  );
}

async function assertBuiltAsset(filePath) {
  const details = await stat(filePath);
  if (!details.isFile() || details.size < 500) {
    throw new Error(`Invalid built exercise media file: ${filePath}`);
  }
}

async function verifyDist() {
  const packs = await readAllPacks();
  let verifiedCount = 0;

  for (const slug of individualSlugs) {
    for (const role of roles) {
      await assertBuiltAsset(
        path.join(distExerciseMediaDirectory, slug, `${role}.svg`),
      );
      verifiedCount += 1;
    }
  }

  for (const pack of packs) {
    for (const entry of pack.manifest) {
      for (const role of roles) {
        await assertBuiltAsset(
          path.join(
            distExerciseMediaDirectory,
            'generated',
            entry.slug,
            `${role}.svg`,
          ),
        );
        verifiedCount += 1;
      }
    }
  }

  const professionalSlugs = [
    ...individualSlugs,
    ...packs.flatMap((pack) => pack.manifest.map((entry) => entry.slug)),
  ];
  for (const slug of professionalSlugs) {
    await assertBuiltAsset(
      path.join(professionalMediaDirectory, slug, 'hero.jpg'),
    );
    verifiedCount += 1;
  }

  const expectedCount = expectedExerciseCount * (roles.length + 1);
  if (verifiedCount !== expectedCount) {
    throw new Error(
      `Verified ${verifiedCount} files; expected ${expectedCount}.`,
    );
  }

  console.log(
    `Verified ${verifiedCount} built exercise media files across all 35 exercises.`,
  );
}

const command = process.argv[2] ?? 'generate';

if (command === 'generate') {
  await generate();
} else if (command === 'verify-dist') {
  await verifyDist();
} else {
  throw new Error(`Unknown exercise media command: ${command}`);
}
