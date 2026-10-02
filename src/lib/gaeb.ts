// ---------------------------------------------------------------------------
// GAEB DA XML 3.2 – Export (X83 Ausschreibung, X84 Angebot) und Import (X81–X86)
// Nur der Standardumfang: Titel (BoQCtgy), Positionen (Item) mit Kurz-/Langtext,
// Menge, Einheit, Positionsart, optional Preise. Alles weitere wird beim
// Import ignoriert, beim Export nicht erzeugt.
// ---------------------------------------------------------------------------
import type { Adresse, Firma, Projekt, Titel } from '../types';
import { neuePosition, neuerTitel, neuesProjekt } from './defaults';
import { effektiverEP, lvSummen, type KalkErgebnis } from './calc';
import { uid } from './format';

export type GaebPhase = '83' | '84';

const esc = (s: string) =>
  String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

const dec = (n: number, digits: number) => (Number.isFinite(n) ? n : 0).toFixed(digits);

/** Mehrzeiligen Text in <p><span>…</span></p>-Absätze wandeln */
const paragraphs = (s: string) =>
  (s || '')
    .split(/\r?\n/)
    .map(line => `<p><span>${esc(line)}</span></p>`)
    .join('');

function address(a: Adresse): string {
  return (
    `<Address>` +
    `<Name1>${esc(a.name)}</Name1>` +
    (a.zusatz ? `<Name2>${esc(a.zusatz)}</Name2>` : '') +
    (a.strasse ? `<Street>${esc(a.strasse)}</Street>` : '') +
    (a.plz ? `<PCode>${esc(a.plz)}</PCode>` : '') +
    (a.ort ? `<City>${esc(a.ort)}</City>` : '') +
    (a.telefon ? `<Phone>${esc(a.telefon)}</Phone>` : '') +
    (a.email ? `<Email>${esc(a.email)}</Email>` : '') +
    `</Address>`
  );
}

/** OZ-Teil einer Position (letzter Abschnitt der OZ, z. B. "0010") */
const rnoItem = (oz: string) => oz.split('.').pop() ?? oz;
const rnoCtgy = (oz: string) => oz.replace(/\./g, '');

/**
 * GAEB-DA-XML-Export.
 * phase '83' = Leistungsverzeichnis / Ausschreibung ohne Preise,
 * phase '84' = Angebotsabgabe mit Einheits- und Gesamtpreisen.
 */
