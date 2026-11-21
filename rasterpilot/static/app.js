'use strict';
const $ = id => document.getElementById(id);
const fields = ['width', 'ppi', 'spacing', 'coverage', 'angle'];
const toneFields = ['black', 'white', 'gamma'];
const bwFields = { bw_red: 'bwRed', bw_yellow: 'bwYellow', bw_green: 'bwGreen',
  bw_cyan: 'bwCyan', bw_blue: 'bwBlue', bw_magenta: 'bwMagenta' };
const affinityFields = ['maskContrast', ...Object.values(bwFields)];
let image = null;
let originalFile = null;
let sourceWidth = 0;
let sourceHeight = 0;
let sequence = 0;
let controller = null;
let resultUrl = null;
let hasResult = false;
let activeJob = null;
let resultJob = null;
let cancellation = Promise.resolve();
let submission = Promise.resolve();
let presetSequence = 0;
const message = text => { $('message').textContent = text; };

function cancelRequest() {
  ++sequence;
  if (controller) controller.abort();
  controller = null;
  if (activeJob) {
    const job = activeJob;
    activeJob = null;
    cancellation = fetch(`/api/jobs/${job}`, { method: 'DELETE', headers: { 'X-RasterPilot-Request': '1' } }).catch(() => {});
  }
  $('cancel').hidden = true;
  $('stage').setAttribute('aria-busy', 'false');
}

function invalidate() {
  cancelRequest();
  if (resultJob) {
    const job = resultJob;
    resultJob = null;
    fetch(`/api/jobs/${job}`, { method: 'DELETE', headers: { 'X-RasterPilot-Request': '1' } }).catch(() => {});
  }
  hasResult = false;
  $('download').hidden = true;
  $('download').removeAttribute('href');
  $('result').hidden = true;
  $('result').removeAttribute('src');
  if (resultUrl) URL.revokeObjectURL(resultUrl);
  resultUrl = null;
  $('view').value = 'original';
  $('resultOption').disabled = true;
  $('renderState').textContent = 'Noch kein aktuelles Raster';
  updateView();
}

function parameters(checkOutput = true) {
  const mode = $('mode').value;
  const activeFields = fields.filter(id => id !== 'coverage' || mode === 'color');
  if (['luminance', 'affinity'].includes(mode)) activeFields.push(...toneFields);
  if (mode === 'affinity') activeFields.push(...affinityFields);
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
    [p.black_point, p.white_point, p.gamma] = toneFields.map(id => Number($(id).value));
    if (!Number.isInteger(p.black_point) || !Number.isInteger(p.white_point) || p.black_point >= p.white_point) {
      throw new Error('Der Schwarzpunkt muss kleiner als der Weißpunkt sein; beide müssen ganze Zahlen sein.');
    }
  }
  if (mode === 'affinity') {
    p.mask_contrast = Number($('maskContrast').value);
    p.levels_blend = $('levelsBlend').value;
    for (const [key, id] of Object.entries(bwFields)) p[key] = Number($(id).value);
    if (!['normal', 'vivid_light'].includes(p.levels_blend) ||
        ![p.mask_contrast, ...Object.keys(bwFields).map(key => p[key])].every(Number.isInteger)) {
      throw new Error('Bitte gültige Werte für Maskenkontrast, Farbregler und Mischmodus eingeben.');
    }
  }
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
  for (const id of ['invert', ...toneFields, 'resetTones']) $(id).disabled = !(luminance || affinity);
  $('affinityControls').hidden = !affinity;
  for (const id of [...affinityFields, 'levelsBlend', 'affinityPreset']) $(id).disabled = !affinity;
  $('modeInfo').textContent = mode === 'color' ?
    'Bildfarben einschließlich Weiß bleiben erhalten. Die Deckung bestimmt die transparenten Lücken.' : affinity ?
    'Wie im Affinity-Handout: Eine Helligkeitsmaske rastert die Originalfarben. Helle Bereiche erzeugen mehr Druckfläche, dunkle werden transparent. Tonwerte und Farbregler beeinflussen nur die Maske.' : luminance ?
    'Dunkle Bildstellen erzeugen mehr Druckfläche in der gewählten Druckfarbe. Vorhandene Transparenz bleibt berücksichtigt.' :
    'Weiche Transparenz wird in deckende Punkte umgewandelt. Vollständig deckende Bereiche und die Bildfarben bleiben erhalten; ohne Transparenz entstehen keine Lücken.';
}

