import { describe, expect, it } from 'vitest';
import { bundesFeiertage, isoWoche, neuerVorgang, nichtVerplant, ostersonntag, planen, positionAufwand, standardBauzeit, vorgaengeAusLV } from '../bauzeit';
import { neuePosition, neuerTitel } from '../defaults';
import { demoProjekt } from '../demo';
import type { Position, Titel, Vorgang } from '../../types';

function pos(oz: string, menge: number, lohnJeEinheit: number, geraeteJeEinheit = 0): Position {
  const p = neuePosition(oz);
  p.menge = menge;
  p.ansaetze = [{ id: oz + 'l', kostenart: 'lohn', bezeichnung: 'Lohn', menge: lohnJeEinheit, preis: 0, einheit: 'h' }];
  if (geraeteJeEinheit) p.ansaetze.push({ id: oz + 'g', kostenart: 'geraete', bezeichnung: 'Bagger', menge: geraeteJeEinheit, preis: 50, einheit: 'h' });
  p.ansaetze.push({ id: oz + 's', kostenart: 'stoffe', bezeichnung: 'Schotter', menge: 2, preis: 10, einheit: 't' });
  return p;
}
function titelMit(...ps: Position[]): Titel { const t = neuerTitel('01'); t.positionen = ps; return t; }
function vg(name: string, ids: string[], extra: Partial<Vorgang> = {}): Vorgang { return { ...neuerVorgang(name), positionIds: ids, ...extra }; }

describe('Kalender', () => {
  it('Ostern und Feiertage 2026', () => {
    expect(ostersonntag(2026)).toBe('2026-04-05');
    const f = bundesFeiertage(2026);
    for (const d of ['2026-04-03', '2026-04-06', '2026-05-01', '2026-05-14', '2026-05-25', '2026-10-03', '2026-12-25']) expect(f).toContain(d);
  });
  it('ISO-Kalenderwoche', () => {
    expect(isoWoche('2026-01-01')).toBe(1);
    expect(isoWoche('2026-10-05')).toBe(41);
    expect(isoWoche('2021-01-03')).toBe(53);
  });
});

describe('Zeitaufwand aus Kalkulation', () => {
  it('Lohn und Gerätestunden × Menge, Material zählt nicht', () => {
    const a = positionAufwand(pos('01.0010', 100, 0.5, 0.2));
    expect(a.lohn).toBeCloseTo(50);
    expect(a.geraete).toBeCloseTo(20);
  });
  it('Geräteansatz in Tagen zählt nicht als Stunden', () => {
    const p = pos('x', 10, 1);
    p.ansaetze.push({ id: 'v', kostenart: 'geraete', bezeichnung: 'Verbau', menge: 1, preis: 12, einheit: 'Tag' });
    expect(positionAufwand(p).geraete).toBe(0);
  });
});

