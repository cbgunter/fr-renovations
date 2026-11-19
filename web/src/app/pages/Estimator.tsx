import { useEffect, useMemo, useRef, useState } from 'react';
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import {
  JOBS,
  defaultInputs,
  getJob,
  money,
  moneyRange,
  quote,
  type Estimate,
  type InputValues,
  type JobType,
  type Lead,
  type Settings,
} from '@frr/shared';
import { api, useApi } from '../lib/api';
import { copyText, smsHref } from '../lib/links';
import { Choices, ErrorNote, Icon, Loading, Stepper, TextField, useToast } from '../ui';

interface Draft {
  estimateId?: string;
  leadId?: string;
  jobType?: JobType;
  inputs: InputValues;
  customer: { name: string; email: string; phone: string; address: string };
  adjustment: number;
  adjustmentLabel: string;
  note: string;
}

type Step = 'pick' | 'measure' | 'review' | 'sent';
type SendBy = 'email' | 'text' | 'both';

const emptyCustomer = { name: '', email: '', phone: '', address: '' };
const draftKey = (leadId?: string, estimateId?: string) => `frr.estimate.${estimateId ?? leadId ?? 'new'}`;

function loadDraft(key: string): Draft | null {
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as Draft) : null;
  } catch {
    return null;
  }
}
function saveDraft(key: string, d: Draft) {
  try {
    localStorage.setItem(key, JSON.stringify(d));
  } catch {
    /* storage full or blocked - the estimate still works, just isn't saved locally */
  }
}
function clearDraft(key: string) {
  try {
    localStorage.removeItem(key);
  } catch {
    /* ignore */
  }
}

export function Estimator() {
  const { id: estimateId } = useParams();
  const [params] = useSearchParams();
  const leadId = params.get('lead') ?? undefined;
  // Re-mount for a different lead/estimate so state never leaks between them.
  return <EstimatorInner key={estimateId ?? leadId ?? 'new'} estimateId={estimateId} leadId={leadId} />;
}

