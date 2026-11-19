/**
 * Admin UI building blocks. Class names come from brand.css (brand-reference.html).
 */
import { createContext, useCallback, useContext, useEffect, useId, useRef, useState, type ReactNode } from 'react';
import { statusLabel, time, dayShort, type LeadStatus, type Priority } from '@frr/shared';

// ---------- icons (24x24, stroke 1.8, BRAND.md section 6) ----------
const paths: Record<string, ReactNode> = {
  today: <><path d="M4 11.5 12 5l8 6.5" /><path d="M6 10v9h12v-9" /><path d="M10 19v-5h4v5" /></>,
  leads: <><path d="M8 6h12M8 12h12M8 18h12" /><circle cx="4" cy="6" r="1" /><circle cx="4" cy="12" r="1" /><circle cx="4" cy="18" r="1" /></>,
  estimate: <><rect x="5" y="3" width="14" height="18" rx="2" /><path d="M8 7h8M8 11h2M12 11h2M16 11h0M8 15h2M12 15h2M8 18h2M12 18h2" /><path d="M16 15v3" /></>,
  calendar: <><rect x="3.5" y="5" width="17" height="15" rx="2" /><path d="M3.5 10h17M8 3v4M16 3v4" /></>,
  settings: <><circle cx="12" cy="12" r="3" /><path d="M12 2.5v3M12 18.5v3M4.2 7l2.6 1.5M17.2 15.5l2.6 1.5M4.2 17l2.6-1.5M17.2 8.5 19.8 7" /></>,
  phone: <path d="M5 4h4l2 5-2.5 1.5a11 11 0 0 0 5 5L15 13l5 2v4a2 2 0 0 1-2 2A16 16 0 0 1 3 6a2 2 0 0 1 2-2" />,
  text: <><path d="M4 5h16v11H9l-5 4z" /></>,
  mail: <><rect x="3" y="5" width="18" height="14" rx="2" /><path d="m3.5 6 8.5 7 8.5-7" /></>,
  map: <><path d="M12 21s-6.5-6-6.5-11a6.5 6.5 0 0 1 13 0c0 5-6.5 11-6.5 11z" /><circle cx="12" cy="10" r="2.3" /></>,
  plus: <path d="M12 5v14M5 12h14" />,
  minus: <path d="M5 12h14" />,
  left: <path d="m15 5-7 7 7 7" />,
  right: <path d="m9 5 7 7-7 7" />,
  close: <path d="M6 6l12 12M18 6 6 18" />,
  check: <path d="m5 12.5 4.5 4.5L19 7.5" />,
  copy: <><rect x="8" y="8" width="12" height="12" rx="2" /><path d="M16 8V5a1 1 0 0 0-1-1H5a1 1 0 0 0-1 1v10a1 1 0 0 0 1 1h3" /></>,
  photo: <><rect x="3" y="5" width="18" height="14" rx="2" /><circle cx="9" cy="10" r="1.8" /><path d="m21 16-5-5-9 8" /></>,
  print: <><path d="M7 9V3h10v6" /><rect x="3" y="9" width="18" height="8" rx="2" /><path d="M7 14h10v7H7z" /></>,
  out: <><path d="M14 4h5v16h-5" /><path d="M10 8l-4 4 4 4M6 12h10" /></>,
};

export function Icon({ name, size = 22 }: { name: keyof typeof paths | string; size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={size <= 16 ? 2.2 : 1.8} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      {paths[name]}
    </svg>
  );
}

// ---------- status + priority ----------
export function StatusPill({ status, visitAt }: { status: LeadStatus; visitAt?: string }) {
  const label = status === 'visit' && visitAt ? `Visit ${dayShort(visitAt)} · ${time(visitAt.slice(11, 16), true)}` : statusLabel(status);
  return <span className={`pill pill--${status}`}>{label}</span>;
}

export function Pri({ p }: { p: Priority }) {
  return <span className={`pri pri--${p}`}>{p === 'high' ? 'High' : p === 'low' ? 'Low' : 'Normal'}</span>;
}

// ---------- form controls ----------
export function Choices<T extends string>({
  label,
  options,
  value,
  onChange,
  hideLabel,
}: {
  label: string;
  options: readonly { id: T; label: string }[];
  value: T;
  onChange: (v: T) => void;
  hideLabel?: boolean;
}) {
  return (
    <fieldset className="choice-set">
      <legend className={hideLabel ? 'sr-only' : 'control-label'}>{label}</legend>
      <div className="choices">
        {options.map((o) => (
          <button key={o.id} type="button" className="choice" aria-pressed={value === o.id} onClick={() => onChange(o.id)}>
            {o.label}
          </button>
        ))}
      </div>
    </fieldset>
  );
}

