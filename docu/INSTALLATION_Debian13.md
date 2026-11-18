# RasterPilot unter Debian 13 installieren

Diese Anleitung richtet sich an Einsteiger und verwendet einen eigenen, frisch installierten Debian-13-Rechner oder einen unprivilegierten Debian-13-LXC unter Proxmox. RasterPilot ist derzeit eine Vorschau; Rasterung und Export sind noch nicht verfügbar. Das Skript richtet Python, Gunicorn, Nginx und einen automatisch startenden Dienst ein. Eine lokale Kopie des GitHub-Repositories ist nicht erforderlich.

## Voraussetzungen

- Debian 13 mit Internetzugang und mindestens 2 CPU-Kernen sowie 4 GB RAM als vorläufige Empfehlung.
- Zugang zur Konsole als `root` oder als Benutzer mit `sudo`-Rechten. Im Proxmox-LXC kann die Konsole über die Proxmox-Oberfläche geöffnet werden.
- Ein eigenes System für RasterPilot: Das Skript ersetzt die aktivierte Nginx-Standardseite und belegt Port 80. Es ist nicht für einen bereits anderweitig eingerichteten Webserver gedacht.
- Das GitHub-Repository muss öffentlich sein. Für die Python-Pakete wird ebenfalls Internetzugang benötigt.

Die folgenden Befehle sind für `root` geschrieben. Als anderer Benutzer jedem Befehl `sudo` voranstellen. Jede Zeile einzeln ausführen; eine Passwortabfrage bei `sudo` ist normal.

## Installation

Zunächst das Werkzeug zum Herunterladen installieren:

```sh
apt update
apt install -y curl ca-certificates
```

Das Installationsskript herunterladen und ausführen:

```sh
curl -fL https://raw.githubusercontent.com/know-how-schmiede/RasterPilot/main/scripts/install.sh -o /tmp/rasterpilot-install.sh
sh /tmp/rasterpilot-install.sh
```

Bei einem Benutzer mit `sudo` lautet die letzte Zeile `sudo sh /tmp/rasterpilot-install.sh`. Die Installation kann einige Minuten dauern. Sie verwendet den aktuellen Stand des Standard-Branches des öffentlichen Repositories. Bei einer Fehlermeldung den angezeigten Fehler beheben und das Skript erneut ausführen; meldet es eine bestehende Installation, siehe Fehlerbehebung.

Die Serveradresse anzeigen:

```sh
hostname -I
```

Auf einem anderen Gerät im selben Netzwerk `http://SERVER-IP/` im Browser öffnen, zum Beispiel `http://192.168.1.20/`. Falls mehrere Adressen angezeigt werden, die im lokalen Netzwerk erreichbare Adresse verwenden. Port 80 muss gegebenenfalls in der Firewall freigegeben sein.

**Zugriff:** Die aktuelle Vorschau besitzt keine Anmeldung und kein HTTPS. Alle Personen mit Netzwerkzugriff können die Anwendung aufrufen. Nur in einem vertrauenswürdigen Netzwerk betreiben und nicht direkt ins Internet freigeben.

## Update

Auf der Serverkonsole ausführen:

```sh
sudo rasterpilot-update
```

Als `root` entfällt `sudo`. Das Skript lädt den aktuellen Stand des Standard-Branches, installiert ihn in einer neuen Umgebung und startet den Dienst neu. Während des Neustarts ist die Anwendung kurz nicht erreichbar. Bei einem fehlgeschlagenen Start versucht das Skript, die vorherige Version wiederherzustellen. Alte Versionen bleiben unter `/opt/rasterpilot/releases` erhalten und belegen Speicherplatz. Das Update kann spätere Anpassungen an Nginx oder dem systemd-Dienst nicht automatisch übernehmen; Hinweise zu solchen Änderungen stehen gegebenenfalls in der jeweiligen Veröffentlichung.

## Status und Fehlerbehebung

```sh
systemctl status rasterpilot
journalctl -u rasterpilot -n 50 --no-pager
systemctl status nginx
```

Ist die Seite nicht erreichbar, zuerst Server-IP, Netzwerk und Firewall prüfen. Ein Fehler bei `apt` oder beim Herunterladen weist häufig auf fehlenden Internetzugang oder DNS hin. Bei einem Fehler nach bereits erfolgter Installation zunächst die obigen Statusmeldungen prüfen; ein erneutes Installationsskript überschreibt eine bestehende Installation nicht. Der Dienst lässt sich mit `systemctl restart rasterpilot` neu starten.

Die Anwendung liegt unter `/opt/rasterpilot`, der Dienst läuft als eigener Systembenutzer `rasterpilot`. Laufzeitdaten sind unter `/var/lib/rasterpilot` vorgesehen; aktuell gibt es noch keine gespeicherten Benutzerprojekte. Vor späteren Updates sollten dort vorhandene Daten und eigene Konfigurationen gesichert werden.
