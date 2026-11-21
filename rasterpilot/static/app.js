'use strict';
const $ = id => document.getElementById(id);
const fields = ['width', 'ppi', 'spacing', 'coverage', 'angle'];
const toneFields = ['black', 'white', 'gamma'];
const affinityDefaults = RasterPilotSettings.affinityDefaults;
const modeTones = { luminance: { black: '0', white: '255' }, affinity: { black: '0', white: '245' } };
let toneMode = 'color';
let hasBlackPreview = false;

function rememberTones() {
  if (modeTones[toneMode]) modeTones[toneMode] = { black: $('black').value, white: $('white').value };
}
let image = null;
let previewCache = null;
let previewFrame = null;
let originalFile = null;
let sourceWidth = 0;
let sourceHeight = 0;
let sequence = 0;
let controller = null;
let resultUrl = null;
let hasResult = false;
let activeJob = null;
let resultJob = null;
let submission = Promise.resolve();
let presetSequence = 0;
const message = text => { $('message').textContent = text; };

function cancelRequest() {
  ++sequence;
  if (controller) controller.abort();
  controller = null;
  activeJob = null;
  $('cancel').hidden = true;
  $('stage').setAttribute('aria-busy', 'false');
}

function invalidate() {
  cancelRequest();
  resultJob = null;
  hasResult = false;
  $('download').hidden = true;
  $('download').removeAttribute('href');
  $('result').hidden = true;
  $('result').removeAttribute('src');
  if (resultUrl) URL.revokeObjectURL(resultUrl);
  resultUrl = null;
  $('view').value = 'original';
  $('resultOption').disabled = true;
  $('originalOption').disabled = !image;
  $('renderState').textContent = 'Noch kein aktuelles Raster';
  updateView();
}

function parameters(checkOutput = true) {
  const mode = $('mode').value;
  const activeFields = fields.filter(id => id !== 'coverage' || mode === 'color');
  if (['luminance', 'affinity'].includes(mode)) activeFields.push('black', 'white');
  if (mode === 'luminance') activeFields.push('gamma');
  const valid = image && ['color', 'luminance', 'alpha', 'affinity'].includes(mode) &&
    activeFields.every(id => $(id).value !== '' && $(id).checkValidity() && Number.isFinite(Number($(id).value))) &&
    Number.isInteger(Number($('ppi').value));
  if (!valid) throw new Error('Bitte gültige Werte für Druckgröße und Raster eingeben.');
  const [width, ppi, spacing, coverage, angle] = fields.map(id => Number($(id).value));
  const pxWidth = Math.max(1, Math.round(width / 2.54 * ppi));
  const pxHeight = Math.max(1, Math.round(pxWidth * sourceHeight / sourceWidth));
  if (checkOutput && (pxWidth * pxHeight > 40000000 || Math.max(pxWidth, pxHeight) > 12000)) {
    throw new Error('Die gewählte Druckgröße ergibt mehr als 40 Megapixel oder 12000 Pixel je Kante. Bitte Druckbreite oder Auflösung verringern; das Originalbild kann unverändert bleiben.');
  }
  if (spacing / 25.4 * ppi < 2) throw new Error('Der Rasterabstand muss bei dieser Auflösung mindestens zwei Pixel betragen.');
  const p = { width_cm: width, ppi, spacing_mm: spacing, coverage: mode === 'color' ? coverage : 100, angle_deg: angle, mode };
  if (['luminance', 'affinity'].includes(mode)) {
    if (mode === 'luminance') p.ink_color = $('ink').value;
    p.invert = $('invert').checked;
    [p.black_point, p.white_point] = ['black', 'white'].map(id => Number($(id).value));
    p.gamma = mode === 'affinity' ? affinityDefaults.gamma : Number($('gamma').value);
    if (!Number.isInteger(p.black_point) || !Number.isInteger(p.white_point) || p.black_point >= p.white_point) {
      throw new Error('Der Schwarzpunkt muss kleiner als der Weißpunkt sein; beide müssen ganze Zahlen sein.');
    }
  }
  if (mode === 'affinity') Object.assign(p, affinityDefaults);
  return p;
}

