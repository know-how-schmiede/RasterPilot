# Timeline

## 0.6.0 – 21. November 2026

- Den bisherigen Affinity-Modus auf Anwenderwunsch durch „Schwarz durch Shirt ersetzen“ abgelöst; API-Wert `affinity` bleibt erhalten. Schwarz wird transparent, helle und kräftige Farbflächen bleiben geschlossen. Auch farbige Übergänge zu Schwarz werden gerastert.
- Deckung aus dem stärksten RGB-Kanal zwischen Schwarz-/Weißpunkt berechnet, Vorgabe und Reset 0/245. Punktfarben werden durch die Farbdeckung geteilt und auf den Kanalbereich begrenzt, damit das Bild auf Schwarz durch die Rasterlücken nicht zusätzlich abdunkelt. Vollständig geschlossene Farbflächen behalten die Originalwerte; Alpha wird einmal berücksichtigt. Eine Rundungstoleranz an halben Kanalwerten verhindert numerisch bedingte Abweichungen um einen Kanalwert.
- Handout-Beispielschaltfläche und Umkehrung in diesem Modus entfernt. Frühere Zusatzparameter beeinflussen die neue Berechnung nicht. Nur Schwarz-/Weißpunkt als Tonwertregler; eigene Tonwerte je Modus und Gamma/Umkehrung des einfarbigen Modus bleiben beim Wechsel erhalten. Die erste manuelle Auswahl stellt die Vorschau auf Schwarz; gespeicherte Ansichten bleiben beim Laden erhalten.
- JSON-Formatversion 3 eingeführt. Vollständige Versionen 1/2 bleiben importierbar; alte Affinity-Dateien erhalten einen Hinweis auf die veränderte Berechnung. Schwarz-/Weißpunkt, Rastergeometrie und Ansicht werden übernommen. Die drei anderen Rastermodi behalten ihre Berechnung und alten Einstellungen. Dokumentation und Benchmark-Hilfe nachgeführt; keine neuen Abhängigkeiten oder Änderungen an Installation/Updates.
- 56 Python-Tests und 26 JavaScript-Tests erfolgreich. Geprüft sind geschlossene Weiß-/Farbflächen, Grau-/Farbverläufe, gemittelte Rekonstruktion auf Schwarz innerhalb von drei Kanalwerten, aufgehellte Punktfarben, Alpha, Tonwertgrenzen, Rasterwinkel, saubere skalierte Kanten, Queue/Worker, JSON-Migration und Moduswechsel.
- Vorhandenes Eichhörnchen-Motiv mit 28 cm/300 ppi, 1 mm Abstand und 45° verarbeitet: Ausgabe 3307 × 4419 Pixel, 299,9994 ppi, binäres Alpha, rund 2,55 s einschließlich PNG-Dekodierung. 1.982.862 voll deckende Quellpixel ab Weißpunkt 245 bleiben exakt erhalten, schwarze Quellpixel transparent. Gesamtbild auf Schwarz und Exportausschnitt bei 100 % direkt visuell geprüft. Visuelle Browserprüfung und physische Druckabnahme bleiben offen.
- Synthetischer Standardbenchmark mit `--mode affinity`: unter Windows 11/Python 3.12.15 bei 2400 × 2400 Eingabe und 3307 × 3307 Ausgabe etwa 2,35 s und 189,7 MiB Prozessspeicherspitze. Parallel zu Softwaretests gemessen; keine LXC-Lastmessung oder Druckkalibrierung.

## 0.5.1 – 21. November 2026

- Auf Anwenderwunsch die Tonwertregler im Affinity-Modus auf Schwarz- und Weißpunkt beschränkt. Sechs Farbregler, Maskenkontrast und Mischmodusauswahl entfernt; Gamma ist ausschließlich im bisherigen einfarbigen Modus einstellbar.
- Affinity verwendet feste Vorgaben: Gamma 1, Maskenkontrast 85, Strahlendes Licht und neutrale Farbwerte (100 %). Rasterabstand, Winkel, Umkehrung und Handout-Beispiel bleiben verfügbar. Moduswechsel, Beispielübernahme und Affinity-Tonwertreset erhalten das separat einstellbare Gamma des einfarbigen Modus.
- Bestehendes JSON-Format und Verarbeitungskern bleiben unverändert. Beim Laden früherer Affinity-Dateien werden abweichende zusätzliche Maskenwerte mit Hinweis durch die festen Vorgaben ersetzt; Schwarz-/Weißpunkt und übrige bedienbare Einstellungen bleiben erhalten. Beim Speichern werden die tatsächlich verwendeten Vorgaben ausgegeben.
- 24 JavaScript- und zwei Anwendungstests erfolgreich, einschließlich vereinfachter Oberfläche, fester Auftrags-/Exportwerte, Import, Gamma-Erhalt beim Moduswechsel sowie Seiten-/Asset-Auslieferung und Versionsmeldung. README, Bedienung, Architektur, Roadmap und Arbeitsanleitung angepasst. Keine Änderungen an Installation, Abhängigkeiten oder Betrieb.

