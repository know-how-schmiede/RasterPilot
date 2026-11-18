'use strict';
const $ = id => document.getElementById(id);
const fields = ['width', 'ppi', 'x', 'y', 'cropWidth', 'cropHeight', 'spacing', 'coverage'];
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
  const values = fields.map(id => Number($(id).value));
  const [width, ppi, x, y, w, h, spacing, coverage] = values;
  const valid = image && fields.every(id => $(id).value !== '' && $(id).checkValidity()) &&
    values.every(Number.isFinite) && [x, y, w, h, ppi].every(Number.isInteger) &&
    x + w <= sourceWidth && y + h <= sourceHeight;
  if (!valid) throw new Error('Bitte gültige Werte und einen Ausschnitt innerhalb des Bildes eingeben.');
  const pxWidth = Math.max(1, Math.round(width / 2.54 * ppi));
  const pxHeight = Math.max(1, Math.round(pxWidth * h / w));
  if (checkOutput && (pxWidth * pxHeight > 40000000 || Math.max(pxWidth, pxHeight) > 12000)) {
    throw new Error('Die gewählte Druckgröße ergibt mehr als 40 Megapixel oder 12000 Pixel je Kante. Bitte Druckbreite oder Auflösung verringern; das Originalbild kann unverändert bleiben.');
  }
  if (spacing / 25.4 * ppi < 2) throw new Error('Der Rasterabstand muss bei dieser Auflösung mindestens zwei Pixel betragen.');
  return { width_cm: width, ppi, x, y, crop_width: w, crop_height: h, spacing_mm: spacing, coverage };
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
    const ph = Math.max(1, Math.round(pw * p.crop_height / p.crop_width));
    $('dimensions').textContent = `${(p.width_cm * p.crop_height / p.crop_width).toFixed(2)} cm hoch · ${pw} × ${ph} px`;
    $('spacingInfo').textContent = `${(p.spacing_mm / 25.4 * p.ppi).toFixed(2)} Pixel Abstand der Punktmitten · Winkel 0°`;
    const scale = Math.min(1, 1600 / Math.max(p.crop_width, p.crop_height));
    const canvas = $('canvas');
    canvas.width = Math.max(1, Math.round(p.crop_width * scale));
    canvas.height = Math.max(1, Math.round(p.crop_height * scale));
    canvas.getContext('2d').drawImage(image,
      p.x * image.width / sourceWidth, p.y * image.height / sourceHeight,
      p.crop_width * image.width / sourceWidth, p.crop_height * image.height / sourceHeight,
      0, 0, canvas.width, canvas.height);
    $('render').disabled = false;
    $('render').dataset.valid = '1';
    message('');
    // Das Original bleibt auch bei zu großen Exportmaßen zum Zuschneiden sichtbar.
    try { parameters(); } catch (error) { $('render').disabled = true; message(error.message); }
  } catch (error) {
    message(error.message);
    $('dimensions').textContent = '';
    $('render').disabled = true;
    delete $('render').dataset.valid;
  }
  updateView();
}

function resetCrop() {
  if (!image) return;
  $('x').value = 0; $('y').value = 0;
  $('cropWidth').value = sourceWidth; $('cropHeight').value = sourceHeight;
  invalidate();
  renderOriginal();
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
    $('empty').hidden = true;
    resetCrop();
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
    $('download').download = `motiv_rasterpilot_${Number((p.width_cm * 10).toFixed(3))}mm_${p.ppi}ppi.png`;
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
for (const id of ['color', 'background', 'view', 'zoom']) $(id).addEventListener('input', updateView);
$('reset').addEventListener('click', resetCrop);
