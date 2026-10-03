// ---------------------------------------------------------------------------
// Nachkalkulation: Soll (aus Kalkulation, bezogen auf den Leistungsstand) gegen
// Ist (importierte Stunden und Kosten), Kennzahlen, Hochrechnung, Zeitverlauf,
// Rückführung von Erfahrungswerten. Reine Funktionen über dem Datenmodell.
// ---------------------------------------------------------------------------
import type { AmpelSchwellen, Kostenart, KostenZeile, Nachkalkulation, Position, Projekt, StundenZeile, Titel } from '../types';
import { KOSTENART_LISTE, KOSTENARTEN } from '../types';
import {
  allePositionen, effektiverEP, ektJeEinheit, kalkulation, leererSplit, lvSummen, mengenBisStichtag, splitSumme, type KalkErgebnis, type KostenSplit,
} from './calc';
import { bauzeitVon, planen } from './bauzeit';
import { csvErzeugen } from './csv';
import { round2 } from './format';

export const standardNachkalk = (): Nachkalkulation => ({ kostenstellen: [], stunden: [], kosten: [], importe: [], schwellen: { gelb: 5, rot: 15 } });
export const nachkalkVon = (p: { nachkalk?: Nachkalkulation }): Nachkalkulation => p.nachkalk ?? standardNachkalk();

export type Ampel = 'gruen' | 'gelb' | 'rot' | 'grau';

/** Ampel aus der Abweichung in % (positiv = Ist über Soll); null = nicht bewertbar */
export function ampel(prozent: number | null, s: AmpelSchwellen): Ampel {
  if (prozent == null || !Number.isFinite(prozent)) return 'grau';
  if (prozent > s.rot) return 'rot';
  if (prozent > s.gelb) return 'gelb';
  return 'gruen';
}

/** Abweichung in % von Soll; null bei Soll = 0 */
export const abweichungProzent = (soll: number, ist: number): number | null => (soll > 0 ? ((ist - soll) / soll) * 100 : null);

export interface Vergleich {
  bezeichnung: string;
  soll: number;
  ist: number;
  abweichung: number;
  prozent: number | null;
  ampel: Ampel;
}

export interface StundenNachArt { stundenart: string; stunden: number; lohnkosten: number | null }

export interface TitelVergleich {
  titel: Titel;
  kostenstellen: string[];
  /** Soll bezogen auf den Leistungsstand */
  sollStunden: number;
  sollKosten: KostenSplit;
  /** Ist der zugeordneten Kostenstellen */
  istStunden: number;
  istKosten: KostenSplit;
  leistung: number;
  /** Ist-Stunden ÷ Soll-Stunden (null, wenn nicht ermittelbar) */
  aufwandFaktor: number | null;
}

export interface VerlaufPunkt {
  datum: string;
  sollStunden: number;
  istStunden: number;
  planStunden: number | null;
  sollKosten: number;
  istKosten: number;
  leistung: number;
}

export type LohnQuelle = 'fibu' | 'export' | 'geschaetzt' | 'keine';
export type HochrechnungsArt = 'trend' | 'restPlan';

export const HOCHRECHNUNGS_ARTEN: Record<HochrechnungsArt, string> = {
  trend: 'Trend: Ist-Kosten ÷ Leistungsgrad',
  restPlan: 'Rest zu Plan: Ist-Kosten + verbleibende Soll-Kosten',
};

export interface NachkalkOptionen {
  stichtag: string | null;
  hochrechnung: HochrechnungsArt;
}

