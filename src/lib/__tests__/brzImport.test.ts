import { describe, expect, it } from 'vitest';
import { parseCsv } from '../csv';
import {
  fehlendePflichtfelder, importAusfuehren, importLoeschen, importUebernehmen, kontoZuordnen, kostenNeuZuordnen, neuesProfil, standardKontenRegeln,
  vorschlagZuordnung, zeilenHash,
} from '../brzImport';
import { standardNachkalk } from '../nachkalkulation';
import type { ImportProfil } from '../../types';

const BAULOHN = [
  'Personalnummer;Name;Datum;Kostenstelle;Lohnart;Stunden;Betrag',
  '1001;Muster A;03.08.2026;4711-01;Normal;8,00;382,40',
  '1002;Muster B;03.08.2026;4711-01;Normal;8,00;382,40',
  '1001;Muster A;03.08.2026;4711-01;Überstunden;1,50;90,00',
  '1001;Muster A;04.08.2026;4711-02;Normal;8,00;382,40',
  '1003;Muster C;04.08.2026;4711-02;Urlaub;8,00;382,40',
  '1003;Muster C;xx.08.2026;4711-02;Normal;8,00;382,40',
].join('\n');

const FIBU = [
  'Buchungsdatum;Kostenstelle;Konto;Kontobezeichnung;Betrag;S/H;Beleg;Buchungstext',
  '20.08.2026;4711;3000;RHB-Stoffe;4.300,00;S;ER-1;KG-Rohr',
  '02.09.2026;4711;3000;RHB-Stoffe;240,00;H;GS-1;Gutschrift',
  '31.08.2026;4711;4810;Mietgeräte;3.950,00;S;ER-2;Bagger',
  '05.08.2026;4711;4210;Raumkosten;1.200,00;S;ER-3;Container',
  '18.09.2026;4711;2300;Sonstige;180,00;S;ER-4;unbekanntes Konto',
].join('\n');

const profil = (quelle: 'baulohn' | 'fibu', zuordnung: Record<string, string>, patch: Partial<ImportProfil> = {}): ImportProfil => ({ ...neuesProfil(quelle), zuordnung, ...patch });

describe('Spaltenzuordnung', () => {
  it('schlägt Zielfelder anhand der Überschriften vor', () => {
    const t = parseCsv(BAULOHN);
    const z = vorschlagZuordnung(t.kopf, 'baulohn');
    expect(z.datum).toBe('Datum');
    expect(z.kostenstelle).toBe('Kostenstelle');
    expect(z.stunden).toBe('Stunden');
    expect(z.stundenart).toBe('Lohnart');
    expect(z.lohnkosten).toBe('Betrag');
    expect(z.mitarbeiterNr).toBe('Personalnummer');
    expect(z.mitarbeiterName).toBe('Name');
    const f = parseCsv(FIBU);
    const zf = vorschlagZuordnung(f.kopf, 'fibu');
    expect(zf.datum).toBe('Buchungsdatum');
    expect(zf.konto).toBe('Konto');
    expect(zf.kontoBezeichnung).toBe('Kontobezeichnung');
    expect(zf.betrag).toBe('Betrag');
    expect(zf.sollHaben).toBe('S/H');
    expect(zf.belegNr).toBe('Beleg');
    expect(zf.buchungstext).toBe('Buchungstext');
  });
  it('meldet fehlende Pflichtfelder', () => {
    expect(fehlendePflichtfelder({ datum: 'Datum' }, 'baulohn', ['Datum'])).toEqual(['Kostenstelle / Baustelle', 'Stunden']);
    expect(fehlendePflichtfelder({ datum: 'Datum', kostenstelle: 'K', stunden: 'S' }, 'baulohn', ['Datum', 'K', 'S'])).toEqual([]);
    // Spalte existiert nicht in der Datei
    expect(fehlendePflichtfelder({ datum: 'Datum', kostenstelle: 'K', stunden: 'S' }, 'baulohn', ['Datum'])).toEqual(['Kostenstelle / Baustelle', 'Stunden']);
  });
});