function updateView() {
  const showResult = hasResult && $('view').value === 'result';
  $('canvas').hidden = !image || showResult || !$('render').dataset.valid;
  $('result').hidden = !showResult;
  $('zoom').disabled = !showResult;
  $('stage').classList.toggle('actual-size', showResult && $('zoom').value === 'actual');
  $('stage').classList.toggle('checker', $('background').value === 'checker');
  $('stage').style.backgroundColor = $('color').value;
}

function renderOriginal() {
  if (!image) return;
  try {
    const p = parameters(false);
    const pw = Math.max(1, Math.round(p.width_cm / 2.54 * p.ppi));
    const ph = Math.max(1, Math.round(pw * sourceHeight / sourceWidth));
    $('dimensions').textContent = `${(p.width_cm * sourceHeight / sourceWidth).toFixed(2)} cm hoch · ${pw} × ${ph} px`;
    $('spacingInfo').textContent = `${(p.spacing_mm / 25.4 * p.ppi).toFixed(2)} Pixel Abstand der Punktmitten · Winkel ${p.angle_deg}°`;
    const scale = Math.min(1, 1600 / Math.max(sourceWidth, sourceHeight));
    const canvas = $('canvas');
    canvas.width = Math.max(1, Math.round(sourceWidth * scale));
    canvas.height = Math.max(1, Math.round(sourceHeight * scale));
    canvas.getContext('2d').drawImage(image, 0, 0, canvas.width, canvas.height);
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
  image = null; originalFile = null;
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
    await cancellation;
    if (current !== sequence) return;
    // Die Annahmebestätigung abwarten, damit auch ein zwischenzeitlicher
    // Einstellungswechsel den bereits angelegten Auftrag abbrechen kann.
    const accepting = requestImage('/api/jobs', data).then(response => response.json());
    submission = accepting.then(job => {
      if (current !== sequence) return fetch(`/api/jobs/${job.id}`, {
        method: 'DELETE', headers: { 'X-RasterPilot-Request': '1' }
      }).catch(() => {});
    }).catch(() => {});
    const job = await accepting;
    if (current !== sequence) {
      await submission;
      return;
    }
    activeJob = job.id;
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
    const response = await requestImage(`/api/jobs/${job.id}/result`, undefined, controller.signal, 'GET');
    const blob = await response.blob();
    if (current !== sequence) return;
    resultUrl = URL.createObjectURL(blob);
    $('result').src = resultUrl;
    await $('result').decode();
    if (current !== sequence) return;
    hasResult = true;
    resultJob = job.id;
    activeJob = null;
    $('resultOption').disabled = false;
    $('view').value = 'result';
    $('download').href = resultUrl;
    $('download').download = decodeURIComponent(response.headers.get('X-Download-Name'));
    $('download').hidden = false;
    $('renderState').textContent = `${response.headers.get('X-Image-Width')} × ${response.headers.get('X-Image-Height')} px · PNG bereit`;
    message('Raster berechnet. Vor dem Export die Punkte bei 100 % prüfen.');
    updateView();
  } catch (error) {
    if (current === sequence && error.name !== 'AbortError') {
      if (activeJob) {
        const job = activeJob;
        activeJob = null;
        cancellation = fetch(`/api/jobs/${job}`, { method: 'DELETE', headers: { 'X-RasterPilot-Request': '1' } }).catch(() => {});
      }
      message(error.message);
    }
  } finally {
    if (current === sequence) {
      $('cancel').hidden = true;
      $('render').disabled = false;
      $('stage').setAttribute('aria-busy', 'false');
    }
  }
});

