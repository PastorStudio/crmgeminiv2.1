import { QueryClient, QueryFunction } from "@tanstack/react-query";

async function throwIfResNotOk(res: Response) {
  if (!res.ok) {
    const text = (await res.text()) || res.statusText;
    throw new Error(`${res.status}: ${text}`);
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
  const body = options?.body ? JSON.stringify(options.body) : undefined;
  const headers = {
    ...(body ? { 'Content-Type': 'application/json' } : {}),
    'Accept': 'application/json',
    ...options?.headers
  };

  try {
    const res = await fetch(url, {
      method,
      headers,
      body,
      credentials: "include",
    });

    await throwIfResNotOk(res);
    
    const contentType = res.headers.get('content-type');
    if (contentType && contentType.includes('application/json')) {
      return await res.json();
    } else {
      console.error(`Invalid content type: ${contentType}, url: ${url}`);
      // Devolver un valor compatible con la estructura esperada para evitar errores
      return { initialized: true, ready: false, error: 'Formato de respuesta no válido' } as T;
    }
  } catch (error) {
    console.error(`Error en solicitud API a ${url}:`, error);
    // Devolver un valor compatible con la estructura esperada para evitar errores
    return { initialized: true, ready: false, error: 'Error de conexión' } as T;
  }
}

type UnauthorizedBehavior = "returnNull" | "throw";
export const getQueryFn: <T>(options: {
  on401: UnauthorizedBehavior;
}) => QueryFunction<T> =
  ({ on401: unauthorizedBehavior }) =>
  async ({ queryKey }) => {
    const res = await fetch(queryKey[0] as string, {
      credentials: "include",
    });

    if (unauthorizedBehavior === "returnNull" && res.status === 401) {
      return null;
    }

    await throwIfResNotOk(res);
    return await res.json();
  };

export const queryClient = new QueryClient({
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