export function Stepper({
  label,
  unit,
  value,
  step,
  min,
  max,
  onChange,
  help,
}: {
  label: string;
  unit: string;
  value: number;
  step: number;
  min: number;
  max: number;
  onChange: (v: number) => void;
  help?: string;
}) {
  const id = useId();
  const [draft, setDraft] = useState<string | null>(null);
  const clamp = (n: number) => Math.min(max, Math.max(min, n));
  const commit = () => {
    if (draft === null) return;
    const n = Number(draft.replace(/[^\d.]/g, ''));
    if (Number.isFinite(n) && draft.trim() !== '') onChange(clamp(n));
    setDraft(null);
  };
  return (
    <div className="stack" style={{ ['--gap' as string]: '10px' }}>
      <label className="control-label" htmlFor={id}>
        {label}
      </label>
      <div className="stepper">
        <button type="button" aria-label={`Less ${label.toLowerCase()}`} onClick={() => onChange(clamp(value - step))} disabled={value <= min}>
          <Icon name="minus" />
        </button>
        <div className="value">
          <input
            id={id}
            className="stepper-input"
            inputMode="numeric"
            value={draft ?? String(value)}
            onFocus={(e) => {
              setDraft(String(value));
              requestAnimationFrame(() => e.target.select());
            }}
            onChange={(e) => setDraft(e.target.value)}
            onBlur={commit}
            onKeyDown={(e) => e.key === 'Enter' && (e.target as HTMLInputElement).blur()}
            aria-describedby={help ? `${id}-help` : undefined}
          />
          <span className="meta">{unit}</span>
        </div>
        <button type="button" aria-label={`More ${label.toLowerCase()}`} onClick={() => onChange(clamp(value + step))} disabled={value >= max}>
          <Icon name="plus" />
        </button>
      </div>
      {help && (
        <span id={`${id}-help`} className="meta">
          {help}
        </span>
      )}
    </div>
  );
}

export function TextField({
  label,
  value,
  onChange,
  type = 'text',
  autoComplete,
  inputMode,
  placeholder,
  multiline,
  required,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  type?: string;
  autoComplete?: string;
  inputMode?: 'text' | 'tel' | 'email' | 'numeric' | 'decimal';
  placeholder?: string;
  multiline?: boolean;
  required?: boolean;
}) {
  const id = useId();
  return (
    <div className="field">
      <label htmlFor={id}>{label}</label>
      {multiline ? (
        <textarea id={id} value={value} placeholder={placeholder} onChange={(e) => onChange(e.target.value)} />
      ) : (
        <input
          id={id}
          type={type}
          value={value}
          autoComplete={autoComplete}
          inputMode={inputMode}
          placeholder={placeholder}
          required={required}
          onChange={(e) => onChange(e.target.value)}
        />
      )}
    </div>
  );
}

// ---------- bits ----------
export function Loading({ label = 'Loading…' }: { label?: string }) {
  return (
    <p className="meta" role="status">
      {label}
    </p>
  );
}

export function ErrorNote({ message, retry }: { message: string; retry?: () => void }) {
  return (
    <div className="card error-note row" role="alert" style={{ justifyContent: 'space-between' }}>
      <span>{message}</span>
      {retry && (
        <button className="btn btn-ghost" type="button" onClick={retry}>
          Try again
        </button>
      )}
    </div>
  );
}

export function Empty({ children }: { children: ReactNode }) {
  return <p className="empty">{children}</p>;
}

// ---------- sheet (modal dialog) ----------
export function Sheet({ title, open, onClose, children }: { title: string; open: boolean; onClose: () => void; children: ReactNode }) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const d = ref.current;
    if (!d) return;
    if (open && !d.open) d.showModal();
    if (!open && d.open) d.close();
  }, [open]);
  return (
    <dialog
      ref={ref}
      className="sheet"
      aria-label={title}
      onClose={onClose}
      onClick={(e) => {
        if (e.target === ref.current) onClose();
      }}
    >
      {open && (
        <div className="sheet__inner stack">
          <div className="row sheet__head">
            <h2 className="h-card">{title}</h2>
            <button type="button" className="icon-btn" aria-label="Close" onClick={onClose}>
              <Icon name="close" />
            </button>
          </div>
          {children}
        </div>
      )}
    </dialog>
  );
}

// ---------- toast ----------
const ToastCtx = createContext<(msg: string) => void>(() => {});
export const useToast = () => useContext(ToastCtx);

export function ToastProvider({ children }: { children: ReactNode }) {
  const [msg, setMsg] = useState<string | null>(null);
  const timer = useRef<number>(undefined);
  const show = useCallback((m: string) => {
    setMsg(m);
    window.clearTimeout(timer.current);
    timer.current = window.setTimeout(() => setMsg(null), 3200);
  }, []);
  return (
    <ToastCtx.Provider value={show}>
      {children}
      <div className="toast-region" role="status" aria-live="polite">
        {msg && <div className="toast">{msg}</div>}
      </div>
    </ToastCtx.Provider>
  );
}