$('cancel').addEventListener('click', () => { invalidate(); renderOriginal(); message('Berechnung abgebrochen.'); });

const presetFields = { width_cm: 'width', ppi: 'ppi', spacing_mm: 'spacing', coverage: 'coverage',
  angle_deg: 'angle', mode: 'mode', ink_color: 'ink', invert: 'invert', black_point: 'black', white_point: 'white', gamma: 'gamma',
  mask_contrast: 'maskContrast', levels_blend: 'levelsBlend', ...bwFields };

$('saveSettings').addEventListener('click', () => {
  try {
    const p = Object.fromEntries(Object.entries(presetFields).map(([key, id]) => [key,
      key === 'invert' ? $(id).checked : ['mode', 'ink_color', 'levels_blend'].includes(key) ? $(id).value :
        $(id).value === '' ? NaN : Number($(id).value)]));
    const view = { background: $('background').value, color: $('color').value, zoom: $('zoom').value };
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
    const data = RasterPilotSettings.parse(await file.text());
    if (current !== presetSequence) return;
    for (const [key, id] of Object.entries(presetFields)) {
      if (key === 'invert') $(id).checked = data.settings[key];
      else $(id).value = String(data.settings[key]);
    }
    for (const [id, value] of Object.entries(data.view)) $(id).value = value;
    updateMode(); invalidate(); renderOriginal();
    message(image ? ($('render').disabled ? `Einstellungen geladen. ${$('message').textContent}` :
      'Einstellungen geladen. Raster bitte neu berechnen.') : 'Einstellungen geladen. Bitte ein Bild auswählen.');
  } catch (error) { if (current === presetSequence) message(`Einstellungen nicht geladen: ${error.message}`); }
  finally { if (current === presetSequence) event.target.value = ''; }
});

for (const id of fields) $(id).addEventListener('input', () => { invalidate(); renderOriginal(); });
for (const id of ['mode', 'ink', 'invert', ...toneFields, ...affinityFields, 'levelsBlend']) $(id).addEventListener('input', () => {
  updateMode(); invalidate(); renderOriginal();
});
$('affinityPreset').addEventListener('click', () => {
  const width = Number($('width').value), ppi = Number($('ppi').value);
  if (!Number.isFinite(width) || width <= 0 || !Number.isFinite(ppi) || ppi < 36 || ppi > 1200) {
    message('Bitte zuerst eine gültige Druckbreite und Auflösung eingeben.'); return;
  }
  // 10 Referenzpixel / 1904 Bildpixel, auf die Druckbreite übertragen.
  const requested = width * 10 * 10 / 1904;
  const spacing = Math.max(0.1, Math.round(requested * 1000) / 1000,
    Math.ceil(50.8 / ppi * 1000) / 1000);
  if (spacing > 10) {
    message('Das Handout-Beispiel ergibt mehr als 10 mm Rasterabstand. Bitte die Druckbreite verringern.'); return;
  }
  $('mode').value = 'affinity'; $('angle').value = '45'; $('spacing').value = String(spacing);
  $('black').value = '0'; $('white').value = '184'; $('gamma').value = '1';
  $('invert').checked = false; $('maskContrast').value = '85'; $('levelsBlend').value = 'vivid_light';
  for (const id of Object.values(bwFields)) $(id).value = '100';
  updateMode(); invalidate(); renderOriginal();
  if (!$('render').disabled) message(`Handout-Beispiel übernommen: Weißpunkt 184 ≈ 72 %, Rasterabstand ${spacing.toFixed(3)} mm. Raster neu berechnen und bei 100 % prüfen.${spacing > requested + 0.001 ? ' Der Abstand wurde auf die Mindestgröße von zwei Exportpixeln angehoben.' : ''}`);
});
$('resetTones').addEventListener('click', () => {
  $('black').value = '0'; $('white').value = '255'; $('gamma').value = '1';
  invalidate(); renderOriginal();
});
for (const id of ['color', 'background', 'view', 'zoom']) $(id).addEventListener('input', updateView);
updateMode();
