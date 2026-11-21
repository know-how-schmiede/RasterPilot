"""RasterPilot web application."""

from io import BytesIO
from dataclasses import asdict
import hashlib
import json
import os
from pathlib import Path
import re
import secrets
from urllib.parse import quote, urlsplit

from flask import Flask, Request, jsonify, render_template, request, send_file, session

from .processing import ImageError, Parameters, load_image, prepare_preview

from .version import __version__
from .jobs import JobStore, QueueFull, shared_secret


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


def create_app(config=None):
    app = Flask(__name__)
    app.request_class = MemoryRequest
    app.config.update(MAX_CONTENT_LENGTH=21 * 1024 * 1024,
                      # Multipart benötigt zusätzlich Platz für den Rand zweier
                      # 64-KiB-Leseblöcke, auch wenn die Datei separat gestreamt wird.
                      MAX_FORM_MEMORY_SIZE=128 * 1024, MAX_FORM_PARTS=4,
                      DATA_DIR=os.environ.get('RASTERPILOT_DATA_DIR') or str(Path.cwd() / 'instance' / 'jobs'),
                      SESSION_COOKIE_HTTPONLY=True, SESSION_COOKIE_SAMESITE='Strict',
                      SESSION_COOKIE_SECURE=os.environ.get('RASTERPILOT_COOKIE_SECURE') == '1')
    if config:
        app.config.update(config)
    jobs = JobStore.configured(app.config['DATA_DIR'])
    app.extensions['jobs'] = jobs
    app.secret_key = app.config.get('SECRET_KEY') or shared_secret(jobs.root)

    @app.errorhandler(ImageError)
    def image_error(error):
        return jsonify(error=str(error)), 400

    @app.errorhandler(413)
    def too_large(error):
        return jsonify(error='Die Anfrage ist zu groß. Bilder dürfen höchstens 20 MiB groß sein.'), 413

    @app.errorhandler(QueueFull)
    def queue_full(error):
        return jsonify(error=str(error)), 429

    @app.before_request
    def check_image_request():
        if request.path.startswith('/api/'):
            # Custom-Header und Origin-Prüfung schützen auch sitzungsgebundene
            # Aufträge gegen fremde Formularanfragen; keine CORS-Freigaben.
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
        if request.path.startswith('/api/') or request.path in ('/', '/ready'):
            response.headers['Cache-Control'] = 'no-store'
            response.headers['X-Content-Type-Options'] = 'nosniff'
        return response

    @app.get("/")
    def index():
        owner()
        return render_template("index.html", version=__version__, retention_minutes=f'{jobs.ttl / 60:g}')

    @app.get("/health")
    def health():
        return jsonify(status="ok", version=__version__)

    @app.get('/ready')
    def ready():
        available = jobs.available()
        return jsonify(status='ok' if available else 'worker_unavailable', version=__version__), 200 if available else 503

    def uploaded_image():
        file = request.files.get('image')
        if file is None:
            raise ImageError('Bitte eine PNG- oder JPEG-Datei auswählen.')
        return load_image(file.stream)

    def owner():
        if 'owner' not in session:
            session['owner'] = secrets.token_urlsafe(32)
        return hashlib.sha256(session['owner'].encode()).hexdigest()

    def owned_job(job_id):
        return jobs.get(job_id, owner())

    def job_response(job):
        return jsonify(id=job['id'], state=job['state'], error=job['error'],
                       original_name=job['original_name'] or 'Früherer Auftrag',
                       filename=job['filename'], width=job['width'], height=job['height'], worker_ready=jobs.available())

    @app.get('/api/jobs')
    def job_list():
        rows, active, running = jobs.listing(owner())
        return jsonify(jobs=[dict(id=row['id'], state=row['state'], error=row['error'],
                                 original_name=row['original_name'] or 'Früherer Auftrag',
                                 filename=row['filename'], width=row['width'], height=row['height'],
                                 position=row['position'], created=row['created'], expires_at=row['expires_at'])
                             for row in rows],
                       active=active, running=running, capacity=jobs.capacity,
                       worker_ready=jobs.available())

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
    @app.post('/api/jobs')
    def render():
        try:
            values = json.loads(request.form.get('parameters', ''))
        except (ValueError, TypeError) as error:
            raise ImageError('Die Rastereinstellungen sind ungültig.') from error
        image, _ = uploaded_image()
        with image:
            parameters = Parameters.from_dict(values, image.size)
            width, height = parameters.output_size()
        if not jobs.available():
            return jsonify(error='Der Hintergrunddienst ist nicht bereit. Bitte den RasterPilot-Worker starten oder den Dienststatus prüfen.'), 503
        filename = export_filename(request.files['image'].filename, parameters)
        original_name = re.split(r'[/\\]', request.files['image'].filename or '')[-1]
        original_name = re.sub(r'[\x00-\x1f\x7f]', '', original_name)[:255] or 'motiv'
        request.files['image'].stream.seek(0)
        job = jobs.enqueue(owner(), request.files['image'].stream.read(), json.dumps(asdict(parameters)),
                           filename, (width, height), original_name=original_name)
        return job_response(job), 202

    @app.get('/api/jobs/<job_id>')
    def status(job_id):
        job = owned_job(job_id)
        if not job:
            return jsonify(error='Der Auftrag ist abgelaufen oder nicht verfügbar.'), 404
        return job_response(job)

    @app.delete('/api/jobs/<job_id>')
    def cancel(job_id):
        job = owned_job(job_id)
        if not job:
            return jsonify(error='Der Auftrag ist abgelaufen oder nicht verfügbar.'), 404
        jobs.cancel(job_id, owner())
        return jsonify(state='cancelled')

    @app.get('/api/jobs/<job_id>/result')
    def result(job_id):
        job = owned_job(job_id)
        if not job:
            return jsonify(error='Der Auftrag ist abgelaufen oder nicht verfügbar.'), 404
        if job['state'] != 'done':
            return jsonify(error=job['error'] or 'Der Auftrag ist noch nicht fertig.'), 409
        try:
            response = send_file(jobs.path(job['id'], '.png'), mimetype='image/png', as_attachment=True,
                                 download_name=job['filename'], conditional=False)
        except FileNotFoundError:
            return jsonify(error='Das Ergebnis ist abgelaufen. Bitte erneut berechnen.'), 404
        # ASCII-Header; der Browser übernimmt exakt denselben Unicode-Dateinamen.
        response.headers['X-Download-Name'] = quote(job['filename'], safe='')
        response.headers['X-Image-Width'] = str(job['width'])
        response.headers['X-Image-Height'] = str(job['height'])
        return response

    return app
