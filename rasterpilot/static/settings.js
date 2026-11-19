'use strict';
// Versionierte Einstellungen ohne Bilder, Dateinamen oder Server-Aufträge.
globalThis.RasterPilotSettings = (() => {
  const defaults = Object.freeze({ width_cm: 28, ppi: 300, spacing_mm: 1, coverage: 65,
    angle_deg: 0, mode: 'color', ink_color: '#000000', invert: false,
    black_point: 0, white_point: 255, gamma: 1 });
  const viewDefaults = Object.freeze({ background: 'textile', color: '#233246', zoom: 'fit' });
  const ranges = { width_cm: [0.1, 200], ppi: [36, 1200], spacing_mm: [0.1, 10],
    coverage: [0, 100], angle_deg: [-180, 180], black_point: [0, 254], white_point: [1, 255], gamma: [0.1, 5] };
  const object = value => value && typeof value === 'object' && !Array.isArray(value);
  const color = value => typeof value === 'string' && /^#[0-9a-f]{6}$/i.test(value);
  function validate(data) {
    if (!object(data) || data.format !== 'RasterPilot' || data.version !== 1 ||
        !object(data.settings) || !object(data.view)) throw new Error('Keine unterstützte RasterPilot-Einstellungsdatei (Version 1).');
    for (const [values, reference] of [[data.settings, defaults], [data.view, viewDefaults]]) {
      if (Object.keys(values).length !== Object.keys(reference).length ||
          Object.keys(reference).some(key => !Object.hasOwn(values, key))) throw new Error('Die Einstellungsdatei ist unvollständig oder enthält unbekannte Werte.');
    }
    for (const [key, [low, high]] of Object.entries(ranges)) {
      const value = data.settings[key];
      if (typeof value !== 'number' || !Number.isFinite(value) || value < low || value > high) {
        throw new Error(`Ungültiger Einstellungswert: ${key}.`);
      }
    }
    const p = data.settings, v = data.view;
    for (const [key, factor] of Object.entries({ width_cm: 10, spacing_mm: 10, coverage: 1, angle_deg: 1, gamma: 10 })) {
      if (Math.abs(p[key] * factor - Math.round(p[key] * factor)) > 1e-7) {
        throw new Error(`Nicht unterstützte Schrittweite: ${key}.`);
      }
    }
    if (!['ppi', 'black_point', 'white_point'].every(key => Number.isInteger(p[key])) ||
        p.black_point >= p.white_point || p.spacing_mm / 25.4 * p.ppi < 2 ||
        !['color', 'luminance', 'alpha'].includes(p.mode) || !color(p.ink_color) || typeof p.invert !== 'boolean' ||
        !['textile', 'checker'].includes(v.background) || !color(v.color) || !['fit', 'actual'].includes(v.zoom)) {
      throw new Error('Ungültige Raster- oder Ansichtseinstellungen. Bitte Werte und Tonwertgrenzen prüfen.');
    }
    // Nur bekannte Schlüssel kopieren; keine Dateipfade oder Inhalte übernehmen.
    return { format: 'RasterPilot', version: 1,
      settings: Object.fromEntries(Object.keys(defaults).map(key => [key, p[key]])),
      view: Object.fromEntries(Object.keys(viewDefaults).map(key => [key, v[key]])) };
  }
  return Object.freeze({ defaults, viewDefaults, validate,
    parse: text => validate(JSON.parse(text)),
    serialize: (settings, view) => JSON.stringify(validate({ format: 'RasterPilot', version: 1, settings, view }), null, 2) });
})();
