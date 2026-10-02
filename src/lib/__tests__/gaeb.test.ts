// @vitest-environment jsdom
import { describe, expect, it } from 'vitest';
import { gaebExport, gaebImport, gaebZuProjekt } from '../gaeb';
import { demoProjekt } from '../demo';
import { kalkulation, lvSummen } from '../calc';
import { leereFirma } from '../defaults';

describe('GAEB DA XML', () => {
  const p = demoProjekt();
  const erg = kalkulation(p);
  const firma = leereFirma();

  it('X83 enthält Struktur ohne Preise', () => {
    const xml = gaebExport(p, firma, erg, '83');
    expect(xml).toContain('GAEB_DA_XML/DA83/3.2');
    expect(xml).toContain('<DP>83</DP>');
    expect(xml).toContain('<BoQCtgy RNoPart="01">');
    expect(xml).toContain('<Item RNoPart="0010">');
    expect(xml).not.toContain('<UP>');
    expect(xml).toContain('<Provis>WithoutTotal</Provis>');
    expect(xml).toContain('<MarkupItem>Yes</MarkupItem>');
    expect(xml).toContain('<ALNGroupNo>');
    expect(xml).toContain('<Remark>');
    // XML wohlgeformt
    const doc = new DOMParser().parseFromString(xml, 'application/xml');
    expect(doc.getElementsByTagName('parsererror').length).toBe(0);
  });

  it('X84 enthält Preise und Summen', () => {
    const xml = gaebExport(p, firma, erg, '84');
    const s = lvSummen(p, erg);
    expect(xml).toContain('<DP>84</DP>');
    expect(xml).toContain('<UP>');
    expect(xml).toContain(`<Total>${s.netto.toFixed(2)}</Total>`);
    expect(xml).toContain(`<TotalGross>${s.brutto.toFixed(2)}</TotalGross>`);
    expect(xml).toContain('<BIDDER>');
  });

  it('Roundtrip Export → Import erhält LV', () => {
    const xml = gaebExport(p, firma, erg, '84');
    const imp = gaebImport(xml);
    expect(imp.phase).toBe('84');
    expect(imp.lv.length).toBe(p.lv.length);
    expect(imp.positionen).toBe(p.lv.flatMap(t => t.positionen).filter(x => x.art !== 'H').length);
    expect(imp.mitPreisen).toBe(true);
    expect(imp.auftraggeber.name).toBe('Stadt Musterstadt');
    const orig = p.lv[1].positionen[0];
    const neu = imp.lv[1].positionen[0];
    expect(neu.oz).toBe(orig.oz);
    expect(neu.kurztext).toBe(orig.kurztext);
    expect(neu.langtext).toBe(orig.langtext);
    expect(neu.menge).toBe(orig.menge);
    expect(neu.einheit).toBe(orig.einheit);
    // Positionsarten
    const arten = imp.lv.flatMap(t => t.positionen).map(x => x.art);
    expect(arten).toContain('B');
    expect(arten).toContain('A');
    expect(arten).toContain('Z');
    expect(arten).toContain('H');
    // Preise gleich (gerundet)
    const sOrig = lvSummen(p, erg).netto;
    const q = gaebZuProjekt(p, imp);
    expect(lvSummen(q, null).netto).toBeCloseTo(sOrig, 2);
    expect(q.art).toBe('angebot');
    // neues Projekt ist frisch: keine Aufmaße/Rechnungen/Kundenzuordnung aus dem Ausgangsprojekt
    expect(q.aufmass).toHaveLength(0);
    expect(q.stationierungen).toHaveLength(0);
    expect(q.rechnungen).toHaveLength(0);
    expect(q.kundeId).toBeNull();
    expect(q.id).not.toBe(p.id);
  });

  it('Import mit verschachtelten Titeln und Sonderzeichen', () => {
    const xml = `<?xml version="1.0" encoding="UTF-8"?>
<GAEB xmlns="http://www.gaeb.de/GAEB_DA_XML/DA83/3.2"><Award><DP>83</DP><BoQ><BoQBody>
<BoQCtgy RNoPart="1"><LblTx><p><span>Los 1</span></p></LblTx><BoQBody>
  <BoQCtgy RNoPart="01"><LblTx><p><span>Erdarbeiten &amp; Verbau</span></p></LblTx><BoQBody><Itemlist>
    <Item RNoPart="0010"><Qty>12.500</Qty><QU>m3</QU><Description><CompleteText>
      <DetailTxt><Text><p><span>Zeile 1</span></p><p><span>Zeile 2 &lt;5 m&gt;</span></p></Text></DetailTxt>
      <OutlineText><OutlTxt><TextOutlTxt><span>Boden lösen</span></TextOutlTxt></OutlTxt></OutlineText>
    </CompleteText></Description></Item>
  </Itemlist></BoQBody></BoQCtgy>
</BoQBody></BoQCtgy>
</BoQBody></BoQ></Award></GAEB>`;
    const imp = gaebImport(xml);
    expect(imp.lv.length).toBe(1);
    expect(imp.lv[0].oz).toBe('1.01');
    expect(imp.lv[0].bezeichnung).toBe('Los 1 / Erdarbeiten & Verbau');
    const pos = imp.lv[0].positionen[0];
    expect(pos.oz).toBe('1.01.0010');
    expect(pos.kurztext).toBe('Boden lösen');
    expect(pos.langtext).toBe('Zeile 1\nZeile 2 <5 m>');
    expect(pos.menge).toBe(12.5);
  });

  it('Fehler bei Nicht-GAEB', () => {
    expect(() => gaebImport('<foo/>')).toThrow();
    expect(() => gaebImport('kein xml <')).toThrow();
  });
});
