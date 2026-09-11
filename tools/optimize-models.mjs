/**
 * Rewrites public/models/*.glb in place for the browser.
 *
 * The camera scans come out of Polycam with three 4096x4096 JPEGs each
 * (baseColor + normal + occlusion). That is ~256 MB of GPU memory per camera,
 * or ~6.6 GB across the gallery -- far past what any consumer GPU can hold, so
 * the WebGL context dies or the driver thrashes. A camera never covers more
 * than ~800 screen pixels even when zoomed, so most of that detail can never
 * be sampled.
 *
 * Per texture slot this does two things:
 *   1. Downscale to a resolution that can actually be displayed.
 *   2. Re-encode to KTX2/Basis, which stays GPU-compressed (~0.5 bytes/pixel
 *      instead of 4) instead of being expanded to RGBA at upload time.
 *
 * Geometry is welded, reindexed and Meshopt-compressed, which is a smaller win
 * but free in visual terms.
 *
 * Originals are recoverable from git. Pass --dry-run to preview, or
 * --only=name1,name2 to process a subset.
 *
 * Usage: npm run optimize:models
 */
import fs from 'node:fs';
import path from 'node:path';
import sharp from 'sharp';
import { NodeIO } from '@gltf-transform/core';
import { ALL_EXTENSIONS, EXTMeshoptCompression, KHRTextureBasisu } from '@gltf-transform/extensions';
import { dedup, prune, weld, reorder, quantize } from '@gltf-transform/functions';
import { encodeToKTX2 } from 'ktx2-encoder'; // resolves to the Node build
import { MeshoptEncoder } from 'meshoptimizer/encoder';

globalThis.__KTX2_DEBUG__ = false; // the Basis encoder logs every mip slice otherwise

const MODELS_DIR = 'public/models';

const args = process.argv.slice(2);
const DRY_RUN = args.includes('--dry-run');
const ONLY = args.find((a) => a.startsWith('--only='))?.slice('--only='.length).split(',');

/**
 * Per-slot budget. baseColor carries all the visible photographic detail so it
 * keeps the most resolution; normal and occlusion are low-frequency on these
 * scans and hold up fine at a quarter of the pixels.
 */
const SLOT_CONFIG = {
  baseColor: { maxSize: 2048, srgb: true, normalMap: false, quality: 192 },
  emissive: { maxSize: 2048, srgb: true, normalMap: false, quality: 192 },
  normal: { maxSize: 1024, srgb: false, normalMap: true, quality: 192 },
  occlusion: { maxSize: 1024, srgb: false, normalMap: false, quality: 128 },
  metallicRoughness: { maxSize: 1024, srgb: false, normalMap: false, quality: 128 },
  other: { maxSize: 1024, srgb: true, normalMap: false, quality: 160 },
};

/** Basis needs raw RGBA in Node; sharp both decodes and resizes for us. */
async function decodeToRgba(buffer) {
  const { data, info } = await sharp(buffer)
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });
  return { width: info.width, height: info.height, data: new Uint8Array(data) };
}

async function toKtx2(buffer, { maxSize, srgb, normalMap, quality }) {
  const meta = await sharp(buffer).metadata();

  // Basis requires dimensions divisible by 4. Clamp to the budget, then round
  // down to a multiple of 4 while preserving aspect ratio.
  const scale = Math.min(1, maxSize / Math.max(meta.width, meta.height));
  const fit = (n) => Math.max(4, Math.floor((n * scale) / 4) * 4);
  const width = fit(meta.width);
  const height = fit(meta.height);

  const resized = await sharp(buffer)
    .resize(width, height, { fit: 'fill', kernel: 'lanczos3' })
    .png({ compressionLevel: 0 })
    .toBuffer();

  const ktx2 = await encodeToKTX2(new Uint8Array(resized), {
    isKTX2File: true,
    isUASTC: false, // ETC1S: ~0.5 bytes/pixel on the GPU, small on the wire
    generateMipmap: true, // essential -- without mips, minified textures alias badly
    // Above ~192 the file grows with no visible benefit: on this content
    // qlevel 192 is 753 KB vs 800 KB at 255, for an identical-looking result.
    qualityLevel: quality,
    compressionLevel: 2,
    isNormalMap: normalMap,
    isPerceptual: srgb,
    isSetKTX2SRGBTransferFunc: srgb,
    imageDecoder: decodeToRgba,
  });

  return { data: ktx2, width, height, from: `${meta.width}×${meta.height}` };
}

