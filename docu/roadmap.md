# Roadmap

| Meilenstein | Entwicklungsstufen | Status |
| --- | --- | --- |
| 1 Grundgerüst | Architektur, Versionsführung, Weboberfläche, Health-Endpunkt | Implementiert und automatisiert geprüft; bisherige Oberfläche vom Anwender im Browser erfolgreich geprüft |
| 2 Import und Vorschau | Import, vollständiges Bild, Druckgröße, Textilvorschau | Implementiert; in 0.2.3 Zuschnitt auf Anwenderwunsch entfernt. Vorschau und Export verwenden immer das vollständige Motiv mit erhaltenem Seitenverhältnis. Orientierung, Profilbehandlung und Druckmaße automatisiert geprüft; erweiterte manuelle Bildabnahme offen |
| 3 Erster vollständiger Ablauf | Farbige Rasterung und PNG-Export | Ablauf einschließlich neuer Exportnamen in 0.2.5 vom Anwender als funktionierend bestätigt. Ganzbild und Rasterwinkel automatisiert geprüft; LXC-Lasttest und Druckabnahme offen |
| 4 Weitere Modi | Helligkeits- und Transparenzraster, Tonwerte | Ab 0.3.0 implementiert und automatisiert geprüft: Helligkeitsraster mit Druckfarbe und Umkehrung, Transparenzraster mit erhaltenen deckenden Bereichen, manuelle Tonwerte unter Erweitert. Farbmodus bleibt Vorgabe. Ausgabe visuell geprüft; Browser-/Druckabnahme offen. Automatische Tonwerte und Entrauschung folgen separat. |
| 5 Betriebsfähigkeit | Worker, Limits, Zugriffstrennung, Bereinigung, JSON-Einstellungen | Geplant |
| 6 Kalibrierung | Druckprofile, Strukturprüfung und Testvorlage | Geplant |
| 7 Debian-Betrieb | Installation, systemd, Gunicorn und Nginx | Neuinstallation im Debian-LXC samt Upload und Rasterung vom Anwender bestätigt. Update implementiert; Workerbetrieb, paralleler Lasttest und vollständige Betriebsabnahme offen |
