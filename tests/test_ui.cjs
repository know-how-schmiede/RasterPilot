// Zustands-/Rennentests ohne Browser; die echte Darstellung separat prüfen.
const assert = require('node:assert/strict');
const { readFileSync } = require('node:fs');
const vm = require('node:vm');
const { test } = require('node:test');

function setup({ sourceWidth = 256, sourceHeight = 256,
  downloadName = 'motiv_rp_280_300ppi_0G.png' } = {}) {
  const controls = {};
  const defaults = { width: '28', ppi: '300', angle: '0',
    spacing: '1', coverage: '65', view: 'original', zoom: 'fit', background: 'textile', color: '#233246' };
  const names = [...Object.keys(defaults), 'message', 'dimensions', 'spacingInfo', 'canvas', 'stage',
    'download', 'result', 'renderState', 'resultOption', 'render', 'file', 'settings', 'viewSettings', 'empty', 'imageNotes'];
  for (const name of names) {
    const listeners = {};
    controls[name] = {
      value: defaults[name] || '', dataset: {}, style: {}, hidden: ['result', 'canvas', 'download'].includes(name),
      disabled: ['settings', 'viewSettings', 'zoom'].includes(name), textContent: '', files: [], attrs: {},
      addEventListener(event, callback) { listeners[event] = callback; },
      fire(event) { return listeners[event]({ target: this }); },
      setAttribute(key, value) { this.attrs[key] = value; },
      removeAttribute(key) { delete this[key]; },
      checkValidity() { return name !== 'angle' || (Number(this.value) >= -180 && Number(this.value) <= 180); },
      getContext() { return { drawImage: (...args) => { this.drawArgs = args; } }; },
      decode: async () => {}, classList: { toggle() {} }
    };
  }
  let pending;
  let submitted;
  const ctx = vm.createContext({
    document: { getElementById: id => controls[id] },
    URL: { createObjectURL: () => 'blob:test', revokeObjectURL() {} },
    AbortController, FormData,
    createImageBitmap: async () => ({ width: 256, height: 256, close() {} }),
    fetch: async (path, request) => {
      if (path.endsWith('render')) submitted = JSON.parse(request.body.get('parameters'));
      if (pending && path.endsWith('render')) return pending;
      return {
        ok: true, blob: async () => new Blob(['png']),
        headers: new Map([['X-Image-Width', String(sourceWidth)], ['X-Image-Height', String(sourceHeight)],
          ['X-Image-Notes', '[]'], ['X-Download-Name', encodeURIComponent(downloadName)]])
      };
    }
  });
  vm.runInContext(readFileSync('rasterpilot/static/app.js', 'utf8'), ctx);
  async function importImage() {
    controls.file.files = [new Blob(['original'], { type: 'image/png' })];
    await controls.file.fire('change');
  }
  return { c: controls, importImage, submitted: () => submitted, defer: promise => { pending = promise; } };
}

test('Import, Berechnung, Download und reine Ansichtsänderungen', async () => {
  const { c, importImage } = setup();
  await importImage();
  assert.equal(c.settings.disabled, false);
  assert.equal(c.viewSettings.disabled, false);
  assert.equal(c.canvas.hidden, false);
  assert.match(c.dimensions.textContent, /3307 × 3307 px/);
  assert.equal(c.stage.attrs['aria-busy'], 'false');
  await c.render.fire('click');
  assert.equal(c.download.hidden, false);
  assert.equal(c.download.download, 'motiv_rp_280_300ppi_0G.png');
  assert.equal(c.result.hidden, false);
  c.color.value = '#ff0000'; c.color.fire('input');
  assert.equal(c.download.hidden, false);
  c.view.value = 'original'; c.view.fire('input');
  assert.equal(c.canvas.hidden, false);
  assert.equal(c.result.hidden, true);
  c.coverage.value = '40'; c.coverage.fire('input');
  assert.equal(c.download.hidden, true);
  assert.equal(c.download.href, undefined);
});

test('Download übernimmt den Unicode-Dateinamen und Winkel aus der Serverantwort', async () => {
  const downloadName = 'Eichhörnchen.v2_rp_280_300ppi_-45G.png';
  const { c, importImage } = setup({ downloadName });
  await importImage();
  c.angle.value = '-45'; c.angle.fire('input');
  await c.render.fire('click');
  assert.equal(c.download.download, downloadName);
  assert.equal(c.download.hidden, false);
});

