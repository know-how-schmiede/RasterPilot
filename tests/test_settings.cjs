const assert = require('node:assert/strict');
const { readFileSync } = require('node:fs');
const vm = require('node:vm');
const { test } = require('node:test');
const ctx = vm.createContext({});
vm.runInContext(readFileSync('rasterpilot/static/settings.js', 'utf8'), ctx);
const settings = ctx.RasterPilotSettings;
const example = () => ({ format: 'RasterPilot', version: 3,
  settings: { ...settings.defaults }, view: { ...settings.viewDefaults } });

test('JSON-Rundlauf erhält alle Druck-, Raster- und Ansichtswerte ohne Bilder', () => {
  const data = example();
  Object.assign(data.settings, { mode: 'luminance', ink_color: '#ffeedd', invert: true,
    angle_deg: -45, black_point: 10, white_point: 240, gamma: 1.5 });
  data.view.background = 'checker';
  data.view.zoom = 'actual';
  const json = settings.serialize(data.settings, data.view);
  assert.deepEqual(JSON.parse(JSON.stringify(settings.parse(json))), data);
  assert.doesNotMatch(json, /data:|filename|owner|image|job_id/);
});

test('Beschädigte, unbekannte oder unvollständige Formate werden verworfen', () => {
  for (const data of [null, [], {}, { ...example(), version: 4 }, { ...example(), settings: {} },
    { ...example(), view: { ...settings.viewDefaults, filename: 'x' } }]) {
    assert.throws(() => settings.validate(data));
  }
  assert.throws(() => settings.parse('not JSON'));
});

test('Wertebereiche, Typen, Tonwerte und Abtastgrenze werden vor Anwendung geprüft', () => {
  for (const change of [{ width_cm: '28' }, { ppi: 100.5 }, { ppi: true }, { angle_deg: Infinity },
    { mode: 'broken' }, { ink_color: 'red' }, { invert: 'false' }, { gamma: 0 },
    { black_point: 200, white_point: 100 }, { black_point: 0.5 }, { coverage: 101 },
    { ppi: 36, spacing_mm: .1 }, { width_cm: 28.05 }, { angle_deg: 12.5 }, { gamma: 1.25 }]) {
    const data = example();
    Object.assign(data.settings, change);
    assert.throws(() => settings.validate(data));
  }
  for (const change of [{ background: 'image' }, { color: 'red' }, { zoom: '500%' }]) {
    const data = example();
    Object.assign(data.view, change);
    assert.throws(() => settings.validate(data));
  }
});

test('Schwarz-Shirt-Rundlauf und Altimport erhalten Tonwerte und neutralisieren frühere Zusatzwerte', () => {
  const data = example();
  Object.assign(data.settings, { mode: 'affinity', spacing_mm: 1.471, white_point: 184,
    mask_contrast: 85, levels_blend: 'vivid_light', bw_red: 150, bw_cyan: 40 });
  const expected = { ...data, settings: { ...data.settings, ...settings.affinityDefaults } };
  assert.deepEqual(JSON.parse(settings.serialize(data.settings, data.view)), expected);
  data.version = 2;
  data.settings.invert = true;
  data.settings.gamma = 2;
  assert.deepEqual(JSON.parse(JSON.stringify(settings.validate(data))), expected);
  const legacy = example();
  legacy.version = 1;
  for (const key of Object.keys(legacy.settings)) {
    if (key.startsWith('bw_') || ['mask_contrast', 'levels_blend'].includes(key)) delete legacy.settings[key];
  }
  assert.deepEqual(JSON.parse(JSON.stringify(settings.validate(legacy))), example());
  assert.equal(legacy.version, 1);
  legacy.settings.mode = 'affinity';
  assert.throws(() => settings.validate(legacy));
  for (const change of [{ bw_red: -1 }, { bw_cyan: 201 }, { bw_blue: 100.5 },
    { mask_contrast: 101 }, { mask_contrast: true }, { levels_blend: 'other' }, { spacing_mm: 1.0001 }]) {
    assert.throws(() => settings.validate({ ...data, settings: { ...data.settings, ...change } }));
  }
});

test('Version-2-Dateien der bisherigen Modi behalten ihre Ausgabeparameter', () => {
  for (const mode of ['color', 'luminance', 'alpha']) {
    const data = example();
    data.version = 2;
    Object.assign(data.settings, { mode, gamma: 2, invert: true, black_point: 10, white_point: 230 });
    const migrated = JSON.parse(JSON.stringify(settings.validate(data)));
    assert.deepEqual(migrated, { ...data, version: 3 });
  }
});
