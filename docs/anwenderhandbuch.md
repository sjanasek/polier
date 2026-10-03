# Polier – Anwenderhandbuch

Polier ist ein Programm für die Bauabrechnung im Tief- und Hochbau. Es deckt den gesamten Weg von der Ausschreibung über Angebot, Kalkulation und Aufmaß bis zur kumulativen Abschlags- und Schlussrechnung ab.

Das Programm läuft komplett im Browser. Alle Daten werden lokal auf dem Rechner gespeichert, es wird kein Server und keine Internetverbindung benötigt.

---

## Inhalt

1. [Erste Schritte](#1-erste-schritte)
2. [Projekte](#2-projekte) und [Adressverwaltung](#adressverwaltung-kunden)
3. [Leistungsverzeichnis (LV)](#3-leistungsverzeichnis-lv)
4. [Baukalkulation](#4-baukalkulation) und [Bauzeitenplan](#bauzeitenplan)
5. [Aufmaß nach VOB/C](#5-aufmaß-nach-vobc)
6. [Stationierungsaufmaß (Tiefbau)](#6-stationierungsaufmaß-tiefbau)
7. [Rechnungen – kumulative Abrechnung](#7-rechnungen--kumulative-abrechnung)
8. [Drucken und Ausgabe](#8-drucken-und-ausgabe)
9. [Stammdaten und Datensicherung](#9-stammdaten-und-datensicherung)
10. [Typische Arbeitsabläufe](#10-typische-arbeitsabläufe)
11. [Formelkatalog](#11-formelkatalog)
12. [Häufige Fragen](#12-häufige-fragen)

---

## 1. Erste Schritte

### Programm starten

Entwicklungsversion (Quellcode vorhanden):

```
npm install
npm run dev
```

Danach im Browser `http://localhost:5173` öffnen.

Fertige Version: `npm run build` erzeugt den Ordner `dist/`. Dessen Inhalt kann auf jedem Webserver oder im Intranet abgelegt werden.

### Oberfläche

Links befindet sich die **Navigation** mit allen Modulen. Unten links wird das **aktive Projekt** angezeigt. Alle Module außer "Projekte" und "Stammdaten" beziehen sich immer auf das aktive Projekt.

| Modul | Zweck |
|---|---|
| Projekte | Projekte anlegen, auswählen, Kunde zuordnen, Konditionen pflegen |
| Adressen / Kunden | Adressverwaltung mit Kundennummern und allen Projekten je Kunde |
| Leistungsverzeichnis | Titel und Positionen mit Mengen, Einheiten und Preisen |
| Kalkulation | Einzelkosten, Mittellohn, Zuschläge, Angebotsendsumme |
| Bauzeitenplan | Balkenplan, dessen Dauern aus den Zeitansätzen der Kalkulation berechnet werden |
| Aufmaß | Aufmaßblätter mit REB-Formeln |
| Stationierung | Streckenaufmaß mit Stationen und Querprofilen |
| Rechnungen | Abschlags-, Teilschluss- und Schlussrechnungen, Zahlungen |
| Drucken / Ausgabe | LV, Angebot, Rechnung, Aufmaßblätter, Kalkulationsblatt als PDF |
| Stammdaten | Eigene Firma, Geräte- und Materialpreise, Datensicherung |

### Hell- und Dunkelmodus

Unten in der Seitenleiste wählen Sie die Darstellung: **Hell** (Standard), **Dunkel** oder **Auto**. Bei „Auto“ folgt Polier der Systemeinstellung des Geräts. Die Wahl wird im Browser gespeichert. Gedruckt wird immer hell, unabhängig vom gewählten Modus.

### Zahleneingabe

Zahlen werden in deutscher Schreibweise eingegeben: Komma als Dezimaltrenner, z. B. `1.234,56` oder `1234,56`. Ein Punkt wird ebenfalls als Dezimaltrenner akzeptiert, wenn kein Komma vorhanden ist. Mit **Enter** oder **Tab** wird der Wert übernommen.

### Beispielprojekt

Beim ersten Start ist das Beispielprojekt "Erschließung Am Lindenhof" geladen. Es enthält ein vollständiges Tiefbau-LV mit Kalkulation, Aufmaßen, Stationierungen und zwei Abschlagsrechnungen. Über **Projekte → Beispielprojekt laden** kann es jederzeit erneut angelegt werden.

---

## 2. Projekte

**Projekte → + Neu** legt ein Projekt an. Jedes Projekt hat eine **Verwendung**:

| Verwendung | Bedeutung |
|---|---|
| Angebot | Eigenes Angebot mit Preisen |
| Ausschreibung | LV ohne Preise zur Abgabe an Bieter |
| Auftrag / Abrechnung | Beauftragtes Projekt mit Aufmaß und Rechnungen |

Die Verwendung steuert nur die Voreinstellung beim Drucken. Alle Module stehen in jedem Projekt zur Verfügung.

### Adressverwaltung (Kunden)

Unter **Adressen / Kunden** liegt das Adressbuch. Jeder Kunde hat Kundennummer (automatisch `K-0001`, `K-0002` …), Name, Anschrift, Ansprechpartner, Telefon, E-Mail, USt-IdNr. und Notiz. Die Suche findet Treffer in Name, Ort, PLZ, Nummer, Ansprechpartner und E-Mail.

**Projekte kundenbezogen ablegen:**

- Im Projekt unter „Auftraggeber“ den Kunden aus dem Adressbuch wählen. Die Adresse wird ins Projekt übernommen und erscheint auf LV, Angebot und Rechnung.
- In der Kundenansicht zeigt „Projekte dieses Kunden“ alle zugeordneten Projekte mit Summe und Anzahl Rechnungen. **Öffnen** springt ins Projekt, **+ Neues Projekt** legt ein Projekt mit der Adresse des Kunden an.
- Die Projektliste lässt sich oben nach Kunde filtern („Ohne Kundenzuordnung“ zeigt Projekte ohne Zuordnung).
- Hat ein Projekt eine Adresse ohne Kundenzuordnung, speichert **Als Kunde speichern** sie im Adressbuch.
- **Kunden aus Projekten übernehmen** legt aus den Adressen bereits vorhandener Projekte automatisch Kunden an (ohne Duplikate) und ordnet die Projekte zu. Praktisch nach dem Update auf diese Version.

**Wichtig:** Die Adresse im Projekt ist eine Kopie. Ändert sich die Anschrift eines Kunden, bleiben bestehende Projekte und bereits gestellte Rechnungen unverändert. Soll ein Projekt die neue Anschrift erhalten, im Projekt **Adresse aus Adressbuch aktualisieren** wählen. Wird ein Kunde gelöscht, bleiben seine Projekte samt Adresse erhalten und verlieren nur die Zuordnung. Das Adressbuch ist Teil der Datensicherung.

### Kaufmännische Bedingungen

Hier werden MwSt.-Satz, Nachlass, Skonto, Sicherheitseinbehalt und Zahlungsziel hinterlegt. Diese Werte werden als Vorgabe in jede neue Rechnung übernommen und können dort pro Rechnung geändert werden.

Die **Vorbemerkungen** erscheinen auf dem gedruckten LV und Angebot (z. B. Verweis auf VOB/B, VOB/C, Bodenklassen).

---

## 3. Leistungsverzeichnis (LV)

### Aufbau

Ein LV besteht aus **Titeln** (z. B. "01 Erdarbeiten") und darunter liegenden **Positionen** (z. B. "01.0010 Oberboden abtragen"). Die Ordnungszahl (OZ) wird automatisch vergeben: Titel 01, 02, …; Positionen in Zehnerschritten 01.0010, 01.0020, …

- **+ Titel** legt einen neuen Titel an.
- **+ Pos** in der Titelzeile legt eine Position in diesem Titel an.
- Mit **↑ ↓** werden Titel und Positionen verschoben.
- **OZ neu nummerieren** vergibt alle Ordnungszahlen fortlaufend neu.

### Position bearbeiten

Ein Klick auf eine Zeile öffnet rechts die Positionsmaske mit OZ, Positionsart, Kurztext, Langtext, Menge, Einheit und Einheitspreis. Kurztext und Menge können auch direkt in der Tabelle geändert werden.

### Positionsarten

| Kürzel | Art | Wirkung |
|---|---|---|
| N | Normalposition | Zählt in der Angebotssumme |
| Z | Zulageposition | Zählt in der Angebotssumme |
| B | Bedarfsposition (Eventualposition) | Nur EP, nicht in der Angebotssumme; wird nachrichtlich ausgewiesen |
| A | Alternativposition | Nur EP, nicht in der Angebotssumme |
| H | Hinweistext | Kein Preis, keine Menge |

### Einheitspreis: manuell oder aus Kalkulation

Jede Position hat den Schalter **EP aus Kalkulation**:

- **aktiv** (Symbol ∑): Der EP wird aus den Kalkulationsansätzen und Zuschlägen berechnet und ist im LV nicht editierbar. Ändert sich die Kalkulation, ändert sich der EP automatisch.
- **inaktiv** (Symbol ✎): Der EP wird manuell eingetragen, z. B. bei Fremdangeboten oder Pauschalen.

Beide Arten können im selben LV gemischt werden.

### Summenanzeige

Oben werden Angebotssumme netto, Nachlass, MwSt. und Brutto laufend angezeigt. Bedarfs- und Alternativpositionen werden grau dargestellt und unterhalb der Tabelle nachrichtlich summiert.

### GAEB-Schnittstelle

Unterhalb der LV-Tabelle befindet sich die Leiste **GAEB DA XML** (Format GAEB DA XML 3.2):

| Funktion | Inhalt |
|---|---|
| Export X83 (Ausschreibung) | LV mit Titeln, Positionen, Kurz- und Langtext, Menge, Einheit, Positionsart, ohne Preise. Zur Weitergabe an Bieter oder an ein AVA-Programm |
| Export X84 (Angebot) | Wie X83, zusätzlich Einheitspreise, Gesamtpreise, Titelsummen, Nachlass, MwSt. und Bieteradresse aus den Stammdaten. Zur elektronischen Angebotsabgabe |
| Import (X81–X86) | Liest eine GAEB-Datei ein. Nach Auswahl der Datei kann gewählt werden, ob ein **neues Projekt** angelegt oder das **LV des aktuellen Projekts ersetzt** wird |

Beim Import werden übernommen: Projektname und -bezeichnung, Auftraggeberadresse, Vorbemerkungen, Titel (auch mehrstufig, die Ebenen werden zu einem Titel mit zusammengesetzter OZ zusammengefasst), Positionen mit Kurz-/Langtext, Menge, Einheit, Positionsart (Bedarf, Alternativ, Zulage, Hinweistext) und, falls vorhanden, Einheitspreise. Importierte Preise werden als manuelle EP gesetzt; die Kalkulation kann anschließend je Position aktiviert werden.

Die Dateiendung entspricht der Phase (`.X83`, `.X84`). Das Auswahlfeld filtert bewusst nicht nach Dateiendung, damit auch Geräte wie das iPad, die diese Endungen nicht kennen, die Datei anbieten. Wird eine Datei gewählt, die kein GAEB-XML ist, erscheint eine Fehlermeldung. Die Dateien können in jedem GAEB-fähigen Programm (AVA-Software, Vergabeplattformen) geöffnet werden.

---

## 4. Baukalkulation

Die Kalkulation folgt dem Schema der KLR Bau: Einzelkosten der Teilleistungen (EKT) je Position, darauf Baustellengemeinkosten (BGK), Allgemeine Geschäftskosten (AGK) sowie Wagnis und Gewinn (W&G).

### Reiter "Mittellohn"

Hier wird der **Kalkulationslohn** ermittelt:

```
Grundlohn (gewichteter Mittellohn)
+ Zulagen in %                       (Erschwernis, Vorarbeiter, Überstunden)
= Mittellohn A
+ Lohngebundene Kosten / Sozialkosten in %
+ Lohnnebenkosten in %              (Auslösung, Fahrtkosten)
= Kalkulationslohn (€/h)
```

Der Kalkulationslohn wird automatisch für alle Lohnansätze verwendet, deren Preis 0 ist. Ein abweichender Stundensatz (z. B. für Fachkräfte) kann je Ansatz eingetragen werden.

### Reiter "Positionskalkulation (EKT)"

Links werden alle Positionen mit ihren Einzelkosten je Einheit, aufgeteilt nach Kostenart, angezeigt. Ein Klick öffnet rechts die **Ansätze** der Position. Jeder Ansatz hat:

| Feld | Bedeutung |
|---|---|
| Kostenart | Lohn, Stoffe/Material, Geräte/Maschinen, Fremdleistung/NU, Sonstiges |
| Bezeichnung | Freitext; bei Geräten und Stoffen werden Vorschläge aus den Stammdaten angeboten und der Preis automatisch übernommen |
| Menge/E | Bedarf je LV-Einheit, bei Lohn in Stunden (z. B. 0,35 h je m³) |
| Einheit | Einheit des Ansatzes (h, t, m³, St …) |
| Preis | Preis je Ansatz-Einheit; bei Lohn 0 = Kalkulationslohn |

Unterhalb der Ansätze wird gezeigt, wie aus den EKT je Kostenart mit den jeweiligen Zuschlagsätzen der **Einheitspreis** entsteht.

### Reiter "Zuschläge & Gemeinkosten"

**Detaillierte Zuschläge je Kostenart** – für die Zuschlagskalkulation. Jede Kostenart erhält getrennte Prozentsätze für BGK, AGK und W&G. So kann z. B. der Lohn mit 35 % und die Fremdleistung nur mit 10 % beaufschlagt werden.

**Baustellengemeinkosten** – für die Endsummenkalkulation. Hier werden die BGK als absolute Beträge erfasst (Baustelleneinrichtung, Bauleitung, Container, Bauwasser …).

### Reiter "Übersicht & Endsumme"

Hier wird die **Kalkulationsmethode** gewählt:

**1. Kalkulation über die Angebotsendsumme (Umlageverfahren)**

```
Summe EKT
+ BGK (absolut)
= Herstellkosten
Angebotssumme = Herstellkosten × 100 / (100 − AGK % − W&G %)
Umlage = Angebotssumme − Summe EKT
```

Die Umlage wird anschließend auf die Kostenarten verteilt. Die **Gewichtung** steuert die Verteilung: 1 = voller Anteil, 0,5 = halber Anteil, 0 = kein Zuschlag auf diese Kostenart. Beispiel: Fremdleistungen mit 0,5 gewichten, damit Nachunternehmerleistungen weniger Gemeinkosten tragen als Eigenleistungen. Daraus ergeben sich die Zuschlagsätze je Kostenart, die auf jede Position angewendet werden.

**Angebotsendsumme vorgeben:** Wird im Feld "Angebotsendsumme vorgeben" ein Betrag eingetragen, rechnet das Programm rückwärts. Die Zuschlagsätze werden so bestimmt, dass die Summe aller Positionen genau diese Zielsumme ergibt. Der verbleibende Deckungsbeitrag für AGK und W&G wird angezeigt. Das ist z. B. bei Preisverhandlungen oder bei Anpassung an ein Budget hilfreich. Der Wert 0 schaltet den Modus ab.

**2. Zuschlagskalkulation**

EP = Σ (EKT je Kostenart × (1 + BGK % + AGK % + W&G %)). Die Zuschläge stammen aus dem Reiter "Zuschläge & Gemeinkosten".

Das **Schlussblatt** zeigt EKT je Kostenart, BGK, Herstellkosten, AGK, W&G und die kalkulierte Angebotssumme. Darunter steht die Angebotssumme laut LV mit auf Cent gerundeten Einheitspreisen und die Rundungsdifferenz.

---

### Bauzeitenplan

Der Bauzeitenplan greift auf die **Zeitansätze der Kalkulation** zu. Die Dauer eines Vorgangs ergibt sich so:

```
Stunden = Σ (Stunden je Einheit aus den Ansätzen × Positionsmenge)
Dauer in Arbeitstagen = aufgerundet( Stunden ÷ (Kräfte × Arbeitsstunden je Tag) )
```

Ändern Sie in der Kalkulation einen Stundenansatz oder im LV eine Menge, ändert sich die Dauer im Plan sofort.

**Vorgehen**

1. Im Bauzeitenplan Baubeginn, Arbeitsstunden je Tag (Standard 8), Standardbesetzung und Arbeitstage festlegen. Mit „Gesetzl. Feiertage eintragen“ werden die bundesweiten Feiertage für Baujahr und Folgejahr übernommen; weitere Ausfalltage (Regional-, Urlaubs-, Schlechtwettertage) lassen sich einzeln hinzufügen.
2. „Aus LV erzeugen“ legt je Titel oder je Position einen Vorgang an. Nur Normal- und Zulagepositionen werden berücksichtigt, Bedarfs- und Alternativpositionen nicht. Auf Wunsch werden die Vorgänge nacheinander verknüpft.
3. Je Vorgang anpassen: **Basis** (Lohnstunden, Gerätestunden oder manuelle Dauer), **Kräfte** (0 = Standardbesetzung), **Vorgänger** als Zeilennummern (z. B. „1, 3“), **Verzug** in Arbeitstagen (negativ = Überlappung). Ein Klick auf die Zeile öffnet die Zuordnung der Positionen und einen optionalen frühesten Beginn.
4. Der Balkenplan zeigt Vorgänge, Abhängigkeiten, Wochenenden und Feiertage. Orange Balken liegen auf dem **kritischen Weg** (kein Puffer), grüne haben Puffer. Dauer 0 ergibt einen Meilenstein.

**Hinweise**

- Gerätestunden zählen nur Geräteansätze mit der Einheit „h“. Fremdleistungen, Stoffe und Geräteansätze in Tagen haben keine Zeitbasis und fließen nicht ein; solche Vorgänge brauchen die Basis „manuell“.
- Hat ein Vorgang keine Zeitansätze, werden 1 Tag angesetzt und ein Warnzeichen angezeigt.
- Positionen mit Zeitansätzen, die keinem Vorgang zugeordnet sind, werden in einem Hinweis oben gemeldet.
- Oben stehen Baubeginn, Bauende, Bauzeit in Arbeits- und Kalendertagen, Lohnstunden und die maximale gleichzeitige Besetzung.
- Ausdruck: Drucken / Ausgabe → Bauzeitenplan.

## 5. Aufmaß nach VOB/C

Das Aufmaß dient der Mengenermittlung für die Abrechnung nach den Abrechnungsregeln der ATV (VOB Teil C). Die Mengen aus Aufmaß und Stationierung fließen automatisch in die Rechnungen.

### Aufmaßzeile

| Feld | Bedeutung |
|---|---|
| Blatt | Aufmaßblatt-Nummer, z. B. A-01. Zeilen mit gleicher Blattnummer werden zusammen gedruckt |
| Datum | Datum des Aufmaßes. Entscheidend für den Leistungsstand zum Stichtag einer Rechnung |
| Position | LV-Position, der die Menge zugeordnet wird |
| Formel | Formel aus dem Katalog (siehe Abschnitt 11). Die Formel wird darunter angezeigt |
| Werte | Eingabefelder für die Parameter der Formel (a, b, h, l …) |
| Faktor | Anzahl bzw. Multiplikator, z. B. 2 für beidseitig |
| Abzug | Markiert die Zeile als Abzug (negatives Ergebnis), z. B. für Öffnungen oder Bestandsschächte |
| Ergebnis | Berechnete Menge in der Einheit der Position |
| Bemerkung | Ort, Achse, Haltung, Bauteil |

**+ Zeile** übernimmt Blatt, Datum und Position der letzten Zeile. **⧉** kopiert eine Zeile. Über die Filter oben lässt sich die Anzeige auf ein Blatt oder eine Position eingrenzen; dann wird unten die Summe der Position angezeigt.

### Freie Formel (Nr. 91)

Mit Nr. 91 kann eine beliebige Formel mit den Variablen a bis h eingegeben werden, z. B. `a * b - c * d / 2` oder `(a + b) / 2 * h`. Erlaubt sind `+ - * / ^`, Klammern, `pi`, `sqrt()`, `abs()`, `sin()`, `cos()`, `tan()` (Grad) und `round()`. Fehler werden rot unter den Werten angezeigt.

### Mengenübersicht

Unterhalb des Aufmaßblatts zeigt die Mengenübersicht je Position die LV-Menge, die Summe aus REB-Aufmaß, die Summe aus Stationierung, die Gesamtmenge und den Erfüllungsgrad. Überschreitet die Menge die LV-Menge um mehr als 10 %, erscheint ein Hinweis auf § 2 Abs. 3 VOB/B (Mengenänderung).

---

## 6. Stationierungsaufmaß (Tiefbau)

Für Straßen, Kanäle, Leitungsgräben und Dämme wird nach Stationen abgerechnet. Eine Stationierung ist eine Achse oder ein Abschnitt mit mehreren Stationen; zwischen je zwei Stationen wird nach dem Mittelwertverfahren (Gauß-Elling) gerechnet:

```
Ergebnis Abschnitt = (Q1 + Q2) / 2 × Δl
```

Q1 und Q2 sind die Querschnittswerte an Anfang und Ende, Δl der Stationsabstand.

### Berechnungsarten

| Art | Eingabe je Station | Ergebnis |
|---|---|---|
| Länge | nur Station | Länge in m (z. B. Rohrleitung, Bordstein) |
| Fläche aus Breite | Breite in m | Fläche in m² (z. B. Tragschicht, Asphalt) |
| Volumen aus Querschnittsfläche | Querschnittsfläche in m² | Volumen in m³ (z. B. Straßenkoffer, Damm aus Querprofilen) |
| Volumen aus Breite × Tiefe | Breite und Tiefe in m | Volumen in m³ (z. B. Rohrgraben) |

### Bedienung

1. **+ Neu** legt eine Stationierung an. Blatt-Nr., Datum, Bezeichnung (z. B. "Achse A Haupttrasse"), LV-Position und Berechnungsart eintragen.
2. **+ Station** fügt eine Station an. Stationen werden als `km+m` eingegeben, z. B. `0+125,50`; die Eingabe `125,5` ist ebenfalls möglich. Stationen werden automatisch sortiert.
3. Rechts erscheint die **Abschnittsberechnung** mit allen Teilabschnitten und der Summe.

Faktor und Abzug wirken wie beim Aufmaß. Das Ergebnis wird der LV-Position zugeordnet und erscheint in der Mengenübersicht und den Rechnungen.

---

## 7. Rechnungen – kumulative Abrechnung

Rechnungen werden nach § 16 VOB/B kumulativ aufgebaut: Jede Rechnung weist den **gesamten** Leistungsstand bis zum Stichtag aus und zieht die Beträge der vorherigen Rechnungen ab.

### Rechnung anlegen

**+ Rechnung** erzeugt die nächste laufende Rechnung mit den Konditionen aus dem Projekt. Felder:

| Feld | Bedeutung |
|---|---|
| Rechnungs-Nr. | Freie Nummer, Vorschlag Jahr-Projekt-lfdNr |
| Typ | Abschlagsrechnung, Teilschlussrechnung, Schlussrechnung |
| Rechnungsdatum | Datum der Rechnung; Grundlage für Skonto- und Zahlungsfrist |
| Leistungsstand bis (Stichtag) | Alle Aufmaße und Stationierungen bis einschließlich dieses Datums werden berücksichtigt |
| Nachlass, Sicherheitseinbehalt, Skonto, Zahlungsziel | Vorgaben aus dem Projekt, je Rechnung änderbar |
| § 13b UStG | Steuerschuldnerschaft des Leistungsempfängers: MwSt. 0 mit Hinweistext |
| Status | Entwurf, Gestellt, Bezahlt |

### Rechnungssumme

```
Leistungsstand gesamt netto (kumuliert)
− Nachlass %
− Sicherheitseinbehalt %
− Sonstige Abzüge (z. B. Bauwesenversicherung, Bauwasser)
= Netto
+ MwSt.
= Brutto kumuliert
− Rechnungsbeträge aller vorherigen Rechnungen
= Rechnungsbetrag (zu zahlen)
```

Zusätzlich werden Skontobetrag, Skontofrist und Fälligkeit angezeigt.

### Rechnung stellen (festschreiben)

Solange eine Rechnung im Status **Entwurf** ist, werden die Mengen live aus dem Aufmaß berechnet. Mit **Rechnung stellen (festschreiben)** werden die Mengen zum Stichtag eingefroren und der Status auf "Gestellt" gesetzt. Spätere Aufmaßänderungen wirken sich dann nur noch auf die nächste Rechnung aus. Die Festschreibung kann wieder aufgehoben werden.

Empfehlung: Rechnung erst drucken, dann festschreiben, damit die gedruckte Rechnung und die gespeicherten Mengen übereinstimmen.

### Zahlungseingänge

Je Rechnung werden Zahlungen mit Datum, Betrag und Bemerkung erfasst. **+ Zahlung** schlägt den offenen Betrag vor. Die Kennzahlen oben zeigen gestellte Summe, Zahlungseingänge und offenen Saldo über alle Rechnungen.

### Leistungsstand je Position

Die Tabelle unten zeigt je Position die LV-Menge, die Menge der Vorrechnung, die neue Menge, die kumulierte Menge, EP, GP kumuliert und den Anteil der aktuellen Rechnung.

---

## 8. Drucken und Ausgabe

**Drucken / Ausgabe** zeigt eine Druckvorschau im A4-Format. Auswahl:

| Ausgabe | Inhalt |
|---|---|
| LV / Ausschreibung (ohne Preise) | Alle Titel und Positionen mit Langtext, Preisfelder zum Ausfüllen |
| Angebot (mit Preisen) | LV mit EP, GP, Titelsummen, Nachlass, MwSt., Brutto, Zahlungsbedingungen, Unterschrift |
| Rechnung | Kumulative Rechnung mit Leistungsstand je Position, Abzügen und Vorrechnungen |
| Aufmaßblätter | Alle Aufmaßblätter und Stationierungen mit Formeln, Werten und Ergebnissen, Unterschriftsfelder |
| Kalkulationsblatt | Schlussblatt und Positionsliste mit EKT je Kostenart (nur intern) |

**Drucken / als PDF speichern** öffnet den Druckdialog des Browsers. Dort "Als PDF speichern" wählen. Absender- und Fußzeile stammen aus den Stammdaten (Firma, Bank, Steuernummer).

---

## 9. Stammdaten und Datensicherung

### Eigene Firma

Name, Anschrift, Bankverbindung, USt-IdNr. und Steuernummer erscheinen auf allen Ausdrucken.

### Geräteliste und Materialpreisliste

Hier gepflegte Geräte (mit Stundensatz) und Materialien (mit Einheit und Preis) werden in der Positionskalkulation als Vorschlag angeboten. Wird eine Bezeichnung ausgewählt, werden Preis und Einheit automatisch in den Ansatz übernommen.

### Datensicherung

Alle Daten liegen im lokalen Speicher des Browsers. Sie bleiben beim Schließen erhalten, gehen aber verloren, wenn die Browserdaten gelöscht werden oder ein anderer Rechner verwendet wird.

- **Sicherung exportieren** speichert alle Projekte und Stammdaten in einer JSON-Datei.
- **Sicherung importieren** liest eine solche Datei ein und ersetzt die vorhandenen Daten.

Empfehlung: Nach jedem Arbeitstag exportieren und die Datei auf dem Firmenserver ablegen.

---

## 10. Typische Arbeitsabläufe

### Ausschreibung erstellen

1. Projekt anlegen, Verwendung "Ausschreibung", Auftraggeber und Vorbemerkungen eintragen.
2. LV mit Titeln und Positionen aufbauen; Langtexte ausformulieren; Bedarfs- und Alternativpositionen kennzeichnen.
3. Drucken → "LV / Ausschreibung (ohne Preise)".

### Angebot kalkulieren

1. Projekt anlegen (Verwendung "Angebot") oder LV übernehmen.
2. Stammdaten: Geräte- und Materialpreise prüfen.
3. Kalkulation → Mittellohn einstellen.
4. Kalkulation → Positionskalkulation: je Position Ansätze für Lohn, Stoffe, Geräte, Fremdleistung erfassen.
5. Kalkulation → Zuschläge: BGK-Posten erfassen, AGK und W&G festlegen, Umlagegewichtung prüfen.
6. Übersicht: Angebotssumme kontrollieren, bei Bedarf Angebotsendsumme vorgeben.
7. Im LV "EP aus Kalkulation" bei allen Positionen aktiv lassen.
8. Drucken → "Angebot (mit Preisen)".

### Abrechnung eines laufenden Auftrags

1. Projekt auf "Auftrag / Abrechnung" setzen; Sicherheitseinbehalt und Nachlass laut Vertrag eintragen.
2. Laufend Aufmaßblätter und Stationierungen mit Datum erfassen.
3. Zum Monatsende: Rechnungen → + Rechnung, Stichtag setzen, Rechnungssumme prüfen.
4. Drucken → Rechnung, dann "Rechnung stellen (festschreiben)".
5. Zahlungseingang erfassen, Status "Bezahlt".
6. Am Ende Typ "Schlussrechnung" wählen; den Sicherheitseinbehalt je nach Vertrag reduzieren (z. B. auf 3 % Gewährleistung) oder auf 0 setzen.

---

## 11. Formelkatalog

Die Nummerierung lehnt sich an die REB-VB 23.003 (Allgemeine Formeln) an. Formeln können in der Datei `src/lib/formulas.ts` ergänzt oder angepasst werden.

| Nr. | Name | Formel |
|---|---|---|
| 01 | Rechteck | a · b |
| 02 | Quader | a · b · c |
| 03 | Dreieck | a · h / 2 |
| 04 | Dreiecksprisma | a · h / 2 · l |
| 05 | Trapez | (a + b) / 2 · h |
| 06 | Trapezprisma (Graben) | (a + b) / 2 · h · l |
| 07 | Kreis (Durchmesser) | π · d² / 4 |
| 08 | Zylinder | π · d² / 4 · h |
| 09 | Kreisring | π / 4 · (D² − d²) |
| 10 | Kreisringzylinder (Rohr) | π / 4 · (D² − d²) · l |
| 11 | Kreisausschnitt | π · r² · α / 360 |
| 12 | Kreisbogen (Länge) | π · d · α / 360 |
| 13 | Ellipse | π · a · b / 4 |
| 14 | Kugel | π · d³ / 6 |
| 15 | Pyramide | a · b · h / 3 |
| 16 | Pyramidenstumpf | h / 3 · (A1 + √(A1 · A2) + A2) |
| 17 | Kegel | π · d² / 4 · h / 3 |
| 18 | Kegelstumpf | π · h / 12 · (D² + D · d + d²) |
| 19 | Prismatoid (Simpson) | l / 6 · (A1 + 4 · Am + A2) |
| 20 | Mittelwert zweier Querschnitte (Gauß-Elling) | (A1 + A2) / 2 · l |
| 21 | Rechteck mit Mittelhöhe | a · b · (h1 + h2) / 2 |
| 22 | Rechteck mit 4 Eckhöhen | a · b · (h1 + h2 + h3 + h4) / 4 |
| 23 | Dreieck aus 3 Seiten (Heron) | √(s · (s−a) · (s−b) · (s−c)) |
| 24 | Böschungsfläche | √(b² + h²) · l |
| 25 | Graben mit Böschung | (b + n · t) · t · l |
| 26 | Rohrgraben Breite × Tiefe × Länge | b · t · l |
| 30 | Länge | l |
| 31 | Summe von Längen | l1 + l2 + l3 + l4 |
| 32 | Fläche minus Abzug | a · b − c · d |
| 40 | Stück / Anzahl | n |
| 41 | Gewicht aus Länge | l · g / 1000 |
| 42 | Masse aus Volumen | V · ρ |
| 43 | Fläche aus Masse (Asphalt) | m / (d · ρ) |
| 90 | Wert (direkt) | w |
| 91 | Freie Formel | Ausdruck mit a … h |

---

## 12. Häufige Fragen

**Der EP im LV lässt sich nicht ändern.**
Die Position steht auf "EP aus Kalkulation". Schalter in der Positionsmaske deaktivieren oder den Preis über die Kalkulationsansätze steuern.

**Die Angebotssumme in der Kalkulation weicht leicht vom LV ab.**
Die Einheitspreise werden auf Cent gerundet. Bei großen Mengen ergibt sich daraus eine kleine Rundungsdifferenz, die im Schlussblatt ausgewiesen wird.

**Eine Aufmaßzeile erscheint nicht in der Rechnung.**
Das Aufmaßdatum liegt nach dem Stichtag der Rechnung, oder die Rechnung ist festgeschrieben. Stichtag prüfen bzw. Festschreibung aufheben.

**Wie werden Mengen bei mehreren Rechnern geteilt?**
Über Export und Import der Sicherungsdatei. Eine gemeinsame Datenbank ist in der aktuellen Version nicht enthalten.

**Kann ich das LV als GAEB-Datei ausgeben?**
Ja, im Modul Leistungsverzeichnis unten (siehe Abschnitt 3, „GAEB-Schnittstelle“).
