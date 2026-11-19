#!/bin/sh
# RasterPilot auf einem frischen Debian-13-System installieren.
set -eu

REPO_URL=${RASTERPILOT_REPO_URL:-https://github.com/know-how-schmiede/RasterPilot.git}
BASE=/opt/rasterpilot

if [ "$(id -u)" -ne 0 ]; then
    echo 'Bitte das Installationsskript als root ausführen. Mit su - zur root-Shell wechseln und sh /tmp/rasterpilot-install.sh starten.' >&2
    exit 1
fi
if [ -e "$BASE/current" ] || [ -L "$BASE/current" ]; then
    echo 'RasterPilot ist bereits installiert. Bitte rasterpilot-update ausführen.' >&2
    exit 1
fi
if [ ! -f /etc/debian_version ] || [ "$(. /etc/os-release; echo "$ID:$VERSION_ID")" != debian:13 ]; then
    echo 'Dieses Skript unterstützt Debian 13.' >&2
    exit 1
fi

export DEBIAN_FRONTEND=noninteractive
apt-get update
apt-get install -y sudo git python3 python3-venv nginx curl ca-certificates
if ! id rasterpilot >/dev/null 2>&1; then
    useradd --system --home-dir /var/lib/rasterpilot --create-home --shell /usr/sbin/nologin rasterpilot
fi
install -d -m 755 "$BASE/releases" /var/lib/rasterpilot
chown rasterpilot:rasterpilot /var/lib/rasterpilot
install -d -m 700 /var/lib/rasterpilot/jobs
chown rasterpilot:rasterpilot /var/lib/rasterpilot/jobs
release=$(mktemp -d "$BASE/releases/release.XXXXXXXX")
cleanup() { if [ -n "$release" ]; then rm -rf "$release"; fi; }
trap cleanup EXIT HUP INT TERM
chmod 755 "$release"
git clone --depth 1 "$REPO_URL" "$release/source"
python3 -m venv "$release/venv"
"$release/venv/bin/pip" install "$release/source" 'gunicorn>=23,<24'
runuser -u rasterpilot -- env RASTERPILOT_DATA_DIR=/var/lib/rasterpilot/jobs "$release/venv/bin/python" -c 'from rasterpilot import create_app; assert create_app().test_client().get("/health").status_code == 200'
ln -s "$release" "$BASE/current"
release=''
install -m 755 "$BASE/current/source/scripts/update.sh" /usr/local/bin/rasterpilot-update
cat > /etc/systemd/system/rasterpilot.service <<'SERVICE'
[Unit]
Description=RasterPilot Webanwendung
After=network.target

[Service]
User=rasterpilot
Group=rasterpilot
WorkingDirectory=/var/lib/rasterpilot
ExecStart=/opt/rasterpilot/current/venv/bin/gunicorn --bind 127.0.0.1:8000 --workers 2 'rasterpilot:create_app()'
Restart=on-failure

[Install]
WantedBy=multi-user.target
SERVICE
sh "$BASE/current/source/scripts/configure_services.sh"
cat > /etc/nginx/sites-available/rasterpilot <<'NGINX'
server {
    listen 80 default_server;
    listen [::]:80 default_server;
    server_name _;
    client_max_body_size 21m;
    # Uploads werden begrenzt angenommen; die Warteschlange verwaltet temporäre Dateien.
    # Auch Nginx soll Uploads nicht zusätzlich auf Platte puffern.
    proxy_request_buffering off;
    proxy_buffering off;
    proxy_http_version 1.1;
    location / {
        proxy_pass http://127.0.0.1:8000;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
NGINX
rm -f /etc/nginx/sites-enabled/default
ln -sf /etc/nginx/sites-available/rasterpilot /etc/nginx/sites-enabled/rasterpilot
nginx -t
systemctl daemon-reload
systemctl enable --now rasterpilot-worker rasterpilot
systemctl enable nginx
systemctl restart nginx
if ! curl --retry 5 --retry-delay 1 --retry-connrefused --retry-all-errors --fail --silent --show-error http://127.0.0.1:8000/ready >/dev/null; then
    echo 'RasterPilot konnte nicht gestartet werden. Bitte systemctl status rasterpilot und journalctl -u rasterpilot -n 50 --no-pager prüfen.' >&2
    exit 1
fi
curl --fail --silent --show-error http://127.0.0.1/health >/dev/null
printf '\nRasterPilot ist installiert. Öffnen Sie http://<IP-Adresse-des-Servers>/ im Browser.\n'
printf 'Die IP-Adresse finden Sie mit: hostname -I\n'
