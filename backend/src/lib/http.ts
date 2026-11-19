export interface Req {
  method: string;
  /** Path with the leading "/api" removed, e.g. "/admin/leads/abc". */
  path: string;
  query: Record<string, string | undefined>;
  body: unknown;
  /** Cognito user (email) when the request passed the JWT authorizer. */
  user?: string;
}

export interface Res {
  status: number;
  body?: unknown;
  headers?: Record<string, string>;
  /** Raw string body (e.g. text/calendar); takes precedence over body. */
  raw?: string;
}

export class HttpError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
  }
}

export const ok = (body: unknown, status = 200): Res => ({ status, body });
export const bad = (msg: string): never => {
  throw new HttpError(400, msg);
};
export const notFound = (what = 'Not found'): never => {
  throw new HttpError(404, what);
};

/** Read a trimmed string field, capped at `max` chars. */
export function str(obj: unknown, key: string, max = 500): string {
  const v = (obj as Record<string, unknown> | null)?.[key];
  if (v === undefined || v === null) return '';
  return String(v).trim().slice(0, max);
}

export function oneOf<T extends string>(v: unknown, allowed: readonly T[], fallback: T): T {
  return allowed.includes(v as T) ? (v as T) : fallback;
}

export const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
export const LOCAL_DT_RE = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/;
export const DAY_RE = /^\d{4}-\d{2}-\d{2}$/;
