#!/bin/sh
# Gemeinsame Worker-Einrichtung für Installation und Update, als root.
set -eu
SYSTEM_ROOT=${RASTERPILOT_SYSTEM_ROOT:-}
install -d -m 700 "$SYSTEM_ROOT/var/lib/rasterpilot/jobs"
chown rasterpilot:rasterpilot "$SYSTEM_ROOT/var/lib/rasterpilot/jobs"
install -d -m 755 "$SYSTEM_ROOT/etc/systemd/system/rasterpilot.service.d"
cat > "$SYSTEM_ROOT/etc/systemd/system/rasterpilot.service.d/worker.conf" <<'CONFIG'
[Service]
Environment=RASTERPILOT_DATA_DIR=/var/lib/rasterpilot/jobs
EnvironmentFile=-/etc/rasterpilot/environment
UMask=0077
CONFIG
cat > "$SYSTEM_ROOT/etc/systemd/system/rasterpilot-worker.service" <<'SERVICE'
[Unit]
Description=RasterPilot Hintergrundverarbeitung
After=network.target

[Service]
User=rasterpilot
Group=rasterpilot
WorkingDirectory=/var/lib/rasterpilot
Environment=RASTERPILOT_DATA_DIR=/var/lib/rasterpilot/jobs
EnvironmentFile=-/etc/rasterpilot/environment
ExecStart=/opt/rasterpilot/current/venv/bin/python -m rasterpilot.worker
Restart=on-failure
KillMode=control-group
TimeoutStopSec=10
UMask=0077
NoNewPrivileges=true
PrivateTmp=true

[Install]
WantedBy=multi-user.target
SERVICE
systemctl daemon-reload
systemctl enable rasterpilot-worker
