import { existsSync } from "node:fs";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { describe, expect, it } from "vitest";

const swPath = join(dirname(import.meta.dirname), "..", "public", "sw.js");
const publicDir = join(dirname(import.meta.dirname), "..", "public");

function extractUrls(varName: string): string[] {
  const src = readFileSync(swPath, "utf8");
  const match = src.match(new RegExp(`const ${varName} = \\[([^\\]]*)\\]`));
  expect(match, `${varName} array not found in sw.js`).toBeTruthy();
  return (match![1].match(/"([^"]+)"/g) ?? []).map((s) => s.slice(1, -1));
}

describe("offline precache integrity", () => {
  const urls = [...extractUrls("APP_SHELL"), ...extractUrls("HEAVY_ASSETS")];

  it("declares offline assets", () => {
    expect(urls.length).toBeGreaterThan(5);
  });

  it.each(urls)("exists on disk: %s", (url) => {
    if (url.startsWith("/assets/")) {
      return;
    }
    if (url === "/" || url === "/index.html") {
      expect(existsSync(join(dirname(import.meta.dirname), "..", "index.html"))).toBe(true);
      return;
    }
    expect(existsSync(join(publicDir, url)), `Missing offline asset: ${url}`).toBe(true);
  });

  it("covers the full OCR offline chain", () => {
    const required = [
      "/tessdata/eng.traineddata.gz",
      "/tesseract/worker.min.js",
      "/tesseract/tesseract-core-simd-lstm.wasm.js",
      "/tesseract/tesseract-core-simd-lstm.wasm",
      "/tesseract/tesseract-core-lstm.wasm.js",
      "/tesseract/tesseract-core-lstm.wasm",
    ];
    for (const r of required) {
      expect(urls).toContain(r);
    }
  });

  it("uses a versioned cache name", () => {
    const src = readFileSync(swPath, "utf8");
    expect(src).toMatch(/const CACHE = "pelican-barcode-v\d+"/);
  });
});