function updateMode() {
  const mode = $('mode').value;
  const luminance = mode === 'luminance';
  const affinity = mode === 'affinity';
  $('coverageControls').hidden = mode !== 'color';
  $('coverage').disabled = mode !== 'color';
  $('luminanceControls').hidden = !(luminance || affinity);
  $('inkControl').hidden = !luminance;
  $('ink').disabled = !luminance;
  for (const id of ['invert', 'black', 'white', 'resetTones']) $(id).disabled = !(luminance || affinity);
  $('gammaControl').hidden = !luminance;
  $('gamma').disabled = !luminance;
  $('invertControl').hidden = !luminance;
  $('invert').disabled = !luminance;
  $('affinityControls').hidden = !affinity;
  $('modeInfo').textContent = mode === 'color' ?
    'Bildfarben einschließlich Weiß bleiben erhalten. Die Deckung bestimmt die transparenten Lücken.' : affinity ?
    'Schwarz übernimmt das Shirt. Weiße und kräftige Farbflächen bleiben geschlossen; Übergänge zu Schwarz werden mit aufgehellten Punkten gerastert. Für schwarze Textilien.' : luminance ?
    'Dunkle Bildstellen erzeugen mehr Druckfläche in der gewählten Druckfarbe. Vorhandene Transparenz bleibt berücksichtigt.' :
    'Weiche Transparenz wird in deckende Punkte umgewandelt. Vollständig deckende Bereiche und die Bildfarben bleiben erhalten; ohne Transparenz entstehen keine Lücken.';
}

function updateView() {
  const showResult = hasResult && $('view').value === 'result';
  $('canvas').hidden = !image || showResult;
  $('result').hidden = !showResult;
  $('empty').hidden = Boolean(image || showResult);
  $('zoom').disabled = !showResult;
  $('stage').classList.toggle('actual-size', showResult && $('zoom').value === 'actual');
  $('stage').classList.toggle('checker', $('background').value === 'checker');
  $('stage').style.backgroundColor = $('color').value;
  const available = $('mode').value === 'affinity';
  $('overlayControls').hidden = !available;
  $('tone_overlay').disabled = !image || !previewCache;
  const black = Number($('black').value), white = Number($('white').value);
  const tonesValid = $('black').value !== '' && $('white').value !== '' && RasterPilotToneOverlay.valid(black, white);
  const active = available && image && !showResult && $('tone_overlay').checked && tonesValid;
  $('overlayLegend').hidden = !active;
  $('overlayCaption').hidden = !active;
  $('overlayCaption').textContent = active ? `Tonwertbereiche · Original: ${originalFile?.name || 'Gewähltes Bild'}` : '';
  $('overlayInfo').textContent = !image ? 'Wähle ein Originalbild, um dessen Tonwertbereiche anzuzeigen.' :
    $('tone_overlay').checked && !tonesValid ? 'Ungültige Tonwerte: Die Überlagerung ist ausgeblendet.' :
    'Bereichsvorschau mit 40 % Einfärbung. Verkleinerte Ansicht; Rasterpunkte im Export bei 100 % prüfen.';
  schedulePreview();
}

function schedulePreview() {
  if (previewFrame !== null) return;
  previewFrame = requestAnimationFrame(() => {
    previewFrame = null;
    if (!image || !previewCache || (hasResult && $('view').value === 'result')) return;
    const black = $('black').value === '' ? NaN : Number($('black').value);
    const white = $('white').value === '' ? NaN : Number($('white').value);
    const marked = $('mode').value === 'affinity' && $('tone_overlay').checked &&
      RasterPilotToneOverlay.tint(previewCache.tone, previewCache.output.data, black, white);
    $('canvas').getContext('2d').putImageData(marked ? previewCache.output : previewCache.original, 0, 0);
  });
}

function cacheOriginal() {
  if (previewCache) return;
  const scale = Math.min(1, 1600 / Math.max(sourceWidth, sourceHeight));
  const canvas = $('canvas');
  canvas.width = Math.max(1, Math.round(sourceWidth * scale));
  canvas.height = Math.max(1, Math.round(sourceHeight * scale));
  const context = canvas.getContext('2d');
  context.drawImage(image, 0, 0, canvas.width, canvas.height);
  const original = context.getImageData(0, 0, canvas.width, canvas.height);
  previewCache = { original, output: context.createImageData(canvas.width, canvas.height),
    tone: RasterPilotToneOverlay.prepare(original.data) };
}

