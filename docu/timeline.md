# Timeline

## 0.2.5 – 19. November 2026

- Exportnamen auf den ursprünglichen Dateinamen ohne Endung mit dem Suffix `_rp_<Druckbreite in mm>_<Auflösung>ppi_<Winkel>G.png` umgestellt. Auf Anwenderwunsch Unterstriche anstelle der unter Windows unzulässigen Sternchen verwendet.
- Originalnamen mit Umlauten, Leerzeichen und mehreren Punkten erhalten; Pfadanteile entfernt, ungültige Zeichen ersetzt und lange Namen bei vollständigem Parametersuffix begrenzt. Negative Winkel bleiben erkennbar.
- Dateinamen zentral auf dem Server erzeugt und für API und Browserdownload identisch bereitgestellt. Bedienungsanleitung, Architektur und Arbeitsanweisung nachgeführt.
- 31 Python-Tests und neun JavaScript-Zustandstests erfolgreich, einschließlich Unicode-Namen, mehrerer Punkte, dezimaler Druckbreite, negativer Winkel, Pfadbereinigung, Längenbegrenzung und Übernahme des Servernamens im Download.

## 0.2.4 – 19. November 2026

- Vorhandenes RasterPilot-Logo links in die Top-Leiste integriert und als statische Anwendungsdatei eingebunden.
- Ansichtseinstellungen für Vergleich, Zoom, Hintergrund und Textilfarbe direkt über die Bildvorschau verschoben. Die Felder ordnen sich je nach verfügbarer Breite in einer oder zwei Spalten an.
- Das eigene Ansichts-Bedienfeld wird nach erfolgreichem Bildimport aktiviert und bei einem Neuimport wieder gesperrt. Ansichtsänderungen erhalten weiterhin den aktuellen Download.
- Bedienungsanleitung aktualisiert. Zwei Anwendungstests und acht JavaScript-Zustandstests erfolgreich; ausgeliefertes HTML auf Position und Zuordnung der Ansichtsfelder sowie SVG-Auslieferung geprüft. Keine visuelle Browserprüfung durchgeführt.

## 0.2.3 – 19. November 2026

- Anwender bestätigt den bisherigen Ablauf als funktionierend und wünscht vorerst vollständige Bilder ohne Ausschnittbereich.
- Ausschnittfelder, Zurücksetzen und Zuschnitt im Verarbeitungskern entfernt. Vorschau und PNG-Export verwenden immer das vollständige orientierte Motiv mit erhaltenem Seitenverhältnis; Druckgrößen-, Auflösungs- und Uploadgrenzen bleiben bestehen. Alte Ausschnittparameter können keine Bildteile mehr entfernen.
- Rasterwinkel von −180° bis +180° ergänzt, Vorgabe 0°. Positive Winkel drehen das Punktraster im Uhrzeigersinn; das Motiv behält Ausrichtung und vollständige Abmessungen. Winkeländerungen sperren veraltete Ergebnisse und Downloads.
- 29 Python-Tests und acht JavaScript-Zustandstests erfolgreich. Ein vorhandenes Original zusätzlich bei 45° über die API geprüft: 3307 × 4419 Pixel, binäres Alpha und 300 ppi. Synthetische Gegenüberstellung von 0° und 45° visuell geprüft. Die Browserprüfung konnte wegen einer Zeitüberschreitung der App-Zugriffsfreigabe nicht starten; manuelle Browser- und Druckabnahme offen.
- Bedienung, README, Arbeitsanweisung, Architektur und Roadmap angepasst. Keine geänderten Installationsvoraussetzungen oder Installations-/Updateskripte.

## 0.2.2 – 18. November 2026

- Anwender bestätigt erfolgreiche Neuinstallation im Debian-LXC sowie Bild-Upload und Rasterung.
- Exportgrenze von 12 auf 40 Megapixel erhöht, damit Midjourney-Hochformate bei 28 cm Breite/300 ppi ohne Vorverkleinerung funktionieren. Die drei bereitgestellten Originale haben je 1904 × 2544 Pixel; erst die Druckgrößenberechnung ergibt etwa 14,6 Megapixel Ausgabe. Uploadgrenzen bleiben unverändert.
- Originalvorschau bleibt bei zu großen Exportmaßen sichtbar und bearbeitbar. Die Meldung erklärt den Unterschied zwischen Originalbild und gewählter Druckgröße; Berechnung und veralteter Download bleiben gesperrt.
- Alle drei unveränderten Testbilder lokal über Import- und Raster-API erfolgreich geprüft: jeweils 3307 × 4419 Pixel, binäres Alpha und 300-ppi-Metadaten. Die bereits vorhandenen Bilddateien bleiben unverändert.
- 25 Python-Tests und fünf JavaScript-Zustandstests erfolgreich. Synthetische Grenztests bis 39,84 Megapixel Ausgabe und 36 Megapixel dekodierter Eingabe mit maximal 756,3 MiB Prozessspeicherspitze unter Windows durchgeführt; paralleler LXC-Lasttest offen. Benchmark und Betriebsdokumentation entsprechend ergänzt.

