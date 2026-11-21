const assert = require('node:assert/strict');
const { readFileSync } = require('node:fs');
const vm = require('node:vm');
const { test } = require('node:test');
const context = vm.createContext({});
vm.runInContext(readFileSync('rasterpilot/static/tone-overlay.js', 'utf8'), context);
const overlay = context.RasterPilotToneOverlay;

test('Grenzen, kräftige Farben und Alpha ordnen Grün, Rot und Gelb zu', () => {
  const source = new Uint8ClampedArray([
    20, 20, 20, 255, // Schwarzpunkt -> Rot
    100, 100, 100, 255, // Zwischenstufe -> Gelb
    200, 200, 200, 255, // Weißpunkt -> Grün
    0, 0, 255, 255, // Kräftiges Blau -> Grün
    255, 255, 255, 128, // Teiltransparenz -> Gelb
    20, 20, 20, 128, // Entfernt trotz Teiltransparenz -> Rot
    255, 0, 0, 0 // Volltransparenz bleibt unverändert
  ]);
  const original = source.slice(), output = new Uint8ClampedArray(source.length);
  const cache = overlay.prepare(source);
  assert.equal(overlay.tint(cache, output, 20, 200), true);
  assert.deepEqual(Array.from(output), [
    108, 39, 39, 255, 160, 142, 68, 255, 134, 199, 158, 255,
    14, 79, 191, 255, 253, 235, 161, 128, 108, 39, 39, 128, 255, 0, 0, 0
  ]);
  assert.deepEqual(source, original);
  overlay.tint(cache, output, 110, 230);
  assert.deepEqual(source, original);
});

test('Ungültige Tonwerte erzeugen keine Markierung; gültige Extreme funktionieren', () => {
  const cache = overlay.prepare(new Uint8ClampedArray([0, 0, 0, 255, 255, 255, 255, 255]));
  for (const [black, white] of [[20, 20], [30, 20], [-1, 255], [0, 256], [NaN, 255], [0, 2.5], [true, 255]]) {
    const output = new Uint8ClampedArray(8).fill(99);
    assert.equal(overlay.tint(cache, output, black, white), false);
    assert.deepEqual(Array.from(output), Array(8).fill(99));
  }
  const output = new Uint8ClampedArray(8);
  assert.equal(overlay.tint(cache, output, 0, 255), true);
  assert.deepEqual(Array.from(output), [96, 27, 27, 255, 167, 232, 191, 255]);
});