describe('Terminrechnung', () => {
  // 32 h/Tag Kapazität (4 Kräfte × 8 h)
  const a = pos('A', 64, 1), b = pos('B', 96, 1), c = pos('C', 32, 1), d = pos('D', 8, 1);
  const lv = [titelMit(a, b, c, d)];
  const plan = () => {
    const p = standardBauzeit('2026-10-05'); // Montag
    const A = vg('A', [a.id]), B = vg('B', [b.id]), C = vg('C', [c.id]), D = vg('D', [d.id]);
    B.vorgaenger = [A.id]; C.vorgaenger = [A.id]; D.vorgaenger = [B.id, C.id]; D.verzug = 1;
    p.vorgaenge = [A, B, C, D];
    return p;
  };
  it('Dauern, Termine, Puffer und kritischer Weg', () => {
    const t = planen(plan(), lv);
    expect(t.fehler).toBeNull();
    const [A, B, C, D] = t.zeilen;
    expect([A.dauer, B.dauer, C.dauer, D.dauer]).toEqual([2, 3, 1, 1]);
    expect([A.start, A.ende]).toEqual(['2026-10-05', '2026-10-06']);
    expect([B.start, B.ende]).toEqual(['2026-10-07', '2026-10-09']);
    expect([C.start, C.ende]).toEqual(['2026-10-07', '2026-10-07']);
    expect(D.start).toBe('2026-10-13'); // Wochenende übersprungen + 1 Tag Verzug
    expect([A.kritisch, B.kritisch, C.kritisch, D.kritisch]).toEqual([true, true, false, true]);
    expect(C.puffer).toBe(2);
    expect(t.arbeitstage).toBe(7);
    expect(t.ende).toBe('2026-10-13');
    expect(t.kalendertage).toBe(9);
  });
  it('Mehr Kräfte verkürzen die Dauer', () => {
    const p = plan();
    p.vorgaenge[1].kraefte = 12; // 96 h / (12 × 8) = 1 Tag
    expect(planen(p, lv).zeilen[1].dauer).toBe(1);
  });
  it('Feiertag und freie Wochentage werden übersprungen', () => {
    const p = plan();
    p.feiertage = ['2026-10-06'];
    const t = planen(p, lv);
    expect(t.zeilen[0].ende).toBe('2026-10-07');
    const q = plan();
    q.arbeitstage = [1, 2, 3, 4, 5, 6];
    expect(planen(q, lv).zeilen[3].start).toBe('2026-10-12'); // Samstag wird mitgearbeitet
  });
  it('Startdatum am Wochenende rückt auf Montag', () => {
    const p = plan(); p.start = '2026-10-03';
    expect(planen(p, lv).start).toBe('2026-10-05');
  });
  it('Gerätebasis, manuelle Dauer, Meilenstein, frühester Beginn', () => {
    const e = pos('E', 10, 1, 4); // 40 Gerätestunden
    const lv2 = [titelMit(e)];
    const p = standardBauzeit('2026-10-05');
    p.vorgaenge = [vg('Aushub', [e.id], { modus: 'geraete', kraefte: 1 }), vg('Abnahme', [], { modus: 'manuell', dauerManuell: 0 }), vg('Spät', [], { modus: 'manuell', dauerManuell: 2, fruehesterStart: '2026-10-19' })];
    p.vorgaenge[1].vorgaenger = [p.vorgaenge[0].id];
    const t = planen(p, lv2);
    expect(t.zeilen[0].dauer).toBe(5); // 40 h / (1 × 8 h)
    expect(t.zeilen[1].dauer).toBe(0);
    expect(t.zeilen[1].start).toBe('2026-10-12');
    expect(t.zeilen[2].start).toBe('2026-10-19');
  });
  it('Vorgang ohne Zeitansätze: 1 Tag mit Hinweis', () => {
    const p = standardBauzeit('2026-10-05');
    p.vorgaenge = [vg('Leer', [])];
    const z = planen(p, lv).zeilen[0];
    expect(z.dauer).toBe(1);
    expect(z.ohneAufwand).toBe(true);
  });
  it('Zyklus wird erkannt', () => {
    const p = plan();
    p.vorgaenge[0].vorgaenger = [p.vorgaenge[3].id];
    expect(planen(p, lv).fehler).toMatch(/Zyklische/);
  });
  it('Unbekannte Vorgänger werden ignoriert', () => {
    const p = plan();
    p.vorgaenge[0].vorgaenger = ['gibt-es-nicht', p.vorgaenge[0].id];
    expect(planen(p, lv).fehler).toBeNull();
  });
});

describe('Erzeugung aus dem LV', () => {
  it('je Titel verkettet, nur Normal-/Zulagepositionen', () => {
    const p = demoProjekt();
    const vs = vorgaengeAusLV(p.lv, 'titel', true);
    expect(vs).toHaveLength(3);
    expect(vs[1].vorgaenger).toEqual([vs[0].id]);
    const ids = vs.flatMap(v => v.positionIds);
    const bedarf = p.lv.flatMap(t => t.positionen).find(x => x.art === 'B')!;
    const alt = p.lv.flatMap(t => t.positionen).find(x => x.art === 'A')!;
    expect(ids).not.toContain(bedarf.id);
    expect(ids).not.toContain(alt.id);
    expect(vorgaengeAusLV(p.lv, 'position', false).every(v => v.vorgaenger.length === 0)).toBe(true);
  });
  it('Demoplan ist plausibel und vollständig verplant', () => {
    const p = demoProjekt();
    const t = planen(p.bauzeit!, p.lv);
    expect(t.fehler).toBeNull();
    expect(t.arbeitstage).toBeGreaterThan(10);
    expect(t.arbeitstage).toBeLessThan(40);
    expect(nichtVerplant(p.bauzeit!, p.lv).anzahl).toBe(0);
  });
});
