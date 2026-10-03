// ---------------------------------------------------------------------------
// Generischer Import von Arbeitszeiten (Lohnabrechnung) und Kosten (Finanz-
// buchhaltung) aus CSV-Exporten. Die Exportlayouts der Fremdsysteme (z. B. BRZ
// Baulohn / BRZ Finanzbuchhaltung) sind nicht bekannt; die Zuordnung der Spalten
// erfolgt daher konfigurierbar über Profile. Hier liegt nur die Fachlogik,
// keine UI.
// ---------------------------------------------------------------------------
import type {
  ImportFehler, ImportProfil, ImportProtokoll, ImportQuelle, Kostenart, KostenZeile, KontenRegel, Nachkalkulation, StundenZeile,
} from '../types';
import type { CsvTabelle } from './csv';
import { parseDatum, parseZahl } from './csv';
import { round2, uid } from './format';

// ----- Zielfelder ------------------------------------------------------------
export interface ZielFeld {
  key: string;
  label: string;
  pflicht: boolean;
  /** Suchbegriffe für den Vorschlag anhand der Spaltenüberschrift (normalisiert, Teilstring) */
  synonyme: string[];
  hinweis?: string;
}

export const BAULOHN_FELDER: ZielFeld[] = [
  { key: 'datum', label: 'Datum', pflicht: true, synonyme: ['datum', 'tag', 'date', 'leistungsdatum', 'arbeitstag'] },
  { key: 'kostenstelle', label: 'Kostenstelle / Baustelle', pflicht: true, synonyme: ['kostenstelle', 'kost', 'baustelle', 'bst', 'projekt', 'objekt'] },
  { key: 'stunden', label: 'Stunden', pflicht: true, synonyme: ['stunden', 'std', 'anzahl', 'menge', 'zeit', 'hours'] },
  { key: 'stundenart', label: 'Lohnart / Stundenart', pflicht: false, synonyme: ['lohnart', 'stundenart', 'la', 'art', 'zeitart', 'zuschlag'], hinweis: 'z. B. Normal, Überstunden, Zuschlag' },
  { key: 'lohnkosten', label: 'Lohnkosten €', pflicht: false, synonyme: ['lohnkosten', 'betrag', 'kosten', 'brutto', 'lohn', 'eur', 'wert'], hinweis: 'falls im Export enthalten' },
  { key: 'mitarbeiterNr', label: 'Mitarbeiter-Nr.', pflicht: false, synonyme: ['personalnummer', 'persnr', 'pers', 'mitarbeiternr', 'manr', 'arbeitnehmer', 'anr'] },
  { key: 'mitarbeiterName', label: 'Mitarbeiter Name', pflicht: false, synonyme: ['name', 'mitarbeiter', 'arbeitnehmer'] },
  { key: 'kostentraeger', label: 'Kostenträger / Teilleistung', pflicht: false, synonyme: ['kostentraeger', 'kostentrager', 'ktr', 'teilleistung', 'leistung', 'taetigkeit', 'tatigkeit', 'position'] },
];

export const FIBU_FELDER: ZielFeld[] = [
  { key: 'datum', label: 'Buchungsdatum', pflicht: true, synonyme: ['buchungsdatum', 'datum', 'belegdatum', 'date', 'bu-dat', 'budat'] },
  { key: 'kostenstelle', label: 'Kostenstelle', pflicht: true, synonyme: ['kostenstelle', 'kost', 'kst', 'baustelle', 'projekt', 'objekt'] },
  { key: 'konto', label: 'Konto', pflicht: true, synonyme: ['konto', 'sachkonto', 'kontonummer', 'kto', 'account'] },
  { key: 'kontoBezeichnung', label: 'Kontobezeichnung', pflicht: false, synonyme: ['kontobezeichnung', 'kontoname', 'bezeichnung', 'kontotext'] },
  { key: 'betrag', label: 'Betrag', pflicht: true, synonyme: ['betrag', 'umsatz', 'netto', 'wert', 'amount', 'summe', 'eur'] },
  { key: 'sollHaben', label: 'Soll/Haben-Kennzeichen', pflicht: false, synonyme: ['soll/haben', 'sollhaben', 's/h', 'sh', 'kennzeichen', 'bu-kz', 'buchungskennzeichen'], hinweis: 'Haben bei Kostenkonten = Storno/Gutschrift' },
  { key: 'kostenartText', label: 'Kostenart (Text)', pflicht: false, synonyme: ['kostenart', 'kostengruppe', 'kostenartbezeichnung', 'kategorie'] },
  { key: 'belegNr', label: 'Belegnummer', pflicht: false, synonyme: ['beleg', 'belegnr', 'belegnummer', 'rechnungsnr', 'rechnung', 'beleg-nr'] },
  { key: 'buchungstext', label: 'Buchungstext', pflicht: false, synonyme: ['buchungstext', 'text', 'verwendungszweck', 'bemerkung', 'lieferant', 'kreditor'] },
  { key: 'kostentraeger', label: 'Kostenträger', pflicht: false, synonyme: ['kostentraeger', 'kostentrager', 'ktr', 'teilleistung', 'auftrag'] },
];