export function gaebExport(projekt: Projekt, firma: Firma, erg: KalkErgebnis | null, phase: GaebPhase): string {
  const mitPreisen = phase === '84';
  const now = new Date();
  const summen = lvSummen(projekt, erg);
  const ctgyLen = Math.max(2, ...projekt.lv.map(t => rnoCtgy(t.oz).length));
  const itemLen = Math.max(4, ...projekt.lv.flatMap(t => t.positionen.map(p => rnoItem(p.oz).length)));

  const items = (t: Titel) =>
    t.positionen
      .map(p => {
        if (p.art === 'H') {
          return `<Remark><Description><CompleteText><DetailTxt><Text>${paragraphs(p.kurztext + (p.langtext ? '\n' + p.langtext : ''))}</Text></DetailTxt></CompleteText></Description></Remark>`;
        }
        const ep = erg ? effektiverEP(p, erg) : p.ep;
        let flags = '';
        if (p.art === 'B') flags += `<Provis>WithoutTotal</Provis>`;
        if (p.art === 'A') flags += `<ALNGroupNo>1</ALNGroupNo><ALNSerNo>2</ALNSerNo>`;
        if (p.art === 'Z') flags += `<MarkupItem>Yes</MarkupItem>`;
        const preise = mitPreisen ? `<UP>${dec(ep, 2)}</UP><IT>${dec(Math.round(p.menge * ep * 100) / 100, 2)}</IT>` : '';
        return (
          `<Item RNoPart="${esc(rnoItem(p.oz))}">` +
          flags +
          `<Qty>${dec(p.menge, 3)}</Qty>` +
          `<QU>${esc(p.einheit)}</QU>` +
          `<Description><CompleteText>` +
          `<DetailTxt><Text>${paragraphs(p.langtext)}</Text></DetailTxt>` +
          `<OutlineText><OutlTxt><TextOutlTxt><span>${esc(p.kurztext)}</span></TextOutlTxt></OutlTxt></OutlineText>` +
          `</CompleteText></Description>` +
          preise +
          `</Item>`
        );
      })
      .join('');

  const ctgys = projekt.lv
    .map(t => {
      const ts = summen.titel.find(x => x.titel.id === t.id)?.summe ?? 0;
      return (
        `<BoQCtgy RNoPart="${esc(rnoCtgy(t.oz))}">` +
        `<LblTx><p><span>${esc(t.bezeichnung)}</span></p></LblTx>` +
        `<BoQBody>` +
        (t.vorbemerkung ? `<Remark><Description><CompleteText><DetailTxt><Text>${paragraphs(t.vorbemerkung)}</Text></DetailTxt></CompleteText></Description></Remark>` : '') +
        `<Itemlist>${items(t)}</Itemlist>` +
        `</BoQBody>` +
        (mitPreisen ? `<Totals><Total>${dec(ts, 2)}</Total></Totals>` : '') +
        `</BoQCtgy>`
      );
    })
    .join('');

  const xml =
    `<?xml version="1.0" encoding="UTF-8"?>` +
    `<GAEB xmlns="http://www.gaeb.de/GAEB_DA_XML/DA${phase}/3.2" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance">` +
    `<GAEBInfo><Version>3.2</Version><VersDate>2013-10</VersDate>` +
    `<Date>${now.toISOString().slice(0, 10)}</Date><Time>${now.toTimeString().slice(0, 8)}</Time>` +
    `<ProgSystem>Polier</ProgSystem><ProgName>Polier Bauabrechnung</ProgName></GAEBInfo>` +
    `<PrjInfo><NamePrj>${esc(projekt.nummer)}</NamePrj><LblPrj>${esc(projekt.bauvorhaben || projekt.bezeichnung)}</LblPrj>` +
    `<Cur>EUR</Cur><CurLbl>Euro</CurLbl></PrjInfo>` +
    `<Award><DP>${phase}</DP>` +
    `<AwardInfo><Cur>EUR</Cur><CurLbl>Euro</CurLbl>` +
    (projekt.vorbemerkungen ? `<AwardText>${paragraphs(projekt.vorbemerkungen)}</AwardText>` : '') +
    `</AwardInfo>` +
    `<OWN>${address(projekt.auftraggeber)}</OWN>` +
    (mitPreisen ? `<BIDDER>${address(firma)}</BIDDER>` : '') +
    `<BoQ ID="${esc(projekt.id)}">` +
    `<BoQInfo><Name>${esc(projekt.nummer)}</Name><LblBoQ>${esc(projekt.bezeichnung)}</LblBoQ>` +
    `<Date>${esc(projekt.datum)}</Date><OutlCompl>ALL</OutlCompl>` +
    `<BoQBkdn><Type>BoQLevel</Type><Length>${ctgyLen}</Length><Num>Yes</Num><Alignment>left</Alignment></BoQBkdn>` +
    `<BoQBkdn><Type>Item</Type><Length>${itemLen}</Length><Num>Yes</Num><Alignment>left</Alignment></BoQBkdn>` +
    (mitPreisen ? `<NoUPComps>1</NoUPComps>` : '') +
    `</BoQInfo>` +
    `<BoQBody>${ctgys}</BoQBody>` +
    (mitPreisen ? `<Totals><Total>${dec(summen.netto, 2)}</Total>` + (summen.nachlass > 0 ? `<DiscountPcnt>${dec(projekt.nachlassProzent, 2)}</DiscountPcnt><DiscountAmt>${dec(summen.nachlass, 2)}</DiscountAmt>` : '') + `<VAT>${dec(projekt.mwstProzent, 2)}</VAT><VATAmt>${dec(summen.mwst, 2)}</VATAmt><TotalGross>${dec(summen.brutto, 2)}</TotalGross></Totals>` : '') +
    `</BoQ></Award></GAEB>`;
  return xml;
}

// ---------------------------------------------------------------------------
// Import
// ---------------------------------------------------------------------------

