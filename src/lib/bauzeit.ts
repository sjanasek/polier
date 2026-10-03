// ---------------------------------------------------------------------------
// Bauzeitenplan: Dauer aus den Zeitansätzen der Kalkulation, Terminrechnung
// (Vorwärts-/Rückwärtsrechnung, kritischer Pfad) mit Arbeitskalender.
// ---------------------------------------------------------------------------
import type { Bauzeitenplan, ID, Position, Titel, Vorgang } from '../types';
import { allePositionen } from './calc';
import { heute, uid } from './format';

// ----- Datumshilfen (UTC, keine Zeitzonenfehler) -----------------------------
const DAY = 86400000;
export const parseIso = (s: string) => { const [y, m, d] = s.split('-').map(Number); return new Date(Date.UTC(y, m - 1, d)); };
export const toIso = (d: Date) => d.toISOString().slice(0, 10);
export const addDaysIso = (s: string, n: number) => toIso(new Date(parseIso(s).getTime() + n * DAY));
export const tageZwischen = (a: string, b: string) => Math.round((parseIso(b).getTime() - parseIso(a).getTime()) / DAY);
export const wochentag = (s: string) => parseIso(s).getUTCDay();

/** ISO-Kalenderwoche */
export function isoWoche(s: string): number {
  const d = parseIso(s);
  d.setUTCDate(d.getUTCDate() + 3 - ((d.getUTCDay() + 6) % 7));
  const w1 = new Date(Date.UTC(d.getUTCFullYear(), 0, 4));
  return 1 + Math.round(((d.getTime() - w1.getTime()) / DAY - 3 + ((w1.getUTCDay() + 6) % 7)) / 7);
}

/** Ostersonntag (Gauß) */
export function ostersonntag(jahr: number): string {
  const a = jahr % 19, b = Math.floor(jahr / 100), c = jahr % 100;
  const d = Math.floor(b / 4), e = b % 4, f = Math.floor((b + 8) / 25);
  const g = Math.floor((b - f + 1) / 3), h = (19 * a + b - d - g + 15) % 30;
  const i = Math.floor(c / 4), k = c % 4, l = (32 + 2 * e + 2 * i - h - k) % 7;
  const m = Math.floor((a + 11 * h + 22 * l) / 451);
  const monat = Math.floor((h + l - 7 * m + 114) / 31);
  const tag = ((h + l - 7 * m + 114) % 31) + 1;
  return toIso(new Date(Date.UTC(jahr, monat - 1, tag)));
}

/** Bundesweite gesetzliche Feiertage (ohne regionale) */
export function bundesFeiertage(jahr: number): string[] {
  const o = ostersonntag(jahr);
  return [
    `${jahr}-01-01`, addDaysIso(o, -2), addDaysIso(o, 1), `${jahr}-05-01`, addDaysIso(o, 39), addDaysIso(o, 50),
    `${jahr}-10-03`, `${jahr}-12-25`, `${jahr}-12-26`,
  ];
}

// ----- Zeitaufwand aus der Kalkulation --------------------------------------
export interface Aufwand { lohn: number; geraete: number }

/**
 * Zeitaufwand einer Position in Stunden = Σ Ansatzmengen × Positionsmenge.
 * Lohn: alle Lohnansätze (Stunden je Einheit). Geräte: Geräteansätze mit Einheit "h".
 */
export function positionAufwand(pos: Position): Aufwand {
  let lohn = 0, geraete = 0;
  for (const a of pos.ansaetze) {
    if (a.kostenart === 'lohn') lohn += a.menge;
    else if (a.kostenart === 'geraete' && a.einheit.trim().toLowerCase() === 'h') geraete += a.menge;
  }
  return { lohn: lohn * pos.menge, geraete: geraete * pos.menge };
}

export function vorgangAufwand(v: Vorgang, positionen: Map<ID, Position>): Aufwand {
  const sum: Aufwand = { lohn: 0, geraete: 0 };
  for (const id of v.positionIds) {
    const p = positionen.get(id);
    if (!p) continue;
    const a = positionAufwand(p);
    sum.lohn += a.lohn;
    sum.geraete += a.geraete;
  }
  return sum;
}

// ----- Standardwerte / Erzeugung ---------------------------------------------
export const standardBauzeit = (start: string = heute()): Bauzeitenplan => ({
  start, stundenProTag: 8, standardKraefte: 4, arbeitstage: [1, 2, 3, 4, 5], feiertage: [], vorgaenge: [],
});

