# RasterPilot unter Debian 13 installieren

Diese Anleitung richtet sich an Einsteiger und verwendet einen eigenen, frisch installierten Debian-13-Rechner oder einen unprivilegierten Debian-13-LXC unter Proxmox. RasterPilot bietet experimentelle farbige Rasterung und PNG-Export; Druckprofile sind noch nicht kalibriert. Das Skript richtet Python, Gunicorn, Nginx und automatisch startende Dienste für Web und Hintergrundverarbeitung ein. Eine lokale Kopie des GitHub-Repositories ist nicht erforderlich.

## Voraussetzungen

- Debian 13 mit Internetzugang und mindestens 2 CPU-Kernen sowie 4 GB RAM als vorläufige Empfehlung. Zusätzlich zur Anwendung und den Releases bis zu 1 GiB freien Speicher für temporäre Bilddaten einplanen.
- Zugang zur Konsole als `root` oder die Möglichkeit, mit `su -` und dem root-Passwort zur root-Shell zu wechseln. Im Proxmox-LXC kann die Konsole über die Proxmox-Oberfläche geöffnet werden. Ein bereits eingerichteter Benutzer mit installiertem `sudo` und passenden Rechten kann es alternativ verwenden.
- Ein eigenes System für RasterPilot: Das Skript ersetzt die aktivierte Nginx-Standardseite und belegt Port 80. Es ist nicht für einen bereits anderweitig eingerichteten Webserver gedacht.
- Das GitHub-Repository muss für diesen Installationsweg öffentlich sein. Prüfen lässt sich das durch Öffnen von `https://github.com/know-how-schmiede/RasterPilot` in einem privaten Browserfenster ohne GitHub-Anmeldung. Für die Python-Pakete wird ebenfalls Internetzugang benötigt.

Das Skript installiert Flask, Pillow (ab 12.2, kleiner 13) und NumPy (ab 2.2, kleiner 3) in der eigenen Python-Umgebung. Auf dem Debian-System wird Python 3.13 verwendet; lokal ist Python ab 3.11 unterstützt. Der Anwender hat Neuinstallation, Bildimport und Rasterung im Debian-LXC als funktionierend bestätigt. Automatisierte Verarbeitungstests laufen zusätzlich unter Windows/Python 3.12; eine vollständige Debian-13-Prüfung und eine Speichermessung unter paralleler Last im 4-GB-LXC stehen noch aus.

Die folgenden Befehle sind für `root` geschrieben und benötigen beim Aufruf kein `sudo`. Bei einer Konsole wie `root@RasterPilot:~#` bereits direkt fortfahren. Als anderer Benutzer zuerst `su -` ausführen und das root-Passwort eingeben. Jeden Befehlsblock vollständig kopieren und ausführen.

## Installation

Zunächst das Werkzeug zum Herunterladen installieren:

```sh
apt update
apt install -y curl ca-certificates
```

Das Installationsskript herunterladen und ausführen:

```sh
curl -fL https://raw.githubusercontent.com/know-how-schmiede/RasterPilot/main/scripts/install.sh -o /tmp/rasterpilot-install.sh &&
sh /tmp/rasterpilot-install.sh
```

Das `&&` führt das Skript nur aus, wenn der Download erfolgreich war. Das Installationsskript installiert `sudo` zusammen mit den übrigen Systempaketen; beim ersten Aufruf muss es deshalb noch nicht vorhanden sein. Die Installation kann einige Minuten dauern. Sie verwendet den aktuellen Stand des Standard-Branches des öffentlichen Repositories. Bei einer Fehlermeldung den angezeigten Fehler beheben und das Skript erneut ausführen; meldet es eine bestehende Installation, siehe Fehlerbehebung.

Optional kann ein bereits berechtigter Benutzer mit vorhandenem `sudo` die letzte Zeile als `sudo sh /tmp/rasterpilot-install.sh` ausführen. Die Installation des Pakets richtet keine neuen sudo-Berechtigungen ein.

Die Serveradresse anzeigen:

```sh
hostname -I
```

Auf einem anderen Gerät im selben Netzwerk `http://SERVER-IP/` im Browser öffnen, zum Beispiel `http://192.168.1.20/`. Falls mehrere Adressen angezeigt werden, die im lokalen Netzwerk erreichbare Adresse verwenden. Port 80 muss gegebenenfalls in der Firewall freigegeben sein.

