// Generates PWA icons (192 + 512) as PNG using only Node built-ins (zlib).
// Simple "Pelican Barcode" mark: dark navy field with a white Code-128-like bar block.
import { writeFileSync } from "node:fs";
import { deflateSync } from "node:zlib";

function crc32(buf) {
  let c = ~0;
  for (let i = 0; i < buf.length; i++) {
    c ^= buf[i];
    for (let k = 0; k < 8; k++) c = c & 1 ? (c >>> 1) ^ 0xedb88320 : c >>> 1;
  }
  return (~c) >>> 0;
}
function chunk(type, data) {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length, 0);
  const t = Buffer.from(type, "ascii");
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(Buffer.concat([t, data])), 0);
  return Buffer.concat([len, t, data, crc]);
}
function png(size, rgba) {
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(size, 0);
  ihdr.writeUInt32BE(size, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 6; // RGBA
  const raw = Buffer.alloc((size * 4 + 1) * size);
  for (let y = 0; y < size; y++) {
    raw[y * (size * 4 + 1)] = 0; // filter none
    rgba.copy(raw, y * (size * 4 + 1) + 1, y * size * 4, (y + 1) * size * 4);
  }
  const idat = deflateSync(raw);
  return Buffer.concat([
    Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
    chunk("IHDR", ihdr),
    chunk("IDAT", idat),
    chunk("IEND", Buffer.alloc(0)),
  ]);
}

function makeIcon(size) {
  const px = Buffer.alloc(size * size * 4);
  const bg = [7, 17, 31, 255];
  const fg = [247, 251, 255, 255];
  // deterministic pseudo-random bars for a barcode feel
  let seed = 1337;
  const rnd = () => ((seed = (seed * 1103515245 + 12345) & 0x7fffffff) / 0x7fffffff);
  const barW = Math.max(3, Math.round(size / 28));
  const gap = Math.max(2, Math.round(size / 60));
  const blockX = Math.round(size * 0.18);
  const blockW = size - blockX * 2;
  const blockY = Math.round(size * 0.34);
  const blockH = Math.round(size * 0.32);
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const i = (y * size + x) * 4;
      let col = bg;
      if (x >= blockX && x < blockX + blockW && y >= blockY && y < blockY + blockH) {
        const localX = Math.floor((x - blockX) / (barW + gap));
        const inBar = (x - blockX - localX * (barW + gap)) < barW;
        if (inBar && rnd() > 0.18) col = fg;
      }
      px[i] = col[0]; px[i + 1] = col[1]; px[i + 2] = col[2]; px[i + 3] = col[3];
    }
  }
  return png(size, px);
}

writeFileSync("client/public/icon-192.png", makeIcon(192));
writeFileSync("client/public/icon-512.png", makeIcon(512));
console.log("icons written");
