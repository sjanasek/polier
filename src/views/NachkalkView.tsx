import { Fragment, useMemo, useRef, useState } from 'react';
import { useProjekt, useStore } from '../store';
import { Card, KPI, NumberInput, confirmDelete } from '../components/ui';
import { SollIstChart } from '../components/SollIstChart';
import { IMPORT_QUELLEN, KOSTENARTEN, KOSTENART_LISTE, type ImportProfil, type ImportQuelle, type Kostenstelle, type Nachkalkulation } from '../types';
import { datumDe, eur, heute, num2, numFlex, pct, uid } from '../lib/format';
import { KODIERUNGEN, dekodieren, parseCsv, type Kodierung, type Trennzeichen } from '../lib/csv';
import {
  felderFuer, fehlendePflichtfelder, importAusfuehren, importLoeschen, importUebernehmen, kostenNeuZuordnen, neuesProfil, vorschlagZuordnung,
  type ImportErgebnis, type ImportModus,
} from '../lib/brzImport';
import {
  HOCHRECHNUNGS_ARTEN, erfahrungswerte, erfahrungswerteAnwenden, nachkalkVon, nachkalkulation, nachkalkulationCsv,
  type Ampel, type ErfahrungsEintrag, type HochrechnungsArt, type Vergleich,
} from '../lib/nachkalkulation';

type Tab = 'uebersicht' | 'verlauf' | 'import' | 'kostenstellen' | 'erfahrung';
type TrennWahl = 'auto' | Trennzeichen;

const AMPEL_TEXT: Record<Ampel, string> = { gruen: 'im Rahmen', gelb: 'Achtung', rot: 'kritisch', grau: 'nicht bewertbar (Soll = 0)' };
const AMPEL_KURZ: Record<Ampel, string> = { gruen: 'ok', gelb: 'Achtung', rot: 'kritisch', grau: '–' };
const LOHNQUELLE_TEXT = {
  fibu: 'Lohnkosten aus der Finanzbuchhaltung (Lohnkonten)',
  export: 'Lohnkosten laut Baulohn-Export',
  geschaetzt: 'Schätzung: Ist-Stunden × Kalkulationslohn (keine Lohnkosten im Export)',
  keine: 'keine Lohndaten vorhanden',
};

const abw = (v: number | null) => (v == null ? '–' : `${v > 0 ? '+' : ''}${numFlex(Math.round(v * 10) / 10)} %`);
const ampelBadge = (a: Ampel) => <span className={`ampel ${a}`} title={AMPEL_TEXT[a]}>{AMPEL_KURZ[a]}</span>;

function zwischenablageLesen(): Promise<string> {
  return navigator.clipboard?.readText ? navigator.clipboard.readText() : Promise.reject(new Error('Zwischenablage nicht verfügbar'));
}