export interface GaebImportErgebnis {
  phase: string;
  projektName: string;
  projektBezeichnung: string;
  auftraggeber: Partial<Adresse>;
  vorbemerkungen: string;
  lv: Titel[];
  positionen: number;
  mitPreisen: boolean;
}

/** Kindelemente mit lokalem Namen (namespace-unabhängig) */
function kids(el: Element | null | undefined, name: string): Element[] {
  if (!el) return [];
  return Array.from(el.children).filter(c => c.localName === name);
}
const kid = (el: Element | null | undefined, name: string): Element | null => kids(el, name)[0] ?? null;
const first = (el: Element | null | undefined, path: string[]): Element | null => path.reduce<Element | null>((e, n) => (e ? kid(e, n) : null), el ?? null);
const txt = (el: Element | null | undefined) => (el?.textContent ?? '').trim();

/** Fließtext aus <p>/<span>-Strukturen zeilenweise extrahieren */
function richText(el: Element | null | undefined): string {
  if (!el) return '';
  const lines: string[] = [];
  const ps = Array.from(el.querySelectorAll('*')).filter(e => e.localName === 'p');
  if (ps.length === 0) return txt(el);
  for (const p of ps) {
    const t = (p.textContent ?? '').replace(/\s+/g, ' ').trim();
    lines.push(t);
  }
  return lines.join('\n').replace(/\n{3,}/g, '\n\n').trim();
}

export function gaebImport(xmlText: string): GaebImportErgebnis {
  const doc = new DOMParser().parseFromString(xmlText, 'application/xml');
  const perr = doc.getElementsByTagName('parsererror')[0];
  if (perr) throw new Error('XML konnte nicht gelesen werden: ' + txt(perr).slice(0, 120));
  const root = doc.documentElement;
  if (root.localName !== 'GAEB') throw new Error('Keine GAEB-DA-XML-Datei (Wurzelelement ' + root.localName + ')');

  const award = kid(root, 'Award');
  const phase = txt(kid(award, 'DP')) || (root.namespaceURI?.match(/DA(\d\d)/)?.[1] ?? '');
  const prjInfo = kid(root, 'PrjInfo');
  const own = first(award, ['OWN', 'Address']);
  const boq = kid(award, 'BoQ');
  if (!boq) throw new Error('Kein Leistungsverzeichnis (BoQ) in der Datei');

  const lv: Titel[] = [];
  let positionen = 0;
  let mitPreisen = false;

  const importItems = (titel: Titel, body: Element | null, prefix: string) => {
    for (const list of kids(body, 'Itemlist')) {
      for (const child of Array.from(list.children)) {
        if (child.localName === 'Remark') {
          const p = neuePosition(`${prefix}.H${String(titel.positionen.length + 1).padStart(2, '0')}`);
          p.art = 'H';
          p.kurztext = richText(first(child, ['Description', 'CompleteText', 'DetailTxt', 'Text'])).split('\n')[0] ?? '';
          p.langtext = richText(first(child, ['Description', 'CompleteText', 'DetailTxt', 'Text']));
          p.einheit = '';
          titel.positionen.push(p);
          continue;
        }
        if (child.localName !== 'Item') continue;
        const rno = child.getAttribute('RNoPart') ?? '';
        const idx = child.getAttribute('RNoIndex') ?? '';
        const p = neuePosition(`${prefix}.${rno}${idx}`);
        const complete = first(child, ['Description', 'CompleteText']);
        p.kurztext = richText(first(complete, ['OutlineText', 'OutlTxt', 'TextOutlTxt'])) || richText(first(child, ['Description', 'CompleteText', 'DetailTxt', 'Text'])).split('\n')[0] || '';
        p.langtext = richText(first(complete, ['DetailTxt', 'Text']));
        p.menge = parseFloat(txt(kid(child, 'Qty')) || '0') || 0;
        p.einheit = txt(kid(child, 'QU'));
        if (kid(child, 'Provis')) p.art = 'B';
        else if (kid(child, 'ALNGroupNo') && txt(kid(child, 'ALNSerNo')) !== '1') p.art = 'A';
        else if (txt(kid(child, 'MarkupItem')).toLowerCase() === 'yes') p.art = 'Z';
        if (kid(child, 'SumDescr')) p.einheit = p.einheit || 'psch';
        const up = txt(kid(child, 'UP'));
        if (up) { p.ep = parseFloat(up) || 0; mitPreisen = true; }
        p.epAusKalkulation = false;
        titel.positionen.push(p);
        positionen++;
      }
    }
  };

  const walk = (body: Element | null, prefix: string, labelPrefix: string) => {
    for (const ctgy of kids(body, 'BoQCtgy')) {
      const rno = ctgy.getAttribute('RNoPart') ?? String(lv.length + 1).padStart(2, '0');
      const oz = prefix ? `${prefix}.${rno}` : rno;
      const label = richText(kid(ctgy, 'LblTx')) || txt(kid(ctgy, 'LblTx'));
      const innerBody = kid(ctgy, 'BoQBody');
      const hasSub = kids(innerBody, 'BoQCtgy').length > 0;
      if (hasSub) {
        walk(innerBody, oz, labelPrefix ? `${labelPrefix} / ${label}` : label);
      }
      if (kids(innerBody, 'Itemlist').length > 0) {
        const t = neuerTitel(oz);
        t.bezeichnung = labelPrefix ? `${labelPrefix} / ${label}` : label;
        t.vorbemerkung = kids(innerBody, 'Remark').map(r => richText(first(r, ['Description', 'CompleteText', 'DetailTxt', 'Text']))).join('\n');
        importItems(t, innerBody, oz);
        lv.push(t);
      }
    }
  };
  walk(kid(boq, 'BoQBody'), '', '');
  // Positionen direkt auf oberster Ebene (ohne Titel)
  const topBody = kid(boq, 'BoQBody');
  if (kids(topBody, 'Itemlist').length > 0) {
    const t = neuerTitel('01');
    t.bezeichnung = txt(first(boq, ['BoQInfo', 'LblBoQ'])) || 'Leistungsverzeichnis';
    importItems(t, topBody, '01');
    lv.push(t);
  }

  return {
    phase,
    projektName: txt(kid(prjInfo, 'NamePrj')) || txt(first(boq, ['BoQInfo', 'Name'])),
    projektBezeichnung: txt(kid(prjInfo, 'LblPrj')) || txt(first(boq, ['BoQInfo', 'LblBoQ'])),
    auftraggeber: own ? { name: txt(kid(own, 'Name1')), zusatz: txt(kid(own, 'Name2')), strasse: txt(kid(own, 'Street')), plz: txt(kid(own, 'PCode')), ort: txt(kid(own, 'City')), telefon: txt(kid(own, 'Phone')), email: txt(kid(own, 'Email')) } : {},
    vorbemerkungen: richText(first(award, ['AwardInfo', 'AwardText'])),
    lv,
    positionen,
    mitPreisen,
  };
}

