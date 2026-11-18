"""RasterPilot web application."""

from flask import Flask, jsonify, render_template

from .version import __version__


def create_app():
    app = Flask(__name__)

    @app.get("/")
    def index():
        return render_template("index.html", version=__version__)

    @app.get("/health")
    def health():
        return jsonify(status="ok", version=__version__)

    return app
