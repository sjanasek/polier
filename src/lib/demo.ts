import type { Projekt } from '../types';
import { neuesProjekt } from './defaults';
import { uid } from './format';
import type { Kunde } from '../types';
import { kundeAdresse } from './kunden';
import { bundesFeiertage, standardBauzeit, vorgaengeAusLV } from './bauzeit';
import { zeilenHash } from './brzImport';
import type { ImportProtokoll, KostenZeile, Kostenart, Nachkalkulation, StundenZeile } from '../types';

export const DEMO_KUNDE_ID = 'kunde-demo-stadt';

/** Beispielkunden für das Adressbuch */
export const demoKunden = (): Kunde[] => [
  { id: DEMO_KUNDE_ID, kundenNr: 'K-0001', name: 'Stadt Musterstadt', zusatz: 'Tiefbauamt', strasse: 'Rathausplatz 1', plz: '12345', ort: 'Musterstadt', telefon: '01234 5678-0', email: 'tiefbau@musterstadt.de', ansprechpartner: 'Frau Beispiel', ustId: '', notiz: 'Öffentlicher Auftraggeber, Zahlungsziel 30 Tage' },
  { id: 'kunde-demo-wohnbau', kundenNr: 'K-0002', name: 'Lindenhof Wohnbau GmbH', zusatz: '', strasse: 'Gartenweg 12', plz: '12347', ort: 'Musterstadt', telefon: '', email: 'info@lindenhof-wohnbau.example', ansprechpartner: 'Herr Muster', ustId: '', notiz: 'Bauträger' },
];

