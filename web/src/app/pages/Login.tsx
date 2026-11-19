import { useState, type FormEvent } from 'react';
import { Navigate, useLocation, useNavigate } from 'react-router-dom';
import { authDisabled, confirmForgotPassword, forgotPassword, isSignedIn, setNewPassword, signIn } from '../lib/auth';
import { TextField } from '../ui';

type Mode = { m: 'signin' } | { m: 'new-password'; session: string } | { m: 'forgot' } | { m: 'reset'; };

export function Login() {
  const nav = useNavigate();
  const loc = useLocation();
  const from = (loc.state as { from?: string } | null)?.from ?? '/admin';
  const [mode, setMode] = useState<Mode>({ m: 'signin' });
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [password2, setPassword2] = useState('');
  const [code, setCode] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [note, setNote] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  if (authDisabled || isSignedIn()) return <Navigate to={from} replace />;

  const run = async (fn: () => Promise<void>) => {
    setBusy(true);
    setError(null);
    try {
      await fn();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  const submit = (e: FormEvent) => {
    e.preventDefault();
    if (mode.m === 'signin') {
      run(async () => {
        const r = await signIn(email, password);
        if (r === 'ok') nav(from, { replace: true });
        else {
          setPassword('');
          setMode({ m: 'new-password', session: r.newPassword });
        }
      });
    } else if (mode.m === 'new-password') {
      if (password.length < 10) return setError('Pick a password with at least 10 characters.');
      if (password !== password2) return setError("The two passwords don't match.");
      run(async () => {
        await setNewPassword(email, mode.session, password);
        nav(from, { replace: true });
      });
    } else if (mode.m === 'forgot') {
      run(async () => {
        await forgotPassword(email);
        setNote(`If ${email} has an account, a code is on its way. Check your email.`);
        setMode({ m: 'reset' });
      });
    } else {
      if (password.length < 10) return setError('Pick a password with at least 10 characters.');
      run(async () => {
        await confirmForgotPassword(email, code, password);
        setNote('Password changed. Sign in with your new password.');
        setPassword('');
        setCode('');
        setMode({ m: 'signin' });
      });
    }
  };

  const titles = {
    signin: 'Sign in',
    'new-password': 'Pick your password',
    forgot: 'Reset your password',
    reset: 'Enter the code',
  } as const;

  return (
    <div className="login">
      <div className="plaid plaid-band" aria-hidden="true" />
      <main className="login__main">
        <form className="card card-lg stack login__card" onSubmit={submit} style={{ ['--gap' as string]: '18px' }}>
          <a className="wordmark" href="/">
            <b>First Responders</b>
            <span>Renovations</span>
          </a>
          <h1 className="h-admin">{titles[mode.m]}</h1>
          {note && <p className="note">{note}</p>}
          {mode.m === 'new-password' && <p className="meta">This is your first sign-in. Choose a password you'll remember: at least 10 characters.</p>}

          {(mode.m === 'signin' || mode.m === 'forgot') && (
            <TextField label="Email" type="email" autoComplete="username" inputMode="email" value={email} onChange={setEmail} required />
          )}
          {mode.m === 'reset' && <TextField label="Code from the email" inputMode="numeric" autoComplete="one-time-code" value={code} onChange={setCode} required />}
          {mode.m === 'signin' && <TextField label="Password" type="password" autoComplete="current-password" value={password} onChange={setPassword} required />}
          {(mode.m === 'new-password' || mode.m === 'reset') && (
            <TextField label="New password" type="password" autoComplete="new-password" value={password} onChange={setPassword} required />
          )}
          {mode.m === 'new-password' && (
            <TextField label="Type it again" type="password" autoComplete="new-password" value={password2} onChange={setPassword2} required />
          )}

          {error && (
            <p className="form-error" role="alert">
              {error}
            </p>
          )}
          <button className="btn btn-primary btn-lg" type="submit" disabled={busy}>
            {busy ? 'One moment…' : mode.m === 'signin' ? 'Sign in' : mode.m === 'forgot' ? 'Email me a code' : 'Save password'}
          </button>
          {mode.m === 'signin' ? (
            <button type="button" className="link-btn" onClick={() => { setError(null); setNote(null); setMode({ m: 'forgot' }); }}>
              Forgot password?
            </button>
          ) : (
            <button type="button" className="link-btn" onClick={() => { setError(null); setMode({ m: 'signin' }); }}>
              Back to sign in
            </button>
          )}
        </form>
      </main>
    </div>
  );
}