**Zugriff:** Die aktuelle Vorschau besitzt keine Anmeldung und kein HTTPS. Alle Personen mit Netzwerkzugriff können die Anwendung aufrufen. Nur in einem vertrauenswürdigen Netzwerk betreiben und nicht direkt ins Internet freigeben.

## Update

Auf der Serverkonsole als root ausführen:

```sh
/usr/local/bin/rasterpilot-update
```

Fehlt `sudo`, installiert die aktuelle Skriptversion das Paket zunächst über `apt-get` nach. Dafür benötigt sie ebenfalls root-Rechte. Bei einem Paketfehler bricht sie vor dem Anlegen oder Aktivieren einer neuen Anwendungsversion ab. Ein bereits berechtigter Benutzer mit installiertem `sudo` kann alternativ `sudo /usr/local/bin/rasterpilot-update` verwenden. Das Paket allein verleiht einem Benutzer keine sudo-Rechte.

Das aktuelle Updateskript lädt den Standard-Branch und bereitet die neue Umgebung vor. Ab 0.4.0 beendet es Web und Worker vor dem Umschalten, aktualisiert den app-eigenen Worker-Dienst sowie ein Web-Drop-in und startet beide gemeinsam. `/ready` prüft anschließend auch den Worker. Bei einem Fehler ab dem Stoppen versucht das Skript, die vorherige Version samt zuvor vorhandenem Worker wiederherzustellen; bei einer Rückkehr auf einen Stand ohne Worker wird dieser deaktiviert. Eigene Dienst-Drop-ins, `/etc/rasterpilot/environment` und Nginx bleiben erhalten. Laufende Aufträge werden unterbrochen und müssen erneut gestartet werden. Frühere Versionen bleiben unter `/opt/rasterpilot/releases` erhalten. Für den ersten Wechsel von einer älteren Version unbedingt den Abschnitt „Update auf 0.4.0“ beachten.

### Meldung „sudo: command not found“

Diese Meldung entsteht bereits vor dem Start des Skripts. Als root den oben angegebenen Updatebefehl direkt ausführen. Als anderer Benutzer zunächst mit `su -` zur root-Shell wechseln. Eine separate Installation von `sudo` ist für diesen Aufruf nicht erforderlich.

Falls auf dem Server noch eine ältere Skriptversion liegt, nach Veröffentlichung der Korrektur zuerst den Updater erneuern und dann starten, jeweils als root:

```sh
curl -fL https://raw.githubusercontent.com/know-how-schmiede/RasterPilot/main/scripts/update.sh -o /tmp/rasterpilot-update.sh &&
install -m 755 /tmp/rasterpilot-update.sh /usr/local/bin/rasterpilot-update &&
/usr/local/bin/rasterpilot-update
```

### Bestehende Installation auf 0.2.0 umstellen

Sobald Version 0.2.0 auf GitHub veröffentlicht ist, zunächst `rasterpilot-update` ausführen. Ein bereits vor der Rechtekorrektur installiertes Updateskript muss vorher wie unten im Abschnitt zum 502-Fehler beschrieben ersetzt werden.

Ab 0.2.0 werden Bilder an den eigenen Server übertragen. Dateien dürfen 20 MiB und 40 Megapixel nicht überschreiten; Ausgaben sind seit 0.2.2 auf 40 Megapixel/12000 Pixel je Kante begrenzt. Ab 0.4.0 liegen Originale und Ergebnisse zeitlich begrenzt im privaten Auftragsverzeichnis, und ein eigener Worker übernimmt die Berechnung. Bei Installationen von vor 0.2.0 muss Nginx für den Bildtransfer ebenfalls wie nachfolgend angepasst werden; das Update verändert Nginx weiterhin nicht.

Bei einer bestehenden Installation als root die Konfiguration sichern und öffnen:

```sh
cp -an /etc/nginx/sites-available/rasterpilot /etc/nginx/sites-available/rasterpilot.vor-0.2.0
nano /etc/nginx/sites-available/rasterpilot
```

