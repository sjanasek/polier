import { describe, expect, it } from 'vitest';
import { demoProjekt } from '../demo';
import { neuesProjekt } from '../defaults';
import { kalkulation, mengenBisStichtag } from '../calc';
import {
  abweichungProzent, ampel, erfahrungswerte, erfahrungswerteAnwenden, nachkalkulation, nachkalkulationCsv, planStundenBis, standardNachkalk,
} from '../nachkalkulation';
import { KOSTENART_LISTE } from '../../types';

describe('Nachkalkulation – Soll auf Leistungsstand', () => {
  const p = demoProjekt();
  const e = nachkalkulation(p, { stichtag: '2026-09-30', hochrechnung: 'trend' });
  it('Soll-Stunden entsprechen Σ Lohnansatz × aufgemessener Menge bis Stichtag', () => {
    const mengen = mengenBisStichtag(p, '2026-09-30');
    let std = 0;
    for (const t of p.lv) for (const pos of t.positionen) {
      const m = mengen.get(pos.id) ?? 0;
      std += pos.ansaetze.filter(a => a.kostenart === 'lohn').reduce((s, a) => s + a.menge, 0) * m;
    }
    expect(e.sollStunden).toBeCloseTo(std, 6);
    expect(e.sollStunden).toBeGreaterThan(0);
    // Soll gesamt (LV-Mengen) ist größer als Soll zum Leistungsstand
    expect(e.sollStundenGesamt).toBeGreaterThan(e.sollStunden);
    expect(e.sollEktGesamt).toBeCloseTo(kalkulation(p).ektGesamt, 6);
  });
  it('früherer Stichtag → kleineres Soll und kleinere Ist-Werte', () => {
    const f = nachkalkulation(p, { stichtag: '2026-08-31', hochrechnung: 'trend' });
    expect(f.sollStunden).toBeLessThan(e.sollStunden);
    expect(f.istStunden).toBeLessThan(e.istStunden);
    expect(f.istGesamt).toBeLessThan(e.istGesamt);
    expect(f.leistung).toBeLessThan(e.leistung);
  });
  it('Leistung, Leistungsgrad und Erlös', () => {
    expect(e.leistungsgrad).not.toBeNull();
    expect(e.leistungsgrad!).toBeGreaterThan(0);
    expect(e.leistungsgrad!).toBeLessThan(1);
    expect(e.erloes).toBeCloseTo(e.leistung * 0.98, 2);
  });
  it('Ist aus den Demo-Importen: Stundenarten, Lohnquelle Export, BGK, nicht zugeordnete Konten', () => {
    expect(e.hatStunden).toBe(true);
    expect(e.hatKosten).toBe(true);
    expect(e.istStunden).toBeCloseTo(16 + 32 + 28 + 8 + 4 + 40 + 72 + 60 + 48 + 42 + 6 + 5 + 24 + 64 + 40 + 4, 6);
    expect(e.stundenNachArt.map(a => a.stundenart)).toEqual(['Normalstunden', 'Überstunden']);
    expect(e.lohnQuelle).toBe('export');
    expect(e.mittellohnIst).toBeGreaterThan(47);
    expect(e.istBgk).toBeCloseTo(1200 + 1200 + 420, 2);
    expect(e.istKosten.stoffe).toBeCloseTo(4300 + 1350 + 5520 - 240 + 7900 + 1680 + 1560, 2);
    expect(e.istKosten.geraete).toBeCloseTo(3950 + 4100 + 1250 + 680, 2);
    expect(e.istKosten.fremd).toBe(850);
    expect(e.nichtZugeordneteKonten.map(k => k.konto)).toEqual(['2300']);
    expect(e.istGesamt).toBeCloseTo(e.istEkt + e.istBgk, 6);
  });
  it('Abweichungen und Ampel', () => {
    expect(e.vergleich).toHaveLength(KOSTENART_LISTE.length);
    for (const v of e.vergleich) expect(v.abweichung).toBeCloseTo(v.ist - v.soll, 6);
    expect(e.vergleichGesamt.soll).toBeCloseTo(e.sollEkt + e.sollBgk, 6);
    // Fremdleistung: Soll 0, Ist > 0 → nicht bewertbar (grau), kein Division-durch-0-Fehler
    const fremd = e.vergleich.find(v => v.bezeichnung.startsWith('Fremd'))!;
    expect(fremd.prozent).toBeNull();
    expect(fremd.ampel).toBe('grau');
    expect(ampel(3, { gelb: 5, rot: 15 })).toBe('gruen');
    expect(ampel(7, { gelb: 5, rot: 15 })).toBe('gelb');
    expect(ampel(20, { gelb: 5, rot: 15 })).toBe('rot');
    expect(ampel(null, { gelb: 5, rot: 15 })).toBe('grau');
    expect(abweichungProzent(100, 110)).toBeCloseTo(10);
    expect(abweichungProzent(0, 10)).toBeNull();
  });
  it('Hochrechnung Trend und Rest-zu-Plan', () => {
    expect(e.hochrechnung.prognoseKosten).toBeCloseTo(e.istGesamt / e.leistungsgrad!, 6);
    expect(e.hochrechnung.prognoseErgebnis).toBeCloseTo(e.auftragssummeNachNachlass - e.hochrechnung.prognoseKosten!, 6);
    const r = nachkalkulation(p, { stichtag: '2026-09-30', hochrechnung: 'restPlan' });
    expect(r.hochrechnung.prognoseKosten).toBeCloseTo(r.istGesamt + r.hochrechnung.restKostenPlan, 6);
    expect(r.hochrechnung.restKostenPlan).toBeCloseTo(r.sollEktGesamt - r.sollEkt + (r.erg.bgk - r.sollBgk), 4);
    expect(e.hochrechnung.planErgebnis).toBeCloseTo(e.auftragssummeNachNachlass - e.erg.herstellkosten, 6);
  });
  it('Bauzeitenplan: geplante Stunden bis Stichtag', () => {
    const ps = planStundenBis(p, '2026-09-30');
    expect(ps.verfuegbar).toBe(true);
    expect(ps.bis).toBeGreaterThan(0);
    expect(ps.bis).toBeLessThanOrEqual(ps.gesamt + 1e-6);
    expect(planStundenBis(p, null).bis).toBeCloseTo(ps.gesamt, 6);
    expect(planStundenBis(p, '2000-01-01').bis).toBe(0);
    expect(e.bauzeit.planStundenBisStichtag).toBeCloseTo(ps.bis, 6);
  });
  it('Titelvergleich über zugeordnete Kostenstellen', () => {
    expect(e.titel).toHaveLength(3);
    const kanal = e.titel.find(t => t.titel.oz === '02')!;
    expect(kanal.kostenstellen).toEqual(['4711-02']);
    expect(kanal.istStunden).toBeCloseTo(40 + 72 + 60 + 48 + 42 + 6 + 5, 6);
    expect(kanal.aufwandFaktor).toBeCloseTo(kanal.istStunden / kanal.sollStunden, 6);
    expect(kanal.istKosten.stoffe).toBeCloseTo(4300 + 1350 + 5520 - 240, 2);
  });
  it('Zeitverlauf ist kumuliert und monoton', () => {
    expect(e.verlauf.length).toBeGreaterThanOrEqual(2);
    expect(e.verlauf[e.verlauf.length - 1].datum).toBe('2026-09-30');
    for (let i = 1; i < e.verlauf.length; i++) {
      expect(e.verlauf[i].istStunden).toBeGreaterThanOrEqual(e.verlauf[i - 1].istStunden);
      expect(e.verlauf[i].sollStunden).toBeGreaterThanOrEqual(e.verlauf[i - 1].sollStunden);
    }
    expect(e.verlauf[e.verlauf.length - 1].istStunden).toBeCloseTo(e.istStunden, 6);
    expect(e.verlauf[e.verlauf.length - 1].sollStunden).toBeCloseTo(e.sollStunden, 6);
  });
  it('CSV-Export enthält Kostenarten und Kennzahlen', () => {
    const csv = nachkalkulationCsv(p, e);
    expect(csv).toContain('Bereich;Bezeichnung;Soll;Ist;Abweichung;Abweichung %');
    expect(csv).toContain('Kostenart;Lohn;');
    expect(csv).toContain('Hochrechnung;');
    expect(csv.split('\r\n').length).toBeGreaterThan(15);
  });
  it('Kostenstellenfilter: fremde Zeilen zählen nicht', () => {
    const q = demoProjekt();
    q.nachkalk = { ...q.nachkalk!, kostenstellen: [{ id: 'k', nummer: '4711-02', bezeichnung: '', titelId: null, gemeinkosten: false }] };
    const f = nachkalkulation(q, { stichtag: null, hochrechnung: 'trend' });
    expect(f.istStunden).toBeCloseTo(40 + 72 + 60 + 48 + 42 + 6 + 5, 6);
    expect(f.fremdeZeilen).toBeGreaterThan(0);
    // Ohne Kostenstellen zählen alle Zeilen
    q.nachkalk = { ...q.nachkalk, kostenstellen: [] };
    expect(nachkalkulation(q, { stichtag: null, hochrechnung: 'trend' }).fremdeZeilen).toBe(0);
  });
});

