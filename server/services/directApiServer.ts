/**
 * Servidor especial para APIs directas
 * Esta implementación evita que Vite intercepte las respuestas de nuestra API
 */

import http from 'http';
import { log } from '../vite';

export interface DirectHandlerConfig {
  path: string;
  method: 'GET' | 'POST' | 'PUT' | 'DELETE';
  contentType: string;
  handler: (req: http.IncomingMessage, res: http.ServerResponse, params: any) => Promise<void>;
}

// Lista de handlers para las APIs directas
const directHandlers: DirectHandlerConfig[] = [];

// Servidor HTTP independiente
let directServer: http.Server | null = null;

/**
 * Registra un handler para una API directa
 */
export function registerDirectHandler(config: DirectHandlerConfig) {
  directHandlers.push(config);
  log(`API directa registrada: ${config.method} ${config.path}`, 'direct-api');
}

/**
 * Inicia el servidor de APIs directas
 */
export function startDirectApiServer(port: number = 5001) {
  // Crear servidor HTTP independiente
  directServer = http.createServer((req, res) => {
    if (!req.url) {
      sendError(res, 404, 'URL no encontrada');
      return;
    }

    // Extraer la ruta y los parámetros
    const urlParts = req.url.split('?');
    const path = urlParts[0];
    const params = urlParts.length > 1 ? parseQueryParams(urlParts[1]) : {};

    // Buscar un handler para esta ruta
    const handler = directHandlers.find(h => 
      h.path === path && h.method === (req.method || 'GET')
    );

    if (!handler) {
      sendError(res, 404, `Handler no encontrado para ${req.method} ${path}`);
      return;
    }

    // Configurar cabeceras básicas
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Accept, Cache-Control');
    res.setHeader('Content-Type', handler.contentType);
    res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
    res.setHeader('Pragma', 'no-cache');
    res.setHeader('Expires', '0');
    res.setHeader('X-Content-Type-Options', 'nosniff');

    // Manejar la solicitud
    try {
      log(`Procesando API directa: ${req.method} ${path}`, 'direct-api');
      handler.handler(req, res, params).catch(err => {
        console.error(`Error en handler directo ${path}:`, err);
        sendError(res, 500, err.message || 'Error interno del servidor');
      });
    } catch (err: any) {
      console.error(`Error en handler directo ${path}:`, err);
      sendError(res, 500, err.message || 'Error interno del servidor');
    }
  });

  // Iniciar el servidor
  directServer.listen(port, '0.0.0.0', () => {
    log(`Servidor API directo iniciado en puerto ${port}`, 'direct-api');
  });

  return directServer;
}

/**
 * Detiene el servidor de APIs directas
 */
export function stopDirectApiServer() {
  if (directServer) {
    directServer.close();
    directServer = null;
    log('Servidor API directo detenido', 'direct-api');
  }
}

/**
 * Envía un error como respuesta HTTP
 */
function sendError(res: http.ServerResponse, status: number, message: string) {
  res.statusCode = status;
  res.setHeader('Content-Type', 'application/json');
  res.end(JSON.stringify({ error: message }));
}

/**
 * Parsea los parámetros de consulta de una URL
 */
function parseQueryParams(queryString: string): Record<string, string> {
  const params: Record<string, string> = {};
  const pairs = queryString.split('&');

  for (const pair of pairs) {
    const [key, value] = pair.split('=');
    if (key) {
      params[decodeURIComponent(key)] = decodeURIComponent(value || '');
    }
  }

  return params;
}
