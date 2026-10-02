import type {
  AufmassZeile, KalkAnsatz, KalkParameter, Kostenart, Position, Projekt, Rechnung, Titel,
} from '../types';
import { KOSTENART_LISTE } from '../types';
import { formelErgebnis } from './formulas';
import { stationierungSumme } from './station';
import { round2, round3 } from './format';

// ---------------------------------------------------------------------------
// Mittellohn / Kalkulationslohn
// ---------------------------------------------------------------------------

export interface Lohnrechnung {
  grundlohn: number;
  zulagen: number;
  mittellohnA: number; // Grundlohn + Zulagen
  sozialkosten: number;
  lohnnebenkosten: number;
  kalkulationslohn: number; // Mittellohn ASL
}

export function lohnrechnung(k: KalkParameter): Lohnrechnung {
  const zulagen = k.grundlohn * (k.zulagenProzent / 100);
  const mittellohnA = k.grundlohn + zulagen;
  const sozialkosten = mittellohnA * (k.sozialkostenProzent / 100);
  const lohnnebenkosten = mittellohnA * (k.lohnnebenkostenProzent / 100);
  return { grundlohn: k.grundlohn, zulagen, mittellohnA, sozialkosten, lohnnebenkosten, kalkulationslohn: mittellohnA + sozialkosten + lohnnebenkosten };
}

// ---------------------------------------------------------------------------
// Einzelkosten der Teilleistungen (EKT)
// ---------------------------------------------------------------------------

export type KostenSplit = Record<Kostenart, number>;

export const leererSplit = (): KostenSplit => ({ lohn: 0, stoffe: 0, geraete: 0, fremd: 0, sonstiges: 0 });

export function ansatzBetrag(a: KalkAnsatz, kalkLohn: number): number {
  const preis = a.kostenart === 'lohn' && !a.preis ? kalkLohn : a.preis;
  return a.menge * preis;
}

/** EKT je Einheit, aufgeteilt nach Kostenarten */
export function ektJeEinheit(pos: Position, kalkLohn: number): KostenSplit {
  const s = leererSplit();
  for (const a of pos.ansaetze) s[a.kostenart] += ansatzBetrag(a, kalkLohn);
  return s;
}

export const splitSumme = (s: KostenSplit) => KOSTENART_LISTE.reduce((a, k) => a + s[k], 0);

export function allePositionen(lv: Titel[]): Position[] {
  return lv.flatMap(t => t.positionen);
}

/** Zählt die Position in der Angebotssumme? */
export const zaehltInSumme = (p: Position) => p.art === 'N' || p.art === 'Z';

// ---------------------------------------------------------------------------
// Kalkulation (Zuschlags- bzw. Endsummenkalkulation)
// ---------------------------------------------------------------------------

export interface KalkErgebnis {
  kalkLohn: number;
  /** Summe EKT über alle Positionen (nur in Summe zählende) je Kostenart */
  ektSumme: KostenSplit;
  ektGesamt: number;
  bgk: number;
  herstellkosten: number;
  agk: number;
  wug: number;
  angebotssumme: number;
  umlage: number;
  /** resultierende Zuschlagsätze je Kostenart in % */
  zuschlagsaetze: KostenSplit;
  /** Umlagebeträge je Kostenart */
  umlageBetraege: KostenSplit;
  /** Zielsumme vorgegeben? */
  zielModus: boolean;
}