## 0.5.0 – 21. November 2026

- Rasterprozess um „Farbig nach Helligkeit · Affinity“ nach dem bereitgestellten Handout erweitert. Schwarz-Weiß-Arbeitskopie und rundes Halbtonraster erzeugen eine Lichtermaske für die Originalfarben, optional invertiert. Vorhandene Transparenz wird einmal berücksichtigt; der PNG-Export behält binäres Alpha, sRGB und ppi-Metadaten.
- Sechs Schwarz-Weiß-Farbregler, Maskenkontrast und „Normal“/„Strahlendes Licht“ ergänzt. Die Tonwert-Feinabstimmung erfolgt entsprechend Schritt 5 des Handouts am Arbeitsraster nach dem Halbtonfilter. Hoher Kontrast schärft die Rasterübergänge, ohne die Motivhelligkeit hart abzuschneiden. Affinity-Filter, Farbregler und Lichterauswahl werden nachvollziehbar angenähert, keine pixelgleiche Ausgabe behauptet. Formeln und Abweichungen in der Architektur beschrieben.
- „Handout-Beispiel übernehmen“ setzt 45°, Kontrast 85, Weißpunkt 184 (rund 72 %), Strahlendes Licht und neutrale Farbregler. Zellengröße 10 bei Referenzbreite 1904 Pixel wird auf die aktuelle Druckbreite übertragen; bei 28 cm ergeben sich 1,471 mm. Rasterabstand nun in 0,001-mm-Schritten einstellbar, die technische Zwei-Pixel-Grenze bleibt erhalten.
- JSON-Formatversion 2 enthält die zusätzlichen Einstellungen. Vollständige Dateien der Version 1 bleiben importierbar. Änderungen der neuen Felder entwerten veraltete Ergebnisse; die bisherigen drei Modi behalten ihr Verhalten.
- 55 unterschiedliche Python-Tests und 23 JavaScript-Tests erfolgreich (Gesamtlauf zunächst 54 Python-Tests, anschließend alle 30 Verarbeitungstests einschließlich zusätzlichem Regressionstest). Abgedeckt sind Maskenrichtung, sechs Farbregler, neutrale Grautöne, Tonwerte/Gamma, beide Vivid-Light-Zweige, Erhalt von Mitteltönen, Originalfarben und Alpha, bisherige Modi, Queue/Worker, Einstellungsrundlauf, Migration und Handout-Abstand.
- Handout-Vorgabe am vorhandenen 1904-×-2544-Pixel-Original lokal geprüft: Ausgabe 3307 × 4419 Pixel, 299,9994 ppi, Alpha ausschließlich 0/255, etwa 3,36 s einschließlich PNG-Dekodierung und Aufbau der Vergleichstafel. Ausgabe auf Schwarz und Exportausschnitt bei 100 % visuell geprüft. Browserprüfung wegen nicht verfügbarem Browserzugriff nicht möglich; Anwender-, Debian- und Druckabnahme bleiben offen.
- Synthetischer Standardbenchmark `--mode affinity` lokal unter Windows 11/Python 3.12.15: 2400 × 2400 Eingabe, 3307 × 3307 Ausgabe bei 28 cm/300 ppi, etwa 2,72 s und 199,6 MiB Prozessspeicherspitze. Benchmark lief parallel zu Softwaretests; keine LXC-Lastmessung. Keine neuen Abhängigkeiten oder geänderten Installations-/Updateskripte; Installationsvoraussetzungen und beide Installationsdokumente auf Aktualisierungsbedarf geprüft, unverändert gültig.

## 0.4.0 – 19. November 2026

