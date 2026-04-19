// Rasterize public/icon.svg into public/icon-512.png + public/icon-192.png
// + public/apple-icon.png. Run with: node scripts/build-icon.mjs
//
// Uses sharp, already pulled in by Next.js for image optimization.

import { readFile, writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import path from "node:path";
import sharp from "sharp";

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, "..");
const svgPath = path.join(root, "public", "icon.svg");

async function rasterize(size, outName) {
  const svg = await readFile(svgPath);
  const png = await sharp(svg).resize(size, size).png().toBuffer();
  const outPath = path.join(root, "public", outName);
  await writeFile(outPath, png);
  console.log(`wrote ${outName} (${size}x${size}, ${png.byteLength} bytes)`);
}

await rasterize(512, "icon-512.png");
await rasterize(192, "icon-192.png");
await rasterize(180, "apple-icon.png");

// Next.js App Router auto-discovers app/icon.png as the favicon — render
// a 32x32 there too so the browser tab matches the brand mark.
const svg = await readFile(svgPath);
const favicon = await sharp(svg).resize(32, 32).png().toBuffer();
const appIconPath = path.join(root, "app", "icon.png");
await writeFile(appIconPath, favicon);
console.log(`wrote app/icon.png (32x32, ${favicon.byteLength} bytes)`);