function renderOriginal() {
  if (!image) return;
  $('originalOption').disabled = false;
  cacheOriginal();
  try {
    const p = parameters(false);
    const pw = Math.max(1, Math.round(p.width_cm / 2.54 * p.ppi));
    const ph = Math.max(1, Math.round(pw * sourceHeight / sourceWidth));
    $('dimensions').textContent = `${(p.width_cm * sourceHeight / sourceWidth).toFixed(2)} cm hoch · ${pw} × ${ph} px`;
    $('spacingInfo').textContent = `${(p.spacing_mm / 25.4 * p.ppi).toFixed(2)} Pixel Abstand der Punktmitten · Winkel ${p.angle_deg}°`;
    $('render').disabled = false;
    $('render').dataset.valid = '1';
    message('');
    // Das vollständige Original bleibt auch bei zu großen Exportmaßen sichtbar.
    try { parameters(); } catch (error) { $('render').disabled = true; message(error.message); }
  } catch (error) {
    message(error.message);
    $('dimensions').textContent = '';
    $('render').disabled = true;
    delete $('render').dataset.valid;
  }
  updateView();
}

async function requestImage(path, data, signal, method = 'POST') {
  const response = await fetch(path, {
    method, body: data, signal, headers: { 'X-RasterPilot-Request': '1' }
  });
  if (!response.ok) {
    let detail;
    try { detail = (await response.json()).error; } catch (_) { /* Nginx kann HTML liefern. */ }
    throw new Error(detail || (response.status === 413 ?
      'Der Server lehnt die Dateigröße ab. Bitte das Uploadlimit in Nginx prüfen.' :
      'Die Berechnung ist fehlgeschlagen. Bitte erneut versuchen oder den Serverstatus prüfen.'));
  }
  return response;
}

$('file').addEventListener('change', async event => {
  invalidate();
  const current = sequence;
  const file = event.target.files[0];
  if (image) image.close();
  image = null; originalFile = null; previewCache = null;
  updateView();
  $('settings').disabled = true;
  $('viewSettings').disabled = true;
  $('canvas').hidden = true;
  $('empty').hidden = false;
  $('dimensions').textContent = '';
  $('imageNotes').textContent = '';
  if (!file) { message(''); return; }
  if (file.size > 20 * 1024 * 1024) { message('Bitte eine PNG- oder JPEG-Datei mit höchstens 20 MiB auswählen.'); return; }
  controller = new AbortController();
  $('stage').setAttribute('aria-busy', 'true');
  message('Bild wird auf dem RasterPilot-Server geprüft …');
  try {
    const data = new FormData(); data.append('image', file);
    const response = await requestImage('/api/prepare', data, controller.signal);
    const next = await createImageBitmap(await response.blob());
    if (current !== sequence) { next.close(); return; }
    image = next; originalFile = file;
    sourceWidth = Number(response.headers.get('X-Image-Width'));
    sourceHeight = Number(response.headers.get('X-Image-Height'));
    $('imageNotes').textContent = JSON.parse(response.headers.get('X-Image-Notes') || '[]').join(' ');
    $('settings').disabled = false;
    $('viewSettings').disabled = false;
    $('empty').hidden = true;
    renderOriginal();
  } catch (error) {
    if (current === sequence && error.name !== 'AbortError') message(error.message);
  } finally {
    if (current === sequence) $('stage').setAttribute('aria-busy', 'false');
  }
});

function pause(signal) {
  return new Promise((resolve, reject) => {
    const abort = () => { clearTimeout(timer); const error = new Error('Abgebrochen'); error.name = 'AbortError'; reject(error); };
    const timer = setTimeout(() => { signal.removeEventListener('abort', abort); resolve(); }, 1000);
    if (signal.aborted) abort();
    else signal.addEventListener('abort', abort, { once: true });
  });
}

