import { useState, type FormEvent } from 'react';
import { EVENT_KINDS, addDays, nowLocal, type CalendarEvent, type EventKind, type Lead } from '@frr/shared';
import { api } from './lib/api';
import { Choices, TextField, useToast } from './ui';

export interface EventDraft {
  id?: string;
  kind: EventKind;
  title: string;
  leadId?: string;
  day: string; // YYYY-MM-DD
  startTime: string; // HH:mm (visits)
  endTime: string; // HH:mm (visits)
  lastDay: string; // YYYY-MM-DD (jobs/holds)
  address: string;
  notes: string;
}

export function draftFromEvent(e: CalendarEvent): EventDraft {
  return {
    id: e.id,
    kind: e.kind,
    title: e.title,
    leadId: e.leadId,
    day: e.start.slice(0, 10),
    startTime: e.allDay ? '08:00' : e.start.slice(11, 16),
    endTime: e.allDay ? '09:00' : e.end.slice(11, 16),
    lastDay: e.allDay ? e.end.slice(0, 10) : e.start.slice(0, 10),
    address: e.address,
    notes: e.notes,
  };
}

export function newDraft(opts: { kind?: EventKind; lead?: Lead; day?: string; time?: string } = {}): EventDraft {
  const today = nowLocal().day;
  const day = opts.day ?? addDays(today, 1);
  const start = opts.time ?? '08:00';
  const h = Math.min(23, Number(start.slice(0, 2)) + 1);
  const kind = opts.kind ?? 'visit';
  return {
    kind,
    title: opts.lead ? `${opts.lead.name}${kind === 'visit' ? '' : ''}` : '',
    leadId: opts.lead?.id,
    day,
    startTime: start,
    endTime: `${String(h).padStart(2, '0')}:${start.slice(3, 5)}`,
    lastDay: kind === 'job' ? addDays(day, 1) : day,
    address: opts.lead?.address ?? '',
    notes: '',
  };
}

const TIMES: string[] = [];
for (let h = 6; h <= 20; h++) for (const m of ['00', '30']) TIMES.push(`${String(h).padStart(2, '0')}:${m}`);
const timeLabel = (t: string) => {
  const h = Number(t.slice(0, 2));
  return `${h % 12 === 0 ? 12 : h % 12}:${t.slice(3)}${h < 12 ? 'a' : 'p'}`;
};