- Anwender bestätigt die Rastermodi aus 0.3.0 und beauftragt die nächste Entwicklungsstufe zur Betriebsfähigkeit.
- Rasterung aus dem Webprozess in einen separaten Worker verlagert. SQLite verwaltet die Warteschlange; eine Betriebssystem-Sperre begrenzt den Worker auf einen gleichzeitig rechnenden Auftrag. Berechnungen laufen in beendbaren Kindprozessen mit standardmäßig 180 Sekunden Zeitlimit.
- Begrenzung auf vier aktive/wartende Aufträge, einen je Browserzugang, acht gespeicherte Aufträge und 1 GiB reservierten Bildspeicher ergänzt. Signierte HttpOnly-/SameSite-Cookies trennen die Zugänge; Status, Abbruch und Downloads sind an die Sitzung gebunden. Keine zusätzliche Benutzeranmeldung.
- Private temporäre Originale/Ergebnisse und automatische Bereinigung nach standardmäßig einer Stunde eingeführt. Originale werden nach Abschluss sofort entfernt, abgebrochene Berechnungen aufgeräumt und unterbrochene Aufträge beim Neustart als fehlgeschlagen behandelt. Ohne laufenden Worker erfolgt keine Bereinigung.
- Statusabfrage und Abbruch in der Oberfläche integriert. Veraltete Upload-Annahmen werden nach Bestätigung verworfen und abgebrochen, bevor neue Aufträge starten. Vollständige Bilder, Rastermodi und das vereinbarte Exportnamensschema bleiben erhalten.
- Versionierte JSON-Dateien für Druck-, Raster- und Ansichtseinstellungen ergänzt, ohne Bilder oder Server-Aufträge. Imports werden vollständig vor der Übernahme geprüft; ungültige Dateien lassen bisherige Werte und Ergebnisse unverändert. Statische Oberflächendateien erhalten einen Versionsparameter.
- Installation und Update um gemeinsamen Dienstbaustein, privaten Datenpfad, Worker-Systemdienst und `/ready`-Prüfung erweitert. Rückfall stellt die vorherige Webversion und einen zuvor vorhandenen Worker wieder her. Für Altinstallationen zuerst den Updater erneuern; Schritte in beiden Installationsdokumenten nachgeführt.
- 48 Python-Tests und 29 JavaScript-/Skripttests erfolgreich. Echte separate Worker-Prozesse, parallele Kapazitätsprüfung, Cookie-Zuordnung über mehrere Webinstanzen, Zugriffstrennung, Zeitlimit, Abbruch, Neustart und Bereinigung geprüft. Isolierte Dienst-/Updatetests decken Erfolgsfall sowie Konfigurations- und Bereitschaftsfehler mit Rückfall ab; Shell-Syntaxprüfungen erfolgreich.
- Ein unverändertes Original in drei getrennten Browserzugängen mit allen Rastermodi über die neue Queue verarbeitet: jeweils 3307 × 4419 Pixel, binäres Alpha und 300 ppi, maximal ein laufender Auftrag, lokal etwa 9,1 Sekunden Gesamtdauer. Echte Debian-Installation/Umstellung, visuelle Browserprüfung der neuen Bedienelemente, LXC-Lasttest und Druckabnahme bleiben offen.

## 0.3.0 – 19. November 2026

- Anwender bestätigt die Exportbenennung und beauftragt den nächsten Punkt des Etappenplans. Weitere Rastermodi als nächste Entwicklungsstufe umgesetzt.
- „Einfarbig nach Helligkeit“ mit frei wählbarer Druckfarbe und Umkehrung ergänzt. Schwarzpunkt, Weißpunkt und Gamma steuern die Helligkeitsmaske unter „Erweitert · Tonwerte“; neutrale Vorgaben und Zurücksetzen sind verfügbar.
- „Transparenz rastern“ ergänzt: weiche Transparenz wird gerastert, vollständig deckende Innenbereiche bleiben gefüllt und die Originalfarben erhalten. Alpha wird in allen Modi genau einmal angewendet; der Export bleibt binär.
- „Farbig auflockern“ bleibt die Vorgabe. Deckung, Druckfarbe und Tonwertfelder erscheinen nur in den passenden Modi. Neue Einstellungen und Moduswechsel entwerten bisherige Ergebnisse und Downloads. Ganzbildverarbeitung und gewünschtes Dateinamensschema bleiben erhalten.
- Unnötige Alpha-Konvertierung bei unveränderter Pixelgröße vermieden, um die ursprünglichen Farben exakt zu erhalten.
- Reproduzierbares Benchmarkskript um `--mode` ergänzt. Synthetische Standardausgabe lokal mit 178,5 MiB Prozessspeicherspitze im Helligkeitsmodus und 202,9 MiB im Transparenzmodus gemessen; Details und Messgrenzen in der Architektur dokumentiert.
- 37 Python-Tests und zwölf JavaScript-Zustandstests erfolgreich. Vorhandenes Original in beiden neuen Modi bei Standard-Druckgröße und 45° über die API geprüft; synthetische Vergleichstafel visuell geprüft. Browser-/Druckabnahme und LXC-Lasttest offen. Automatische Tonwerte und Entrauschung folgen separat.
- README, Bedienung, Architektur und Roadmap nachgeführt. Installationsvoraussetzungen und Installations-/Updateskripte unverändert.

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
