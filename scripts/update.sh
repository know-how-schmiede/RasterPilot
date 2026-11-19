#!/bin/sh
# Aktualisiert RasterPilot und stellt bei einem fehlgeschlagenen Start die alte Version wieder her.
set -eu
BASE=/opt/rasterpilot
REPO_URL=${RASTERPILOT_REPO_URL:-https://github.com/know-how-schmiede/RasterPilot.git}
if [ "$(id -u)" -ne 0 ]; then
    echo 'Bitte das Update als root ausführen. Mit su - zur root-Shell wechseln und /usr/local/bin/rasterpilot-update starten.' >&2
    exit 1
fi
if [ ! -x "$BASE/current/venv/bin/gunicorn" ]; then
    echo 'Keine RasterPilot-Installation gefunden. Bitte zuerst installieren.' >&2
    exit 1
fi
if ! command -v sudo >/dev/null 2>&1; then
    echo 'sudo ist noch nicht installiert und wird nachinstalliert. Das Update läuft als root weiter.'
    export DEBIAN_FRONTEND=noninteractive
    apt-get update
    apt-get install -y sudo
fi
old=$(readlink -f "$BASE/current")
release=$(mktemp -d "$BASE/releases/release.XXXXXXXX")
switching=no
old_worker=no
cleanup() {
    status=$?
    trap - EXIT HUP INT TERM
    if [ "$switching" = yes ]; then
        echo 'Das Update konnte nicht gestartet werden; die vorherige Version wird wiederhergestellt.' >&2
        systemctl stop rasterpilot-worker rasterpilot || true
        rm -f "$BASE/current.new"
        ln -s "$old" "$BASE/current.new"
        mv -Tf "$BASE/current.new" "$BASE/current"
        if [ "$old_worker" = yes ]; then
            systemctl restart rasterpilot-worker || echo 'Der Hintergrunddienst konnte nicht wiederhergestellt werden.' >&2
        else
            systemctl disable rasterpilot-worker || true
        fi
        systemctl restart rasterpilot || echo 'Der Webdienst konnte nicht wiederhergestellt werden.' >&2
    fi
    if [ -n "$release" ]; then rm -rf "$release"; fi
    exit "$status"
}
trap cleanup EXIT
trap 'exit 130' INT
trap 'exit 143' HUP TERM
chmod 755 "$release"
git clone --depth 1 "$REPO_URL" "$release/source"
python3 -m venv "$release/venv"
"$release/venv/bin/pip" install "$release/source" 'gunicorn>=23,<24'
install -d -m 700 /var/lib/rasterpilot/jobs
chown rasterpilot:rasterpilot /var/lib/rasterpilot/jobs
runuser -u rasterpilot -- env RASTERPILOT_DATA_DIR=/var/lib/rasterpilot/jobs "$release/venv/bin/python" -c 'from rasterpilot import create_app; assert create_app().test_client().get("/health").status_code == 200'
if systemctl cat rasterpilot-worker >/dev/null 2>&1; then
    if [ -f "$old/source/rasterpilot/worker.py" ]; then old_worker=yes; fi
fi
switching=yes
if systemctl cat rasterpilot-worker >/dev/null 2>&1; then systemctl stop rasterpilot-worker; fi
systemctl stop rasterpilot
sh "$release/source/scripts/configure_services.sh"
ln -s "$release" "$BASE/current.new"
mv -Tf "$BASE/current.new" "$BASE/current"
if ! systemctl restart rasterpilot-worker rasterpilot || ! curl --retry 5 --retry-delay 1 --retry-connrefused --retry-all-errors --fail --silent --show-error http://127.0.0.1:8000/ready >/dev/null; then
    exit 1
fi
install -m 755 "$release/source/scripts/update.sh" /usr/local/bin/rasterpilot-update
switching=no
release=''
echo 'RasterPilot wurde aktualisiert. Die vorherige Version bleibt unter /opt/rasterpilot/releases erhalten.'
