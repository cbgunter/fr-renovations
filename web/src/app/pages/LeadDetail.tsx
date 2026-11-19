import { useEffect, useState, type FormEvent } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import {
  JOB_TYPES,
  LEAD_SOURCES,
  LEAD_STATUSES,
  dayLong,
  dayShort,
  jobName,
  money,
  recent,
  sourceLabel,
  time,
  type CalendarEvent,
  type Estimate,
  type Lead,
  type LeadSource,
  type LeadStatus,
  type Priority,
} from '@frr/shared';
import { api, useApi } from '../lib/api';
import { mapHref, smsHref, telHref } from '../lib/links';
import { EventForm, newDraft } from '../EventForm';
import { Choices, ErrorNote, Icon, Loading, Sheet, StatusPill, TextField, useToast } from '../ui';

const PRIORITIES: { id: Priority; label: string }[] = [
  { id: 'high', label: 'High' },
  { id: 'normal', label: 'Normal' },
  { id: 'low', label: 'Low' },
];

type Form = Pick<Lead, 'name' | 'phone' | 'email' | 'address' | 'jobType' | 'source' | 'priority' | 'message' | 'notes'>;
const blank: Form = { name: '', phone: '', email: '', address: '', jobType: 'other', source: 'phone', priority: 'normal', message: '', notes: '' };

function LeadFields({ f, set }: { f: Form; set: (p: Partial<Form>) => void }) {
  return (
    <>
      <TextField label="Name" value={f.name} onChange={(v) => set({ name: v })} autoComplete="off" required />
      <div className="form-pair">
        <TextField label="Phone" type="tel" inputMode="tel" value={f.phone} onChange={(v) => set({ phone: v })} autoComplete="off" />
        <TextField label="Email" type="email" inputMode="email" value={f.email} onChange={(v) => set({ email: v })} autoComplete="off" />
      </div>
      <TextField label="Address of the job" value={f.address} onChange={(v) => set({ address: v })} autoComplete="off" />
      <div className="field">
        <label htmlFor="lead-job">Job</label>
        <select id="lead-job" value={f.jobType} onChange={(e) => set({ jobType: e.target.value as Form['jobType'] })}>
          {JOB_TYPES.map((j) => (
            <option key={j.id} value={j.id}>
              {j.name}
            </option>
          ))}
          <option value="other">Something else</option>
        </select>
      </div>
    </>
  );
}

/** New lead (from a phone call) - /admin/leads/new */
function NewLead() {
  const nav = useNavigate();
  const toast = useToast();
  const [f, setF] = useState<Form>(blank);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const set = (p: Partial<Form>) => setF((x) => ({ ...x, ...p }));

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (!f.name.trim()) return setError('Add a name.');
    setBusy(true);
    setError(null);
    try {
      const lead = await api<Lead>('POST', '/admin/leads', f);
      toast('Lead saved');
      nav(`/admin/leads/${lead.id}`, { replace: true });
    } catch (err) {
      setError((err as Error).message);
      setBusy(false);
    }
  };

  return (
    <form className="page stack narrow" onSubmit={submit}>
      <Link to="/admin/leads" className="back">
        <Icon name="left" size={18} /> Leads
      </Link>
      <h1 className="h-admin">Add a lead</h1>
      <div className="card stack" style={{ ['--gap' as string]: '18px' }}>
        <LeadFields f={f} set={set} />
        <Choices label="How did they reach us?" options={LEAD_SOURCES} value={f.source} onChange={(v: LeadSource) => set({ source: v })} />
        <Choices label="Priority" options={PRIORITIES} value={f.priority} onChange={(v) => set({ priority: v })} />
        <TextField label="What they told you" value={f.message} onChange={(v) => set({ message: v })} multiline placeholder="Size, what's wrong, when they'd like it done…" />
      </div>
      {error && <p className="form-error" role="alert">{error}</p>}
      <div className="sticky-actions">
        <button className="btn btn-primary btn-lg" type="submit" disabled={busy}>
          {busy ? 'Saving…' : 'Save lead'}
        </button>
      </div>
    </form>
  );
}

