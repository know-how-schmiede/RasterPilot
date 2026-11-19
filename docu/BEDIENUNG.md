# Bild vorbereiten, rastern und als PNG speichern

Die Einstellungen sind experimentell und noch nicht anhand eines Druckprofils kalibriert. RasterPilot erzeugt die Bildvorlage; Weißunterlegung, Separation und Druckeransteuerung übernimmt weiterhin die RIP-Software.

## 1. Bild auswählen

Unter „Bild auswählen“ eine PNG- oder JPEG-Datei öffnen, höchstens 20 MiB und 40 Megapixel. Das Original wird an diesen RasterPilot-Server übertragen. Vorschau, Orientierung und Farbkonvertierung erfolgen im Arbeitsspeicher. Für die Hintergrundberechnung werden Original und Ergebnis vorübergehend im privaten Datenverzeichnis gespeichert. Der laufende Worker entfernt abgelaufene Aufträge nach einer Stunde; es gibt keine dauerhafte Projektablage. Beim Neuladen der Seite muss das Bild erneut gewählt werden. Ein Sitzungscookie ordnet Aufträge diesem Browserzugang zu; andere Browserzugänge können sie nicht abrufen.

Eine EXIF-Drehung wird vor der Anzeige und Verarbeitung angewendet. Eingebettete Farbprofile werden nach sRGB umgerechnet; ohne Profil erscheint ein Hinweis auf die sRGB-Annahme. Ungültige Profile, CMYK-Bilder ohne Profil und animierte PNG-Dateien werden mit einer Erklärung abgewiesen. Speichere solche Bilder zuvor als einzelnes sRGB-PNG oder -JPEG.

Die Verarbeitung und das PNG-Ergebnis verwenden 8 Bit pro Kanal. 16-Bit-Graustufen-PNGs werden über den vollständigen Tonwertbereich auf 8 Bit umgerechnet.

## 2. Druckgröße

„Druckbreite in cm“ und „Auflösung in ppi“ bestimmen die Ausgabe. Die Höhe ergibt sich aus dem Seitenverhältnis. Beispiel: Ein quadratisches Motiv mit 28 cm Breite und 300 ppi ergibt 3307 × 3307 Pixel. Die Auflösung bezeichnet das Bild, nicht die Druckerhardware; 300 ppi ist eine vorläufige Vorgabe.

Es wird immer das vollständige Bild verarbeitet und ausgegeben. Das Seitenverhältnis und alle Bildränder bleiben erhalten; einen Zuschnitt gibt es vorerst nicht. Die Pixelmaße ergeben sich weiterhin aus Druckbreite und Auflösung. Das Original wird nicht überschrieben.

Ein Export darf seit 0.2.2 höchstens 40 Megapixel und 12000 Pixel je Kante haben. Ein Midjourney-Hochformat mit 1904 × 2544 Pixeln ergibt bei 28 cm Breite und 300 ppi beispielsweise 3307 × 4419 Pixel (etwa 14,6 Megapixel). Es kann unverändert importiert und mit diesen Vorgaben gerastert werden.

Die Exportgrenze bezieht sich auf die berechneten Druckmaße, nicht auf die Dateigröße oder die Pixelzahl des Originals. Bei Überschreitung bleibt das vollständige Original sichtbar; Berechnung und Download werden gesperrt. Druckbreite oder Auflösung innerhalb der Anwendung verringern; eine extern verkleinerte Eingabedatei ist dafür nicht erforderlich. Starkes Vergrößern kann das Motiv sichtbar unscharf machen.

## 3. Raster berechnen

Unter „Rastermodus“ stehen drei Verfahren zur Wahl:

- **Farbig auflockern:** Die bisherige Vorgabe. Bildfarben einschließlich Weiß bleiben erhalten. Die Deckung bestimmt die transparenten Lücken; Weiß wird nicht automatisch freigestellt.
- **Einfarbig nach Helligkeit:** Dunkle Bildstellen erzeugen mehr Druckfläche, helle weniger. „Druckfarbe“ bestimmt die Farbe aller Punkte, unabhängig von der Textilfarbe der Ansicht. Schwarz wird bei neutralen Tonwerten gefüllt, Weiß transparent. „Helligkeit umkehren“ kehrt diese Zuordnung um, beispielsweise für helle Druckfarbe auf dunklem Textil. Vorhandene Transparenz wird weiterhin berücksichtigt.
- **Transparenz rastern:** Weiche Transparenz wird in deckende Punkte und transparente Lücken umgewandelt. Vollständig transparente Stellen bleiben leer, deckende Innenbereiche bleiben gefüllt. Bildfarben bleiben erhalten. Ohne vorhandene Transparenz entstehen keine Lücken. Die Deckung aus dem Farbmodus wird hier nicht zusätzlich angewendet.

