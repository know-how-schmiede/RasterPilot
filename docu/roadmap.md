# Roadmap

| Meilenstein | Entwicklungsstufen | Status |
| --- | --- | --- |
| 1 Grundgerüst | Architektur, Versionsführung, Weboberfläche, Health-Endpunkt | Implementiert und automatisiert geprüft; bisherige Oberfläche vom Anwender im Browser erfolgreich geprüft |
| 2 Import und Vorschau | Import, Zuschnitt, Druckgröße, Textilvorschau | Implementiert; bisheriger Browserablauf vom Anwender soweit prüfbar bestätigt. Orientierung, Profilbehandlung und Druckmaße ab 0.2.0 zusätzlich automatisiert geprüft; erweiterte manuelle Bildabnahme offen |
| 3 Erster vollständiger Ablauf | Farbige Rasterung und PNG-Export | Import und Rasterung vom Anwender im Debian-LXC bestätigt. In 0.2.2 Midjourney-Hochformate ohne Vorverkleinerung und bis 40 MP Ausgabe ergänzt; drei Originale lokal über API geprüft. LXC-Lasttest, neue Grenze im Browser und manuelle Druckabnahme offen |
| 4 Weitere Modi | Helligkeits- und Transparenzraster, Tonwerte | Geplant |
| 5 Betriebsfähigkeit | Worker, Limits, Zugriffstrennung, Bereinigung, JSON-Einstellungen | Geplant |
| 6 Kalibrierung | Druckprofile, Strukturprüfung und Testvorlage | Geplant |
| 7 Debian-Betrieb | Installation, systemd, Gunicorn und Nginx | Neuinstallation im Debian-LXC samt Upload und Rasterung vom Anwender bestätigt. Update implementiert; Workerbetrieb, paralleler Lasttest und vollständige Betriebsabnahme offen |
