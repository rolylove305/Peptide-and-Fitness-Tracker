import { readFile } from 'node:fs/promises';

const [filePath, expectedWidth = '180', expectedHeight = '180'] = process.argv.slice(2);

if (!filePath) {
  throw new Error('Usage: node scripts/verify-png.mjs <file> [width] [height]');
}

const bytes = await readFile(filePath);
const signature = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);

if (bytes.length < 33 || !bytes.subarray(0, 8).equals(signature)) {
  throw new Error(`${filePath} is not a valid PNG file.`);
}

function crc32(input) {
  let crc = 0xffffffff;
  for (const value of input) {
    crc ^= value;
    for (let bit = 0; bit < 8; bit += 1) {
      crc = (crc >>> 1) ^ (crc & 1 ? 0xedb88320 : 0);
    }
  }
  return (crc ^ 0xffffffff) >>> 0;
}

let offset = 8;
let width;
let height;
let foundIend = false;

while (offset + 12 <= bytes.length) {
  const length = bytes.readUInt32BE(offset);
  const chunkEnd = offset + 12 + length;
  if (chunkEnd > bytes.length) {
    throw new Error(`${filePath} contains a truncated PNG chunk.`);
  }

  const type = bytes.toString('ascii', offset + 4, offset + 8);
  const crcInput = bytes.subarray(offset + 4, offset + 8 + length);
  const expectedCrc = bytes.readUInt32BE(offset + 8 + length);
  const actualCrc = crc32(crcInput);

  if (actualCrc !== expectedCrc) {
    throw new Error(`${filePath} has an invalid CRC in the ${type} chunk.`);
  }

  if (type === 'IHDR') {
    width = bytes.readUInt32BE(offset + 8);
    height = bytes.readUInt32BE(offset + 12);
  }

  offset = chunkEnd;
  if (type === 'IEND') {
    foundIend = true;
    break;
  }
}

if (!foundIend || offset !== bytes.length) {
  throw new Error(`${filePath} is incomplete or has trailing data after IEND.`);
}

if (width !== Number(expectedWidth) || height !== Number(expectedHeight)) {
  throw new Error(
    `${filePath} dimensions are ${width}x${height}; expected ${expectedWidth}x${expectedHeight}.`,
  );
}

console.log(`Verified ${filePath}: ${width}x${height} PNG with valid chunks and CRCs.`);
