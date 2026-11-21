'use strict';
// Versionierte Einstellungen ohne Bilder, Dateinamen oder Server-Aufträge.
globalThis.RasterPilotSettings = (() => {
  const defaults = Object.freeze({ width_cm: 28, ppi: 300, spacing_mm: 1, coverage: 65,
    angle_deg: 0, mode: 'color', ink_color: '#000000', invert: false,
    black_point: 0, white_point: 255, gamma: 1, mask_contrast: 85, levels_blend: 'normal',
    bw_red: 100, bw_yellow: 100, bw_green: 100, bw_cyan: 100, bw_blue: 100, bw_magenta: 100 });
  const affinityKeys = ['mask_contrast', 'levels_blend', 'bw_red', 'bw_yellow', 'bw_green', 'bw_cyan', 'bw_blue', 'bw_magenta'];
  const affinityDefaults = Object.freeze({ gamma: 1, invert: false, mask_contrast: 85, levels_blend: 'normal',
    bw_red: 100, bw_yellow: 100, bw_green: 100, bw_cyan: 100, bw_blue: 100, bw_magenta: 100 });
  const viewDefaults = Object.freeze({ background: 'textile', color: '#233246', zoom: 'fit' });
  const ranges = { width_cm: [0.1, 200], ppi: [36, 1200], spacing_mm: [0.1, 10],
    coverage: [0, 100], angle_deg: [-180, 180], black_point: [0, 254], white_point: [1, 255], gamma: [0.1, 5],
    mask_contrast: [0, 100], bw_red: [0, 200], bw_yellow: [0, 200], bw_green: [0, 200],
    bw_cyan: [0, 200], bw_blue: [0, 200], bw_magenta: [0, 200] };
  const object = value => value && typeof value === 'object' && !Array.isArray(value);
  const color = value => typeof value === 'string' && /^#[0-9a-f]{6}$/i.test(value);
  function validate(data) {
    if (!object(data) || data.format !== 'RasterPilot' || ![1, 2, 3].includes(data.version) ||
        !object(data.settings) || !object(data.view)) throw new Error('Keine unterstützte RasterPilot-Einstellungsdatei (Version 1, 2 oder 3).');
    if (data.version === 1) {
      const oldKeys = Object.keys(defaults).filter(key => !affinityKeys.includes(key));
      if (Object.keys(data.settings).length !== oldKeys.length ||
          oldKeys.some(key => !Object.hasOwn(data.settings, key)) ||
          !['color', 'luminance', 'alpha'].includes(data.settings.mode)) {
        throw new Error('Ungültige Einstellungen der Version 1.');
      }
      data = { ...data, version: 2, settings: { ...defaults, ...data.settings } };
    }
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
    for (const [key, factor] of Object.entries({ width_cm: 10, spacing_mm: 1000, coverage: 1, angle_deg: 1, gamma: 10 })) {
      if (Math.abs(p[key] * factor - Math.round(p[key] * factor)) > 1e-7) {
        throw new Error(`Nicht unterstützte Schrittweite: ${key}.`);
      }
    }
    if (!['ppi', 'black_point', 'white_point', 'mask_contrast', ...affinityKeys.filter(key => key.startsWith('bw_'))].every(key => Number.isInteger(p[key])) ||
        p.black_point >= p.white_point || p.spacing_mm / 25.4 * p.ppi < 2 ||
        !['color', 'luminance', 'alpha', 'affinity'].includes(p.mode) || !color(p.ink_color) || typeof p.invert !== 'boolean' ||
        !['normal', 'vivid_light'].includes(p.levels_blend) ||
        !['textile', 'checker'].includes(v.background) || !color(v.color) || !['fit', 'actual'].includes(v.zoom)) {
      throw new Error('Ungültige Raster- oder Ansichtseinstellungen. Bitte Werte und Tonwertgrenzen prüfen.');
    }
    // Nur bekannte Schlüssel kopieren; keine Dateipfade oder Inhalte übernehmen.
    return { format: 'RasterPilot', version: 3,
      settings: { ...Object.fromEntries(Object.keys(defaults).map(key => [key, p[key]])),
        ...(p.mode === 'affinity' ? affinityDefaults : {}) },
      view: Object.fromEntries(Object.keys(viewDefaults).map(key => [key, v[key]])) };
  }
  return Object.freeze({ defaults, affinityDefaults, viewDefaults, validate,
    parse: text => validate(JSON.parse(text)),
    serialize: (settings, view) => JSON.stringify(validate({ format: 'RasterPilot', version: 3, settings, view }), null, 2) });
})();
