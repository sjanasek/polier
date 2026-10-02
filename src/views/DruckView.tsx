import { useStore, useProjekt, type DruckArt } from '../store';
import { Card } from '../components/ui';
import type { Adresse, Projekt, Rechnung } from '../types';
import { KOSTENARTEN, KOSTENART_LISTE, PROJEKT_ARTEN } from '../types';
import { addDays, datumDe, eur, num2, num3, numFlex, pct, stationFmt } from '../lib/format';
import { aufmassZeileErgebnis, effektiverEP, kalkEP, kalkulation, lvSummen, rechnungBerechnen, zaehltInSumme, type KalkErgebnis } from '../lib/calc';
import { formelByNr, parameterShortName } from '../lib/formulas';
import { stationsAbschnitte, stationierungSumme } from '../lib/station';

const ARTEN: { art: DruckArt; label: string }[] = [
  { art: 'lv', label: 'LV / Ausschreibung (ohne Preise)' },
  { art: 'angebot', label: 'Angebot (mit Preisen)' },
  { art: 'rechnung', label: 'Rechnung' },
  { art: 'aufmass', label: 'Aufmaßblätter' },
  { art: 'kalkulation', label: 'Kalkulationsblatt' },
];

const TYPEN = { abschlag: 'Abschlagsrechnung', teilschluss: 'Teilschlussrechnung', schluss: 'Schlussrechnung' };

function AdresseBlock({ a, label }: { a: Adresse; label: string }) {
  return (
    <div>
      <div className="muted" style={{ fontSize: 10 }}>{label}</div>
      <div>{a.name}</div>
      {a.zusatz && <div>{a.zusatz}</div>}
      <div>{a.strasse}</div>
      <div>{a.plz} {a.ort}</div>
    </div>
  );
}

export function DruckView() {
  const { projekt } = useProjekt();
  const druck = useStore(s => s.druck);
  const setDruck = useStore(s => s.setDruck);
  const firma = useStore(s => s.stammdaten.firma);
  if (!projekt) return null;
  const art: DruckArt = druck?.art ?? (projekt.art === 'ausschreibung' ? 'lv' : 'angebot');
  const rechnungen = [...projekt.rechnungen].sort((a, b) => a.lfdNr - b.lfdNr);
  const rechnung = rechnungen.find(r => r.id === druck?.rechnungId) ?? rechnungen[rechnungen.length - 1];
  const erg = kalkulation(projekt);

  return (
    <div>
      <Card className="no-print">
        <div className="row">
          <select value={art} onChange={e => setDruck({ art: e.target.value as DruckArt, rechnungId: rechnung?.id })} style={{ width: 280 }}>
            {ARTEN.map(a => <option key={a.art} value={a.art}>{a.label}</option>)}
          </select>
          {art === 'rechnung' && (
            <select value={rechnung?.id ?? ''} onChange={e => setDruck({ art, rechnungId: e.target.value })} style={{ width: 300 }}>
              {rechnungen.map(r => <option key={r.id} value={r.id}>{r.lfdNr}. {TYPEN[r.typ]} {r.rechnungsNr}</option>)}
            </select>
          )}
          <span className="spacer" />
          <button className="btn" onClick={() => window.print()}>Drucken / als PDF speichern</button>
        </div>
      </Card>
      <div className="print-sheet">
        <div className="absender">{firma.name} · {firma.strasse} · {firma.plz} {firma.ort}</div>
        {art === 'lv' && <LVDruck projekt={projekt} erg={erg} mitPreisen={false} firma={firma} />}
        {art === 'angebot' && <LVDruck projekt={projekt} erg={erg} mitPreisen firma={firma} />}
        {art === 'rechnung' && (rechnung ? <RechnungDruck projekt={projekt} r={rechnung} erg={erg} firma={firma} /> : <p>Keine Rechnung vorhanden.</p>)}
        {art === 'aufmass' && <AufmassDruck projekt={projekt} />}
        {art === 'kalkulation' && <KalkDruck projekt={projekt} erg={erg} />}
        <div className="fuss">
          {firma.name}{firma.inhaber && ` · ${firma.inhaber}`} · {firma.strasse}, {firma.plz} {firma.ort}{firma.telefon && ` · Tel. ${firma.telefon}`}{firma.email && ` · ${firma.email}`}
          {firma.bank && <><br />{firma.bank} · IBAN {firma.iban} · BIC {firma.bic}</>}
          {(firma.ustId || firma.steuerNr) && <><br />{firma.ustId && `USt-IdNr. ${firma.ustId}`} {firma.steuerNr && `· Steuer-Nr. ${firma.steuerNr}`}</>}
        </div>
      </div>
    </div>
  );
}

