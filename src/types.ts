// ---------------------------------------------------------------------------
// Domänenmodell "Polier" – Bauabrechnung
// ---------------------------------------------------------------------------

export type ID = string;

/** Positionsarten nach GAEB/VOB-Praxis */
export type PositionsArt =
  | 'N' // Normalposition
  | 'B' // Bedarfsposition (Eventualposition) – nicht in der Angebotssumme
  | 'A' // Alternativposition – nicht in der Angebotssumme
  | 'Z' // Zulageposition
  | 'H'; // Hinweistext (ohne Preis)

export const POSITIONSARTEN: Record<PositionsArt, string> = {
  N: 'Normalposition',
  B: 'Bedarfsposition',
  A: 'Alternativposition',
  Z: 'Zulageposition',
  H: 'Hinweistext',
};

export type Kostenart = 'lohn' | 'stoffe' | 'geraete' | 'fremd' | 'sonstiges';

export const KOSTENARTEN: Record<Kostenart, string> = {
  lohn: 'Lohn',
  stoffe: 'Stoffe / Material',
  geraete: 'Geräte / Maschinen',
  fremd: 'Fremdleistung / NU',
  sonstiges: 'Sonstiges',
};

export const KOSTENART_LISTE: Kostenart[] = ['lohn', 'stoffe', 'geraete', 'fremd', 'sonstiges'];

/** Einzelkosten-Ansatz je Einheit einer Position */
export interface KalkAnsatz {
  id: ID;
  kostenart: Kostenart;
  bezeichnung: string;
  /** Menge je LV-Einheit (bei Lohn: Stunden je Einheit) */
  menge: number;
  /** Preis je Ansatz-Einheit; bei Lohn 0 = Kalkulationslohn aus Stammdaten */
  preis: number;
  einheit: string;
}

export interface Position {
  id: ID;
  oz: string;
  kurztext: string;
  langtext: string;
  menge: number;
  einheit: string;
  art: PositionsArt;
  /** Einheitspreis netto. Wird bei epAusKalkulation aus den Ansätzen berechnet. */
  ep: number;
  epAusKalkulation: boolean;
  ansaetze: KalkAnsatz[];
}

export interface Titel {
  id: ID;
  oz: string;
  bezeichnung: string;
  vorbemerkung: string;
  positionen: Position[];
}

// ---------------------------------------------------------------------------
// Aufmaß
// ---------------------------------------------------------------------------

export interface AufmassZeile {
  id: ID;
  blattNr: string;
  datum: string; // ISO yyyy-mm-dd
  positionId: ID;
  /** Formelnummer aus dem Katalog (REB 23.003) oder 'F' für freie Formel */
  formelNr: string;
  /** Parameterwerte a, b, c, ... */
  werte: number[];
  freieFormel: string;
  /** Anzahl / Multiplikator */
  faktor: number;
  /** Abzug (negatives Vorzeichen) */
  abzug: boolean;
  bemerkung: string;
}

export type StationsModus =
  | 'laenge' // nur Länge zwischen Stationen
  | 'flaeche' // Wert = Breite → Fläche
  | 'volumen' // Wert = Querschnittsfläche → Volumen
  | 'volumenBT'; // Wert = Breite, Wert2 = Tiefe → Querschnitt = B×T → Volumen

export const STATIONS_MODI: Record<StationsModus, string> = {
  laenge: 'Länge (m)',
  flaeche: 'Fläche aus Breite (m²)',
  volumen: 'Volumen aus Querschnittsfläche (m³)',
  volumenBT: 'Volumen aus Breite × Tiefe (m³)',
};

export interface StationsProfil {
  id: ID;
  /** Station in m (Darstellung km+m: 0+125,50) */
  station: number;
  wert: number;
  wert2: number;
  bemerkung: string;
}

export interface Stationierung {
  id: ID;
  blattNr: string;
  datum: string;
  positionId: ID;
  bezeichnung: string;
  modus: StationsModus;
  faktor: number;
  abzug: boolean;
  profile: StationsProfil[];
  bemerkung: string;
}

// ---------------------------------------------------------------------------
// Rechnungen (kumulativ)
// ---------------------------------------------------------------------------

export type RechnungsTyp = 'abschlag' | 'teilschluss' | 'schluss';
export type RechnungsStatus = 'entwurf' | 'gestellt' | 'bezahlt';

export interface Zahlung {
  id: ID;
  datum: string;
  betrag: number;
  bemerkung: string;
}

export interface SonstigerAbzug {
  id: ID;
  bezeichnung: string;
  betrag: number;
}

