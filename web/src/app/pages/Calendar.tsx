import { useEffect, useState, type MouseEvent } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { addDays, dayLong, dayShort, dowShort, nowLocal, parseDay, time, weekStart, type CalendarEvent, type Lead } from '@frr/shared';
import { useApi } from '../lib/api';
import { mapHref } from '../lib/links';
import { EventForm, draftFromEvent, newDraft, type EventDraft } from '../EventForm';
import { Empty, ErrorNote, Icon, Loading, Sheet } from '../ui';
import { EventCard } from './Today';

const FIRST_HOUR = 7;
const LAST_HOUR = 19; // grid ends at 7p
const HOUR_PX = 56;

function useWide() {
  const q = '(min-width: 760px)';
  const [wide, setWide] = useState(() => window.matchMedia(q).matches);
  useEffect(() => {
    const m = window.matchMedia(q);
    const on = () => setWide(m.matches);
    m.addEventListener('change', on);
    return () => m.removeEventListener('change', on);
  }, []);
  return wide;
}

const minutes = (hhmm: string) => Number(hhmm.slice(0, 2)) * 60 + Number(hhmm.slice(3, 5));

export function CalendarPage() {
  const [params, setParams] = useSearchParams();
  const now = nowLocal();
  const week = weekStart(params.get('week') ?? now.day);
  const days = Array.from({ length: 7 }, (_, i) => addDays(week, i));
  const end = days[6];
  const events = useApi<CalendarEvent[]>(`/admin/events?from=${week}&to=${end}`);
  const leads = useApi<Lead[]>('/admin/leads');
  const wide = useWide();
  const [editing, setEditing] = useState<{ draft: EventDraft; event?: CalendarEvent } | null>(null);
  const [tick, setTick] = useState(0);

  // Keep the now-line moving.
  useEffect(() => {
    const t = window.setInterval(() => setTick((x) => x + 1), 60_000);
    return () => window.clearInterval(t);
  }, []);
  void tick;

  const go = (d: string) => setParams({ week: d }, { replace: true });
  const openNew = (opts: { day?: string; time?: string } = {}) =>
    setEditing({ draft: newDraft({ day: opts.day ?? (now.day >= week && now.day <= end ? addDays(now.day, 1) : week), time: opts.time }) });
  const openEvent = (e: CalendarEvent) => setEditing({ draft: draftFromEvent(e), event: e });
  const saved = () => {
    setEditing(null);
    events.reload();
    leads.reload();
  };

  const all = events.data ?? [];
  const allDay = all.filter((e) => e.allDay);
  const timed = all.filter((e) => !e.allDay);
  const activeLeads = (leads.data ?? []).filter((l) => l.status !== 'lost');
  const p0 = parseDay(week);
  const p6 = parseDay(end);
  const monthLabel = p0.m === p6.m ? `${dayShort(week)} – ${p6.d}` : `${dayShort(week)} – ${dayShort(end)}`;

  return (
    <div className="page stack calendar-page">
      <div className="page-head">
        <h1 className="h-admin">Calendar</h1>
        <button className="btn btn-primary" type="button" onClick={() => openNew()}>
          <Icon name="plus" size={18} /> Add
        </button>
      </div>

      <div className="row cal-nav">
        <button className="icon-btn icon-btn--box" type="button" aria-label="Previous week" onClick={() => go(addDays(week, -7))}>
          <Icon name="left" />
        </button>
        <span className="num cal-nav__label">{monthLabel}</span>
        <button className="icon-btn icon-btn--box" type="button" aria-label="Next week" onClick={() => go(addDays(week, 7))}>
          <Icon name="right" />
        </button>
        <button className="btn btn-ghost" type="button" onClick={() => go(now.day)} disabled={now.day >= week && now.day <= end}>
          This week
        </button>
        <ul className="row cal-legend" aria-label="Legend">
          <li><span className="sw sw--visit" />Estimate visit</li>
          <li><span className="sw sw--job" />Confirmed job</li>
          <li><span className="sw sw--hold" />Pencilled in</li>
        </ul>
      </div>

      {events.error && <ErrorNote message={events.error} retry={events.reload} />}
      {events.loading && !events.data && <Loading />}

      {wide ? (
        <div className="table-box cal-box">
          <div className="cal" style={{ ['--hour' as string]: `${HOUR_PX}px` }}>
            <div className="cal-head">
              <span />
              {days.map((d) => (
                <span key={d} className={`cal-head__day${d === now.day ? ' is-today' : ''}`}>
                  <span className="eyebrow eyebrow--muted">{dowShort(d)}</span>
                  <span className="cal-head__num">{parseDay(d).d}</span>
                </span>
              ))}
            </div>

            <div className="cal-allday">
              <span className="cal-gutter-label">All day</span>
              {/* Clickable day cells sit in their own layer behind the bars. */}
              <div className="cal-allday__bg">
                {days.map((d) => (
                  <button
                    key={d}
                    type="button"
                    className={`cal-allday__cell${d === now.day ? ' is-today' : ''}`}
                    aria-label={`Add a job on ${dayLong(d)}`}
                    onClick={() => setEditing({ draft: newDraft({ kind: 'job', day: d }) })}
                  />
                ))}
              </div>
              {allDay.map((e) => {
                const s = Math.max(0, days.indexOf(e.start < week ? week : e.start));
                const last = e.end > end ? 6 : days.indexOf(e.end);
                return (
                  <button
                    key={e.id}
                    type="button"
                    className={`event event--${e.kind === 'job' ? 'job' : 'hold'} cal-bar`}
                    style={{ gridColumn: `${s + 2} / ${last + 3}` }}
                    onClick={() => openEvent(e)}
                  >
                    <span className="time">
                      {e.start === e.end ? dayShort(e.start) : `${dowShort(e.start)} ${parseDay(e.start).d} – ${dowShort(e.end)} ${parseDay(e.end).d}`}
                      {e.kind === 'hold' ? ' · tentative' : ''}
                    </span>
                    <strong>{e.title}</strong>
                  </button>
                );
              })}
            </div>

            <div className="cal-grid" style={{ height: (LAST_HOUR - FIRST_HOUR) * HOUR_PX }}>
              <div className="cal-hours" aria-hidden="true">
                {Array.from({ length: LAST_HOUR - FIRST_HOUR }, (_, i) => (
                  <span key={i} style={{ top: i * HOUR_PX }}>
                    {time(`${String(FIRST_HOUR + i).padStart(2, '0')}:00`, true)}
                  </span>
                ))}
              </div>
              {days.map((d) => {
                const mine = timed.filter((e) => e.start.slice(0, 10) === d);
                const isToday = d === now.day;
                const nowTop = ((minutes(now.time) - FIRST_HOUR * 60) / 60) * HOUR_PX;
                const onClick = (ev: MouseEvent<HTMLDivElement>) => {
                  if (ev.target !== ev.currentTarget) return;
                  const y = ev.clientY - ev.currentTarget.getBoundingClientRect().top;
                  const mins = FIRST_HOUR * 60 + Math.floor(y / (HOUR_PX / 2)) * 30;
                  const hh = String(Math.floor(mins / 60)).padStart(2, '0');
                  setEditing({ draft: newDraft({ day: d, time: `${hh}:${mins % 60 === 0 ? '00' : '30'}` }) });
                };
                return (
                  <div key={d} className={`cal-col${isToday ? ' is-today' : ''}`} onClick={onClick} role="presentation">
                    {mine.map((e) => {
                      const top = Math.max(0, ((minutes(e.start.slice(11, 16)) - FIRST_HOUR * 60) / 60) * HOUR_PX);
                      const h = Math.max(HOUR_PX * 0.75, ((minutes(e.end.slice(11, 16)) - minutes(e.start.slice(11, 16))) / 60) * HOUR_PX - 4);
                      const past = e.end.slice(0, 10) < now.day || (e.end.slice(0, 10) === now.day && e.end.slice(11, 16) < now.time);
                      return (
                        <button
                          key={e.id}
                          type="button"
                          className={`event ${past ? 'event--done' : 'event--visit'} cal-ev`}
                          style={{ top, height: h }}
                          onClick={() => openEvent(e)}
                        >
                          <span className="time">
                            {time(e.start.slice(11, 16))}
                            {past ? ' · done' : ''}
                          </span>
                          <strong>{e.title}</strong>
                        </button>
                      );
                    })}
                    {isToday && nowTop >= 0 && nowTop <= (LAST_HOUR - FIRST_HOUR) * HOUR_PX && (
                      <div className="now-line" style={{ top: nowTop }} aria-label={`Now, ${time(now.time)}`} />
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      ) : (
        <ol className="agenda">
          {days.map((d) => {
            const mine = all
              .filter((e) => e.start.slice(0, 10) <= d && e.end.slice(0, 10) >= d)
              .sort((a, b) => Number(b.allDay) - Number(a.allDay) || (a.start < b.start ? -1 : 1));
            return (
              <li key={d} className={`agenda__day${d === now.day ? ' is-today' : ''}`}>
                <div className="row agenda__head">
                  <h2 className="agenda__date">
                    {d === now.day ? <span className="today-dot">Today</span> : null}
                    {dayLong(d)}
                  </h2>
                  <button type="button" className="icon-btn" aria-label={`Add on ${dayLong(d)}`} onClick={() => openNew({ day: d })}>
                    <Icon name="plus" size={20} />
                  </button>
                </div>
                {mine.length ? (
                  <div className="stack" style={{ ['--gap' as string]: '8px' }}>
                    {mine.map((e) => (
                      <EventCard key={e.id} e={e} today={now.day} onClick={() => openEvent(e)} />
                    ))}
                  </div>
                ) : (
                  <p className="meta agenda__empty">Nothing scheduled</p>
                )}
              </li>
            );
          })}
        </ol>
      )}

      {!events.loading && wide && all.length === 0 && <Empty>Nothing on the calendar this week. Click a time to add a visit, or the All day row to add a job.</Empty>}

      <Sheet title={editing?.event ? editing.event.title : 'Add to the calendar'} open={!!editing} onClose={() => setEditing(null)}>
        {editing && (
          <div className="stack" style={{ ['--gap' as string]: '18px' }}>
            {editing.event && (
              <div className="row" style={{ ['--gap' as string]: '8px' }}>
                {editing.event.leadId && (
                  <Link className="btn btn-ghost" to={`/admin/leads/${editing.event.leadId}`}>
                    Open lead
                  </Link>
                )}
                {editing.event.address && (
                  <a className="btn btn-ghost" href={mapHref(editing.event.address)} target="_blank" rel="noreferrer">
                    <Icon name="map" size={18} /> Directions
                  </a>
                )}
                {editing.event.kind === 'visit' && (
                  <Link className="btn btn-accent" to={`/admin/estimate${editing.event.leadId ? `?lead=${editing.event.leadId}` : ''}`}>
                    Estimate
                  </Link>
                )}
              </div>
            )}
            <EventForm initial={editing.draft} leads={activeLeads} onSaved={saved} onDeleted={saved} />
          </div>
        )}
      </Sheet>
    </div>
  );
}
