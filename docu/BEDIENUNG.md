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

Unter „Rastermodus“ stehen vier Verfahren zur Wahl:

- **Farbig auflockern:** Die bisherige Vorgabe. Bildfarben einschließlich Weiß bleiben erhalten. Die Deckung bestimmt die transparenten Lücken; Weiß wird nicht automatisch freigestellt.
- **Schwarz durch Shirt ersetzen:** Schwarze Bildstellen werden transparent. Weiße und kräftige Farbflächen bleiben geschlossen, Übergänge zu Schwarz werden gerastert. Die Punktfarben werden dafür aufgehellt: Grau entsteht aus hellen Punkten auf schwarzem Shirt, Dunkelrot aus roten Punkten und Shirt. Nur Schwarz- und Weißpunkt sind als Tonwerte einstellbar. Dieser Modus ersetzt ab 0.6.0 den bisherigen Affinity-Modus.
- **Einfarbig nach Helligkeit:** Dunkle Bildstellen erzeugen mehr Druckfläche, helle weniger. „Druckfarbe“ bestimmt die Farbe aller Punkte, unabhängig von der Textilfarbe der Ansicht. Schwarz wird bei neutralen Tonwerten gefüllt, Weiß transparent. „Helligkeit umkehren“ kehrt diese Zuordnung um, beispielsweise für helle Druckfarbe auf dunklem Textil. Vorhandene Transparenz wird weiterhin berücksichtigt.
- **Transparenz rastern:** Weiche Transparenz wird in deckende Punkte und transparente Lücken umgewandelt. Vollständig transparente Stellen bleiben leer, deckende Innenbereiche bleiben gefüllt. Bildfarben bleiben erhalten. Ohne vorhandene Transparenz entstehen keine Lücken. Die Deckung aus dem Farbmodus wird hier nicht zusätzlich angewendet.

Im einfarbigen Modus öffnet „Erweitert · Tonwerte“ die manuelle Korrektur der Helligkeitsmaske:

- **Schwarzpunkt (0–254):** Helligkeiten bis zu diesem Wert gelten als Schwarz. Höhere Werte vergrößern im normalen Modus die Druckfläche.
- **Weißpunkt (1–255):** Helligkeiten ab diesem Wert gelten als Weiß. Niedrigere Werte verringern im normalen Modus die Druckfläche. Schwarzpunkt muss kleiner als Weißpunkt sein.
- **Gamma (0,1–5, nur einfarbiger Modus):** Verändert die mittleren Tonwerte. Über 1 entsteht im normalen Modus weniger Druckfläche, unter 1 mehr. Bei Umkehr gilt die umgekehrte Wirkung.
- **Tonwerte zurücksetzen:** Stellt im einfarbigen Modus Schwarzpunkt 0, Weißpunkt 255 und Gamma 1 wieder her.

Die Tonwerte verändern hier ausschließlich die Helligkeitsmaske; die gewählte Druckfarbe bleibt unverändert. Automatische Tonwerte und Entrauschung sind noch nicht implementiert. Schwarz-/Weißwerte werden je Tonwertmodus getrennt erhalten, wenn du zwischen den Modi wechselst; Gamma bleibt dem einfarbigen Modus zugeordnet.

### Schwarz durch schwarzes Shirt ersetzen

