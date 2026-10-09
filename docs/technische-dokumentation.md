# Polier – Technische Dokumentation

## 1. Überblick

Polier ist eine Single-Page-Anwendung (SPA) ohne Backend. Alle Daten werden im `localStorage` des Browsers gehalten und per JSON-Datei gesichert. Dadurch ist die Anwendung ohne Server, Datenbank oder Internetzugang lauffähig; der Build-Ordner `dist/` kann auf jedem statischen Webserver abgelegt werden.

| Bereich | Technologie |
|---|---|
| Sprache | TypeScript 5 (strict) |
| UI | React 18 (Funktionskomponenten, Hooks) |
| State | Zustand 4 mit `persist`-Middleware (localStorage, Schlüssel `polier-v1`) |
| Build / Dev-Server | Vite 5 |
| Tests | Vitest |
| Styling | Handgeschriebenes CSS mit Design-Tokens (`src/styles.css`), ohne UI-Framework |
| Abhängigkeiten zur Laufzeit | react, react-dom, zustand (sonst keine) |

Es gibt keine HTTP-Schnittstelle. Eine OpenAPI-Beschreibung des Datenformats liegt unter `docs/openapi.yaml` (Abschnitt 8); sie dokumentiert das Schema der Sicherungsdatei und dient als Vorlage für einen späteren Server.

## 2. Projektstruktur

```
polier/
├── index.html                  Einstiegsseite
├── package.json                Skripte: dev, build, preview, test
├── vite.config.ts
├── tsconfig.json
├── pwa/
│   ├── sw.template.js          Vorlage des Service Workers
│   └── swPlugin.ts             Vite-Plugin: erzeugt dist/sw.js mit Dateiliste und Version
├── public/                     manifest.webmanifest, Symbole, icon.svg, .htaccess (werden nach dist/ kopiert)
├── docs/
│   ├── anwenderhandbuch.md
│   ├── technische-dokumentation.md
│   └── openapi.yaml            Schema der Sicherungsdatei (Swagger/OpenAPI 3.1)
└── src/
    ├── main.tsx                React-Bootstrap
    ├── App.tsx                 Shell: Sidebar, Navigation, Routing per View-State
    ├── store.ts                Zustand-Store, Persistenz, useProjekt()
    ├── styles.css              Theme (hellgrün), Layout, Tabellen, Druck-CSS
    ├── types.ts                Domänenmodell (alle Interfaces und Enums)
    ├── components/
    │   ├── Gantt.tsx           SVG-Balkenplan (Bildschirm und Druck)
    │   ├── SollIstChart.tsx    SVG-Liniendiagramm Soll/Ist/Plan kumuliert (Bildschirm und Druck)
    │   └── ui.tsx              NumberInput (de-DE), Field, Card, KPI, …
    ├── lib/
    │   ├── calc.ts             Rechenkern: Kalkulation, LV-Summen, Aufmaß, Rechnungen
    │   ├── formulas.ts         REB-Formelkatalog + Parser für freie Formeln
    │   ├── station.ts          Stationierung (Mittelwertverfahren)
│   ├── pwa.ts              Service-Worker-Registrierung, Update-Status, Installationshilfe, Online-Status
│   ├── theme.ts            Hell-/Dunkelmodus (hell, dunkel, auto)
│   ├── bauzeit.ts          Bauzeitenplan: Zeitaufwand aus Kalkulation, Terminrechnung, Kalender
│   ├── kunden.ts           Adressbuch-Logik (Kundennummern, Adresskopie, Kunden aus Projekten)
│   ├── gaeb.ts             GAEB DA XML 3.2 Export (X83/X84) und Import (X81–X86)
│   ├── csv.ts              CSV-Parser (Trennzeichen, Anführungszeichen, Kodierung, Zahlen, Datum)
│   ├── brzImport.ts        Generischer Import Baulohn/FiBu: Zielfelder, Spaltenvorschlag, Kontenregeln, Duplikate
│   ├── nachkalkulation.ts  Soll-Ist-Vergleich, Kennzahlen, Hochrechnung, Zeitverlauf, Erfahrungswerte, CSV
    │   ├── format.ts           Zahlen-/Datums-/Stationsformatierung, uid()
    │   ├── defaults.ts         Fabriken für neue Objekte, Standardparameter
    │   ├── demo.ts             Beispielprojekt inkl. Beispiel-Importen für die Nachkalkulation
    │   └── __tests__/          calc, gaeb (jsdom), bauzeit, kunden, csv, brzImport, nachkalkulation
    └── views/
        ├── ProjekteView.tsx
        ├── KundenView.tsx
        ├── BauzeitView.tsx
        ├── LVView.tsx
        ├── KalkulationView.tsx
        ├── AufmassView.tsx
        ├── StationierungView.tsx
        ├── RechnungenView.tsx
        ├── NachkalkView.tsx    Soll-Ist, Zeitverlauf, Import-Assistent, Kostenstellen/Protokoll, Erfahrungswerte
        ├── DruckView.tsx
        └── StammdatenView.tsx  inkl. Kontenregeln und Importprofile
docs/beispiel-baulohn-stunden.csv, docs/beispiel-fibu-buchungen.csv   Testdateien für den Import
```

