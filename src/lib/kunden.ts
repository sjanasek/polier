import type { Adresse, Kunde, Projekt } from '../types';
import { uid } from './format';

export const leererKunde = (kundenNr: string): Kunde => ({
  id: uid(), kundenNr, name: '', zusatz: '', strasse: '', plz: '', ort: '', telefon: '', email: '', ansprechpartner: '', ustId: '', notiz: '',
});

/** Adressfelder eines Kunden (Kopie für das Projekt) */
export const kundeAdresse = (k: Kunde): Adresse => ({
  name: k.name, zusatz: k.zusatz, strasse: k.strasse, plz: k.plz, ort: k.ort, telefon: k.telefon, email: k.email,
});

/** Nächste freie Kundennummer im Format K-0001 */
export function naechsteKundenNr(kunden: Kunde[]): string {
  const max = kunden.reduce((m, k) => {
    const n = parseInt(k.kundenNr.replace(/\D/g, ''), 10);
    return Number.isFinite(n) ? Math.max(m, n) : m;
  }, 0);
  return `K-${String(max + 1).padStart(4, '0')}`;
}

const schluessel = (a: Adresse) => `${a.name.trim().toLowerCase()}|${a.plz.trim()}`;

/**
 * Legt aus den Auftraggeber-Adressen bestehender Projekte Kunden an
 * (ohne Duplikate) und gibt die neuen Kunden sowie die Zuordnung Projekt → Kunde zurück.
 */
export function kundenAusProjekten(projekte: Projekt[], vorhanden: Kunde[]): { neu: Kunde[]; zuordnung: Map<string, string> } {
  const bekannt = new Map(vorhanden.map(k => [schluessel(k), k.id]));
  const neu: Kunde[] = [];
  const zuordnung = new Map<string, string>();
  for (const p of projekte) {
    if (p.kundeId || !p.auftraggeber.name.trim()) continue;
    const key = schluessel(p.auftraggeber);
    let id = bekannt.get(key);
    if (!id) {
      const k = { ...leererKunde(naechsteKundenNr([...vorhanden, ...neu])), ...p.auftraggeber };
      neu.push(k);
      bekannt.set(key, k.id);
      id = k.id;
    }
    zuordnung.set(p.id, id);
  }
  return { neu, zuordnung };
}

export const kundeAnzeige = (k: Kunde | undefined | null) => (k ? `${k.kundenNr} · ${k.name || 'ohne Namen'}` : '');