function ExistingLead({ id }: { id: string }) {
  const nav = useNavigate();
  const toast = useToast();
  const lead = useApi<Lead>(`/admin/leads/${id}`);
  const estimates = useApi<Estimate[]>(`/admin/estimates?leadId=${id}`);
  const [f, setF] = useState<Form | null>(null);
  const [booking, setBooking] = useState<null | 'visit' | 'job'>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (lead.data) setF((cur) => cur ?? pick(lead.data!));
  }, [lead.data]);

  if (lead.error) return <div className="page"><ErrorNote message={lead.error} retry={lead.reload} /></div>;
  if (!lead.data || !f) return <div className="page"><Loading /></div>;
  const l = lead.data;
  const dirty = JSON.stringify(f) !== JSON.stringify(pick(l));
  const latest = estimates.data?.[0];

  const patch = async (p: Partial<Lead>, msg?: string) => {
    setBusy(true);
    try {
      const updated = await api<Lead>('PUT', `/admin/leads/${id}`, p);
      lead.setData(updated);
      setF(pick(updated));
      if (msg) toast(msg);
    } catch (e) {
      toast((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  const saveDetails = () => patch(f, 'Saved');

  const remove = async () => {
    if (!confirm(`Delete ${l.name}? This can't be undone.`)) return;
    await api('DELETE', `/admin/leads/${id}`);
    toast('Lead deleted');
    nav('/admin/leads', { replace: true });
  };

  const onBooked = (e: CalendarEvent) => {
    setBooking(null);
    lead.reload();
    if (e.kind === 'job') toast('Job is on the calendar');
  };

  return (
    <div className="page stack narrow">
      <Link to={`/admin/leads?tab=${l.status}`} className="back">
        <Icon name="left" size={18} /> Leads
      </Link>

      <div className="stack" style={{ ['--gap' as string]: '10px' }}>
        <div className="row" style={{ ['--gap' as string]: '10px' }}>
          <StatusPill status={l.status} visitAt={l.visitAt} />
          <span className="meta">
            {sourceLabel(l.source)} · {recent(l.createdAt)}
          </span>
        </div>
        <h1 className="h-admin">{l.name}</h1>
        <p className="lede-admin">{jobName(l.jobType)}{l.address ? ` · ${l.address}` : ''}</p>
      </div>

      <div className="row quick-actions">
        {l.phone && (
          <a className="btn btn-ghost" href={telHref(l.phone)}>
            <Icon name="phone" size={18} /> Call
          </a>
        )}
        {l.phone && (
          <a className="btn btn-ghost" href={smsHref(l.phone, '')}>
            <Icon name="text" size={18} /> Text
          </a>
        )}
        {l.email && (
          <a className="btn btn-ghost" href={`mailto:${l.email}`}>
            <Icon name="mail" size={18} /> Email
          </a>
        )}
        {l.address && (
          <a className="btn btn-ghost" href={mapHref(l.address)} target="_blank" rel="noreferrer">
            <Icon name="map" size={18} /> Map
          </a>
        )}
      </div>

      {/* Next step: one obvious primary action for where this lead is. */}
      <section className="card next-step stack" aria-label="Next step">
        <p className="eyebrow eyebrow--muted">Next step</p>
        {l.status === 'new' && (
          <>
            <p>Call {l.name.split(' ')[0]} and book a time to go look at the job.</p>
            <div className="row">
              <button className="btn btn-primary btn-lg" type="button" onClick={() => setBooking('visit')}>
                Book an estimate visit
              </button>
              <Link className="btn btn-ghost btn-lg" to={`/admin/estimate?lead=${id}`}>
                Estimate now
              </Link>
            </div>
          </>
        )}
        {l.status === 'visit' && (
          <>
            <p>
              Visit set for <strong className="num">{l.visitAt ? `${dayLong(l.visitAt)} · ${time(l.visitAt.slice(11, 16))}` : 'a day not recorded'}</strong>. Build the estimate on site.
            </p>
            <div className="row">
              <Link className="btn btn-primary btn-lg" to={`/admin/estimate?lead=${id}`}>
                Start estimate
              </Link>
              <button className="btn btn-ghost btn-lg" type="button" onClick={() => setBooking('visit')}>
                Book another visit
              </button>
            </div>
          </>
        )}
        {l.status === 'sent' && (
          <>
            <p>
              Estimate {latest ? <>#{latest.number} for <strong className="num">{money(latest.total)}</strong></> : ''} is with the customer
              {latest?.sentAt ? ` since ${dayShort(latest.sentAt)}` : ''}. When they say yes, mark it won.
            </p>
            <div className="row">
              <button className="btn btn-primary btn-lg" type="button" disabled={busy} onClick={() => patch({ status: 'won' }, 'Marked won')}>
                Mark won
              </button>
              <button className="btn btn-ghost btn-lg" type="button" disabled={busy} onClick={() => patch({ status: 'lost' }, 'Marked lost')}>
                Mark lost
              </button>
            </div>
          </>
        )}
        {l.status === 'won' && (
          <>
            <p>The job is yours. Put it on the calendar so the days are held.</p>
            <div className="row">
              <button className="btn btn-primary btn-lg" type="button" onClick={() => setBooking('job')}>
                Schedule the job
              </button>
            </div>
          </>
        )}
        {l.status === 'lost' && (
          <>
            <p>This one didn't go ahead.</p>
            <div className="row">
              <button className="btn btn-ghost btn-lg" type="button" disabled={busy} onClick={() => patch({ status: 'new' }, 'Reopened')}>
                Reopen lead
              </button>
            </div>
          </>
        )}
      </section>

      <section className="card stack" aria-label="Priority and status" style={{ ['--gap' as string]: '18px' }}>
        <Choices label="Priority" options={PRIORITIES} value={l.priority} onChange={(p) => patch({ priority: p }, 'Priority updated')} />
        <div className="field">
          <label htmlFor="lead-status">Status</label>
          <select id="lead-status" value={l.status} onChange={(e) => patch({ status: e.target.value as LeadStatus }, 'Status updated')}>
            {LEAD_STATUSES.map((s) => (
              <option key={s.id} value={s.id}>
                {s.label}
              </option>
            ))}
          </select>
        </div>
      </section>

      {l.message && (
        <section className="card stack" style={{ ['--gap' as string]: '8px' }}>
          <p className="eyebrow eyebrow--muted">What they told us</p>
          <p className="prewrap">{l.message}</p>
        </section>
      )}

      <section className="card stack" style={{ ['--gap' as string]: '12px' }}>
        <p className="eyebrow eyebrow--muted">Estimates</p>
        {estimates.data?.length ? (
          <ul className="list">
            {estimates.data.map((e) => (
              <li key={e.id} className="list-row">
                <Link to={`/admin/estimate/${e.id}`} className="list-row__main">
                  <strong>
                    #{e.number} · <span className="num">{money(e.total)}</span>
                  </strong>
                  <span className="meta">
                    {jobName(e.jobType)} · {e.status === 'approved' ? `approved ${dayShort(e.approvedAt!)}` : e.status === 'sent' ? `sent ${dayShort(e.sentAt!)}` : 'draft'}
                  </span>
                </Link>
                {e.status !== 'draft' && (
                  <a className="btn btn-ghost" href={`/e/${e.id}`} target="_blank" rel="noreferrer">
                    View
                  </a>
                )}
              </li>
            ))}
          </ul>
        ) : (
          <p className="meta">No estimates yet.</p>
        )}
      </section>

      <section className="card stack" style={{ ['--gap' as string]: '18px' }}>
        <p className="eyebrow eyebrow--muted">Details</p>
        <LeadFields f={f} set={(p) => setF({ ...f, ...p })} />
        <Choices label="How did they reach us?" options={LEAD_SOURCES} value={f.source} onChange={(v: LeadSource) => setF({ ...f, source: v })} />
        <TextField label="Notes (only you see these)" value={f.notes} onChange={(v) => setF({ ...f, notes: v })} multiline />
        <div className="row">
          <button className="btn btn-ghost" type="button" disabled={!dirty || busy} onClick={saveDetails}>
            {dirty ? 'Save changes' : 'Saved'}
          </button>
        </div>
      </section>

      <div>
        <button className="link-btn danger" type="button" onClick={remove}>
          Delete this lead
        </button>
      </div>

      <Sheet title={booking === 'job' ? 'Schedule the job' : 'Book an estimate visit'} open={!!booking} onClose={() => setBooking(null)}>
        {booking && (
          <EventForm
            initial={{ ...newDraft({ kind: booking, lead: l }), title: booking === 'job' ? `${l.name} · ${jobName(l.jobType).toLowerCase()}` : l.name }}
            onSaved={onBooked}
            lockLead
          />
        )}
      </Sheet>
    </div>
  );
}

function pick(l: Lead): Form {
  return { name: l.name, phone: l.phone, email: l.email, address: l.address, jobType: l.jobType, source: l.source, priority: l.priority, message: l.message, notes: l.notes };
}

export function LeadDetail() {
  const { id } = useParams();
  return id ? <ExistingLead key={id} id={id} /> : <NewLead />;
}