Architekturprinzip: **Die Views enthalten keine Fachlogik.** Alle Berechnungen liegen in `src/lib/` als reine Funktionen über dem Datenmodell und sind ohne DOM testbar. Views lesen den Store, rufen Rechenfunktionen auf und schreiben Änderungen immutable zurück.

## 3. Entwicklung

```
npm install        # Abhängigkeiten
npm run dev        # Dev-Server http://localhost:5173 mit Hot Reload
npm test           # Vitest (Rechenkern)
npm run build      # tsc --noEmit + Vite-Build nach dist/
npm run preview    # dist/ lokal ausliefern
```

Node 18 oder neuer wird vorausgesetzt.

## 4. Datenmodell (`src/types.ts`)

```
Projekt
├── bauzeit?: Bauzeitenplan
├── nachkalk?: Nachkalkulation (optional; nachkalkVon() liefert Standardwerte)
│   ├── kostenstellen: Kostenstelle[] { nummer, bezeichnung, titelId | null, gemeinkosten }
│   ├── stunden: StundenZeile[] { importId, datum, kostenstelle, stundenart, stunden, lohnkosten | null,
│   │                             mitarbeiterNr, mitarbeiterName (nur personenbezogen), kostentraeger, hash }
│   ├── kosten: KostenZeile[] { importId, datum, kostenstelle, konto, kontoBezeichnung, betrag (signiert),
│   │                           kostenart, zugeordnet, gemeinkosten, kostenartText, belegNr, buchungstext, kostentraeger, hash }
│   ├── importe: ImportProtokoll[] { quelle, datei, importiertAm, profilName, zeilenGelesen, uebernommen,
│   │                                uebersprungen, ersetzt, fehler[{zeile, text}], personenbezogen, von, bis, kostenstellen[], nichtZugeordneteKonten[] }
│   └── schwellen: { gelb, rot } in %
├── kundeId?: Verknüpfung zum Adressbuch (optional, null = keine Zuordnung)
├── Stammfelder: nummer, bezeichnung, art (angebot|ausschreibung|auftrag), bauvorhaben, bauort, datum
├── auftraggeber: Adresse
├── Konditionen: mwstProzent, nachlassProzent, skontoProzent, skontoTage,
│                sicherheitseinbehaltProzent, zahlungszielTage, vorbemerkungen
├── lv: Titel[]
│   └── Titel { oz, bezeichnung, vorbemerkung, positionen: Position[] }
│       └── Position { oz, kurztext, langtext, menge, einheit, art (N|B|A|Z|H),
│                      ep, epAusKalkulation, ansaetze: KalkAnsatz[] }
│           └── KalkAnsatz { kostenart (lohn|stoffe|geraete|fremd|sonstiges),
│                            bezeichnung, menge, preis, einheit }
├── kalk: KalkParameter
│   ├── methode (zuschlag|endsumme)
│   ├── Mittellohn: grundlohn, zulagenProzent, sozialkostenProzent, lohnnebenkostenProzent
│   ├── zuschlaege: je Kostenart { bgk, agk, wug } in %
│   ├── bgkPosten: BgkPosten[] (absolut), agkProzent, wugProzent
│   ├── umlageGewichte: je Kostenart (0 … 1)
│   └── zielSumme (0 = aus AGK/W&G berechnen)
├── aufmass: AufmassZeile[]
│   └── { blattNr, datum, positionId, formelNr, werte[], freieFormel, faktor, abzug, bemerkung }
├── stationierungen: Stationierung[]
│   └── { blattNr, datum, positionId, bezeichnung, modus, faktor, abzug,
│         profile: StationsProfil[] { station (m), wert, wert2, bemerkung } }
└── rechnungen: Rechnung[]
    └── { lfdNr, rechnungsNr, typ, datum, stichtag, status, nachlassProzent,
          sicherheitseinbehaltProzent, skontoProzent, skontoTage, zahlungszielTage,
          reverseCharge, sonstigeAbzuege[], zahlungen[], snapshot | null, bemerkung }

Stammdaten
├── kunden: Kunde[] { kundenNr, ansprechpartner, ustId, notiz + Adresse }
├── firma: Firma (Adresse + inhaber, bank, iban, bic, ustId, steuerNr)
├── geraete: GeraetStamm[] { bezeichnung, stundensatz }
├── material: MaterialStamm[] { bezeichnung, einheit, preis }
├── einheiten: string[]
├── importProfile?: ImportProfil[] { name, quelle (baulohn|fibu), zuordnung {zielfeld → Spaltenüberschrift},
│                                    habenWerte, ausgeschlosseneStundenarten }
└── kontenRegeln?: KontenRegel[] { vonKonto, bisKonto, kostenartText, kostenart, gemeinkosten, bezeichnung }
```

