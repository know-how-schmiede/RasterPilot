# Architektur

## Ab 0.2.0: farbige Rasterung und PNG-Export

Etappe 3 ergänzt einen von Flask unabhängigen Verarbeitungskern in `rasterpilot/processing`. Pillow dekodiert PNG/JPEG, wendet EXIF-Orientierung an und konvertiert eingebettete ICC-Profile nach sRGB. Ohne Profil gilt die angezeigte sRGB-Annahme; CMYK/LAB ohne Profil und unlesbare Profile werden abgewiesen. NumPy berechnet das regelmäßige, ungedrehte Punktraster in Zeilenblöcken. Zuschnitt und Skalierung mit vormultipliziertem Alpha erfolgen vor der Rasterung in endgültiger Ausgabeauflösung.

Zwei zustandslose Endpunkte sind implementiert: `/api/prepare` liefert eine normalisierte Bildvorschau samt Originalmaßen, `/api/render` liefert das endgültige PNG. Die Oberfläche überträgt dafür jeweils das Original an den eigenen Server. Bilder und Ergebnisse werden begrenzt im Arbeitsspeicher verarbeitet, ohne Projektablage oder fremde Bilddienste. Ein angepasster Flask-Request hält Uploads im Speicher; Nginx verwendet deaktivierte Anfrage-/Antwortpufferung und HTTP/1.1 zum Upstream. Anfragen sind auf 21 MiB einschließlich Multipart-Daten, Bilder auf 20 MiB/40 Megapixel und Ausgaben auf 12 Megapixel/12000 Pixel je Kante begrenzt. Parameter und Dimensionen werden vor der Zielbildallokation geprüft. Es gibt keine gespeicherten Jobs oder Downloads anderer Zugänge. API-Antworten tragen `Cache-Control: no-store`. Ein eigener Anfrageheader und die Origin-Prüfung wehren fremde Formularanfragen ab; CORS wird nicht freigegeben. Ein separater Job-Worker mit Warteschlange bleibt Etappe 5; noch keine Freigabe für öffentlichen Produktionsbetrieb. Das synchrone Verfahren bindet während einer Berechnung einen Webprozess; Abbruch im Browser beendet eine bereits gestartete Serverberechnung nicht garantiert.

Die Ergebnisvorschau und der Download verwenden dasselbe berechnete PNG. Originalvergleich, Textilfarbe, Transparenzraster und eine Ansicht mit einem Bildpixel je CSS-Pixel ergänzen die Prüfung. Änderungen an Parametern entwerten das bisherige Ergebnis. Automatische Druckprofilprüfung und physische Kalibrierung bleiben spätere Schritte.

### Rasterformel

Der Rasterabstand in Pixeln ist `s = Abstand_mm / 25,4 × ppi`. Er muss mindestens zwei Pixel betragen. Die Pixelmitte wird in der periodischen Einheitszelle auf Koordinaten `u,v ∈ [-0,5; 0,5]` abgebildet. Für `q = u² + v²` ist der Flächenrang bis `q = 0,25` gleich `F(q) = πq`. Darüber gilt `F(q) = πq − 4 × (q × acos(0,5 / sqrt(q)) − 0,5 × sqrt(q − 0,25))`. Damit werden über die Zellgrenzen hinausreichende Kreisteile bei hoher Deckung berücksichtigt; die verbleibenden Lücken schließen sich bei 100 % vollständig. Der Kreisradius wird somit aus der Fläche abgeleitet, statt linear aus dem Reglerwert.

Die gewünschte lokale Deckung lautet `c = (Deckung_% / 100) × (Alpha / 255)`. Ein Pixel wird vollständig deckend, wenn `F(q) < c`; vollständig transparente Eingabepixel bleiben leer und `c = 1` ist vollständig gefüllt. Farbe und Textilansicht beeinflussen die Deckungsmaske nicht; Weiß wird erhalten. Das vorhandene Alpha wird genau einmal berücksichtigt. An angeschnittenen Zellen, Motivkanten und bei kleinen Pixelabständen sind durch die diskrete Abtastung Abweichungen von der theoretischen Flächendeckung möglich. Profile, Mindeststrukturprüfung und Bereinigung sind noch nicht implementiert.

### Prüfstand 18. November 2026

Automatisiert geprüft: Flächenanteile und monotone Deckung einschließlich hoher Deckung, leere/gefüllte Motive, Weiß, weiche und vollständige Transparenz, Farbsaumvermeidung, Zuschnitt vor Skalierung, Bildorientierung, Profilbehandlung, Größen-/Parameterfehler, API und Schutz gegen veraltete Ergebnisse. `python -m unittest discover -s tests` und `node --test tests/test_ui.cjs` führen die Prüfungen aus. Die JavaScript-Prüfungen simulieren den Oberflächenzustand und ersetzen keine Browserprüfung.

`python scripts/benchmark_processing.py` erzeugt ein reproduzierbares 2400 × 2400 großes synthetisches Rauschmotiv und berechnet 28 × 28 cm bei 300 ppi, Abstand 1 mm und 65 % Deckung. Lokal unter Windows 11 / Python 3.12.15 / Pillow 12.3.0 / NumPy 2.5.5: 3307 × 3307 Pixel, 1,373 s für Dekodieren/Rastern/PNG, 208,5 MiB maximale Prozessspeicherbelegung, Eingabe 16,50 MiB und Ausgabe 26,15 MiB. Das ist keine Messung auf dem Debian-LXC, enthält keinen HTTP-Transfer und keine Mehrbenutzerlast. Der Zielsystemtest unter 4 GB RAM und die manuelle Browser-/Druckabnahme der neuen Funktionen stehen aus.

## Bisheriger Stand bis 0.1.1

Flask liefert die Oberfläche und einen Health-Endpunkt. Der Browser lädt und verarbeitet die Datei für die Vorschau lokal; Bilder werden nicht zum Server übertragen oder dort gespeichert. Die Browseroberfläche verwaltet Originalbild, rechteckigen Zuschnitt, Druckbreite, Auflösung und Textilfarbe getrennt. Der Zuschnitt wird nicht destruktiv aus dem Original dargestellt. Browserdekodierung berücksichtigt die Bildorientierung; die Darstellung nutzt den Alphakanal.

Die Druckmaße werden aus dem Seitenverhältnis des Zuschnitts und `round(Breite in cm / 2,54 × ppi)` abgeleitet. Die Vorschau ist keine Druckdatei. Die Anzeige ist auf 1600 Pixel Kantenlänge begrenzt; die berechneten Exportmaße bleiben davon unabhängig. Ein späterer Verarbeitungskern erhält Originaldaten und Parameter getrennt von Flask und Oberfläche. Ein separater Worker, persistente Jobs und Export gehören zu späteren Meilensteinen.

Zur Begrenzung lokaler Ressourcen werden Dateien über 20 MiB und dekodierte Bilder über 40 Megapixel abgewiesen. Das Decodieren findet vor der Pixelprüfung im Browser statt; die Grenze verhindert daher nicht jede kurzzeitige Speicherspitze. Der Browser bestimmt die Behandlung eingebetteter Farbprofile; eine explizite sRGB-Konvertierung wird für den späteren Export benötigt.
