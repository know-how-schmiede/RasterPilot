"""RasterPilot web application."""

from io import BytesIO
import json
import re
from urllib.parse import quote, urlsplit

from flask import Flask, Request, jsonify, render_template, request, send_file

from .processing import ImageError, Parameters, load_image, prepare_preview, render_png

from .version import __version__


def export_filename(original_name, parameters):
    """Originalnamen ohne Pfad/Endung als portablen PNG-Downloadnamen verwenden."""
    name = re.split(r'[/\\]', original_name or '')[-1]
    stem = name.rsplit('.', 1)[0] if '.' in name else name
    stem = re.sub(r'[\x00-\x1f\x7f<>:"/\\|?*]', '_', stem).strip(' .') or 'motiv'
    angle = parameters.angle_deg or 0  # Keine negative Null im Dateinamen.
    suffix = f'_rp_{parameters.width_cm * 10:g}_{parameters.ppi}ppi_{angle:g}G.png'
    # Auch bei langen Unicode-Namen den vollständigen Parametersuffix erhalten.
    budget = 255 - len(suffix.encode('utf-8'))
    stem = stem.encode('utf-8')[:budget].decode('utf-8', errors='ignore')
    return stem + suffix


class MemoryRequest(Request):
    """Begrenzte Bild-Uploads ohne temporäre Bilddateien auf der Festplatte."""

    def _get_file_stream(self, total_content_length, content_type, filename=None, content_length=None):
        return BytesIO()


def create_app():
    app = Flask(__name__)
    app.request_class = MemoryRequest
    app.config.update(MAX_CONTENT_LENGTH=21 * 1024 * 1024,
                      # Multipart benötigt zusätzlich Platz für den Rand zweier
                      # 64-KiB-Leseblöcke, auch wenn die Datei separat gestreamt wird.
                      MAX_FORM_MEMORY_SIZE=128 * 1024, MAX_FORM_PARTS=4)

    @app.errorhandler(ImageError)
    def image_error(error):
        return jsonify(error=str(error)), 400

    @app.errorhandler(413)
    def too_large(error):
        return jsonify(error='Die Anfrage ist zu groß. Bilder dürfen höchstens 20 MiB groß sein.'), 413

    @app.before_request
    def check_image_request():
        if request.path.startswith('/api/'):
            # Ohne Cookies/gespeicherte Jobs: Custom-Header verhindert einfache
            # fremde Formular-POSTs; es werden keine CORS-Freigaben erteilt.
            origin = request.headers.get('Origin')
            try:
                origin_host = urlsplit(origin).netloc if origin else None
            except ValueError:
                origin_host = ''
            if (request.headers.get('X-RasterPilot-Request') != '1' or
                    (origin and origin_host != request.host)):
                return jsonify(error='Bitte die Bildverarbeitung direkt über RasterPilot starten.'), 403

    @app.after_request
    def private_results(response):
        if request.path.startswith('/api/'):
            response.headers['Cache-Control'] = 'no-store'
            response.headers['X-Content-Type-Options'] = 'nosniff'
        return response

    @app.get("/")
    def index():
        return render_template("index.html", version=__version__)

    @app.get("/health")
    def health():
        return jsonify(status="ok", version=__version__)

    def uploaded_image():
        file = request.files.get('image')
        if file is None:
            raise ImageError('Bitte eine PNG- oder JPEG-Datei auswählen.')
        return load_image(file.stream)

    @app.post('/api/prepare')
    def prepare():
        image, notes = uploaded_image()
        with image:
            data = prepare_preview(image)
            response = send_file(data, mimetype='image/png')
            response.headers['X-Image-Width'] = str(image.width)
            response.headers['X-Image-Height'] = str(image.height)
            response.headers['X-Image-Notes'] = json.dumps(notes, ensure_ascii=True)
            return response

    @app.post('/api/render')
    def render():
        try:
            values = json.loads(request.form.get('parameters', ''))
        except (ValueError, TypeError) as error:
            raise ImageError('Die Rastereinstellungen sind ungültig.') from error
        image, _ = uploaded_image()
        with image:
            parameters = Parameters.from_dict(values, image.size)
            data = render_png(image, parameters)
            width, height = parameters.output_size()
        filename = export_filename(request.files['image'].filename, parameters)
        response = send_file(data, mimetype='image/png', as_attachment=True, download_name=filename)
        # ASCII-Header; der Browser übernimmt exakt denselben Unicode-Dateinamen.
        response.headers['X-Download-Name'] = quote(filename, safe='')
        response.headers['X-Image-Width'] = str(width)
        response.headers['X-Image-Height'] = str(height)
        return response

    return app