export interface NachkalkErgebnis {
  stichtag: string | null;
  erg: KalkErgebnis;
  kostenstellen: string[];
  /** Zeilen, deren Kostenstelle keiner Projekt-Kostenstelle entspricht (nur wenn Kostenstellen gepflegt sind) */
  fremdeZeilen: number;
  hatStunden: boolean;
  hatKosten: boolean;
  hatLeistungsstand: boolean;
  // Soll
  sollStunden: number;
  sollKosten: KostenSplit;
  sollEkt: number;
  sollBgk: number;
  sollGesamt: number;
  sollStundenGesamt: number;
  sollKostenGesamt: KostenSplit;
  sollEktGesamt: number;
  // Leistung
  leistung: number;
  erloes: number;
  auftragssumme: number;
  auftragssummeNachNachlass: number;
  leistungsgrad: number | null;
  // Ist
  istStunden: number;
  stundenNachArt: StundenNachArt[];
  istLohnkosten: number;
  lohnQuelle: LohnQuelle;
  istKosten: KostenSplit;
  istEkt: number;
  istBgk: number;
  istGesamt: number;
  nichtZugeordneteKonten: { konto: string; bezeichnung: string; betrag: number }[];
  // Vergleich
  vergleich: Vergleich[];
  vergleichEkt: Vergleich;
  vergleichBgk: Vergleich;
  vergleichGesamt: Vergleich;
  vergleichStunden: Vergleich;
  mittellohnSoll: number;
  mittellohnIst: number | null;
  bgkSatzSoll: number | null;
  bgkSatzIst: number | null;
  zuschlagSoll: number | null;
  zuschlagIst: number | null;
  ergebnisIst: number;
  ergebnisSoll: number;
  // Hochrechnung
  hochrechnung: {
    art: HochrechnungsArt;
    prognoseKosten: number | null;
    prognoseErgebnis: number | null;
    planKosten: number;
    planErgebnis: number;
    abweichungErgebnis: number | null;
    restKostenPlan: number;
  };
  bauzeit: { planStundenBisStichtag: number; planStundenGesamt: number; planEnde: string; verfuegbar: boolean };
  titel: TitelVergleich[];
  verlauf: VerlaufPunkt[];
}

const istBis = <T extends { datum: string }>(zeilen: T[], stichtag: string | null) => (stichtag ? zeilen.filter(z => z.datum <= stichtag) : zeilen);

function lohnstundenJeEinheit(p: Position): number {
  return p.ansaetze.filter(a => a.kostenart === 'lohn').reduce((s, a) => s + a.menge, 0);
}

interface SollStand { stunden: number; kosten: KostenSplit; leistung: number }

/** Soll aus der Kalkulation für die Mengen in `mengen` (null = LV-Mengen) */
function sollFuerMengen(projekt: Projekt, erg: KalkErgebnis, mengen: Map<string, number> | null, nur?: Set<string>): SollStand {
  const kosten = leererSplit();
  let stunden = 0, leistung = 0;
  for (const t of projekt.lv) {
    for (const p of t.positionen) {
      if (p.art === 'H') continue;
      if (nur && !nur.has(p.id)) continue;
      const m = mengen ? mengen.get(p.id) ?? 0 : (p.art === 'N' || p.art === 'Z' ? p.menge : 0);
      if (!m) continue;
      const e = ektJeEinheit(p, erg.kalkLohn);
      for (const ka of KOSTENART_LISTE) kosten[ka] += e[ka] * m;
      stunden += lohnstundenJeEinheit(p) * m;
      leistung += round2(m * effektiverEP(p, erg));
    }
  }
  return { stunden, kosten, leistung: round2(leistung) };
}

function stundenSumme(z: StundenZeile[]): number { return z.reduce((a, s) => a + s.stunden, 0); }

function kostenSplit(z: KostenZeile[]): { ekt: KostenSplit; bgk: number } {
  const ekt = leererSplit();
  let bgk = 0;
  for (const k of z) {
    if (k.gemeinkosten) bgk += k.betrag;
    else ekt[k.kostenart] += k.betrag;
  }
  return { ekt, bgk };
}

