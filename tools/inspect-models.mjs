/**
 * Reports the real browser cost of every .glb in public/models:
 * bytes over the wire, and estimated GPU texture memory once decoded.
 *
 * GPU memory is the number that actually breaks pages. A 4096x4096 JPEG is
 * ~2 MB to download but ~87 MB resident (4096*4096*4 bytes RGBA, x1.33 for
 * mipmaps). KTX2/Basis textures stay compressed on the GPU at ~0.5 bytes per
 * pixel (ETC1S) or ~1.0 (UASTC), which is where the savings come from.
 *
 * Usage: npm run inspect:models
 */
import fs from 'node:fs';
import path from 'node:path';
import sharp from 'sharp';

const MODELS_DIR = 'public/models';
const MIPMAP_FACTOR = 4 / 3; // full mip chain adds ~33%

function readGlb(file) {
  const buf = fs.readFileSync(file);
  if (buf.readUInt32LE(0) !== 0x46546c67) throw new Error(`${file}: not a GLB`);
  const jsonLength = buf.readUInt32LE(12);
  const json = JSON.parse(buf.subarray(20, 20 + jsonLength).toString('utf8'));
  // BIN chunk follows the JSON chunk, after its own 8-byte header
  return { json, bin: buf.subarray(20 + jsonLength + 8), size: buf.length };
}

/** KTX2 stays compressed on the GPU, so bytes-per-pixel depends on the encoding. */
function readKtx2(data) {
  const width = data.readUInt32LE(20);
  const height = data.readUInt32LE(24);
  const supercompression = data.readUInt32LE(44);
  // 1 = BasisLZ (ETC1S, ~4bpp), 2 = Zstd (UASTC, ~8bpp)
  const bytesPerPixel = supercompression === 1 ? 0.5 : 1.0;
  return { width, height, bytesPerPixel, kind: supercompression === 1 ? 'ETC1S' : 'UASTC' };
}

async function imageInfo(data, mimeType) {
  if (mimeType === 'image/ktx2') return readKtx2(data);
  const { width, height } = await sharp(data).metadata();
  return { width, height, bytesPerPixel: 4, kind: mimeType.replace('image/', '') };
}

function triangleCount(json) {
  let tris = 0;
  for (const mesh of json.meshes ?? []) {
    for (const prim of mesh.primitives) {
      const accessor = prim.indices != null
        ? json.accessors[prim.indices]
        : json.accessors[prim.attributes.POSITION];
      tris += accessor.count / 3;
    }
  }
  return tris;
}

const files = fs.readdirSync(MODELS_DIR).filter((f) => f.endsWith('.glb')).sort();
const rows = [];
const totals = { download: 0, textureBytes: 0, vram: 0, tris: 0 };

for (const file of files) {
  const { json, bin, size } = readGlb(path.join(MODELS_DIR, file));

  let textureBytes = 0;
  let vram = 0;
  const kinds = new Set();
  const dims = new Set();

  for (const image of json.images ?? []) {
    const view = json.bufferViews[image.bufferView];
    const offset = view.byteOffset ?? 0;
    const data = bin.subarray(offset, offset + view.byteLength);
    const { width, height, bytesPerPixel, kind } = await imageInfo(data, image.mimeType);

    textureBytes += view.byteLength;
    vram += width * height * bytesPerPixel * MIPMAP_FACTOR;
    kinds.add(kind);
    dims.add(`${width}×${height}`);
  }

  const tris = triangleCount(json);
  totals.download += size;
  totals.textureBytes += textureBytes;
  totals.vram += vram;
  totals.tris += tris;

  rows.push({
    model: file,
    MB: +(size / 1048576).toFixed(2),
    tris,
    imgs: json.images?.length ?? 0,
    format: [...kinds].join('+'),
    sizes: [...dims].slice(0, 3).join(' '),
    'GPU MB': +(vram / 1048576).toFixed(1),
  });
}

console.table(rows);
console.log([
  `models:            ${files.length}`,
  `download total:    ${(totals.download / 1048576).toFixed(1)} MB`,
  `  of which texture:${(totals.textureBytes / 1048576).toFixed(1)} MB`,
  `triangles:         ${totals.tris.toLocaleString('en-US')}`,
  `GPU texture memory:${(totals.vram / 1048576).toFixed(0)} MB  <-- the number that breaks browsers`,
].join('\n'));