export const felderFuer = (q: ImportQuelle): ZielFeld[] => (q === 'baulohn' ? BAULOHN_FELDER : FIBU_FELDER);

/** Überschrift normalisieren: Kleinbuchstaben, Umlaute, keine Sonderzeichen */
export const normKopf = (s: string) =>
  s.toLowerCase().replace(/ä/g, 'ae').replace(/ö/g, 'oe').replace(/ü/g, 'ue').replace(/ß/g, 'ss').replace(/[^a-z0-9/]/g, '');

/** Vorschlag für die Zuordnung Zielfeld → Spaltenüberschrift anhand von Synonymen (exakter Treffer vor Teilstring) */
export function vorschlagZuordnung(kopf: string[], quelle: ImportQuelle): Record<string, string> {
  const out: Record<string, string> = {};
  const belegt = new Set<string>();
  const normiert = kopf.map(h => ({ h, n: normKopf(h) })).filter(x => x.h);
  const felder = felderFuer(quelle);
  // 1. Durchgang: exakte Treffer
  for (const f of felder) {
    const hit = normiert.find(x => !belegt.has(x.h) && f.synonyme.some(s => normKopf(s) === x.n));
    if (hit) { out[f.key] = hit.h; belegt.add(hit.h); }
  }
  // 2. Durchgang: Teilstring
  for (const f of felder) {
    if (out[f.key]) continue;
    const hit = normiert.find(x => !belegt.has(x.h) && f.synonyme.some(s => x.n.includes(normKopf(s))));
    if (hit) { out[f.key] = hit.h; belegt.add(hit.h); }
  }
  return out;
}

/** Fehlende Pflichtfelder einer Zuordnung */
export function fehlendePflichtfelder(zuordnung: Record<string, string>, quelle: ImportQuelle, kopf: string[]): string[] {
  return felderFuer(quelle).filter(f => f.pflicht && (!zuordnung[f.key] || !kopf.includes(zuordnung[f.key]))).map(f => f.label);
}

export const neuesProfil = (quelle: ImportQuelle, name = ''): ImportProfil => ({
  id: uid(), name: name || (quelle === 'baulohn' ? 'Baulohn-Export' : 'FiBu-Export'), quelle, zuordnung: {}, habenWerte: 'H, Haben, C', ausgeschlosseneStundenarten: '',
});

// ----- Kontenregeln ------------------------------------------------------------
export const neueKontenRegel = (patch: Partial<KontenRegel> = {}): KontenRegel => ({
  id: uid(), vonKonto: '', bisKonto: '', kostenartText: '', kostenart: 'sonstiges', gemeinkosten: false, bezeichnung: '', ...patch,
});

/**
 * Vorschlag nach gängigen Kontenrahmen. Ausdrücklich ohne Gewähr: Der tatsächliche
 * Kontenplan des Betriebs ist maßgeblich, die Bereiche sind vor dem Einsatz zu prüfen.
 */