describe('Kontenzuordnung', () => {
  const regeln = standardKontenRegeln('skr03');
  it('Kontonummernbereiche und Textabgleich', () => {
    expect(kontoZuordnen('3000', '', regeln)?.kostenart).toBe('stoffe');
    expect(kontoZuordnen('3150', '', regeln)?.kostenart).toBe('fremd');
    expect(kontoZuordnen('4120', '', regeln)?.kostenart).toBe('lohn');
    expect(kontoZuordnen('4810', '', regeln)?.kostenart).toBe('geraete');
    expect(kontoZuordnen('4210', '', regeln)?.gemeinkosten).toBe(true);
    expect(kontoZuordnen('2300', '', regeln)).toBeNull();
    expect(kontoZuordnen('2300', 'Gerätemiete', regeln)?.kostenart).toBe('geraete');
    expect(kontoZuordnen('', 'Nachunternehmer Asphalt', regeln)?.kostenart).toBe('fremd');
  });
  it('SKR04 vorhanden, Regel mit nur einem Konto', () => {
    expect(kontoZuordnen('5900', '', standardKontenRegeln('skr04'))?.kostenart).toBe('fremd');
    const einzel = [{ id: 'x', vonKonto: '4711', bisKonto: '', kostenartText: '', kostenart: 'geraete' as const, gemeinkosten: false, bezeichnung: '' }];
    expect(kontoZuordnen('4711', '', einzel)?.kostenart).toBe('geraete');
    expect(kontoZuordnen('4712', '', einzel)).toBeNull();
  });
});

describe('Baulohn-Import', () => {
  const t = parseCsv(BAULOHN);
  const z = vorschlagZuordnung(t.kopf, 'baulohn');
  it('aggregiert ohne Mitarbeiterdaten, schließt Stundenarten aus, protokolliert Fehler', () => {
    const e = importAusfuehren(t, standardNachkalk(), { quelle: 'baulohn', datei: 'b.csv', profil: profil('baulohn', z, { ausgeschlosseneStundenarten: 'Urlaub, Krank' }), personenbezogen: false, modus: 'ergaenzen', regeln: [] });
    expect(e.protokoll.zeilenGelesen).toBe(6);
    expect(e.protokoll.fehler).toEqual([{ zeile: 7, text: 'Datum nicht lesbar: „xx.08.2026“' }]);
    expect(e.protokoll.uebersprungen).toBe(1); // Urlaub
    // 2 × Normal 03.08. werden zu einer Zeile zusammengefasst
    expect(e.stunden).toHaveLength(3);
    const n = e.stunden.find(s => s.datum === '2026-08-03' && s.stundenart === 'Normal')!;
    expect(n.stunden).toBe(16);
    expect(n.lohnkosten).toBeCloseTo(764.8);
    expect(n.mitarbeiterNr).toBe('');
    expect(n.mitarbeiterName).toBe('');
    expect(e.protokoll.personenbezogen).toBe(false);
    expect(e.protokoll.von).toBe('2026-08-03');
    expect(e.protokoll.bis).toBe('2026-08-04');
    expect(e.protokoll.kostenstellen).toEqual(['4711-01', '4711-02']);
  });
  it('personenbezogen: eine Zeile je Mitarbeiter', () => {
    const e = importAusfuehren(t, standardNachkalk(), { quelle: 'baulohn', datei: 'b.csv', profil: profil('baulohn', z), personenbezogen: true, modus: 'ergaenzen', regeln: [] });
    expect(e.stunden).toHaveLength(5);
    expect(e.stunden[0].mitarbeiterNr).toBe('1001');
    expect(e.protokoll.personenbezogen).toBe(true);
  });
  it('ohne Lohnkosten-Spalte bleibt lohnkosten null', () => {
    const { lohnkosten: _l, ...ohne } = z;
    const e = importAusfuehren(t, standardNachkalk(), { quelle: 'baulohn', datei: 'b.csv', profil: profil('baulohn', ohne), personenbezogen: false, modus: 'ergaenzen', regeln: [] });
    expect(e.stunden.every(s => s.lohnkosten === null)).toBe(true);
  });
  it('fehlende Pflichtzuordnung bricht ab', () => {
    const e = importAusfuehren(t, standardNachkalk(), { quelle: 'baulohn', datei: 'b.csv', profil: profil('baulohn', { datum: 'Datum' }), personenbezogen: false, modus: 'ergaenzen', regeln: [] });
    expect(e.stunden).toHaveLength(0);
    expect(e.protokoll.fehler[0].text).toContain('Pflichtfelder');
  });
});

