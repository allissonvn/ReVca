// Dev utility: decodifica/encode PNG sem dependências e combina imagens
// extraídas do PDF (RGB + máscara de tons de cinza) em RGBA.
// Uso direto: node scripts/extract-assets.mjs <dir-img> <dir-saida>
import { readFileSync, writeFileSync, copyFileSync, mkdirSync } from "node:fs";
import { join, resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { inflateSync, deflateSync } from "node:zlib";

// --- decode mínimo de PNG (8 bits, sem interlace) ---
export function decodePng(buf) {
  if (buf.readUInt32BE(0) !== 0x89504e47) throw new Error("not a PNG");
  let off = 8, width = 0, height = 0, colorType = 0, bitDepth = 0, idat = [];
  while (off < buf.length) {
    const len = buf.readUInt32BE(off);
    const type = buf.toString("ascii", off + 4, off + 8);
    const data = buf.subarray(off + 8, off + 8 + len);
    if (type === "IHDR") {
      width = data.readUInt32BE(0);
      height = data.readUInt32BE(4);
      bitDepth = data[8];
      colorType = data[9];
      if (data[12] !== 0) throw new Error("interlaced PNG not supported");
    } else if (type === "IDAT") idat.push(data);
    off += 12 + len;
  }
  if (bitDepth !== 8) throw new Error("only 8-bit depth supported");
  const channels = { 0: 1, 2: 3, 3: 1, 4: 2, 6: 4 }[colorType];
  if (channels === undefined) throw new Error(`unsupported color type ${colorType}`);
  const raw = inflateSync(Buffer.concat(idat));
  const stride = width * channels;
  const px = Buffer.alloc(height * stride);
  let prev = Buffer.alloc(stride);
  for (let y = 0; y < height; y++) {
    const filter = raw[y * (stride + 1)];
    const row = raw.subarray(y * (stride + 1) + 1, (y + 1) * (stride + 1));
    const cur = px.subarray(y * stride, (y + 1) * stride);
    for (let x = 0; x < stride; x++) {
      const a = x >= channels ? cur[x - channels] : 0;
      const b = prev[x];
      const c = x >= channels ? prev[x - channels] : 0;
      let v = row[x];
      if (filter === 1) v += a;
      else if (filter === 2) v += b;
      else if (filter === 3) v += Math.floor((a + b) / 2);
      else if (filter === 4) {
        const p = a + b - c, pa = Math.abs(p - a), pb = Math.abs(p - b), pc = Math.abs(p - c);
        v += pa <= pb && pa <= pc ? a : pb <= pc ? b : c;
      }
      cur[x] = v & 0xff;
    }
    prev = cur;
  }
  return { width, height, channels, px };
}

function toRgba(img) {
  const { width, height, channels, px } = img;
  const out = Buffer.alloc(width * height * 4);
  for (let i = 0; i < width * height; i++) {
    if (channels === 4) px.copy(out, i * 4, i * 4, i * 4 + 4);
    else if (channels === 3) { out[i * 4] = px[i * 3]; out[i * 4 + 1] = px[i * 3 + 1]; out[i * 4 + 2] = px[i * 3 + 2]; out[i * 4 + 3] = 255; }
    else if (channels === 2) { out[i * 4] = out[i * 4 + 1] = out[i * 4 + 2] = px[i * 2]; out[i * 4 + 3] = px[i * 2 + 1]; }
    else { out[i * 4] = out[i * 4 + 1] = out[i * 4 + 2] = px[i]; out[i * 4 + 3] = 255; }
  }
  return { width, height, rgba: out };
}

// --- encode PNG (RGBA, filtro 0) ---
const CRC_TABLE = (() => {
  const t = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    t[n] = c >>> 0;
  }
  return t;
})();
function crc32(buf) {
  let c = 0xffffffff;
  for (const b of buf) c = CRC_TABLE[(c ^ b) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}
function chunk(type, data) {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length);
  const body = Buffer.concat([Buffer.from(type, "ascii"), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(body));
  return Buffer.concat([len, body, crc]);
}
export function encodePng(width, height, rgba) {
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8; ihdr[9] = 6; ihdr[10] = 0; ihdr[11] = 0; ihdr[12] = 0;
  const stride = width * 4;
  const raw = Buffer.alloc(height * (stride + 1));
  for (let y = 0; y < height; y++) {
    raw[y * (stride + 1)] = 0;
    rgba.copy(raw, y * (stride + 1) + 1, y * stride, (y + 1) * stride);
  }
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk("IHDR", ihdr),
    chunk("IDAT", deflateSync(raw, { level: 9 })),
    chunk("IEND", Buffer.alloc(0)),
  ]);
}

/** Soma imagem RGB (canal R da máscara como alfa). */
function combine(rgbFile, maskFile, outFile) {
  const img = decodePng(readFileSync(rgbFile));
  const mask = decodePng(readFileSync(maskFile));
  if (img.width !== mask.width || img.height !== mask.height) throw new Error(`size mismatch for ${outFile}`);
  const { width, height, rgba } = toRgba(img);
  const m = toRgba(mask);
  for (let i = 0; i < width * height; i++) rgba[i * 4 + 3] = m.rgba[i * 4];
  writeFileSync(outFile, encodePng(width, height, rgba));
}

function main() {
  const [inDir, outDirArg] = process.argv.slice(2);
  if (!inDir || !outDirArg) {
    console.error("uso: node scripts/extract-assets.mjs <dir-img> <dir-saida>");
    process.exit(1);
  }
  const outDir = resolve(outDirArg);
  mkdirSync(outDir, { recursive: true });
  const f = (n) => join(resolve(inDir), n);
  const o = (n) => join(outDir, n);
  combine(f("img1-003.png"), f("img1-004.png"), o("logo-vca.png"));
  combine(f("img1-007.png"), f("img1-008.png"), o("uni-ville.png"));
  combine(f("img10-007.png"), f("img10-008.png"), o("kahakai.png"));
  combine(f("img11-007.png"), f("img11-008.png"), o("dona-olivia.png"));
  combine(f("img17-009.png"), f("img17-010.png"), o("baron-connect.png"));
  combine(f("img17-007.png"), f("img17-008.png"), o("baron-uchoa.png"));
  copyFileSync(f("img1-000.png"), o("watermark.png"));
  console.log("assets gerados em", outDir);
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) main();
