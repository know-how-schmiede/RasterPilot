# Bild vorbereiten, auflockern und als PNG speichern

Die Einstellungen sind experimentell und noch nicht anhand eines Druckprofils kalibriert. RasterPilot erzeugt die Bildvorlage; Weißunterlegung, Separation und Druckeransteuerung übernimmt weiterhin die RIP-Software.

## 1. Bild auswählen

Unter „Bild auswählen“ eine PNG- oder JPEG-Datei öffnen, höchstens 20 MiB und 40 Megapixel. Das Original wird an diesen RasterPilot-Server übertragen. Dort erfolgen Dekodierung, Orientierung und Farbkonvertierung im Arbeitsspeicher; es werden keine Bilddateien oder Projekte gespeichert. Beim Neuladen der Seite muss das Bild erneut gewählt werden.

Eine EXIF-Drehung wird vor der Anzeige und Verarbeitung angewendet. Eingebettete Farbprofile werden nach sRGB umgerechnet; ohne Profil erscheint ein Hinweis auf die sRGB-Annahme. Ungültige Profile, CMYK-Bilder ohne Profil und animierte PNG-Dateien werden mit einer Erklärung abgewiesen. Speichere solche Bilder zuvor als einzelnes sRGB-PNG oder -JPEG.

Die Verarbeitung und das PNG-Ergebnis verwenden 8 Bit pro Kanal. 16-Bit-Graustufen-PNGs werden über den vollständigen Tonwertbereich auf 8 Bit umgerechnet.

## 2. Druckgröße

„Druckbreite in cm“ und „Auflösung in ppi“ bestimmen die Ausgabe. Die Höhe ergibt sich aus dem Seitenverhältnis. Beispiel: Ein quadratisches Motiv mit 28 cm Breite und 300 ppi ergibt 3307 × 3307 Pixel. Die Auflösung bezeichnet das Bild, nicht die Druckerhardware; 300 ppi ist eine vorläufige Vorgabe.

Es wird immer das vollständige Bild verarbeitet und ausgegeben. Das Seitenverhältnis und alle Bildränder bleiben erhalten; einen Zuschnitt gibt es vorerst nicht. Die Pixelmaße ergeben sich weiterhin aus Druckbreite und Auflösung. Das Original wird nicht überschrieben.

Ein Export darf seit 0.2.2 höchstens 40 Megapixel und 12000 Pixel je Kante haben. Ein Midjourney-Hochformat mit 1904 × 2544 Pixeln ergibt bei 28 cm Breite und 300 ppi beispielsweise 3307 × 4419 Pixel (etwa 14,6 Megapixel). Es kann unverändert importiert und mit diesen Vorgaben gerastert werden.

Die Exportgrenze bezieht sich auf die berechneten Druckmaße, nicht auf die Dateigröße oder die Pixelzahl des Originals. Bei Überschreitung bleibt das vollständige Original sichtbar; Berechnung und Download werden gesperrt. Druckbreite oder Auflösung innerhalb der Anwendung verringern; eine extern verkleinerte Eingabedatei ist dafür nicht erforderlich. Starkes Vergrößern kann das Motiv sichtbar unscharf machen.

## 3. Raster berechnen

Der erste Modus heißt „Farbig auflockern“. Bildfarben einschließlich Weiß bleiben erhalten, zwischen den Punkten entstehen transparente Lücken. Weiß wird nicht automatisch freigestellt.

- **Rasterabstand in mm:** Abstand der Punktmittelpunkte, kein Punktdurchmesser. Mindestens zwei Ausgabepixel Abstand sind erforderlich; das ist eine technische Abtastgrenze und keine geprüfte Mindestdruckgröße.
- **Rasterwinkel in °:** Von −180° bis +180°, Vorgabe 0°. Positive Winkel drehen das Punktraster im Uhrzeigersinn um die linke obere Bildkante. Beispielsweise erzeugt 45° ein diagonales Raster. Das Motiv selbst wird weder gedreht noch beschnitten; Pixelmaße und Rasterabstand bleiben gleich.
- **Deckung in %:** Mehr Deckung bedeutet mehr bedruckte Fläche. 0 % ergibt ein leeres Bild; 100 % füllt vollständig deckende Motivbereiche. Weiche Transparenz reduziert die lokale Punktfläche. Der exportierte Alphakanal bleibt dabei binär.
- **Raster berechnen:** Überträgt das Original mit den Einstellungen erneut an den Server und erstellt das endgültige PNG. Änderungen an Druckgröße, Rasterabstand, Winkel oder Deckung entwerten das bisherige Ergebnis; danach erneut berechnen.

Die Kreispunktfläche wird aus der Deckung bestimmt. Bei hohen Deckungen berühren sich die Punkte und die Lücken werden kleiner. Pixelrundung, kleine Rasterabstände und angeschnittene Motivkanten können von der theoretischen Deckung abweichen. Mindestpunkte und Mindestlücken werden noch nicht anhand eines Druckprofils geprüft.

## 4. Prüfen und herunterladen

Die Einstellungen unter „Ansicht“ befinden sich direkt über der Bildvorschau. Unter „Vergleich“ zwischen Originalbild und Rasterergebnis wechseln. Das Original ist eine auf 1600 Pixel Kantenlänge begrenzte Vorschau; das Rasterergebnis stammt direkt aus der vollständigen Exportdatei.

„Einpassen“ zeigt das gesamte Ergebnis. „100 % · Exportpixel prüfen“ zeigt einen Bildpixel je CSS-Pixel; bei großen Dateien innerhalb der Vorschau scrollen. Die verkleinerte Darstellung kann feine Raster verfälschen. Browserzoom beeinflusst die Bildschirmgröße zusätzlich.

Textilfarbe und Transparenzraster sind reine Ansichtshilfen. Änderungen daran erfordern keine neue Berechnung und verändern die Druckdatei nicht.

„PNG herunterladen“ speichert die aktuelle Ergebnisdatei unter `<Originalname>_rp_<Druckbreite in mm>_<Auflösung>ppi_<Winkel>G.png`. Die ursprüngliche Dateiendung wird ersetzt. Beispiel: Aus `Eichhörnchen.jpg` wird bei 28 cm Breite, 300 ppi und 45° die Datei `Eichhörnchen_rp_280_300ppi_45G.png`. Negative Winkel erhalten ihr Minuszeichen. Leerzeichen, Umlaute und weitere Punkte im Originalnamen bleiben erhalten; unzulässige Zeichen werden durch Unterstriche ersetzt und sehr lange Namen gekürzt. Die Unterstriche zwischen den Parametern sind auch unter Windows verwendbar. Deckung und Rasterabstand sind nicht im Namen enthalten.

Die Datei enthält sRGB-Profil, Pixelmaße und Auflösungsmetadaten, aber weder Textilfarbe noch Schachbrett. Die berechnete Druckbreite in der RIP-Software kontrollieren und das bereits gerasterte Bild dort nicht nachträglich skalieren. Vor einer Produktion sind Testdruck und Kalibrierung erforderlich.

## Bei Fehlern

Die Meldung im Bedienfeld erklärt Bild- und Parameterfehler. HTTP 413 beim Import kann bei älteren Installationen auf das Nginx-Uploadlimit hinweisen; siehe [Installation und Update](INSTALLATION_Debian13.md#bestehende-installation-auf-020-umstellen). Bei Serverfehlern das Dienstprotokoll prüfen. Eine abgebrochene Browseranfrage kann serverseitig noch bis zum Abschluss ihrer begrenzten Berechnung laufen. Eine Warteschlange, gespeicherte Einstellungen, weitere Rastermodi und Hintergrundberechnung folgen später.
