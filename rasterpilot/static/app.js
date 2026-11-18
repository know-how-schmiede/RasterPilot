'use strict';
const $ = id => document.getElementById(id);
const fields = ['width', 'ppi', 'x', 'y', 'cropWidth', 'cropHeight'];
let image = null;
let sequence = 0;
const message = text => { $('message').textContent = text; };
function resetCrop() {
  if (!image) return;
  $('x').value = 0; $('y').value = 0;
  $('cropWidth').value = image.width; $('cropHeight').value = image.height;
  render();
}
function render() {
  if (!image) return;
  const [width, ppi, x, y, w, h] = fields.map(id => Number($(id).value));
  const valid = fields.every(id => $(id).value !== '' && $(id).checkValidity()) &&
    [x, y, w, h, ppi].every(Number.isInteger) && x + w <= image.width && y + h <= image.height;
  if (!valid) { message('Bitte gültige Werte und einen Ausschnitt innerhalb des Bildes eingeben.'); $('dimensions').textContent = ''; $('canvas').hidden = true; return; }
  message('');
  const height = width * h / w;
  const pxWidth = Math.round(width / 2.54 * ppi);
  const pxHeight = Math.round(pxWidth * h / w);
  $('dimensions').textContent = `${height.toFixed(2)} cm hoch · ${pxWidth} × ${pxHeight} px`;
  const scale = Math.min(1, 1600 / Math.max(w, h));
  const canvas = $('canvas'); canvas.width = Math.max(1, Math.round(w * scale)); canvas.height = Math.max(1, Math.round(h * scale));
  canvas.getContext('2d').drawImage(image, x, y, w, h, 0, 0, canvas.width, canvas.height);
  canvas.hidden = false;
  $('stage').style.backgroundColor = $('color').value;
}
$('file').addEventListener('change', async event => {
  const file = event.target.files[0];
  const current = ++sequence;
  if (!file) return;
  if (!['image/png', 'image/jpeg'].includes(file.type) || file.size > 20 * 1024 * 1024) { message('Bitte eine PNG- oder JPEG-Datei mit höchstens 20 MiB auswählen.'); return; }
  let next;
  try {
    next = await createImageBitmap(file, { imageOrientation: 'from-image' });
    if (current !== sequence) { next.close(); return; }
    if (next.width * next.height > 40000000) { next.close(); message('Das Bild darf höchstens 40 Megapixel groß sein.'); return; }
    if (image) image.close();
    image = next; $('settings').disabled = false; $('empty').hidden = true; resetCrop();
  } catch (error) { if (current === sequence) message('Das Bild konnte nicht geöffnet werden. Bitte eine gültige PNG- oder JPEG-Datei auswählen.'); }
});
for (const id of [...fields, 'color']) $(id).addEventListener('input', render);
$('reset').addEventListener('click', resetCrop);