Im Helligkeitsmodus öffnet „Erweitert · Tonwerte“ die manuelle Korrektur der Helligkeitsmaske:

- **Schwarzpunkt (0–254):** Helligkeiten bis zu diesem Wert gelten als Schwarz. Höhere Werte vergrößern im normalen Modus die Druckfläche.
- **Weißpunkt (1–255):** Helligkeiten ab diesem Wert gelten als Weiß. Niedrigere Werte verringern im normalen Modus die Druckfläche. Schwarzpunkt muss kleiner als Weißpunkt sein.
- **Gamma (0,1–5):** Verändert die mittleren Tonwerte. Über 1 entsteht im normalen Modus weniger Druckfläche, unter 1 mehr. Bei Umkehr gilt die umgekehrte Wirkung.
- **Tonwerte zurücksetzen:** Stellt Schwarzpunkt 0, Weißpunkt 255 und Gamma 1 wieder her.

Die Tonwerte verändern ausschließlich die Helligkeitsmaske im einfarbigen Modus. Originalvergleich und andere Modi behalten ihre Farben. Automatische Tonwerte und Entrauschung sind noch nicht implementiert.

- **Rasterabstand in mm:** Abstand der Punktmittelpunkte, kein Punktdurchmesser. Mindestens zwei Ausgabepixel Abstand sind erforderlich; das ist eine technische Abtastgrenze und keine geprüfte Mindestdruckgröße.
- **Rasterwinkel in °:** Von −180° bis +180°, Vorgabe 0°. Positive Winkel drehen das Punktraster im Uhrzeigersinn um die linke obere Bildkante. Beispielsweise erzeugt 45° ein diagonales Raster. Das Motiv selbst wird weder gedreht noch beschnitten; Pixelmaße und Rasterabstand bleiben gleich.
- **Deckung in % (nur Farbig auflockern):** Mehr Deckung bedeutet mehr bedruckte Fläche. 0 % ergibt ein leeres Bild; 100 % füllt vollständig deckende Motivbereiche. Weiche Transparenz reduziert die lokale Punktfläche. Der exportierte Alphakanal bleibt in allen Modi binär.
- **Raster berechnen:** Überträgt das Original mit den Einstellungen erneut an den Server und erstellt das endgültige PNG. Änderungen an Druckgröße, Rastermodus, Rasterabstand, Winkel, Deckung, Druckfarbe, Umkehrung oder Tonwerten entwerten das bisherige Ergebnis; danach erneut berechnen.

Die Kreispunktfläche wird aus der Deckung bestimmt. Bei hohen Deckungen berühren sich die Punkte und die Lücken werden kleiner. Pixelrundung, kleine Rasterabstände und angeschnittene Motivkanten können von der theoretischen Deckung abweichen. Mindestpunkte und Mindestlücken werden noch nicht anhand eines Druckprofils geprüft.

Die Berechnung läuft im Hintergrund. Die Meldung zeigt „Warteschlange“ oder „wird berechnet“; ein genauer Prozentfortschritt wird nicht geschätzt. Ein Auftrag wird jeweils verarbeitet, höchstens vier dürfen gleichzeitig aktiv oder wartend sein. Pro Browserzugang ist ein aktiver Auftrag erlaubt. Mehrere Tabs desselben Browserprofils teilen diese Zuordnung. Bei voller Warteschlange später erneut versuchen.

„Berechnung abbrechen“ beendet den eigenen Auftrag. Neue Einstellungen oder ein anderes Bild brechen eine vorherige Berechnung ebenfalls ab. Verspätete Ergebnisse ersetzen keine neueren Einstellungen. Ein Auftrag darf standardmäßig höchstens 180 Sekunden rechnen; danach Druckgröße oder Auflösung reduzieren und erneut versuchen. Ohne erreichbaren Worker ist keine neue Berechnung möglich. Während eines Updates oder Dienstneustarts unterbrochene Aufträge bitte erneut starten.

