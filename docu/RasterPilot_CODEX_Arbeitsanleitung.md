# RasterPilot – Arbeitsanweisung für Codex

Stand: 19. November 2026

## 1. Auftrag und Ziel

Entwickle RasterPilot: eine deutschsprachige Web-App, die Fotos und Grafiken in Halbtonraster mit transparenten Zwischenräumen für DTF-Druckvorlagen umwandelt.

Untertitel: **Vom Bild zum druckfertigen Halbtonraster.**

Zielplattform ist ein eigener, unprivilegierter Debian-13-LXC in Proxmox. Die Bedienung erfolgt im Browser auf Desktop und Tablet. Eine GPU ist für den vorgesehenen Funktionsumfang nicht erforderlich. Als vorläufige Startausstattung gelten 2–4 CPU-Kerne und 4 GB RAM; den tatsächlichen Bedarf durch Messungen ermitteln.

RasterPilot erstellt die Bildvorlage. Weißunterlegung, Druckerprofil, Farbseparation, Spiegelung nach Druckworkflow und Druckeransteuerung bleiben Aufgabe der DTF-RIP-Software. Die App darf keine geprüfte Druckbarkeit suggerieren, bevor ein Profil anhand realer Testdrucke bestätigt wurde.

## 2. Verbindliche Arbeitsregeln

- Vor Änderungen Repository, vorhandene Dokumentation und gegebenenfalls AGENTS.md lesen. Bestehende Nutzeränderungen erhalten.
- Zuerst Architektur und Etappenplan dokumentieren, danach in kleinen, überprüfbaren Schritten implementieren. Bei offenen Detailfragen sinnvolle, reversible Vorgaben treffen und dokumentieren. Nur bei grundlegenden Zielkonflikten nachfragen.
- Erst eine lauffähige Oberfläche mit Import und Vorschau fertigstellen, danach die Rasterfunktionen integrieren.
- Bildverarbeitung unabhängig von Flask und Oberfläche implementieren. Derselbe Kern muss später von einer Desktop-App oder NeoFab2 nutzbar sein.
- Nach jeder abgeschlossenen Etappe relevante Tests ausführen, Dokumentation aktualisieren und bei vorhandenem Git-Repository einen fokussierten Commit erstellen. Ohne ausdrücklichen Auftrag keine entfernten Repositories anlegen oder produktiven Server verändern.
- Projektversion zentral in `rasterpilot/version.py` führen; bis zur ersten festgelegten Version gilt `0.0.0`. Die Version nach den Regeln in Abschnitt 2.1 fortschreiben.
- `docu/timeline.md` als fortlaufendes Änderungsprotokoll führen: Bei relevanten Änderungen Version, Datum und Änderungen ergänzen.
- In `docu/roadmap.md` Meilensteine, zugehörige Entwicklungsstufen und deren Status festlegen und bei Fortschritt aktualisieren.
- Keine Benutzerdaten, Uploads, Geheimnisse oder erzeugten Druckdateien ins Git aufnehmen.

### 2.1 Versionsschema

Die Projektversion folgt dem Schema `Hauptversion.Nebenstand.Bugfixstand`:

- **Meilenstein abgeschlossen:** Erste Stelle erhöhen und zweite und dritte Stelle auf `0` setzen.
- **Entwicklungsstufe innerhalb eines Meilensteins abgeschlossen:** Zweite Stelle erhöhen und dritte Stelle auf `0` setzen.
- **Bugfix oder sonstiger Zwischenschritt:** Dritte Stelle erhöhen.

Die sieben Umsetzungsetappen in Abschnitt 10 dienen zunächst als Grundlage für die Meilensteine. Versionsänderungen und die zugehörigen Änderungen werden in der Timeline dokumentiert.

## 3. Technischer Rahmen

Vorgesehener Stack: Python, Flask, NumPy, Pillow, HTML/CSS und schlankes JavaScript. Gunicorn als Anwendungsserver, Nginx als Reverse Proxy und systemd für den Betrieb. Abhängigkeiten und unterstützte Python-Version bei Implementierungsbeginn gegen die tatsächliche Debian-13-Umgebung prüfen, reproduzierbar festhalten und dokumentieren.

