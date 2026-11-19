import { NavLink, Outlet, useLocation } from 'react-router-dom';
import { useEffect } from 'react';
import { authDisabled } from './lib/auth';
import { Icon } from './ui';

const NAV = [
  { to: '/admin', label: 'Today', icon: 'today', end: true },
  { to: '/admin/leads', label: 'Leads', icon: 'leads' },
  { to: '/admin/estimate', label: 'Estimate', icon: 'estimate' },
  { to: '/admin/calendar', label: 'Calendar', icon: 'calendar' },
] as const;

export function Shell() {
  const loc = useLocation();
  useEffect(() => {
    window.scrollTo(0, 0);
  }, [loc.pathname]);

  return (
    <div className="admin">
      <aside className="admin-side" aria-label="Admin">
        <a className="admin-brand" href="/admin">
          <span className="plaid plaid-mark" aria-hidden="true" />
          <span className="stack" style={{ ['--gap' as string]: '0' }}>
            <b>First Responder</b>
            <span>Renovations</span>
          </span>
        </a>
        <nav className="admin-nav" aria-label="Main">
          {NAV.map((n) => (
            <NavLink key={n.to} to={n.to} end={'end' in n ? n.end : false}>
              <Icon name={n.icon} />
              {n.label}
            </NavLink>
          ))}
          <NavLink to="/admin/settings">
            <Icon name="settings" />
            Settings
          </NavLink>
        </nav>
        {authDisabled && <p className="tag" style={{ margin: '16px' }}>Local dev · not signed in</p>}
      </aside>

      <header className="admin-top">
        <a className="admin-brand" href="/admin">
          <span className="plaid plaid-mark" aria-hidden="true" />
          <b>First Responder</b>
        </a>
        <NavLink to="/admin/settings" className="icon-btn" aria-label="Settings">
          <Icon name="settings" />
        </NavLink>
      </header>

      <main className="admin-main" id="main">
        <Outlet />
      </main>

      <nav className="tabbar" aria-label="Main">
        {NAV.map((n) => (
          <NavLink key={n.to} to={n.to} end={'end' in n ? n.end : false}>
            <Icon name={n.icon} />
            <span>{n.label}</span>
          </NavLink>
        ))}
      </nav>
    </div>
  );
}