export function kalkulation(projekt: Projekt): KalkErgebnis {
  const k = projekt.kalk;
  const kalkLohn = lohnrechnung(k).kalkulationslohn;
  const ektSumme = leererSplit();
  for (const p of allePositionen(projekt.lv)) {
    if (!zaehltInSumme(p)) continue;
    const e = ektJeEinheit(p, kalkLohn);
    for (const ka of KOSTENART_LISTE) ektSumme[ka] += e[ka] * p.menge;
  }
  const ektGesamt = splitSumme(ektSumme);
  const zuschlagsaetze = leererSplit();
  const umlageBetraege = leererSplit();

  if (k.methode === 'zuschlag') {
    for (const ka of KOSTENART_LISTE) {
      const z = k.zuschlaege[ka];
      zuschlagsaetze[ka] = z.bgk + z.agk + z.wug;
      umlageBetraege[ka] = ektSumme[ka] * (zuschlagsaetze[ka] / 100);
    }
    const umlage = splitSumme(umlageBetraege);
    const bgk = KOSTENART_LISTE.reduce((a, ka) => a + ektSumme[ka] * (k.zuschlaege[ka].bgk / 100), 0);
    const agk = KOSTENART_LISTE.reduce((a, ka) => a + ektSumme[ka] * (k.zuschlaege[ka].agk / 100), 0);
    const wug = KOSTENART_LISTE.reduce((a, ka) => a + ektSumme[ka] * (k.zuschlaege[ka].wug / 100), 0);
    return { kalkLohn, ektSumme, ektGesamt, bgk, herstellkosten: ektGesamt + bgk, agk, wug, angebotssumme: ektGesamt + umlage, umlage, zuschlagsaetze, umlageBetraege, zielModus: false };
  }

  // Endsummenkalkulation (Kalkulation über die Angebotsendsumme)
  const bgk = k.bgkPosten.reduce((a, b) => a + b.betrag, 0);
  const herstellkosten = ektGesamt + bgk;
  const zielModus = k.zielSumme > 0;
  let angebotssumme: number, agk: number, wug: number;
  if (zielModus) {
    angebotssumme = k.zielSumme;
    // AGK und W&G anteilig aus der vorgegebenen Summe ableiten (Rest nach HK)
    const rest = angebotssumme - herstellkosten;
    const quote = k.agkProzent + k.wugProzent;
    agk = quote > 0 ? rest * (k.agkProzent / quote) : rest;
    wug = quote > 0 ? rest * (k.wugProzent / quote) : 0;
  } else {
    const nenner = 100 - k.agkProzent - k.wugProzent;
    angebotssumme = nenner > 0 ? (herstellkosten * 100) / nenner : herstellkosten;
    agk = angebotssumme * (k.agkProzent / 100);
    wug = angebotssumme * (k.wugProzent / 100);
  }
  const umlage = angebotssumme - ektGesamt;
  // Verteilung der Umlage auf die Kostenarten nach EKT × Gewicht
  const basis = KOSTENART_LISTE.reduce((a, ka) => a + ektSumme[ka] * (k.umlageGewichte[ka] ?? 1), 0);
  for (const ka of KOSTENART_LISTE) {
    const anteil = basis > 0 ? (ektSumme[ka] * (k.umlageGewichte[ka] ?? 1)) / basis : 0;
    umlageBetraege[ka] = umlage * anteil;
    zuschlagsaetze[ka] = ektSumme[ka] > 0 ? (umlageBetraege[ka] / ektSumme[ka]) * 100 : 0;
  }
  return { kalkLohn, ektSumme, ektGesamt, bgk, herstellkosten, agk, wug, angebotssumme, umlage, zuschlagsaetze, umlageBetraege, zielModus };
}

/** Kalkulierter EP einer Position (EKT je Einheit × (1 + Zuschlag je Kostenart)) */
export function kalkEP(pos: Position, erg: KalkErgebnis): { ep: number; ekt: KostenSplit; ektSumme: number; zuschlag: number } {
  const ekt = ektJeEinheit(pos, erg.kalkLohn);
  let ep = 0;
  for (const ka of KOSTENART_LISTE) ep += ekt[ka] * (1 + erg.zuschlagsaetze[ka] / 100);
  const ektSumme = splitSumme(ekt);
  return { ep: round2(ep), ekt, ektSumme, zuschlag: ep - ektSumme };
}

/** Effektiver EP: aus Kalkulation oder manuell */
export function effektiverEP(pos: Position, erg: KalkErgebnis | null): number {
  if (pos.art === 'H') return 0;
  if (pos.epAusKalkulation && erg) return kalkEP(pos, erg).ep;
  return pos.ep;
}

// ---------------------------------------------------------------------------
// LV-Summen
// ---------------------------------------------------------------------------

export interface LVSummen {
  titel: { titel: Titel; summe: number }[];
  netto: number;
  nachlass: number;
  nettoNachNachlass: number;
  mwst: number;
  brutto: number;
  eventual: number; // Summe Bedarfspositionen (nachrichtlich)
}

export function lvSummen(projekt: Projekt, erg: KalkErgebnis | null): LVSummen {
  const titel = projekt.lv.map(t => ({
    titel: t,
    summe: round2(t.positionen.filter(zaehltInSumme).reduce((a, p) => a + round2(p.menge * effektiverEP(p, erg)), 0)),
  }));
  const netto = round2(titel.reduce((a, t) => a + t.summe, 0));
  const nachlass = round2(netto * (projekt.nachlassProzent / 100));
  const nettoNachNachlass = round2(netto - nachlass);
  const mwst = round2(nettoNachNachlass * (projekt.mwstProzent / 100));
  const eventual = round2(allePositionen(projekt.lv).filter(p => p.art === 'B').reduce((a, p) => a + round2(p.menge * effektiverEP(p, erg)), 0));
  return { titel, netto, nachlass, nettoNachNachlass, mwst, brutto: round2(nettoNachNachlass + mwst), eventual };
}

// ---------------------------------------------------------------------------
// Aufmaß
// ---------------------------------------------------------------------------

export function aufmassZeileErgebnis(z: AufmassZeile): { wert: number; fehler?: string } {
  const r = formelErgebnis(z.formelNr, z.werte, z.freieFormel);
  return { wert: round3(r.wert * (z.faktor || 1) * (z.abzug ? -1 : 1)), fehler: r.fehler };
}