**Adressbuch:** `Projekt.auftraggeber` bleibt eine Adresskopie, `kundeId` ist nur die Verknüpfung. Dadurch ändern spätere Adressänderungen keine bestehenden Projekte oder gestellten Rechnungen; die Übernahme erfolgt bewusst per Schaltfläche. `kundenAusProjekten` dedupliziert nach Name (ohne Groß-/Kleinschreibung) und PLZ.

Alle Objekte tragen eine `id` (zufälliger String aus `uid()`). Referenzen zwischen Objekten laufen ausschließlich über `positionId`. Datumswerte sind ISO-Strings `yyyy-mm-dd`, sodass String-Vergleiche für Stichtage genügen.

## 5. Rechenkern (`src/lib/calc.ts`)

### 5.1 Mittellohn

`lohnrechnung(k)`:

```
mittellohnA       = grundlohn × (1 + zulagen%/100)
sozialkosten      = mittellohnA × sozial%/100
lohnnebenkosten   = mittellohnA × nebenkosten%/100
kalkulationslohn  = mittellohnA + sozialkosten + lohnnebenkosten
```

### 5.2 EKT je Position

`ektJeEinheit(pos, kalkLohn)` summiert `menge × preis` der Ansätze je Kostenart. Bei Kostenart `lohn` und `preis = 0` wird der Kalkulationslohn eingesetzt.

### 5.3 Kalkulation (`kalkulation(projekt)`) → `KalkErgebnis`

Nur Positionen mit `zaehltInSumme` (Art N oder Z) gehen in die Summenbildung ein.

**Zuschlagskalkulation** (`methode = 'zuschlag'`):
```
zuschlagsatz[k]   = bgk[k] + agk[k] + wug[k]
umlage[k]         = EKT[k] × zuschlagsatz[k] / 100
angebotssumme     = Σ EKT + Σ umlage
```

**Endsummenkalkulation** (`methode = 'endsumme'`):
```
bgk               = Σ bgkPosten
herstellkosten    = Σ EKT + bgk
angebotssumme     = herstellkosten × 100 / (100 − agk% − wug%)      (zielSumme = 0)
                  = zielSumme                                       (zielSumme > 0)
umlage            = angebotssumme − Σ EKT
basis             = Σ_k EKT[k] × gewicht[k]
umlage[k]         = umlage × EKT[k] × gewicht[k] / basis
zuschlagsatz[k]   = umlage[k] / EKT[k] × 100
```

Bei vorgegebener Zielsumme werden AGK und W&G nachrichtlich im Verhältnis `agk% : wug%` aus dem Rest `angebotssumme − herstellkosten` abgeleitet.

### 5.4 Einheitspreis

`kalkEP(pos, erg)`: `ep = round2(Σ_k EKT[k] × (1 + zuschlagsatz[k]/100))`.
`effektiverEP(pos, erg)` liefert den kalkulierten EP bei `epAusKalkulation`, sonst `pos.ep`; für Hinweistexte 0.

### 5.5 LV-Summen

`lvSummen(projekt, erg)`: Titelsummen (nur N/Z), netto, Nachlass, Netto nach Nachlass, MwSt., Brutto; Bedarfspositionen separat als `eventual`. GP werden je Position auf Cent gerundet, bevor summiert wird (wie auf dem Ausdruck).

### 5.6 Aufmaß

`aufmassZeileErgebnis(z)` = `formelErgebnis(formelNr, werte, freieFormel) × faktor × (abzug ? −1 : 1)`, gerundet auf 3 Nachkommastellen.

`mengenBisStichtag(projekt, stichtag | null)` → `Map<positionId, menge>`: summiert alle Aufmaßzeilen und Stationierungen mit `datum ≤ stichtag`.

### 5.7 Kumulative Rechnung (`rechnungBerechnen(projekt, r, erg)`)

```
mengen            = r.snapshot ?? mengenBisStichtag(projekt, r.stichtag)
leistungKum       = Σ round2(mengeKum × ep)                 (ohne Hinweistexte)
nachlass          = leistungKum × nachlass%/100
nettoNachNachlass = leistungKum − nachlass
sicherheit        = nettoNachNachlass × einbehalt%/100
sonstige          = Σ sonstigeAbzuege
nettoZahlbar      = nettoNachNachlass − sicherheit − sonstige
mwst              = reverseCharge ? 0 : nettoZahlbar × mwst%/100
bruttoKum         = nettoZahlbar + mwst
bisherGestellt    = Σ rechnungsbetrag aller Rechnungen mit lfdNr < r.lfdNr   (rekursiv)
rechnungsbetrag   = bruttoKum − bisherGestellt
skontoBetrag      = rechnungsbetrag × skonto%/100
offen             = rechnungsbetrag − Σ zahlungen
```

