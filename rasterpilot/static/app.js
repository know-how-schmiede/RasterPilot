'use strict';
const $ = id => document.getElementById(id);
const fields = ['width', 'ppi', 'spacing', 'coverage', 'angle'];
const toneFields = ['black', 'white', 'gamma'];
let image = null;
let originalFile = null;
let sourceWidth = 0;
let sourceHeight = 0;
let sequence = 0;
let controller = null;
let resultUrl = null;
let hasResult = false;
const message = text => { $('message').textContent = text; };

function cancelRequest() {
  ++sequence;
  if (controller) controller.abort();
  controller = null;
  $('stage').setAttribute('aria-busy', 'false');
}

function invalidate() {
  cancelRequest();
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
  if (mode === 'luminance') activeFields.push(...toneFields);
  const valid = image && ['color', 'luminance', 'alpha'].includes(mode) &&
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
  if (mode === 'luminance') {
    p.ink_color = $('ink').value;
    p.invert = $('invert').checked;
    [p.black_point, p.white_point, p.gamma] = toneFields.map(id => Number($(id).value));
    if (!Number.isInteger(p.black_point) || !Number.isInteger(p.white_point) || p.black_point >= p.white_point) {
      throw new Error('Der Schwarzpunkt muss kleiner als der Weißpunkt sein; beide müssen ganze Zahlen sein.');
    }
  }
  return p;
}

function updateMode() {
  const mode = $('mode').value;
  const luminance = mode === 'luminance';
  $('coverageControls').hidden = mode !== 'color';
  $('coverage').disabled = mode !== 'color';
  $('luminanceControls').hidden = !luminance;
  for (const id of ['ink', 'invert', ...toneFields, 'resetTones']) $(id).disabled = !luminance;
  $('modeInfo').textContent = mode === 'color' ?
    'Bildfarben einschließlich Weiß bleiben erhalten. Die Deckung bestimmt die transparenten Lücken.' : luminance ?
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

async function requestImage(path, data, signal) {
  const response = await fetch(path, {
    method: 'POST', body: data, signal, headers: { 'X-RasterPilot-Request': '1' }
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

$('render').addEventListener('click', async () => {
  let p;
  try { p = parameters(); } catch (error) { message(error.message); return; }
  invalidate();
  const current = sequence;
  controller = new AbortController();
  $('render').disabled = true;
  $('stage').setAttribute('aria-busy', 'true');
  message('Raster wird in Exportauflösung berechnet …');
  try {
    const data = new FormData();
    data.append('image', originalFile);
    data.append('parameters', JSON.stringify(p));
    const response = await requestImage('/api/render', data, controller.signal);
    const blob = await response.blob();
    if (current !== sequence) return;
    resultUrl = URL.createObjectURL(blob);
    $('result').src = resultUrl;
    await $('result').decode();
    if (current !== sequence) return;
    hasResult = true;
    $('resultOption').disabled = false;
    $('view').value = 'result';
    $('download').href = resultUrl;
    $('download').download = decodeURIComponent(response.headers.get('X-Download-Name'));
    $('download').hidden = false;
    $('renderState').textContent = `${response.headers.get('X-Image-Width')} × ${response.headers.get('X-Image-Height')} px · PNG bereit`;
    message('Raster berechnet. Vor dem Export die Punkte bei 100 % prüfen.');
    updateView();
  } catch (error) {
    if (current === sequence && error.name !== 'AbortError') message(error.message);
  } finally {
    if (current === sequence) {
      $('render').disabled = false;
      $('stage').setAttribute('aria-busy', 'false');
    }
  }
});

for (const id of fields) $(id).addEventListener('input', () => { invalidate(); renderOriginal(); });
for (const id of ['mode', 'ink', 'invert', ...toneFields]) $(id).addEventListener('input', () => {
  updateMode(); invalidate(); renderOriginal();
});
$('resetTones').addEventListener('click', () => {
  $('black').value = '0'; $('white').value = '255'; $('gamma').value = '1';
  invalidate(); renderOriginal();
});
for (const id of ['color', 'background', 'view', 'zoom']) $(id).addEventListener('input', updateView);
updateMode();
