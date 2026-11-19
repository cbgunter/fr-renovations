import { useCallback, useEffect, useRef, useState } from 'react';
import { accessToken, authDisabled, signOut } from './auth';

export class ApiError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
  }
}

export async function api<T>(method: string, path: string, body?: unknown): Promise<T> {
  const send = async (token: string | null) =>
    fetch(`/api${path}`, {
      method,
      headers: {
        ...(body !== undefined ? { 'Content-Type': 'application/json' } : {}),
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: body !== undefined ? JSON.stringify(body) : undefined,
    });

  const needsAuth = path.startsWith('/admin');
  let res: Response;
  try {
    res = await send(needsAuth ? await accessToken() : null);
    if (res.status === 401 && needsAuth && !authDisabled) {
      const fresh = await accessToken(true);
      if (!fresh) {
        await signOut();
        throw new ApiError(401, 'Please sign in again.');
      }
      res = await send(fresh);
    }
  } catch (e) {
    if (e instanceof ApiError) throw e;
    throw new ApiError(0, "No connection. Check your signal and try again. Nothing you've entered is lost.");
  }
  const text = await res.text();
  const json = text ? JSON.parse(text) : undefined;
  if (!res.ok) {
    if (res.status === 401 && needsAuth) await signOut();
    throw new ApiError(res.status, json?.error ?? json?.message ?? 'Something went wrong. Try again.');
  }
  return json as T;
}

/** Load something from the API once (and on reload()). */
export function useApi<T>(path: string | null) {
  const [data, setData] = useState<T | undefined>(undefined);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(!!path);
  const seq = useRef(0);

  const reload = useCallback(async () => {
    if (!path) return;
    const n = ++seq.current;
    setLoading(true);
    try {
      const d = await api<T>('GET', path);
      if (n === seq.current) {
        setData(d);
        setError(null);
      }
    } catch (e) {
      if (n === seq.current) setError((e as Error).message);
    } finally {
      if (n === seq.current) setLoading(false);
    }
  }, [path]);

  useEffect(() => {
    reload();
  }, [reload]);

  return { data, error, loading, reload, setData };
}