## 0.2.1 – 18. November 2026

- `sudo` in die Systempakete der Installation aufgenommen. Das Updateskript installiert es bei Bedarf als root nach, bevor eine neue Anwendungsversion vorbereitet wird.
- Aufruf und Fehlermeldungen auf die direkte root-Ausführung ausgerichtet; `su -` als Einstieg ohne vorhandenes `sudo` dokumentiert. Vorhandene sudo-Benutzer können weiterhin ihren eingerichteten Zugang nutzen; neue Benutzerrechte werden nicht erteilt.
- Installation, Update, Erneuerung eines älteren Updaters und Fehlerbehebung für `sudo: command not found` in beiden Installationsdokumenten nachgeführt.
- Fünf isolierte Skripttests für fehlendes/vorhandenes sudo, Paketfehler und fehlende root-Rechte sowie die Shell-Syntaxprüfung erfolgreich; alle 23 Anwendungstests bestehen. Eine echte Paketinstallation auf Debian wurde hier nicht ausgeführt.

## 0.2.0 – 18. November 2026

- Erste Entwicklungsstufe des vollständigen Ablaufs umgesetzt: farbiges Punktraster mit einstellbarem Abstand in Millimetern und Deckung sowie transparentem PNG-Export in der berechneten Druckgröße.
- Eigenständigen Verarbeitungskern mit Pillow und NumPy ergänzt: EXIF-Orientierung, sRGB-Konvertierung, Zuschnitt vor Skalierung, alpha-korrekte Größenänderung und binärer Alphakanal. Hohe Deckungen werden anhand der tatsächlich belegten Kreisfläche berechnet.
- Ergebnisvorschau aus derselben Datei wie der Download, Originalvergleich, Transparenzraster und 100-%-Ansicht ergänzt. Veraltete Berechnungsergebnisse werden verworfen; Änderungen sperren den bisherigen Download.
- Bildverarbeitung vom Browser auf den eigenen Server erweitert, ohne Bildablage. Upload-/Ausgabegrenzen, verständliche Fehler und angepasste Nginx-Konfiguration samt Anleitung für bestehende Installationen ergänzt.
- 23 Python-Tests und vier JavaScript-Zustandstests erfolgreich; lokaler synthetischer Export mit 3307 × 3307 Pixeln in 1,373 s bei 208,5 MiB Prozessspeicherspitze gemessen. Erzeugtes Rasterbild visuell geprüft. Echte Browserprüfung der neuen Funktionen war hier mangels Browserzugriff nicht möglich; Debian- und Druckabnahme offen.
- Anwender bestätigt den bisherigen Stand 0.1.1 im Browser soweit prüfbar als funktionsfähig. Das ersetzt keine vollständige Motiv- oder Druckabnahme.

## 0.1.1 – 18. November 2026

- Installations- und Updateskripte für Debian 13 ergänzt: eigene Python-Umgebung, Dienstbenutzer, Gunicorn, Nginx und automatischer Start über systemd. Updates bereiten eine neue Version vor und versuchen bei einem fehlgeschlagenen Start, die vorherige Version wiederherzustellen.
- Zugriffsrechte der Versionsverzeichnisse korrigiert, damit der Dienstbenutzer Gunicorn starten kann. Die Rechtekorrektur hat den gemeldeten Fehler „502 Bad Gateway“ auf dem Zielsystem behoben.
- Prüfung der Anwendung vor dem Aktivieren auf den Dienstbenutzer umgestellt und den Start-Health-Check bei der Installation um begrenzte Wiederholungen ergänzt.
- Installationsanleitung und wiederverwendbare Codex-Anweisung ergänzt, einschließlich öffentlichem GitHub-Zugriff, sicherer Verknüpfung von Download und Ausführung sowie Fehlerbehebung für HTTP 404 und 502.

## 0.1.0 – 18. November 2026

- Erster Entwicklungsstand mit Flask-Grundgerüst, Health-Endpunkt, Architektur, Roadmap und zentraler Versionsführung.
- Lokaler Bildimport, rechteckiger Zuschnitt, Druckmaße und Textilfarbvorschau ergänzt; Bildanzeige und Textilfarbauswahl im Browser manuell erfolgreich geprüft; Zuschnitt und Druckmaße noch zu prüfen.
- Die voreilige Versionsangabe `2.0.0` wurde auf `0.1.0` korrigiert; die ersten Meilensteine sind noch nicht abgeschlossen.