export function NachkalkView() {
  const { projekt, update } = useProjekt();
  const stamm = useStore(s => s.stammdaten);
  const updateStammdaten = useStore(s => s.updateStammdaten);
  const setDruck = useStore(s => s.setDruck);
  const setView = useStore(s => s.setView);
  const [tab, setTab] = useState<Tab>('uebersicht');
  const [stichtag, setStichtag] = useState<string>(() => projekt?.rechnungen.length ? [...projekt.rechnungen].sort((a, b) => b.lfdNr - a.lfdNr)[0].stichtag : heute());
  const [hochrechnung, setHochrechnung] = useState<HochrechnungsArt>('trend');
  // Import-Assistent
  const [quelle, setQuelle] = useState<ImportQuelle>('baulohn');
  const [puffer, setPuffer] = useState<ArrayBuffer | null>(null);
  const [rohtext, setRohtext] = useState('');
  const [dateiname, setDateiname] = useState('');
  const [kodierung, setKodierung] = useState<Kodierung>('auto');
  const [trenn, setTrenn] = useState<TrennWahl>('auto');
  const [pasteText, setPasteText] = useState('');
  const [zuordnung, setZuordnung] = useState<Record<string, string>>({});
  const [profilId, setProfilId] = useState('');
  const [profilName, setProfilName] = useState('');
  const [habenWerte, setHabenWerte] = useState('H, Haben, C');
  const [ausgeschlossen, setAusgeschlossen] = useState('');
  const [personenbezogen, setPersonenbezogen] = useState(false);
  const [modus, setModus] = useState<ImportModus>('ergaenzen');
  const [vorschau, setVorschau] = useState<ImportErgebnis | null>(null);
  const [meldung, setMeldung] = useState('');
  const [erfAuswahl, setErfAuswahl] = useState<Set<string>>(new Set());
  const [erfMeldung, setErfMeldung] = useState('');
  const fileRef = useRef<HTMLInputElement>(null);

  const nk = projekt ? nachkalkVon(projekt) : null;
  const erg = useMemo(() => (projekt ? nachkalkulation(projekt, { stichtag: stichtag || null, hochrechnung }) : null), [projekt, stichtag, hochrechnung]);
  const text = useMemo(() => (puffer ? dekodieren(puffer, kodierung).text : rohtext), [puffer, kodierung, rohtext]);
  const erkannt = useMemo(() => (puffer ? dekodieren(puffer, kodierung).kodierung : null), [puffer, kodierung]);
  const tabelle = useMemo(() => (text.trim() ? parseCsv(text, trenn === 'auto' ? undefined : trenn) : null), [text, trenn]);
  const regeln = stamm.kontenRegeln ?? [];
  const profile = (stamm.importProfile ?? []).filter(p => p.quelle === quelle);
  if (!projekt || !nk || !erg) return null;

  const setNk = (fn: (n: Nachkalkulation) => Nachkalkulation) => update(p => ({ ...p, nachkalk: fn(nachkalkVon(p)) }));

  // ----- Import-Assistent -----
  const quelleWechseln = (q: ImportQuelle) => {
    setQuelle(q); setVorschau(null); setProfilId('');
    if (tabelle) setZuordnung(vorschlagZuordnung(tabelle.kopf, q));
  };
  const textUebernehmen = (t: string, name: string, buf: ArrayBuffer | null) => {
    setPuffer(buf); setRohtext(t); setDateiname(name); setVorschau(null); setMeldung('');
    const tb = parseCsv(buf ? dekodieren(buf, kodierung).text : t, trenn === 'auto' ? undefined : trenn);
    const prof = profile.find(p => p.id === profilId);
    setZuordnung(prof ? prof.zuordnung : vorschlagZuordnung(tb.kopf, quelle));
  };
  const dateiWaehlen = async (f: File) => {
    textUebernehmen('', f.name, await f.arrayBuffer());
    if (fileRef.current) fileRef.current.value = '';
  };
  const profilAnwenden = (id: string) => {
    setProfilId(id);
    const p = profile.find(x => x.id === id);
    if (!p) return;
    setZuordnung(p.zuordnung); setProfilName(p.name); setHabenWerte(p.habenWerte); setAusgeschlossen(p.ausgeschlosseneStundenarten); setVorschau(null);
  };
  const aktuellesProfil = (): ImportProfil => ({ ...(profile.find(p => p.id === profilId) ?? neuesProfil(quelle)), name: profilName || profile.find(p => p.id === profilId)?.name || neuesProfil(quelle).name, quelle, zuordnung, habenWerte, ausgeschlosseneStundenarten: ausgeschlossen });
  const profilSpeichern = () => {
    const p = aktuellesProfil();
    const vorhanden = (stamm.importProfile ?? []).some(x => x.id === p.id);
    updateStammdaten(s => ({ ...s, importProfile: vorhanden ? (s.importProfile ?? []).map(x => (x.id === p.id ? p : x)) : [...(s.importProfile ?? []), p] }));
    setProfilId(p.id); setProfilName(p.name);
    setMeldung(`Profil „${p.name}“ gespeichert.`);
  };
  const profilLoeschen = () => {
    const p = profile.find(x => x.id === profilId);
    if (!p || !confirmDelete(`Profil „${p.name}“`)) return;
    updateStammdaten(s => ({ ...s, importProfile: (s.importProfile ?? []).filter(x => x.id !== p.id) }));
    setProfilId('');
  };
  const pruefen = () => {
    if (!tabelle) return;
    setVorschau(importAusfuehren(tabelle, nk, { quelle, datei: dateiname || 'Zwischenablage', profil: aktuellesProfil(), personenbezogen, modus, regeln }));
    setMeldung('');
  };
  const uebernehmen = () => {
    if (!tabelle) return;
    const e = importAusfuehren(tabelle, nk, { quelle, datei: dateiname || 'Zwischenablage', profil: aktuellesProfil(), personenbezogen, modus, regeln });
    if (e.protokoll.uebernommen === 0 && e.geloeschteIds.length === 0) { setVorschau(e); setMeldung('Nichts übernommen – alle Zeilen waren bereits vorhanden oder fehlerhaft.'); return; }
    setNk(n => importUebernehmen(n, e));
    setVorschau(null); setPuffer(null); setRohtext(''); setPasteText(''); setDateiname('');
    setMeldung(`Import abgeschlossen: ${e.protokoll.uebernommen} Zeilen übernommen, ${e.protokoll.uebersprungen} übersprungen, ${e.protokoll.fehler.length} Fehler${e.protokoll.ersetzt ? `, ${e.protokoll.ersetzt} ersetzt` : ''}.`);
  };
  const fehlend = tabelle ? fehlendePflichtfelder(zuordnung, quelle, tabelle.kopf) : [];
  const unbekannteKst = tabelle && vorschau ? vorschau.protokoll.kostenstellen.filter(k => !nk.kostenstellen.some(x => x.nummer.trim() === k)) : [];

  // ----- Kostenstellen -----
  const setKst = (id: string, patch: Partial<Kostenstelle>) => setNk(n => ({ ...n, kostenstellen: n.kostenstellen.map(k => (k.id === id ? { ...k, ...patch } : k)) }));
  const kstAnlegen = (nummern: string[]) => setNk(n => ({ ...n, kostenstellen: [...n.kostenstellen, ...nummern.filter(x => !n.kostenstellen.some(k => k.nummer.trim() === x)).map(nummer => ({ id: uid(), nummer, bezeichnung: '', titelId: null, gemeinkosten: false }))] }));
  const importierteKst = Array.from(new Set([...nk.stunden.map(s => s.kostenstelle.trim()), ...nk.kosten.map(k => k.kostenstelle.trim())])).filter(x => x && !nk.kostenstellen.some(k => k.nummer.trim() === x)).sort();

  // ----- Erfahrungswerte -----
  const erf = erfahrungswerte(projekt, erg);
  const erfKey = (e: ErfahrungsEintrag) => e.titelId ?? '__projekt';
  const erfUebernehmen = () => {
    const gewaehlt = erf.filter(e => erfAuswahl.has(erfKey(e)));
    const anz = gewaehlt.reduce((a, e) => a + e.positionen.reduce((b, p) => b + p.ansaetze.length, 0), 0);
    if (!anz) return;
    if (!window.confirm(`${anz} Lohnansätze in ${gewaehlt.length} Bereich(en) mit den Ist-Aufwandswerten überschreiben?\n\nDie Einheitspreise der Positionen mit „EP aus Kalkulation“ ändern sich dadurch. Die bisherigen Werte sind danach nur noch in einer Sicherung enthalten.`)) return;
    update(p => erfahrungswerteAnwenden(p, gewaehlt));
    setErfAuswahl(new Set());
    setErfMeldung(`${anz} Lohnansätze aktualisiert. Soll und Ist stimmen jetzt zum Stichtag überein; die Kalkulation wurde entsprechend angepasst.`);
  };

  const csvExport = () => {
    const blob = new Blob(['﻿' + nachkalkulationCsv(projekt, erg)], { type: 'text/csv;charset=utf-8' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `nachkalkulation-${projekt.nummer}-${stichtag || 'gesamt'}.csv`;
    a.click();
    URL.revokeObjectURL(a.href);
  };

  const tabs: [Tab, string][] = [
    ['uebersicht', 'Soll-Ist-Vergleich'],
    ['verlauf', 'Zeitverlauf'],
    ['import', 'Import (Baulohn / FiBu)'],
    ['kostenstellen', 'Kostenstellen & Importe'],
    ['erfahrung', 'Erfahrungswerte'],
  ];
  const hinweise: string[] = [];
  if (nk.kostenstellen.length === 0) hinweise.push('Noch keine Kostenstelle hinterlegt: Alle importierten Zeilen werden dem Projekt zugerechnet. Unter „Kostenstellen & Importe“ die Baustellennummer(n) eintragen, damit nur passende Zeilen zählen.');
  if (!erg.hatStunden && !erg.hatKosten) hinweise.push('Noch keine Ist-Daten: Unter „Import“ einen Export aus der Lohnabrechnung (Stunden) oder der Finanzbuchhaltung (Kosten) einlesen.');
  else if (!erg.hatStunden) hinweise.push('Keine Stunden bis zum Stichtag: Lohnstunden und Mittellohn können erst nach einem Baulohn-Import bewertet werden.');
  else if (!erg.hatKosten) hinweise.push('Keine Kosten bis zum Stichtag: Stoffe, Geräte, Fremdleistungen werden erst nach einem FiBu-Import bewertet.');
  if (!erg.hatLeistungsstand) hinweise.push('Kein Leistungsstand bis zum Stichtag: Es liegen keine Aufmaße oder Stationierungen bis zu diesem Datum vor. Soll-Werte beziehen sich auf die erreichte Leistung und sind deshalb 0. Stichtag prüfen oder Aufmaß erfassen.');
  if (erg.fremdeZeilen > 0) hinweise.push(`${erg.fremdeZeilen} importierte Zeile(n) gehören zu Kostenstellen, die nicht im Projekt eingetragen sind, und werden nicht gezählt.`);
  if (erg.nichtZugeordneteKonten.length) hinweise.push(`${erg.nichtZugeordneteKonten.length} Konto/Konten ohne Kontenregel (unter „Sonstiges“ gezählt): ${erg.nichtZugeordneteKonten.map(k => k.konto).join(', ')}. Regeln unter Stammdaten → Kontenzuordnung pflegen.`);

  return (
    <div>
      <div className="tabs">
        {tabs.map(([id, label]) => <button key={id} className={`tab ${tab === id ? 'active' : ''}`} onClick={() => setTab(id)}>{label}</button>)}
      </div>

      {(tab === 'uebersicht' || tab === 'verlauf') && (
        <Card className="nk-toolbar">
          <div className="row">
            <div className="field" style={{ width: 170 }}><label>Stichtag (Leistungsstand bis)</label><input type="date" value={stichtag} onChange={e => setStichtag(e.target.value)} /></div>
            <div className="field" style={{ width: 320 }}><label>Hochrechnung</label>
              <select value={hochrechnung} onChange={e => setHochrechnung(e.target.value as HochrechnungsArt)}>
                {Object.entries(HOCHRECHNUNGS_ARTEN).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
              </select>
            </div>
            {projekt.rechnungen.length > 0 && (
              <div className="field" style={{ width: 220 }}><label>Stichtag aus Rechnung</label>
                <select value="" onChange={e => e.target.value && setStichtag(e.target.value)}>
                  <option value="">– wählen –</option>
                  {[...projekt.rechnungen].sort((a, b) => a.lfdNr - b.lfdNr).map(r => <option key={r.id} value={r.stichtag}>{r.lfdNr}. {r.rechnungsNr} · {datumDe(r.stichtag)}</option>)}
                </select>
              </div>
            )}
            <span className="spacer" />
            <button className="btn secondary sm" onClick={csvExport}>CSV-Export</button>
            <button className="btn sm" onClick={() => setDruck({ art: 'nachkalkulation', stichtag: stichtag || null })}>Drucken</button>
          </div>
        </Card>
      )}

      {tab === 'uebersicht' && (
        <>
          {hinweise.map((h, i) => <div key={i} className="hint" style={{ marginBottom: 10 }}>{h}</div>)}
          <div className="grid grid-4" style={{ marginBottom: 14 }}>
            <KPI label={`Leistung netto bis ${datumDe(stichtag) || 'heute'} · Leistungsgrad`} value={`${eur(erg.leistung)} · ${erg.leistungsgrad == null ? '–' : pct(Math.round(erg.leistungsgrad * 1000) / 10)}`} />
            <KPI label="Lohnstunden Soll / Ist" value={`${num2(erg.sollStunden)} h / ${num2(erg.istStunden)} h`} />
            <KPI label="Kosten Soll / Ist (EKT + BGK)" value={`${eur(erg.sollGesamt)} / ${eur(erg.istGesamt)}`} />
            <KPI label="Ergebnis bis Stichtag (Erlös − Ist-Kosten)" value={eur(erg.ergebnisIst)} big />
          </div>

          <div className="cols">
            <Card title="Soll-Ist-Vergleich je Kostenart (bezogen auf den Leistungsstand)">
              <table className="tbl compact">
                <thead><tr><th>Kostenart</th><th className="num">Soll €</th><th className="num">Ist €</th><th className="num">Abweichung €</th><th className="num">%</th><th>Status</th></tr></thead>
                <tbody>
                  {erg.vergleich.map(v => renderVergleich(v))}
                  {renderVergleich(erg.vergleichEkt, 'sum')}
                  {renderVergleich(erg.vergleichBgk)}
                  {renderVergleich(erg.vergleichGesamt, 'sum')}
                  {renderVergleich(erg.vergleichStunden, undefined, 'h')}
                </tbody>
              </table>
              <p className="muted" style={{ marginTop: 8 }}>
                Soll = Kalkulationsansätze × aufgemessene Menge bis Stichtag (nicht die volle LV-Menge); Soll-BGK anteilig zum Leistungsgrad.
                Lohn-Ist: {LOHNQUELLE_TEXT[erg.lohnQuelle]}{erg.lohnQuelle === 'geschaetzt' && <span className="badge warn" style={{ marginLeft: 6 }}>Schätzung</span>}.
                Ampel: gelb ab {numFlex(nk.schwellen.gelb)} %, rot ab {numFlex(nk.schwellen.rot)} % über Soll.
              </p>
            </Card>
            <div>
              <Card title="Kennzahlen">
                <table className="tbl compact">
                  <thead><tr><th>Kennzahl</th><th className="num">Soll / Kalkulation</th><th className="num">Ist</th><th className="num">Abweichung</th></tr></thead>
                  <tbody>
                    <tr><td>Mittellohn (Kalkulationslohn) €/h</td><td className="num">{num2(erg.mittellohnSoll)}</td><td className="num">{erg.mittellohnIst == null ? '–' : num2(erg.mittellohnIst)}</td><td className="num">{erg.mittellohnIst == null ? '–' : abw(((erg.mittellohnIst - erg.mittellohnSoll) / erg.mittellohnSoll) * 100)}</td></tr>
                    <tr><td>Aufwand gesamt (Ist-Stunden ÷ Soll-Stunden)</td><td className="num">1,00</td><td className="num">{erg.sollStunden > 0 && erg.istStunden > 0 ? num2(erg.istStunden / erg.sollStunden) : '–'}</td><td className="num">{abw(erg.vergleichStunden.prozent)}</td></tr>
                    <tr><td>BGK-Satz (BGK ÷ EKT)</td><td className="num">{erg.bgkSatzSoll == null ? '–' : pct(Math.round(erg.bgkSatzSoll * 10) / 10)}</td><td className="num">{erg.bgkSatzIst == null ? '–' : pct(Math.round(erg.bgkSatzIst * 10) / 10)}</td><td className="num">{erg.bgkSatzSoll != null && erg.bgkSatzIst != null ? `${numFlex(Math.round((erg.bgkSatzIst - erg.bgkSatzSoll) * 10) / 10)} %-Pkt.` : '–'}</td></tr>
                    <tr><td>Zuschlag auf EKT (Erlös − EKT) ÷ EKT</td><td className="num">{erg.zuschlagSoll == null ? '–' : pct(Math.round(erg.zuschlagSoll * 10) / 10)}</td><td className="num">{erg.zuschlagIst == null ? '–' : pct(Math.round(erg.zuschlagIst * 10) / 10)}</td><td className="num">{erg.zuschlagSoll != null && erg.zuschlagIst != null ? `${numFlex(Math.round((erg.zuschlagIst - erg.zuschlagSoll) * 10) / 10)} %-Pkt.` : '–'}</td></tr>
                    <tr><td>Erlös bis Stichtag (Leistung − Nachlass {numFlex(projekt.nachlassProzent)} %)</td><td className="num">{num2(erg.erloes)}</td><td className="num">{num2(erg.erloes)}</td><td></td></tr>
                    <tr className="sum"><td>Ergebnis bis Stichtag (Erlös − Kosten)</td><td className="num">{num2(erg.ergebnisSoll)}</td><td className="num">{num2(erg.ergebnisIst)}</td><td className="num">{num2(erg.ergebnisIst - erg.ergebnisSoll)}</td></tr>
                  </tbody>
                </table>
              </Card>
              <Card title="Hochrechnung bis Fertigstellung">
                <table className="tbl compact">
                  <tbody>
                    <tr><td>Auftragssumme netto (nach Nachlass)</td><td className="num">{num2(erg.auftragssummeNachNachlass)}</td></tr>
                    <tr><td>Leistungsgrad (Leistung ÷ Auftragssumme)</td><td className="num">{erg.leistungsgrad == null ? '–' : pct(Math.round(erg.leistungsgrad * 1000) / 10)}</td></tr>
                    <tr><td>Plan-Kosten (Herstellkosten laut Kalkulation)</td><td className="num">{num2(erg.hochrechnung.planKosten)}</td></tr>
                    <tr><td>Prognose Kosten bei Fertigstellung</td><td className="num"><b>{erg.hochrechnung.prognoseKosten == null ? '–' : num2(erg.hochrechnung.prognoseKosten)}</b></td></tr>
                    <tr><td>Plan-Ergebnis (AGK + W&amp;G)</td><td className="num">{num2(erg.hochrechnung.planErgebnis)}</td></tr>
                    <tr className="sum"><td>Voraussichtliches Ergebnis</td><td className="num">{erg.hochrechnung.prognoseErgebnis == null ? '–' : num2(erg.hochrechnung.prognoseErgebnis)}</td></tr>
                    <tr><td>Abweichung zum Plan-Ergebnis</td><td className="num">{erg.hochrechnung.abweichungErgebnis == null ? '–' : <span style={{ color: erg.hochrechnung.abweichungErgebnis < 0 ? 'var(--danger)' : undefined }}>{num2(erg.hochrechnung.abweichungErgebnis)}</span>}</td></tr>
                  </tbody>
                </table>
                <p className="muted" style={{ marginTop: 8 }}>{HOCHRECHNUNGS_ARTEN[hochrechnung]}. {hochrechnung === 'trend' ? 'Unterstellt, dass die bisherige Kostenquote bis zum Ende gilt.' : `Verbleibende Soll-Kosten laut Kalkulation: ${eur(erg.hochrechnung.restKostenPlan)}.`}{erg.hochrechnung.prognoseKosten == null && ' Ohne Leistungsstand ist keine Trend-Hochrechnung möglich.'}</p>
              </Card>
            </div>
          </div>

          <div className="cols">
            <Card title="Stunden nach Stundenart und Bauzeitenplan">
              {erg.stundenNachArt.length ? (
                <table className="tbl compact">
                  <thead><tr><th>Stundenart</th><th className="num">Stunden</th><th className="num">Anteil</th><th className="num">Lohnkosten €</th></tr></thead>
                  <tbody>
                    {erg.stundenNachArt.map(a => <tr key={a.stundenart}><td>{a.stundenart}</td><td className="num">{num2(a.stunden)}</td><td className="num">{pct(Math.round((a.stunden / erg.istStunden) * 1000) / 10)}</td><td className="num">{a.lohnkosten == null ? '–' : num2(a.lohnkosten)}</td></tr>)}
                    <tr className="sum"><td>Summe</td><td className="num">{num2(erg.istStunden)}</td><td></td><td className="num">{num2(erg.istLohnkosten)}</td></tr>
                  </tbody>
                </table>
              ) : <div className="empty">Keine Stunden bis zum Stichtag.</div>}
              <table className="tbl compact" style={{ marginTop: 10 }}>
                <tbody>
                  <tr><td>Geplante Lohnstunden bis Stichtag (Bauzeitenplan)</td><td className="num">{erg.bauzeit.verfuegbar ? `${num2(erg.bauzeit.planStundenBisStichtag)} h` : '–'}</td></tr>
                  <tr><td>Soll-Stunden laut Leistungsstand</td><td className="num">{num2(erg.sollStunden)} h</td></tr>
                  <tr><td>Geleistete Stunden (Ist)</td><td className="num">{num2(erg.istStunden)} h</td></tr>
                  <tr><td>Geplante Lohnstunden gesamt · Planende</td><td className="num">{erg.bauzeit.verfuegbar ? `${num2(erg.bauzeit.planStundenGesamt)} h · ${datumDe(erg.bauzeit.planEnde)}` : 'kein Bauzeitenplan'}</td></tr>
                </tbody>
              </table>
              <p className="muted" style={{ marginTop: 8 }}>Liegen die Soll-Stunden deutlich unter dem Plan, ist die Baustelle im Verzug; liegen die Ist-Stunden über den Soll-Stunden, wird mehr Zeit je Einheit gebraucht als kalkuliert.</p>
            </Card>
            <Card title="Vergleich je Titel (Kostenstellen mit Titelzuordnung)">
              {erg.titel.length ? (
                <table className="tbl compact">
                  <thead><tr><th>Titel</th><th>Kostenstellen</th><th className="num">Soll h</th><th className="num">Ist h</th><th className="num">Faktor</th><th className="num">Soll EKT €</th><th className="num">Ist EKT €</th><th className="num">Leistung €</th></tr></thead>
                  <tbody>
                    {erg.titel.map(t => {
                      const sollE = KOSTENART_LISTE.reduce((a, k) => a + t.sollKosten[k], 0), istE = KOSTENART_LISTE.reduce((a, k) => a + t.istKosten[k], 0);
                      return (
                        <tr key={t.titel.id}>
                          <td>{t.titel.oz} {t.titel.bezeichnung}</td><td>{t.kostenstellen.join(', ')}</td>
                          <td className="num">{num2(t.sollStunden)}</td><td className="num">{num2(t.istStunden)}</td>
                          <td className="num">{t.aufwandFaktor == null ? '–' : <b>{num2(t.aufwandFaktor)}</b>}</td>
                          <td className="num">{num2(sollE)}</td><td className="num">{num2(istE)}</td><td className="num">{num2(t.leistung)}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              ) : <div className="empty">Keine Kostenstelle ist einem Titel zugeordnet. Unter „Kostenstellen &amp; Importe“ Unterkostenstellen oder Kostenträger den LV-Titeln zuordnen, dann ist der Vergleich auch je Titel möglich.</div>}
              <p className="muted" style={{ marginTop: 8 }}>Faktor = Ist-Stunden ÷ Soll-Stunden des Titels (Ist-Aufwandswert ÷ Soll-Ansatz). Unter „Erfahrungswerte“ lassen sich die Ansätze damit anpassen.</p>
            </Card>
          </div>
          {erg.nichtZugeordneteKonten.length > 0 && (
            <Card title="Konten ohne Kontenregel (als „Sonstiges“ gezählt)">
              <table className="tbl compact">
                <thead><tr><th>Konto</th><th>Bezeichnung</th><th className="num">Betrag €</th></tr></thead>
                <tbody>{erg.nichtZugeordneteKonten.map(k => <tr key={k.konto}><td>{k.konto}</td><td>{k.bezeichnung}</td><td className="num">{num2(k.betrag)}</td></tr>)}</tbody>
              </table>
              <div className="row" style={{ marginTop: 8 }}>
                <button className="btn secondary sm" onClick={() => setView('stammdaten')}>Kontenregeln in den Stammdaten pflegen →</button>
                <button className="btn secondary sm" onClick={() => setNk(n => kostenNeuZuordnen(n, regeln))}>Kosten nach aktuellen Regeln neu zuordnen</button>
              </div>
            </Card>
          )}
        </>
      )}

      {tab === 'verlauf' && (
        <>
          {erg.verlauf.length === 0 && <div className="hint" style={{ marginBottom: 10 }}>Für den Zeitverlauf werden Aufmaße (Soll) und Importe (Ist) mit Datum benötigt.</div>}
          <Card title="Lohnstunden kumuliert: Soll (Leistungsstand) · Ist · Plan (Bauzeitenplan)"><SollIstChart punkte={erg.verlauf} modus="stunden" /></Card>
          <Card title="Kosten kumuliert (EKT + BGK): Soll · Ist · Leistung"><SollIstChart punkte={erg.verlauf} modus="kosten" /></Card>
          {erg.verlauf.length > 0 && (
            <Card title="Werte je Monatsende">
              <table className="tbl compact">
                <thead><tr><th>Datum</th><th className="num">Soll h</th><th className="num">Ist h</th><th className="num">Plan h</th><th className="num">Soll €</th><th className="num">Ist €</th><th className="num">Leistung €</th></tr></thead>
                <tbody>{erg.verlauf.map(v => <tr key={v.datum}><td>{datumDe(v.datum)}</td><td className="num">{num2(v.sollStunden)}</td><td className="num">{num2(v.istStunden)}</td><td className="num">{v.planStunden == null ? '–' : num2(v.planStunden)}</td><td className="num">{num2(v.sollKosten)}</td><td className="num">{num2(v.istKosten)}</td><td className="num">{num2(v.leistung)}</td></tr>)}</tbody>
              </table>
            </Card>
          )}
        </>
      )}

      {tab === 'import' && (
        <>
          <div className="hint" style={{ marginBottom: 10 }}>
            <b>Hinweis zu BRZ und anderen Systemen:</b> Polier liest CSV-Exporte über eine frei konfigurierbare Spaltenzuordnung ein. Die genauen Exportlayouts von BRZ Baulohn und BRZ Finanzbuchhaltung liegen nicht vor; es gibt keine geprüfte oder zertifizierte Schnittstelle.
            Exportieren Sie die Arbeitszeiten je Kostenstelle bzw. die Buchungen je Kostenstelle als CSV/Text, ordnen Sie die Spalten einmal zu und speichern Sie die Zuordnung als Profil.
            <br /><b>Datenschutz:</b> Lohndaten sind personenbezogen. Standardmäßig werden nur Summen je Datum, Kostenstelle und Stundenart gespeichert; Mitarbeiternummern und Namen werden verworfen. Alle Daten bleiben lokal in diesem Browser; eine Sicherungsdatei enthält die importierten Daten.
          </div>
          <div className="cols">
            <Card title="1. Quelle und Datei">
              <div className="field" style={{ marginBottom: 8 }}><label>Quelle</label>
                <select value={quelle} onChange={e => quelleWechseln(e.target.value as ImportQuelle)}>
                  {Object.entries(IMPORT_QUELLEN).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                </select>
              </div>
              <div className="row">
                <button className="btn" onClick={() => fileRef.current?.click()}>CSV-Datei wählen</button>
                <input ref={fileRef} type="file" style={{ display: 'none' }} onChange={e => e.target.files?.[0] && dateiWaehlen(e.target.files[0])} />
                <button className="btn secondary" onClick={() => zwischenablageLesen().then(t => { setPasteText(t); textUebernehmen(t, 'Zwischenablage', null); }).catch(() => setMeldung('Zwischenablage konnte nicht gelesen werden – Text bitte unten einfügen.'))}>Aus Zwischenablage</button>
                {dateiname && <span className="muted">{dateiname}{erkannt && ` · ${erkannt}`}{tabelle && ` · ${tabelle.zeilen.length} Zeilen`}</span>}
              </div>
              <div className="field" style={{ marginTop: 8 }}><label>…oder Text hier einfügen (Kopfzeile + Datenzeilen)</label>
                <textarea value={pasteText} rows={4} placeholder={'Datum;Kostenstelle;Stunden\n03.08.2026;4711;8,00'} onChange={e => setPasteText(e.target.value)} onBlur={() => pasteText.trim() && textUebernehmen(pasteText, 'Zwischenablage', null)} />
              </div>
              <div className="grid grid-2" style={{ marginTop: 8 }}>
                <div className="field"><label>Kodierung</label>
                  <select value={kodierung} disabled={!puffer} onChange={e => { setKodierung(e.target.value as Kodierung); setVorschau(null); }}>
                    {Object.entries(KODIERUNGEN).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                  </select>
                </div>
                <div className="field"><label>Trennzeichen</label>
                  <select value={trenn} onChange={e => { setTrenn(e.target.value as TrennWahl); setVorschau(null); }}>
                    <option value="auto">automatisch{tabelle ? ` (${tabelle.trennzeichen === '\t' ? 'Tabulator' : tabelle.trennzeichen})` : ''}</option>
                    <option value=";">Semikolon ;</option><option value=",">Komma ,</option><option value={'\t'}>Tabulator</option><option value="|">Senkrechter Strich |</option>
                  </select>
                </div>
              </div>
              {tabelle && (
                <div className="scroll" style={{ marginTop: 10, maxHeight: 220 }}>
                  <table className="tbl compact">
                    <thead><tr>{tabelle.kopf.map((h, i) => <th key={i}>{h || <i>Spalte {i + 1}</i>}</th>)}</tr></thead>
                    <tbody>{tabelle.zeilen.slice(0, 5).map((z, i) => <tr key={i}>{tabelle.kopf.map((_, j) => <td key={j}>{z[j]}</td>)}</tr>)}</tbody>
                  </table>
                </div>
              )}
            </Card>
            <Card title="2. Spaltenzuordnung" actions={
              <>
                <select value={profilId} onChange={e => profilAnwenden(e.target.value)} style={{ width: 200 }} aria-label="Profil">
                  <option value="">– Profil wählen –</option>
                  {profile.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                </select>
                {profilId && <button className="btn ghost sm" onClick={profilLoeschen}>✕</button>}
              </>
            }>
              {!tabelle ? <div className="empty">Zuerst eine Datei wählen oder Text einfügen.</div> : (
                <>
                  <table className="tbl compact">
                    <thead><tr><th>Zielfeld</th><th>Spalte im Export</th><th>Beispielwert</th></tr></thead>
                    <tbody>
                      {felderFuer(quelle).map(f => {
                        const idx = tabelle.kopf.indexOf(zuordnung[f.key] ?? '');
                        return (
                          <tr key={f.key}>
                            <td>{f.label}{f.pflicht && <span className="err"> *</span>}{f.hinweis && <div className="muted" style={{ fontSize: 11 }}>{f.hinweis}</div>}</td>
                            <td>
                              <select value={zuordnung[f.key] ?? ''} onChange={e => { setZuordnung({ ...zuordnung, [f.key]: e.target.value }); setVorschau(null); }}>
                                <option value="">– nicht zugeordnet –</option>
                                {tabelle.kopf.map((h, i) => <option key={i} value={h}>{h || `Spalte ${i + 1}`}</option>)}
                              </select>
                            </td>
                            <td className="muted">{idx >= 0 ? tabelle.zeilen[0]?.[idx] : ''}</td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                  {fehlend.length > 0 && <div className="err" style={{ marginTop: 6 }}>Pflichtfelder fehlen: {fehlend.join(', ')}</div>}
                  <div className="grid grid-2" style={{ marginTop: 10 }}>
                    {quelle === 'fibu' && <div className="field"><label>Haben-Kennzeichen (Gutschrift/Storno), Komma-getrennt</label><input value={habenWerte} onChange={e => setHabenWerte(e.target.value)} /></div>}
                    {quelle === 'baulohn' && <div className="field"><label>Stundenarten ausschließen (z. B. Urlaub, Krank), Komma-getrennt</label><input value={ausgeschlossen} onChange={e => setAusgeschlossen(e.target.value)} /></div>}
                    <div className="field"><label>Profilname</label>
                      <div className="row" style={{ flexWrap: 'nowrap' }}>
                        <input value={profilName} placeholder={neuesProfil(quelle).name} onChange={e => setProfilName(e.target.value)} />
                        <button className="btn secondary sm" onClick={profilSpeichern}>Profil speichern</button>
                      </div>
                    </div>
                  </div>
                </>
              )}
            </Card>
          </div>
          <Card title="3. Optionen, Prüfung und Übernahme">
            <div className="row">
              {quelle === 'baulohn' && (
                <label className="check" title="Standard: aus. Namen und Personalnummern werden nur gespeichert, wenn dieser Schalter aktiv ist.">
                  <input type="checkbox" checked={personenbezogen} onChange={e => { setPersonenbezogen(e.target.checked); setVorschau(null); }} />
                  personenbezogen speichern (Mitarbeiter-Nr. und Name behalten)
                </label>
              )}
              <select value={modus} onChange={e => { setModus(e.target.value as ImportModus); setVorschau(null); }} style={{ width: 420 }}>
                <option value="ergaenzen">Ergänzen: bereits vorhandene Zeilen (gleicher Inhalt) überspringen</option>
                <option value="ersetzen">Ersetzen: vorhandene Zeilen im Zeitraum und den Kostenstellen der Datei löschen</option>
              </select>
              <span className="spacer" />
              <button className="btn secondary" disabled={!tabelle || fehlend.length > 0} onClick={pruefen}>Prüfen (Vorschau)</button>
              <button className="btn" disabled={!tabelle || fehlend.length > 0} onClick={uebernehmen}>Import übernehmen</button>
            </div>
            {personenbezogen && quelle === 'baulohn' && <div className="hint" style={{ marginTop: 8 }}>Personenbezogene Daten werden im Browser gespeichert und sind in der Sicherungsdatei enthalten. Zugriffsschutz des Geräts und Aufbewahrungsfristen beachten.</div>}
            {meldung && <p className={meldung.startsWith('Nichts') || meldung.includes('nicht') ? 'err' : 'muted'} style={{ marginTop: 8 }}>{meldung}</p>}
            {vorschau && (
              <div style={{ marginTop: 10 }}>
                <div className="grid grid-4">
                  <KPI label="Zeilen gelesen" value={String(vorschau.protokoll.zeilenGelesen)} />
                  <KPI label="würden übernommen" value={String(vorschau.protokoll.uebernommen)} />
                  <KPI label="übersprungen (Duplikat / ausgeschlossen)" value={String(vorschau.protokoll.uebersprungen)} />
                  <KPI label="Fehler" value={String(vorschau.protokoll.fehler.length)} />
                </div>
                <p className="muted" style={{ marginTop: 8 }}>
                  Zeitraum {vorschau.protokoll.von ? `${datumDe(vorschau.protokoll.von)} – ${datumDe(vorschau.protokoll.bis)}` : '–'} · Kostenstellen: {vorschau.protokoll.kostenstellen.join(', ') || '–'}
                  {vorschau.protokoll.ersetzt > 0 && ` · ${vorschau.protokoll.ersetzt} vorhandene Zeilen würden ersetzt`}
                  {quelle === 'baulohn' && ` · Summe ${num2(vorschau.stunden.reduce((a, s) => a + s.stunden, 0))} h`}
                  {quelle === 'fibu' && ` · Summe ${eur(vorschau.kosten.reduce((a, k) => a + k.betrag, 0))}`}
                </p>
                {unbekannteKst.length > 0 && (
                  <div className="hint" style={{ marginTop: 6 }}>Kostenstellen {unbekannteKst.join(', ')} sind im Projekt nicht eingetragen. <button className="btn secondary sm" onClick={() => kstAnlegen(unbekannteKst)}>Im Projekt anlegen</button></div>
                )}
                {vorschau.protokoll.nichtZugeordneteKonten.length > 0 && <div className="hint" style={{ marginTop: 6 }}>Konten ohne Regel (werden als „Sonstiges“ übernommen): {vorschau.protokoll.nichtZugeordneteKonten.join(', ')}</div>}
                {vorschau.protokoll.fehler.length > 0 && (
                  <div className="scroll" style={{ maxHeight: 160, marginTop: 6 }}>
                    <table className="tbl compact"><thead><tr><th className="w-s">Zeile</th><th>Fehler</th></tr></thead>
                      <tbody>{vorschau.protokoll.fehler.slice(0, 200).map((f, i) => <tr key={i}><td>{f.zeile || '–'}</td><td>{f.text}</td></tr>)}</tbody></table>
                  </div>
                )}
                {quelle === 'fibu' && vorschau.kosten.length > 0 && (
                  <div className="scroll" style={{ maxHeight: 200, marginTop: 6 }}>
                    <table className="tbl compact">
                      <thead><tr><th>Datum</th><th>Kostenstelle</th><th>Konto</th><th>Text</th><th className="num">Betrag</th><th>Kostenart</th></tr></thead>
                      <tbody>{vorschau.kosten.slice(0, 50).map(k => <tr key={k.id}><td>{datumDe(k.datum)}</td><td>{k.kostenstelle}</td><td>{k.konto} {k.kontoBezeichnung}</td><td>{k.buchungstext}</td><td className="num">{num2(k.betrag)}</td><td>{KOSTENARTEN[k.kostenart]}{k.gemeinkosten && ' (BGK)'}{!k.zugeordnet && <span className="badge warn" style={{ marginLeft: 4 }}>ohne Regel</span>}</td></tr>)}</tbody>
                    </table>
                  </div>
                )}
                {quelle === 'baulohn' && vorschau.stunden.length > 0 && (
                  <div className="scroll" style={{ maxHeight: 200, marginTop: 6 }}>
                    <table className="tbl compact">
                      <thead><tr><th>Datum</th><th>Kostenstelle</th><th>Stundenart</th>{personenbezogen && <th>Mitarbeiter</th>}<th className="num">Stunden</th><th className="num">Lohnkosten</th></tr></thead>
                      <tbody>{vorschau.stunden.slice(0, 50).map(s => <tr key={s.id}><td>{datumDe(s.datum)}</td><td>{s.kostenstelle}</td><td>{s.stundenart || '–'}</td>{personenbezogen && <td>{s.mitarbeiterNr} {s.mitarbeiterName}</td>}<td className="num">{num2(s.stunden)}</td><td className="num">{s.lohnkosten == null ? '–' : num2(s.lohnkosten)}</td></tr>)}</tbody>
                    </table>
                  </div>
                )}
              </div>
            )}
          </Card>
        </>
      )}

      {tab === 'kostenstellen' && (
        <>
          <div className="cols">
            <Card title="Kostenstellen / Baustellennummern des Projekts" actions={<button className="btn sm" onClick={() => kstAnlegen([''])}>+ Kostenstelle</button>}>
              <p className="muted">Nummern so eintragen, wie sie im Export stehen. Mehrere Kostenstellen (Haupt- und Unterkostenstellen, Kostenträger) sind möglich. Eine Zuordnung zu einem LV-Titel erlaubt den Vergleich je Titel; Kostenstellen für Baustelleneinrichtung o. Ä. als Gemeinkosten kennzeichnen.</p>
              {nk.kostenstellen.length === 0 && <div className="empty">Noch keine Kostenstelle. Ohne Eintrag zählen alle importierten Zeilen.</div>}
              {nk.kostenstellen.length > 0 && (
                <table className="tbl compact">
                  <thead><tr><th className="w-m">Nummer</th><th>Bezeichnung</th><th>LV-Titel</th><th>BGK</th><th className="w-s"></th></tr></thead>
                  <tbody>
                    {nk.kostenstellen.map(k => (
                      <tr key={k.id}>
                        <td><input value={k.nummer} placeholder="4711" onChange={e => setKst(k.id, { nummer: e.target.value })} /></td>
                        <td><input value={k.bezeichnung} onChange={e => setKst(k.id, { bezeichnung: e.target.value })} /></td>
                        <td>
                          <select value={k.titelId ?? ''} onChange={e => setKst(k.id, { titelId: e.target.value || null })}>
                            <option value="">projektweit</option>
                            {projekt.lv.map(t => <option key={t.id} value={t.id}>{t.oz} {t.bezeichnung}</option>)}
                          </select>
                        </td>
                        <td><input type="checkbox" checked={k.gemeinkosten} title="Kosten dieser Kostenstelle als Gemeinkosten (BGK) zählen" onChange={e => setKst(k.id, { gemeinkosten: e.target.checked })} /></td>
                        <td><button className="btn ghost sm" onClick={() => confirmDelete(`Kostenstelle ${k.nummer}`) && setNk(n => ({ ...n, kostenstellen: n.kostenstellen.filter(x => x.id !== k.id) }))}>✕</button></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
              {importierteKst.length > 0 && (
                <div className="hint" style={{ marginTop: 8 }}>In den Importen vorhanden, aber nicht eingetragen: {importierteKst.join(', ')} <button className="btn secondary sm" onClick={() => kstAnlegen(importierteKst)}>Alle anlegen</button></div>
              )}
            </Card>
            <Card title="Ampelschwellen">
              <div className="grid grid-2">
                <div className="field"><label>Gelb ab Abweichung über Soll (%)</label><NumberInput value={nk.schwellen.gelb} onChange={v => setNk(n => ({ ...n, schwellen: { ...n.schwellen, gelb: v } }))} /></div>
                <div className="field"><label>Rot ab Abweichung über Soll (%)</label><NumberInput value={nk.schwellen.rot} onChange={v => setNk(n => ({ ...n, schwellen: { ...n.schwellen, rot: v } }))} /></div>
              </div>
              <p className="muted" style={{ marginTop: 8 }}>Die Schwellen gelten je Projekt für Kostenarten, Summen und Stunden.</p>
              <div className="row" style={{ marginTop: 10 }}>
                <button className="btn secondary sm" onClick={() => setNk(n => kostenNeuZuordnen(n, regeln))}>Kosten nach aktuellen Kontenregeln neu zuordnen</button>
                <button className="btn ghost sm" onClick={() => setView('stammdaten')}>Kontenregeln →</button>
              </div>
            </Card>
          </div>
          <Card title={`Importprotokoll (${nk.importe.length})`}>
            {nk.importe.length === 0 ? <div className="empty">Noch kein Import.</div> : (
              <table className="tbl compact">
                <thead><tr><th>Importiert am</th><th>Quelle</th><th>Datei / Profil</th><th>Zeitraum</th><th>Kostenstellen</th><th className="num">gelesen</th><th className="num">übernommen</th><th className="num">übersprungen</th><th className="num">Fehler</th><th>Personenbezogen</th><th></th></tr></thead>
                <tbody>
                  {[...nk.importe].reverse().map(i => (
                    <Fragment key={i.id}>
                      <tr>
                        <td>{i.importiertAm.slice(0, 10).split('-').reverse().join('.')} {i.importiertAm.slice(11, 16)}</td>
                        <td>{IMPORT_QUELLEN[i.quelle]}</td>
                        <td>{i.datei}<div className="muted" style={{ fontSize: 11 }}>{i.profilName}</div></td>
                        <td>{i.von ? `${datumDe(i.von)} – ${datumDe(i.bis)}` : '–'}</td>
                        <td>{i.kostenstellen.join(', ')}</td>
                        <td className="num">{i.zeilenGelesen}</td><td className="num">{i.uebernommen}{i.ersetzt > 0 && <span className="muted"> (ersetzt {i.ersetzt})</span>}</td><td className="num">{i.uebersprungen}</td>
                        <td className="num">{i.fehler.length}</td>
                        <td>{i.personenbezogen ? <span className="badge warn">ja</span> : 'nein'}</td>
                        <td><button className="btn danger sm" onClick={() => window.confirm(`Import „${i.datei}“ mit allen ${i.uebernommen} Zeilen löschen?`) && setNk(n => importLoeschen(n, i.id))}>Löschen</button></td>
                      </tr>
                      {i.fehler.length > 0 && <tr><td colSpan={11} className="muted" style={{ fontSize: 11 }}>{i.fehler.slice(0, 10).map(f => `Zeile ${f.zeile}: ${f.text}`).join(' · ')}{i.fehler.length > 10 && ` · … (${i.fehler.length} gesamt)`}</td></tr>}
                    </Fragment>
                  ))}
                </tbody>
              </table>
            )}
            <p className="muted" style={{ marginTop: 8 }}>Gesamt gespeichert: {nk.stunden.length} Stundenzeilen, {nk.kosten.length} Buchungen. Das Löschen eines Imports entfernt genau dessen Zeilen.</p>
          </Card>
        </>
      )}

      {tab === 'erfahrung' && (
        <Card title="Erfahrungswerte in die Kalkulation zurückführen" actions={<button className="btn" disabled={!erfAuswahl.size} onClick={erfUebernehmen}>Ausgewählte Ansätze übernehmen</button>}>
          <p className="muted">Vorschlag: Die Lohnansätze (Stunden je Einheit) werden mit dem Faktor Ist-Stunden ÷ Soll-Stunden zum Stichtag {datumDe(stichtag) || '(alle)'} skaliert – je Titel, wenn Kostenstellen Titeln zugeordnet sind, sonst projektweit. Nichts wird automatisch geändert; erst nach Auswahl, Bestätigung und Vorher/Nachher-Kontrolle.</p>
          {erfMeldung && <div className="hint" style={{ marginBottom: 8 }}>{erfMeldung}</div>}
          {erf.length === 0 ? <div className="empty">Keine Erfahrungswerte ableitbar: Es werden Soll-Stunden (Aufmaß bis Stichtag) und Ist-Stunden (Baulohn-Import) benötigt.</div> : erf.map(e => (
            <div key={erfKey(e)} style={{ marginBottom: 14 }}>
              <label className="check" style={{ fontSize: 14, fontWeight: 600 }}>
                <input type="checkbox" checked={erfAuswahl.has(erfKey(e))} onChange={ev => { const s = new Set(erfAuswahl); if (ev.target.checked) s.add(erfKey(e)); else s.delete(erfKey(e)); setErfAuswahl(s); }} />
                {e.bezeichnung} · Soll {num2(e.sollStunden)} h · Ist {num2(e.istStunden)} h · Faktor <b style={{ marginLeft: 4 }}>{num2(e.faktor)}</b>
                <span className={`ampel ${e.faktor > 1.15 ? 'rot' : e.faktor > 1.05 ? 'gelb' : 'gruen'}`} style={{ marginLeft: 8 }}>{e.faktor > 1 ? 'Mehraufwand' : 'Minderaufwand'}</span>
              </label>
              <table className="tbl compact" style={{ marginTop: 6 }}>
                <thead><tr><th>OZ</th><th>Position</th><th>Lohnansatz</th><th className="num">bisher h/E</th><th className="num">neu h/E</th></tr></thead>
                <tbody>
                  {e.positionen.map(p => p.ansaetze.map((a, i) => (
                    <tr key={a.ansatzId}>
                      <td>{i === 0 ? p.oz : ''}</td><td>{i === 0 ? `${p.kurztext} (je ${p.einheit})` : ''}</td><td>{a.bezeichnung || 'Lohn'}</td>
                      <td className="num">{numFlex(a.alt)}</td><td className="num"><b>{numFlex(a.neu)}</b></td>
                    </tr>
                  )))}
                </tbody>
              </table>
            </div>
          ))}
        </Card>
      )}
    </div>
  );

  function renderVergleich(v: Vergleich, cls?: string, einheit = '€') {
    const f = einheit === 'h' ? (x: number) => `${num2(x)} h` : num2;
    return (
      <tr key={v.bezeichnung} className={cls}>
        <td>{v.bezeichnung}</td><td className="num">{f(v.soll)}</td><td className="num">{f(v.ist)}</td>
        <td className="num" style={{ color: v.abweichung > 0 && v.soll > 0 ? 'var(--danger)' : undefined }}>{v.abweichung > 0 ? '+' : ''}{f(v.abweichung)}</td>
        <td className="num">{abw(v.prozent)}</td><td>{ampelBadge(v.ampel)}</td>
      </tr>
    );
  }
}