export const neuerVorgang = (name = 'Neuer Vorgang'): Vorgang => ({
  id: uid(), name, positionIds: [], modus: 'lohn', kraefte: 0, dauerManuell: 1, vorgaenger: [], verzug: 0, fruehesterStart: '', notiz: '',
});

/** Vorgänge aus dem LV: je Titel oder je Position. Nur Normal- und Zulagepositionen. */
export function vorgaengeAusLV(lv: Titel[], je: 'titel' | 'position', verketten: boolean): Vorgang[] {
  const zaehlt = (p: Position) => (p.art === 'N' || p.art === 'Z') && p.menge > 0;
  const out: Vorgang[] = [];
  if (je === 'titel') {
    for (const t of lv) {
      const ids = t.positionen.filter(zaehlt).map(p => p.id);
      if (ids.length) out.push({ ...neuerVorgang(`${t.oz} ${t.bezeichnung}`), positionIds: ids });
    }
  } else {
    for (const t of lv) for (const p of t.positionen.filter(zaehlt)) out.push({ ...neuerVorgang(`${p.oz} ${p.kurztext}`), positionIds: [p.id] });
  }
  if (verketten) out.forEach((v, i) => { if (i > 0) v.vorgaenger = [out[i - 1].id]; });
  return out;
}

// ----- Terminrechnung ---------------------------------------------------------
export interface VorgangZeile {
  vorgang: Vorgang;
  nr: number;
  aufwand: Aufwand;
  kraefte: number;
  /** Dauer in Arbeitstagen */
  dauer: number;
  /** keine Zeitansätze für die gewählte Basis vorhanden */
  ohneAufwand: boolean;
  /** gültige Vorgänger-IDs */
  vorgaenger: ID[];
  es: number; ef: number; ls: number; lf: number;
  puffer: number;
  kritisch: boolean;
  start: string;
  ende: string;
}

export interface Terminplan {
  fehler: string | null;
  zeilen: VorgangZeile[];
  start: string;
  ende: string;
  arbeitstage: number;
  kalendertage: number;
  lohnstunden: number;
  geraetestunden: number;
  /** Anzahl Kräfte je Arbeitstag */
  personalProTag: number[];
  spitze: number;
  /** Datum je Arbeitstag-Index */
  arbeitsdatum: string[];
}