/** Aufgemessene Menge je Position bis einschließlich Stichtag (leer = alle) */
export function mengenBisStichtag(projekt: Projekt, stichtag: string | null): Map<string, number> {
  const m = new Map<string, number>();
  const add = (id: string, v: number) => m.set(id, round3((m.get(id) ?? 0) + v));
  for (const z of projekt.aufmass) {
    if (stichtag && z.datum > stichtag) continue;
    add(z.positionId, aufmassZeileErgebnis(z).wert);
  }
  for (const s of projekt.stationierungen) {
    if (stichtag && s.datum > stichtag) continue;
    add(s.positionId, stationierungSumme(s));
  }
  return m;
}

// ---------------------------------------------------------------------------
// Kumulative Abschlagsrechnung
// ---------------------------------------------------------------------------

export interface RechnungsZeile {
  position: Position;
  titel: Titel;
  mengeKum: number;
  ep: number;
  gpKum: number;
  mengeVorher: number;
  mengeDiff: number;
  gpDiff: number;
}

export interface RechnungsErgebnis {
  rechnung: Rechnung;
  zeilen: RechnungsZeile[];
  titelSummen: { titel: Titel; summe: number }[];
  leistungKum: number; // netto kumuliert
  nachlass: number;
  nettoNachNachlass: number;
  sicherheitseinbehalt: number;
  sonstigeAbzuege: number;
  nettoZahlbar: number; // netto kum nach Abzügen
  mwst: number;
  bruttoKum: number;
  bisherGestellt: number; // Summe Rechnungsbeträge der Vorrechnungen (brutto)
  rechnungsbetrag: number; // zu zahlender Betrag
  skontoBetrag: number;
  zahlungenGesamt: number; // Zahlungseingänge auf diese Rechnung
  offen: number;
  vorherige: Rechnung[];
}

/** Mengen einer Rechnung: Snapshot (festgeschrieben) oder aktuell aus Aufmaß */
export function rechnungsMengen(projekt: Projekt, r: Rechnung): Map<string, number> {
  if (r.snapshot) return new Map(r.snapshot.map(s => [s.positionId, s.mengeKum]));
  return mengenBisStichtag(projekt, r.stichtag);
}

export function rechnungBerechnen(projekt: Projekt, r: Rechnung, erg: KalkErgebnis | null): RechnungsErgebnis {
  const mengen = rechnungsMengen(projekt, r);
  const vorherige = projekt.rechnungen.filter(x => x.lfdNr < r.lfdNr).sort((a, b) => a.lfdNr - b.lfdNr);
  const letzte = vorherige[vorherige.length - 1];
  const mengenVorher = letzte ? rechnungsMengen(projekt, letzte) : new Map<string, number>();

  const zeilen: RechnungsZeile[] = [];
  const titelSummen: { titel: Titel; summe: number }[] = [];
  for (const t of projekt.lv) {
    let ts = 0;
    for (const p of t.positionen) {
      if (p.art === 'H') continue;
      const mengeKum = mengen.get(p.id) ?? 0;
      const mengeVorher = mengenVorher.get(p.id) ?? 0;
      if (mengeKum === 0 && mengeVorher === 0) continue;
      const ep = effektiverEP(p, erg);
      const gpKum = round2(mengeKum * ep);
      const gpVorher = round2(mengeVorher * ep);
      zeilen.push({ position: p, titel: t, mengeKum, ep, gpKum, mengeVorher, mengeDiff: round3(mengeKum - mengeVorher), gpDiff: round2(gpKum - gpVorher) });
      ts += gpKum;
    }
    if (ts !== 0) titelSummen.push({ titel: t, summe: round2(ts) });
  }
  const leistungKum = round2(titelSummen.reduce((a, t) => a + t.summe, 0));
  const nachlass = round2(leistungKum * (r.nachlassProzent / 100));
  const nettoNachNachlass = round2(leistungKum - nachlass);
  const sicherheitseinbehalt = round2(nettoNachNachlass * (r.sicherheitseinbehaltProzent / 100));
  const sonstigeAbzuege = round2(r.sonstigeAbzuege.reduce((a, b) => a + b.betrag, 0));
  const nettoZahlbar = round2(nettoNachNachlass - sicherheitseinbehalt - sonstigeAbzuege);
  const mwst = r.reverseCharge ? 0 : round2(nettoZahlbar * (projekt.mwstProzent / 100));
  const bruttoKum = round2(nettoZahlbar + mwst);
  const bisherGestellt = round2(vorherige.reduce((a, v) => a + rechnungBerechnen(projekt, v, erg).rechnungsbetrag, 0));
  const rechnungsbetrag = round2(bruttoKum - bisherGestellt);
  const skontoBetrag = round2(rechnungsbetrag * (r.skontoProzent / 100));
  const zahlungenGesamt = round2(r.zahlungen.reduce((a, z) => a + z.betrag, 0));
  return {
    rechnung: r, zeilen, titelSummen, leistungKum, nachlass, nettoNachNachlass, sicherheitseinbehalt, sonstigeAbzuege,
    nettoZahlbar, mwst, bruttoKum, bisherGestellt, rechnungsbetrag, skontoBetrag, zahlungenGesamt,
    offen: round2(rechnungsbetrag - zahlungenGesamt), vorherige,
  };
}
