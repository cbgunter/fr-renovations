import { Link } from 'react-router-dom';
import { addDays, dayLong, dayDiff, jobName, money, nowLocal, recent, timeRange, type CalendarEvent, type Estimate, type Lead } from '@frr/shared';
import { useApi } from '../lib/api';
import { mapHref, telHref } from '../lib/links';
import { Empty, ErrorNote, Icon, Loading, Pri } from '../ui';

export function EventCard({ e, today, onClick }: { e: CalendarEvent; today: string; onClick?: () => void }) {
  const past = e.kind === 'visit' && e.end.slice(0, 10) < today;
  const cls = e.kind === 'visit' ? (past ? 'event--done' : 'event--visit') : e.kind === 'job' ? 'event--job' : 'event--hold';
  const when = e.allDay
    ? e.start === e.end
      ? 'All day'
      : `${dayLong(e.start)} – ${dayLong(e.end)}`
    : timeRange(e.start.slice(11, 16), e.end.slice(11, 16)) + (past ? ' · done' : '');
  const what = e.kind === 'visit' ? 'Estimate visit' : e.kind === 'job' ? 'Confirmed job' : 'Pencilled in';
  const Tag = onClick ? 'button' : 'div';
  return (
    <Tag type={onClick ? 'button' : undefined} className={`event ${cls} event-card`} onClick={onClick}>
      <span className="time">{when}</span>
      <strong>{e.title}</strong>
      <span>{what}{e.address ? ` · ${e.address}` : ''}</span>
    </Tag>
  );
}

export function Today() {
  const today = nowLocal().day;
  const weekOut = addDays(today, 7);
  const leads = useApi<Lead[]>('/admin/leads');
  const events = useApi<CalendarEvent[]>(`/admin/events?from=${today}&to=${weekOut}`);
  const estimates = useApi<Estimate[]>('/admin/estimates');

  const todays = (events.data ?? []).filter((e) => e.start.slice(0, 10) <= today && e.end.slice(0, 10) >= today);
  const upcoming = (events.data ?? []).filter((e) => e.start.slice(0, 10) > today);
  const toCall = (leads.data ?? []).filter((l) => l.status === 'new');
  const waiting = (leads.data ?? []).filter((l) => l.status === 'sent');
  const estById = new Map((estimates.data ?? []).map((e) => [e.id, e]));

  return (
    <div className="page stack">
      <div className="page-head">
        <div className="stack" style={{ ['--gap' as string]: '4px' }}>
          <p className="eyebrow eyebrow--muted">{dayLong(today)}</p>
          <h1 className="h-admin">Today</h1>
        </div>
        <div className="row">
          <Link className="btn btn-ghost" to="/admin/leads/new">
            <Icon name="plus" size={18} /> Add a lead
          </Link>
          <Link className="btn btn-primary" to="/admin/estimate">
            New estimate
          </Link>
        </div>
      </div>

      {(leads.error || events.error) && <ErrorNote message={leads.error || events.error!} retry={() => { leads.reload(); events.reload(); }} />}

      <section className="stack section-block" aria-labelledby="t-cal">
        <h2 id="t-cal" className="section-title">On the calendar today</h2>
        {events.loading && !events.data ? (
          <Loading />
        ) : todays.length ? (
          <div className="stack" style={{ ['--gap' as string]: '10px' }}>
            {todays.map((e) => (
              <div key={e.id} className="today-event">
                <EventCard e={e} today={today} />
                <div className="row" style={{ ['--gap' as string]: '8px' }}>
                  {e.address && (
                    <a className="btn btn-ghost" href={mapHref(e.address)} target="_blank" rel="noreferrer">
                      <Icon name="map" size={18} /> Directions
                    </a>
                  )}
                  {e.kind === 'visit' && (
                    <Link className="btn btn-accent" to={`/admin/estimate${e.leadId ? `?lead=${e.leadId}` : ''}`}>
                      Estimate
                    </Link>
                  )}
                </div>
              </div>
            ))}
          </div>
        ) : (
          <Empty>Nothing on the calendar today.</Empty>
        )}
      </section>

      <section className="stack section-block" aria-labelledby="t-call">
        <h2 id="t-call" className="section-title">
          New leads to call <span className="count">{toCall.length}</span>
        </h2>
        {leads.loading && !leads.data ? (
          <Loading />
        ) : toCall.length ? (
          <ul className="list">
            {toCall.map((l) => (
              <li key={l.id} className="list-row">
                <Link to={`/admin/leads/${l.id}`} className="list-row__main">
                  <span className="row" style={{ ['--gap' as string]: '10px' }}>
                    <strong>{l.name}</strong>
                    <Pri p={l.priority} />
                  </span>
                  <span className="meta">
                    {jobName(l.jobType)} · {recent(l.createdAt)}
                  </span>
                </Link>
                {l.phone && (
                  <a className="btn btn-ghost" href={telHref(l.phone)} aria-label={`Call ${l.name}`}>
                    <Icon name="phone" size={18} /> Call
                  </a>
                )}
              </li>
            ))}
          </ul>
        ) : (
          <Empty>No new leads waiting on a call.</Empty>
        )}
      </section>

      <section className="stack section-block" aria-labelledby="t-wait">
        <h2 id="t-wait" className="section-title">
          Estimates waiting on an answer <span className="count">{waiting.length}</span>
        </h2>
        {waiting.length ? (
          <ul className="list">
            {waiting.map((l) => {
              const est = l.estimateId ? estById.get(l.estimateId) : undefined;
              const days = est?.sentAt ? dayDiff(nowLocal(new Date(est.sentAt)).day, today) : null;
              return (
                <li key={l.id} className="list-row">
                  <Link to={`/admin/leads/${l.id}`} className="list-row__main">
                    <strong>{l.name}</strong>
                    <span className="meta">
                      {jobName(l.jobType)}
                      {est ? ` · ${money(est.total)}` : ''}
                      {days !== null ? ` · sent ${days === 0 ? 'today' : days === 1 ? 'yesterday' : `${days} days ago`}` : ''}
                    </span>
                  </Link>
                  {l.phone && (
                    <a className="btn btn-ghost" href={telHref(l.phone)} aria-label={`Call ${l.name}`}>
                      <Icon name="phone" size={18} /> Follow up
                    </a>
                  )}
                </li>
              );
            })}
          </ul>
        ) : (
          <Empty>No estimates waiting.</Empty>
        )}
      </section>

      <section className="stack section-block" aria-labelledby="t-next">
        <h2 id="t-next" className="section-title">Next 7 days</h2>
        {upcoming.length ? (
          <div className="stack" style={{ ['--gap' as string]: '10px' }}>
            {upcoming.map((e) => (
              <div key={e.id} className="stack" style={{ ['--gap' as string]: '4px' }}>
                <span className="eyebrow eyebrow--muted">{dayLong(e.start)}</span>
                <EventCard e={e} today={today} />
              </div>
            ))}
          </div>
        ) : (
          <Empty>Nothing booked for the next week yet.</Empty>
        )}
        <Link to="/admin/calendar" className="link-more">
          Open the calendar
        </Link>
      </section>
    </div>
  );
}