async function loadResult(job, current, signal, archived = false) {
  const response = await requestImage(`/api/jobs/${job.id}/result`, undefined, signal, 'GET');
  const blob = await response.blob();
  if (current !== sequence) return;
  resultUrl = URL.createObjectURL(blob);
  $('result').src = resultUrl;
  await $('result').decode();
  if (current !== sequence) return;
  hasResult = true; resultJob = job.id; activeJob = null;
  $('tone_overlay').checked = false;
  $('resultOption').disabled = false;
  $('originalOption').disabled = archived || !image;
  $('viewSettings').disabled = false;
  $('view').value = 'result';
  $('download').href = resultUrl;
  $('download').download = decodeURIComponent(response.headers.get('X-Download-Name'));
  $('download').hidden = false;
  $('renderState').textContent = `${job.original_name || ''} · ${response.headers.get('X-Image-Width')} × ${response.headers.get('X-Image-Height')} px · PNG bereit`;
  message(archived ? 'Gespeichertes Ergebnis angezeigt. Die aktuellen Bildeinstellungen wurden nicht übernommen.' :
    'Raster berechnet. Vor dem Export die Punkte bei 100 % prüfen.');
  updateView();
}

$('render').addEventListener('click', async () => {
  let p;
  try { p = parameters(); } catch (error) { message(error.message); return; }
  invalidate();
  const current = sequence;
  controller = new AbortController();
  $('render').disabled = true;
  $('cancel').hidden = false;
  $('stage').setAttribute('aria-busy', 'true');
  message('Bild wird für die Hintergrundverarbeitung übertragen …');
  try {
    const data = new FormData();
    data.append('image', originalFile);
    data.append('parameters', JSON.stringify(p));
    await submission;
    if (current !== sequence) return;
    // Annahmen serialisieren; danach bleibt jeder Auftrag in der Liste erhalten.
    const accepting = requestImage('/api/jobs', data).then(response => response.json());
    submission = accepting.then(() => {}).catch(() => {});
    const job = await accepting;
    await RasterPilotJobs.refresh();
    if (current !== sequence) {
      return;
    }
    activeJob = job.id;
    $('render').disabled = false;
    while (true) {
      const statusResponse = await requestImage(`/api/jobs/${job.id}`, undefined, controller.signal, 'GET');
      const status = await statusResponse.json();
      if (current !== sequence) return;
      if (status.state === 'done') break;
      if (['failed', 'cancelled'].includes(status.state)) throw new Error(status.error || 'Die Berechnung wurde abgebrochen.');
      message(status.worker_ready === false ? 'Der Hintergrunddienst ist derzeit nicht erreichbar. Der Auftrag bleibt vorgemerkt und kann abgebrochen werden.' :
        status.state === 'queued' ? 'Auftrag wartet in der Warteschlange …' : 'Raster wird im Hintergrund in Exportauflösung berechnet …');
      await pause(controller.signal);
    }
    await loadResult(job, current, controller.signal);
  } catch (error) {
    if (current === sequence && error.name !== 'AbortError') {
      message(error.message);
    }
  } finally {
    await RasterPilotJobs.refresh();
    if (current === sequence) {
      $('cancel').hidden = true;
      $('render').disabled = false;
      $('stage').setAttribute('aria-busy', 'false');
    }
  }
});

$('cancel').addEventListener('click', async () => {
  const id = activeJob;
  invalidate(); renderOriginal();
  if (!id) { message('Übertragung läuft noch. Nach Annahme kann der Auftrag in der Liste abgebrochen werden.'); return; }
  try {
    await requestImage(`/api/jobs/${id}`, undefined, undefined, 'DELETE');
    message('Berechnung abgebrochen.'); await RasterPilotJobs.refresh();
  } catch (error) { message(error.message); }
});

const presetFields = { width_cm: 'width', ppi: 'ppi', spacing_mm: 'spacing', coverage: 'coverage',
  angle_deg: 'angle', mode: 'mode', ink_color: 'ink', invert: 'invert', black_point: 'black', white_point: 'white', gamma: 'gamma' };

$('saveSettings').addEventListener('click', () => {
  try {
    const p = { ...affinityDefaults, ...Object.fromEntries(Object.entries(presetFields).map(([key, id]) => [key,
      key === 'invert' ? $(id).checked : ['mode', 'ink_color'].includes(key) ? $(id).value :
        $(id).value === '' ? NaN : Number($(id).value)])) };
    if (p.mode === 'affinity') p.gamma = affinityDefaults.gamma;
    const view = { background: $('background').value, color: $('color').value, zoom: $('zoom').value,
      tone_overlay: $('tone_overlay').checked };
    const json = RasterPilotSettings.serialize(p, view);
    const url = URL.createObjectURL(new Blob([json], { type: 'application/json' }));
    $('presetDownload').href = url;
    $('presetDownload').download = 'rasterpilot_einstellungen.json';
    $('presetDownload').click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
    message('Einstellungen gespeichert. Die Datei enthält keine Bilddaten.');
  } catch (error) { message(error.message); }
});

