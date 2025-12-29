import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import sharp from "sharp";
import pngToIco from "png-to-ico";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const repoRoot = path.resolve(__dirname, "..");
const publicDir = path.join(repoRoot, "public");

const faviconLightSvgPath = path.join(publicDir, "favicon-light.svg");

async function generateFaviconIco() {
  const svg = await readFile(faviconLightSvgPath);
  const sizes = [16, 32, 48, 64, 128, 256];

  const pngBuffers = await Promise.all(
    sizes.map((size) =>
      sharp(svg, { density: 256 })
        .resize(size, size, { fit: "contain" })
        .png()
        .toBuffer(),
    ),
  );

  const ico = await pngToIco(pngBuffers);
  await writeFile(path.join(publicDir, "favicon.ico"), ico);
}

function ogSvgMarkup() {
  const bg = "#052e16";
  const greenA = "#22c55e";
  const greenB = "#16a34a";
  const text = "#ecfdf5";

  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="630" viewBox="0 0 1200 630">
  <defs>
    <linearGradient id="g" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stop-color="${greenA}" />
      <stop offset="1" stop-color="${greenB}" />
    </linearGradient>
  </defs>
  <rect width="1200" height="630" rx="56" fill="${bg}" />
  <rect x="96" y="96" width="180" height="180" rx="48" fill="url(#g)" />
  <path d="M148 184v-18a38 38 0 0 1 76 0v18" fill="none" stroke="#001f17" stroke-width="14" stroke-linecap="round" />
  <rect x="136" y="184" width="104" height="92" rx="22" fill="#001f17" />
  <path d="M188 212a16 16 0 0 0-8 30v14h16v-14a16 16 0 0 0-8-30z" fill="#ecfdf5" />

  <text x="320" y="190" font-family="Inter, system-ui, -apple-system, Segoe UI, Roboto, Arial, sans-serif" font-size="76" font-weight="700" fill="${text}">SecureVault</text>
  <text x="320" y="258" font-family="Inter, system-ui, -apple-system, Segoe UI, Roboto, Arial, sans-serif" font-size="32" font-weight="500" fill="#a7f3d0">Secure password vault</text>

  <g opacity="0.25">
    <circle cx="1040" cy="120" r="44" fill="url(#g)" />
    <circle cx="1120" cy="520" r="70" fill="url(#g)" />
    <circle cx="960" cy="560" r="36" fill="url(#g)" />
  </g>
</svg>`;
}

async function generateOgPng() {
  const svg = ogSvgMarkup();
  const png = await sharp(Buffer.from(svg), { density: 192 }).png().toBuffer();
  await writeFile(path.join(publicDir, "og.png"), png);
}

async function generateAppleTouchIcon() {
  const svg = await readFile(faviconLightSvgPath);
  const png = await sharp(svg, { density: 256 }).resize(180, 180).png().toBuffer();
  await writeFile(path.join(publicDir, "apple-touch-icon.png"), png);
}

async function main() {
  await Promise.all([generateFaviconIco(), generateOgPng(), generateAppleTouchIcon()]);
}

await main();
