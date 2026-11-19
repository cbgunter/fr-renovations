import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { dayShort, money, nowLocal, phone, type PublicEstimate } from '@frr/shared';
import { Icon } from '../ui';

/** What the homeowner sees from the link in their email or text. No login. */
export function CustomerEstimate() {
  const { id } = useParams();
  const [est, setEst] = useState<PublicEstimate | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [confirming, setConfirming] = useState(false);

  useEffect(() => {
    document.title = 'Your estimate | First Responders Renovations';
    fetch(`/api/estimates/${encodeURIComponent(id ?? '')}`)
      .then(async (r) => {
        if (!r.ok) throw new Error(r.status === 404 ? "We couldn't find this estimate. Check the link, or give us a call." : 'Something went wrong loading this estimate.');
        return r.json();
      })
      .then(setEst)
      .catch((e) => setError(e.message));
  }, [id]);

  const approve = async () => {
    setBusy(true);
    try {
      const r = await fetch(`/api/estimates/${encodeURIComponent(id!)}/approve`, { method: 'POST' });
      if (!r.ok) throw new Error('That did not go through. Please try again or call us.');
      setEst(await r.json());
      setConfirming(false);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  const local = (iso?: string) => (iso ? dayShort(nowLocal(new Date(iso)).day) : '');

  return (
    <div className="customer">
      <div className="plaid plaid-band" aria-hidden="true" />
      <header className="customer__head container row">
        <a className="wordmark" href="/">
          <b>First Responders</b>
          <span>Renovations</span>
        </a>
      </header>
      <main className="container customer__main">
        {error && !est && (
          <div className="card card-lg stack">
            <h1 className="h2">Estimate not found</h1>
            <p className="body">{error}</p>
          </div>
        )}
        {!est && !error && <p className="meta">Loading your estimate…</p>}
        {est && (
          <article className="card card-lg stack customer__doc" style={{ ['--gap' as string]: '28px' }}>
            <div className="row" style={{ justifyContent: 'space-between', alignItems: 'flex-start' }}>
              <div className="stack" style={{ ['--gap' as string]: '6px' }}>
                <p className="eyebrow">Estimate #{est.number}</p>
                <h1 className="h2">{est.jobName}</h1>
                <p className="body">
                  For {est.customer.name}
                  {est.customer.address ? `, ${est.customer.address}` : ''}
                </p>
              </div>
              <div className="stack customer__date" style={{ ['--gap' as string]: '2px' }}>
                <span className="meta">Date</span>
                <span className="num">{local(est.sentAt ?? est.createdAt)}</span>
              </div>
            </div>

            {est.status === 'approved' && (
              <div className="approved row" role="status">
                <Icon name="check" />
                <span>
                  You approved this estimate on {local(est.approvedAt)}. We'll call you to set the start date.
                </span>
              </div>
            )}

            <ul className="lines lines--doc">
              {est.lines.map((l, i) => (
                <li key={i}>
                  <span>{l.label}</span>
                  <span className="num">{money(l.amount)}</span>
                </li>
              ))}
              {est.adjustment !== 0 && (
                <li>
                  <span>{est.adjustmentLabel || (est.adjustment < 0 ? 'Discount' : 'Adjustment')}</span>
                  <span className="num">{money(est.adjustment)}</span>
                </li>
              )}
              <li className="lines__total">
                <span>Total</span>
                <span className="num-lg">{money(est.total)}</span>
              </li>
            </ul>

            {est.note && <p className="body prewrap">{est.note}</p>}

            <p className="meta">
              This price holds unless the plan changes. Permits and inspections are included where listed. Questions? Call or reply to the email this came in.
            </p>

            <div className="row no-print">
              {est.status !== 'approved' &&
                (confirming ? (
                  <div className="card stack confirm-box" style={{ ['--gap' as string]: '12px' }}>
                    <p>
                      Approve estimate #{est.number} for <strong className="num">{money(est.total)}</strong>? We'll get in touch to schedule.
                    </p>
                    <div className="row">
                      <button className="btn btn-primary btn-lg" type="button" onClick={approve} disabled={busy}>
                        {busy ? 'One moment…' : 'Yes, approve'}
                      </button>
                      <button className="btn btn-ghost btn-lg" type="button" onClick={() => setConfirming(false)}>
                        Not yet
                      </button>
                    </div>
                  </div>
                ) : (
                  <button className="btn btn-primary btn-lg" type="button" onClick={() => setConfirming(true)}>
                    Approve estimate
                  </button>
                ))}
              <button className="btn btn-ghost btn-lg" type="button" onClick={() => window.print()}>
                <Icon name="print" size={18} /> Print or save as PDF
              </button>
            </div>
            {error && est && <p className="form-error">{error}</p>}
          </article>
        )}
      </main>
      {est && (
        <footer className="customer__foot container">
          <p className="meta">
            {est.business.name}
            {est.business.phone ? ` · ${phone(est.business.phone)}` : ''}
            {est.business.email ? ` · ${est.business.email}` : ''}
            {est.business.license ? ` · Lic. ${est.business.license}` : ''}
          </p>
        </footer>
      )}
    </div>
  );
}
