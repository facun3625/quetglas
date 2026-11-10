// Hoja de contactos para revisar varias capturas juntas: node docs/manual/hoja.cjs salida.png id1 id2 ...
const sharp = require("sharp");
(async () => {
  const [out, ...ids] = process.argv.slice(2);
  const W = 700;
  const tiles = [];
  for (const id of ids) {
    const buf = await sharp(`${__dirname}/shots/${id}.webp`).resize({ width: W }).png().toBuffer();
    const m = await sharp(buf).metadata();
    tiles.push({ buf, h: m.height });
  }
  const cols = 2, gap = 12;
  const rows = [];
  for (let i = 0; i < tiles.length; i += cols) rows.push(tiles.slice(i, i + cols));
  const heights = rows.map((r) => Math.max(...r.map((t) => t.h)));
  const total = heights.reduce((a, b) => a + b + gap, gap);
  const comps = [];
  let y = gap;
  rows.forEach((r, ri) => { r.forEach((t, ci) => comps.push({ input: t.buf, left: gap + ci * (W + gap), top: y })); y += heights[ri] + gap; });
  await sharp({ create: { width: cols * W + (cols + 1) * gap, height: total, channels: 3, background: "#cccccc" } }).composite(comps).png().toFile(out);
  console.log("hoja lista", out);
})();
