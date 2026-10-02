import type { Adresse, Firma, KalkParameter, Position, Projekt, Rechnung, Stammdaten, Titel } from '../types';
import { heute, uid } from './format';

export const leereAdresse = (): Adresse => ({ name: '', zusatz: '', strasse: '', plz: '', ort: '', telefon: '', email: '' });

export const leereFirma = (): Firma => ({ ...leereAdresse(), name: 'Muster Tiefbau GmbH', strasse: 'Bauhofstraße 1', plz: '12345', ort: 'Musterstadt', inhaber: '', bank: '', iban: '', bic: '', ustId: '', steuerNr: '' });

export const EINHEITEN = ['m', 'm²', 'm³', 'St', 'psch', 'h', 't', 'kg', 'Tag', 'Wo', 'Mon', 'l'];

export const standardKalk = (): KalkParameter => ({
  methode: 'endsumme',
  grundlohn: 22.5,
  zulagenProzent: 8,
  sozialkostenProzent: 92,
  lohnnebenkostenProzent: 6,
  zuschlaege: {
    lohn: { bgk: 18, agk: 12, wug: 5 },
    stoffe: { bgk: 6, agk: 8, wug: 3 },
    geraete: { bgk: 8, agk: 10, wug: 4 },
    fremd: { bgk: 3, agk: 5, wug: 2 },
    sonstiges: { bgk: 5, agk: 8, wug: 3 },
  },
  bgkPosten: [
    { id: uid(), bezeichnung: 'Baustelleneinrichtung / Räumung', betrag: 4500 },
    { id: uid(), bezeichnung: 'Bauleitung / Polier (anteilig)', betrag: 6000 },
    { id: uid(), bezeichnung: 'Bauwasser / Baustrom / Container', betrag: 1800 },
  ],
  agkProzent: 9,
  wugProzent: 4,
  umlageGewichte: { lohn: 1, stoffe: 1, geraete: 1, fremd: 0.5, sonstiges: 1 },
  zielSumme: 0,
});

export const neuePosition = (oz: string): Position => ({
  id: uid(), oz, kurztext: '', langtext: '', menge: 0, einheit: 'm', art: 'N', ep: 0, epAusKalkulation: false, ansaetze: [],
});

export const neuerTitel = (oz: string): Titel => ({ id: uid(), oz, bezeichnung: 'Neuer Titel', vorbemerkung: '', positionen: [] });

export const neueRechnung = (p: Projekt, lfdNr: number): Rechnung => ({
  id: uid(),
  lfdNr,
  rechnungsNr: `${new Date().getFullYear()}-${p.nummer || '000'}-${String(lfdNr).padStart(2, '0')}`,
  typ: 'abschlag',
  datum: heute(),
  stichtag: heute(),
  status: 'entwurf',
  nachlassProzent: p.nachlassProzent,
  sicherheitseinbehaltProzent: p.sicherheitseinbehaltProzent,
  skontoProzent: p.skontoProzent,
  skontoTage: p.skontoTage,
  zahlungszielTage: p.zahlungszielTage,
  reverseCharge: false,
  sonstigeAbzuege: [],
  zahlungen: [],
  snapshot: null,
  bemerkung: '',
});

export const neuesProjekt = (nummer: string): Projekt => ({
  id: uid(),
  nummer,
  bezeichnung: 'Neues Projekt',
  art: 'angebot',
  bauvorhaben: '',
  bauort: '',
  datum: heute(),
  auftraggeber: leereAdresse(),
  mwstProzent: 19,
  nachlassProzent: 0,
  skontoProzent: 0,
  skontoTage: 14,
  sicherheitseinbehaltProzent: 5,
  zahlungszielTage: 30,
  vorbemerkungen: '',
  lv: [],
  kalk: standardKalk(),
  aufmass: [],
  stationierungen: [],
  rechnungen: [],
  angelegt: heute(),
});

export const standardStammdaten = (): Stammdaten => ({
  firma: leereFirma(),
  geraete: [
    { id: uid(), bezeichnung: 'Bagger 14 t (inkl. Betriebsstoffe)', stundensatz: 48 },
    { id: uid(), bezeichnung: 'Radlader 8 t', stundensatz: 38 },
    { id: uid(), bezeichnung: 'LKW 3-Achser', stundensatz: 55 },
    { id: uid(), bezeichnung: 'Rüttelplatte 400 kg', stundensatz: 6.5 },
    { id: uid(), bezeichnung: 'Grabenverbau (Tagessatz)', stundensatz: 12 },
  ],
  material: [
    { id: uid(), bezeichnung: 'Schotter 0/32', einheit: 't', preis: 14.5 },
    { id: uid(), bezeichnung: 'Sand 0/2 (Bettung)', einheit: 't', preis: 16 },
    { id: uid(), bezeichnung: 'Beton C25/30', einheit: 'm³', preis: 118 },
    { id: uid(), bezeichnung: 'KG-Rohr DN 200', einheit: 'm', preis: 22.5 },
    { id: uid(), bezeichnung: 'Asphalttragschicht AC 22 T', einheit: 't', preis: 68 },
    { id: uid(), bezeichnung: 'Betonbordstein 15/30', einheit: 'm', preis: 7.8 },
  ],
  einheiten: EINHEITEN,
});