function EstimatorInner({ estimateId, leadId }: { estimateId?: string; leadId?: string }) {
  const nav = useNavigate();
  const toast = useToast();
  const key = draftKey(leadId, estimateId);
  const settings = useApi<Settings>('/admin/settings');
  const [draft, setDraft] = useState<Draft | null>(null);
  const [step, setStep] = useState<Step>('pick');
  const [loadError, setLoadError] = useState<string | null>(null);
  const [sendBy, setSendBy] = useState<SendBy>('email');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sent, setSent] = useState<{ estimate: Estimate; link: string; emailed: boolean; textTo?: string } | null>(null);
  /** Set once the estimate is sent/saved so autosave can't resurrect the draft. */
  const finished = useRef(false);

  // Initial load: local draft > existing estimate > lead > blank.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const local = loadDraft(key);
        if (local) {
          if (cancelled) return;
          setDraft(local);
          setStep(local.jobType ? 'measure' : 'pick');
          if (estimateId || leadId) toast('Picked up where you left off');
          return;
        }
        if (estimateId) {
          const e = await api<Estimate>('GET', `/admin/estimates/${estimateId}`);
          if (cancelled) return;
          setDraft({
            estimateId: e.id,
            leadId: e.leadId,
            jobType: e.jobType,
            inputs: e.inputs,
            customer: e.customer,
            adjustment: e.adjustment,
            adjustmentLabel: e.adjustmentLabel,
            note: e.note,
          });
          setStep('measure');
          return;
        }
        if (leadId) {
          const l = await api<Lead>('GET', `/admin/leads/${leadId}`);
          if (cancelled) return;
          const jobType = l.jobType !== 'other' ? l.jobType : undefined;
          setDraft({
            leadId,
            jobType,
            inputs: jobType ? defaultInputs(jobType) : {},
            customer: { name: l.name, email: l.email, phone: l.phone, address: l.address },
            adjustment: 0,
            adjustmentLabel: '',
            note: '',
          });
          setStep(jobType ? 'measure' : 'pick');
          return;
        }
        setDraft({ inputs: {}, customer: emptyCustomer, adjustment: 0, adjustmentLabel: '', note: '' });
        setStep('pick');
      } catch (e) {
        if (!cancelled) setLoadError((e as Error).message);
      }
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);

  // Autosave every change so a dropped signal or closed tab loses nothing.
  useEffect(() => {
    if (draft && !finished.current && draft.jobType) saveDraft(key, draft);
  }, [draft, key, step]);

  const q = useMemo(
    () => (draft?.jobType ? quote(draft.jobType, draft.inputs, settings.data?.rates, draft.adjustment) : null),
    [draft, settings.data],
  );

  useEffect(() => {
    if (draft) setSendBy(draft.customer.email ? 'email' : draft.customer.phone ? 'text' : 'email');
    // only when entering review
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [step === 'review']);

  if (loadError) return <div className="page"><ErrorNote message={loadError} /></div>;
  if (!draft) return <div className="page"><Loading /></div>;

  const set = (p: Partial<Draft>) => setDraft((d) => ({ ...d!, ...p }));
  const setInput = (k: string, v: number | string) => setDraft((d) => ({ ...d!, inputs: { ...d!.inputs, [k]: v } }));
  const setCustomer = (p: Partial<Draft['customer']>) => setDraft((d) => ({ ...d!, customer: { ...d!.customer, ...p } }));

  const pickJob = (j: JobType) => {
    set({ jobType: j, inputs: draft.jobType === j ? draft.inputs : defaultInputs(j) });
    setStep('measure');
  };

  /** Save (create or update) on the server. Creates a lead for walk-up estimates. */
  async function persist(): Promise<Estimate> {
    let lid = draft!.leadId;
    if (!lid && draft!.customer.name.trim()) {
      const lead = await api<Lead>('POST', '/admin/leads', {
        name: draft!.customer.name,
        phone: draft!.customer.phone,
        email: draft!.customer.email,
        address: draft!.customer.address,
        jobType: draft!.jobType,
        source: 'walkup',
        status: 'visit',
      });
      lid = lead.id;
      set({ leadId: lid });
    }
    const body = {
      leadId: lid,
      jobType: draft!.jobType,
      inputs: draft!.inputs,
      customer: draft!.customer,
      adjustment: draft!.adjustment,
      adjustmentLabel: draft!.adjustmentLabel,
      note: draft!.note,
    };
    const est = draft!.estimateId
      ? await api<Estimate>('PUT', `/admin/estimates/${draft!.estimateId}`, body)
      : await api<Estimate>('POST', '/admin/estimates', body);
    set({ estimateId: est.id, leadId: lid });
    return est;
  }

  const saveOnly = async () => {
    setBusy(true);
    setError(null);
    try {
      const est = await persist();
      finished.current = true;
      clearDraft(key);
      toast(`Estimate #${est.number} saved`);
      nav(est.leadId ? `/admin/leads/${est.leadId}` : '/admin/leads', { replace: true });
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  const send = async () => {
    setError(null);
    const c = draft.customer;
    if (!c.name.trim()) return setError('Add the customer name.');
    if ((sendBy === 'email' || sendBy === 'both') && !c.email.trim()) return setError('Add the customer email, or send by text.');
    if ((sendBy === 'text' || sendBy === 'both') && !c.phone.trim()) return setError('Add the customer phone number, or send by email.');
    setBusy(true);
    try {
      const est = await persist();
      const r = await api<{ estimate: Estimate; link: string; emailed: boolean }>('POST', `/admin/estimates/${est.id}/send`, {
        email: sendBy !== 'text',
      });
      finished.current = true;
      clearDraft(key);
      setSent({ ...r, textTo: sendBy !== 'email' ? c.phone : undefined });
      setStep('sent');
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  const job = draft.jobType ? getJob(draft.jobType) : null;
  const usingSampleRates = !!job && !Object.keys(settings.data?.rates?.[job.id] ?? {}).length;

  // ---------------- step: pick a job ----------------
  if (step === 'pick' || !job) {
    return (
      <div className="page stack">
        <div className="stack" style={{ ['--gap' as string]: '4px' }}>
          <p className="eyebrow eyebrow--muted">New estimate{draft.customer.name ? ` · ${draft.customer.name}` : ''}</p>
          <h1 className="h-admin">What's the job?</h1>
        </div>
        <div className="job-tiles">
          {JOBS.map((j) => (
            <button key={j.id} type="button" className="job-tile" aria-pressed={draft.jobType === j.id} onClick={() => pickJob(j.id)}>
              <span className="job-tile__name">{j.name}</span>
              <span className="meta">{j.blurb}</span>
            </button>
          ))}
        </div>
      </div>
    );
  }

  // ---------------- step: sent ----------------
  if (step === 'sent' && sent) {
    const first = draft.customer.name.split(/\s+/)[0];
    const textBody = `Hi ${first}, here is your estimate from ${settings.data?.business.name ?? 'First Responders Renovations'}: ${sent.link}`;
    return (
      <div className="page stack narrow">
        <div className="stack" style={{ ['--gap' as string]: '8px' }}>
          <p className="eyebrow">Estimate #{sent.estimate.number}</p>
          <h1 className="h-admin">{sent.textTo && !sent.emailed ? 'Ready to text' : 'Sent'}</h1>
          <p className="lede-admin">
            <span className="num">{money(sent.estimate.total)}</span> · {job.name} for {draft.customer.name}
          </p>
        </div>
        <div className="card stack" style={{ ['--gap' as string]: '14px' }}>
          {sent.emailed && (
            <p className="row" style={{ ['--gap' as string]: '8px' }}>
              <Icon name="check" size={20} /> Emailed to {draft.customer.email}
            </p>
          )}
          {sent.textTo && (
            <>
              <p className="meta">Tap below to open your messages with the link filled in, then hit send.</p>
              <a className="btn btn-primary btn-lg" href={smsHref(sent.textTo, textBody)}>
                <Icon name="text" size={20} /> Text it to {first}
              </a>
            </>
          )}
          <div className="row">
            <button
              type="button"
              className="btn btn-ghost"
              onClick={async () => toast((await copyText(sent.link)) ? 'Link copied' : sent.link)}
            >
              <Icon name="copy" size={18} /> Copy link
            </button>
            <a className="btn btn-ghost" href={sent.link} target="_blank" rel="noreferrer">
              View as customer
            </a>
          </div>
        </div>
        <div className="row">
          {sent.estimate.leadId && (
            <Link className="btn btn-ghost btn-lg" to={`/admin/leads/${sent.estimate.leadId}`}>
              Back to the lead
            </Link>
          )}
          <Link className="btn btn-ghost btn-lg" to="/admin">
            Done
          </Link>
        </div>
      </div>
    );
  }

  const header = (
    <div className="stack" style={{ ['--gap' as string]: '4px' }}>
      <p className="eyebrow eyebrow--muted">
        {draft.customer.name || 'New estimate'}
        {draft.estimateId ? ' · editing' : ''}
      </p>
      <div className="row" style={{ justifyContent: 'space-between' }}>
        <h1 className="h-admin">{job.name}</h1>
        {!draft.estimateId && (
          <button type="button" className="link-btn" onClick={() => setStep('pick')}>
            Change job
          </button>
        )}
      </div>
    </div>
  );

  // ---------------- step: measure ----------------
  if (step === 'measure') {
    return (
      <div className="page stack estimator">
        {header}
        {usingSampleRates && (
          <Link to="/admin/settings#rates" className="tag" style={{ alignSelf: 'flex-start', textDecoration: 'none' }}>
            Sample rates · set yours in Settings
          </Link>
        )}
        <div className="stack estimator__inputs">
          {job.inputs.map((i) =>
            i.kind === 'number' ? (
              <Stepper
                key={i.id}
                label={i.label}
                unit={i.unit}
                step={i.step}
                min={i.min}
                max={i.max}
                help={i.help}
                value={Number(draft.inputs[i.id] ?? i.default)}
                onChange={(v) => setInput(i.id, v)}
              />
            ) : (
              <Choices key={i.id} label={i.label} options={i.options} value={String(draft.inputs[i.id] ?? i.default)} onChange={(v) => setInput(i.id, v)} />
            ),
          )}
        </div>

        <div className="total-bar">
          <div className="total-bar__inner">
            <div className="stack" style={{ ['--gap' as string]: '2px' }}>
              <span className="meta" style={{ fontSize: 12 }}>
                Range {q ? moneyRange(q.low, q.high) : ''}
              </span>
              <span className="num-lg" aria-live="polite">
                {q ? money(q.total) : '—'}
              </span>
            </div>
            <button className="btn btn-primary btn-lg" type="button" onClick={() => setStep('review')}>
              Review
            </button>
          </div>
        </div>
      </div>
    );
  }

  // ---------------- step: review + send ----------------
  const adjSign = draft.adjustment < 0 ? 'discount' : 'add';
  return (
    <div className="page stack narrow estimator">
      <button type="button" className="back link-btn" onClick={() => setStep('measure')}>
        <Icon name="left" size={18} /> Back to measurements
      </button>
      {header}

      <section className="card stack" style={{ ['--gap' as string]: '6px' }} aria-label="Line items">
        <ul className="lines">
          {q!.lines.map((l, i) => (
            <li key={i}>
              <span>{l.label}</span>
              <span className="num">{money(l.amount)}</span>
            </li>
          ))}
          {draft.adjustment !== 0 && (
            <li>
              <span>{draft.adjustmentLabel || (draft.adjustment < 0 ? 'Discount' : 'Adjustment')}</span>
              <span className="num">{money(draft.adjustment)}</span>
            </li>
          )}
          <li className="lines__total">
            <span>Total</span>
            <span className="num-lg">{money(q!.total)}</span>
          </li>
        </ul>
      </section>

      <details className="card disclosure" open={draft.adjustment !== 0}>
        <summary>Add a line or discount</summary>
        <div className="stack" style={{ ['--gap' as string]: '14px', paddingTop: 14 }}>
          <Choices
            label="Type"
            options={[
              { id: 'add', label: 'Add to price' },
              { id: 'discount', label: 'Discount' },
            ]}
            value={adjSign}
            onChange={(v) => set({ adjustment: Math.abs(draft.adjustment) * (v === 'discount' ? -1 : 1) })}
          />
          <TextField label="What it's for" value={draft.adjustmentLabel} onChange={(v) => set({ adjustmentLabel: v })} placeholder="e.g. Rot repair under the deck" />
          <TextField
            label="Amount ($)"
            inputMode="numeric"
            value={draft.adjustment ? String(Math.abs(draft.adjustment)) : ''}
            onChange={(v) => {
              const n = Number(v.replace(/[^\d]/g, '')) || 0;
              set({ adjustment: adjSign === 'discount' ? -n : n });
            }}
          />
        </div>
      </details>

      <section className="card stack" style={{ ['--gap' as string]: '16px' }} aria-label="Customer">
        <p className="eyebrow eyebrow--muted">Customer</p>
        <TextField label="Name" value={draft.customer.name} onChange={(v) => setCustomer({ name: v })} autoComplete="off" />
        <div className="form-pair">
          <TextField label="Email" type="email" inputMode="email" value={draft.customer.email} onChange={(v) => setCustomer({ email: v })} autoComplete="off" />
          <TextField label="Mobile phone" type="tel" inputMode="tel" value={draft.customer.phone} onChange={(v) => setCustomer({ phone: v })} autoComplete="off" />
        </div>
        <TextField label="Job address" value={draft.customer.address} onChange={(v) => setCustomer({ address: v })} autoComplete="off" />
        <TextField label="Note to the customer" value={draft.note} onChange={(v) => set({ note: v })} multiline placeholder="What's included, timing, anything they should know" />
      </section>

      <section className="card stack" style={{ ['--gap' as string]: '16px' }} aria-label="Send">
        <Choices
          label="Send by"
          options={[
            { id: 'email', label: 'Email' },
            { id: 'text', label: 'Text' },
            { id: 'both', label: 'Both' },
          ]}
          value={sendBy}
          onChange={setSendBy}
        />
        {error && (
          <p className="form-error" role="alert">
            {error}
          </p>
        )}
        <button className="btn btn-primary btn-lg" type="button" onClick={send} disabled={busy}>
          {busy ? 'Sending…' : `Send estimate · ${money(q!.total)}`}
        </button>
        <button className="btn btn-ghost" type="button" onClick={saveOnly} disabled={busy}>
          Save without sending
        </button>
      </section>
    </div>
  );
}