export function planen(plan: Bauzeitenplan, lv: Titel[]): Terminplan {
  const positionen = new Map(allePositionen(lv).map(p => [p.id, p]));
  const tage = new Set(plan.arbeitstage.length ? plan.arbeitstage : [1, 2, 3, 4, 5]);
  const frei = new Set(plan.feiertage);
  const istArbeitstag = (s: string) => tage.has(wochentag(s)) && !frei.has(s);

  let startDatum = plan.start || heute();
  for (let g = 0; g < 400 && !istArbeitstag(startDatum); g++) startDatum = addDaysIso(startDatum, 1);
  const arbeitsdatum: string[] = [startDatum];
  const datumVon = (i: number): string => {
    while (arbeitsdatum.length <= i) {
      let d = arbeitsdatum[arbeitsdatum.length - 1];
      for (let g = 0; g < 400; g++) { d = addDaysIso(d, 1); if (istArbeitstag(d)) break; }
      arbeitsdatum.push(d);
    }
    return arbeitsdatum[i];
  };
  const indexVon = (datum: string): number => {
    if (!datum || datum <= startDatum) return 0;
    let i = 0;
    while (i < 5000 && datumVon(i) < datum) i++;
    return i;
  };

  const ids = new Set(plan.vorgaenge.map(v => v.id));
  const stunden = Math.max(plan.stundenProTag, 0.1);
  const zeilen: VorgangZeile[] = plan.vorgaenge.map((v, i) => {
    const aufwand = vorgangAufwand(v, positionen);
    const kraefte = v.kraefte > 0 ? v.kraefte : Math.max(plan.standardKraefte, 1);
    let dauer: number, ohneAufwand = false;
    if (v.modus === 'manuell') {
      dauer = Math.max(0, Math.round(v.dauerManuell));
    } else {
      const h = v.modus === 'lohn' ? aufwand.lohn : aufwand.geraete;
      if (h > 0) dauer = Math.max(1, Math.ceil(h / (kraefte * stunden) - 1e-9));
      else { dauer = 1; ohneAufwand = true; }
    }
    return {
      vorgang: v, nr: i + 1, aufwand, kraefte, dauer, ohneAufwand,
      vorgaenger: v.vorgaenger.filter(id => ids.has(id) && id !== v.id),
      es: 0, ef: 0, ls: 0, lf: 0, puffer: 0, kritisch: false, start: startDatum, ende: startDatum,
    };
  });

  const lohnstunden = zeilen.reduce((a, z) => a + z.aufwand.lohn, 0);
  const geraetestunden = zeilen.reduce((a, z) => a + z.aufwand.geraete, 0);
  const leer = (fehler: string | null): Terminplan => ({
    fehler, zeilen, start: startDatum, ende: startDatum, arbeitstage: 0, kalendertage: 0, lohnstunden, geraetestunden,
    personalProTag: [], spitze: 0, arbeitsdatum,
  });

  // Topologische Sortierung (Kahn); Zyklus → Fehler
  const byId = new Map(zeilen.map(z => [z.vorgang.id, z]));
  const nachfolger = new Map<ID, VorgangZeile[]>(zeilen.map(z => [z.vorgang.id, []]));
  const eingang = new Map<ID, number>();
  for (const z of zeilen) {
    eingang.set(z.vorgang.id, z.vorgaenger.length);
    for (const p of z.vorgaenger) nachfolger.get(p)!.push(z);
  }
  const order: VorgangZeile[] = [];
  const queue = zeilen.filter(z => z.vorgaenger.length === 0);
  while (queue.length) {
    const z = queue.shift()!;
    order.push(z);
    for (const n of nachfolger.get(z.vorgang.id)!) {
      const e = eingang.get(n.vorgang.id)! - 1;
      eingang.set(n.vorgang.id, e);
      if (e === 0) queue.push(n);
    }
  }
  if (order.length < zeilen.length) {
    const rest = zeilen.filter(z => !order.includes(z)).map(z => z.nr).join(', ');
    return leer(`Zyklische Abhängigkeit zwischen den Vorgängen ${rest}. Bitte Vorgänger korrigieren.`);
  }

  // Vorwärtsrechnung
  for (const z of order) {
    let es = indexVon(z.vorgang.fruehesterStart);
    for (const p of z.vorgaenger) es = Math.max(es, byId.get(p)!.ef + z.vorgang.verzug);
    z.es = Math.max(0, es);
    z.ef = z.es + z.dauer;
  }
  const ende = Math.max(0, ...zeilen.map(z => z.ef));
  // Rückwärtsrechnung
  for (const z of [...order].reverse()) {
    const ns = nachfolger.get(z.vorgang.id)!;
    z.lf = ns.length ? Math.min(...ns.map(n => n.ls - n.vorgang.verzug)) : ende;
    z.ls = z.lf - z.dauer;
    z.puffer = z.ls - z.es;
    z.kritisch = z.puffer <= 0;
  }
  for (const z of zeilen) {
    z.start = datumVon(z.es);
    z.ende = z.dauer > 0 ? datumVon(z.ef - 1) : z.start;
  }

  const personalProTag = Array.from({ length: ende }, () => 0);
  for (const z of zeilen) for (let i = z.es; i < z.ef; i++) personalProTag[i] += z.kraefte;
  const planEnde = zeilen.length ? zeilen.reduce((m, z) => (z.ende > m ? z.ende : m), startDatum) : startDatum;
  datumVon(Math.max(ende - 1, 0));
  return {
    fehler: null, zeilen, start: startDatum, ende: planEnde, arbeitstage: ende,
    kalendertage: zeilen.length ? tageZwischen(startDatum, planEnde) + 1 : 0,
    lohnstunden, geraetestunden, personalProTag, spitze: Math.max(0, ...personalProTag), arbeitsdatum,
  };
}

/** Positionen (Normal/Zulage mit Lohnaufwand), die in keinem Vorgang vorkommen */
export function nichtVerplant(plan: Bauzeitenplan, lv: Titel[]): { anzahl: number; lohnstunden: number } {
  const verplant = new Set(plan.vorgaenge.flatMap(v => v.positionIds));
  let anzahl = 0, lohnstunden = 0;
  for (const p of allePositionen(lv)) {
    if ((p.art !== 'N' && p.art !== 'Z') || verplant.has(p.id)) continue;
    const a = positionAufwand(p);
    if (a.lohn > 0 || a.geraete > 0) { anzahl++; lohnstunden += a.lohn; }
  }
  return { anzahl, lohnstunden };
}

export const bauzeitVon = (p: { bauzeit?: Bauzeitenplan; datum: string }): Bauzeitenplan => p.bauzeit ?? standardBauzeit(p.datum);