Der Abzug der Vorrechnungen erfolgt mit deren **Rechnungsbeträgen**, nicht mit den tatsächlichen Zahlungen. Skontoabzüge des Auftraggebers mindern daher nicht den Leistungsstand, sondern erscheinen als Differenz im Zahlungsstatus.

**Snapshot:** Beim Festschreiben (`status = 'gestellt'`) wird `mengenBisStichtag` in `r.snapshot` kopiert. Festgeschriebene Rechnungen rechnen ausschließlich mit dem Snapshot; die Vorrechnungs-Mengen (`mengeVorher`) werden ebenfalls aus dem Snapshot der jeweiligen Vorrechnung gelesen.

## 6. Formelkatalog und Parser (`src/lib/formulas.ts`)

`FORMELN` ist ein Array von `Formel { nr, name, text, params[], dim, fn(values) }`. Neue Formeln werden dort ergänzt; die UI (Auswahlliste, Parameterfelder, Druck) passt sich automatisch an. Nummer `'91'` (`FREIE_FORMEL_NR`) aktiviert den Ausdrucks-Parser.

`evalFormel(src, vars)` ist ein Recursive-Descent-Parser (Tokenizer → expr → term → power → primary) ohne `eval`. Unterstützt: `+ - * / ^`, Klammern, Zahlen mit Komma oder Punkt, Variablen `a…h`, `pi`, `sqrt`, `abs`, `sin`, `cos`, `tan` (Grad), `round`; die Zeichen `· × ÷ ² ³` werden vorab normalisiert. Division durch 0 liefert 0; Syntaxfehler werfen eine `Error` mit deutscher Meldung, die in der UI angezeigt wird.

## 7. Stationierung (`src/lib/station.ts`)

`stationsAbschnitte(s)` sortiert die Profile nach Station und bildet Abschnitte `[i, i+1]`:

| Modus | Querschnittswert Q | Ergebnis Abschnitt |
|---|---|---|
| `laenge` | – | Δl |
| `flaeche` | wert (Breite) | (Q1 + Q2)/2 × Δl |
| `volumen` | wert (Fläche) | (Q1 + Q2)/2 × Δl |
| `volumenBT` | wert × wert2 | (Q1 + Q2)/2 × Δl |

`stationierungSumme(s)` = Σ Abschnitte × faktor × Vorzeichen. Stationen werden als Meter gespeichert; `stationFmt`/`stationParse` wandeln von/nach `km+m` (z. B. `0+125,50`).

## 7d. Progressive Web App (PWA)

**Bausteine:** `public/manifest.webmanifest` (Name, Farben, `display: standalone`, relative `start_url`/`scope`, Symbole 192/512 sowie maskable), Symbole unter `public/icons/` und `public/icon.svg`, Meta-Tags in `index.html` (Theme-Farben hell/dunkel, iOS-Startbildschirm: `apple-touch-icon`, `apple-mobile-web-app-*`). Die Vite-Option `base: './'` erzeugt relative Pfade, die App läuft daher an der Wurzel einer Domain ebenso wie in einem Unterordner.

**Service Worker:** Quelle ist `pwa/sw.template.js`. Das Plugin `polierServiceWorker` (`pwa/swPlugin.ts`) schreibt nach dem Build `dist/sw.js` und setzt zwei Platzhalter ein: die Liste aller Build-Dateien (ohne `sw.js` und `.htaccess`) und eine Versionskennung, den SHA-256-Hash über Dateinamen und Inhalte (12 Zeichen). Jede Änderung an irgendeiner Datei ergibt damit einen neuen Cache-Namen `polier-<Version>`. Es kommt keine zusätzliche Bibliothek zum Einsatz.

- `install`: lädt alle Dateien der Liste in den neuen Cache (Precache, `cache: 'reload'`).
- `activate`: löscht alte `polier-*`-Caches und übernimmt die offenen Seiten (`clients.claim`).
- `fetch`: nur GET-Anfragen derselben Herkunft. Seitenaufrufe (`mode: navigate`) liefern `index.html` aus dem Cache (App-Shell), alles andere zuerst aus dem Cache, sonst Netzwerk mit Ablage im Cache. Fremde Domains werden nicht angefasst.
- Nachricht `SKIP_WAITING` aktiviert eine wartende neue Version. Sie wird **nicht** automatisch aktiviert, damit offene Eingaben nicht durch ein Neuladen unterbrochen werden.

Der Service Worker wird nur im Produktions-Build registriert (`import.meta.env.PROD`), der Dev-Server bleibt davon unberührt.