/** Which material slot does this texture feed? Drives resolution and color space. */
function slotOf(document, texture) {
  for (const material of document.getRoot().listMaterials()) {
    if (material.getBaseColorTexture() === texture) return 'baseColor';
    if (material.getNormalTexture() === texture) return 'normal';
    if (material.getOcclusionTexture() === texture) return 'occlusion';
    if (material.getMetallicRoughnessTexture() === texture) return 'metallicRoughness';
    if (material.getEmissiveTexture() === texture) return 'emissive';
  }
  return 'other';
}

await MeshoptEncoder.ready;
const io = new NodeIO()
  .registerExtensions(ALL_EXTENSIONS)
  .registerDependencies({ 'meshopt.encoder': MeshoptEncoder });

const files = fs
  .readdirSync(MODELS_DIR)
  .filter((f) => f.endsWith('.glb'))
  .filter((f) => !ONLY || ONLY.includes(path.basename(f, '.glb')))
  .sort();

let beforeTotal = 0;
let afterTotal = 0;

for (const file of files) {
  const filePath = path.join(MODELS_DIR, file);
  const before = fs.statSync(filePath).size;
  const document = await io.read(filePath);

  // Geometry: drop duplicates and unused data, weld seams, then reorder for
  // vertex-cache locality so Meshopt compresses well.
  await document.transform(
    dedup(),
    prune({ keepAttributes: false }),
    weld(),
    reorder({ encoder: MeshoptEncoder, target: 'size' }),
    quantize({ pattern: /^(POSITION|TEXCOORD|NORMAL|TANGENT)$/ }),
  );

  // Declaring KHR_texture_basisu is what tells a glTF reader to hand these
  // images to a KTX2 transcoder. Without it the mimeType alone is ignored and
  // three.js tries to decode each one as an ordinary image, which silently
  // fails and leaves every model untextured.
  document.createExtension(KHRTextureBasisu).setRequired(true);

  const notes = [];
  for (const texture of document.getRoot().listTextures()) {
    const source = texture.getImage();
    if (!source) continue;

    const mime = texture.getMimeType();
    if (mime === 'image/ktx2') {
      notes.push('already ktx2');
      continue;
    }

    const slot = slotOf(document, texture);
    const { data, width, height, from } = await toKtx2(Buffer.from(source), SLOT_CONFIG[slot]);

    texture.setImage(data).setMimeType('image/ktx2');
    // KTX2 carries its own extension; keep URIs consistent for embedded GLB.
    if (texture.getURI()) texture.setURI(texture.getURI().replace(/\.\w+$/, '.ktx2'));

    notes.push(
      `${slot} ${from}→${width}×${height} ` +
        `${(source.byteLength / 1024).toFixed(0)}KB→${(data.byteLength / 1024).toFixed(0)}KB`,
    );
  }

  // Meshopt-compress vertex/index buffers. Smaller win than the textures, but
  // free in quality terms. three.js decodes this via MeshoptDecoder.
  document
    .createExtension(EXTMeshoptCompression)
    .setRequired(true)
    .setEncoderOptions({ method: EXTMeshoptCompression.EncoderMethod.QUANTIZE });

  const output = await io.writeBinary(document);
  if (!DRY_RUN) fs.writeFileSync(filePath, output);

  beforeTotal += before;
  afterTotal += output.byteLength;
  const pct = ((1 - output.byteLength / before) * 100).toFixed(0);
  console.log(
    `${file.padEnd(26)} ${(before / 1048576).toFixed(2)}MB → ` +
      `${(output.byteLength / 1048576).toFixed(2)}MB  (-${pct}%)`,
  );
  for (const note of notes) console.log(`  · ${note}`);
}

console.log(
  `\n${DRY_RUN ? '[dry run] ' : ''}total: ` +
    `${(beforeTotal / 1048576).toFixed(1)}MB → ${(afterTotal / 1048576).toFixed(1)}MB ` +
    `(-${((1 - afterTotal / beforeTotal) * 100).toFixed(0)}%)`,
);