/** Beispielprojekt Tiefbau, damit alle Module sofort mit Daten gezeigt werden können. */
export function demoProjekt(): Projekt {
  const p = neuesProjekt('2026-014');
  p.bezeichnung = 'Erschließung Am Lindenhof';
  p.art = 'auftrag';
  p.bauvorhaben = 'Erschließung Baugebiet "Am Lindenhof", 2. BA';
  p.bauort = 'Musterstadt, Lindenhofstraße';
  p.kundeId = DEMO_KUNDE_ID;
  p.auftraggeber = kundeAdresse(demoKunden()[0]);
  p.vorbemerkungen = 'Es gelten die VOB/B und VOB/C in der zum Zeitpunkt der Angebotsabgabe gültigen Fassung. Abrechnung nach Aufmaß gem. ATV DIN 18300 / 18306 / 18317.';
  p.nachlassProzent = 2;
  p.skontoProzent = 2;

  const posErd1 = uid(), posErd2 = uid(), posKanal1 = uid(), posKanal2 = uid(), posKanal3 = uid(), posStr1 = uid(), posStr2 = uid(), posStr3 = uid();

  p.lv = [
    {
      id: uid(), oz: '01', bezeichnung: 'Erdarbeiten (DIN 18300)', vorbemerkung: 'Bodenklasse 3–5 nach DIN 18300. Aushub seitlich lagern.',
      positionen: [
        { id: posErd1, oz: '01.0010', kurztext: 'Oberboden abtragen, d = 30 cm, seitlich lagern', langtext: 'Oberboden abtragen, Dicke im Mittel 30 cm, Boden seitlich auf der Baustelle in Mieten lagern. Abrechnung nach m² Fläche.', menge: 2400, einheit: 'm²', art: 'N', ep: 0, epAusKalkulation: true,
          ansaetze: [
            { id: uid(), kostenart: 'lohn', bezeichnung: 'Facharbeiter / Maschinist', menge: 0.012, preis: 0, einheit: 'h' },
            { id: uid(), kostenart: 'geraete', bezeichnung: 'Bagger 14 t', menge: 0.012, preis: 48, einheit: 'h' },
            { id: uid(), kostenart: 'geraete', bezeichnung: 'Radlader 8 t', menge: 0.008, preis: 38, einheit: 'h' },
          ] },
        { id: posErd2, oz: '01.0020', kurztext: 'Boden lösen und laden, Straßenkoffer, BK 3–5', langtext: 'Boden für Straßenkoffer profilgerecht lösen, laden und innerhalb der Baustelle einbauen bzw. zur Deponie fördern. Bodenklasse 3–5. Abrechnung nach m³ im festen Zustand (Stationierungsaufmaß).', menge: 1850, einheit: 'm³', art: 'N', ep: 0, epAusKalkulation: true,
          ansaetze: [
            { id: uid(), kostenart: 'lohn', bezeichnung: 'Maschinist + Helfer', menge: 0.06, preis: 0, einheit: 'h' },
            { id: uid(), kostenart: 'geraete', bezeichnung: 'Bagger 14 t', menge: 0.04, preis: 48, einheit: 'h' },
            { id: uid(), kostenart: 'geraete', bezeichnung: 'LKW 3-Achser', menge: 0.05, preis: 55, einheit: 'h' },
            { id: uid(), kostenart: 'sonstiges', bezeichnung: 'Deponiegebühr Z0 (anteilig)', menge: 0.4, preis: 9.5, einheit: 't' },
          ] },
      ],
    },
    {
      id: uid(), oz: '02', bezeichnung: 'Kanalbau (DIN 18306)', vorbemerkung: '',
      positionen: [
        { id: posKanal1, oz: '02.0010', kurztext: 'Rohrgraben herstellen, T bis 2,00 m, verbaut', langtext: 'Rohrgraben nach DIN 4124 herstellen, Tiefe bis 2,00 m, Grabenbreite nach DIN EN 1610, inkl. Verbau, Wasserhaltung und Wiederverfüllen in Lagen. Abrechnung nach m³ Grabenraum.', menge: 420, einheit: 'm³', art: 'N', ep: 0, epAusKalkulation: true,
          ansaetze: [
            { id: uid(), kostenart: 'lohn', bezeichnung: 'Kolonne (3 AK)', menge: 0.35, preis: 0, einheit: 'h' },
            { id: uid(), kostenart: 'geraete', bezeichnung: 'Bagger 14 t', menge: 0.12, preis: 48, einheit: 'h' },
            { id: uid(), kostenart: 'geraete', bezeichnung: 'Grabenverbau', menge: 0.05, preis: 12, einheit: 'Tag' },
            { id: uid(), kostenart: 'geraete', bezeichnung: 'Rüttelplatte', menge: 0.1, preis: 6.5, einheit: 'h' },
          ] },
        { id: posKanal2, oz: '02.0020', kurztext: 'Kanalrohr PP SN 8 DN 200 liefern und verlegen', langtext: 'Kanalrohr aus PP, SN 8, DN 200, inkl. Formstücke, Sandbettung und Abdeckung nach DIN EN 1610. Abrechnung nach m Rohrachse.', menge: 180, einheit: 'm', art: 'N', ep: 0, epAusKalkulation: true,
          ansaetze: [
            { id: uid(), kostenart: 'lohn', bezeichnung: 'Rohrleger + Helfer', menge: 0.45, preis: 0, einheit: 'h' },
            { id: uid(), kostenart: 'stoffe', bezeichnung: 'KG-Rohr DN 200 inkl. Verschnitt', menge: 1.03, preis: 22.5, einheit: 'm' },
            { id: uid(), kostenart: 'stoffe', bezeichnung: 'Bettungssand 0/2', menge: 0.45, preis: 16, einheit: 't' },
          ] },
        { id: posKanal3, oz: '02.0030', kurztext: 'Schacht DN 1000 Beton, T bis 2,50 m', langtext: 'Kontrollschacht aus Betonfertigteilen DN 1000, Tiefe bis 2,50 m, mit Konus, Steigeisen, Gelenkstück und Abdeckung Klasse D 400.', menge: 5, einheit: 'St', art: 'N', ep: 0, epAusKalkulation: true,
          ansaetze: [
            { id: uid(), kostenart: 'lohn', bezeichnung: 'Kolonne', menge: 9, preis: 0, einheit: 'h' },
            { id: uid(), kostenart: 'stoffe', bezeichnung: 'Schachtfertigteile inkl. Abdeckung D400', menge: 1, preis: 1380, einheit: 'St' },
            { id: uid(), kostenart: 'geraete', bezeichnung: 'Bagger 14 t', menge: 3.5, preis: 48, einheit: 'h' },
          ] },
        { id: uid(), oz: '02.0040', kurztext: 'Zulage Fels im Rohrgraben', langtext: 'Zulage zu Pos. 02.0010 für Lösen von Fels (Bodenklasse 6–7).', menge: 20, einheit: 'm³', art: 'Z', ep: 0, epAusKalkulation: true,
          ansaetze: [
            { id: uid(), kostenart: 'lohn', bezeichnung: 'Maschinist', menge: 0.5, preis: 0, einheit: 'h' },
            { id: uid(), kostenart: 'geraete', bezeichnung: 'Bagger mit Hydraulikhammer', menge: 0.5, preis: 72, einheit: 'h' },
          ] },
        { id: uid(), oz: '02.0050', kurztext: 'Bedarfsposition: Wasserhaltung offen, zusätzlich', langtext: 'Offene Wasserhaltung mit Pumpe bis 20 m³/h, bei Bedarf, nach Anordnung der Bauleitung.', menge: 10, einheit: 'Tag', art: 'B', ep: 0, epAusKalkulation: true,
          ansaetze: [
            { id: uid(), kostenart: 'lohn', bezeichnung: 'Kontrolle', menge: 1, preis: 0, einheit: 'h' },
            { id: uid(), kostenart: 'geraete', bezeichnung: 'Pumpe inkl. Schläuche', menge: 1, preis: 45, einheit: 'Tag' },
          ] },
      ],
    },
    {
      id: uid(), oz: '03', bezeichnung: 'Straßenbau (DIN 18315 / 18317)', vorbemerkung: '',
      positionen: [
        { id: posStr1, oz: '03.0010', kurztext: 'Schottertragschicht 0/32, d = 35 cm', langtext: 'Schottertragschicht aus Schotter 0/32 nach TL SoB-StB, Dicke 35 cm, profilgerecht einbauen und verdichten (Ev2 ≥ 120 MN/m²). Abrechnung nach m² (Stationierungsaufmaß).', menge: 1650, einheit: 'm²', art: 'N', ep: 0, epAusKalkulation: true,
          ansaetze: [
            { id: uid(), kostenart: 'lohn', bezeichnung: 'Kolonne', menge: 0.05, preis: 0, einheit: 'h' },
            { id: uid(), kostenart: 'stoffe', bezeichnung: 'Schotter 0/32 (0,35 m × 2,1 t/m³)', menge: 0.76, preis: 14.5, einheit: 't' },
            { id: uid(), kostenart: 'geraete', bezeichnung: 'Grader / Walze', menge: 0.02, preis: 85, einheit: 'h' },
          ] },
        { id: posStr2, oz: '03.0020', kurztext: 'Asphalttragschicht AC 22 T, d = 10 cm', langtext: 'Asphalttragschicht AC 22 T N, Dicke 10 cm, einbauen und verdichten.', menge: 1650, einheit: 'm²', art: 'N', ep: 0, epAusKalkulation: true,
          ansaetze: [
            { id: uid(), kostenart: 'fremd', bezeichnung: 'NU Asphaltbau (Einbau komplett)', menge: 1, preis: 19.8, einheit: 'm²' },
            { id: uid(), kostenart: 'lohn', bezeichnung: 'Begleitung / Anschlüsse', menge: 0.01, preis: 0, einheit: 'h' },
          ] },
        { id: posStr3, oz: '03.0030', kurztext: 'Hochbord 15/30 auf Betonfundament', langtext: 'Betonhochbordstein 15/30 nach DIN 483 auf Betonfundament C12/15 mit Rückenstütze setzen.', menge: 560, einheit: 'm', art: 'N', ep: 0, epAusKalkulation: true,
          ansaetze: [
            { id: uid(), kostenart: 'lohn', bezeichnung: 'Pflasterer + Helfer', menge: 0.4, preis: 0, einheit: 'h' },
            { id: uid(), kostenart: 'stoffe', bezeichnung: 'Betonbordstein 15/30', menge: 1.02, preis: 7.8, einheit: 'm' },
            { id: uid(), kostenart: 'stoffe', bezeichnung: 'Beton C12/15 Fundament', menge: 0.07, preis: 105, einheit: 'm³' },
          ] },
        { id: uid(), oz: '03.0040', kurztext: 'Alternativ: Hochbord Naturstein Granit 15/30', langtext: 'Alternativposition zu 03.0030: Granitbordstein 15/30.', menge: 560, einheit: 'm', art: 'A', ep: 0, epAusKalkulation: true,
          ansaetze: [
            { id: uid(), kostenart: 'lohn', bezeichnung: 'Pflasterer + Helfer', menge: 0.45, preis: 0, einheit: 'h' },
            { id: uid(), kostenart: 'stoffe', bezeichnung: 'Granitbord 15/30', menge: 1.02, preis: 24, einheit: 'm' },
            { id: uid(), kostenart: 'stoffe', bezeichnung: 'Beton C12/15 Fundament', menge: 0.07, preis: 105, einheit: 'm³' },
          ] },
        { id: uid(), oz: '03.0050', kurztext: 'Hinweis: Verkehrssicherung', langtext: 'Die Verkehrssicherung ist in die Einheitspreise einzurechnen.', menge: 0, einheit: '', art: 'H', ep: 0, epAusKalkulation: false, ansaetze: [] },
      ],
    },
  ];

  p.aufmass = [
    { id: uid(), blattNr: 'A-01', datum: '2026-08-14', positionId: posErd1, formelNr: '01', werte: [96.5, 12.4], freieFormel: '', faktor: 1, abzug: false, bemerkung: 'Haupttrasse, Station 0+000 bis 0+096,5' },
    { id: uid(), blattNr: 'A-01', datum: '2026-08-14', positionId: posErd1, formelNr: '01', werte: [42, 11.8], freieFormel: '', faktor: 1, abzug: false, bemerkung: 'Stichstraße' },
    { id: uid(), blattNr: 'A-01', datum: '2026-08-14', positionId: posErd1, formelNr: '01', werte: [6, 6], freieFormel: '', faktor: 1, abzug: true, bemerkung: 'Abzug Bestandsschacht' },
    { id: uid(), blattNr: 'A-02', datum: '2026-08-28', positionId: posKanal1, formelNr: '06', werte: [0.9, 1.3, 1.85, 62.5], freieFormel: '', faktor: 1, abzug: false, bemerkung: 'Haltung S1–S2' },
    { id: uid(), blattNr: 'A-02', datum: '2026-08-28', positionId: posKanal1, formelNr: '06', werte: [0.9, 1.3, 1.95, 58], freieFormel: '', faktor: 1, abzug: false, bemerkung: 'Haltung S2–S3' },
    { id: uid(), blattNr: 'A-02', datum: '2026-08-28', positionId: posKanal2, formelNr: '31', werte: [62.5, 58, 0, 0], freieFormel: '', faktor: 1, abzug: false, bemerkung: 'Haltungen S1–S3' },
    { id: uid(), blattNr: 'A-02', datum: '2026-08-28', positionId: posKanal3, formelNr: '40', werte: [3], freieFormel: '', faktor: 1, abzug: false, bemerkung: 'S1, S2, S3' },
    { id: uid(), blattNr: 'A-03', datum: '2026-09-18', positionId: posKanal1, formelNr: '06', werte: [0.9, 1.3, 2.0, 55], freieFormel: '', faktor: 1, abzug: false, bemerkung: 'Haltung S3–S4' },
    { id: uid(), blattNr: 'A-03', datum: '2026-09-18', positionId: posKanal2, formelNr: '30', werte: [55], freieFormel: '', faktor: 1, abzug: false, bemerkung: 'Haltung S3–S4' },
    { id: uid(), blattNr: 'A-03', datum: '2026-09-18', positionId: posKanal3, formelNr: '40', werte: [1], freieFormel: '', faktor: 1, abzug: false, bemerkung: 'S4' },
    { id: uid(), blattNr: 'A-04', datum: '2026-09-25', positionId: posStr3, formelNr: '91', werte: [96.5, 2, 4.5, 0, 0, 0, 0, 0], freieFormel: 'a * b + c * 2', faktor: 1, abzug: false, bemerkung: 'Beidseitig + Einfahrten' },
  ];

  p.stationierungen = [
    { id: uid(), blattNr: 'S-01', datum: '2026-08-20', positionId: posErd2, bezeichnung: 'Haupttrasse Achse A – Koffer', modus: 'volumen', faktor: 1, abzug: false, bemerkung: 'Querprofile aus Nivellement',
      profile: [
        { id: uid(), station: 0, wert: 6.8, wert2: 0, bemerkung: 'Anschluss Bestand' },
        { id: uid(), station: 25, wert: 7.2, wert2: 0, bemerkung: '' },
        { id: uid(), station: 50, wert: 7.6, wert2: 0, bemerkung: '' },
        { id: uid(), station: 75, wert: 7.1, wert2: 0, bemerkung: '' },
        { id: uid(), station: 96.5, wert: 6.5, wert2: 0, bemerkung: 'Bauende' },
      ] },
    { id: uid(), blattNr: 'S-02', datum: '2026-09-22', positionId: posStr1, bezeichnung: 'Haupttrasse Achse A – Tragschicht', modus: 'flaeche', faktor: 1, abzug: false, bemerkung: '',
      profile: [
        { id: uid(), station: 0, wert: 6.5, wert2: 0, bemerkung: '' },
        { id: uid(), station: 48, wert: 6.5, wert2: 0, bemerkung: '' },
        { id: uid(), station: 60, wert: 8.0, wert2: 0, bemerkung: 'Aufweitung Wendehammer' },
        { id: uid(), station: 96.5, wert: 8.0, wert2: 0, bemerkung: '' },
      ] },
  ];

  p.rechnungen = [
    { id: uid(), lfdNr: 1, rechnungsNr: '2026-014-01', typ: 'abschlag', datum: '2026-08-31', stichtag: '2026-08-31', status: 'bezahlt', nachlassProzent: 2, sicherheitseinbehaltProzent: 5, skontoProzent: 2, skontoTage: 14, zahlungszielTage: 30, reverseCharge: false, sonstigeAbzuege: [], zahlungen: [{ id: uid(), datum: '2026-09-12', betrag: 38000, bemerkung: 'Überweisung Stadtkasse' }], snapshot: null, bemerkung: '' },
    { id: uid(), lfdNr: 2, rechnungsNr: '2026-014-02', typ: 'abschlag', datum: '2026-09-30', stichtag: '2026-09-30', status: 'entwurf', nachlassProzent: 2, sicherheitseinbehaltProzent: 5, skontoProzent: 2, skontoTage: 14, zahlungszielTage: 30, reverseCharge: false, sonstigeAbzuege: [], zahlungen: [], snapshot: null, bemerkung: '' },
  ];
  const bz = standardBauzeit('2026-08-03');
  bz.feiertage = bundesFeiertage(2026);
  bz.vorgaenge = vorgaengeAusLV(p.lv, 'titel', true);
  if (bz.vorgaenge[2]) bz.vorgaenge[2].verzug = -3; // Straßenbau beginnt, während der Kanal noch fertiggestellt wird
  p.bauzeit = bz;
  p.nachkalk = demoNachkalk(p.lv.map(t => t.id));
  return p;
}