$('loadSettings').addEventListener('change', async event => {
  const current = ++presetSequence;
  const file = event.target.files[0];
  if (!file) return;
  try {
    if (file.size > 64 * 1024) throw new Error('Einstellungsdateien dürfen höchstens 64 KiB groß sein.');
    const source = JSON.parse(await file.text());
    const data = RasterPilotSettings.validate(source);
    if (current !== presetSequence) return;
    rememberTones();
    for (const [key, id] of Object.entries(presetFields)) {
      if (['gamma', 'invert'].includes(key) && data.settings.mode === 'affinity') continue;
      if (key === 'invert') $(id).checked = data.settings[key];
      else $(id).value = String(data.settings[key]);
    }
    for (const [id, value] of Object.entries(data.view)) {
      if (id === 'tone_overlay') $(id).checked = value;
      else $(id).value = value;
    }
    toneMode = data.settings.mode;
    if (!modeTones[toneMode]) modeTones.luminance = { black: $('black').value, white: $('white').value };
    rememberTones();
    if (toneMode === 'affinity') hasBlackPreview = true;
    updateMode(); invalidate(); renderOriginal();
    message(image ? ($('render').disabled ? `Einstellungen geladen. ${$('message').textContent}` :
      'Einstellungen geladen. Raster bitte neu berechnen.') : 'Einstellungen geladen. Bitte ein Bild auswählen.');
    if (data.settings.mode === 'affinity' && source.version < 3) {
      message(`${$('message').textContent} Der frühere Affinity-Modus wurde durch „Schwarz durch Shirt ersetzen“ abgelöst. Die neue Berechnung hellt die Rasterpunkte auf; frühere Zusatzparameter und Umkehrung entfallen.`);
    }
  } catch (error) { if (current === presetSequence) message(`Einstellungen nicht geladen: ${error.message}`); }
  finally { if (current === presetSequence) event.target.value = ''; }
});

for (const id of fields) $(id).addEventListener('input', () => { invalidate(); renderOriginal(); });
for (const id of ['ink', 'invert', ...toneFields]) $(id).addEventListener('input', () => {
  updateMode(); invalidate(); renderOriginal();
});
$('mode').addEventListener('input', () => {
  rememberTones();
  toneMode = $('mode').value;
  const tones = modeTones[toneMode] || modeTones.luminance;
  $('black').value = tones.black;
  $('white').value = tones.white;
  if (toneMode === 'affinity' && !hasBlackPreview) {
    $('background').value = 'textile'; $('color').value = '#000000'; hasBlackPreview = true;
  }
  updateMode(); invalidate(); renderOriginal();
});
$('resetTones').addEventListener('click', () => {
  $('black').value = '0'; $('white').value = $('mode').value === 'affinity' ? '245' : '255';
  if ($('mode').value === 'luminance') $('gamma').value = '1';
  invalidate(); renderOriginal();
});
for (const id of ['color', 'background', 'zoom']) $(id).addEventListener('input', updateView);
$('view').addEventListener('input', () => {
  if ($('view').value === 'result') $('tone_overlay').checked = false;
  updateView();
});
$('tone_overlay').addEventListener('input', () => {
  if ($('tone_overlay').checked && image) {
    // Nur die Anzeige vom laufenden Auftrag lösen; der Serverauftrag bleibt bestehen.
    cancelRequest();
    $('view').value = 'original'; $('originalOption').disabled = false;
  }
  updateView();
});
updateMode();
RasterPilotJobs.start({
  show: async job => {
    invalidate();
    resultJob = job.id;
    const current = sequence;
    controller = new AbortController();
    $('stage').setAttribute('aria-busy', 'true');
    try { await loadResult(job, current, controller.signal, true); }
    catch (error) { if (current === sequence && error.name !== 'AbortError') throw error; }
    finally { if (current === sequence) $('stage').setAttribute('aria-busy', 'false'); }
  },
  removed: id => {
    if (activeJob === id || resultJob === id) { invalidate(); renderOriginal(); }
  }
});
