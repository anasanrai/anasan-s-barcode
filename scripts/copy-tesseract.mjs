import { cpSync, mkdirSync, existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const dest = join(root, "client", "public", "tesseract");

mkdirSync(dest, { recursive: true });

const workerSrc = join(dirname(require.resolve("tesseract.js/package.json")), "dist", "worker.min.js");
cpSync(workerSrc, join(dest, "worker.min.js"));

const tesseractRequire = createRequire(require.resolve("tesseract.js/package.json"));
const coreDir = dirname(tesseractRequire.resolve("tesseract.js-core/package.json"));
for (const file of [
  "tesseract-core-simd-lstm.wasm.js",
  "tesseract-core-simd-lstm.wasm",
  "tesseract-core-lstm.wasm.js",
  "tesseract-core-lstm.wasm",
]) {
  const src = join(coreDir, file);
  if (existsSync(src)) {
    cpSync(src, join(dest, file));
  }
}

console.log("[copy-tesseract] Self-hosted OCR assets copied to client/public/tesseract");