function Kopf({ projekt, firma, titel, rechts }: { projekt: Projekt; firma: Adresse; titel: string; rechts?: React.ReactNode }) {
  return (
    <>
      <div className="kopf">
        <AdresseBlock a={projekt.auftraggeber} label="Auftraggeber" />
        <div>
          <AdresseBlock a={firma} label="Auftragnehmer / Bieter" />
          <div style={{ marginTop: 8 }}>
            <div><b>Projekt-Nr.:</b> {projekt.nummer}</div>
            <div><b>Datum:</b> {datumDe(projekt.datum)}</div>
            {rechts}
          </div>
        </div>
      </div>
      <h1>{titel}</h1>
      <div><b>{projekt.bauvorhaben || projekt.bezeichnung}</b>{projekt.bauort && ` · ${projekt.bauort}`}</div>
    </>
  );
}

function LVDruck({ projekt, erg, mitPreisen, firma }: { projekt: Projekt; erg: KalkErgebnis; mitPreisen: boolean; firma: Adresse }) {
  const s = lvSummen(projekt, erg);
  const titel = mitPreisen ? 'Angebot' : `Leistungsverzeichnis${projekt.art === 'ausschreibung' ? ' – Ausschreibung' : ''}`;
  return (
    <>
      <Kopf projekt={projekt} firma={firma} titel={titel} rechts={<div><b>Art:</b> {PROJEKT_ARTEN[projekt.art]}</div>} />
      {projekt.vorbemerkungen && <div className="text">{projekt.vorbemerkungen}</div>}
      <table>
        <thead>
          <tr><th style={{ width: 60 }}>OZ</th><th>Leistungsbeschreibung</th><th className="num" style={{ width: 70 }}>Menge</th><th style={{ width: 40 }}>Einh.</th><th className="num" style={{ width: 80 }}>EP €</th><th className="num" style={{ width: 90 }}>GP €</th></tr>
        </thead>
        <tbody>
          {projekt.lv.map(t => {
            const ts = s.titel.find(x => x.titel.id === t.id)?.summe ?? 0;
            return [
              <tr key={t.id} className="titel"><td>{t.oz}</td><td colSpan={5}>{t.bezeichnung}{t.vorbemerkung && <div className="lang">{t.vorbemerkung}</div>}</td></tr>,
              ...t.positionen.map(p => {
                const ep = effektiverEP(p, erg);
                const hinweis = p.art === 'H';
                const artTxt = p.art === 'B' ? ' (Bedarfsposition)' : p.art === 'A' ? ' (Alternativposition)' : p.art === 'Z' ? ' (Zulage)' : '';
                return (
                  <tr key={p.id}>
                    <td>{p.oz}</td>
                    <td><b>{p.kurztext}</b>{artTxt}{p.langtext && <div className="lang">{p.langtext}</div>}</td>
                    <td className="num">{hinweis ? '' : num3(p.menge)}</td>
                    <td>{p.einheit}</td>
                    <td className="num">{hinweis ? '' : mitPreisen ? num2(ep) : '............'}</td>
                    <td className="num">{hinweis ? '' : mitPreisen ? (zaehltInSumme(p) ? num2(p.menge * ep) : `(${num2(p.menge * ep)})`) : '............'}</td>
                  </tr>
                );
              }),
              <tr key={t.id + 's'} className="sum"><td></td><td colSpan={4}>Summe Titel {t.oz} {t.bezeichnung}</td><td className="num">{mitPreisen ? num2(ts) : '............'}</td></tr>,
            ];
          })}
        </tbody>
      </table>
      {mitPreisen ? (
        <table className="summen">
          <tbody>
            {s.titel.map(t => <tr key={t.titel.id}><td>Titel {t.titel.oz} {t.titel.bezeichnung}</td><td className="num">{num2(t.summe)}</td></tr>)}
            <tr className="sum"><td>Angebotssumme netto</td><td className="num">{num2(s.netto)}</td></tr>
            {s.nachlass > 0 && <><tr><td>− Nachlass {numFlex(projekt.nachlassProzent)} %</td><td className="num">− {num2(s.nachlass)}</td></tr><tr><td>Netto nach Nachlass</td><td className="num">{num2(s.nettoNachNachlass)}</td></tr></>}
            <tr><td>+ {numFlex(projekt.mwstProzent)} % MwSt.</td><td className="num">{num2(s.mwst)}</td></tr>
            <tr className="total"><td>Angebotssumme brutto</td><td className="num">{eur(s.brutto)}</td></tr>
            {s.eventual > 0 && <tr><td className="muted">Nachrichtlich Bedarfspositionen (netto)</td><td className="num muted">{num2(s.eventual)}</td></tr>}
          </tbody>
        </table>
      ) : (
        <table className="summen">
          <tbody>
            {projekt.lv.map(t => <tr key={t.id}><td>Summe Titel {t.oz} {t.bezeichnung}</td><td className="num">............ €</td></tr>)}
            <tr className="sum"><td>Angebotssumme netto</td><td className="num">............ €</td></tr>
            <tr><td>+ {numFlex(projekt.mwstProzent)} % MwSt.</td><td className="num">............ €</td></tr>
            <tr className="total"><td>Angebotssumme brutto</td><td className="num">............ €</td></tr>
          </tbody>
        </table>
      )}
      {mitPreisen && (
        <div className="text" style={{ marginTop: 16 }}>
          {projekt.skontoProzent > 0 && <div>Zahlungsbedingungen: {numFlex(projekt.skontoProzent)} % Skonto bei Zahlung innerhalb {projekt.skontoTage} Tagen, sonst {projekt.zahlungszielTage} Tage netto.</div>}
          <div>Es gelten die VOB/B und VOB/C. Abrechnung nach Aufmaß.</div>
          <div style={{ marginTop: 30 }}>______________________________<br /><small>Ort, Datum, Unterschrift / Firmenstempel</small></div>
        </div>
      )}
    </>
  );
}

