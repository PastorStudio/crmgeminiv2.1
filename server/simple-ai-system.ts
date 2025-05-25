/**
 * Sistema simplificado AI ON/OFF
 * Conexión directa entre selector de agente y respuestas automáticas
 */
import { db } from './db';
import { whatsappAccounts } from '../shared/schema';
import { eq } from 'drizzle-orm';

/**
 * Activar agente para una cuenta específica
 */
export async function activateAgent(accountId: number, agentId: string): Promise<boolean> {
  try {
    console.log(`🎯 Activando agente ${agentId} para cuenta ${accountId}`);
    
    await db
      .update(whatsappAccounts)
      .set({ 
        assignedExternalAgentId: agentId,
        autoResponseEnabled: true
      })
      .where(eq(whatsappAccounts.id, accountId));
    
    console.log(`✅ Agente ${agentId} activado para cuenta ${accountId}`);
    return true;
  } catch (error) {
    console.error('❌ Error activando agente:', error);
    return false;
  }
}

/**
 * Desactivar AI para una cuenta específica
 */
export async function deactivateAI(accountId: number): Promise<boolean> {
  try {
    console.log(`🔄 Desactivando AI para cuenta ${accountId}`);
    
    await db
      .update(whatsappAccounts)
      .set({ autoResponseEnabled: false })
      .where(eq(whatsappAccounts.id, accountId));
    
    console.log(`✅ AI desactivado para cuenta ${accountId}`);
    return true;
  } catch (error) {
    console.error('❌ Error desactivando AI:', error);
    return false;
  }
}

/**
 * Obtener configuración actual de una cuenta
 */
export async function getAccountConfig(accountId: number) {
  try {
    const [account] = await db
      .select({
        enabled: whatsappAccounts.autoResponseEnabled,
        agentId: whatsappAccounts.assignedExternalAgentId
      })
      .from(whatsappAccounts)
      .where(eq(whatsappAccounts.id, accountId));
    
    return account || { enabled: false, agentId: null };
  } catch (error) {
    console.error('❌ Error obteniendo configuración:', error);
    return { enabled: false, agentId: null };
  }
}

/**
 * Procesar mensaje y generar respuesta automática si está activado
 */
export async function processMessage(accountId: number, message: string, chatId: string): Promise<string | null> {
  try {
    const config = await getAccountConfig(accountId);
    
    if (!config.enabled || !config.agentId) {
      console.log(`🔄 AI no está activado para cuenta ${accountId}`);
      return null;
    }
    
    console.log(`🤖 Generando respuesta con agente ${config.agentId}`);
    
    // Llamar directamente a la API de agentes externos
    const response = await fetch('http://localhost:5000/api/external-agents/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        agentId: config.agentId,
        message: message,
        context: `Conversación de WhatsApp cuenta ${accountId}`
      })
    });
    
    if (!response.ok) {
      console.error('❌ Error en API de agentes:', response.statusText);
      return null;
    }
    
    const data = await response.json();
    
    if (data.success && data.response) {
      console.log(`✅ Respuesta generada: ${data.response.substring(0, 100)}...`);
      return data.response;
    }
    
    return null;
  } catch (error) {
    console.error('❌ Error procesando mensaje:', error);
    return null;
  }
}