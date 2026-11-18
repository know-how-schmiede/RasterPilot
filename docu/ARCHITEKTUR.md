# Architektur

Flask liefert die Oberfläche und einen Health-Endpunkt. Der Browser lädt und verarbeitet die Datei für die Vorschau lokal; Bilder werden nicht zum Server übertragen oder dort gespeichert. Die Browseroberfläche verwaltet Originalbild, rechteckigen Zuschnitt, Druckbreite, Auflösung und Textilfarbe getrennt. Der Zuschnitt wird nicht destruktiv aus dem Original dargestellt. Browserdekodierung berücksichtigt die Bildorientierung; die Darstellung nutzt den Alphakanal.

Die Druckmaße werden aus dem Seitenverhältnis des Zuschnitts und `round(Breite in cm / 2,54 × ppi)` abgeleitet. Die Vorschau ist keine Druckdatei. Die Anzeige ist auf 1600 Pixel Kantenlänge begrenzt; die berechneten Exportmaße bleiben davon unabhängig. Ein späterer Verarbeitungskern erhält Originaldaten und Parameter getrennt von Flask und Oberfläche. Ein separater Worker, persistente Jobs und Export gehören zu späteren Meilensteinen.

Zur Begrenzung lokaler Ressourcen werden Dateien über 20 MiB und dekodierte Bilder über 40 Megapixel abgewiesen. Das Decodieren findet vor der Pixelprüfung im Browser statt; die Grenze verhindert daher nicht jede kurzzeitige Speicherspitze. Der Browser bestimmt die Behandlung eingebetteter Farbprofile; eine explizite sRGB-Konvertierung wird für den späteren Export benötigt.
