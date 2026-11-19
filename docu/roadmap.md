# Roadmap

| Meilenstein | Entwicklungsstufen | Status |
| --- | --- | --- |
| 1 Grundgerüst | Architektur, Versionsführung, Weboberfläche, Health-Endpunkt | Implementiert und automatisiert geprüft; bisherige Oberfläche vom Anwender im Browser erfolgreich geprüft |
| 2 Import und Vorschau | Import, vollständiges Bild, Druckgröße, Textilvorschau | Implementiert; in 0.2.3 Zuschnitt auf Anwenderwunsch entfernt. Vorschau und Export verwenden immer das vollständige Motiv mit erhaltenem Seitenverhältnis. Orientierung, Profilbehandlung und Druckmaße automatisiert geprüft; erweiterte manuelle Bildabnahme offen |
| 3 Erster vollständiger Ablauf | Farbige Rasterung und PNG-Export | Bisherigen Ablauf vom Anwender als funktionierend bestätigt. In 0.2.3 Rasterwinkel ergänzt und Ganzbildverarbeitung automatisiert geprüft. Browserabnahme der neuen Oberfläche, LXC-Lasttest und Druckabnahme offen |
| 4 Weitere Modi | Helligkeits- und Transparenzraster, Tonwerte | Geplant |
| 5 Betriebsfähigkeit | Worker, Limits, Zugriffstrennung, Bereinigung, JSON-Einstellungen | Geplant |
| 6 Kalibrierung | Druckprofile, Strukturprüfung und Testvorlage | Geplant |
| 7 Debian-Betrieb | Installation, systemd, Gunicorn und Nginx | Neuinstallation im Debian-LXC samt Upload und Rasterung vom Anwender bestätigt. Update implementiert; Workerbetrieb, paralleler Lasttest und vollständige Betriebsabnahme offen |
