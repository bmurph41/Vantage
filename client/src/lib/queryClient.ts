import { QueryClient, QueryCache, QueryFunction } from "@tanstack/react-query";

export function getCsrfToken(): string {
  const match = document.cookie.match(/(?:^|; )csrf_token=([^;]*)/);
  return match ? decodeURIComponent(match[1]) : '';
}

export async function ensureCsrfToken(): Promise<string> {
  let token = getCsrfToken();
  if (!token) {
    await fetch('/api/auth/me', { credentials: 'include' });
    token = getCsrfToken();
  }
  return token;
}

async function throwIfResNotOk(res: Response) {
  if (!res.ok) {
    const text = (await res.text()) || res.statusText;
    throw new Error(`${res.status}: ${text}`);
  }
}

/**
 * Error type that carries the HTTP status code and parsed JSON body alongside the message.
 * Thrown by `postJson` on non-2xx responses, enabling callers to branch on specific status
 * codes (e.g. 403 entitlement failures) without parsing string-encoded error messages.
 */
export interface TypedFetchError extends Error {
  status: number;
  body: Record<string, unknown>;
}

/**
 * POST JSON to `url` using the same credentials/CSRF header setup as `apiRequest`.
 * Unlike `apiRequest`, this helper parses the response body on error and throws a
 * `TypedFetchError` — making it easy to branch on structured error payloads (e.g. 403).
 *
 * Note: both the success and error paths parse the response as JSON.  Use only with
 * endpoints that return `application/json` for all status codes; non-JSON bodies will
 * silently resolve to `{}`.
 */
export async function postJson(
  url: string,
  payload: Record<string, unknown>,
): Promise<Record<string, unknown>> {
  const csrfToken = getCsrfToken();
  const res = await fetch(url, {
    method: 'POST',
    credentials: 'include',
    headers: {
      'Content-Type': 'application/json',
      ...(csrfToken ? { 'X-CSRF-Token': csrfToken } : {}),
    },
    body: JSON.stringify(payload),
  });
  const body = await res.json().catch(() => ({})) as Record<string, unknown>;
  if (!res.ok) {
    const err = new Error(
      typeof body.message === 'string' ? body.message : `Request failed with status ${res.status}`,
    ) as TypedFetchError;
    err.status = res.status;
    err.body = body;
    throw err;
  }
  return body;
}

/**
 * Make an authenticated API request with CSRF token handling.
 *
 * Two call signatures are supported:
 *
 * **URL-first (preferred — matches the docket variant in
 * `client/src/docket/lib/queryClient.ts`, and used by the majority of callers
 * across the codebase):**
 * ```ts
 * apiRequest(url, { method, body, headers })
 * ```
 * In this form, `body` is passed through to `fetch` as-is — caller is
 * responsible for `JSON.stringify` and any `Content-Type` header.
 *
 * **Method-first (legacy — kept for backward compatibility; new code should
 * use the URL-first form to stay consistent with the docket variant):**
 * ```ts
 * apiRequest(method, url, data)
 * ```
 * In this form, `data` is automatically `JSON.stringify`'d and the
 * `Content-Type: application/json` header is set when `data` is truthy.
 *
 * Both signatures produce identical network requests for equivalent inputs:
 * `credentials: "include"`, throw on non-2xx, and add `X-CSRF-Token` for
 * non-GET/HEAD/OPTIONS methods when a CSRF cookie is present.
 */
export async function apiRequest(
  methodOrUrl: string,
  urlOrOptions?: string | RequestInit,
  data?: unknown | undefined,
): Promise<Response> {
  let url: string;
  let method: string;
  let body: BodyInit | null | undefined;
  const headers: Record<string, string> = {};

  if (typeof urlOrOptions === 'object' && urlOrOptions !== null) {
    // URL-first: apiRequest(url, { method, body, headers })
    url = methodOrUrl;
    const options = urlOrOptions;
    method = (options.method ?? 'GET').toString();
    body = options.body ?? undefined;
    if (options.headers) {
      const incoming = options.headers as Record<string, string>;
      for (const key of Object.keys(incoming)) {
        headers[key] = incoming[key];
      }
    }
  } else {
    // Method-first: apiRequest(method, url, data)
    method = methodOrUrl;
    url = urlOrOptions as string;
    if (data) {
      headers["Content-Type"] = "application/json";
      body = JSON.stringify(data);
    }
  }

  const csrfToken = getCsrfToken();
  if (csrfToken && !['GET', 'HEAD', 'OPTIONS'].includes(method.toUpperCase())) {
    headers["X-CSRF-Token"] = csrfToken;
  }

  const res = await fetch(url, {
    method,
    headers,
    body,
    credentials: "include",
  });

  await throwIfResNotOk(res);
  return res;
}

type UnauthorizedBehavior = "returnNull" | "throw";
export const getQueryFn: <T>(options: {
  on401: UnauthorizedBehavior;
}) => QueryFunction<T> =
  ({ on401: unauthorizedBehavior }) =>
  async ({ queryKey }) => {
    const res = await fetch(queryKey.join("/") as string, {
      credentials: "include",
    });

    if (unauthorizedBehavior === "returnNull" && res.status === 401) {
      return null;
    }

    await throwIfResNotOk(res);

    // Guard against SPA catch-all returning HTML instead of JSON.
    // This happens when an API route is unregistered and Express falls through
    // to serveStatic, which returns index.html with a 200 status.  Calling
    // res.json() on HTML produces the confusing "Unexpected token '<'" error;
    // replace it with a clearer message that also names the missing URL.
    const contentType = res.headers.get('content-type') || '';
    if (!contentType.includes('application/json')) {
      throw new Error(
        `API endpoint returned unexpected content (${res.status} ${res.statusText}). ` +
        `The route "${(queryKey as string[]).join('/')}" may not be registered on the server.`
      );
    }

    return await res.json();
  };

export const queryClient = new QueryClient({
  queryCache: new QueryCache({
    onError: (error, query) => {
      // Only surface errors for initial fetches, not background refetches
      if (query.state.data !== undefined) return;
      // Suppress 401s — auth layer handles those via redirect
      if (error instanceof Error && error.message.startsWith('401')) return;
      window.dispatchEvent(
        new CustomEvent('query-error', { detail: { message: error instanceof Error ? error.message : 'Failed to load data' } })
      );
    },
  }),
  defaultOptions: {
    queries: {
      queryFn: getQueryFn({ on401: "returnNull" }),
      refetchInterval: false,
      refetchOnWindowFocus: false,
      staleTime: 5 * 60 * 1000,
      gcTime: 10 * 60 * 1000,
      retry: (failureCount, error) => {
        // Don't retry auth failures
        if (error instanceof Error && error.message.startsWith('401')) return false;
        return failureCount < 1;
      },
    },
    mutations: {
      retry: false,
    },
  },
});
