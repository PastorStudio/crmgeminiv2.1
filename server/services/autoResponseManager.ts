/**
 * Gestor de respuestas automáticas para WhatsApp
 * Este archivo es el punto de entrada para manejar respuestas automáticas
 * a mensajes de WhatsApp usando Gemini o OpenAI según configuración
 */

import { AutoResponseService } from './autoResponseService';

// Exportamos una instancia del servicio para uso en toda la aplicación
export const autoResponseService = new AutoResponseService();