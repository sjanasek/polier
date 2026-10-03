# Polier – Bauabrechnung & Kalkulation

Browser-Anwendung für Leistungsverzeichnis, Baukalkulation, Aufmaß nach VOB/C (REB-Formeln), Stationierungsaufmaß im Tiefbau und kumulative Abschlagsrechnungen. Läuft ohne Server, speichert lokal im Browser.

## Start

```
npm install
npm run dev          # http://localhost:5173
```

```
npm test             # Rechenkern-Tests
npm run build        # Produktions-Build nach dist/
```

## Module

| Modul | Inhalt |
|---|---|
| Adressen / Kunden | Adressverwaltung mit Kundennummern; Projekte werden kundenbezogen abgelegt, Filter und Projektübersicht je Kunde |
| Projekte | Angebot, Ausschreibung oder Auftrag; Auftraggeber, MwSt., Nachlass, Skonto, Sicherheitseinbehalt |
| Leistungsverzeichnis | Titel, Positionen (Normal-, Bedarfs-, Alternativ-, Zulage-, Hinweisposition), Lang-/Kurztext, EP manuell oder aus Kalkulation |
| Kalkulation | Mittellohn, Einzelkosten je Position (Lohn, Stoffe, Geräte, Fremdleistung, Sonstiges), detaillierte Zuschläge (BGK/AGK/W&G je Kostenart), Endsummenkalkulation mit Umlage und vorgebbarer Angebotsendsumme |
| Bauzeitenplan | Balkenplan mit kritischem Weg; Dauern werden aus den Zeitansätzen der Kalkulation berechnet (Lohn-/Gerätestunden ÷ Kräfte), Arbeitskalender mit Feiertagen |
| Aufmaß | Aufmaßblätter mit Formelkatalog nach REB 23.003, freie Formeln, Faktor, Abzug, Mengenübersicht |
| Stationierung | Stationen in km+m, Mittelwertverfahren (Gauß-Elling) für Länge, Fläche, Volumen |
| Rechnungen | Kumulative Abschlags-/Teilschluss-/Schlussrechnung nach § 16 VOB/B, Sicherheitseinbehalt, § 13b, Festschreibung, Zahlungseingänge |
| Drucken | LV ohne Preise, Angebot, Rechnung, Aufmaßblätter, Kalkulationsblatt als PDF über den Browser |
| GAEB | Export als GAEB DA XML 3.2 X83 (Ausschreibung) und X84 (Angebot), Import von X81–X86 ins LV |

Hell- und Dunkelmodus (umschaltbar, optional automatisch nach Systemeinstellung).

## Dokumentation

- [Anwenderhandbuch](docs/anwenderhandbuch.md)
- [Technische Dokumentation](docs/technische-dokumentation.md)
- [Datenformat / API-Vorschlag (OpenAPI)](docs/openapi.yaml)
- [Veröffentlichung auf STRATO-Webhosting](docs/veroeffentlichung-strato.md)

## Technik

TypeScript, React 18, Zustand, Vite, Vitest. Keine weiteren Laufzeitabhängigkeiten.