1. „Schwarz durch Shirt ersetzen“ auswählen. Bei der ersten manuellen Auswahl wechselt die Vorschau auf schwarzen Textilhintergrund. Geladene Ansichtseinstellungen bleiben erhalten. Der Modus ist für schwarze Shirts berechnet; eine andere Vorschaufarbe ändert die Druckdatei nicht.
2. Rasterabstand und Winkel für die Druckgröße einstellen. Die frühere Handout-Beispielschaltfläche entfällt, da nun ein anderes Verfahren verwendet wird.
3. Unter **„Erweitert · Tonwerte“** bei Bedarf **Schwarzpunkt** und **Weißpunkt** abstimmen. Entscheidend ist der stärkste RGB-Kanal, nicht die gewichtete Helligkeit. Bis zum Schwarzpunkt bleibt der Pixel transparent; ab dem Weißpunkt bleibt die Farbfläche geschlossen. Dazwischen wächst die Punktfläche kontinuierlich. Höherer Schwarzpunkt entfernt mehr dunkle Anteile, niedrigerer Weißpunkt macht Flächen früher geschlossen. Schwarzpunkt muss kleiner als Weißpunkt sein.
4. Vorgabe und „Tonwerte zurücksetzen“ sind **Schwarzpunkt 0, Weißpunkt 245**. So bleiben auch nahezu weiße und sehr kräftige Farbflächen geschlossen. Gamma, Umkehrung, Maskenkontrast und Mischmodus haben in diesem Modus keine Wirkung und werden nicht angeboten.
5. Die Farbe der Rasterpunkte wird durch die berechnete Farbdeckung geteilt und auf den gültigen Kanalbereich begrenzt. Bei neutralen Grenzen 0/255 wird beispielsweise mittleres Grau ungefähr durch 50 % weiße Punkte auf Schwarz nachgebildet; ein dunkler Rotton durch hellere rote Punkte und Shirt. So wird das Motiv nicht zusätzlich durch unveränderte dunkle Punktfarben abgedunkelt. Geschlossene Flächen behalten ihre Originalfarben. Vorhandenes Alpha wird einmal berücksichtigt und bleibt auch bei vollständig geschlossener Farbdeckung wirksam.
6. Raster berechnen und Ergebnis auf Schwarz sowie bei 100 % prüfen. Einstellungen als JSON und das Original separat aufbewahren. Das PNG enthält nur das Ergebnis mit transparenten Lücken, keine Testhintergründe oder ausgeblendeten Ebenen.

