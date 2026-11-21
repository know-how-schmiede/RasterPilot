// Zustands-/Rennentests ohne Browser; die echte Darstellung separat prüfen.
const assert = require('node:assert/strict');
const { readFileSync } = require('node:fs');
const vm = require('node:vm');
const { test } = require('node:test');

async function waitForSubmission(ui) {
  for (let count = 0; count < 50 && !ui.calls.some(([path]) => path === '/api/jobs'); count++) {
    await new Promise(setImmediate);
  }
  assert.ok(ui.calls.some(([path]) => path === '/api/jobs'));
}

function setup({ sourceWidth = 256, sourceHeight = 256,
  downloadName = 'motiv_rp_280_300ppi_0G.png', states = ['done'], queueError = null, previewPixels = null } = {}) {
  const controls = {};
  const defaults = { width: '28', ppi: '300', angle: '0', mode: 'color', ink: '#000000',
    black: '0', white: '255', gamma: '1',
    spacing: '1', coverage: '65', view: 'original', zoom: 'fit', background: 'textile', color: '#233246' };
  const names = [...Object.keys(defaults), 'message', 'dimensions', 'spacingInfo', 'canvas', 'stage',
    'download', 'result', 'renderState', 'resultOption', 'originalOption', 'render', 'file', 'settings', 'viewSettings', 'empty', 'imageNotes',
    'invert', 'modeInfo', 'coverageControls', 'luminanceControls', 'resetTones', 'cancel',
    'saveSettings', 'loadSettings', 'presetDownload', 'inkControl', 'gammaControl', 'invertControl', 'affinityControls',
    'tone_overlay', 'overlayControls', 'overlayLegend', 'overlayCaption', 'overlayInfo'];
  for (const name of names) {
    const listeners = {};
    controls[name] = {
      value: defaults[name] || '', dataset: {}, style: {}, hidden: ['result', 'canvas', 'download'].includes(name),
      disabled: ['settings', 'viewSettings', 'zoom'].includes(name), checked: false, textContent: '', files: [], attrs: {},
      addEventListener(event, callback) { listeners[event] = callback; },
      fire(event) { return listeners[event]({ target: this }); },
      click() { this.clicked = true; },
      setAttribute(key, value) { this.attrs[key] = value; },
      removeAttribute(key) { delete this[key]; },
      checkValidity() { return name !== 'angle' || (Number(this.value) >= -180 && Number(this.value) <= 180); },
      getContext() { return {
        drawImage: (...args) => { this.drawArgs = args; },
        getImageData: (x, y, width, height) => {
          this.reads = (this.reads || 0) + 1;
          return { data: previewPixels ? new Uint8ClampedArray(previewPixels) : new Uint8ClampedArray(width * height * 4) };
        },
        createImageData: (width, height) => ({ data: new Uint8ClampedArray(width * height * 4) }),
        putImageData: data => { this.painted = new Uint8ClampedArray(data.data); }
      }; },
      decode: async () => {}, classList: { toggle() {} }
    };
  }
  let pending;
  let submitted;
  const calls = [];
  const downloads = [];
  let queueCallbacks;
  const frames = [];
  const ctx = vm.createContext({
    RasterPilotJobs: { refresh: async () => {}, start: callbacks => { queueCallbacks = callbacks; } },
    document: { getElementById: id => controls[id] },
    URL: { createObjectURL: blob => { downloads.push(blob); return 'blob:test'; }, revokeObjectURL() {} },
    AbortController, FormData, Blob, setTimeout: (fn, delay) => setTimeout(fn, Math.min(delay, 10)), clearTimeout,
    requestAnimationFrame: callback => { frames.push(callback); return frames.length; },
    createImageBitmap: async () => ({ width: 256, height: 256, close() {} }),
    fetch: async (path, request) => {
      calls.push([path, request.method]);
      if (path === '/api/jobs') {
        submitted = JSON.parse(request.body.get('parameters'));
        if (queueError) return { ok: false, status: 503, json: async () => ({ error: queueError }) };
        if (pending) return pending;
        return { ok: true, json: async () => ({ id: 'job1', state: 'queued' }) };
      }
      if (path === '/api/jobs/job1') return { ok: true, json: async () => ({ state:
        request.method === 'DELETE' ? 'cancelled' : states.length > 1 ? states.shift() : states[0] }) };
      return {
        ok: true, blob: async () => new Blob(['png']),
        headers: new Map([['X-Image-Width', String(sourceWidth)], ['X-Image-Height', String(sourceHeight)],
          ['X-Image-Notes', '[]'], ['X-Download-Name', encodeURIComponent(downloadName)]])
      };
    }
  });
  vm.runInContext(readFileSync('rasterpilot/static/settings.js', 'utf8'), ctx);
  vm.runInContext(readFileSync('rasterpilot/static/tone-overlay.js', 'utf8'), ctx);
  vm.runInContext(readFileSync('rasterpilot/static/app.js', 'utf8'), ctx);
  async function importImage(name = 'original.png') {
    const file = new Blob(['original'], { type: 'image/png' }); file.name = name;
    controls.file.files = [file];
    await controls.file.fire('change');
  }
  return { c: controls, importImage, calls, downloads, ctx, queueCallbacks: () => queueCallbacks,
    flushFrames: () => { while (frames.length) frames.shift()(); }, frames,
    submitted: () => submitted, defer: promise => { pending = promise; } };
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
  await waitForSubmission(ui);
  ui.c.coverage.value = '30'; ui.c.coverage.fire('input');
  resolve({ ok: true, json: async () => ({ id: 'job1', state: 'queued' }) });
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
  assert.deepEqual(submitted(), { width_cm: 28, ppi: 300, spacing_mm: 1, coverage: 65, angle_deg: 0, mode: 'color' });
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
  await waitForSubmission(ui);
  ui.c.angle.value = '-30'; ui.c.angle.fire('input');
  resolve({ ok: true, json: async () => ({ id: 'job1', state: 'queued' }) });
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

test('Rastermodus zeigt passende Felder und übermittelt Helligkeitseinstellungen', async () => {
  const { c, importImage, submitted } = setup();
  await importImage();
  assert.equal(c.luminanceControls.hidden, true);
  assert.equal(c.ink.disabled, true);
  await c.render.fire('click');
  c.mode.value = 'luminance'; c.mode.fire('input');
  assert.equal(c.download.hidden, true);
  assert.equal(c.coverageControls.hidden, true);
  assert.equal(c.coverage.disabled, true);
  assert.equal(c.luminanceControls.hidden, false);
  assert.equal(c.ink.disabled, false);
  c.ink.value = '#aabbcc'; c.ink.fire('input');
  c.invert.checked = true; c.invert.fire('input');
  c.black.value = '20'; c.black.fire('input');
  c.white.value = '220'; c.white.fire('input');
  c.gamma.value = '1.5'; c.gamma.fire('input');
  await c.render.fire('click');
  assert.deepEqual(submitted(), { width_cm: 28, ppi: 300, spacing_mm: 1, coverage: 100, angle_deg: 0,
    mode: 'luminance', ink_color: '#aabbcc', invert: true, black_point: 20, white_point: 220, gamma: 1.5 });
  c.color.value = '#00ff00'; c.color.fire('input');
  assert.equal(c.download.hidden, false);
  c.gamma.value = '2'; c.gamma.fire('input');
  assert.equal(c.download.hidden, true);
});

test('Ungültige Tonwerte sperren Berechnung; Zurücksetzen und Moduswechsel stellen sie wieder her', async () => {
  const { c, importImage, submitted } = setup();
  await importImage();
  c.mode.value = 'luminance'; c.mode.fire('input');
  c.black.value = '200'; c.black.fire('input');
  c.white.value = '100'; c.white.fire('input');
  assert.equal(c.render.disabled, true);
  assert.match(c.message.textContent, /Schwarzpunkt/);
  c.resetTones.fire('click');
  assert.equal(c.black.value, '0');
  assert.equal(c.white.value, '255');
  assert.equal(c.gamma.value, '1');
  assert.equal(c.render.disabled, false);
  c.black.value = ''; c.black.fire('input');
  assert.equal(c.render.disabled, true);
  c.mode.value = 'alpha'; c.mode.fire('input');
  assert.equal(c.render.disabled, false);
  assert.equal(c.ink.disabled, true);
  assert.equal(c.luminanceControls.hidden, true);
  assert.match(c.modeInfo.textContent, /ohne Transparenz/);
  await c.render.fire('click');
  assert.equal(submitted().mode, 'alpha');
  assert.equal(submitted().coverage, 100);
  assert.equal(submitted().black_point, undefined);
  c.mode.value = 'color'; c.mode.fire('input');
  assert.equal(c.coverage.value, '65');
  assert.equal(c.coverage.disabled, false);
  assert.equal(c.download.hidden, true);
});

test('Verspätetes Ergebnis überschreibt keinen neuen Modus', async () => {
  const ui = setup();
  await ui.importImage();
  let resolve;
  ui.defer(new Promise(done => { resolve = done; }));
  const rendering = ui.c.render.fire('click');
  await waitForSubmission(ui);
  ui.c.mode.value = 'alpha'; ui.c.mode.fire('input');
  resolve({ ok: true, json: async () => ({ id: 'job1', state: 'queued' }) });
  await rendering;
  assert.equal(ui.c.download.hidden, true);
  assert.equal(ui.c.result.hidden, true);
  assert.equal(ui.calls.some(([path, method]) => path === '/api/jobs/job1' && method === 'DELETE'), false);
});

test('Einstellungen lassen sich ohne Bild speichern und nach Import vollständig anwenden', async () => {
  const ui = setup();
  ui.c.saveSettings.fire('click');
  assert.equal(ui.c.presetDownload.clicked, true);
  assert.equal(ui.c.presetDownload.download, 'rasterpilot_einstellungen.json');
  const data = JSON.parse(ui.ctx.RasterPilotSettings.serialize(
    { ...ui.ctx.RasterPilotSettings.defaults, mode: 'luminance', ink_color: '#aabbcc', invert: true,
      black_point: 10, white_point: 240, gamma: 2, width_cm: 20, coverage: 40 },
    { background: 'checker', color: '#ff0000', zoom: 'actual', tone_overlay: false }));
  ui.c.loadSettings.files = [new Blob([JSON.stringify(data)])];
  await ui.c.loadSettings.fire('change');
  assert.equal(ui.c.mode.value, 'luminance');
  assert.equal(ui.c.ink.value, '#aabbcc');
  assert.equal(ui.c.invert.checked, true);
  assert.equal(ui.c.width.value, '20');
  assert.equal(ui.c.background.value, 'checker');
  assert.equal(ui.c.zoom.value, 'actual');
  assert.equal(ui.c.settings.disabled, true);
  await ui.importImage();
  await ui.c.render.fire('click');
  assert.equal(ui.submitted().gamma, 2);
  assert.equal(ui.submitted().width_cm, 20);
});

test('Ungültiger Einstellungsimport verändert weder Werte noch vorhandenes Ergebnis', async () => {
  const { c, importImage } = setup();
  await importImage();
  await c.render.fire('click');
  for (const file of [new Blob(['broken json']), new Blob([JSON.stringify({ version: 99 })]), { size: 65537 }]) {
    c.loadSettings.files = [file];
    await c.loadSettings.fire('change');
    assert.match(c.message.textContent, /nicht geladen/);
    assert.equal(c.width.value, '28');
    assert.equal(c.download.hidden, false);
  }
});

test('Statusabfrage wartet bis fertig und lädt erst dann das PNG', async () => {
  const ui = setup({ states: ['queued', 'running', 'done'] });
  await ui.importImage();
  await ui.c.render.fire('click');
  assert.equal(ui.calls.filter(([path, method]) => path === '/api/jobs/job1' && method === 'GET').length, 3);
  assert.ok(ui.calls.some(([path, method]) => path === '/api/jobs/job1/result' && method === 'GET'));
  assert.equal(ui.c.download.hidden, false);
  assert.equal(ui.c.cancel.hidden, true);
});

test('Abbrechen beendet Statusabfrage und löscht den eigenen Auftrag', async () => {
  const ui = setup({ states: ['queued'] });
  await ui.importImage();
  const rendering = ui.c.render.fire('click');
  while (!ui.c.message.textContent.includes('Warteschlange')) await new Promise(setImmediate);
  ui.c.cancel.fire('click');
  await rendering;
  assert.ok(ui.calls.some(([path, method]) => path === '/api/jobs/job1' && method === 'DELETE'));
  assert.equal(ui.c.download.hidden, true);
  assert.equal(ui.c.render.disabled, false);
  assert.equal(ui.c.stage.attrs['aria-busy'], 'false');
  assert.equal(ui.c.cancel.hidden, true);
});

test('Fehlender Worker und fehlgeschlagene Aufträge geben keinen Download frei', async () => {
  for (const config of [{ queueError: 'Hintergrunddienst fehlt' }, { states: ['failed'] }]) {
    const ui = setup(config);
    await ui.importImage();
    await ui.c.render.fire('click');
    assert.equal(ui.c.download.hidden, true);
    assert.equal(ui.c.render.disabled, false);
    assert.equal(ui.c.cancel.hidden, true);
    assert.ok(ui.c.message.textContent);
  }
});

test('Schwarz-Shirt-Modus bietet nur zwei Tonwerte und Vorschau auf Schwarz', async () => {
  const { c, importImage, submitted } = setup({ sourceWidth: 1904, sourceHeight: 2544 });
  await importImage();
  c.mode.value = 'affinity'; c.mode.fire('input');
  assert.equal(c.affinityControls.hidden, false);
  assert.equal(c.luminanceControls.hidden, false);
  assert.equal(c.ink.disabled, true);
  assert.equal(c.coverage.disabled, true);
  assert.equal(c.white.disabled, false);
  assert.equal(c.gammaControl.hidden, true);
  assert.equal(c.invertControl.hidden, true);
  assert.equal(c.invert.disabled, true);
  assert.equal(c.white.value, '245');
  assert.equal(c.color.value, '#000000');
  await c.render.fire('click');
  assert.equal(submitted().white_point, 245);
  assert.equal(submitted().invert, false);
  assert.equal(c.download.hidden, false);
  c.white.value = '200'; c.white.fire('input');
  assert.equal(c.download.hidden, true);
  await c.render.fire('click');
  assert.equal(submitted().white_point, 200);
  c.color.value = '#00ff00'; c.color.fire('input');
  assert.equal(c.download.hidden, false);
  c.mode.value = 'color'; c.mode.fire('input');
  assert.equal(c.affinityControls.hidden, true);
  const html = readFileSync('rasterpilot/templates/index.html', 'utf8');
  assert.doesNotMatch(html, /id="(?:affinityPreset|bwRed|bwYellow|bwGreen|bwCyan|bwBlue|bwMagenta|maskContrast|levelsBlend)"/);
  assert.match(html, /Schwarz durch Shirt ersetzen/);
});

test('Alter Affinity-Import meldet neue Berechnung und erhält Tonwerte, Geometrie und Ansicht', async () => {
  const ui = setup();
  await ui.importImage();
  const data = { format: 'RasterPilot', version: 2,
    settings: { ...ui.ctx.RasterPilotSettings.defaults, mode: 'affinity', levels_blend: 'vivid_light',
      spacing_mm: 1.471, mask_contrast: 42, bw_blue: 150, gamma: 2, black_point: 10, white_point: 200, invert: true },
    view: { background: 'checker', color: '#123456', zoom: 'actual' } };
  ui.c.loadSettings.files = [new Blob([JSON.stringify(data)])];
  await ui.c.loadSettings.fire('change');
  assert.match(ui.c.message.textContent, /frühere Affinity-Modus/);
  assert.equal(ui.c.black.value, '10');
  assert.equal(ui.c.white.value, '200');
  assert.equal(ui.c.invert.checked, false);
  assert.equal(ui.c.color.value, '#123456');
  assert.equal(ui.c.background.value, 'checker');
  assert.equal(ui.c.zoom.value, 'actual');
  await ui.c.render.fire('click');
  assert.equal(ui.submitted().bw_blue, 100);
  assert.equal(ui.submitted().gamma, 1);
  assert.equal(ui.submitted().invert, false);
  assert.equal(ui.submitted().spacing_mm, 1.471);
  ui.c.saveSettings.fire('click');
  const saved = JSON.parse(await ui.downloads.at(-1).text());
  assert.equal(saved.version, 4);
  assert.equal(saved.settings.gamma, 1);
  assert.equal(saved.settings.bw_blue, 100);
  assert.equal(saved.settings.black_point, 10);
  assert.equal(saved.settings.white_point, 200);
  ui.c.loadSettings.files = [new Blob([JSON.stringify(saved)])];
  await ui.c.loadSettings.fire('change');
  assert.doesNotMatch(ui.c.message.textContent, /frühere Affinity-Modus/);
});

test('Moduswechsel bewahrt getrennte Tonwerte, Gamma und gewählte Vorschaufarbe', async () => {
  const { c, importImage, submitted } = setup();
  await importImage();
  c.mode.value = 'luminance'; c.mode.fire('input');
  c.gamma.value = '2'; c.gamma.fire('input');
  c.black.value = '20'; c.black.fire('input');
  c.white.value = '210'; c.white.fire('input');
  c.invert.checked = true; c.invert.fire('input');
  c.mode.value = 'affinity'; c.mode.fire('input');
  assert.equal(c.black.value, '0');
  assert.equal(c.white.value, '245');
  c.white.value = '180'; c.white.fire('input');
  c.color.value = '#123456'; c.color.fire('input');
  await c.render.fire('click');
  assert.equal(submitted().gamma, 1);
  assert.equal(submitted().invert, false);
  c.mode.value = 'luminance'; c.mode.fire('input');
  assert.equal(c.gammaControl.hidden, false);
  assert.equal(c.invert.disabled, false);
  assert.equal(c.black.value, '20');
  assert.equal(c.white.value, '210');
  await c.render.fire('click');
  assert.equal(submitted().gamma, 2);
  assert.equal(submitted().invert, true);
  c.mode.value = 'affinity'; c.mode.fire('input');
  assert.equal(c.white.value, '180');
  assert.equal(c.color.value, '#123456');
  c.resetTones.fire('click');
  assert.equal(c.white.value, '245');
  assert.equal(c.gamma.value, '2');
});

test('Altimport im Farbmodus erhält dessen gespeicherte Tonwerte für spätere Helligkeitsraster', async () => {
  const ui = setup();
  const data = { format: 'RasterPilot', version: 2,
    settings: { ...ui.ctx.RasterPilotSettings.defaults, mode: 'color', black_point: 30, white_point: 220, gamma: 2 },
    view: { background: 'textile', color: '#233246', zoom: 'fit' } };
  ui.c.loadSettings.files = [new Blob([JSON.stringify(data)])];
  await ui.c.loadSettings.fire('change');
  await ui.importImage();
  ui.c.mode.value = 'luminance'; ui.c.mode.fire('input');
  await ui.c.render.fire('click');
  assert.equal(ui.submitted().black_point, 30);
  assert.equal(ui.submitted().white_point, 220);
  assert.equal(ui.submitted().gamma, 2);
});

test('Fertige Ergebnisse bleiben bei Einstellungswechseln gespeichert und nach Neuladen abrufbar', async () => {
  const ui = setup();
  await ui.importImage();
  await ui.c.render.fire('click');
  ui.c.coverage.value = '40'; ui.c.coverage.fire('input');
  assert.equal(ui.calls.some(([, method]) => method === 'DELETE'), false);
  const fresh = setup();
  await fresh.queueCallbacks().show({ id: 'job1', original_name: 'Gespeichertes Original.png' });
  assert.equal(fresh.c.result.hidden, false);
  assert.equal(fresh.c.download.hidden, false);
  assert.equal(fresh.c.viewSettings.disabled, false);
  assert.equal(fresh.c.originalOption.disabled, true);
  assert.match(fresh.c.renderState.textContent, /Gespeichertes Original/);
  fresh.queueCallbacks().removed('job1');
  assert.equal(fresh.c.download.hidden, true);
  assert.equal(fresh.c.empty.hidden, false);
});

test('Tonwertüberlagerung aktualisiert live ohne Netzwerk, erhält die Quelle und fasst Eingaben zusammen', async () => {
  const pixels = [0, 0, 0, 255, 128, 128, 128, 255, 255, 255, 255, 255, 200, 0, 0, 0];
  const ui = setup({ sourceWidth: 4, sourceHeight: 1, previewPixels: pixels });
  await ui.importImage('Eichhörnchen.png');
  ui.c.mode.value = 'affinity'; ui.c.mode.fire('input'); ui.flushFrames();
  assert.equal(ui.c.tone_overlay.checked, false);
  assert.deepEqual(Array.from(ui.c.canvas.painted), pixels);
  const before = ui.calls.length;
  ui.c.tone_overlay.checked = true; ui.c.tone_overlay.fire('input');
  assert.equal(ui.c.overlayLegend.hidden, false);
  assert.match(ui.c.overlayCaption.textContent, /Eichhörnchen.png/);
  ui.flushFrames();
  assert.deepEqual(Array.from(ui.c.canvas.painted), [96, 27, 27, 255, 177, 158, 85, 255, 167, 232, 191, 255, 59, 130, 246, 102]);
  ui.c.white.value = '128'; ui.c.white.fire('input');
  ui.c.white.value = '180'; ui.c.white.fire('input');
  ui.c.white.value = '200'; ui.c.white.fire('input');
  assert.equal(ui.frames.length, 1);
  ui.flushFrames();
  assert.equal(ui.c.canvas.reads, 1);
  assert.equal(ui.calls.length, before);
  ui.c.tone_overlay.checked = false; ui.c.tone_overlay.fire('input'); ui.flushFrames();
  assert.deepEqual(Array.from(ui.c.canvas.painted), pixels);
  assert.equal(ui.c.overlayLegend.hidden, true);
});

test('Ungültige Tonwerte entfernen nur die Markierung; Druckgrößenfehler lassen Bereiche nutzbar', async () => {
  const pixels = [128, 128, 128, 255];
  const ui = setup({ sourceWidth: 1, sourceHeight: 1, previewPixels: pixels });
  await ui.importImage();
  ui.c.mode.value = 'affinity'; ui.c.mode.fire('input');
  ui.c.tone_overlay.checked = true; ui.c.tone_overlay.fire('input'); ui.flushFrames();
  ui.c.black.value = '128'; ui.c.white.value = '128'; ui.c.white.fire('input'); ui.flushFrames();
  assert.equal(ui.c.canvas.hidden, false);
  assert.equal(ui.c.render.disabled, true);
  assert.equal(ui.c.overlayLegend.hidden, true);
  assert.deepEqual(Array.from(ui.c.canvas.painted), pixels);
  ui.c.black.value = ''; ui.c.black.fire('input'); ui.flushFrames();
  assert.equal(ui.c.overlayLegend.hidden, true);
  ui.c.black.value = '0'; ui.c.white.value = '245'; ui.c.width.value = '200'; ui.c.width.fire('input'); ui.flushFrames();
  assert.equal(ui.c.render.disabled, true);
  assert.equal(ui.c.canvas.hidden, false);
  assert.equal(ui.c.overlayLegend.hidden, false);
  assert.notDeepEqual(Array.from(ui.c.canvas.painted), pixels);
  ui.c.mode.value = 'luminance'; ui.c.mode.fire('input'); ui.flushFrames();
  assert.equal(ui.c.overlayControls.hidden, true);
  assert.deepEqual(Array.from(ui.c.canvas.painted), pixels);
});

test('Überlagerung wird mit JSON gespeichert und ist vor dem Originalupload nur vorgemerkt', async () => {
  const ui = setup();
  const data = { format: 'RasterPilot', version: 4,
    settings: { ...ui.ctx.RasterPilotSettings.defaults, mode: 'affinity', white_point: 245 },
    view: { ...ui.ctx.RasterPilotSettings.viewDefaults, tone_overlay: true } };
  ui.c.loadSettings.files = [new Blob([JSON.stringify(data)])];
  await ui.c.loadSettings.fire('change');
  assert.equal(ui.c.tone_overlay.checked, true);
  assert.equal(ui.c.tone_overlay.disabled, true);
  assert.equal(ui.c.overlayLegend.hidden, true);
  await ui.importImage(); ui.flushFrames();
  assert.equal(ui.c.overlayLegend.hidden, false);
  ui.c.saveSettings.fire('click');
  const saved = JSON.parse(await ui.downloads.at(-1).text());
  assert.equal(saved.version, 4);
  assert.equal(saved.view.tone_overlay, true);
  assert.doesNotMatch(ui.c.message.textContent, /frühere Affinity-Modus/);
  await ui.importImage('anderes.png'); ui.flushFrames();
  assert.match(ui.c.overlayCaption.textContent, /anderes.png/);
});

test('Ergebnisansicht schaltet Markierung aus; Schalter verändert weder Exportparameter noch vorhandenen Download', async () => {
  const ui = setup();
  await ui.importImage();
  ui.c.mode.value = 'affinity'; ui.c.mode.fire('input');
  ui.c.tone_overlay.checked = true; ui.c.tone_overlay.fire('input'); ui.flushFrames();
  await ui.c.render.fire('click');
  assert.equal(ui.c.tone_overlay.checked, false);
  assert.equal(ui.c.overlayLegend.hidden, true);
  assert.equal(ui.submitted().tone_overlay, undefined);
  const download = ui.c.download.href, before = ui.calls.length;
  ui.c.tone_overlay.checked = true; ui.c.tone_overlay.fire('input'); ui.flushFrames();
  assert.equal(ui.c.view.value, 'original');
  assert.equal(ui.c.download.href, download);
  assert.equal(ui.calls.length, before);
  ui.c.view.value = 'result'; ui.c.view.fire('input');
  assert.equal(ui.c.tone_overlay.checked, false);
  assert.equal(ui.c.overlayLegend.hidden, true);
  const fresh = setup();
  await fresh.queueCallbacks().show({ id: 'job1' });
  assert.equal(fresh.c.tone_overlay.disabled, true);
  assert.equal(fresh.c.overlayLegend.hidden, true);
});

test('Aktivierung während eines wartenden Auftrags löst nur dessen Anzeige und bricht ihn nicht ab', async () => {
  const ui = setup({ states: ['queued'] });
  await ui.importImage();
  ui.c.mode.value = 'affinity'; ui.c.mode.fire('input');
  const running = ui.c.render.fire('click');
  for (let count = 0; count < 50 && !ui.c.message.textContent.includes('Warteschlange'); count++) {
    await new Promise(setImmediate);
  }
  assert.match(ui.c.message.textContent, /Warteschlange/);
  ui.c.tone_overlay.checked = true; ui.c.tone_overlay.fire('input');
  await running; ui.flushFrames();
  assert.equal(ui.calls.some(([, method]) => method === 'DELETE'), false);
  assert.equal(ui.c.view.value, 'original');
  assert.equal(ui.c.tone_overlay.checked, true);
  assert.equal(ui.c.overlayLegend.hidden, false);
});