## 4. Prüfen und herunterladen

Die Einstellungen unter „Ansicht“ befinden sich direkt über der Bildvorschau. Unter „Vergleich“ zwischen Originalbild und Rasterergebnis wechseln. Das Original ist eine auf 1600 Pixel Kantenlänge begrenzte Vorschau; das Rasterergebnis stammt direkt aus der vollständigen Exportdatei.

„Einpassen“ zeigt das gesamte Ergebnis. „100 % · Exportpixel prüfen“ zeigt einen Bildpixel je CSS-Pixel; bei großen Dateien innerhalb der Vorschau scrollen. Die verkleinerte Darstellung kann feine Raster verfälschen. Browserzoom beeinflusst die Bildschirmgröße zusätzlich.

Textilfarbe und Transparenzraster sind reine Ansichtshilfen. Änderungen daran erfordern keine neue Berechnung und verändern die Druckdatei nicht.

„PNG herunterladen“ speichert die aktuelle Ergebnisdatei unter `<Originalname>_rp_<Druckbreite in mm>_<Auflösung>ppi_<Winkel>G.png`. Die ursprüngliche Dateiendung wird ersetzt. Beispiel: Aus `Eichhörnchen.jpg` wird bei 28 cm Breite, 300 ppi und 45° die Datei `Eichhörnchen_rp_280_300ppi_45G.png`. Negative Winkel erhalten ihr Minuszeichen. Leerzeichen, Umlaute und weitere Punkte im Originalnamen bleiben erhalten; unzulässige Zeichen werden durch Unterstriche ersetzt und sehr lange Namen gekürzt. Die Unterstriche zwischen den Parametern sind auch unter Windows verwendbar. Deckung und Rasterabstand sind nicht im Namen enthalten.

Die Datei enthält sRGB-Profil, Pixelmaße und Auflösungsmetadaten, aber weder Textilfarbe noch Schachbrett. Die berechnete Druckbreite in der RIP-Software kontrollieren und das bereits gerasterte Bild dort nicht nachträglich skalieren. Vor einer Produktion sind Testdruck und Kalibrierung erforderlich.

Das Dateinamensschema bleibt in allen Modi gleich. Modus, Druckfarbe und Tonwerte sind nicht im Namen enthalten; Varianten bei Bedarf beim Speichern unterscheiden.

## 5. Einstellungen speichern und laden

Über „Einstellungen speichern und laden“ oberhalb der Bildauswahl eine JSON-Datei speichern oder öffnen. Die Datei enthält Druckmaße, Auflösung, Rastermodus, Abstand, Winkel, Deckung, Druckfarbe, Umkehrung, Tonwerte sowie Hintergrund, Textilfarbe und Zoom. Sie enthält weder Bilddaten noch Server-Aufträge oder Dateipfade und kann auch ohne gewähltes Bild verwendet werden.

Beim Laden wird die ganze Datei geprüft, bevor Werte übernommen werden. Beschädigte Dateien, unbekannte Versionen, unzulässige Werte und Dateien über 64 KiB werden abgewiesen; die bisherigen Einstellungen und ein vorhandenes Ergebnis bleiben dabei erhalten. Nach erfolgreichem Laden das Raster neu berechnen. Ein Originalbild muss bei Bedarf erneut ausgewählt werden. Die Ansicht startet nach dem Laden beim Original; ein gespeicherter Zoom wird für das nächste Ergebnis übernommen.

## Bei Fehlern

Die Meldung im Bedienfeld erklärt Bild- und Parameterfehler. HTTP 413 beim Import kann bei älteren Installationen auf das Nginx-Uploadlimit hinweisen; siehe [Installation und Update](INSTALLATION_Debian13.md#bestehende-installation-auf-020-umstellen). Bei „Hintergrunddienst nicht bereit“ den Workerstatus prüfen. HTTP 429 bedeutet, dass Kapazität, temporärer Speicher oder der eigene aktive Auftrag eine weitere Annahme verhindern. Bei abgelaufenen Ergebnissen erneut berechnen. Wenn der Worker ausgeschaltet ist, erfolgt auch die Bereinigung erst nach seinem nächsten Start.
