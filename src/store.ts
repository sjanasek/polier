import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { Projekt, Stammdaten } from './types';
import { neuesProjekt, standardStammdaten } from './lib/defaults';
import { demoProjekt } from './lib/demo';

export type View = 'projekte' | 'lv' | 'kalkulation' | 'aufmass' | 'stationierung' | 'rechnungen' | 'druck' | 'stammdaten';

export type DruckArt = 'lv' | 'angebot' | 'rechnung' | 'aufmass' | 'kalkulation';

export interface DruckAuftrag { art: DruckArt; rechnungId?: string }

interface State {
  projekte: Projekt[];
  aktivId: string | null;
  stammdaten: Stammdaten;
  view: View;
  druck: DruckAuftrag | null;
  setView: (v: View) => void;
  setDruck: (d: DruckAuftrag | null) => void;
  setAktiv: (id: string | null) => void;
  addProjekt: (p?: Projekt) => string;
  deleteProjekt: (id: string) => void;
  updateProjekt: (id: string, fn: (p: Projekt) => Projekt) => void;
  updateStammdaten: (fn: (s: Stammdaten) => Stammdaten) => void;
  importAll: (data: { projekte: Projekt[]; stammdaten: Stammdaten }) => void;
}

const demo = demoProjekt();

export const useStore = create<State>()(
  persist(
    (set, get) => ({
      projekte: [demo],
      aktivId: demo.id,
      stammdaten: standardStammdaten(),
      view: 'projekte',
      druck: null,
      setView: view => set({ view }),
      setDruck: druck => set({ druck, view: druck ? 'druck' : get().view }),
      setAktiv: aktivId => set({ aktivId }),
      addProjekt: p => {
        const nr = `${new Date().getFullYear()}-${String(get().projekte.length + 1).padStart(3, '0')}`;
        const np = p ?? neuesProjekt(nr);
        set(s => ({ projekte: [...s.projekte, np], aktivId: np.id }));
        return np.id;
      },
      deleteProjekt: id => set(s => {
        const projekte = s.projekte.filter(p => p.id !== id);
        return { projekte, aktivId: s.aktivId === id ? projekte[0]?.id ?? null : s.aktivId };
      }),
      updateProjekt: (id, fn) => set(s => ({ projekte: s.projekte.map(p => (p.id === id ? fn(p) : p)) })),
      updateStammdaten: fn => set(s => ({ stammdaten: fn(s.stammdaten) })),
      importAll: data => set({ projekte: data.projekte, stammdaten: data.stammdaten, aktivId: data.projekte[0]?.id ?? null }),
    }),
    { name: 'polier-v1', partialize: s => ({ projekte: s.projekte, aktivId: s.aktivId, stammdaten: s.stammdaten }) },
  ),
);

/** Aktives Projekt + Updater */
export function useProjekt() {
  const projekt = useStore(s => s.projekte.find(p => p.id === s.aktivId) ?? null);
  const updateProjekt = useStore(s => s.updateProjekt);
  const update = (fn: (p: Projekt) => Projekt) => projekt && updateProjekt(projekt.id, fn);
  return { projekt, update };
}
