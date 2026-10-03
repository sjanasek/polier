# Polier veröffentlichen (STRATO Webhosting)

Polier besteht nach dem Build nur aus statischen Dateien. Ein Webhosting-Paket von STRATO mit eigener Domain reicht aus. PHP, Datenbank oder Server-Software werden nicht benötigt.

Die Menünamen im STRATO-Kundenservicebereich ändern sich gelegentlich. Die Schritte unten beschreiben, was zu tun ist, nicht die genauen Klickwege.

## Voraussetzungen

- Ein STRATO-Paket mit **Webspace** (Hosting), nicht nur eine reine Domain-Registrierung.
- Die Domain oder Subdomain, unter der Polier laufen soll, zum Beispiel `polier.ihre-domain.de`.
- **SSL/HTTPS** für diese Domain aktiviert (in den meisten Paketen enthalten). Ohne HTTPS funktionieren Datensicherung und Dateiimport auf dem iPad nicht zuverlässig.
- Auf Ihrem Rechner: Node.js 18 oder neuer.
- Zugangsdaten für SFTP/FTP bzw. Zugriff auf den Dateimanager im Kundenservicebereich.

## 1. Build erzeugen

```
npm install
npm run build
```

Es entsteht der Ordner `dist/`. Er enthält `index.html`, den Ordner `assets/` und die Datei `.htaccess`.

## 2. Zielordner festlegen

Im Kundenservicebereich unter Domains legen Sie fest, in welchen Ordner des Webspace die Domain oder Subdomain zeigt, zum Beispiel `/polier`. Eine Subdomain ist die sauberste Lösung, weil Polier dann nichts anderes überschreibt.

## 3. Dateien hochladen

Laden Sie den **Inhalt** von `dist/` in diesen Zielordner hoch, nicht den Ordner `dist` selbst. `index.html` muss direkt im Zielordner liegen.

Wichtig: Die Datei `.htaccess` ist eine versteckte Datei. Stellen Sie im SFTP-Programm ein, dass versteckte Dateien angezeigt und übertragen werden. Sie erzwingt HTTPS, setzt Sicherheits-Header, sperrt Suchmaschinen und sorgt dafür, dass Updates sofort sichtbar sind.

## 4. Zugangsschutz einrichten (empfohlen)

Polier hat keine eigene Anmeldung. Wer die Adresse kennt, kann die App öffnen. Die Daten liegen zwar nur im Browser der jeweiligen Person, trotzdem empfiehlt sich ein Passwortschutz auf Verzeichnisebene. STRATO bietet dafür im Kundenservicebereich einen **Verzeichnisschutz** an. Damit fragt der Browser vor dem Laden nach Benutzername und Passwort.

## 5. Prüfen

- `https://polier.ihre-domain.de` öffnen, die Seite lädt und zeigt das Beispielprojekt.
- `http://…` leitet auf `https://…` um.
- Auf dem iPad: Seite öffnen, über das Teilen-Menü "Zum Home-Bildschirm" ablegen.

## Updates einspielen

1. `npm run build` ausführen.
2. Den Inhalt von `dist/` erneut hochladen und vorhandene Dateien überschreiben.
3. Den Ordner `assets/` vorher leeren, damit keine alten Dateien liegen bleiben.
4. Im Browser neu laden. Dank der Cache-Regeln in `.htaccess` ist die neue Version sofort aktiv.

## Wichtige Hinweise

- **Daten gehören zur Adresse.** Der Browser speichert die Projektdaten getrennt je Web-Adresse. Unter einer neuen Domain oder Subdomain ist alles leer. Legen Sie die endgültige Adresse deshalb fest, bevor Sie produktiv arbeiten, und übertragen Sie bei einem Wechsel die Daten über **Stammdaten → Sicherung exportieren / importieren**.
- **Kein gemeinsamer Datenbestand.** Mehrere Personen und Geräte arbeiten jeweils mit eigenen Daten. Der Abgleich erfolgt über Export und Import.
- **Regelmäßig sichern.** Löschen des Browserverlaufs oder der Website-Daten löscht auch die Projekte. Exportieren Sie nach jedem Arbeitstag.
- **Personenbezogene Daten.** Importierte Baulohn-Daten bleiben lokal im Browser. Die Sicherungsdatei kann sie enthalten und gehört deshalb an einen geschützten Ort.

## Alternative: Hosting außerhalb von STRATO

Möchten Sie nur die Domain bei STRATO behalten, kann die App auch bei einem Anbieter wie Cloudflare Pages laufen, mit automatischer Veröffentlichung bei jedem Push. Dafür wird bei STRATO lediglich ein DNS-Eintrag für die Subdomain gesetzt. Sprechen Sie mich an, wenn Sie diesen Weg möchten.
