import { useState } from 'react';
import { aktualisieren, installieren, istIOS, pruefeUpdate, usePwa } from '../lib/pwa';
import { Card } from './ui';

/** Hinweisleiste am unteren Rand, wenn eine neue Version bereitsteht */
export function UpdateHinweis() {
  const { updateVerfuegbar } = usePwa();
  const [versteckt, setVersteckt] = useState(false);
  if (!updateVerfuegbar || versteckt) return null;
  return (
    <div className="pwa-banner no-print" role="status">
      <span><b>Neue Version verfügbar.</b> Ihre Daten bleiben erhalten.</span>
      <button className="btn sm" onClick={aktualisieren}>Jetzt aktualisieren</button>
      <button className="btn ghost sm" onClick={() => setVersteckt(true)}>Später</button>
    </div>
  );
}

/** Kleine Kennzeichnung in der Kopfleiste, solange kein Netz da ist */
export function OfflineMarke() {
  const { online } = usePwa();
  if (online) return null;
  return <span className="badge warn" title="Kein Netz. Alle Funktionen arbeiten mit den lokal gespeicherten Daten.">Offline</span>;
}

/** Karte in den Stammdaten: Installation, Offline-Bereitschaft, Updates */
export function PwaKarte() {
  const s = usePwa();
  const [meldung, setMeldung] = useState('');
  const ios = istIOS();
  const zeile = (label: string, wert: string, ok?: boolean) => (
    <tr><td>{label}</td><td>{ok === undefined ? wert : <span className={`badge ${ok ? 'ok' : 'warn'}`}>{wert}</span>}</td></tr>
  );
  return (
    <Card title="App installieren und Offline-Betrieb">
      <p className="muted">Polier lässt sich wie eine App auf dem Startbildschirm oder Desktop ablegen und funktioniert danach auch ohne Netz. Die Daten bleiben dabei auf diesem Gerät.</p>
      <table className="tbl compact">
        <tbody>
          {zeile('Installiert als App', s.installiert ? 'ja' : 'nein', s.installiert)}
          {zeile('Offline startbar', s.offlineBereit ? 'ja' : s.swUnterstuetzt ? 'wird vorbereitet oder nur im veröffentlichten Build' : 'nicht verfügbar (HTTPS nötig)', s.offlineBereit)}
          {zeile('Netzstatus', s.online ? 'online' : 'offline', s.online)}
          {zeile('Dauerhafter Datenspeicher', s.speicherDauerhaft === null ? 'unbekannt' : s.speicherDauerhaft ? 'zugesagt' : 'nicht zugesagt', s.speicherDauerhaft ?? undefined)}
        </tbody>
      </table>
      <div className="row" style={{ marginTop: 10 }}>
        {s.installierbar && <button className="btn" onClick={() => installieren()}>App installieren</button>}
        <button className="btn secondary" onClick={async () => { setMeldung('Prüfe …'); await pruefeUpdate(); setMeldung('Prüfung abgeschlossen. Ist eine neue Version da, erscheint ein Hinweis am unteren Rand.'); }}>Auf Updates prüfen</button>
      </div>
      {meldung && <p className="muted" style={{ marginTop: 6 }}>{meldung}</p>}
      {!s.installiert && ios && <div className="hint" style={{ marginTop: 10 }}>iPhone und iPad: In Safari unten bzw. oben auf das Teilen-Symbol tippen, dann <b>„Zum Home-Bildschirm“</b> wählen. Nur in Safari möglich, nicht in anderen Browsern. Als App abgelegt, löscht iOS die Daten nicht nach einigen Tagen ohne Nutzung. <b>Wichtig:</b> Die installierte App hat einen eigenen Datenspeicher, getrennt von Safari. Vorher unten eine Sicherung exportieren und in der App wieder importieren.</div>}
      {!s.installiert && !ios && !s.installierbar && <div className="hint" style={{ marginTop: 10 }}>Chrome und Edge: Im Browsermenü „App installieren“ bzw. „Zum Startbildschirm hinzufügen“ wählen. Der Knopf erscheint hier, sobald der Browser die Installation anbietet.</div>}
    </Card>
  );
}