describe('Nachkalkulation – Randfälle', () => {
  it('leeres Projekt ohne Daten: keine Division durch 0', () => {
    const p = neuesProjekt('1');
    const e = nachkalkulation(p, { stichtag: null, hochrechnung: 'trend' });
    expect(e.hatStunden).toBe(false);
    expect(e.hatKosten).toBe(false);
    expect(e.hatLeistungsstand).toBe(false);
    expect(e.leistungsgrad).toBeNull();
    expect(e.hochrechnung.prognoseKosten).toBeNull();
    expect(e.mittellohnIst).toBeNull();
    expect(e.bgkSatzIst).toBeNull();
    expect(e.zuschlagIst).toBeNull();
    expect(e.vergleichGesamt.ampel).toBe('grau');
    expect(e.verlauf).toEqual([]);
    expect(e.bauzeit.verfuegbar).toBe(false);
    expect(erfahrungswerte(p, e)).toEqual([]);
    expect(Number.isFinite(e.ergebnisIst)).toBe(true);
  });
  it('kein Leistungsstand, aber Ist-Kosten: Soll 0, Hochrechnung Trend nicht möglich', () => {
    const p = demoProjekt();
    p.aufmass = []; p.stationierungen = [];
    const e = nachkalkulation(p, { stichtag: '2026-09-30', hochrechnung: 'trend' });
    expect(e.hatLeistungsstand).toBe(false);
    expect(e.sollStunden).toBe(0);
    expect(e.istStunden).toBeGreaterThan(0);
    expect(e.vergleichStunden.prozent).toBeNull();
    expect(e.hochrechnung.prognoseKosten).toBeNull();
    const r = nachkalkulation(p, { stichtag: '2026-09-30', hochrechnung: 'restPlan' });
    expect(r.hochrechnung.prognoseKosten).toBeCloseTo(r.istGesamt + r.sollEktGesamt + r.erg.bgk, 4);
  });
  it('Lohnkosten ohne Export-Betrag werden mit dem Kalkulationslohn geschätzt; FiBu-Lohn hat Vorrang', () => {
    const p = demoProjekt();
    p.nachkalk = { ...p.nachkalk!, stunden: p.nachkalk!.stunden.map(s => ({ ...s, lohnkosten: null })) };
    const e = nachkalkulation(p, { stichtag: null, hochrechnung: 'trend' });
    expect(e.lohnQuelle).toBe('geschaetzt');
    expect(e.istLohnkosten).toBeCloseTo(e.istStunden * e.erg.kalkLohn, 4);
    expect(e.mittellohnIst).toBeNull();
    p.nachkalk = { ...p.nachkalk, kosten: [...p.nachkalk.kosten, { ...p.nachkalk.kosten[0], id: 'l', konto: '4120', kostenart: 'lohn', gemeinkosten: false, betrag: 12345, kostenstelle: '4711', hash: 'x' }] };
    const f = nachkalkulation(p, { stichtag: null, hochrechnung: 'trend' });
    expect(f.lohnQuelle).toBe('fibu');
    expect(f.istLohnkosten).toBe(12345);
  });
  it('standardNachkalk liefert leere Listen mit Schwellen', () => {
    expect(standardNachkalk().schwellen).toEqual({ gelb: 5, rot: 15 });
  });
});

