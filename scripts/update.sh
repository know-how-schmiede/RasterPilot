#!/bin/sh
# Aktualisiert RasterPilot und stellt bei einem fehlgeschlagenen Start die alte Version wieder her.
set -eu
BASE=/opt/rasterpilot
REPO_URL=${RASTERPILOT_REPO_URL:-https://github.com/know-how-schmiede/RasterPilot.git}
if [ "$(id -u)" -ne 0 ]; then
    echo 'Bitte das Update mit sudo rasterpilot-update oder als root ausführen.' >&2
    exit 1
fi
if [ ! -x "$BASE/current/venv/bin/gunicorn" ]; then
    echo 'Keine RasterPilot-Installation gefunden. Bitte zuerst installieren.' >&2
    exit 1
fi
old=$(readlink -f "$BASE/current")
release=$(mktemp -d "$BASE/releases/release.XXXXXXXX")
cleanup() { if [ -n "$release" ]; then rm -rf "$release"; fi; }
trap cleanup EXIT HUP INT TERM
git clone --depth 1 "$REPO_URL" "$release/source"
python3 -m venv "$release/venv"
"$release/venv/bin/pip" install "$release/source" 'gunicorn>=23,<24'
"$release/venv/bin/python" -c 'from rasterpilot import create_app; assert create_app().test_client().get("/health").status_code == 200'
ln -s "$release" "$BASE/current.new"
mv -Tf "$BASE/current.new" "$BASE/current"
if ! systemctl restart rasterpilot || ! curl --retry 5 --retry-delay 1 --retry-connrefused --fail --silent --show-error http://127.0.0.1:8000/health >/dev/null; then
    echo 'Das Update konnte nicht gestartet werden; die vorherige Version wird wiederhergestellt.' >&2
    ln -s "$old" "$BASE/current.new"
    mv -Tf "$BASE/current.new" "$BASE/current"
    systemctl restart rasterpilot || echo 'Der Dienst konnte nicht wiederhergestellt werden. Bitte systemctl status rasterpilot prüfen.' >&2
    exit 1
fi
install -m 755 "$release/source/scripts/update.sh" /usr/local/bin/rasterpilot-update
release=''
echo 'RasterPilot wurde aktualisiert. Die vorherige Version bleibt unter /opt/rasterpilot/releases erhalten.'