Im `server { ... }`-Block vor `location / { ... }` diese Direktiven ergänzen. Falls eine bereits vorhanden ist, ihren Wert entsprechend ändern; jede Direktive dort nur einmal angeben:

```nginx
client_max_body_size 21m;
proxy_request_buffering off;
proxy_buffering off;
proxy_http_version 1.1;
```

`21m` lässt Platz für die Formulardaten zusätzlich zum 20-MiB-Bildlimit; die Anwendung prüft das Bildlimit separat. Die deaktivierte Anfrage-/Antwortpufferung vermeidet das Zwischenspeichern von Bilddaten in Nginx-Temporärdateien. Anschließend Konfiguration prüfen und nur bei erfolgreicher Prüfung neu laden:

```sh
nginx -t && systemctl reload nginx
```

Neue Installationen über das aktuelle Installationsskript enthalten diese Einstellungen bereits. Danach die Browserseite neu laden, ein PNG/JPEG importieren, Raster berechnen und Download sowie 100-%-Ansicht prüfen. Eine Datei über 1 MiB zusätzlich testen, um das frühere Nginx-Standardlimit auszuschließen. Eine lokal erzeugte, reproduzierbare Laufzeit-/Speichermessung ist mit `/opt/rasterpilot/current/venv/bin/python /opt/rasterpilot/current/source/scripts/benchmark_processing.py` möglich; das Skript verwendet ausschließlich synthetische Bilddaten.

### Update auf 0.2.2: Midjourney-Hochformate

Die bisherige Exportgrenze konnte ein bereits erfolgreich importiertes Bild mit der Vorgabe von 28 cm Breite und 300 ppi blockieren. Version 0.2.2 erhöht sie von 12 auf 40 Megapixel. Die drei bereitgestellten Originale mit je 1904 × 2544 Pixeln ergeben 3307 × 4419 Ausgabepixel und funktionieren damit ohne vorheriges Verkleinern.

Nach Veröffentlichung als root `/usr/local/bin/rasterpilot-update` ausführen und die Browserseite vollständig neu laden, etwa mit Strg+F5. Wer die aktuelle Nginx-Konfiguration bereits verwendet oder ab 0.2.0 neu installiert hat, benötigt keine erneute Nginx-Anpassung und keine Neuinstallation. Uploadgrenzen und HTTP-Zeitlimits bleiben unverändert.

Ein synthetischer Test nahe der neuen Exportgrenze ist möglich mit:

```sh
/opt/rasterpilot/current/venv/bin/python /opt/rasterpilot/current/source/scripts/benchmark_processing.py --width-cm 53.44
```

`--source-side 6000 --pattern gradient` prüft zusätzlich ein großes dekodiertes Original. Den Test bei freiem System ausführen, um eine einzelne Berechnung zu messen. Lokale Windows-Messungen stehen in der [Architektur](ARCHITEKTUR.md); sie ersetzen keinen parallelen Lasttest im LXC.

## Update auf 0.4.0: Hintergrundverarbeitung

Für den Wechsel von einer älteren Version muss zuerst der Updater erneuert werden: Ein alter Updater richtet den neuen Hintergrunddienst nicht ein. Nach Veröffentlichung der Version auf GitHub als root ausführen:

```sh
curl -fL https://raw.githubusercontent.com/know-how-schmiede/RasterPilot/main/scripts/update.sh -o /tmp/rasterpilot-update.sh &&
install -m 755 /tmp/rasterpilot-update.sh /usr/local/bin/rasterpilot-update &&
/usr/local/bin/rasterpilot-update
```

Eine Neuinstallation ist nicht erforderlich. Der aktualisierte Updater richtet `rasterpilot-worker.service` und `/etc/systemd/system/rasterpilot.service.d/worker.conf` ein. Eigene Drop-ins bleiben erhalten; den app-eigenen Worker-Dienst und `worker.conf` nicht direkt bearbeiten. Beide Dienste verwenden `/var/lib/rasterpilot/jobs`. Bestehende Nginx-Einstellungen ab 0.2.0 bleiben gültig. Während der Umstellung werden laufende Berechnungen beendet. Danach die Browserseite mit Strg+F5 vollständig neu laden.

Web und Hintergrunddienst kontrollieren:

```sh
systemctl status rasterpilot rasterpilot-worker --no-pager -l
curl --fail --show-error http://127.0.0.1:8000/ready
journalctl -u rasterpilot -u rasterpilot-worker -n 50 --no-pager
```

`/health` prüft weiterhin nur den Webstart. `/ready` muss HTTP 200 mit `status: ok` liefern; HTTP 503 bedeutet einen fehlenden oder nicht mehr aktuellen Worker-Heartbeat. „Hintergrunddienst nicht bereit“ im Browser: zunächst `systemctl restart rasterpilot-worker` und das Protokoll prüfen. Nach einem Worker-Neustart werden unterbrochene laufende Aufträge als fehlgeschlagen gemeldet; wartende Aufträge können weiterverarbeitet werden.

Standardgrenzen: ein rechnender Auftrag, höchstens vier aktive/wartende und acht gespeicherte Aufträge, 1 GiB reservierter temporärer Bildspeicher, eine Stunde Aufbewahrung und 180 Sekunden je Berechnung. Zusätzlich zu Anwendung und Releases entsprechend freien Speicherplatz für die temporären Daten vorsehen. Abgelaufene Dateien werden nur bei laufendem Worker bereinigt. Die Höchstzahl gilt über alle Zugänge; je Browserprofil ist nur ein aktiver Auftrag erlaubt. Alle bisherigen Upload- und Ausgabegrenzen gelten weiter. Sitzungscookies trennen Aufträge verschiedener Browserzugänge, ersetzen aber keine Benutzeranmeldung; weiterhin nur im vertrauenswürdigen Netz betreiben.

Optionale Einstellungen können in `/etc/rasterpilot/environment` liegen. Das Verzeichnis und die Datei selbst als root anlegen und nur für root lesbar halten. Beispiel für kleinere Grenzen:

```ini
RASTERPILOT_QUEUE_LIMIT=2
RASTERPILOT_RETAINED_JOBS=4
RASTERPILOT_STORAGE_MIB=512
RASTERPILOT_JOB_TTL=3600
RASTERPILOT_JOB_TIMEOUT=180
```

Zulässige Bereiche: Warteschlange 1–4, gespeicherte Aufträge 1–8, Speicher 32–1024 MiB, Aufbewahrung 60–86400 Sekunden und Berechnungszeit 1–600 Sekunden. Kleine Speichergrenzen können große Ausgaben bereits bei der Annahme ausschließen. Bei eingerichtetem HTTPS zusätzlich `RASTERPILOT_COOKIE_SECURE=1` setzen; für den bisherigen HTTP-Zugang weglassen. Web und Worker anschließend gemeinsam mit `systemctl restart rasterpilot-worker rasterpilot` neu starten. Eigene Umgebungsdateien werden beim Update erhalten.

Diese Einrichtung und die Rückfallpfade sind lokal mit isolierten Systembefehlen getestet. Eine echte Neuinstallation/Umstellung auf Debian 13 sowie ein paralleler Lasttest im 4-GB-LXC stehen für 0.4.0 noch aus.

## Status und Fehlerbehebung

### Download meldet HTTP 404

`curl: (22) The requested URL returned error: 404` bedeutet, dass GitHub das Installationsskript unter der angegebenen Adresse nicht öffentlich bereitstellt. Bei einem privaten Repository liefert GitHub für anonyme Zugriffe ebenfalls 404. Die anschließende Meldung `cannot open /tmp/rasterpilot-install.sh` ist ein Folgefehler: Das Skript wurde nicht heruntergeladen und die Installation hat noch nicht begonnen.

1. `https://github.com/know-how-schmiede/RasterPilot` ohne GitHub-Anmeldung öffnen. Ist das Repository nur nach der Anmeldung sichtbar, muss der Eigentümer es für diesen Installationsweg öffentlich machen. In GitHub erfolgt dies unter **Settings → General → Danger Zone → Change repository visibility**. Vorher prüfen, dass die Veröffentlichung der Inhalte beabsichtigt ist.
2. Ist das Repository öffentlich erreichbar, auf dem Branch `main` prüfen, ob `scripts/install.sh` vorhanden ist. Lokale Änderungen müssen zuerst auf GitHub veröffentlicht werden. Bei einer Umbenennung von Eigentümer, Repository oder Branch muss die Downloadadresse entsprechend angepasst werden.
3. Danach den vollständigen Download- und Ausführungsblock aus dem Abschnitt „Installation“ erneut ausführen. Solange der Download fehlschlägt, `sh /tmp/rasterpilot-install.sh` nicht einzeln starten.