export function standardKontenRegeln(rahmen: 'skr03' | 'skr04'): KontenRegel[] {
  const r = (von: string, bis: string, kostenart: Kostenart, bezeichnung: string, gemeinkosten = false) => neueKontenRegel({ vonKonto: von, bisKonto: bis, kostenart, bezeichnung, gemeinkosten });
  if (rahmen === 'skr03') {
    return [
      r('3000', '3099', 'stoffe', 'Roh-, Hilfs- und Betriebsstoffe'),
      r('3100', '3199', 'fremd', 'Fremdleistungen / Nachunternehmer'),
      r('3200', '3999', 'stoffe', 'Wareneingang / Material'),
      r('4100', '4199', 'lohn', 'Löhne und Gehälter'),
      r('4200', '4299', 'sonstiges', 'Raumkosten', true),
      r('4500', '4599', 'geraete', 'Fahrzeugkosten'),
      r('4800', '4899', 'geraete', 'Reparaturen / Instandhaltung Maschinen'),
      r('4900', '4999', 'sonstiges', 'Sonstige betriebliche Kosten', true),
      neueKontenRegel({ kostenartText: 'miete', kostenart: 'geraete', bezeichnung: 'Gerätemiete (Textabgleich)' }),
      neueKontenRegel({ kostenartText: 'nachunternehmer', kostenart: 'fremd', bezeichnung: 'NU (Textabgleich)' }),
    ];
  }
  return [
    r('5000', '5099', 'stoffe', 'Roh-, Hilfs- und Betriebsstoffe'),
    r('5100', '5199', 'stoffe', 'Wareneingang / Material'),
    r('5900', '5999', 'fremd', 'Fremdleistungen / Nachunternehmer'),
    r('6000', '6099', 'lohn', 'Löhne'),
    r('6100', '6199', 'lohn', 'Sozialabgaben / Lohnnebenkosten'),
    r('6300', '6399', 'sonstiges', 'Raumkosten', true),
    r('6500', '6599', 'geraete', 'Fahrzeugkosten'),
    r('6800', '6899', 'sonstiges', 'Sonstige betriebliche Kosten', true),
    neueKontenRegel({ kostenartText: 'miete', kostenart: 'geraete', bezeichnung: 'Gerätemiete (Textabgleich)' }),
    neueKontenRegel({ kostenartText: 'nachunternehmer', kostenart: 'fremd', bezeichnung: 'NU (Textabgleich)' }),
  ];
}

const kontoNum = (s: string): number | null => {
  const t = s.trim().replace(/\D/g, '');
  return t ? Number(t) : null;
};

/** Konto und Kostenart-Text gegen die Regeln prüfen. Erste passende Regel gewinnt. */
export function kontoZuordnen(konto: string, kostenartText: string, regeln: KontenRegel[]): KontenRegel | null {
  const k = kontoNum(konto);
  const txt = kostenartText.trim().toLowerCase();
  for (const r of regeln) {
    const hatBereich = r.vonKonto.trim() !== '' || r.bisKonto.trim() !== '';
    const hatText = r.kostenartText.trim() !== '';
    if (!hatBereich && !hatText) continue;
    let ok = true;
    if (hatBereich) {
      const von = kontoNum(r.vonKonto) ?? -Infinity, bis = kontoNum(r.bisKonto) ?? (kontoNum(r.vonKonto) ?? Infinity);
      ok = k != null && k >= von && k <= bis;
    }
    if (ok && hatText) ok = txt !== '' && txt.includes(r.kostenartText.trim().toLowerCase());
    if (ok) return r;
  }
  return null;
}

// ----- Hash / Duplikate --------------------------------------------------------
/** Kurzer, deterministischer Hash (FNV-1a, 32 Bit) für den Duplikatschutz */
export function zeilenHash(teile: (string | number)[]): string {
  const s = teile.map(t => String(t).trim().toLowerCase()).join('\u001f');
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  return h.toString(16).padStart(8, '0') + s.length.toString(36);
}

export type ImportModus = 'ergaenzen' | 'ersetzen';

export interface ImportOptionen {
  quelle: ImportQuelle;
  datei: string;
  profil: ImportProfil;
  /** Baulohn: personenbezogene Felder speichern (Standard: nein, nur aggregiert) */
  personenbezogen: boolean;
  /** ergaenzen = Duplikate (gleicher Hash) überspringen; ersetzen = vorhandene Zeilen derselben Quelle im Zeitraum und den Kostenstellen der Datei löschen */
  modus: ImportModus;
  regeln: KontenRegel[];
  jetzt?: string;
}

export interface ImportErgebnis {
  protokoll: ImportProtokoll;
  stunden: StundenZeile[];
  kosten: KostenZeile[];
  /** Ersetzte Zeilen (IDs), bei Modus "ersetzen" */
  geloeschteIds: string[];
}

const liste = (s: string) => s.split(/[,;]/).map(x => x.trim().toLowerCase()).filter(Boolean);

/** Spaltenwert einer Zeile über die Zuordnung lesen */
function wert(tab: CsvTabelle, zeile: string[], zuordnung: Record<string, string>, key: string): string {
  const spalte = zuordnung[key];
  if (!spalte) return '';
  const idx = tab.kopf.indexOf(spalte);
  return idx >= 0 ? (zeile[idx] ?? '').trim() : '';
}

/**
 * Import ausführen. Reine Funktion: liefert neue Zeilen und Protokoll; der Aufrufer
 * schreibt sie in das Projekt (importUebernehmen).
 */
