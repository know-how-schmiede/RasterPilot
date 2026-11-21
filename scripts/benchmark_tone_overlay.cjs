// Reine Pixelberechnung, ohne Browser/Canvas: node scripts/benchmark_tone_overlay.cjs
const { readFileSync } = require('node:fs');
const { performance } = require('node:perf_hooks');
const vm = require('node:vm');
vm.runInThisContext(readFileSync('rasterpilot/static/tone-overlay.js', 'utf8'));
const overlay = globalThis.RasterPilotToneOverlay;
const side = 1600, source = new Uint8ClampedArray(side * side * 4);
for (let p = 0, i = 0; i < source.length; p++, i += 4) {
  source[i] = p % 256; source[i + 1] = (p >> 3) % 256; source[i + 2] = (p >> 8) % 256;
  source[i + 3] = p % 17 === 0 ? 0 : p % 7 === 0 ? 128 : 255;
}
const started = performance.now(), cache = overlay.prepare(source);
const preparation = performance.now() - started, output = new Uint8ClampedArray(source.length);
const times = [];
for (let frame = 0; frame < 25; frame++) {
  const start = performance.now();
  overlay.tint(cache, output, frame % 20, 245 - frame % 20);
  if (frame >= 5) times.push(performance.now() - start);
}
times.sort((a, b) => a - b);
const rounded = value => Number(value.toFixed(2));
process.stdout.write(JSON.stringify({ node: process.version, platform: process.platform, size: [side, side],
  measured_frames: times.length, prepare_ms: rounded(preparation),
  median_tint_ms: rounded((times[9] + times[10]) / 2), maximum_tint_ms: rounded(times.at(-1)),
  note: 'Pixelberechnung ohne Canvas-Ausgabe, Browserereignisse oder Tablet-Messung.' }) + '\n');
