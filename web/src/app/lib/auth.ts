/**
 * Cognito sign-in without the AWS SDK: the user-pool API is plain JSON over fetch.
 * Tokens live in localStorage; the refresh token lasts 90 days so the owner
 * stays signed in on their phone.
 *
 * With no VITE_USER_POOL_CLIENT_ID (local dev against `npm run dev:api`) auth is skipped.
 */
const REGION = 'us-east-1';
const ENDPOINT = `https://cognito-idp.${REGION}.amazonaws.com/`;
const CLIENT_ID = import.meta.env.VITE_USER_POOL_CLIENT_ID as string | undefined;
const KEY = 'frr.auth';

export const authDisabled = !CLIENT_ID;

interface Session {
  email: string;
  access: string;
  refresh: string;
  /** epoch ms */
  expiresAt: number;
}

export class AuthError extends Error {
  constructor(
    public code: string,
    message: string,
  ) {
    super(message);
  }
}

const FRIENDLY: Record<string, string> = {
  NotAuthorizedException: "That email and password don't match. Try again, or reset your password.",
  UserNotFoundException: "That email and password don't match. Try again, or reset your password.",
  PasswordResetRequiredException: 'You need to set a new password. Tap "Forgot password" below.',
  InvalidPasswordException: 'Pick a password with at least 10 characters.',
  CodeMismatchException: "That code isn't right. Check the email and try again.",
  ExpiredCodeException: 'That code has expired. Ask for a new one.',
  LimitExceededException: 'Too many tries. Wait a few minutes and try again.',
  TooManyRequestsException: 'Too many tries. Wait a few minutes and try again.',
  InvalidParameterException: 'Check the email and password and try again.',
};

async function cognito<T>(action: string, body: object): Promise<T> {
  let res: Response;
  try {
    res = await fetch(ENDPOINT, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-amz-json-1.1',
        'X-Amz-Target': `AWSCognitoIdentityProviderService.${action}`,
      },
      body: JSON.stringify(body),
    });
  } catch {
    throw new AuthError('Network', "Can't reach the sign-in service. Check your connection.");
  }
  const json = await res.json().catch(() => ({}));
  if (!res.ok) {
    const code = String(json.__type ?? 'Error').split('#').pop()!;
    throw new AuthError(code, FRIENDLY[code] ?? json.message ?? 'Sign-in failed. Try again.');
  }
  return json as T;
}

interface AuthResult {
  AuthenticationResult?: { AccessToken: string; RefreshToken?: string; ExpiresIn: number };
  ChallengeName?: string;
  Session?: string;
}

function load(): Session | null {
  try {
    const raw = localStorage.getItem(KEY);
    return raw ? (JSON.parse(raw) as Session) : null;
  } catch {
    return null;
  }
}

function save(s: Session | null) {
  try {
    if (s) localStorage.setItem(KEY, JSON.stringify(s));
    else localStorage.removeItem(KEY);
  } catch {
    /* private mode: stays signed in for this tab only */
  }
  current = s;
  listeners.forEach((l) => l());
}

let current: Session | null = load();
const listeners = new Set<() => void>();
export const onAuthChange = (fn: () => void) => {
  listeners.add(fn);
  return () => listeners.delete(fn);
};

export const isSignedIn = () => authDisabled || !!current;
export const signedInEmail = () => (authDisabled ? 'local dev' : (current?.email ?? ''));

function store(email: string, r: AuthResult, prevRefresh?: string) {
  const a = r.AuthenticationResult!;
  save({
    email,
    access: a.AccessToken,
    refresh: a.RefreshToken ?? prevRefresh ?? '',
    expiresAt: Date.now() + a.ExpiresIn * 1000,
  });
}

/** Returns "new-password" when Cognito wants the temp password replaced. */
export async function signIn(email: string, password: string): Promise<'ok' | { newPassword: string }> {
  const r = await cognito<AuthResult>('InitiateAuth', {
    AuthFlow: 'USER_PASSWORD_AUTH',
    ClientId: CLIENT_ID,
    AuthParameters: { USERNAME: email.trim().toLowerCase(), PASSWORD: password },
  });
  if (r.ChallengeName === 'NEW_PASSWORD_REQUIRED') return { newPassword: r.Session! };
  if (!r.AuthenticationResult) throw new AuthError('Unknown', 'Sign-in needs a step this app does not support.');
  store(email.trim().toLowerCase(), r);
  return 'ok';
}

export async function setNewPassword(email: string, session: string, password: string) {
  const r = await cognito<AuthResult>('RespondToAuthChallenge', {
    ChallengeName: 'NEW_PASSWORD_REQUIRED',
    ClientId: CLIENT_ID,
    Session: session,
    ChallengeResponses: { USERNAME: email.trim().toLowerCase(), NEW_PASSWORD: password },
  });
  store(email.trim().toLowerCase(), r);
}

export const forgotPassword = (email: string) =>
  cognito('ForgotPassword', { ClientId: CLIENT_ID, Username: email.trim().toLowerCase() });

export const confirmForgotPassword = (email: string, code: string, password: string) =>
  cognito('ConfirmForgotPassword', {
    ClientId: CLIENT_ID,
    Username: email.trim().toLowerCase(),
    ConfirmationCode: code.trim(),
    Password: password,
  });

let refreshing: Promise<string | null> | null = null;

async function refresh(): Promise<string | null> {
  const s = current;
  if (!s?.refresh) return null;
  try {
    const r = await cognito<AuthResult>('InitiateAuth', {
      AuthFlow: 'REFRESH_TOKEN_AUTH',
      ClientId: CLIENT_ID,
      AuthParameters: { REFRESH_TOKEN: s.refresh },
    });
    store(s.email, r, s.refresh);
    return current!.access;
  } catch (e) {
    // Only a rejected refresh token signs you out; a network blip does not.
    if (e instanceof AuthError && e.code !== 'Network') save(null);
    return null;
  }
}

/** A valid access token, refreshing first if it expires within a minute. */
export async function accessToken(force = false): Promise<string | null> {
  if (authDisabled) return null;
  if (!current) return null;
  if (!force && current.expiresAt - Date.now() > 60_000) return current.access;
  refreshing ??= refresh().finally(() => (refreshing = null));
  return refreshing;
}

export async function signOut() {
  const s = current;
  save(null);
  if (s?.refresh && CLIENT_ID) {
    cognito('RevokeToken', { ClientId: CLIENT_ID, Token: s.refresh }).catch(() => {});
  }
}