**Client (`src/lib/pwa.ts`):** kleiner Store mit `useSyncExternalStore`. Status: `offlineBereit`, `updateVerfuegbar`, `online`, `installiert` (`display-mode: standalone` bzw. `navigator.standalone`), `installierbar` (Ereignis `beforeinstallprompt`), `speicherDauerhaft` (`navigator.storage.persist()`). Update-Ablauf: `updatefound` → Status `installed` bei vorhandenem Controller → Hinweisleiste (`UpdateHinweis`) → `aktualisieren()` sendet `SKIP_WAITING`, nach `controllerchange` einmal `location.reload()`, aber nur nach ausdrücklicher Bestätigung. Eine Prüfung auf Updates erfolgt beim Zurückkehren in den Vordergrund, höchstens alle 10 Minuten. Die Oberfläche steckt in `components/PwaBausteine.tsx` (Hinweisleiste, Offline-Marke, Karte in den Stammdaten).

**Hosting-Anforderungen:** Service Worker laufen nur in einem sicheren Kontext (HTTPS oder `localhost`). `sw.js` und `manifest.webmanifest` dürfen nicht lange gecacht werden, sonst kommen Updates nie an; die mitgelieferte `.htaccess` setzt dafür `Cache-Control: no-cache` und den MIME-Typ `application/manifest+json`. Auf anderen Servern entsprechend konfigurieren.

**Datenhaltung:** Die Projektdaten bleiben im `localStorage` und sind vom Cache getrennt; ein Update des Service Workers verändert sie nicht. Unter iOS hat eine zum Home-Bildschirm hinzugefügte Web-App einen eigenen Speicher, getrennt von Safari; ein Umzug geschieht über Sicherung (Export/Import).

**Tests:** `pwa/__tests__/swPlugin.test.ts` (Platzhalter, Dateiliste, Versionshash, Pfadnormalisierung, gültiges JavaScript) und `src/lib/__tests__/pwa.test.ts` (iOS-Erkennung). Zusätzlich wurde der Ablauf im Headless-Browser geprüft: Installierbarkeit laut Chrome-Protokoll ohne Fehler, Offline-Neustart mit Daten, Update-Hinweis, Aktivierung und Aufräumen des alten Caches.

## 7b. Bauzeitenplan (`src/lib/bauzeit.ts`)

Datenmodell: `Projekt.bauzeit?: Bauzeitenplan { start, stundenProTag, standardKraefte, arbeitstage[], feiertage[], vorgaenge[] }`, `Vorgang { positionIds[], modus (lohn|geraete|manuell), kraefte, dauerManuell, vorgaenger[], verzug, fruehesterStart }`. Der Plan wird erst beim ersten Bearbeiten im Projekt gespeichert (`bauzeitVon` liefert bis dahin Standardwerte).

**Zeitaufwand:** `positionAufwand(pos)` summiert die Ansatzmengen der Kostenart Lohn (Stunden je Einheit) sowie der Kostenart Geräte mit Einheit „h“ und multipliziert mit der Positionsmenge. Die Werte werden bei jedem Rendern frisch aus der Kalkulation berechnet und nicht im Vorgang gespeichert, der Plan folgt also automatisch jeder Änderung.

**Dauer:** `ceil(Stunden / (Kräfte × stundenProTag))`, mindestens 1 Tag; ohne Zeitansätze 1 Tag mit Kennzeichen `ohneAufwand`; bei `manuell` die eingegebene Dauer (0 = Meilenstein).

**Terminrechnung `planen(plan, lv)`:** Arbeitskalender aus Wochentagen und Feiertagen (UTC-Datumsrechnung, keine Zeitzonenfehler), Rechnung in Arbeitstag-Indizes. Topologische Sortierung (Kahn) mit Zykluserkennung; Vorwärtsrechnung `ES = max(frühester Beginn, EF(Vorgänger) + Verzug)`, Rückwärtsrechnung `LF = min(LS(Nachfolger) − Verzug(Nachfolger))`, Puffer `LS − ES`, kritisch bei Puffer ≤ 0. Ergebnis `Terminplan` mit Beginn/Ende je Vorgang, Bauzeit in Arbeits- und Kalendertagen, Personalbedarf je Arbeitstag und Spitzenbesetzung. Beziehungen sind ausschließlich Ende-Anfang mit Verzug.

`bundesFeiertage(jahr)` berechnet Ostern nach Gauß und leitet Karfreitag, Ostermontag, Christi Himmelfahrt und Pfingstmontag ab; regionale Feiertage sind nicht enthalten.

`components/Gantt.tsx` zeichnet den Plan als SVG (Monats-, KW- und Tagesleiste, Wochenend-/Feiertagsschraffur, Abhängigkeitspfeile). Die Druckfassung verwendet feste helle Farben und skaliert über `viewBox`.