export function importAusfuehren(tab: CsvTabelle, nk: Nachkalkulation, opt: ImportOptionen): ImportErgebnis {
  const importId = uid();
  const fehler: ImportFehler[] = [];
  const z = opt.profil.zuordnung;
  const fehlend = fehlendePflichtfelder(z, opt.quelle, tab.kopf);
  const protokoll: ImportProtokoll = {
    id: importId, quelle: opt.quelle, datei: opt.datei, importiertAm: opt.jetzt ?? new Date().toISOString(), profilName: opt.profil.name,
    zeilenGelesen: tab.zeilen.length, uebernommen: 0, uebersprungen: 0, ersetzt: 0, fehler, personenbezogen: opt.quelle === 'baulohn' && opt.personenbezogen,
    von: '', bis: '', kostenstellen: [], nichtZugeordneteKonten: [],
  };
  if (fehlend.length) {
    fehler.push({ zeile: 0, text: `Pflichtfelder nicht zugeordnet: ${fehlend.join(', ')}` });
    return { protokoll, stunden: [], kosten: [], geloeschteIds: [] };
  }

  const kostenstellen = new Set<string>();
  let von = '', bis = '';
  const merkeDatum = (d: string) => { if (!von || d < von) von = d; if (!bis || d > bis) bis = d; };

  let stunden: StundenZeile[] = [];
  let kosten: KostenZeile[] = [];

  if (opt.quelle === 'baulohn') {
    const ausgeschlossen = liste(opt.profil.ausgeschlosseneStundenarten);
    const agg = new Map<string, StundenZeile>();
    tab.zeilen.forEach((row, i) => {
      const nr = i + 2; // Zeilennummer in der Datei (Kopf = 1)
      const datum = parseDatum(wert(tab, row, z, 'datum'));
      const kst = wert(tab, row, z, 'kostenstelle');
      const std = parseZahl(wert(tab, row, z, 'stunden'));
      if (!datum) { fehler.push({ zeile: nr, text: `Datum nicht lesbar: „${wert(tab, row, z, 'datum')}“` }); return; }
      if (!kst) { fehler.push({ zeile: nr, text: 'Kostenstelle fehlt' }); return; }
      if (std == null) { fehler.push({ zeile: nr, text: `Stunden nicht lesbar: „${wert(tab, row, z, 'stunden')}“` }); return; }
      const stundenart = wert(tab, row, z, 'stundenart');
      if (ausgeschlossen.length && ausgeschlossen.some(a => stundenart.toLowerCase().includes(a))) { protokoll.uebersprungen++; return; }
      const lohnTxt = wert(tab, row, z, 'lohnkosten');
      const lohnkosten = z.lohnkosten ? parseZahl(lohnTxt) : null;
      const maNr = opt.personenbezogen ? wert(tab, row, z, 'mitarbeiterNr') : '';
      const maName = opt.personenbezogen ? wert(tab, row, z, 'mitarbeiterName') : '';
      const ktr = wert(tab, row, z, 'kostentraeger');
      const key = [datum, kst, stundenart, ktr, maNr, maName].join('|');
      const vorhanden = agg.get(key);
      if (vorhanden) {
        vorhanden.stunden = round2(vorhanden.stunden + std);
        if (lohnkosten != null) vorhanden.lohnkosten = round2((vorhanden.lohnkosten ?? 0) + lohnkosten);
      } else {
        agg.set(key, { id: uid(), importId, datum, kostenstelle: kst, stundenart, stunden: round2(std), lohnkosten: lohnkosten == null ? null : round2(lohnkosten), mitarbeiterNr: maNr, mitarbeiterName: maName, kostentraeger: ktr, hash: '' });
      }
      kostenstellen.add(kst);
      merkeDatum(datum);
    });
    stunden = Array.from(agg.values()).map(s => ({ ...s, hash: zeilenHash([s.datum, s.kostenstelle, s.stundenart, s.kostentraeger, s.mitarbeiterNr, s.stunden, s.lohnkosten ?? '']) }));
  } else {
    const habenWerte = liste(opt.profil.habenWerte);
    const unbekannt = new Set<string>();
    tab.zeilen.forEach((row, i) => {
      const nr = i + 2;
      const datum = parseDatum(wert(tab, row, z, 'datum'));
      const kst = wert(tab, row, z, 'kostenstelle');
      const konto = wert(tab, row, z, 'konto');
      let betrag = parseZahl(wert(tab, row, z, 'betrag'));
      if (!datum) { fehler.push({ zeile: nr, text: `Buchungsdatum nicht lesbar: „${wert(tab, row, z, 'datum')}“` }); return; }
      if (!kst) { fehler.push({ zeile: nr, text: 'Kostenstelle fehlt' }); return; }
      if (!konto) { fehler.push({ zeile: nr, text: 'Konto fehlt' }); return; }
      if (betrag == null) { fehler.push({ zeile: nr, text: `Betrag nicht lesbar: „${wert(tab, row, z, 'betrag')}“` }); return; }
      const sh = wert(tab, row, z, 'sollHaben').toLowerCase();
      // Haben auf Kostenkonten = Gutschrift/Storno → negative Kosten. Betrag wird als Absolutwert gelesen,
      // wenn ein Kennzeichen vorhanden ist; ohne Kennzeichen gilt das Vorzeichen des Exports.
      if (sh) betrag = habenWerte.includes(sh) ? -Math.abs(betrag) : Math.abs(betrag);
      const kostenartText = wert(tab, row, z, 'kostenartText');
      const regel = kontoZuordnen(konto, kostenartText, opt.regeln);
      if (!regel) unbekannt.add(konto);
      const zeile: KostenZeile = {
        id: uid(), importId, datum, kostenstelle: kst, konto, kontoBezeichnung: wert(tab, row, z, 'kontoBezeichnung'), betrag: round2(betrag),
        kostenart: regel?.kostenart ?? 'sonstiges', zugeordnet: !!regel, gemeinkosten: regel?.gemeinkosten ?? false, kostenartText,
        belegNr: wert(tab, row, z, 'belegNr'), buchungstext: wert(tab, row, z, 'buchungstext'), kostentraeger: wert(tab, row, z, 'kostentraeger'), hash: '',
      };
      zeile.hash = zeilenHash([zeile.datum, zeile.kostenstelle, zeile.konto, zeile.betrag, zeile.belegNr, zeile.buchungstext, zeile.kostentraeger]);
      kosten.push(zeile);
      kostenstellen.add(kst);
      merkeDatum(datum);
    });
    protokoll.nichtZugeordneteKonten = Array.from(unbekannt).sort();
  }

  protokoll.von = von;
  protokoll.bis = bis;
  protokoll.kostenstellen = Array.from(kostenstellen).sort();

  // Duplikate / Ersetzen
  let geloeschteIds: string[] = [];
  if (opt.modus === 'ersetzen' && von) {
    const alt = opt.quelle === 'baulohn' ? nk.stunden : nk.kosten;
    geloeschteIds = alt.filter(x => kostenstellen.has(x.kostenstelle) && x.datum >= von && x.datum <= bis).map(x => x.id);
    protokoll.ersetzt = geloeschteIds.length;
  }
  const geloescht = new Set(geloeschteIds);
  const bekannt = new Set((opt.quelle === 'baulohn' ? nk.stunden : nk.kosten).filter(x => !geloescht.has(x.id)).map(x => x.hash));
  const dedupe = <T extends { hash: string }>(arr: T[]): T[] => {
    const out: T[] = [];
    for (const x of arr) {
      if (bekannt.has(x.hash)) { protokoll.uebersprungen++; continue; }
      bekannt.add(x.hash);
      out.push(x);
    }
    return out;
  };
  stunden = dedupe(stunden);
  kosten = dedupe(kosten);
  protokoll.uebernommen = stunden.length + kosten.length;
  return { protokoll, stunden, kosten, geloeschteIds };
}