function RechnungDruck({ projekt, r, erg, firma }: { projekt: Projekt; r: Rechnung; erg: KalkErgebnis; firma: Adresse }) {
  const re = rechnungBerechnen(projekt, r, erg);
  return (
    <>
      <Kopf projekt={projekt} firma={firma} titel={`${r.lfdNr}. ${TYPEN[r.typ]} Nr. ${r.rechnungsNr}`} rechts={
        <>
          <div><b>Rechnungsdatum:</b> {datumDe(r.datum)}</div>
          <div><b>Leistungsstand bis:</b> {datumDe(r.stichtag)}</div>
          <div><b>Fällig:</b> {datumDe(addDays(r.datum, r.zahlungszielTage))}</div>
        </>
      } />
      {r.bemerkung && <div className="text">{r.bemerkung}</div>}
      <h2>Leistungsstand (kumulativ)</h2>
      <table>
        <thead><tr><th style={{ width: 60 }}>OZ</th><th>Kurztext</th><th className="num">Menge kum.</th><th style={{ width: 36 }}>Einh.</th><th className="num">EP €</th><th className="num">GP €</th></tr></thead>
        <tbody>
          {projekt.lv.map(t => {
            const z = re.zeilen.filter(x => x.titel.id === t.id);
            if (!z.length) return null;
            const ts = re.titelSummen.find(x => x.titel.id === t.id)?.summe ?? 0;
            return [
              <tr key={t.id} className="titel"><td>{t.oz}</td><td colSpan={5}>{t.bezeichnung}</td></tr>,
              ...z.map(x => <tr key={x.position.id}><td>{x.position.oz}</td><td>{x.position.kurztext}</td><td className="num">{num3(x.mengeKum)}</td><td>{x.position.einheit}</td><td className="num">{num2(x.ep)}</td><td className="num">{num2(x.gpKum)}</td></tr>),
              <tr key={t.id + 's'} className="sum"><td></td><td colSpan={4}>Summe Titel {t.oz}</td><td className="num">{num2(ts)}</td></tr>,
            ];
          })}
        </tbody>
      </table>
      <table className="summen">
        <tbody>
          <tr><td>Leistungsstand gesamt netto</td><td className="num">{num2(re.leistungKum)}</td></tr>
          {re.nachlass !== 0 && <tr><td>− Nachlass {numFlex(r.nachlassProzent)} %</td><td className="num">− {num2(re.nachlass)}</td></tr>}
          {re.sicherheitseinbehalt !== 0 && <tr><td>− Sicherheitseinbehalt {numFlex(r.sicherheitseinbehaltProzent)} %</td><td className="num">− {num2(re.sicherheitseinbehalt)}</td></tr>}
          {r.sonstigeAbzuege.map(a => <tr key={a.id}><td>− {a.bezeichnung}</td><td className="num">− {num2(a.betrag)}</td></tr>)}
          <tr className="sum"><td>Netto</td><td className="num">{num2(re.nettoZahlbar)}</td></tr>
          <tr><td>{r.reverseCharge ? 'Umsatzsteuer: Steuerschuldnerschaft des Leistungsempfängers (§ 13b UStG)' : `+ ${numFlex(projekt.mwstProzent)} % MwSt.`}</td><td className="num">{num2(re.mwst)}</td></tr>
          <tr className="sum"><td>Brutto kumuliert</td><td className="num">{num2(re.bruttoKum)}</td></tr>
          {re.vorherige.map(v => <tr key={v.id}><td>− {v.lfdNr}. {TYPEN[v.typ]} Nr. {v.rechnungsNr} vom {datumDe(v.datum)}</td><td className="num">− {num2(rechnungBerechnen(projekt, v, erg).rechnungsbetrag)}</td></tr>)}
          <tr className="total"><td>Rechnungsbetrag</td><td className="num">{eur(re.rechnungsbetrag)}</td></tr>
        </tbody>
      </table>
      <div className="text" style={{ marginTop: 14 }}>
        Bitte überweisen Sie den Rechnungsbetrag bis zum {datumDe(addDays(r.datum, r.zahlungszielTage))} unter Angabe der Rechnungsnummer.
        {r.skontoProzent > 0 && ` Bei Zahlung bis zum ${datumDe(addDays(r.datum, r.skontoTage))} gewähren wir ${numFlex(r.skontoProzent)} % Skonto (${eur(re.skontoBetrag)}), Zahlbetrag dann ${eur(re.rechnungsbetrag - re.skontoBetrag)}.`}
        {r.reverseCharge && ' Die Umsatzsteuer schuldet der Leistungsempfänger gemäß § 13b UStG.'}
      </div>
    </>
  );
}