## 7c. Nachkalkulation (`src/lib/csv.ts`, `src/lib/brzImport.ts`, `src/lib/nachkalkulation.ts`)

### Abgrenzung

Es gibt **keine** Anbindung an BRZ Baulohn oder BRZ Finanzbuchhaltung (keine API, kein festes Dateiformat, keine Zertifizierung). Die Exportlayouts dieser Systeme sind nicht bekannt. Implementiert ist ein generischer, konfigurierbarer CSV-Import; die Feldzuordnung liegt in `ImportProfil` (Stammdaten). Sobald reale Beispielexporte vorliegen, lässt sich ein Standardprofil als Vorbelegung in `brzImport.ts` (Synonymlisten der `ZielFeld`-Definitionen bzw. ein vordefiniertes Profil) ergänzen.

### CSV-Parser (`csv.ts`)

`dekodieren(buf, kodierung)`: `TextDecoder('utf-8', {fatal: true})`, bei ungültigen Bytefolgen Rückfall auf `windows-1252`; BOM wird entfernt. `erkenneTrennzeichen` wertet die ersten 20 Zeilen aus (Zeichen mit konsistentester Spaltenzahl außerhalb von Anführungszeichen gewinnt; Kandidaten `; \t , |`). `csvZeilen` ist ein Zeichen-Automat nach RFC 4180 (Anführungszeichen, `""`, Zeilenumbrüche im Feld, CRLF/LF). `parseZahl` liest `1.234,56`, `1,234.56`, `12,5-`, `(12,50)` und Währungs-/Prozentzeichen; `parseDatum` liest `tt.mm.jjjj`, `tt.mm.jj`, `jjjj-mm-tt(Thh:mm)`, `tt/mm/jjjj`, `jjjjmmtt` mit Gültigkeitsprüfung. `csvErzeugen` schreibt Semikolon-CSV mit Dezimalkomma.

### Import (`brzImport.ts`)

- `BAULOHN_FELDER` / `FIBU_FELDER`: Zielfelder mit Pflichtkennzeichen und Synonymen; `vorschlagZuordnung(kopf, quelle)` ordnet Spaltenüberschriften zu (normalisiert, exakte Treffer vor Teilstring, jede Spalte nur einmal).
- `importAusfuehren(tabelle, nachkalk, optionen)` ist eine reine Funktion: Zeilen lesen, Fehler mit Zeilennummer sammeln, Baulohn **aggregieren** (Schlüssel Datum|Kostenstelle|Stundenart|Kostenträger|Mitarbeiter – Mitarbeiterfelder nur bei `personenbezogen`), ausgeschlossene Stundenarten überspringen, FiBu-Vorzeichen (Haben-Kennzeichen → negativ, sonst Vorzeichen des Exports), Konten über `kontoZuordnen` den Kostenarten zuordnen (erste passende Regel; Bereich und/oder Textabgleich; ohne Treffer `sonstiges` mit `zugeordnet = false`).
- **Duplikatschutz:** `zeilenHash` (FNV-1a über die fachlichen Felder). Modus `ergaenzen` überspringt bekannte Hashes; Modus `ersetzen` löscht zuvor importierte Zeilen derselben Quelle im Zeitraum × Kostenstellen der Datei (`geloeschteIds`) und übernimmt neu. Bei aggregierten Baulohn-Daten erkennt der Hash nur identische Summen; überlappende Exporte sind mit `ersetzen` zu laden (Doku für Anwender).
- `importUebernehmen`, `importLoeschen(importId)` (entfernt genau die Zeilen des Imports), `kostenNeuZuordnen(regeln)`.
- `standardKontenRegeln('skr03' | 'skr04')`: editierbarer Startsatz, bewusst grob und ohne Gewähr.

### Rechenkern (`nachkalkulation.ts`)

`nachkalkulation(projekt, { stichtag, hochrechnung })` → `NachkalkErgebnis`:

```
mengen             = mengenBisStichtag(projekt, stichtag)
Soll je Position   = ektJeEinheit(pos, kalkLohn) × menge;  Soll-Stunden = Σ Lohnansatz.menge × menge
leistung           = Σ round2(menge × effektiverEP)        (wie leistungKum einer Rechnung mit diesem Stichtag)
leistungsgrad      = leistung / lvSummen.netto             (null bei 0)
sollBgk            = erg.bgk × leistungsgrad
Ist-Zeilen         = Kostenstellen des Projekts (leer = alle), datum ≤ stichtag
istKosten[k]       = Σ betrag (nicht Gemeinkosten);  istBgk = Σ betrag (Gemeinkosten laut Regel oder Kostenstelle)
Lohn-Ist           = FiBu-Lohnkonten > 0 ? FiBu : Export-Lohnkosten vorhanden ? Export : Stunden × kalkLohn ("geschaetzt")
abweichung%        = (ist − soll) / soll × 100              (null bei soll = 0 → Ampel grau)
mittellohnIst      = Lohnkosten / Stunden (nur bei echter Lohnkostenquelle)
bgkSatzIst         = istBgk / istEkt;   zuschlagIst = (erloes − istEkt) / istEkt
ergebnisIst        = erloes − istEkt − istBgk;  ergebnisSoll = erloes − sollEkt − sollBgk
Hochrechnung trend = istGesamt / leistungsgrad;  restPlan = istGesamt + (Soll gesamt − Soll Stand)
prognoseErgebnis   = nettoNachNachlass − prognoseKosten;  planErgebnis = nettoNachNachlass − herstellkosten
```

