import { QueryClient, QueryKey } from '@tanstack/react-query';

let currentUserId = "user123";

async function throwIfResNotOk(res: Response) {
  if (!res.ok) {
    const text = await res.text();
    console.error(`HTTP ${res.status}: ${text}`);
    throw new Error(`HTTP ${res.status}: ${text}`);
  }
}

interface RequestOptions {
  method?: string;
  body?: any;
  headers?: Record<string, string>;
}

export async function apiRequest<T = any>(
  url: string,
  options?: RequestOptions
): Promise<T> {
  const method = options?.method || 'GET';
  
  // Get JWT token from localStorage
  const token = localStorage.getItem('crm_auth_token');
  
  const headers = {
    'Content-Type': 'application/json',
    ...(token && { 'Authorization': `Bearer ${token}` }),
    ...options?.headers
  };

  const finalUrl = url;
    
  const urlWithTimestamp = finalUrl.includes('?') 
    ? `${finalUrl}&_t=${Date.now()}` 
    : `${finalUrl}?_t=${Date.now()}`;

  try {
    const res = await fetch(urlWithTimestamp, {
      method,
      headers,
      body: options?.body ? JSON.stringify(options.body) : undefined,
      credentials: "include"
    });

    await throwIfResNotOk(res);
    
    const contentType = res.headers.get('content-type');
    if (contentType?.includes('application/json')) {
      return await res.json();
    }
    
    const text = await res.text();
    try {
      return JSON.parse(text);
    } catch {
      return text as unknown as T;
    }
  } catch (error) {
    console.error(`Error en solicitud API a ${url}:`, error);
    throw error;
  }
}

type UnauthorizedBehavior = "returnNull" | "throw";

export const getQueryFn = ({ on401 }: { on401: UnauthorizedBehavior }) => 
  async ({ queryKey }: { queryKey: QueryKey }) => {
    const url = queryKey[0] as string;
    
    try {
      const result = await apiRequest(url);
      return result;
    } catch (error) {
      if (error instanceof Response && error.status === 401) {
        if (on401 === "returnNull") {
          return null;
        }
      }
      throw error;
    }
  };

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      queryFn: getQueryFn({ on401: "throw" }),
      refetchInterval: false,
      refetchOnWindowFocus: false,
      staleTime: 30000,
      gcTime: 300000,
      retry: false,
    },
    mutations: {
      retry: false,
    },
  },
});