export interface RechnungsSnapshotPosition {
  positionId: ID;
  mengeKum: number;
}

export interface Rechnung {
  id: ID;
  /** laufende Nummer (1, 2, 3 ...) */
  lfdNr: number;
  rechnungsNr: string;
  typ: RechnungsTyp;
  datum: string;
  /** Leistungsstand bis einschl. */
  stichtag: string;
  status: RechnungsStatus;
  nachlassProzent: number;
  sicherheitseinbehaltProzent: number;
  skontoProzent: number;
  skontoTage: number;
  zahlungszielTage: number;
  reverseCharge: boolean; // §13b UStG
  sonstigeAbzuege: SonstigerAbzug[];
  zahlungen: Zahlung[];
  /** Mengen eingefroren beim Stellen der Rechnung */
  snapshot: RechnungsSnapshotPosition[] | null;
  bemerkung: string;
}

// ---------------------------------------------------------------------------
// Kalkulation
// ---------------------------------------------------------------------------

export type KalkMethode = 'zuschlag' | 'endsumme';

export interface ZuschlagDetail {
  bgk: number; // Baustellengemeinkosten %
  agk: number; // Allgemeine Geschäftskosten %
  wug: number; // Wagnis & Gewinn %
}

export interface BgkPosten {
  id: ID;
  bezeichnung: string;
  betrag: number;
}

export interface KalkParameter {
  methode: KalkMethode;
  /** Mittellohnberechnung */
  grundlohn: number; // €/h Mittellohn (Grundlohn, gewichtet)
  zulagenProzent: number; // Zulagen (Erschwernis, Vorarbeiter, …)
  sozialkostenProzent: number; // lohngebundene Kosten
  lohnnebenkostenProzent: number; // Auslösung, Fahrtkosten, …
  /** Zuschlagskalkulation: detaillierte Zuschläge je Kostenart */
  zuschlaege: Record<Kostenart, ZuschlagDetail>;
  /** Endsummenkalkulation */
  bgkPosten: BgkPosten[];
  agkProzent: number; // in % der Angebotssumme
  wugProzent: number; // in % der Angebotssumme
  /** Gewichtung der Umlage auf die Kostenarten (1 = voll, 0,5 = halb, 0 = keine Umlage) */
  umlageGewichte: Record<Kostenart, number>;
  /** Optional: Angebotsendsumme vorgeben (netto). 0 = aus AGK/W&G berechnen */
  zielSumme: number;
}

// ---------------------------------------------------------------------------
// Projekt
// ---------------------------------------------------------------------------

export interface Adresse {
  name: string;
  zusatz: string;
  strasse: string;
  plz: string;
  ort: string;
  telefon: string;
  email: string;
}

export type ProjektArt = 'angebot' | 'ausschreibung' | 'auftrag';

export const PROJEKT_ARTEN: Record<ProjektArt, string> = {
  angebot: 'Angebot',
  ausschreibung: 'Ausschreibung',
  auftrag: 'Auftrag / Abrechnung',
};

export interface Projekt {
  id: ID;
  /** Verknüpfung zum Adressbuch (optional). Die Adresse unter auftraggeber ist eine Kopie. */
  kundeId?: ID | null;
  nummer: string;
  bezeichnung: string;
  art: ProjektArt;
  bauvorhaben: string;
  bauort: string;
  datum: string;
  auftraggeber: Adresse;
  mwstProzent: number;
  nachlassProzent: number;
  skontoProzent: number;
  skontoTage: number;
  sicherheitseinbehaltProzent: number;
  zahlungszielTage: number;
  vorbemerkungen: string;
  lv: Titel[];
  kalk: KalkParameter;
  aufmass: AufmassZeile[];
  stationierungen: Stationierung[];
  rechnungen: Rechnung[];
  angelegt: string;
}

export interface Firma extends Adresse {
  inhaber: string;
  bank: string;
  iban: string;
  bic: string;
  ustId: string;
  steuerNr: string;
}

/** Kunde / Auftraggeber im Adressbuch */
export interface Kunde extends Adresse {
  id: ID;
  kundenNr: string;
  ansprechpartner: string;
  ustId: string;
  notiz: string;
}

export interface GeraetStamm {
  id: ID;
  bezeichnung: string;
  stundensatz: number;
}

export interface MaterialStamm {
  id: ID;
  bezeichnung: string;
  einheit: string;
  preis: number;
}

export interface Stammdaten {
  firma: Firma;
  kunden: Kunde[];
  geraete: GeraetStamm[];
  material: MaterialStamm[];
  einheiten: string[];
}
