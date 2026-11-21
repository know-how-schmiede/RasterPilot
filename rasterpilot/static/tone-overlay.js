'use strict';
// Bereichsvorschau ohne Dateisystem-, Netzwerk- oder Exportzugriff.
globalThis.RasterPilotToneOverlay = (() => {
  const colors = Object.freeze({ green: Object.freeze([34, 197, 94]),
    red: Object.freeze([239, 68, 68]), yellow: Object.freeze([250, 204, 21]),
    blue: Object.freeze([59, 130, 246]) });
  function valid(black, white) {
    return Number.isInteger(black) && Number.isInteger(white) &&
      black >= 0 && white <= 255 && black < white;
  }
  function prepare(pixels) {
    const maximum = new Uint8Array(pixels.length / 4);
    for (let p = 0, i = 0; i < pixels.length; p++, i += 4) {
      maximum[p] = Math.max(pixels[i], pixels[i + 1], pixels[i + 2]);
    }
    return { pixels, maximum };
  }
  function tint(cache, output, black, white) {
    if (!valid(black, white)) return false;
    const { pixels, maximum } = cache;
    for (let p = 0, i = 0; i < pixels.length; p++, i += 4) {
      const alpha = pixels[i + 3];
      if (alpha === 0) {
        // Transparenz nur in der Ansicht sichtbar machen; die Quelle bleibt leer.
        output[i] = colors.blue[0]; output[i + 1] = colors.blue[1]; output[i + 2] = colors.blue[2];
        output[i + 3] = 102;
        continue;
      } else {
        const color = maximum[p] <= black ? colors.red :
          maximum[p] >= white && alpha === 255 ? colors.green : colors.yellow;
        output[i] = Math.round(pixels[i] * 0.6 + color[0] * 0.4);
        output[i + 1] = Math.round(pixels[i + 1] * 0.6 + color[1] * 0.4);
        output[i + 2] = Math.round(pixels[i + 2] * 0.6 + color[2] * 0.4);
      }
      output[i + 3] = alpha;
    }
    return true;
  }
  return Object.freeze({ colors, valid, prepare, tint });
})();