`planStundenBis(projekt, stichtag)` verteilt die Lohnstunden jedes Vorgangs aus `planen()` gleichmäßig auf seine Arbeitstage und summiert bis zum Stichtag. Der **Zeitverlauf** berechnet die obigen Größen je Monatsende (plus Stichtag) kumuliert. Der **Titelvergleich** nutzt Kostenstellen mit `titelId`; `aufwandFaktor = istStunden / sollStunden`. `erfahrungswerte()` skaliert Lohnansätze mit diesem Faktor (je Titel, sonst projektweit) und `erfahrungswerteAnwenden()` schreibt nur die übergebenen Einträge zurück (neues Projektobjekt). Division durch 0 ist überall durch `null`-Ergebnisse abgefangen.

Datenschutz: Die View speichert Mitarbeiterfelder nur bei explizit gesetztem Schalter; das Protokoll trägt `personenbezogen`. Alles liegt im localStorage und in der Sicherungsdatei.

## 7a. GAEB-Schnittstelle (`src/lib/gaeb.ts`)

Format: GAEB DA XML 3.2 (Namespace `http://www.gaeb.de/GAEB_DA_XML/DA{83|84}/3.2`).

**Export** `gaebExport(projekt, firma, erg, phase)` erzeugt den XML-String per String-Konkatenation (kein Serializer nötig, Werte werden escaped). Mapping:

| Polier | GAEB |
|---|---|
| Titel | `BoQCtgy RNoPart` + `LblTx` |
| Titel-Vorbemerkung | `Remark` im `BoQBody` des Titels |
| Position | `Item RNoPart` mit `Qty`, `QU`, `Description/CompleteText` (`OutlineText` = Kurztext, `DetailTxt` = Langtext) |
| Art B (Bedarf) | `Provis = WithoutTotal` |
| Art A (Alternativ) | `ALNGroupNo`/`ALNSerNo` |
| Art Z (Zulage) | `MarkupItem = Yes` |
| Art H (Hinweis) | `Remark` in der `Itemlist` |
| EP / GP (nur X84) | `UP` / `IT`, Titelsummen `Totals/Total`, Gesamt `BoQ/Totals` mit `DiscountPcnt`, `VAT`, `TotalGross` |
| Auftraggeber / Firma | `OWN/Address`, `BIDDER/Address` (X84) |
| Vorbemerkungen | `AwardInfo/AwardText` |

**Import** `gaebImport(xmlText)` parst mit `DOMParser` namespace-unabhängig über `localName` und akzeptiert daher alle Phasen (X81–X86) und Versionen 3.1–3.3, soweit die Elementnamen übereinstimmen. `BoQCtgy` wird rekursiv durchlaufen; verschachtelte Ebenen werden zu einem flachen `Titel` mit zusammengesetzter OZ (`1.01`) und Bezeichnung (`Los 1 / Erdarbeiten`) reduziert, da das Datenmodell nur eine Titelebene kennt. `gaebZuProjekt(basis, importErgebnis)` erzeugt daraus ein neues Projekt.

Nicht abgebildet: Textergänzungen (`ComplTS`), Bieterfeld-Kennungen, Unterbeschreibungen, Ausführungsbeschreibungen, Preisanteile (`UPComp`), Stundenlohnarbeiten und Nachtragsnummern.

## 8. Persistenz und Datenformat

### Store (`src/store.ts`)

```ts
{ projekte: Projekt[], aktivId, stammdaten: Stammdaten,   // persistiert
  view, druck,                                            // flüchtig
  setView, setDruck, setAktiv, addProjekt, deleteProjekt,
  updateProjekt(id, fn), updateStammdaten(fn), importAll(data) }
```

Änderungen laufen über `updateProjekt(id, p => ({...p, …}))`; der Store erzeugt neue Objekte, React rendert differenziert. `useProjekt()` liefert das aktive Projekt und einen gebundenen Updater.

