import type { Stationierung, StationsProfil } from '../types';
import { round3 } from './format';

export interface StationsAbschnitt {
  von: StationsProfil;
  bis: StationsProfil;
  laenge: number;
  q1: number; // Querschnittswert (Breite oder Fläche) am Anfang
  q2: number;
  ergebnis: number;
}

/** Querschnittswert eines Profils je nach Modus */
export function profilWert(s: Stationierung, pr: StationsProfil): number {
  switch (s.modus) {
    case 'laenge': return 1;
    case 'flaeche': return pr.wert;
    case 'volumen': return pr.wert;
    case 'volumenBT': return pr.wert * pr.wert2;
  }
}

/** Abschnittsweise Berechnung nach dem Mittelwertverfahren (Gauß-Elling) */
export function stationsAbschnitte(s: Stationierung): StationsAbschnitt[] {
  const profile = [...s.profile].sort((a, b) => a.station - b.station);
  const out: StationsAbschnitt[] = [];
  for (let i = 0; i < profile.length - 1; i++) {
    const von = profile[i], bis = profile[i + 1];
    const laenge = bis.station - von.station;
    const q1 = profilWert(s, von), q2 = profilWert(s, bis);
    const ergebnis = s.modus === 'laenge' ? laenge : ((q1 + q2) / 2) * laenge;
    out.push({ von, bis, laenge, q1, q2, ergebnis: round3(ergebnis) });
  }
  return out;
}

export function stationierungSumme(s: Stationierung): number {
  const sum = stationsAbschnitte(s).reduce((a, b) => a + b.ergebnis, 0);
  return round3(sum * (s.faktor || 1) * (s.abzug ? -1 : 1));
}
