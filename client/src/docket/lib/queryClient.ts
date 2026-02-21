import { QueryClient, QueryFunction } from "@tanstack/react-query";

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

// Updated apiRequest function with URL-first signature for consistency
// Automatically prefixes Docket API calls with /api/docket
export async function apiRequest(
  url: string,
  options?: RequestInit
): Promise<any> {
  // Prefix all Docket API calls with /api/docket
  const fullUrl = url.startsWith('/api/') && !url.startsWith('/api/docket/')
    ? url.replace('/api/', '/api/docket/')
    : url;

  const method = options?.method?.toUpperCase() || 'GET';
  const headers: Record<string, string> = {};
  
  // Copy existing headers
  if (options?.headers) {
    const existingHeaders = options.headers as Record<string, string>;
    Object.keys(existingHeaders).forEach(key => {
      headers[key] = existingHeaders[key];
    });
  }
  
  // Add CSRF token for non-safe methods
  const csrfToken = getCsrfToken();
  if (csrfToken && !['GET', 'HEAD', 'OPTIONS'].includes(method)) {
    headers["X-CSRF-Token"] = csrfToken;
  }

  const res = await fetch(fullUrl, {
    ...options,
    headers,
    credentials: "include",
  });

  await throwIfResNotOk(res);
  
  // Handle 204 No Content responses (e.g., DELETE operations)
  if (res.status === 204 || res.headers.get('content-length') === '0') {
    return null;
  }
  
  // Check if there's actually JSON content to parse
  const contentType = res.headers.get('content-type');
  if (contentType && contentType.includes('application/json')) {
    return await res.json();
  }
  
  // Fallback for text responses or empty bodies
  const text = await res.text();
  if (text) {
    try {
      return JSON.parse(text);
    } catch {
      return text;
    }
  }
  return null;
}

type UnauthorizedBehavior = "returnNull" | "throw";
export const getQueryFn: <T>(options: {
  on401: UnauthorizedBehavior;
}) => QueryFunction<T> =
  ({ on401: unauthorizedBehavior }) =>
  async ({ queryKey }) => {
    const url = queryKey.join("/") as string;
    // Prefix all Docket API calls with /api/docket
    const fullUrl = url.startsWith('/api/') && !url.startsWith('/api/docket/')
      ? url.replace('/api/', '/api/docket/')
      : url;
      
    const res = await fetch(fullUrl, {
      credentials: "include",
    });

    if (unauthorizedBehavior === "returnNull" && res.status === 401) {
      return null;
    }

    await throwIfResNotOk(res);
    return await res.json();
  };

export const docketQueryClient = new QueryClient({
  defaultOptions: {
    queries: {
      queryFn: getQueryFn({ on401: "throw" }),
      refetchInterval: false,
      refetchOnWindowFocus: false,
      staleTime: Infinity,
      retry: false,
    },
    mutations: {
      retry: false,
    },
  },
});

// Export as both names for backwards compatibility
export const queryClient = docketQueryClient;