test('Verspätetes Ergebnis überschreibt keine neuen Einstellungen', async () => {
  const ui = setup();
  await ui.importImage();
  let resolve;
  ui.defer(new Promise(done => { resolve = done; }));
  const rendering = ui.c.render.fire('click');
  ui.c.coverage.value = '30'; ui.c.coverage.fire('input');
  resolve({ ok: true, blob: async () => new Blob(['old result']) });
  await rendering;
  assert.equal(ui.c.download.hidden, true);
  assert.equal(ui.c.result.hidden, true);
  assert.equal(ui.c.render.disabled, false);
});

test('Unzulässige Exportgröße sperrt Berechnung und erhält Originalvorschau', async () => {
  const { c, importImage } = setup();
  await importImage();
  c.width.value = '200'; c.width.fire('input');
  assert.match(c.message.textContent, /40 Megapixel/);
  assert.equal(c.render.disabled, true);
  assert.equal(c.canvas.hidden, false);
  assert.equal(c.download.hidden, true);
  c.width.value = '28'; c.width.fire('input');
  assert.equal(c.render.disabled, false);
  assert.equal(c.message.textContent, '');
});

test('Midjourney-Hochformat funktioniert nach Import ohne geänderte Druckvorgaben', async () => {
  const { c, importImage } = setup({ sourceWidth: 1904, sourceHeight: 2544 });
  await importImage();
  assert.equal(c.render.disabled, false);
  assert.equal(c.canvas.hidden, false);
  assert.equal(c.message.textContent, '');
  assert.match(c.dimensions.textContent, /3307 × 4419 px/);
  await c.render.fire('click');
  assert.equal(c.download.hidden, false);
});

test('Vollständiges Bild wird ohne Ausschnittparameter angezeigt und übermittelt', async () => {
  const { c, importImage, submitted } = setup({ sourceWidth: 1904, sourceHeight: 2544 });
  await importImage();
  assert.equal(c.canvas.width, 1197);
  assert.equal(c.canvas.height, 1600);
  assert.equal(c.canvas.drawArgs.length, 5);
  assert.deepEqual(c.canvas.drawArgs.slice(1), [0, 0, 1197, 1600]);
  await c.render.fire('click');
  assert.deepEqual(submitted(), { width_cm: 28, ppi: 300, spacing_mm: 1, coverage: 65, angle_deg: 0 });
  const html = readFileSync('rasterpilot/templates/index.html', 'utf8');
  assert.doesNotMatch(html, /Ausschnitt|id="(?:x|y|cropWidth|cropHeight|reset)"/);
  assert.match(html, /Originalbild/);
});

test('Rasterwinkel wird übermittelt und entwertet ein bestehendes Ergebnis', async () => {
  const { c, importImage, submitted } = setup();
  await importImage();
  await c.render.fire('click');
  c.angle.value = '45'; c.angle.fire('input');
  assert.equal(c.download.hidden, true);
  assert.equal(c.result.hidden, true);
  assert.match(c.spacingInfo.textContent, /Winkel 45°/);
  assert.match(c.dimensions.textContent, /3307 × 3307 px/);
  await c.render.fire('click');
  assert.equal(submitted().angle_deg, 45);
  assert.equal(c.download.hidden, false);
  c.angle.value = '181'; c.angle.fire('input');
  assert.equal(c.render.disabled, true);
  assert.equal(c.download.hidden, true);
});

test('Verspätetes Ergebnis überschreibt keinen neuen Rasterwinkel', async () => {
  const ui = setup();
  await ui.importImage();
  let resolve;
  ui.defer(new Promise(done => { resolve = done; }));
  const rendering = ui.c.render.fire('click');
  ui.c.angle.value = '-30'; ui.c.angle.fire('input');
  resolve({ ok: true, blob: async () => new Blob(['old result']) });
  await rendering;
  assert.equal(ui.c.download.hidden, true);
  assert.equal(ui.c.result.hidden, true);
  assert.equal(ui.c.render.disabled, false);
});

test('Fehlgeschlagener Neuimport gibt kein altes Ergebnis frei', async () => {
  const { c, importImage } = setup();
  await importImage();
  await c.render.fire('click');
  c.file.files = [{ size: 21 * 1024 * 1024 }];
  await c.file.fire('change');
  assert.equal(c.settings.disabled, true);
  assert.equal(c.viewSettings.disabled, true);
  assert.equal(c.download.hidden, true);
  assert.equal(c.result.hidden, true);
  assert.match(c.message.textContent, /20 MiB/);
});
