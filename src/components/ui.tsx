import { useEffect, useState, type ReactNode } from 'react';
import { numFlex, num2, parseDe } from '../lib/format';

/** Zahleneingabe mit deutscher Schreibweise (Komma), schreibt beim Verlassen zurück */
export function NumberInput({ value, onChange, decimals = 2, disabled, placeholder, className = '', title }: {
  value: number; onChange: (v: number) => void; decimals?: number; disabled?: boolean; placeholder?: string; className?: string; title?: string;
}) {
  const fmt = (v: number) => (decimals === 2 ? num2(v) : numFlex(v));
  const [txt, setTxt] = useState(fmt(value));
  const [focus, setFocus] = useState(false);
  useEffect(() => { if (!focus) setTxt(fmt(value)); }, [value, focus, decimals]);
  return (
    <input
      className={`num ${className}`}
      value={txt}
      disabled={disabled}
      placeholder={placeholder}
      title={title}
      inputMode="decimal"
      onFocus={e => { setFocus(true); e.target.select(); }}
      onChange={e => setTxt(e.target.value)}
      onBlur={() => { setFocus(false); const n = parseDe(txt); onChange(n); setTxt(fmt(n)); }}
      onKeyDown={e => { if (e.key === 'Enter') (e.target as HTMLInputElement).blur(); }}
    />
  );
}

export function Field({ label, children, span }: { label: string; children: ReactNode; span?: number }) {
  return (
    <div className="field" style={span ? { gridColumn: `span ${span}` } : undefined}>
      <label>{label}</label>
      {children}
    </div>
  );
}

export function TextField({ label, value, onChange, span, placeholder, type = 'text' }: { label: string; value: string; onChange: (v: string) => void; span?: number; placeholder?: string; type?: string }) {
  return (
    <Field label={label} span={span}>
      <input type={type} value={value} placeholder={placeholder} onChange={e => onChange(e.target.value)} />
    </Field>
  );
}

export function NumField({ label, value, onChange, span, decimals, suffix }: { label: string; value: number; onChange: (v: number) => void; span?: number; decimals?: number; suffix?: string }) {
  return (
    <Field label={suffix ? `${label} (${suffix})` : label} span={span}>
      <NumberInput value={value} onChange={onChange} decimals={decimals} />
    </Field>
  );
}

export function SelectField<T extends string>({ label, value, onChange, options, span }: { label: string; value: T; onChange: (v: T) => void; options: { value: T; label: string }[]; span?: number }) {
  return (
    <Field label={label} span={span}>
      <select value={value} onChange={e => onChange(e.target.value as T)}>
        {options.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
      </select>
    </Field>
  );
}

export function Card({ title, actions, children, className = '' }: { title?: ReactNode; actions?: ReactNode; children: ReactNode; className?: string }) {
  return (
    <div className={`card ${className}`}>
      {(title || actions) && (
        <div className="card-head">
          {title && <h2>{title}</h2>}
          {actions}
        </div>
      )}
      {children}
    </div>
  );
}

export function KPI({ label, value, big }: { label: string; value: string; big?: boolean }) {
  return (
    <div className={`kpi ${big ? 'big' : ''}`}>
      <div className="lbl">{label}</div>
      <div className="val">{value}</div>
    </div>
  );
}

export function Empty({ children }: { children: ReactNode }) {
  return <div className="empty">{children}</div>;
}

export function confirmDelete(what: string): boolean {
  return window.confirm(`${what} wirklich löschen?`);
}
