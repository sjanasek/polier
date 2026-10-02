import { describe, expect, it } from 'vitest';
import { kundeAdresse, kundenAusProjekten, leererKunde, naechsteKundenNr } from '../kunden';
import { demoKunden, demoProjekt, DEMO_KUNDE_ID } from '../demo';
import { neuesProjekt } from '../defaults';

describe('Adressverwaltung', () => {
  it('Kundennummern zählen hoch', () => {
    expect(naechsteKundenNr([])).toBe('K-0001');
    expect(naechsteKundenNr(demoKunden())).toBe('K-0003');
    expect(naechsteKundenNr([{ ...leererKunde('X'), kundenNr: 'K-0099' }])).toBe('K-0100');
  });
  it('Adresse wird aus Kunde kopiert', () => {
    const k = demoKunden()[0];
    const a = kundeAdresse(k);
    expect(a.name).toBe('Stadt Musterstadt');
    expect(a).not.toHaveProperty('kundenNr');
  });
  it('Demoprojekt ist mit Demokunde verknüpft', () => {
    expect(demoProjekt().kundeId).toBe(DEMO_KUNDE_ID);
  });
  it('Kunden aus Projekten ohne Duplikate', () => {
    const a = neuesProjekt('1'); a.auftraggeber.name = 'Firma A'; a.auftraggeber.plz = '11111';
    const b = neuesProjekt('2'); b.auftraggeber.name = 'firma a'; b.auftraggeber.plz = '11111';
    const c = neuesProjekt('3'); c.auftraggeber.name = 'Firma C';
    const leer = neuesProjekt('4');
    const bereits = neuesProjekt('5'); bereits.kundeId = 'x'; bereits.auftraggeber.name = 'Firma Z';
    const { neu, zuordnung } = kundenAusProjekten([a, b, c, leer, bereits], []);
    expect(neu.map(k => k.kundenNr)).toEqual(['K-0001', 'K-0002']);
    expect(zuordnung.get(a.id)).toBe(zuordnung.get(b.id));
    expect(zuordnung.has(leer.id)).toBe(false);
    expect(zuordnung.has(bereits.id)).toBe(false);
  });
});
