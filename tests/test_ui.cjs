// Zustands-/Rennentests ohne Browser; die echte Darstellung separat prüfen.
const assert = require('node:assert/strict');
const { readFileSync } = require('node:fs');
const vm = require('node:vm');
const { test } = require('node:test');

function setup() {
  const controls = {};
  const defaults = { width: '28', ppi: '300', x: '0', y: '0', cropWidth: '', cropHeight: '',
    spacing: '1', coverage: '65', view: 'original', zoom: 'fit', background: 'textile', color: '#233246' };
  const names = [...Object.keys(defaults), 'message', 'dimensions', 'spacingInfo', 'canvas', 'stage',
    'download', 'result', 'renderState', 'resultOption', 'render', 'file', 'settings', 'empty', 'imageNotes', 'reset'];
  for (const name of names) {
    const listeners = {};
    controls[name] = {
      value: defaults[name] || '', dataset: {}, style: {}, hidden: ['result', 'canvas', 'download'].includes(name),
      disabled: ['settings', 'zoom'].includes(name), textContent: '', files: [], attrs: {},
      addEventListener(event, callback) { listeners[event] = callback; },
      fire(event) { return listeners[event]({ target: this }); },
      setAttribute(key, value) { this.attrs[key] = value; },
      removeAttribute(key) { delete this[key]; },
      checkValidity() { return true; },
      getContext() { return { drawImage() {} }; },
      decode: async () => {}, classList: { toggle() {} }
    };
  }
  let pending;
  const ctx = vm.createContext({
    document: { getElementById: id => controls[id] },
    URL: { createObjectURL: () => 'blob:test', revokeObjectURL() {} },
    AbortController, FormData,
    createImageBitmap: async () => ({ width: 256, height: 256, close() {} }),
    fetch: async path => {
      if (pending && path.endsWith('render')) return pending;
      return {
        ok: true, blob: async () => new Blob(['png']),
        headers: new Map([['X-Image-Width', '256'], ['X-Image-Height', '256'], ['X-Image-Notes', '[]']])
      };
    }
  });
  vm.runInContext(readFileSync('rasterpilot/static/app.js', 'utf8'), ctx);
  async function importImage() {
    controls.file.files = [new Blob(['original'], { type: 'image/png' })];
    await controls.file.fire('change');
  }
  return { c: controls, importImage, defer: promise => { pending = promise; } };
}

test('Import, Berechnung, Download und reine Ansichtsänderungen', async () => {
  const { c, importImage } = setup();
  await importImage();
  assert.equal(c.settings.disabled, false);
  assert.equal(c.canvas.hidden, false);
  assert.match(c.dimensions.textContent, /3307 × 3307 px/);
  assert.equal(c.stage.attrs['aria-busy'], 'false');
  await c.render.fire('click');
  assert.equal(c.download.hidden, false);
  assert.equal(c.download.download, 'motiv_rasterpilot_280mm_300ppi.png');
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

test('Unzulässige Größe blendet Vorschau aus und sperrt Berechnung', async () => {
  const { c, importImage } = setup();
  await importImage();
  c.width.value = '200'; c.width.fire('input');
  assert.match(c.message.textContent, /12 Megapixel/);
  assert.equal(c.render.disabled, true);
  assert.equal(c.canvas.hidden, true);
});

test('Fehlgeschlagener Neuimport gibt kein altes Ergebnis frei', async () => {
  const { c, importImage } = setup();
  await importImage();
  await c.render.fire('click');
  c.file.files = [{ size: 21 * 1024 * 1024 }];
  await c.file.fire('change');
  assert.equal(c.settings.disabled, true);
  assert.equal(c.download.hidden, true);
  assert.equal(c.result.hidden, true);
  assert.match(c.message.textContent, /20 MiB/);
});