Kein Redis und keine komplexe Benutzerverwaltung im ersten Schritt. Für Exporte einen separaten Worker-Prozess mit begrenzter Warteschlange vorsehen, damit lange Berechnungen keine Webanfragen blockieren. SQLite kann Jobstatus und Metadaten zwischen Webprozess und Worker koordinieren. Keine unkontrollierten Hintergrundthreads pro Gunicorn-Worker starten. Gleichzeitige Exporte zunächst auf einen begrenzen.

Vorgeschlagene Struktur:

```text
RasterPilot/
  README.md
  pyproject.toml
  .gitignore
  rasterpilot/
    __init__.py
    version.py
    config.py
    routes.py
    jobs.py
    worker.py
    processing/
      pipeline.py
      input.py
      tone.py
      masks.py
      halftone.py
      validation.py
      export.py
    templates/
    static/
  profiles/
  tests/
  scripts/
  deploy/
  images/
  docu/
    RasterPilot_CODEX_Arbeitsanleitung.md
    roadmap.md
    timeline.md
    ARCHITEKTUR.md
    BEDIENUNG.md
    INSTALLATION_Debian13.md
    DRUCKKALIBRIERUNG.md
```

Diese Arbeitsanweisung unter `docu/RasterPilot_CODEX_Arbeitsanleitung.md` führen. Laufzeitdaten außerhalb des Quellcodes speichern. Keine Logos oder Banner voraussetzen; existierende Dateien unter `images/` nur verwenden, wenn sie tatsächlich vorliegen.

## 4. Umfang der ersten nutzbaren Version

- PNG und JPEG importieren; vorhandene PNG-Transparenz erhalten.
- Immer das vollständige Motiv verarbeiten und ausgeben; Zuschnitt auf Anwenderwunsch vorerst entfernt. Seitenverhältnis bei Größenänderung erhalten.
- Druckbreite in Zentimetern und Ausgabeauflösung festlegen, berechnete Höhe und Pixelmaße anzeigen.
- Farbiges Motiv gleichmäßig durch transparente Rasterlücken auflockern.
- Klassisches einfarbiges, helligkeitsgesteuertes Halbtonmotiv erzeugen; Druckfarbe und Umkehrung anbieten.
- Bereits vorhandene weiche Transparenz in Rasterpunkte umsetzen, während vollständig deckende Innenbereiche erhalten bleiben können.
- Rastergröße, Flächendeckung und optionale Tonwertkorrektur einstellen.
- Original-/Ergebnisvergleich, Zoom, Transparenzraster und Textilfarbvorschau anbieten.
- Transparentes PNG in der errechneten Druckgröße exportieren.
- Einstellungen als versionierte JSON-Datei exportieren und wieder importieren. Originalbilder werden darin nicht eingebettet.

Später: automatische Freistellung, manuell geschützte Bereiche, weitere Punktformen, Stapelverarbeitung, Projektverwaltung und NeoFab2-Anbindung. Keine KI-Freistellung in die erste Version aufnehmen.

## 5. Verarbeitungspipeline und Reihenfolge

### 5.1 Import und Vorbereitung

Datei wirklich dekodieren und Inhalt prüfen, EXIF-Orientierung anwenden, danach unnötige Metadaten entfernen. Eingebettete Farbprofile kontrolliert nach sRGB umwandeln. Bei fehlendem Profil eine dokumentierte sRGB-Annahme verwenden; problematische Profile verständlich melden. Intern Farbe und Alpha getrennt behandeln. Transparente Pixel dürfen Histogramme und Farbmittelwerte nicht verfälschen.

Das vollständige Bild ohne Zuschnitt skalieren und verarbeiten. Original unverändert behalten; jede Berechnung vom Original und dem aktuellen Parametersatz starten. Ausgabegrenzen anhand des vollständigen Seitenverhältnisses prüfen.

### 5.2 Zielgröße berechnen

`Pixelbreite = round(Druckbreite_cm / 2.54 × Ausgabe_ppi)`

Die Benutzeroberfläche kann die übliche Bezeichnung „DPI“ verwenden, erklärt aber, dass dies die Bildauflösung und nicht die Hardwareauflösung des Druckers ist. Ein vorläufiger Exportstandard von 300 ppi ist eine App-Vorgabe, kein universelles DTF-Druckprofil.