/** Add / edit a calendar event. `leads` lets the owner attach it to a lead. */
export function EventForm({
  initial,
  leads,
  onSaved,
  onDeleted,
  lockLead,
}: {
  initial: EventDraft;
  leads?: Lead[];
  onSaved: (e: CalendarEvent) => void;
  onDeleted?: () => void;
  lockLead?: boolean;
}) {
  const toast = useToast();
  const [d, setD] = useState<EventDraft>(initial);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const set = (p: Partial<EventDraft>) => setD((x) => ({ ...x, ...p }));
  const allDay = d.kind !== 'visit';

  const pickLead = (id: string) => {
    const l = leads?.find((x) => x.id === id);
    set({ leadId: id || undefined, title: l ? l.name : d.title, address: l ? l.address : d.address });
  };

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    if (!d.title.trim()) return setError('Add a title, like the customer name.');
    if (allDay && d.lastDay < d.day) return setError('The last day is before the first day.');
    if (!allDay && d.endTime <= d.startTime) return setError('The end time is before the start time.');
    const body = {
      kind: d.kind,
      title: d.title,
      leadId: d.leadId ?? '',
      start: allDay ? d.day : `${d.day}T${d.startTime}`,
      end: allDay ? d.lastDay : `${d.day}T${d.endTime}`,
      address: d.address,
      notes: d.notes,
    };
    setBusy(true);
    try {
      const saved = d.id
        ? await api<CalendarEvent>('PUT', `/admin/events/${d.id}`, body)
        : await api<CalendarEvent>('POST', '/admin/events', body);
      toast(d.id ? 'Saved' : d.kind === 'visit' ? 'Visit booked' : 'Added to the calendar');
      onSaved(saved);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  };

  const remove = async () => {
    if (!d.id || !confirm('Delete this from the calendar?')) return;
    setBusy(true);
    try {
      await api('DELETE', `/admin/events/${d.id}`);
      toast('Deleted');
      onDeleted?.();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <form className="stack" style={{ ['--gap' as string]: '18px' }} onSubmit={submit}>
      <Choices label="What is it?" options={EVENT_KINDS} value={d.kind} onChange={(k) => set({ kind: k, lastDay: k === 'visit' ? d.day : d.lastDay < d.day ? d.day : d.lastDay })} />

      {leads && !lockLead && (
        <div className="field">
          <label htmlFor="ev-lead">Customer</label>
          <select id="ev-lead" value={d.leadId ?? ''} onChange={(e) => pickLead(e.target.value)}>
            <option value="">No lead / other</option>
            {leads.map((l) => (
              <option key={l.id} value={l.id}>
                {l.name}
                {l.address ? ` · ${l.address}` : ''}
              </option>
            ))}
          </select>
        </div>
      )}

      <TextField label="Title" value={d.title} onChange={(v) => set({ title: v })} placeholder="Customer name · job" />

      {allDay ? (
        <div className="form-pair">
          <div className="field">
            <label htmlFor="ev-day">First day</label>
            <input id="ev-day" type="date" value={d.day} onChange={(e) => set({ day: e.target.value, lastDay: e.target.value > d.lastDay ? e.target.value : d.lastDay })} required />
          </div>
          <div className="field">
            <label htmlFor="ev-last">Last day</label>
            <input id="ev-last" type="date" value={d.lastDay} min={d.day} onChange={(e) => set({ lastDay: e.target.value })} required />
          </div>
        </div>
      ) : (
        <>
          <div className="field">
            <label htmlFor="ev-day">Day</label>
            <input id="ev-day" type="date" value={d.day} onChange={(e) => set({ day: e.target.value, lastDay: e.target.value })} required />
          </div>
          <div className="form-pair">
            <div className="field">
              <label htmlFor="ev-start">Starts</label>
              <select id="ev-start" value={d.startTime} onChange={(e) => {
                const s = e.target.value;
                const h = Math.min(23, Number(s.slice(0, 2)) + 1);
                set({ startTime: s, endTime: d.endTime <= s ? `${String(h).padStart(2, '0')}:${s.slice(3)}` : d.endTime });
              }}>
                {TIMES.map((t) => (
                  <option key={t} value={t}>
                    {timeLabel(t)}
                  </option>
                ))}
              </select>
            </div>
            <div className="field">
              <label htmlFor="ev-end">Ends</label>
              <select id="ev-end" value={d.endTime} onChange={(e) => set({ endTime: e.target.value })}>
                {[...TIMES, '21:00'].filter((t) => t > d.startTime).map((t) => (
                  <option key={t} value={t}>
                    {timeLabel(t)}
                  </option>
                ))}
              </select>
            </div>
          </div>
        </>
      )}

      <TextField label="Address" value={d.address} onChange={(v) => set({ address: v })} autoComplete="off" />
      <TextField label="Notes" value={d.notes} onChange={(v) => set({ notes: v })} multiline />

      {error && (
        <p className="form-error" role="alert">
          {error}
        </p>
      )}
      <div className="row sheet__actions">
        <button className="btn btn-primary btn-lg" type="submit" disabled={busy}>
          {d.id ? 'Save' : d.kind === 'visit' ? 'Book visit' : 'Add to calendar'}
        </button>
        {d.id && onDeleted && (
          <button className="btn btn-ghost" type="button" onClick={remove} disabled={busy}>
            Delete
          </button>
        )}
      </div>
    </form>
  );
}