Ein privates Repository wird durch die aktuelle anonyme Download- und Installationsanleitung nicht unterstützt; auch das anschließende Klonen durch das Skript benötigt Zugriff auf das Repository.

### Nginx meldet „502 Bad Gateway“

Nginx ist erreichbar, erhält aber keine gültige Antwort von der Anwendung auf `127.0.0.1:8000`. Zuerst den Dienst und dessen Fehlermeldungen prüfen:

```sh
systemctl status rasterpilot --no-pager -l
journalctl -u rasterpilot -n 50 --no-pager
```

Bei Installationen mit der ursprünglichen Skriptversion kann das Versionsverzeichnis nur für root zugänglich sein (`700`). Dann kann der Benutzer `rasterpilot` Gunicorn nicht ausführen; das Dienstprotokoll kann `Permission denied` beziehungsweise `status=203/EXEC` enthalten. Als root lässt sich die aktive Version so korrigieren und neu starten:

```sh
chmod 755 "$(readlink -f /opt/rasterpilot/current)" &&
systemctl restart rasterpilot
curl --retry 5 --retry-delay 1 --retry-connrefused --fail --show-error http://127.0.0.1:8000/health
curl --fail --show-error http://127.0.0.1/health
```

Beide Abfragen sollen eine JSON-Antwort mit `"status":"ok"` liefern. Anschließend die Browserseite neu laden. Schlägt die direkte Abfrage auf Port 8000 weiter fehl, das Dienstprotokoll erneut prüfen. Funktioniert sie, aber die Abfrage über Port 80 scheitert, zusätzlich `nginx -t` und `tail -n 50 /var/log/nginx/error.log` prüfen.

Neue Installations- und Update-Skripte setzen das Versionsverzeichnis auf `755` und prüfen die Anwendung vor dem Aktivieren als Dienstbenutzer. Ein bereits installiertes `rasterpilot-update` enthält die Korrektur erst, wenn es ersetzt wurde. Sobald die korrigierte Skriptversion auf GitHub veröffentlicht ist, als root ausführen:

```sh
curl -fL https://raw.githubusercontent.com/know-how-schmiede/RasterPilot/main/scripts/update.sh -o /tmp/rasterpilot-update.sh &&
install -m 755 /tmp/rasterpilot-update.sh /usr/local/bin/rasterpilot-update
```

Danach verwenden künftige Aufrufe von `rasterpilot-update` das korrigierte Skript. Das Installationsskript muss zur Reparatur der bestehenden Installation nicht erneut ausgeführt werden.

### Dienst und Netzwerk prüfen

```sh
systemctl status rasterpilot
journalctl -u rasterpilot -n 50 --no-pager
systemctl status nginx
```

Ist die Seite nicht erreichbar, zuerst Server-IP, Netzwerk und Firewall prüfen. Ein Fehler bei `apt` oder beim Herunterladen weist häufig auf fehlenden Internetzugang oder DNS hin. Bei einem Fehler nach bereits erfolgter Installation zunächst die obigen Statusmeldungen prüfen; ein erneutes Installationsskript überschreibt eine bestehende Installation nicht. Der Dienst lässt sich mit `systemctl restart rasterpilot` neu starten.

Die Anwendung liegt unter `/opt/rasterpilot`, Web und Worker laufen als eigener Systembenutzer `rasterpilot`. Unter `/var/lib/rasterpilot/jobs` liegen SQLite-Auftragsstatus, temporäre Originale/Ergebnisse, Worker-Sperre und der gemeinsame Sitzungsschlüssel. Es gibt keine dauerhaften Benutzerprojekte. Das Verzeichnis ist ausschließlich für RasterPilot-Aufträge bestimmt. `session.key` und eigene Betriebskonfiguration bei Bedarf sichern; temporäre Bilder nicht in reguläre Sicherungen übernehmen. Die Dateien nicht während laufender Dienste manuell löschen. Eine Schlüsseländerung macht bestehende Browserzuordnungen ungültig.
