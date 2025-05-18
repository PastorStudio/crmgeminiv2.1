import { QueryClient } from "@tanstack/react-query";
import axios from "axios";

const BASE_URL = process.env.NODE_ENV === "production" 
  ? "" // En producción, usará la ruta relativa del servidor
  : "http://localhost:5000";

// Crea una instancia de Axios configurada
export const api = axios.create({
  baseURL: BASE_URL,
  timeout: 30000, // 30 segundos
  headers: {
    "Content-Type": "application/json",
  },
});

// Crea el cliente de consulta con configuración estándar
export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 1000 * 60 * 5, // 5 minutos
      retry: 1,
      refetchOnWindowFocus: false,
    },
  },
});

// Función para realizar peticiones a la API
export async function apiRequest(url: string, method = "GET", data?: any) {
  try {
    const response = await api({
      url,
      method,
      data,
    });
    return response.data;
  } catch (error) {
    console.error(`Error en ${method} ${url}:`, error);
    throw error;
  }
}

// Funciones auxiliares para realizar peticiones CRUD
export async function apiGet(url: string) {
  return apiRequest(url);
}

export async function apiPost(url: string, data: any) {
  return apiRequest(url, "POST", data);
}

export async function apiPut(url: string, data: any) {
  return apiRequest(url, "PUT", data);
}

export async function apiPatch(url: string, data: any) {
  return apiRequest(url, "PATCH", data);
}

export async function apiDelete(url: string) {
  return apiRequest(url, "DELETE");
}