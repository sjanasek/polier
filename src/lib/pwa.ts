// ---------------------------------------------------------------------------
// PWA: Service-Worker-Registrierung, Update-Hinweis, Installationshilfe, Online-Status.
// Der Service Worker wird nur im Produktions-Build registriert (nicht im Dev-Server).
// ---------------------------------------------------------------------------
import { useSyncExternalStore } from 'react';

export interface PwaStatus {
  /** Service Worker aktiv: die App startet auch ohne Netz */
  offlineBereit: boolean;
  /** neue Version geladen und wartet auf Bestätigung */
  updateVerfuegbar: boolean;
  online: boolean;
  /** läuft als installierte App (Startbildschirm / eigenes Fenster) */
  installiert: boolean;
  /** Browser bietet die Installation per Knopf an (Chrome, Edge, Android) */
  installierbar: boolean;
  /** Browser hat dauerhaften Speicher zugesagt (Daten werden nicht automatisch gelöscht) */
  speicherDauerhaft: boolean | null;
  /** Service Worker im Browser überhaupt verfügbar (HTTPS bzw. localhost nötig) */
  swUnterstuetzt: boolean;
}

let status: PwaStatus = {
  offlineBereit: false, updateVerfuegbar: false, online: true, installiert: false, installierbar: false,
  speicherDauerhaft: null, swUnterstuetzt: false,
};
const listeners = new Set<() => void>();
const setStatus = (patch: Partial<PwaStatus>) => { status = { ...status, ...patch }; listeners.forEach(l => l()); };
const subscribe = (l: () => void) => { listeners.add(l); return () => { listeners.delete(l); }; };
export const usePwa = (): PwaStatus => useSyncExternalStore(subscribe, () => status);

let registrierung: ServiceWorkerRegistration | undefined;
let installAngebot: (Event & { prompt: () => Promise<void>; userChoice: Promise<{ outcome: string }> }) | null = null;
let nutzerWillUpdate = false;
let letztePruefung = 0;

/** iPhone/iPad erkennen (iPadOS meldet sich im Desktop-Modus als Mac mit Touch) */
export function erkenneIOS(userAgent: string, plattform: string, touchPunkte: number): boolean {
  return /iPad|iPhone|iPod/.test(userAgent) || (plattform === 'MacIntel' && touchPunkte > 1);
}

export const istIOS = (): boolean => typeof navigator !== 'undefined' && erkenneIOS(navigator.userAgent, navigator.platform, navigator.maxTouchPoints ?? 0);

const laeuftAlsApp = (): boolean =>
  (typeof window.matchMedia === 'function' && window.matchMedia('(display-mode: standalone)').matches) || (navigator as unknown as { standalone?: boolean }).standalone === true;

export function initPwa(): void {
  setStatus({ online: navigator.onLine, installiert: laeuftAlsApp(), swUnterstuetzt: 'serviceWorker' in navigator });
  window.addEventListener('online', () => setStatus({ online: true }));
  window.addEventListener('offline', () => setStatus({ online: false }));
  window.addEventListener('beforeinstallprompt', e => {
    e.preventDefault();
    installAngebot = e as unknown as NonNullable<typeof installAngebot>;
    setStatus({ installierbar: true });
  });
  window.addEventListener('appinstalled', () => { installAngebot = null; setStatus({ installierbar: false, installiert: true }); });

  // Daten gegen automatisches Aufräumen durch den Browser schützen (Speicher bleibt dauerhaft)
  if (import.meta.env.PROD && navigator.storage?.persist) {
    navigator.storage.persisted().then(p => p ? true : navigator.storage.persist()).then(p => setStatus({ speicherDauerhaft: p })).catch(() => undefined);
  }

  if (!import.meta.env.PROD || !('serviceWorker' in navigator)) return;

  navigator.serviceWorker.register('./sw.js').then(reg => {
    registrierung = reg;
    if (reg.waiting && navigator.serviceWorker.controller) setStatus({ updateVerfuegbar: true });
    reg.addEventListener('updatefound', () => {
      const neu = reg.installing;
      neu?.addEventListener('statechange', () => {
        if (neu.state === 'installed' && navigator.serviceWorker.controller) setStatus({ updateVerfuegbar: true });
      });
    });
  }).catch(() => undefined);
  navigator.serviceWorker.ready.then(() => setStatus({ offlineBereit: true })).catch(() => undefined);

  // Nach dem Wechsel auf die neue Version einmal neu laden, aber nur auf ausdrücklichen Wunsch
  navigator.serviceWorker.addEventListener('controllerchange', () => { if (nutzerWillUpdate) window.location.reload(); });
  // Lange geöffnete App (z. B. auf dem Startbildschirm) prüft beim Zurückkehren auf neue Versionen
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible' && Date.now() - letztePruefung > 10 * 60 * 1000) pruefeUpdate();
  });
}

export async function pruefeUpdate(): Promise<void> {
  letztePruefung = Date.now();
  try { await registrierung?.update(); } catch { /* offline o. ä. */ }
}

export function aktualisieren(): void {
  nutzerWillUpdate = true;
  if (registrierung?.waiting) registrierung.waiting.postMessage('SKIP_WAITING');
  else window.location.reload();
}

export async function installieren(): Promise<boolean> {
  if (!installAngebot) return false;
  await installAngebot.prompt();
  const { outcome } = await installAngebot.userChoice;
  installAngebot = null;
  setStatus({ installierbar: false });
  return outcome === 'accepted';
}
