"""Farbige Rasterung in endgültiger Druckgröße, ohne Dateisystemzugriffe."""

from dataclasses import dataclass
from io import BytesIO
import math
import warnings

import numpy as np
from PIL import Image, ImageCms, ImageOps, UnidentifiedImageError

MAX_FILE_BYTES = 20 * 1024 * 1024
MAX_INPUT_PIXELS = 40_000_000
MAX_OUTPUT_PIXELS = 40_000_000
MAX_OUTPUT_SIDE = 12_000
SRGB = ImageCms.ImageCmsProfile(ImageCms.createProfile('sRGB'))


class ImageError(ValueError):
    """Für Anwender verständlicher Bild- oder Parameterfehler."""


def load_image(stream):
    """PNG/JPEG orientieren und nach sRGB/RGBA konvertieren; Metadaten entfernen."""
    data = stream.read(MAX_FILE_BYTES + 1)
    if len(data) > MAX_FILE_BYTES:
        raise ImageError('Das Bild darf höchstens 20 MiB groß sein.')
    try:
        with warnings.catch_warnings():
            warnings.simplefilter('error', Image.DecompressionBombWarning)
            with Image.open(BytesIO(data), formats=('PNG', 'JPEG')) as source:
                if source.width * source.height > MAX_INPUT_PIXELS:
                    raise ImageError('Das Bild darf höchstens 40 Megapixel groß sein.')
                if getattr(source, 'n_frames', 1) != 1:
                    raise ImageError('Bitte ein einzelnes Bild statt eines animierten PNG auswählen.')
                source.load()
                oriented = ImageOps.exif_transpose(source)
                alpha = oriented.convert('RGBA').getchannel('A')
                if oriented.mode in ('I', 'I;16', 'I;16B', 'I;16L'):
                    # Pillow.convert('RGB') würde 16-Bit-Grauwerte über 255
                    # abschneiden. Für den 8-Bit-Export den ganzen Bereich nutzen.
                    samples = np.asarray(oriented, dtype=np.uint32)
                    oriented = Image.fromarray(((samples + 128) // 257).astype(np.uint8))
                profile = source.info.get('icc_profile')
                notes = []
                if profile:
                    try:
                        # CMYK/LAB müssen für die Profilkonvertierung ihre Farbkanäle behalten.
                        input_profile = ImageCms.ImageCmsProfile(BytesIO(profile))
                        gray_profile = input_profile.profile.xcolor_space.strip() == 'GRAY'
                        color = oriented if (oriented.mode in ('RGB', 'CMYK', 'LAB') or
                            (oriented.mode == 'L' and gray_profile)) else oriented.convert('RGB')
                        rgb = ImageCms.profileToProfile(color, input_profile, SRGB, outputMode='RGB')
                    except (ImageCms.PyCMSError, OSError, ValueError) as error:
                        raise ImageError('Das eingebettete Farbprofil konnte nicht nach sRGB umgewandelt werden.') from error
                else:
                    if oriented.mode in ('CMYK', 'LAB'):
                        raise ImageError('Für dieses Bild wird ein eingebettetes Farbprofil benötigt. Bitte als sRGB-PNG oder -JPEG speichern.')
                    rgb = oriented.convert('RGB')
                    notes.append('Ohne eingebettetes Farbprofil wird sRGB angenommen.')
                rgb.putalpha(alpha)
                rgb.info.clear()
                return rgb, notes
    except ImageError:
        raise
    except (UnidentifiedImageError, OSError, ValueError, SyntaxError,
            Image.DecompressionBombError, Image.DecompressionBombWarning) as error:
        raise ImageError('Das Bild konnte nicht geöffnet werden. Bitte eine gültige PNG- oder JPEG-Datei auswählen.') from error


def _number(values, key, low, high, integer=False):
    value = values.get(key)
    if isinstance(value, bool) or not isinstance(value, (int, float)):
        raise ImageError(f'Ungültiger Zahlenwert: {key}.')
    if not low <= value <= high or not math.isfinite(value) or (integer and value != int(value)):
        raise ImageError(f'Wert außerhalb des gültigen Bereichs: {key}.')
    return int(value) if integer else float(value)


@dataclass(frozen=True)
class Parameters:
    width_cm: float
    ppi: int
    source_width: int
    source_height: int
    spacing_mm: float
    coverage: float
    angle_deg: float

    @classmethod
    def from_dict(cls, values, size):
        if not isinstance(values, dict):
            raise ImageError('Die Rastereinstellungen müssen ein JSON-Objekt sein.')
        w, h = size
        result = cls(
            _number(values, 'width_cm', 0.1, 200),
            _number(values, 'ppi', 36, 1200, True),
            w,
            h,
            _number(values, 'spacing_mm', 0.1, 10),
            _number(values, 'coverage', 0, 100),
            _number({'angle_deg': values.get('angle_deg', 0)}, 'angle_deg', -180, 180),
        )
        result.output_size()  # Grenzen vor Skalierung und Speicherreservierung prüfen.
        if result.spacing_px < 2:
            raise ImageError('Der Rasterabstand muss bei dieser Auflösung mindestens zwei Pixel betragen. Bitte Abstand oder Auflösung erhöhen.')
        return result

    @property
    def spacing_px(self):
        return self.spacing_mm / 25.4 * self.ppi

    def output_size(self):
        # Positive Werte werden wie Math.round im Browser auf halbe Pixel aufgerundet.
        w = max(1, math.floor(self.width_cm / 2.54 * self.ppi + 0.5))
        h = max(1, math.floor(w * self.source_height / self.source_width + 0.5))
        if w * h > MAX_OUTPUT_PIXELS or max(w, h) > MAX_OUTPUT_SIDE:
            raise ImageError('Die gewählte Druckgröße ergibt mehr als 40 Megapixel oder 12000 Pixel je Kante. Bitte Druckbreite oder Auflösung verringern; das Originalbild kann unverändert bleiben.')
        return w, h


def _resize_rgba(image, size):
    # Vormultipliziertes Alpha verhindert Farbsäume durch unsichtbare RGB-Werte.
    return image.convert('RGBa').resize(size, Image.Resampling.LANCZOS).convert('RGBA')


def _png(image, ppi=None):
    data = BytesIO()
    options = {'icc_profile': SRGB.tobytes()}
    if ppi is not None:
        options['dpi'] = (ppi, ppi)
    image.save(data, format='PNG', **options)
    data.seek(0)
    return data


def prepare_preview(image):
    scale = min(1, 1600 / max(image.size))
    size = tuple(max(1, math.floor(side * scale + 0.5)) for side in image.size)
    with _resize_rgba(image, size) as preview:
        return _png(preview)


def _area_rank(distance_squared):
    """Fläche des Kreises innerhalb der Einheitszelle, auch bei hoher Deckung."""
    area = np.pi * distance_squared
    clipped = distance_squared > 0.25
    d2 = distance_squared[clipped]
    area[clipped] -= 4 * (d2 * np.arccos(0.5 / np.sqrt(d2)) - 0.5 * np.sqrt(d2 - 0.25))
    return np.clip(area, 0, 1)


def render_png(image, parameters):
    size = parameters.output_size()
    result = _resize_rgba(image, size)
    pitch = parameters.spacing_px
    angle = math.radians(parameters.angle_deg)
    cosine, sine = math.cos(angle), math.sin(angle)
    # Pixelmitten in Rasterkoordinaten abbilden. Positive Winkel drehen das
    # Raster im Uhrzeigersinn um die linke obere Bildkante, ohne das Bild zu drehen.
    xx = (np.arange(size[0], dtype=np.float64) + 0.5) / pitch
    for start in range(0, size[1], 128):
        end = min(start + 128, size[1])
        yy = (np.arange(start, end, dtype=np.float64) + 0.5) / pitch
        u = (cosine * xx[None, :] + sine * yy[:, None]) % 1 - 0.5
        v = (-sine * xx[None, :] + cosine * yy[:, None]) % 1 - 0.5
        rank = _area_rank(u ** 2 + v ** 2)
        with result.crop((0, start, size[0], end)) as band:
            pixels = np.array(band)
        # Alpha genau einmal in die gewünschte Deckung einbeziehen.
        desired = pixels[:, :, 3].astype(np.float64) / 255 * (parameters.coverage / 100)
        keep = (desired > 0) & ((desired >= 1) | (rank < desired))
        pixels[:, :, 3] = np.where(keep, 255, 0)
        pixels[~keep, :3] = 0
        with Image.fromarray(pixels) as band:
            result.paste(band, (0, start))
    try:
        return _png(result, parameters.ppi)
    finally:
        result.close()