/** Geplante Lohnstunden laut Bauzeitenplan bis einschließlich Stichtag (gleichmäßig über die Vorgangsdauer verteilt) */
export function planStundenBis(projekt: Projekt, stichtag: string | null): { bis: number; gesamt: number; ende: string; verfuegbar: boolean } {
  const plan = bauzeitVon(projekt);
  if (!plan.vorgaenge.length) return { bis: 0, gesamt: 0, ende: '', verfuegbar: false };
  const t = planen(plan, projekt.lv);
  if (t.fehler) return { bis: 0, gesamt: 0, ende: '', verfuegbar: false };
  let bis = 0;
  for (const z of t.zeilen) {
    if (z.dauer <= 0 || z.aufwand.lohn <= 0) continue;
    const jeTag = z.aufwand.lohn / z.dauer;
    for (let i = z.es; i < z.ef; i++) {
      const d = t.arbeitsdatum[i];
      if (!stichtag || (d && d <= stichtag)) bis += jeTag;
    }
  }
  return { bis, gesamt: t.lohnstunden, ende: t.ende, verfuegbar: true };
}

const vergleich = (bezeichnung: string, soll: number, ist: number, s: AmpelSchwellen): Vergleich => {
  const prozent = abweichungProzent(soll, ist);
  return { bezeichnung, soll, ist, abweichung: ist - soll, prozent, ampel: ampel(prozent, s) };
};

/** Monatsletzte zwischen zwei ISO-Daten (einschließlich), plus Enddatum */
function monatsPunkte(von: string, bis: string): string[] {
  const out: string[] = [];
  let [j, m] = von.split('-').map(Number);
  for (let g = 0; g < 240; g++) {
    const letzter = new Date(Date.UTC(j, m, 0)).toISOString().slice(0, 10);
    if (letzter >= bis) break;
    if (letzter >= von) out.push(letzter);
    m++; if (m > 12) { m = 1; j++; }
  }
  out.push(bis);
  return out;
}