function AufmassDruck({ projekt }: { projekt: Projekt }) {
  const pos = new Map(projekt.lv.flatMap(t => t.positionen).map(p => [p.id, p]));
  const blaetter = Array.from(new Set(projekt.aufmass.map(z => z.blattNr))).sort();
  return (
    <>
      <h1>Aufmaßblätter</h1>
      <div><b>{projekt.bauvorhaben || projekt.bezeichnung}</b> · Projekt-Nr. {projekt.nummer} · AG: {projekt.auftraggeber.name}</div>
      {blaetter.map(b => {
        const zeilen = projekt.aufmass.filter(z => z.blattNr === b);
        return (
          <div key={b} style={{ marginTop: 14 }}>
            <h2>Blatt {b} · {datumDe(zeilen[0].datum)}</h2>
            <table>
              <thead><tr><th style={{ width: 70 }}>Pos.</th><th style={{ width: 60 }}>Formel</th><th>Ansatz</th><th className="num" style={{ width: 70 }}>Faktor</th><th className="num" style={{ width: 90 }}>Ergebnis</th><th>Bemerkung</th></tr></thead>
              <tbody>
                {zeilen.map(z => {
                  const f = formelByNr(z.formelNr);
                  const r = aufmassZeileErgebnis(z);
                  const p = pos.get(z.positionId);
                  const ansatz = z.formelNr === '91' ? z.freieFormel : f.text;
                  const werte = f.params.map((pn, i) => `${parameterShortName(pn)}=${numFlex(z.werte[i] ?? 0)}`).filter((_, i) => z.formelNr !== '91' || (z.werte[i] ?? 0) !== 0).join('; ');
                  return (
                    <tr key={z.id}>
                      <td>{p?.oz}</td><td>{f.nr}</td>
                      <td><span className="formel-text">{ansatz}</span><br /><small>{werte}</small></td>
                      <td className="num">{z.faktor !== 1 ? numFlex(z.faktor) : ''}{z.abzug ? ' Abzug' : ''}</td>
                      <td className="num">{num3(r.wert)} {p?.einheit}</td>
                      <td>{z.bemerkung}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        );
      })}
      {projekt.stationierungen.map(s => {
        const p = pos.get(s.positionId);
        return (
          <div key={s.id} style={{ marginTop: 14 }}>
            <h2>Stationierung {s.blattNr} · {s.bezeichnung} · {datumDe(s.datum)} · Pos. {p?.oz}</h2>
            <table>
              <thead><tr><th>von</th><th>bis</th><th className="num">Δl (m)</th><th className="num">Q₁</th><th className="num">Q₂</th><th className="num">Ergebnis</th></tr></thead>
              <tbody>
                {stationsAbschnitte(s).map((a, i) => <tr key={i}><td>{stationFmt(a.von.station)}</td><td>{stationFmt(a.bis.station)}</td><td className="num">{num3(a.laenge)}</td><td className="num">{num3(a.q1)}</td><td className="num">{num3(a.q2)}</td><td className="num">{num3(a.ergebnis)}</td></tr>)}
                <tr className="sum"><td colSpan={5}>Summe{s.abzug ? ' (Abzug)' : ''}</td><td className="num">{num3(stationierungSumme(s))} {p?.einheit}</td></tr>
              </tbody>
            </table>
          </div>
        );
      })}
      <div className="text" style={{ marginTop: 30 }}>______________________________ &nbsp;&nbsp;&nbsp; ______________________________<br /><small>Auftragnehmer &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp; Auftraggeber / Bauleitung</small></div>
    </>
  );
}

function KalkDruck({ projekt, erg }: { projekt: Projekt; erg: KalkErgebnis }) {
  return (
    <>
      <h1>Kalkulationsblatt</h1>
      <div><b>{projekt.bauvorhaben || projekt.bezeichnung}</b> · Projekt-Nr. {projekt.nummer} · {projekt.kalk.methode === 'endsumme' ? 'Kalkulation über die Angebotsendsumme' : 'Zuschlagskalkulation'}</div>
      <h2>Schlussblatt</h2>
      <table className="summen" style={{ width: '70%', marginLeft: 0 }}>
        <tbody>
          {KOSTENART_LISTE.map(ka => <tr key={ka}><td>EKT {KOSTENARTEN[ka]}</td><td className="num">{num2(erg.ektSumme[ka])}</td><td className="num">Zuschlag {pct(Math.round(erg.zuschlagsaetze[ka] * 100) / 100)}</td></tr>)}
          <tr className="sum"><td>Summe EKT</td><td className="num">{num2(erg.ektGesamt)}</td><td></td></tr>
          <tr><td>+ BGK</td><td className="num">{num2(erg.bgk)}</td><td></td></tr>
          <tr><td>+ AGK</td><td className="num">{num2(erg.agk)}</td><td></td></tr>
          <tr><td>+ Wagnis &amp; Gewinn</td><td className="num">{num2(erg.wug)}</td><td></td></tr>
          <tr className="total"><td>Angebotssumme netto</td><td className="num">{eur(erg.angebotssumme)}</td><td></td></tr>
        </tbody>
      </table>
      <h2>Positionen</h2>
      <table>
        <thead><tr><th>OZ</th><th>Kurztext</th><th className="num">Menge</th>{KOSTENART_LISTE.map(ka => <th key={ka} className="num">{KOSTENARTEN[ka].split(' ')[0]}</th>)}<th className="num">EKT/E</th><th className="num">EP</th><th className="num">GP</th></tr></thead>
        <tbody>
          {projekt.lv.map(t => [
            <tr key={t.id} className="titel"><td>{t.oz}</td><td colSpan={10}>{t.bezeichnung}</td></tr>,
            ...t.positionen.filter(p => p.art !== 'H').map(p => {
              const r = kalkEP(p, erg);
              const ep = effektiverEP(p, erg);
              return <tr key={p.id}><td>{p.oz}</td><td>{p.kurztext}</td><td className="num">{numFlex(p.menge)} {p.einheit}</td>{KOSTENART_LISTE.map(ka => <td key={ka} className="num">{r.ekt[ka] ? num2(r.ekt[ka]) : ''}</td>)}<td className="num">{num2(r.ektSumme)}</td><td className="num">{num2(ep)}</td><td className="num">{num2(ep * p.menge)}</td></tr>;
            }),
          ])}
        </tbody>
      </table>
    </>
  );
}
