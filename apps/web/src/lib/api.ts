export interface ApiErrorBody {
  code: string;
  message: string;
  details?: { fields?: Record<string, string> } & Record<string, unknown>;
}

export class ApiError extends Error {
  constructor(
    readonly status: number,
    readonly code: string,
    message: string,
    readonly details: ApiErrorBody['details'] = undefined,
  ) {
    super(message);
    this.name = 'ApiError';
  }

  /** Per-field validation messages, when the API sent any. */
  get fields(): Record<string, string> {
    return this.details?.fields ?? {};
  }
}

let unauthorizedHandler: (() => void) | null = null;

/** Called whenever the API says the session is gone (except for /auth calls). */
export function onUnauthorized(handler: (() => void) | null) {
  unauthorizedHandler = handler;
}

type Method = 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';

export interface RequestOptions {
  method?: Method;
  body?: unknown;
  signal?: AbortSignal;
  fetch?: typeof fetch;
}

/** Calls the API under /api and returns the parsed JSON body. */
export async function request<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const doFetch = options.fetch ?? fetch;
  let res: Response;
  try {
    res = await doFetch(`/api${path}`, {
      method: options.method ?? 'GET',
      headers: options.body !== undefined ? { 'content-type': 'application/json' } : undefined,
      body: options.body !== undefined ? JSON.stringify(options.body) : undefined,
      credentials: 'same-origin',
      signal: options.signal,
    });
  } catch (err) {
    if (err instanceof DOMException && err.name === 'AbortError') throw err;
    throw new ApiError(0, 'network', 'Could not reach the server. Check your connection.');
  }

  if (res.status === 204) return undefined as T;
  const text = await res.text();
  let data: unknown = undefined;
  if (text) {
    try {
      data = JSON.parse(text);
    } catch {
      data = undefined;
    }
  }
  if (!res.ok) {
    if (res.status === 401 && !path.startsWith('/auth/')) unauthorizedHandler?.();
    const err = (data as { error?: ApiErrorBody } | undefined)?.error;
    throw new ApiError(
      res.status,
      err?.code ?? 'http_error',
      err?.message ?? `Request failed (${res.status}).`,
      err?.details,
    );
  }
  return data as T;
}

export const api = {
  get: <T>(path: string, opts?: Omit<RequestOptions, 'method' | 'body'>) =>
    request<T>(path, { ...opts, method: 'GET' }),
  post: <T>(path: string, body?: unknown, opts?: Omit<RequestOptions, 'method' | 'body'>) =>
    request<T>(path, { ...opts, method: 'POST', body }),
  put: <T>(path: string, body?: unknown, opts?: Omit<RequestOptions, 'method' | 'body'>) =>
    request<T>(path, { ...opts, method: 'PUT', body }),
  patch: <T>(path: string, body?: unknown, opts?: Omit<RequestOptions, 'method' | 'body'>) =>
    request<T>(path, { ...opts, method: 'PATCH', body }),
  delete: <T>(path: string, opts?: Omit<RequestOptions, 'method'>) =>
    request<T>(path, { ...opts, method: 'DELETE' }),
};