export function nachkalkulation(projekt: Projekt, opt: NachkalkOptionen): NachkalkErgebnis {
  const nk = nachkalkVon(projekt);
  const erg = kalkulation(projekt);
  const summen = lvSummen(projekt, erg);
  const schwellen = nk.schwellen;
  const stichtag = opt.stichtag;

  // Kostenstellen des Projekts (leer = alle importierten Zeilen zählen)
  const kstNummern = nk.kostenstellen.map(k => k.nummer.trim()).filter(Boolean);
  const kstSet = new Set(kstNummern);
  const gehoertDazu = (kst: string) => kstSet.size === 0 || kstSet.has(kst.trim());
  const bgkKst = new Set(nk.kostenstellen.filter(k => k.gemeinkosten).map(k => k.nummer.trim()));
  const alleStunden = nk.stunden.filter(s => gehoertDazu(s.kostenstelle));
  const alleKosten = nk.kosten.map(k => (bgkKst.has(k.kostenstelle.trim()) ? { ...k, gemeinkosten: true } : k)).filter(k => gehoertDazu(k.kostenstelle));
  const fremdeZeilen = kstSet.size ? nk.stunden.length + nk.kosten.length - alleStunden.length - alleKosten.length : 0;
  const stunden = istBis(alleStunden, stichtag);
  const kosten = istBis(alleKosten, stichtag);

  // Soll
  const mengen = mengenBisStichtag(projekt, stichtag);
  const stand = sollFuerMengen(projekt, erg, mengen);
  const gesamt = sollFuerMengen(projekt, erg, null);
  const leistung = stand.leistung;
  const auftragssumme = summen.netto;
  const leistungsgrad = auftragssumme > 0 ? leistung / auftragssumme : null;
  const grad = leistungsgrad ?? 0;
  const sollEkt = splitSumme(stand.kosten);
  const sollBgk = erg.bgk * grad;
  const erloes = round2(leistung * (1 - projekt.nachlassProzent / 100));

  // Ist
  const istStunden = stundenSumme(stunden);
  const arten = new Map<string, StundenNachArt>();
  for (const s of stunden) {
    const key = s.stundenart || '(ohne Angabe)';
    const a = arten.get(key) ?? { stundenart: key, stunden: 0, lohnkosten: null };
    a.stunden += s.stunden;
    if (s.lohnkosten != null) a.lohnkosten = (a.lohnkosten ?? 0) + s.lohnkosten;
    arten.set(key, a);
  }
  const stundenNachArt = Array.from(arten.values()).sort((a, b) => b.stunden - a.stunden);
  const { ekt: fibuEkt, bgk: istBgk } = kostenSplit(kosten);
  const exportLohn = stunden.reduce((a, s) => a + (s.lohnkosten ?? 0), 0);
  const hatExportLohn = stunden.some(s => s.lohnkosten != null);
  let lohnQuelle: LohnQuelle, istLohnkosten: number;
  if (fibuEkt.lohn > 0) { lohnQuelle = 'fibu'; istLohnkosten = fibuEkt.lohn; }
  else if (hatExportLohn) { lohnQuelle = 'export'; istLohnkosten = exportLohn; }
  else if (istStunden > 0) { lohnQuelle = 'geschaetzt'; istLohnkosten = istStunden * erg.kalkLohn; }
  else { lohnQuelle = 'keine'; istLohnkosten = 0; }
  const istKosten: KostenSplit = { ...fibuEkt, lohn: istLohnkosten };
  const istEkt = splitSumme(istKosten);
  const istGesamt = istEkt + istBgk;
  const unbekannt = new Map<string, { konto: string; bezeichnung: string; betrag: number }>();
  for (const k of kosten) {
    if (k.zugeordnet) continue;
    const u = unbekannt.get(k.konto) ?? { konto: k.konto, bezeichnung: k.kontoBezeichnung, betrag: 0 };
    u.betrag += k.betrag;
    if (!u.bezeichnung) u.bezeichnung = k.kontoBezeichnung;
    unbekannt.set(k.konto, u);
  }

  // Vergleich
  const vergleichListe = KOSTENART_LISTE.map(ka => vergleich(KOSTENARTEN[ka], stand.kosten[ka], istKosten[ka], schwellen));
  const vergleichEkt = vergleich('Einzelkosten (EKT)', sollEkt, istEkt, schwellen);
  const vergleichBgk = vergleich('Gemeinkosten (BGK)', sollBgk, istBgk, schwellen);
  const vergleichGesamt = vergleich('Kosten gesamt', sollEkt + sollBgk, istGesamt, schwellen);
  const vergleichStunden = vergleich('Lohnstunden', stand.stunden, istStunden, schwellen);
  const mittellohnIst = istStunden > 0 && lohnQuelle !== 'geschaetzt' && lohnQuelle !== 'keine' ? istLohnkosten / istStunden : null;
  const bgkSatzSoll = erg.ektGesamt > 0 ? (erg.bgk / erg.ektGesamt) * 100 : null;
  const bgkSatzIst = istEkt > 0 ? (istBgk / istEkt) * 100 : null;
  const zuschlagSoll = erg.ektGesamt > 0 ? (erg.umlage / erg.ektGesamt) * 100 : null;
  const zuschlagIst = istEkt > 0 ? ((erloes - istEkt) / istEkt) * 100 : null;
  const ergebnisIst = erloes - istGesamt;
  const ergebnisSoll = erloes - sollEkt - sollBgk;

  // Hochrechnung
  const planKosten = erg.herstellkosten;
  const planErgebnis = summen.nettoNachNachlass - planKosten;
  const restKostenPlan = Math.max(0, splitSumme(gesamt.kosten) - sollEkt) + Math.max(0, erg.bgk - sollBgk);
  let prognoseKosten: number | null = null;
  if (opt.hochrechnung === 'trend') prognoseKosten = leistungsgrad && leistungsgrad > 0 ? istGesamt / leistungsgrad : null;
  else prognoseKosten = istGesamt + restKostenPlan;
  const prognoseErgebnis = prognoseKosten == null ? null : summen.nettoNachNachlass - prognoseKosten;

  // Bauzeit
  const ps = planStundenBis(projekt, stichtag);

  // Titel (nur Titel mit zugeordneten Kostenstellen)
  const titel: TitelVergleich[] = [];
  for (const t of projekt.lv) {
    const ksts = nk.kostenstellen.filter(k => k.titelId === t.id).map(k => k.nummer.trim());
    if (!ksts.length) continue;
    const kset = new Set(ksts);
    const ts = stunden.filter(s => kset.has(s.kostenstelle.trim()));
    const tk = kosten.filter(k => kset.has(k.kostenstelle.trim()) && !k.gemeinkosten);
    const nur = new Set(t.positionen.map(p => p.id));
    const s = sollFuerMengen(projekt, erg, mengen, nur);
    const istS = stundenSumme(ts);
    const ik = kostenSplit(tk).ekt;
    if (ik.lohn === 0) ik.lohn = ts.some(x => x.lohnkosten != null) ? ts.reduce((a, x) => a + (x.lohnkosten ?? 0), 0) : istS * erg.kalkLohn;
    titel.push({ titel: t, kostenstellen: ksts, sollStunden: s.stunden, sollKosten: s.kosten, istStunden: istS, istKosten: ik, leistung: s.leistung, aufwandFaktor: s.stunden > 0 && istS > 0 ? istS / s.stunden : null });
  }

  // Verlauf (monatlich kumuliert)
  const daten = [
    ...projekt.aufmass.map(a => a.datum), ...projekt.stationierungen.map(s => s.datum),
    ...alleStunden.map(s => s.datum), ...alleKosten.map(k => k.datum),
  ].filter(Boolean).sort();
  const verlauf: VerlaufPunkt[] = [];
  if (daten.length) {
    const von = daten[0];
    const bis = stichtag ?? daten[daten.length - 1];
    if (bis >= von) {
      const sortS = [...alleStunden].sort((a, b) => a.datum.localeCompare(b.datum));
      const sortK = [...alleKosten].sort((a, b) => a.datum.localeCompare(b.datum));
      for (const d of monatsPunkte(von, bis)) {
        const m = mengenBisStichtag(projekt, d);
        const s = sollFuerMengen(projekt, erg, m);
        const gradD = auftragssumme > 0 ? s.leistung / auftragssumme : 0;
        const st = istBis(sortS, d);
        const ko = istBis(sortK, d);
        const ks = kostenSplit(ko);
        const istStd = stundenSumme(st);
        let lohn = ks.ekt.lohn;
        if (lohn === 0) lohn = st.some(x => x.lohnkosten != null) ? st.reduce((a, x) => a + (x.lohnkosten ?? 0), 0) : istStd * erg.kalkLohn;
        verlauf.push({
          datum: d, sollStunden: s.stunden, istStunden: istStd, planStunden: ps.verfuegbar ? planStundenBis(projekt, d).bis : null,
          sollKosten: splitSumme(s.kosten) + erg.bgk * gradD, istKosten: splitSumme({ ...ks.ekt, lohn }) + ks.bgk, leistung: s.leistung,
        });
      }
    }
  }

  return {
    stichtag, erg, kostenstellen: kstNummern, fremdeZeilen,
    hatStunden: stunden.length > 0, hatKosten: kosten.length > 0, hatLeistungsstand: leistung > 0,
    sollStunden: stand.stunden, sollKosten: stand.kosten, sollEkt, sollBgk, sollGesamt: sollEkt + sollBgk,
    sollStundenGesamt: gesamt.stunden, sollKostenGesamt: gesamt.kosten, sollEktGesamt: splitSumme(gesamt.kosten),
    leistung, erloes, auftragssumme, auftragssummeNachNachlass: summen.nettoNachNachlass, leistungsgrad,
    istStunden, stundenNachArt, istLohnkosten, lohnQuelle, istKosten, istEkt, istBgk, istGesamt,
    nichtZugeordneteKonten: Array.from(unbekannt.values()).sort((a, b) => a.konto.localeCompare(b.konto)),
    vergleich: vergleichListe, vergleichEkt, vergleichBgk, vergleichGesamt, vergleichStunden,
    mittellohnSoll: erg.kalkLohn, mittellohnIst, bgkSatzSoll, bgkSatzIst, zuschlagSoll, zuschlagIst, ergebnisIst, ergebnisSoll,
    hochrechnung: { art: opt.hochrechnung, prognoseKosten, prognoseErgebnis, planKosten, planErgebnis, abweichungErgebnis: prognoseErgebnis == null ? null : prognoseErgebnis - planErgebnis, restKostenPlan },
    bauzeit: { planStundenBisStichtag: ps.bis, planStundenGesamt: ps.gesamt, planEnde: ps.ende, verfuegbar: ps.verfuegbar },
    titel, verlauf,
  };
}