Die Helligkeitserhaltung ist eine rechnerische sRGB-Näherung. Veränderte Schwarz-/Weißgrenzen können Punktfarben an 255 begrenzen und dunkle Details verlieren. Der Druck auf Textil hängt zusätzlich vom Druckprofil ab; Probedruck und Kalibrierung bleiben erforderlich. Die [Architektur](ARCHITEKTUR.md#060-schwarz-durch-shirt-ersetzen) beschreibt die Formeln.

### Gemeinsame Rastereinstellungen

- **Rasterabstand in mm:** Abstand der Punktmittelpunkte, kein Punktdurchmesser. Einstellbar in Schritten von 0,001 mm. Mindestens zwei Ausgabepixel Abstand sind erforderlich; das ist eine technische Abtastgrenze und keine geprüfte Mindestdruckgröße.
- **Rasterwinkel in °:** Von −180° bis +180°, Vorgabe 0°. Positive Winkel drehen das Punktraster im Uhrzeigersinn um die linke obere Bildkante. Beispielsweise erzeugt 45° ein diagonales Raster. Das Motiv selbst wird weder gedreht noch beschnitten; Pixelmaße und Rasterabstand bleiben gleich.
- **Deckung in % (nur Farbig auflockern):** Mehr Deckung bedeutet mehr bedruckte Fläche. 0 % ergibt ein leeres Bild; 100 % füllt vollständig deckende Motivbereiche. Weiche Transparenz reduziert die lokale Punktfläche. Der exportierte Alphakanal bleibt in allen Modi binär.
- **Raster berechnen:** Überträgt das Original mit den Einstellungen erneut an den Server und erstellt das endgültige PNG. Änderungen an Druckgröße, Rastermodus, Rasterabstand, Winkel, Deckung, Druckfarbe, Umkehrung oder Tonwerten entwerten das bisherige Ergebnis; danach erneut berechnen.

Die Kreispunktfläche wird aus der Deckung bestimmt. Bei hohen Deckungen berühren sich die Punkte und die Lücken werden kleiner. Pixelrundung, kleine Rasterabstände und angeschnittene Motivkanten können von der theoretischen Deckung abweichen. Mindestpunkte und Mindestlücken werden noch nicht anhand eines Druckprofils geprüft.

Die Berechnung läuft im Hintergrund. Ein Auftrag wird jeweils verarbeitet, bis zu **zehn Aufträge dürfen insgesamt aktiv oder wartend sein**. Du kannst mehrere Aufträge aus demselben Browserprofil einreichen: Nach der Annahme ist „Raster berechnen“ wieder verfügbar. Bilder oder Einstellungen können für weitere Varianten geändert werden. Die ursprünglichen Einstellungen bleiben beim angenommenen Auftrag gespeichert. Speicherquote und insgesamt gespeicherte Ergebnisse können die Annahme zusätzlich begrenzen.

Unter der Vorschau steht **„Deine Aufträge“**. Die Liste zeigt nur Einträge dieses Browserprofils, jeweils mit dem Originaldateinamen einschließlich Endung, Status und globaler Warteposition. Namen anderer Nutzer bleiben verborgen. Die Zeile „Gesamt: … von 10 Plätzen belegt“ zeigt die anonyme Gesamtauslastung. Die Liste aktualisiert sich etwa alle zwei Sekunden. Mehrere Tabs mit demselben Sitzungscookie sehen dieselben eigenen Aufträge. Vor 0.7.0 erstellte Einträge ohne gespeicherten Originalnamen erscheinen als „Früherer Auftrag“.

- **Wartend / Wird berechnet:** „Abbrechen“ in der betreffenden Zeile beendet diesen Auftrag. Der Knopf „Berechnung abbrechen“ betrifft den gerade in der Vorschau begleiteten Auftrag. Läuft die Übertragung noch, erscheint der Auftrag nach Annahme in der Liste und kann dort abgebrochen werden.
- **Fertig:** Der Status erscheint grün. „Ergebnis anzeigen“ lädt die gespeicherte Ausgabe in die Vorschau; „PNG herunterladen“ speichert sie direkt. Beides funktioniert auch ohne neu gewähltes Originalbild. Die Ergebnisvorschau nennt den Originaldateinamen. Die aktuellen Eingabewerte werden nicht durch die gespeicherten Auftragswerte ersetzt; der Originalvergleich wird bei solchen gespeicherten Ergebnissen deaktiviert, damit nicht ein anderes Bild verglichen wird.
- **Fehlgeschlagen / Abgebrochen:** Der Zustand und gegebenenfalls die Fehlermeldung werden angezeigt, ein Download wird nicht angeboten. Abgebrochene Einträge können durch die automatische Bereinigung kurzfristig verschwinden.
- **Entfernen:** Entfernt einen abgeschlossenen Eintrag aus dem Zugriff. Dateien und Speicherreservierung werden beim nächsten Aufräumen freigegeben.

Bild-/Einstellungswechsel und Schließen der Seite lassen bereits angenommene Aufträge weiterlaufen. Ein fertiges Ergebnis bleibt bis zum angezeigten Ablaufzeitpunkt verfügbar, standardmäßig **eine Stunde nach Fertigstellung**. Nach Neuladen oder erneutem Öffnen im selben Browserprofil erscheint es wieder in der Liste. Cookies dürfen dafür nicht gelöscht werden. Andere Browserprofile oder Geräte haben keinen Zugriff. Maximal 20 Aufträge werden insgesamt aufbewahrt; bei vollem Speicher fertige eigene Einträge entfernen oder bis zur Bereinigung warten. Die Liste ersetzt keine dauerhafte Projektablage.

Verspätete Ergebnisse ersetzen keine neueren Eingaben oder bewusst ausgewählten Ergebnisse. Ein Auftrag darf standardmäßig höchstens 180 Sekunden rechnen; danach Druckgröße oder Auflösung reduzieren und erneut versuchen. Ohne erreichbaren Worker ist keine neue Berechnung möglich; vorhandene fertige Ergebnisse bleiben bis zum Ablauf abrufbar. Während eines Updates oder Dienstneustarts unterbrochene laufende Aufträge bitte erneut starten.

## 4. Prüfen und herunterladen

Die Einstellungen unter „Ansicht“ befinden sich direkt über der Bildvorschau. Unter „Vergleich“ zwischen Originalbild und Rasterergebnis wechseln. Das Original ist eine auf 1600 Pixel Kantenlänge begrenzte Vorschau; das Rasterergebnis stammt direkt aus der vollständigen Exportdatei.

„Einpassen“ zeigt das gesamte Ergebnis. „100 % · Exportpixel prüfen“ zeigt einen Bildpixel je CSS-Pixel; bei großen Dateien innerhalb der Vorschau scrollen. Die verkleinerte Darstellung kann feine Raster verfälschen. Browserzoom beeinflusst die Bildschirmgröße zusätzlich.

Textilfarbe und Transparenzraster sind reine Ansichtshilfen. Änderungen daran erfordern keine neue Berechnung und verändern die Druckdatei nicht.

### Tonwertbereiche live anzeigen

Im Modus **„Schwarz durch Shirt ersetzen“** gibt es unter „Ansicht“ den Schalter **„Tonwertbereiche anzeigen“**. Er startet ausgeschaltet. Beim Einschalten wird das aktuell geladene Original angezeigt; die Beschriftung nennt seinen Dateinamen. Die Legende erklärt die Einfärbung:

- **Grün:** Die Fläche bleibt geschlossen und behält die Originalfarbe. Dafür muss der stärkste RGB-Kanal mindestens den Weißpunkt erreichen und das ursprüngliche Alpha vollständig deckend sein.
- **Rot:** Die Fläche wird vollständig entfernt und durch das schwarze Shirt ersetzt. Der stärkste RGB-Kanal erreicht höchstens den Schwarzpunkt.
- **Gelb:** Die Fläche wird gerastert. Dazu zählen die Zwischenstufen und bereits teiltransparente Bereiche, solange sie nicht vollständig entfernt werden.

Bereits vollständig transparente Stellen bleiben unmarkiert. Die Farben werden mit 40 % Stärke eingeblendet; Motivdetails und das ursprüngliche Alpha bleiben erkennbar. Ändere Schwarz- oder Weißpunkt, um die Grenzen live zu verfolgen. Es entstehen weder neue Serveranfragen noch Warteschlangenaufträge. Ein bereits angenommener Auftrag läuft weiter und bleibt über die Auftragsliste erreichbar.

Beim Ausschalten erscheint das unveränderte Original. Die Ergebnisansicht, einschließlich gespeicherter Ergebnisse aus der Auftragsliste, schaltet die Markierung aus. Ohne geladenes Original ist der Schalter deaktiviert; in anderen Rastermodi wird er ausgeblendet. Bei ungültigen Tonwerten verschwindet die Markierung, das Original bleibt sichtbar. Fehler in Druckgröße oder Auflösung verhindern die Flächenkontrolle mit gültigen Tonwerten nicht.

Die Markierung verwendet die auf maximal 1600 Pixel Kantenlänge verkleinerte Importvorschau und zeigt Flächenklassen. Kleine Detailgrenzen können durch die Skalierung vom Export abweichen. Die einzelnen Rasterpunkte weiterhin am berechneten Ergebnis bei 100 % prüfen. Legende und Einfärbung werden nie in das PNG exportiert.

Der Ein-/Aus-Zustand wird in der Einstellungsdatei gespeichert. Wird eine eingeschaltete Ansicht ohne Original geladen, ist sie bis zum Bildimport vorgemerkt. Dateien der bisherigen Versionen 1–3 starten ohne Markierung.

### PNG herunterladen

„PNG herunterladen“ speichert die aktuelle Ergebnisdatei unter `<Originalname>_rp_<Druckbreite in mm>_<Auflösung>ppi_<Winkel>G.png`. Die ursprüngliche Dateiendung wird ersetzt. Beispiel: Aus `Eichhörnchen.jpg` wird bei 28 cm Breite, 300 ppi und 45° die Datei `Eichhörnchen_rp_280_300ppi_45G.png`. Negative Winkel erhalten ihr Minuszeichen. Leerzeichen, Umlaute und weitere Punkte im Originalnamen bleiben erhalten; unzulässige Zeichen werden durch Unterstriche ersetzt und sehr lange Namen gekürzt. Die Unterstriche zwischen den Parametern sind auch unter Windows verwendbar. Deckung und Rasterabstand sind nicht im Namen enthalten.

Die Datei enthält sRGB-Profil, Pixelmaße und Auflösungsmetadaten, aber weder Textilfarbe noch Schachbrett. Die berechnete Druckbreite in der RIP-Software kontrollieren und das bereits gerasterte Bild dort nicht nachträglich skalieren. Vor einer Produktion sind Testdruck und Kalibrierung erforderlich.

Das Dateinamensschema bleibt in allen Modi gleich. Modus, Druckfarbe und Tonwerte sind nicht im Namen enthalten; Varianten bei Bedarf beim Speichern unterscheiden.

## 5. Einstellungen speichern und laden

Über „Einstellungen speichern und laden“ oberhalb der Bildauswahl eine JSON-Datei speichern oder öffnen. Die Datei enthält Druckmaße, Auflösung, Rastermodus, Abstand, Winkel, Deckung, Druckfarbe, Umkehrung und Tonwerte sowie Hintergrund, Textilfarbe, Zoom und den Schalter für die Tonwertüberlagerung. Neue Dateien verwenden **Formatversion 4** und benötigen RasterPilot ab 0.8.0. Vollständige Dateien der Versionen 1–3 bleiben ladbar und erhalten einen ausgeschalteten Überlagerungsschalter. Bei früheren Affinity-Dateien der Versionen 1/2 erscheint weiterhin der Hinweis auf die neue Berechnung mit aufgehellten Punkten; Schwarz-/Weißpunkt, Rastergeometrie und Ansicht werden übernommen. Version 3 verwendet bereits diese Berechnung. Die weiterhin enthaltenen alten Zusatzfelder werden in diesem Modus ignoriert, Umkehrung wird deaktiviert. Die drei anderen Modi behalten ihre Einstellungen und Berechnung. Die Datei enthält weder Bilddaten noch Server-Aufträge oder Dateipfade und kann auch ohne gewähltes Bild verwendet werden.

Beim Laden wird die ganze Datei geprüft, bevor Werte übernommen werden. Beschädigte Dateien, unbekannte Versionen, unzulässige Werte und Dateien über 64 KiB werden abgewiesen; die bisherigen Einstellungen und ein vorhandenes Ergebnis bleiben dabei erhalten. Nach erfolgreichem Laden das Raster neu berechnen. Ein Originalbild muss bei Bedarf erneut ausgewählt werden. Die Ansicht startet nach dem Laden beim Original; ein gespeicherter Zoom wird für das nächste Ergebnis übernommen.

## Bei Fehlern

Die Meldung im Bedienfeld erklärt Bild- und Parameterfehler. HTTP 413 beim Import kann bei älteren Installationen auf das Nginx-Uploadlimit hinweisen; siehe [Installation und Update](INSTALLATION_Debian13.md#bestehende-installation-auf-020-umstellen). Bei „Hintergrunddienst nicht bereit“ den Workerstatus prüfen. HTTP 429 bedeutet, dass Warteschlange, Anzahl gespeicherter Aufträge oder temporärer Speicher eine weitere Annahme verhindern. Bei abgelaufenen Ergebnissen erneut berechnen. Wenn der Worker ausgeschaltet ist, erfolgt auch die Bereinigung erst nach seinem nächsten Start.
