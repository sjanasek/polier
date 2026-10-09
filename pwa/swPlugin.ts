import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import type { Plugin } from 'vite';

export interface BuildDatei { pfad: string; inhalt: Uint8Array }

const AUSGESCHLOSSEN = new Set(['sw.js', '.htaccess']);

/** Setzt Dateiliste und Versionskennung (Hash über alle Dateien) in die Service-Worker-Vorlage ein. */
export function erzeugeServiceWorker(vorlage: string, dateien: BuildDatei[]): string {
  const relevant = dateien
    .map(d => ({ ...d, pfad: d.pfad.replace(/\\/g, '/') }))
    .filter(d => !AUSGESCHLOSSEN.has(d.pfad))
    .sort((a, b) => a.pfad.localeCompare(b.pfad));
  const hash = crypto.createHash('sha256');
  for (const d of relevant) { hash.update(d.pfad); hash.update('\0'); hash.update(d.inhalt); hash.update('\0'); }
  const version = hash.digest('hex').slice(0, 12);
  return vorlage.replace('__VERSION__', () => version).replace('__PRECACHE__', () => JSON.stringify(relevant.map(d => d.pfad)));
}

function alleDateien(dir: string, basis = dir): BuildDatei[] {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap(e => {
    const voll = path.join(dir, e.name);
    return e.isDirectory() ? alleDateien(voll, basis) : [{ pfad: path.relative(basis, voll), inhalt: fs.readFileSync(voll) }];
  });
}

/** Vite-Plugin: schreibt nach dem Build dist/sw.js mit der vollständigen Dateiliste. */
export function polierServiceWorker(): Plugin {
  let outDir = 'dist';
  let root = process.cwd();
  return {
    name: 'polier-service-worker',
    apply: 'build',
    configResolved(config) { outDir = config.build.outDir; root = config.root; },
    closeBundle() {
      const ziel = path.resolve(root, outDir);
      const vorlage = fs.readFileSync(path.resolve(root, 'pwa/sw.template.js'), 'utf8');
      fs.writeFileSync(path.join(ziel, 'sw.js'), erzeugeServiceWorker(vorlage, alleDateien(ziel)));
    },
  };
}