describe('Erfahrungswerte', () => {
  it('schlägt skalierte Lohnansätze je Titel vor und übernimmt nur Ausgewähltes', () => {
    const p = demoProjekt();
    const e = nachkalkulation(p, { stichtag: '2026-09-30', hochrechnung: 'trend' });
    const v = erfahrungswerte(p, e);
    expect(v.length).toBe(3);
    const kanal = v.find(x => x.bezeichnung.startsWith('02'))!;
    expect(kanal.faktor).toBeCloseTo(kanal.istStunden / kanal.sollStunden, 6);
    const a = kanal.positionen[0].ansaetze[0];
    expect(a.neu).toBeCloseTo(a.alt * kanal.faktor, 3);
    const neu = erfahrungswerteAnwenden(p, [kanal]);
    const posNeu = neu.lv[1].positionen[0].ansaetze.find(x => x.id === a.ansatzId)!;
    expect(posNeu.menge).toBe(a.neu);
    // Titel 01 unverändert, Original unverändert
    expect(neu.lv[0]).toEqual(p.lv[0]);
    expect(p.lv[1].positionen[0].ansaetze.find(x => x.id === a.ansatzId)!.menge).toBe(a.alt);
  });
  it('ohne Titelzuordnung projektweit', () => {
    const p = demoProjekt();
    p.nachkalk = { ...p.nachkalk!, kostenstellen: p.nachkalk!.kostenstellen.map(k => ({ ...k, titelId: null })) };
    const e = nachkalkulation(p, { stichtag: '2026-09-30', hochrechnung: 'trend' });
    const v = erfahrungswerte(p, e);
    expect(v).toHaveLength(1);
    expect(v[0].titelId).toBeNull();
    expect(v[0].faktor).toBeCloseTo(e.istStunden / e.sollStunden, 6);
  });
});