describe('FiBu-Import', () => {
  const t = parseCsv(FIBU);
  const z = vorschlagZuordnung(t.kopf, 'fibu');
  const regeln = standardKontenRegeln('skr03');
  it('Soll/Haben-Vorzeichen, Kontenzuordnung, nicht zugeordnete Konten', () => {
    const e = importAusfuehren(t, standardNachkalk(), { quelle: 'fibu', datei: 'f.csv', profil: profil('fibu', z), personenbezogen: false, modus: 'ergaenzen', regeln });
    expect(e.kosten).toHaveLength(5);
    const gs = e.kosten.find(k => k.belegNr === 'GS-1')!;
    expect(gs.betrag).toBe(-240);
    expect(e.kosten.find(k => k.belegNr === 'ER-1')!.betrag).toBe(4300);
    expect(e.kosten.find(k => k.konto === '4810')!.kostenart).toBe('geraete');
    expect(e.kosten.find(k => k.konto === '4210')!.gemeinkosten).toBe(true);
    const unb = e.kosten.find(k => k.konto === '2300')!;
    expect(unb.zugeordnet).toBe(false);
    expect(unb.kostenart).toBe('sonstiges');
    expect(e.protokoll.nichtZugeordneteKonten).toEqual(['2300']);
  });
  it('ohne Soll/Haben-Spalte gilt das Vorzeichen des Exports', () => {
    const csv = 'Datum;Kostenstelle;Konto;Betrag\n01.08.2026;1;3000;-50,00\n01.08.2026;1;3000;50,00';
    const tt = parseCsv(csv);
    const e = importAusfuehren(tt, standardNachkalk(), { quelle: 'fibu', datei: 'f.csv', profil: profil('fibu', vorschlagZuordnung(tt.kopf, 'fibu')), personenbezogen: false, modus: 'ergaenzen', regeln });
    expect(e.kosten.map(k => k.betrag)).toEqual([-50, 50]);
  });
  it('Neu-Zuordnung nach Regeländerung', () => {
    const e = importAusfuehren(t, standardNachkalk(), { quelle: 'fibu', datei: 'f.csv', profil: profil('fibu', z), personenbezogen: false, modus: 'ergaenzen', regeln });
    const nk = importUebernehmen(standardNachkalk(), e);
    const neu = kostenNeuZuordnen(nk, [...regeln, { id: 'n', vonKonto: '2300', bisKonto: '2300', kostenartText: '', kostenart: 'fremd', gemeinkosten: false, bezeichnung: '' }]);
    expect(neu.kosten.find(k => k.konto === '2300')!.kostenart).toBe('fremd');
    expect(neu.kosten.find(k => k.konto === '2300')!.zugeordnet).toBe(true);
  });
});

describe('Duplikatschutz und Löschen', () => {
  const t = parseCsv(FIBU);
  const z = vorschlagZuordnung(t.kopf, 'fibu');
  const regeln = standardKontenRegeln('skr03');
  const opt = { quelle: 'fibu' as const, datei: 'f.csv', profil: profil('fibu', z), personenbezogen: false, regeln };
  it('Hash ist deterministisch und unterscheidet Inhalte', () => {
    expect(zeilenHash(['a', 1])).toBe(zeilenHash(['A ', 1]));
    expect(zeilenHash(['a', 1])).not.toBe(zeilenHash(['a', 2]));
  });
  it('zweiter Import derselben Datei übernimmt nichts', () => {
    const e1 = importAusfuehren(t, standardNachkalk(), { ...opt, modus: 'ergaenzen' });
    const nk1 = importUebernehmen(standardNachkalk(), e1);
    const e2 = importAusfuehren(t, nk1, { ...opt, modus: 'ergaenzen' });
    expect(e2.protokoll.uebernommen).toBe(0);
    expect(e2.protokoll.uebersprungen).toBe(5);
    const nk2 = importUebernehmen(nk1, e2);
    expect(nk2.kosten).toHaveLength(5);
    expect(nk2.importe).toHaveLength(2);
  });
  it('Modus "ersetzen" löscht den Zeitraum der Kostenstellen und übernimmt neu', () => {
    const e1 = importAusfuehren(t, standardNachkalk(), { ...opt, modus: 'ergaenzen' });
    const nk1 = importUebernehmen(standardNachkalk(), e1);
    const korrigiert = parseCsv(FIBU.replace('4.300,00', '4.350,00'));
    const e2 = importAusfuehren(korrigiert, nk1, { ...opt, modus: 'ersetzen' });
    expect(e2.protokoll.ersetzt).toBe(5);
    expect(e2.protokoll.uebernommen).toBe(5);
    const nk2 = importUebernehmen(nk1, e2);
    expect(nk2.kosten).toHaveLength(5);
    expect(nk2.kosten.find(k => k.belegNr === 'ER-1')!.betrag).toBe(4350);
  });
  it('Import löschen entfernt seine Zeilen und das Protokoll', () => {
    const e1 = importAusfuehren(t, standardNachkalk(), { ...opt, modus: 'ergaenzen' });
    const nk1 = importUebernehmen(standardNachkalk(), e1);
    const nk2 = importLoeschen(nk1, e1.protokoll.id);
    expect(nk2.kosten).toHaveLength(0);
    expect(nk2.importe).toHaveLength(0);
  });
});
