import { QueryClient, QueryCache, QueryFunction } from "@tanstack/react-query";

function getCsrfToken(): string {
  const match = document.cookie.match(/(?:^|; )csrf_token=([^;]*)/);
  return match ? decodeURIComponent(match[1]) : '';
}

async function throwIfResNotOk(res: Response) {
  if (!res.ok) {
    const text = (await res.text()) || res.statusText;
    throw new Error(`${res.status}: ${text}`);
  }
}

export async function apiRequest(
  method: string,
  url: string,
  data?: unknown | undefined,
): Promise<Response> {
  const headers: Record<string, string> = {};
  
  if (data) {
    headers["Content-Type"] = "application/json";
  }
  
  const csrfToken = getCsrfToken();
  if (csrfToken && !['GET', 'HEAD', 'OPTIONS'].includes(method.toUpperCase())) {
    headers["X-CSRF-Token"] = csrfToken;
  }
  
  const res = await fetch(url, {
    method,
    headers,
    body: data ? JSON.stringify(data) : undefined,
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
