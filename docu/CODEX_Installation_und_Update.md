# Codex-Anweisung: Installation und Updates für zukünftige Projekte

Diese Datei beschreibt die Anforderungen und Erfahrungen aus RasterPilot als Ausgangspunkt für neue Projekte. Sie darf kopiert und an das jeweilige Projekt angepasst werden; konkrete Pfade, Dienste, URLs, Betriebssysteme und Abhängigkeiten nicht ungeprüft übernehmen. Die Skripte im Repository und die Installationsanleitung bleiben die maßgeblichen Quellen für ihr tatsächliches Verhalten.

## Ziel und Zielgruppe

Erstelle eine möglichst einfache Installation für Anfänger. Die Anwendung soll aus einem öffentlichen GitHub-Repository installiert werden können, ohne dass der Benutzer zuvor eine lokale Kopie anlegen muss. Gib wenige, einzeln ausführbare Befehle an und erkläre Voraussetzungen, Rechte, Dauer, Ergebnis und nächste Schritte in verständlicher Sprache. Verwende Platzhalter nur, wenn klar erklärt ist, was einzusetzen ist.

## Umsetzung bei RasterPilot

- Ziel ist ein eigener Debian-13-Rechner beziehungsweise unprivilegierter LXC unter Proxmox. `scripts/install.sh` wird von GitHub heruntergeladen und als root oder mit sudo ausgeführt. `curl` und CA-Zertifikate müssen für diesen ersten Download verfügbar sein.
- Das Skript installiert benötigte Systempakete, lädt den Standard-Branch des öffentlichen Repositories und richtet eine eigene Python-Umgebung ein. Die Anwendung läuft unter einem eigenen unprivilegierten Systembenutzer mit Gunicorn hinter Nginx; systemd startet den Dienst. Nginx verwendet Port 80, Gunicorn lauscht nur lokal. Die Einrichtung setzt ein eigenes System voraus, da sie die Nginx-Standardseite deaktiviert.
- Versionen liegen getrennt unter `/opt/rasterpilot/releases`; `/opt/rasterpilot/current` verweist auf die aktive Version. `/var/lib/rasterpilot` ist für Laufzeitdaten vorgesehen. Das Update wird über `sudo rasterpilot-update` beziehungsweise als root ohne sudo gestartet.
- Das Update bereitet eine neue Version samt Abhängigkeiten vor, prüft den Health-Endpunkt über den Flask-Testclient und wechselt erst danach die aktive Version. Nach einem fehlgeschlagenen Neustart oder Health-Check versucht es, die vorherige Version wiederherzustellen. Frühere Versionen bleiben erhalten. Dienst- und Nginx-Konfiguration werden durch das Update derzeit nicht aktualisiert.
- Die aktuelle Vorschau hat weder Anmeldung noch HTTPS. Der Zugriff ist nur für ein vertrauenswürdiges Netzwerk vorgesehen; dies muss in der Anleitung stehen.

## Bei neuen Projekten beachten

1. Zielsystem, notwendige Rechte, öffentliches Repository, Branch beziehungsweise Version und externe Paketquellen ausdrücklich festlegen. Einen verständlichen Weg vom frischen System bis zur erreichbaren Anwendung dokumentieren.
2. Voraussetzungen vorab prüfen und Fehler so ausgeben, dass Anfänger den nächsten Schritt erkennen. Bestehende Installationen und fremde Dienste nicht unbeabsichtigt überschreiben; Voraussetzungen und Eingriffe klar benennen.
3. Anwendung mit möglichst geringen Rechten betreiben. Quellcode, Umgebung, Konfiguration und dauerhafte Daten sinnvoll trennen. Ports, Netzwerkzugriff und gegebenenfalls fehlende Zugangskontrolle und Verschlüsselung erklären.
4. Updates vor dem Umschalten vorbereiten und prüfen. Ausfallzeiten, Datenmigrationen, Backup, Rückfallmöglichkeiten und Grenzen der Wiederherstellung passend zum Projekt behandeln. Dauerhafte Daten und eigene Konfigurationen bei Updates erhalten.
5. Eine Anleitung in `docu` mit Installation, Aufruf, Update, Status und Fehlerbehebung schreiben und aus der README verlinken. Konkrete Befehle für root und gegebenenfalls sudo angeben.
6. Skripte auf Syntax und die wesentlichen Erfolgs- und Fehlerpfade prüfen; nach Möglichkeit einen vollständigen Test auf dem unterstützten Zielsystem durchführen. Nicht durchgeführte Tests und bekannte Einschränkungen offen benennen.

## Pflegepflicht

Bei jeder Änderung an Installations- oder Update-Skripten sowie bei relevanten Änderungen an Voraussetzungen oder Betrieb diese Anweisung und die Benutzeranleitung auf Übereinstimmung mit dem tatsächlichen Verhalten prüfen und im selben Änderungsumfang ergänzen. Projektspezifische Erkenntnisse, Grenzen und übertragbare Verbesserungen hier nachführen; keine nicht implementierten Eigenschaften als vorhanden beschreiben. Auch den Verweis in `AGENTS.md` beibehalten, damit Codex die Pflegepflicht bei späteren Arbeiten wiederfindet.
