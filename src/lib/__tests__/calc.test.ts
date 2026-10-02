import { describe, expect, it } from 'vitest';
import { evalFormel, formelErgebnis } from '../formulas';
import { stationierungSumme } from '../station';
import { kalkulation, kalkEP, lvSummen, mengenBisStichtag, rechnungBerechnen, lohnrechnung } from '../calc';
import { demoProjekt } from '../demo';
import { parseDe, stationFmt, stationParse } from '../format';
import type { Stationierung } from '../../types';

describe('Formeln', () => {
  it('Rechteck / Trapezgraben / Rohr', () => {
    expect(formelErgebnis('01', [4, 2.5], '').wert).toBeCloseTo(10);
    expect(formelErgebnis('06', [0.9, 1.3, 1.85, 62.5], '').wert).toBeCloseTo(((0.9 + 1.3) / 2) * 1.85 * 62.5, 6);
    expect(formelErgebnis('10', [0.5, 0.4, 10], '').wert).toBeCloseTo((Math.PI / 4) * (0.25 - 0.16) * 10, 6);
  });
  it('Freie Formel mit Variablen und Komma', () => {
    expect(evalFormel('a * b - c * d / 2', { a: 10, b: 2, c: 4, d: 1 })).toBeCloseTo(18);
    expect(evalFormel('(a + b) / 2 * h', { a: 1, b: 3, h: 2 })).toBeCloseTo(4);
    expect(evalFormel('pi * d^2 / 4', { d: 2 })).toBeCloseTo(Math.PI);
    expect(evalFormel('1,5 * 2', {})).toBeCloseTo(3);
    expect(formelErgebnis('91', [1], 'a +').fehler).toBeDefined();
  });
});

describe('Stationierung', () => {
  it('Mittelwertverfahren', () => {
    const s: Stationierung = { id: 's', blattNr: '', datum: '', positionId: 'p', bezeichnung: '', modus: 'volumen', faktor: 1, abzug: false, bemerkung: '',
      profile: [{ id: '1', station: 0, wert: 6, wert2: 0, bemerkung: '' }, { id: '2', station: 50, wert: 8, wert2: 0, bemerkung: '' }, { id: '3', station: 100, wert: 6, wert2: 0, bemerkung: '' }] };
    expect(stationierungSumme(s)).toBeCloseTo(7 * 50 + 7 * 50);
    expect(stationierungSumme({ ...s, modus: 'laenge' })).toBeCloseTo(100);
    expect(stationierungSumme({ ...s, modus: 'volumenBT', profile: s.profile.map(p => ({ ...p, wert2: 2 })) })).toBeCloseTo(1400);
    expect(stationierungSumme({ ...s, abzug: true, faktor: 2 })).toBeCloseTo(-1400);
  });
  it('Stationsformat', () => {
    expect(stationFmt(125.5)).toBe('0+125,50');
    expect(stationFmt(1250)).toBe('1+250,00');
    expect(stationParse('1+250,00')).toBe(1250);
    expect(stationParse('125,5')).toBe(125.5);
    expect(parseDe('1.234,56')).toBe(1234.56);
  });
});

describe('Kalkulation', () => {
  const p = demoProjekt();
  it('Mittellohn', () => {
    const l = lohnrechnung(p.kalk);
    expect(l.mittellohnA).toBeCloseTo(22.5 * 1.08);
    expect(l.kalkulationslohn).toBeCloseTo(22.5 * 1.08 * 1.98);
  });
  it('Endsummenkalkulation: Angebotssumme = HK × 100 / (100 − AGK − WuG)', () => {
    const e = kalkulation(p);
    expect(e.angebotssumme).toBeCloseTo((e.herstellkosten * 100) / (100 - 9 - 4), 4);
    expect(e.umlage).toBeCloseTo(e.angebotssumme - e.ektGesamt, 4);
    // Umlagebeträge summieren sich zur Umlage
    const u = Object.values(e.umlageBetraege).reduce((a, b) => a + b, 0);
    expect(u).toBeCloseTo(e.umlage, 4);
    // EP × Menge über alle zählenden Positionen ≈ Angebotssumme (Rundung der EP)
    const s = lvSummen(p, e);
    expect(Math.abs(s.netto - e.angebotssumme) / e.angebotssumme).toBeLessThan(0.0005); // nur EP-Rundung
  });
  it('Zielsumme vorgeben', () => {
    const q = { ...p, kalk: { ...p.kalk, zielSumme: 250000 } };
    const e = kalkulation(q);
    expect(e.angebotssumme).toBe(250000);
    expect(Math.abs(lvSummen(q, e).netto - 250000) / 250000).toBeLessThan(0.0005);
  });
  it('Zuschlagskalkulation', () => {
    const q = { ...p, kalk: { ...p.kalk, methode: 'zuschlag' as const } };
    const e = kalkulation(q);
    expect(e.zuschlagsaetze.lohn).toBeCloseTo(18 + 12 + 5);
    const pos = q.lv[1].positionen[1]; // Kanalrohr
    const r = kalkEP(pos, e);
    expect(r.ep).toBeCloseTo(Math.round((r.ekt.lohn * 1.35 + r.ekt.stoffe * 1.17) * 100) / 100, 2);
  });
});

describe('Kumulative Abrechnung', () => {
  const p = demoProjekt();
  const erg = kalkulation(p);
  it('Mengen bis Stichtag', () => {
    const m1 = mengenBisStichtag(p, '2026-08-31');
    const m2 = mengenBisStichtag(p, null);
    const kanal = p.lv[1].positionen[0].id;
    expect(m2.get(kanal)!).toBeGreaterThan(m1.get(kanal)!);
  });
  it('AR 2 zieht AR 1 ab', () => {
    const [r1, r2] = p.rechnungen;
    const e1 = rechnungBerechnen(p, r1, erg);
    const e2 = rechnungBerechnen(p, r2, erg);
    expect(e1.bisherGestellt).toBe(0);
    expect(e2.bisherGestellt).toBeCloseTo(e1.rechnungsbetrag, 2);
    expect(e2.rechnungsbetrag).toBeCloseTo(e2.bruttoKum - e1.rechnungsbetrag, 2);
    expect(e2.leistungKum).toBeGreaterThan(e1.leistungKum);
    expect(e1.nachlass).toBeCloseTo(e1.leistungKum * 0.02, 2);
    expect(e1.sicherheitseinbehalt).toBeCloseTo((e1.leistungKum - e1.nachlass) * 0.05, 2);
    expect(e1.mwst).toBeCloseTo(e1.nettoZahlbar * 0.19, 2);
  });
  it('Snapshot friert Mengen ein', () => {
    const r2 = { ...p.rechnungen[1], snapshot: [{ positionId: p.lv[0].positionen[0].id, mengeKum: 100 }] };
    const e = rechnungBerechnen(p, r2, erg);
    expect(e.zeilen.length).toBeGreaterThan(1); // Vorrechnung-Mengen tauchen mit kum 0 auf
    expect(e.zeilen.find(z => z.position.id === p.lv[0].positionen[0].id)!.mengeKum).toBe(100);
  });
});