Rasterabstände und Mindestgrößen in Millimetern führen. Zentimeter, Millimeter und Pixel ausdrücklich trennen. Bei Größenänderungen Raster neu berechnen. Ein fertig gerastertes Bild nicht nachträglich zur Anpassung der Druckgröße skalieren.

### 5.3 Optionale Bildkorrektur

Leichte Entrauschung und danach Tonwertkorrektur vor der Rasterung vorsehen. Standardmäßig keine aggressive Korrektur. Automatische Tonwerte dürfen ausschließlich den sichtbaren Motivbereich auswerten. Schwarzpunkt, Weißpunkt und Gamma separat anbieten; Schwarzpunkt muss kleiner als Weißpunkt sein, Gamma muss positiv sein.

Keine globale harte Schwarz-Weiß-Schwelle als Ersatz für die Halbtonberechnung verwenden. Farbkorrektur und Anpassung der Deckungsmaske als getrennte Optionen behandeln, damit ein Deckungsregler nicht unbeabsichtigt die Motivfarben verändert.

### 5.4 Deckungsmaske berechnen

Deckungswert `c` intern auf 0 bis 1 normieren. Bestehende vollständige Transparenz immer respektieren. Drei klar getrennte Modi implementieren:

| Modus | Grundlage der Deckung | Erwartetes Verhalten |
| --- | --- | --- |
| Farbig auflockern | Einstellbare Deckung innerhalb des vorhandenen Motivs | Bildfarben bleiben erhalten; Weiß ist Motivfarbe und wird nicht automatisch entfernt |
| Einfarbig nach Helligkeit | Tonwertkorrigierte Helligkeit, optional invertiert | Dunkle beziehungsweise bei Umkehr helle Bereiche erzeugen mehr Druckfläche |
| Transparenz rastern | Vorhandener Alphakanal | Weiche transparente Übergänge werden durch deckende Punkte und transparente Lücken ersetzt |

Alpha nicht versehentlich zweimal multiplizieren. Für jeden Modus die genaue Formel dokumentieren. Textilfarbe beeinflusst zunächst ausschließlich die Vorschau; das Exportmotiv darf dadurch nicht verändert werden.

### 5.5 Halbtonraster erzeugen

Mit regelmäßigem Raster und runden Punkten beginnen; Rasterwinkel von −180° bis +180° mit Standard 0° anbieten. Positive Winkel drehen nur das Raster im Uhrzeigersinn um die linke obere Bildkante; das Motiv bleibt vollständig und unverändert ausgerichtet. Rasterabstand bezeichnet den Abstand der Punktmittelpunkte und ist vom Punktdurchmesser zu unterscheiden.

Die Punktfläche muss die gewünschte Flächendeckung abbilden. Den Radius nicht linear aus dem Tonwert ableiten: Für isolierte Kreisflächen gilt Fläche proportional Radius zum Quadrat. Die Behandlung hoher Deckungen ausdrücklich lösen, beispielsweise durch Übergang zu transparenten Löchern. Überlappende Kreise liefern sonst keine einfache lineare Deckung mehr.

Vollständig leere und vollständig gefüllte Bereiche korrekt unterstützen. In der ersten Version für den finalen Export binäres Alpha verwenden: entweder vollständig deckend oder vollständig transparent. Halbtransparente Kantenglättung nicht ungeprüft in den DTF-Export übernehmen. Vorschau darf zum Anzeigen geglättet werden.

Rasterung nach der finalen Zielgrößenberechnung durchführen. Danach keine Weichzeichnung und kein Schärfen anwenden. Bei farbigen Motiven saubere Farben an Transparentkanten sicherstellen; beim Skalieren Alpha berücksichtigen, damit keine dunklen oder hellen Säume entstehen.

### 5.6 Grenzen prüfen und exportieren

Mindestpunktdurchmesser und Mindestlücke aus einem Druckprofil beziehen. Zusätzlich die nach Pixelrundung tatsächlich erzeugten Strukturen prüfen, einschließlich Motivrändern. Zu kleine Merkmale melden oder nach einer dokumentierten Profilregel behandeln. Eine automatische Bereinigung darf nicht unbemerkt wichtige Details löschen.

