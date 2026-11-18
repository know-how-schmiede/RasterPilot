![RasterPilot – Vom Bild zum druckfertigen Halbtonraster](images/rasterpilot-banner.svg)

# RasterPilot

Vom Bild zum druckfertigen Halbtonraster.

<img src="images/rasterpilot-logo.svg" alt="RasterPilot-Logo: Halbtonraster mit stilisiertem Papierflieger" width="128">

RasterPilot ist als deutschsprachige Web-App geplant, die Fotos und Grafiken in Halbtonraster für DTF-Druckvorlagen umwandelt. Dabei entstehen Rasterpunkte mit transparenten Zwischenräumen. Die Anwendung soll auf Desktop und Tablet im Browser bedient werden und ohne GPU auskommen.

> **Projektstatus:** Die erste Bildvorschau ist verfügbar. Halbtonraster, Export und Produktionsbetrieb sind noch in Planung.

## Lokal starten

Voraussetzung ist Python ab Version 3.11. Für den lokalen Entwicklungsstart:

```sh
python3 -m venv .venv
. .venv/bin/activate
pip install -e .
flask --app rasterpilot:create_app run
```

Anschließend `http://127.0.0.1:5000` im Browser öffnen. Der Entwicklungsserver ist nicht für den Produktionsbetrieb vorgesehen. Tests lassen sich mit `python -m unittest discover -s tests` ausführen.

Die aktuelle Vorschau lädt PNG- und JPEG-Dateien lokal im Browser, bietet einen numerischen Zuschnitt sowie Druckgrößenberechnung und Textilfarbvorschau. Bilder bleiben im Browser; Rasterung und Export sind noch nicht verfügbar. Die Vorschau ist auf 1600 Pixel Kantenlänge begrenzt und keine Druckfreigabe. Dateien dürfen höchstens 20 MiB und 40 Megapixel groß sein. Die Unterstützung von Bildorientierung und Farbprofil hängt derzeit vom Browser ab.

## Was soll RasterPilot können?

- PNG- und JPEG-Bilder importieren und vorhandene PNG-Transparenz erhalten.
- Motive zuschneiden und anhand von Druckbreite und Ausgabeauflösung auf die benötigte Pixelgröße bringen.
- Farbige Motive durch transparente Rasterlücken auflockern, einfarbige Halbtonmotive aus Helligkeitswerten erzeugen oder weiche Transparenz in Rasterpunkte umwandeln.
- Rastergröße, Deckung und bei Bedarf Tonwerte einstellen sowie das Ergebnis mit dem Original vergleichen.
- Das Ergebnis mit Zoom, Transparenzraster und einer wählbaren Textilfarbe als Vorschau betrachten.
- Ein transparentes PNG in der berechneten Druckgröße exportieren und Einstellungen als JSON speichern und wieder laden.

Die Textilfarbe dient nur der Vorschau und wird nicht in das Exportbild eingerechnet. Automatische Freistellung, weitere Punktformen, Stapelverarbeitung und eine NeoFab2-Anbindung sind für spätere Ausbaustufen vorgesehen.

## Wie ist die Verarbeitung geplant?

1. **Bild vorbereiten:** RasterPilot prüft und dekodiert die Datei, berücksichtigt Ausrichtung und Farbprofil und erhält vorhandene Transparenz. Der Zuschnitt erfolgt vor der endgültigen Skalierung.
2. **Druckgröße festlegen:** Aus Druckbreite und Ausgabeauflösung werden die Pixelmaße berechnet; das Seitenverhältnis bleibt erhalten. Die Auflösung beschreibt dabei das Bild und nicht die Hardwareauflösung des Druckers.
3. **Raster berechnen:** Je nach Modus bestimmen eine eingestellte Deckung, die Bildhelligkeit oder der Alphakanal die Rasterpunkte. Rasterabstand und Punktgröße werden in Bezug auf die spätere Druckgröße behandelt.
4. **Prüfen und exportieren:** Eine Vorschau und ein Ausschnitt in Exportauflösung sollen die Beurteilung erleichtern. Der Export ist als sRGB-PNG mit transparenten Zwischenräumen und Auflösungsmetadaten geplant. Für den finalen Export soll der Alphakanal vollständig deckend oder vollständig transparent sein.

RasterPilot erstellt die Bildvorlage. Weißunterlegung, Farbseparation, Druckerprofil, gegebenenfalls Spiegelung und Druckeransteuerung bleiben Aufgaben der DTF-RIP-Software. Die Druckbreite sollte dort überprüft werden, da Programme Auflösungsmetadaten unterschiedlich auswerten können. Eine Vorschau ersetzt keinen realen Testdruck; Druckprofile gelten erst nach entsprechender Kalibrierung als geprüft.

## Geplante Umsetzung

Die Bildverarbeitung soll unabhängig von Oberfläche und Webserver entstehen, damit derselbe Kern später auch in einer Desktop-App oder in NeoFab2 verwendet werden kann. Vorgesehen sind Python, Flask, NumPy und Pillow sowie eine schlanke Browseroberfläche mit HTML, CSS und JavaScript. Ein separater Worker mit begrenzter Warteschlange soll Exporte ausführen; SQLite kann den Jobstatus zwischen Webprozess und Worker verwalten.

Die Entwicklung ist in Etappen geplant:

1. **Grundgerüst:** Architektur, Roadmap, Versionsdatei und eine startfähige Oberfläche mit Health-Endpunkt.
2. **Import und Vorschau:** Bildimport, Transparenz, Zuschnitt, Druckgröße und Textilfarbvorschau.
3. **Erster vollständiger Ablauf:** Farbige Auflockerung, Rasterberechnung und PNG-Export.
4. **Weitere Rastermodi:** Helligkeits- und Transparenzraster sowie Tonwertkorrektur und erweiterte Einstellungen.
5. **Betriebsfähigkeit:** Worker, Ressourcenlimits, Zugriffstrennung, Bereinigung und JSON-Einstellungen.
6. **Kalibrierung:** Druckprofile, Prüfung kleiner Strukturen und Testvorlagen für reale Druckversuche.
7. **Debian-Betrieb:** Installations- und Betriebsanleitung mit systemd, Gunicorn und Nginx.

Als Zielumgebung ist ein eigener, unprivilegierter Debian-13-LXC unter Proxmox vorgesehen. Für den Einstieg sind 2–4 CPU-Kerne und 4 GB RAM angesetzt; der tatsächliche Bedarf soll gemessen werden. Uploads und temporäre Dateien sollen begrenzt und automatisch bereinigt werden.

Die ausführlichen Anforderungen und Abnahmekriterien stehen in der [Arbeitsanleitung](docu/RasterPilot_CODEX_Arbeitsanleitung.md).