/** Importergebnis in die Nachkalkulation eines Projekts übernehmen */
export function importUebernehmen(nk: Nachkalkulation, e: ImportErgebnis): Nachkalkulation {
  const weg = new Set(e.geloeschteIds);
  return {
    ...nk,
    stunden: [...nk.stunden.filter(x => !weg.has(x.id)), ...e.stunden],
    kosten: [...nk.kosten.filter(x => !weg.has(x.id)), ...e.kosten],
    importe: [...nk.importe, e.protokoll],
  };
}

/** Einen Import samt seiner Zeilen entfernen */
export function importLoeschen(nk: Nachkalkulation, importId: string): Nachkalkulation {
  return {
    ...nk,
    stunden: nk.stunden.filter(x => x.importId !== importId),
    kosten: nk.kosten.filter(x => x.importId !== importId),
    importe: nk.importe.filter(x => x.id !== importId),
  };
}

/** Kostenzeilen nach geänderten Regeln neu zuordnen (ohne Neuimport) */
export function kostenNeuZuordnen(nk: Nachkalkulation, regeln: KontenRegel[]): Nachkalkulation {
  return {
    ...nk,
    kosten: nk.kosten.map(k => {
      const r = kontoZuordnen(k.konto, k.kostenartText, regeln);
      return { ...k, kostenart: r?.kostenart ?? 'sonstiges', zugeordnet: !!r, gemeinkosten: r?.gemeinkosten ?? false };
    }),
  };
}