Export als sRGB-PNG mit Transparenz, korrekten Pixelmaßen und Auflösungsmetadaten. Keine Textilfarbe und kein Schachbrett in das Exportbild einrechnen. Dateiname beispielsweise `motiv_rasterpilot_280mm_300ppi.png`. Eine eingestellte Druckbreite muss in der RIP-Software zusätzlich überprüfbar sein, da Programme Auflösungsmetadaten unterschiedlich auswerten können.

## 6. Oberfläche und Einstellungen

Die Oberfläche führt durch „Bild – Druckgröße – Raster – Export“. Große Vorschau, kompakte Bedienelemente, verständliche deutsche Beschriftungen und kurze Erklärungen verwenden. Regler mit Zahlenfeldern kombinieren; Werte zurücksetzen und das Original vergleichen können.

| Direkt sichtbar | Unter „Erweitert“ |
| --- | --- |
| Druckbreite | Ausgabeauflösung |
| Rastermodus | Schwarzpunkt, Weißpunkt, Gamma |
| Rastergröße mit Millimeteranzeige | Rasterwinkel |
| Auflockerung beziehungsweise Deckung | Glättung und Automatik |
| Textilfarbe für Vorschau | Mindestpunkt und Mindestlücke aus Profil |
| Export und Fortschritt | Import/Export der Einstellungen |

Die Richtung des Reglers eindeutig benennen: Mehr „Auflockerung“ bedeutet weniger bedruckte Fläche. Intern nur eine eindeutig definierte Deckungsgröße verwenden.

Schnelle Vorschau mit reduzierter Auflösung anbieten. Sie muss dieselbe physische Rastergeometrie und dieselben Parameter wie der Export abbilden. Für feine Raster zusätzlich einen Ausschnitt in Exportauflösung anzeigen; eine verkleinerte Gesamtansicht reicht zur Punktprüfung nicht aus. Veraltete Vorschauantworten dürfen neuere Einstellungen nicht überschreiben.

## 7. Druckprofile und Kalibrierung

Profile als validierte, versionierte JSON-Dateien speichern. Enthalten: Name, Status „experimentell/geprüft“, Ausgabeauflösung, Rasterparameter, Mindestpunkt und Mindestlücke sowie optionale Hinweise zu Drucker, RIP, Folie und Pulver.

Keine universellen Mindestgrößen erfinden. Ohne bestätigtes Profil können experimentelle Einstellungen verwendet werden, müssen aber als unkalibriert erkennbar bleiben.

Eine Kalibriervorlage mit unterschiedlichen Punktgrößen, Lücken und Deckungen vorsehen. Die Dokumentation beschreibt: drucken, übertragen, Details und Griff beurteilen, anschließend Profilwerte festhalten. Eine Vorschau ist keine verbindliche Farb- oder Transferprognose.

## 8. Ressourcen und Dateiverwaltung

Uploadgröße, dekodierte Pixelanzahl, Zielpixelzahl, Laufzeit und Warteschlangenlänge begrenzen. Vorläufige Limits konfigurierbar wählen und unter 4 GB RAM prüfen; komprimierte Dateigröße allein reicht nicht als Speichergrenze. Array-Kopien vermeiden und große Bilder bei Bedarf blockweise berechnen.

Dateien anhand interner zufälliger IDs zuordnen, nicht anhand übergebener Pfade. Downloads nur dem zugehörigen Browserzugang ermöglichen. Zufällige Job-IDs allein nicht als Zugriffsschutz betrachten. Sitzungszuordnung und sichere Cookies vorsehen; destruktive Aktionen und Upload-Endpunkte passend gegen CSRF absichern.

Temporäre Dateien und Jobs automatisch nach einer konfigurierbaren Frist löschen. Löschung und Export dürfen nicht kollidieren. Keine Bilder oder vollständigen lokalen Pfade in Logs schreiben. Keine externen Bilddienste verwenden.

## 9. Prüfungen und Abnahmekriterien

Gezielte Tests für den Verarbeitungskern schreiben:

- Zentimeter-/Pixelumrechnung und Einhaltung des Seitenverhältnisses.
- Volltransparent, vollständig deckend und bekannte konstante Deckungen.
- Tonwertverlauf mit monoton steigender Deckung und nachvollziehbarer Flächendeckung innerhalb definierter Toleranzen.
- Weißes Motiv bleibt im farbigen Modus sichtbar; Invertierung im einfarbigen Modus funktioniert.
- Vorhandene Transparenz, Motivkanten und Farben bleiben korrekt zugeordnet.
- Binärer Alphakanal und korrekte PNG-Maße/Auflösungsmetadaten nach Export.
- Unzulässige Parameter, beschädigte Bilder und Ressourcenlimits erzeugen verständliche Fehler.
- Mehrere Browserzugänge können fremde Jobs nicht lesen; Worker und Aufräumen behandeln Fehler korrekt.

