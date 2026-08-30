/**
 * Inject the list of built hashed assets into the service worker so it can
 * precache them for offline use.
 */
import fs from "node:fs";
import path from "node:path";

const distDir = path.resolve(import.meta.dirname, "..", "dist", "public");
const swPath = path.join(distDir, "sw.js");
const assetsDir = path.join(distDir, "assets");

function collectFiles(dir, base) {
  const files = [];
  if (!fs.existsSync(dir)) return files;
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (entry.isDirectory()) {
      files.push(...collectFiles(path.join(dir, entry.name), `${base}/${entry.name}`));
    } else {
      files.push(`${base}/${entry.name}`);
    }
  }
  return files;
}

const assets = collectFiles(assetsDir, "/assets");

if (fs.existsSync(swPath)) {
  let sw = fs.readFileSync(swPath, "utf8");
  sw = sw.replace(
    /const PRECACHE_ASSETS = self\.__PRECACHE_ASSETS \|\| \[\];/,
    `const PRECACHE_ASSETS = ${JSON.stringify(assets)};`
  );
  fs.writeFileSync(swPath, sw);
  console.log(`[inject-precache] Precaching ${assets.length} assets`);
} else {
  console.warn("[inject-precache] sw.js not found at", swPath);
}