Die Persistenz nutzt `zustand/middleware/persist` mit `partialize` und einer eigenen `merge`-Funktion (`stammdatenErgaenzen`), die in älteren Speicherständen und Sicherungsdateien fehlende Felder ergänzt: `stammdaten.kunden` und `importProfile` leer, `kontenRegeln` mit dem SKR03-Vorschlag. `Projekt.nachkalk` und `Projekt.bauzeit` sind optional und werden erst beim ersten Bearbeiten angelegt (`nachkalkVon`, `bauzeitVon`); ältere Projekte bleiben unverändert gültig. Beim ersten Start wird das Beispielprojekt geladen. Eine Versionierung des Speicherformats ist über den Schlüssel `polier-v1` vorbereitet; Migrationen können über die `migrate`-Option von `persist` ergänzt werden.

### Sicherungsdatei

```json
{ "version": 1, "exportiert": "2026-10-02T12:00:00.000Z", "projekte": [ … ], "stammdaten": { … } }
```

Das vollständige Schema steht in `docs/openapi.yaml` (OpenAPI 3.1, `components.schemas`). Es kann in Swagger UI oder dem Swagger Editor geladen werden; die dort beschriebenen Pfade sind als Vorschlag für eine künftige Server-API gedacht und derzeit nicht implementiert.

## 9. Oberfläche

- **Theme:** CSS-Variablen in `:root` (`--g-50` … `--g-900`, `--bg`, `--line`, `--input-bg`, `--hint-*`, …). Farbänderungen erfolgen zentral in `src/styles.css`.
- **Dunkelmodus:** `:root[data-theme="dark"]` überschreibt dieselben Variablen. `src/lib/theme.ts` setzt `data-theme` (Modi hell, dunkel, auto) und speichert die Wahl unter `polier-theme` im localStorage; ein Inline-Skript in `index.html` setzt das Theme vor dem ersten Rendern, damit nichts aufblitzt. Das Druckblatt nutzt feste Farben und bleibt immer hell.
- **Navigation:** `view` im Store; `App.tsx` rendert die passende View. Module, die ein Projekt benötigen, sind ohne aktives Projekt deaktiviert.
- **NumberInput:** Hält lokalen Text während der Eingabe, parst beim Verlassen (`parseDe`) und schreibt die Zahl in den Store. Dadurch sind Tausenderpunkte und Komma eingabefähig, ohne bei jedem Tastendruck zu formatieren.
- **Druck:** `DruckView` rendert ein A4-Blatt (`.print-sheet`); `@media print` blendet Sidebar und Bedienelemente aus. PDF-Erzeugung über den Browser-Druckdialog.

## 10. Tests

`src/lib/__tests__/gaeb.test.ts` (jsdom-Umgebung) prüft Export-Struktur, Wohlgeformtheit, Roundtrip Export → Import und verschachtelte Titel. `src/lib/__tests__/calc.test.ts` prüft Formeln, Parser, Stationierung, Mittellohn, beide Kalkulationsmethoden inkl. Zielsummen-Modus, Mengen bis Stichtag, kumulative Verrechnung (AR 2 zieht AR 1 ab) und Snapshot-Verhalten. `csv.test.ts` prüft Trennzeichen, Anführungszeichen, BOM, Kodierung (UTF-8/Windows-1252), Zahlen- und Datumsformate; `brzImport.test.ts` Spaltenvorschlag, Pflichtfelder, Kontenregeln, Aggregation/Personenbezug, Soll/Haben-Vorzeichen, Duplikatschutz, Ersetzen und Löschen; `nachkalkulation.test.ts` Soll auf Leistungsstand, Abweichungen/Ampel, Hochrechnung, Bauzeit-Planstunden, Titelvergleich, Zeitverlauf, CSV, Randfälle (leeres Projekt, kein Leistungsstand, Lohnquellen) und Erfahrungswerte. Ausführen mit `npm test`.

## 11. Erweiterungsideen

| Thema | Ansatz |
|---|---|
| GAEB-Erweiterungen | Textergänzungen, Preisanteile (`UPComp`), X86-Auftragsexport mit Auftragsnummer, Validierung gegen das GAEB-XSD |
| Mehrbenutzer / Server | REST-API nach `docs/openapi.yaml`, Store-Persist durch API-Client ersetzen |
| Nachträge | Eigene Titel-Kennzeichnung "Nachtrag Nr." und getrennte Ausweisung in Rechnungen |
| Mehrere Aufmaß-Schemata | Weiteren Katalog in `formulas.ts` (z. B. REB 23.004) |
| Zahlungsplan / Mahnwesen | Fälligkeiten aus `rechnungen` ableiten |
| BRZ-Standardprofile | Nach Erhalt echter Exportbeispiele vordefinierte `ImportProfil`e und ggf. Sonderfälle (Kopfzeilen, Summenzeilen, Festbreitenformat) in `brzImport.ts` ergänzen; direkte Schnittstelle/API ist nicht Teil der aktuellen Version |
| PDF direkt | `@react-pdf/renderer` oder serverseitiges Rendering statt Browser-Druck |