/**
 * Beispiel-Importe für die Nachkalkulation: anonym, nur aggregiert (keine Mitarbeiterdaten),
 * ausdrücklich als Beispiel gekennzeichnet. Kostenstellen 4711 (Projekt) mit Unterkostenstellen je Titel.
 */
export function demoNachkalk(titelIds: string[]): Nachkalkulation {
  const impStd = 'import-demo-baulohn', impKo = 'import-demo-fibu';
  const std = (datum: string, kostenstelle: string, stunden: number, stundenart = 'Normalstunden', satz = 47.8): StundenZeile => ({
    id: uid(), importId: impStd, datum, kostenstelle, stundenart, stunden, lohnkosten: Math.round(stunden * satz * 100) / 100,
    mitarbeiterNr: '', mitarbeiterName: '', kostentraeger: '', hash: zeilenHash([datum, kostenstelle, stundenart, '', '', stunden, Math.round(stunden * satz * 100) / 100]),
  });
  const ko = (datum: string, kostenstelle: string, konto: string, kontoBezeichnung: string, betrag: number, kostenart: Kostenart, buchungstext: string, belegNr: string, gemeinkosten = false, zugeordnet = true): KostenZeile => ({
    id: uid(), importId: impKo, datum, kostenstelle, konto, kontoBezeichnung, betrag, kostenart, zugeordnet, gemeinkosten, kostenartText: '',
    belegNr, buchungstext, kostentraeger: '', hash: zeilenHash([datum, kostenstelle, konto, betrag, belegNr, buchungstext, '']),
  });
  const stunden: StundenZeile[] = [
    std('2026-08-07', '4711-90', 16, 'Normalstunden'),
    std('2026-08-07', '4711-01', 32), std('2026-08-14', '4711-01', 28), std('2026-08-21', '4711-01', 8),
    std('2026-08-14', '4711-01', 4, 'Überstunden', 60),
    std('2026-08-21', '4711-02', 40), std('2026-08-28', '4711-02', 72), std('2026-09-04', '4711-02', 60), std('2026-09-11', '4711-02', 48), std('2026-09-18', '4711-02', 42),
    std('2026-08-28', '4711-02', 6, 'Überstunden', 60), std('2026-09-11', '4711-02', 5, 'Überstunden', 60),
    std('2026-09-18', '4711-03', 24), std('2026-09-25', '4711-03', 64), std('2026-09-30', '4711-03', 40),
    std('2026-09-25', '4711-03', 4, 'Überstunden', 60),
  ];
  const kosten: KostenZeile[] = [
    ko('2026-08-05', '4711-90', '4210', 'Miete Container / Baustelleneinrichtung', 1200, 'sonstiges', 'Beispiel: Containermiete August', 'ER-2026-0811', true),
    ko('2026-09-05', '4711-90', '4210', 'Miete Container / Baustelleneinrichtung', 1200, 'sonstiges', 'Beispiel: Containermiete September', 'ER-2026-0902', true),
    ko('2026-09-30', '4711-90', '4240', 'Baustrom / Bauwasser', 420, 'sonstiges', 'Beispiel: Baustrom Abschlag', 'ER-2026-0988', true),
    ko('2026-08-20', '4711-02', '3000', 'Roh-, Hilfs- und Betriebsstoffe', 4300, 'stoffe', 'Beispiel: KG-Rohr DN 200, 180 m', 'ER-2026-0825'),
    ko('2026-08-25', '4711-02', '3000', 'Roh-, Hilfs- und Betriebsstoffe', 1350, 'stoffe', 'Beispiel: Bettungssand 0/2', 'ER-2026-0831'),
    ko('2026-08-27', '4711-02', '3000', 'Roh-, Hilfs- und Betriebsstoffe', 5520, 'stoffe', 'Beispiel: Schachtfertigteile 4 St', 'ER-2026-0834'),
    ko('2026-09-02', '4711-02', '3000', 'Roh-, Hilfs- und Betriebsstoffe', -240, 'stoffe', 'Beispiel: Gutschrift Rücknahme Formstücke', 'GS-2026-0012'),
    ko('2026-08-28', '4711-01', '3990', 'Entsorgung / Deponie', 2700, 'sonstiges', 'Beispiel: Deponiegebühren Z0', 'ER-2026-0840'),
    ko('2026-08-31', '4711', '4810', 'Mietgeräte', 3950, 'geraete', 'Beispiel: Bagger 14 t Miete August', 'ER-2026-0850'),
    ko('2026-09-30', '4711', '4810', 'Mietgeräte', 4100, 'geraete', 'Beispiel: Bagger 14 t Miete September', 'ER-2026-0990'),
    ko('2026-08-31', '4711', '4530', 'Laufende Kfz-Betriebskosten', 1250, 'geraete', 'Beispiel: LKW August', 'ER-2026-0851'),
    ko('2026-09-30', '4711', '4530', 'Laufende Kfz-Betriebskosten', 680, 'geraete', 'Beispiel: LKW September', 'ER-2026-0991'),
    ko('2026-09-10', '4711', '3100', 'Fremdleistungen', 850, 'fremd', 'Beispiel: NU Vermessung Achse A', 'ER-2026-0905'),
    ko('2026-09-15', '4711-03', '3000', 'Roh-, Hilfs- und Betriebsstoffe', 7900, 'stoffe', 'Beispiel: Schotter 0/32, 545 t', 'ER-2026-0940'),
    ko('2026-09-22', '4711-03', '3000', 'Roh-, Hilfs- und Betriebsstoffe', 1680, 'stoffe', 'Beispiel: Betonbordsteine 15/30', 'ER-2026-0955'),
    ko('2026-09-23', '4711-03', '3000', 'Roh-, Hilfs- und Betriebsstoffe', 1560, 'stoffe', 'Beispiel: Beton C12/15', 'ER-2026-0956'),
    ko('2026-09-18', '4711', '2300', 'Sonstige Aufwendungen', 180, 'sonstiges', 'Beispiel: Konto ohne Regel', 'ER-2026-0944', false, false),
  ];
  const protokoll = (id: string, quelle: 'baulohn' | 'fibu', datei: string, anzahl: number, ksts: string[], von: string, bis: string, unbekannt: string[]): ImportProtokoll => ({
    id, quelle, datei, importiertAm: '2026-10-01T08:00:00.000Z', profilName: 'Beispielprofil', zeilenGelesen: anzahl, uebernommen: anzahl, uebersprungen: 0, ersetzt: 0,
    fehler: [], personenbezogen: false, von, bis, kostenstellen: ksts, nichtZugeordneteKonten: unbekannt,
  });
  return {
    kostenstellen: [
      { id: uid(), nummer: '4711', bezeichnung: 'Erschließung Am Lindenhof (Hauptkostenstelle)', titelId: null, gemeinkosten: false },
      { id: uid(), nummer: '4711-01', bezeichnung: 'Erdarbeiten', titelId: titelIds[0] ?? null, gemeinkosten: false },
      { id: uid(), nummer: '4711-02', bezeichnung: 'Kanalbau', titelId: titelIds[1] ?? null, gemeinkosten: false },
      { id: uid(), nummer: '4711-03', bezeichnung: 'Straßenbau', titelId: titelIds[2] ?? null, gemeinkosten: false },
      { id: uid(), nummer: '4711-90', bezeichnung: 'Baustelleneinrichtung (Gemeinkosten)', titelId: null, gemeinkosten: true },
    ],
    stunden,
    kosten,
    importe: [
      protokoll(impStd, 'baulohn', 'BEISPIEL-baulohn-stunden-2026-08-09.csv (Beispieldaten, kein echter Export)', stunden.length, ['4711-01', '4711-02', '4711-03', '4711-90'], '2026-08-07', '2026-09-30', []),
      protokoll(impKo, 'fibu', 'BEISPIEL-fibu-buchungen-2026-08-09.csv (Beispieldaten, kein echter Export)', kosten.length, ['4711', '4711-01', '4711-02', '4711-03', '4711-90'], '2026-08-05', '2026-09-30', ['2300']),
    ],
    schwellen: { gelb: 5, rot: 15 },
  };
}