/** Importergebnis in ein neues Projekt-Objekt überführen */
export function gaebZuProjekt(basis: Projekt, imp: GaebImportErgebnis): Projekt {
  // Frisches Projekt; nur kaufmännische Voreinstellungen werden aus dem aktuellen Projekt übernommen.
  const neu = neuesProjekt(imp.projektName || basis.nummer);
  return {
    ...neu,
    bezeichnung: imp.projektBezeichnung || imp.projektName || 'GAEB-Import',
    bauvorhaben: imp.projektBezeichnung,
    art: imp.phase === '84' || imp.phase === '86' ? 'angebot' : 'ausschreibung',
    auftraggeber: { ...neu.auftraggeber, ...imp.auftraggeber },
    mwstProzent: basis.mwstProzent,
    skontoProzent: basis.skontoProzent,
    skontoTage: basis.skontoTage,
    sicherheitseinbehaltProzent: basis.sicherheitseinbehaltProzent,
    zahlungszielTage: basis.zahlungszielTage,
    kalk: basis.kalk,
    vorbemerkungen: imp.vorbemerkungen,
    lv: imp.lv,
  };
}

export const gaebDateiname = (projekt: Projekt, phase: GaebPhase) =>
  `${projekt.nummer || 'LV'}_${projekt.bezeichnung.replace(/[^\wäöüÄÖÜß-]+/g, '_')}.X${phase}`;