// ----- Erfahrungswerte zurückführen -------------------------------------------
export interface ErfahrungsAnsatz { ansatzId: string; bezeichnung: string; alt: number; neu: number }
export interface ErfahrungsPosition { positionId: string; oz: string; kurztext: string; einheit: string; ansaetze: ErfahrungsAnsatz[] }
export interface ErfahrungsEintrag {
  titelId: string | null;
  bezeichnung: string;
  faktor: number;
  sollStunden: number;
  istStunden: number;
  positionen: ErfahrungsPosition[];
}

const r4 = (v: number) => Math.round(v * 10000) / 10000;

/**
 * Vorschlag: Lohnansätze (h je Einheit) mit dem Faktor Ist/Soll-Stunden skalieren.
 * Je Titel, wenn Kostenstellen Titeln zugeordnet sind; sonst projektweit.
 */
export function erfahrungswerte(projekt: Projekt, e: NachkalkErgebnis): ErfahrungsEintrag[] {
  const eintrag = (titelId: string | null, bezeichnung: string, faktor: number, soll: number, ist: number, positionen: Position[]): ErfahrungsEintrag | null => {
    const pos = positionen.map(p => ({
      positionId: p.id, oz: p.oz, kurztext: p.kurztext, einheit: p.einheit,
      ansaetze: p.ansaetze.filter(a => a.kostenart === 'lohn' && a.menge > 0).map(a => ({ ansatzId: a.id, bezeichnung: a.bezeichnung, alt: a.menge, neu: r4(a.menge * faktor) })),
    })).filter(p => p.ansaetze.length);
    return pos.length ? { titelId, bezeichnung, faktor, sollStunden: soll, istStunden: ist, positionen: pos } : null;
  };
  const out: ErfahrungsEintrag[] = [];
  const mitFaktor = e.titel.filter(t => t.aufwandFaktor != null);
  if (mitFaktor.length) {
    for (const t of mitFaktor) {
      const x = eintrag(t.titel.id, `${t.titel.oz} ${t.titel.bezeichnung}`, t.aufwandFaktor!, t.sollStunden, t.istStunden, t.titel.positionen.filter(p => p.art !== 'H'));
      if (x) out.push(x);
    }
  } else if (e.sollStunden > 0 && e.istStunden > 0) {
    const x = eintrag(null, 'Gesamtes Projekt', e.istStunden / e.sollStunden, e.sollStunden, e.istStunden, allePositionen(projekt.lv).filter(p => p.art !== 'H'));
    if (x) out.push(x);
  }
  return out;
}

