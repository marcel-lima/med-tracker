import { deflateSync } from 'zlib';
import { writeFileSync, mkdirSync } from 'fs';

// ─── PNG encoder (no external deps) ──────────────────────────────────────────
const CRC_TABLE = new Uint32Array(256);
for (let i = 0; i < 256; i++) {
  let c = i;
  for (let k = 0; k < 8; k++) c = (c & 1) ? 0xEDB88320 ^ (c >>> 1) : c >>> 1;
  CRC_TABLE[i] = c;
}
function crc32(buf) {
  let crc = 0xFFFFFFFF;
  for (const b of buf) crc = (crc >>> 8) ^ CRC_TABLE[(crc ^ b) & 0xFF];
  return (crc ^ 0xFFFFFFFF) >>> 0;
}
function chunk(type, data) {
  const t = Buffer.from(type), len = Buffer.allocUnsafe(4), crcB = Buffer.allocUnsafe(4);
  len.writeUInt32BE(data.length);
  crcB.writeUInt32BE(crc32(Buffer.concat([t, data])));
  return Buffer.concat([len, t, data, crcB]);
}

function lerp(a, b, t) { return Math.round(a + (b - a) * t); }

function makePNG(size, maskable = false) {
  const ihdr = Buffer.allocUnsafe(13);
  ihdr.writeUInt32BE(size, 0); ihdr.writeUInt32BE(size, 4);
  ihdr[8] = 8; ihdr[9] = 6; // RGBA
  ihdr[10] = ihdr[11] = ihdr[12] = 0;

  // Colors: center (#FED9B7 = 254,217,183) → edge (#F08FA0 = 240,143,160)
  const [r1,g1,b1] = [254, 217, 183];
  const [r2,g2,b2] = [240, 143, 160];
  const half = size / 2;
  const padding = maskable ? 0.15 : 0; // safe zone for maskable

  const rows = [];
  for (let y = 0; y < size; y++) {
    rows.push(0); // filter: none
    for (let x = 0; x < size; x++) {
      const nx = (x / size - 0.5) / (0.5 - padding);
      const ny = (y / size - 0.5) / (0.5 - padding);
      const dist = Math.min(1, Math.sqrt(nx * nx + ny * ny));
      const t = dist;
      const r = lerp(r1, r2, t);
      const g = lerp(g1, g2, t);
      const b = lerp(b1, b2, t);
      // Circular mask for non-maskable, full square for maskable
      const cx = x - half, cy = y - half;
      const outside = !maskable && (cx * cx + cy * cy > (half * 0.96) * (half * 0.96));
      rows.push(r, g, b, outside ? 0 : 255);
    }
  }

  const compressed = deflateSync(Buffer.from(rows), { level: 6 });
  return Buffer.concat([
    Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
    chunk('IHDR', ihdr),
    chunk('IDAT', compressed),
    chunk('IEND', Buffer.alloc(0)),
  ]);
}

mkdirSync('public/icons', { recursive: true });
writeFileSync('public/icons/icon-192.png', makePNG(192, false));
writeFileSync('public/icons/icon-512.png', makePNG(512, false));
writeFileSync('public/icons/icon-maskable.png', makePNG(512, true));
console.log('Icons generated: 192px, 512px, 512px maskable');
