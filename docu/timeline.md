# Timeline

## 0.1.1 – 18. November 2026

- Installations- und Updateskripte für Debian 13 ergänzt: eigene Python-Umgebung, Dienstbenutzer, Gunicorn, Nginx und automatischer Start über systemd. Updates bereiten eine neue Version vor und versuchen bei einem fehlgeschlagenen Start, die vorherige Version wiederherzustellen.
- Zugriffsrechte der Versionsverzeichnisse korrigiert, damit der Dienstbenutzer Gunicorn starten kann. Die Rechtekorrektur hat den gemeldeten Fehler „502 Bad Gateway“ auf dem Zielsystem behoben.
- Prüfung der Anwendung vor dem Aktivieren auf den Dienstbenutzer umgestellt und den Start-Health-Check bei der Installation um begrenzte Wiederholungen ergänzt.
- Installationsanleitung und wiederverwendbare Codex-Anweisung ergänzt, einschließlich öffentlichem GitHub-Zugriff, sicherer Verknüpfung von Download und Ausführung sowie Fehlerbehebung für HTTP 404 und 502.

## 0.1.0 – 18. November 2026

- Erster Entwicklungsstand mit Flask-Grundgerüst, Health-Endpunkt, Architektur, Roadmap und zentraler Versionsführung.
- Lokaler Bildimport, rechteckiger Zuschnitt, Druckmaße und Textilfarbvorschau ergänzt; Bildanzeige und Textilfarbauswahl im Browser manuell erfolgreich geprüft; Zuschnitt und Druckmaße noch zu prüfen.
- Die voreilige Versionsangabe `2.0.0` wurde auf `0.1.0` korrigiert; die ersten Meilensteine sind noch nicht abgeschlossen.