/** Vorschläge der gewählten Einträge in die Kalkulationsansätze schreiben (neues Projektobjekt) */
export function erfahrungswerteAnwenden(projekt: Projekt, eintraege: ErfahrungsEintrag[]): Projekt {
  const neu = new Map<string, number>();
  for (const e of eintraege) for (const p of e.positionen) for (const a of p.ansaetze) neu.set(a.ansatzId, a.neu);
  if (!neu.size) return projekt;
  return {
    ...projekt,
    lv: projekt.lv.map(t => ({ ...t, positionen: t.positionen.map(p => ({ ...p, ansaetze: p.ansaetze.map(a => (neu.has(a.id) ? { ...a, menge: neu.get(a.id)! } : a)) })) })),
  };
}

// ----- CSV-Export ---------------------------------------------------------------
export function nachkalkulationCsv(projekt: Projekt, e: NachkalkErgebnis): string {
  const f = (v: number | null) => (v == null ? '' : round2(v));
  const zeilen: (string | number | null)[][] = [];
  const z = (bereich: string, bez: string, soll: number | null, ist: number | null, abw: number | null, proz: number | null) => zeilen.push([bereich, bez, f(soll), f(ist), f(abw), f(proz)]);
  for (const v of e.vergleich) z('Kostenart', v.bezeichnung, v.soll, v.ist, v.abweichung, v.prozent);
  for (const v of [e.vergleichEkt, e.vergleichBgk, e.vergleichGesamt, e.vergleichStunden]) z('Summe', v.bezeichnung, v.soll, v.ist, v.abweichung, v.prozent);
  z('Kennzahl', 'Mittellohn €/h', e.mittellohnSoll, e.mittellohnIst, e.mittellohnIst == null ? null : e.mittellohnIst - e.mittellohnSoll, e.mittellohnIst == null ? null : abweichungProzent(e.mittellohnSoll, e.mittellohnIst));
  z('Kennzahl', 'BGK-Satz %', e.bgkSatzSoll, e.bgkSatzIst, null, null);
  z('Kennzahl', 'Zuschlag auf EKT %', e.zuschlagSoll, e.zuschlagIst, null, null);
  z('Leistung', 'Leistung netto (Menge × EP)', null, e.leistung, null, null);
  z('Leistung', 'Erlös nach Nachlass', null, e.erloes, null, null);
  z('Leistung', 'Auftragssumme netto', e.auftragssumme, null, null, null);
  z('Leistung', 'Leistungsgrad %', null, e.leistungsgrad == null ? null : e.leistungsgrad * 100, null, null);
  z('Ergebnis', 'Ergebnis bis Stichtag (Erlös − Kosten)', e.ergebnisSoll, e.ergebnisIst, e.ergebnisIst - e.ergebnisSoll, null);
  z('Hochrechnung', `Kosten bei Fertigstellung (${HOCHRECHNUNGS_ARTEN[e.hochrechnung.art]})`, e.hochrechnung.planKosten, e.hochrechnung.prognoseKosten, e.hochrechnung.prognoseKosten == null ? null : e.hochrechnung.prognoseKosten - e.hochrechnung.planKosten, null);
  z('Hochrechnung', 'Ergebnis bei Fertigstellung', e.hochrechnung.planErgebnis, e.hochrechnung.prognoseErgebnis, e.hochrechnung.abweichungErgebnis, null);
  if (e.bauzeit.verfuegbar) z('Bauzeit', 'Lohnstunden laut Bauzeitenplan bis Stichtag', e.bauzeit.planStundenBisStichtag, e.istStunden, e.istStunden - e.bauzeit.planStundenBisStichtag, abweichungProzent(e.bauzeit.planStundenBisStichtag, e.istStunden));
  for (const t of e.titel) z('Titel', `${t.titel.oz} ${t.titel.bezeichnung} – Stunden`, t.sollStunden, t.istStunden, t.istStunden - t.sollStunden, abweichungProzent(t.sollStunden, t.istStunden));
  for (const a of e.stundenNachArt) z('Stundenart', a.stundenart, null, a.stunden, null, null);
  const kopf = ['Bereich', 'Bezeichnung', 'Soll', 'Ist', 'Abweichung', 'Abweichung %'];
  const titelzeile = [`Nachkalkulation ${projekt.nummer} ${projekt.bezeichnung}`, `Stichtag ${e.stichtag ?? 'alle'}`, '', '', '', ''];
  return csvErzeugen(kopf, [titelzeile, ...zeilen]);
}

/** Anzeigename der Kostenart ohne Zusatz */
export const kostenartKurz = (ka: Kostenart) => KOSTENARTEN[ka].split(' ')[0];
