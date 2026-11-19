# Roadmap

| Meilenstein | Entwicklungsstufen | Status |
| --- | --- | --- |
| 1 Grundgerüst | Architektur, Versionsführung, Weboberfläche, Health-Endpunkt | Implementiert und automatisiert geprüft; bisherige Oberfläche vom Anwender im Browser erfolgreich geprüft |
| 2 Import und Vorschau | Import, vollständiges Bild, Druckgröße, Textilvorschau | Implementiert; in 0.2.3 Zuschnitt auf Anwenderwunsch entfernt. Vorschau und Export verwenden immer das vollständige Motiv mit erhaltenem Seitenverhältnis. Orientierung, Profilbehandlung und Druckmaße automatisiert geprüft; erweiterte manuelle Bildabnahme offen |
| 3 Erster vollständiger Ablauf | Farbige Rasterung und PNG-Export | Ablauf einschließlich neuer Exportnamen in 0.2.5 vom Anwender als funktionierend bestätigt. Ganzbild und Rasterwinkel automatisiert geprüft; LXC-Lasttest und Druckabnahme offen |
| 4 Weitere Modi | Helligkeits- und Transparenzraster, Tonwerte | Stand 0.3.0 vom Anwender als funktionierend bestätigt. Ausgabe zusätzlich automatisiert und visuell geprüft. Druckabnahme offen; automatische Tonwerte und Entrauschung folgen separat. |
| 5 Betriebsfähigkeit | Worker, Limits, Zugriffstrennung, Bereinigung, JSON-Einstellungen | Ab 0.4.0 implementiert und lokal geprüft: separater Worker, begrenzte SQLite-Warteschlange, Browserzuordnung, Abbruch/Zeitlimit, Bereinigung und JSON-Einstellungen. Dienste und Update-Rückfallpfade isoliert getestet. Echte Debian-Umstellung, Browserabnahme und paralleler LXC-Lasttest offen. |
| 6 Kalibrierung | Druckprofile, Strukturprüfung und Testvorlage | Geplant |
| 7 Debian-Betrieb | Installation, systemd, Gunicorn und Nginx | Bisherige Neuinstallation im Debian-LXC bestätigt. Ab 0.4.0 getrennte Dienste, Worker-Bereitschaft und Update mit Rückfall ergänzt; Umstellung und Mehrbenutzerlast auf Debian noch zu prüfen. |
