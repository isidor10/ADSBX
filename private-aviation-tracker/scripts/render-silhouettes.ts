/**
 * Renders every silhouette family to a PNG contact sheet so the shapes can be
 * eyeballed after a change. Uses the same canvas code the map uses, driven in
 * a real browser, so what you see here is exactly what lands on the map.
 *
 *   npm run silhouettes -- [outfile.png]
 */

import path from "node:path";
import { chromium } from "playwright";
import { buildSilhouette, FAMILIES, type FamilyKey } from "../src/lib/aircraft/silhouettes";

const OUT = process.argv[2] ?? "/tmp/silhouettes.png";
const CELL = 150;
const COLUMNS = 6;

async function main() {
  const families = Object.keys(FAMILIES) as FamilyKey[];
  const geometry = Object.fromEntries(
    families.map((f) => [f, buildSilhouette(FAMILIES[f])]),
  );

  const rows = Math.ceil(families.length / COLUMNS);
  const html = `<!doctype html><html><body style="margin:0;background:#04060c">
<canvas id="c" width="${COLUMNS * CELL}" height="${rows * CELL}"></canvas>
<script>
const FAMILIES = ${JSON.stringify(families)};
const GEOM = ${JSON.stringify(geometry)};
const CELL = ${CELL}, COLUMNS = ${COLUMNS};
const ctx = document.getElementById("c").getContext("2d");
ctx.fillStyle = "#04060c";
ctx.fillRect(0, 0, COLUMNS * CELL, ${rows} * CELL);

function draw(g, color, size, ox, oy) {
  const P = (pts, close) => {
    ctx.beginPath();
    pts.forEach(([x, y], i) => {
      const px = ox + x * size, py = oy + y * size;
      i === 0 ? ctx.moveTo(px, py) : ctx.lineTo(px, py);
    });
    ctx.closePath();
  };
  ctx.lineJoin = "round"; ctx.lineCap = "round";
  ctx.strokeStyle = "rgba(3,6,14,0.92)";
  ctx.lineWidth = Math.max(2, size * 0.045);
  for (const poly of g.polygons) { P(poly); ctx.stroke(); }
  for (const d of g.discs) {
    ctx.beginPath(); ctx.arc(ox + d.x*size, oy + d.y*size, d.radius*size, 0, 6.284); ctx.stroke();
  }
  ctx.fillStyle = color; ctx.globalAlpha = 0.28;
  for (const d of g.discs) {
    ctx.beginPath(); ctx.arc(ox + d.x*size, oy + d.y*size, d.radius*size, 0, 6.284); ctx.fill();
  }
  ctx.globalAlpha = 1;
  for (const poly of g.polygons) { P(poly); ctx.fill(); }
}

FAMILIES.forEach((family, i) => {
  const col = i % COLUMNS, row = Math.floor(i / COLUMNS);
  const ox = col * CELL, oy = row * CELL;
  draw(GEOM[family], "#22d3ee", CELL - 30, ox + 15, oy + 8);
  ctx.fillStyle = "#8fa3bf";
  ctx.font = "11px monospace";
  ctx.textAlign = "center";
  ctx.fillText(family, ox + CELL / 2, oy + CELL - 6);
});
</script></body></html>`;

  const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH ?? "/opt/pw-browsers/chromium-1194/chrome-linux/chrome" });
  const page = await browser.newPage({ viewport: { width: COLUMNS * CELL, height: rows * CELL } });
  await page.setContent(html);
  await page.locator("#c").screenshot({ path: OUT });
  await browser.close();
  console.log(`${families.length} families -> ${path.resolve(OUT)}`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
