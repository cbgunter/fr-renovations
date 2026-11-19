import { Link, useSearchParams } from 'react-router-dom';
import { LEAD_STATUSES, jobName, recent, sourceLabel, type Lead, type LeadStatus } from '@frr/shared';
import { useApi } from '../lib/api';
import { telHref } from '../lib/links';
import { Empty, ErrorNote, Icon, Loading, Pri, StatusPill } from '../ui';

export function Leads() {
  const [params, setParams] = useSearchParams();
  const tab = (LEAD_STATUSES.some((s) => s.id === params.get('tab')) ? params.get('tab') : 'new') as LeadStatus;
  const { data, error, loading, reload } = useApi<Lead[]>('/admin/leads');
  const counts = Object.fromEntries(LEAD_STATUSES.map((s) => [s.id, (data ?? []).filter((l) => l.status === s.id).length]));
  // The API already sorts High -> Low, newest first.
  const rows = (data ?? []).filter((l) => l.status === tab);

  return (
    <div className="page stack">
      <div className="page-head">
        <h1 className="h-admin">Leads</h1>
        <Link className="btn btn-primary" to="/admin/leads/new">
          <Icon name="plus" size={18} /> Add lead
        </Link>
      </div>

      <div className="tabs-scroll">
        <div className="tabs" role="tablist" aria-label="Lead status">
          {LEAD_STATUSES.map((s) => (
            <button
              key={s.id}
              role="tab"
              type="button"
              aria-selected={tab === s.id}
              className="tab"
              onClick={() => setParams({ tab: s.id }, { replace: true })}
            >
              {s.label} <span className="count">{counts[s.id] ?? 0}</span>
            </button>
          ))}
        </div>
      </div>

      {error && <ErrorNote message={error} retry={reload} />}
      {loading && !data ? (
        <Loading />
      ) : rows.length === 0 ? (
        <Empty>
          {tab === 'new'
            ? 'No leads need a visit right now. New web requests show up here automatically.'
            : `Nothing in "${LEAD_STATUSES.find((s) => s.id === tab)?.label}".`}
        </Empty>
      ) : (
        <div className="table-box" role="tabpanel">
          <ul className="lead-list">
            {rows.map((l) => (
              <li key={l.id} className="lead-item">
                <Link to={`/admin/leads/${l.id}`} className="lead-item__link">
                  <Pri p={l.priority} />
                  <span className="stack lead-item__who" style={{ ['--gap' as string]: '2px' }}>
                    <strong>{l.name}</strong>
                    <span className="meta">
                      {[l.address, sourceLabel(l.source).toLowerCase(), recent(l.createdAt)].filter(Boolean).join(' · ')}
                    </span>
                  </span>
                  <span className="lead-item__job">{jobName(l.jobType)}</span>
                  <StatusPill status={l.status} visitAt={l.visitAt} />
                </Link>
                <div className="lead-item__actions row">
                  {l.phone && (
                    <a className="btn btn-ghost" href={telHref(l.phone)} aria-label={`Call ${l.name}`}>
                      <Icon name="phone" size={18} /> Call
                    </a>
                  )}
                  {(l.status === 'new' || l.status === 'visit') && (
                    <Link className="btn btn-accent" to={`/admin/estimate?lead=${l.id}`}>
                      Estimate
                    </Link>
                  )}
                </div>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