Zusätzlich manuell mit Foto, Logo, weißer Schrift, transparentem PNG und weichen Rändern prüfen. Speicherbedarf und Laufzeit einer dokumentierten typischen Druckdatei messen. Vorschau und Export anhand eines Ausschnitts vergleichen. Physische Druckabnahme separat dokumentieren, nicht durch Softwaretests ersetzen.

## 10. Umsetzungsetappen

1. **Grundgerüst:** Architektur, README, Roadmap und Versionsdatei; startfähige Oberfläche und Health-Endpunkt.
2. **Import und Vorschau:** PNG/JPEG, Orientierung, Transparenz, vollständiges Motiv, Druckgröße und Textilfarbvorschau.
3. **Erster vollständiger Ablauf:** Farbiges Auflockern mit runden Punkten, finaler Größenberechnung und PNG-Export. Mit Tests absichern.
4. **Weitere Modi:** Einfarbiges Helligkeitsraster und Transparenzraster; Tonwerte und erweitertes Einstellungsmenü.
5. **Betriebsfähigkeit:** Job-Worker, Limits, Zugriffstrennung, automatische Bereinigung und Einstellungen als JSON.
6. **Kalibrierung:** Druckprofile, Prüfung kleiner Strukturen und Testvorlage; reale Druckergebnisse gemeinsam mit dem Projektverantwortlichen auswerten.
7. **Debian-Betrieb:** Installationsanleitung, systemd-Dienste für Web und Worker, Nginx-Beispiel, Update-/Backup-/Fehlersuchanleitung.

Jede Etappe mit Ergebnis, Prüfungen und verbleibenden Einschränkungen dokumentieren. Keine zusätzliche Freigabe für jeden kleinen Implementierungsschritt verlangen. Fehlende Druckhardware blockiert die Softwareentwicklung nicht; der Status bleibt bis zur realen Prüfung experimentell.

## 11. Betrieb im Debian-13-LXC

Unprivilegierten Container ohne GPU-Passthrough und ohne zusätzliche Privilegien verwenden. App unter eigenem Systembenutzer betreiben. Quellcode, virtuelle Python-Umgebung und Laufzeitdaten getrennt halten. Gunicorn nur an localhost oder Unix-Socket binden, Zugriff über Nginx. Uploadlimits und Timeouts zwischen App und Proxy abstimmen.

Systemd-Konfiguration für Web und Worker, automatischen Neustart, Logs und Bereinigung bereitstellen. Geheimnisse über geschützte Konfiguration beziehungsweise Umgebungsdatei zuführen. Keine feste IP oder Domain voraussetzen. HTTPS-Einbindung anhand der später tatsächlich vorhandenen Zertifikate dokumentieren.

Backup umfasst Konfiguration, Profile und bei Bedarf Jobdaten; kurzlebige Uploads standardmäßig ausschließen. Vor Updates laufende Jobs berücksichtigen und einen dokumentierten Rückweg ermöglichen.

## 12. Dokumentation und erster Codex-Auftrag

README erklärt Zweck, Funktionen, lokalen Start, Beispiele und die Abgrenzung zur RIP-Software. Bedienungsanleitung erklärt alle Regler und deren Wirkung für Anfänger. `docu/roadmap.md` hält Meilensteine, Entwicklungsstufen und ihren Status fest. `docu/timeline.md` dokumentiert relevante Änderungen mit Datum und zugehöriger Version nach Abschnitt 2.1.

**Startauftrag:** Lies diese Arbeitsanweisung und das vorhandene Repository. Erstelle den konkreten Etappenplan und implementiere anschließend Etappe 1 und 2. Bereite den Verarbeitungskern so vor, dass danach Etappe 3 ohne Umbau der Oberfläche integriert werden kann. Führe passende Prüfungen aus und dokumentiere den Stand. Erfinde keine bereits geprüften Druckprofile, Logos oder Serverzugänge.
