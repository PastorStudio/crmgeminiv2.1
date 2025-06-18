/**
 * Flow Execution Routes - API endpoints for sales flow execution
 */
import { Router } from 'express';
import { db } from '../db';
import { 
  salesFlowStages, 
  flowNodes, 
  flowConnections, 
  conversationFlowSessions, 
  flowExecutionLog,
  whatsappAccounts,
  contacts,
  leads
} from '../../shared/schema';
import { eq, and, desc } from 'drizzle-orm';
import { whatsappFlowIntegration } from '../services/whatsappFlowIntegration';

const router = Router();

/**
 * Create a complete functional sales flow
 */
router.post('/create-sample-flow', async (req, res) => {
  try {
    console.log('🏗️ Creando flujo de ventas funcional completo...');

    // Create sales stages
    const stages = await db
      .insert(salesFlowStages)
      .values([
        { name: 'Primer Contacto', description: 'Cliente inicia conversación', order: 1, color: '#10B981', icon: 'message-circle' },
        { name: 'Calificación', description: 'Recopilación de información', order: 2, color: '#3B82F6', icon: 'user-check' },
        { name: 'Propuesta', description: 'Presentación de productos', order: 3, color: '#F59E0B', icon: 'file-text' },
        { name: 'Negociación', description: 'Discusión de términos', order: 4, color: '#8B5CF6', icon: 'handshake' },
        { name: 'Cierre', description: 'Finalización de venta', order: 5, color: '#EF4444', icon: 'check-circle' }
      ])
      .returning();

    // Create flow nodes
    const nodes = await db
      .insert(flowNodes)
      .values([
        {
          stageId: stages[0].id,
          name: 'Inicio Conversación',
          type: 'trigger',
          position: { x: 100, y: 50 },
          config: {
            triggers: ['hola', 'información', 'precio', 'producto', 'servicio', 'ayuda'],
            responses: ['¡Hola! Bienvenido a nuestra empresa. Soy tu asistente virtual y estoy aquí para ayudarte. ¿En qué puedo asistirte hoy?']
          }
        },
        {
          stageId: stages[0].id,
          name: 'Saludo Inicial',
          type: 'response',
          position: { x: 100, y: 180 },
          config: {
            responses: ['¡Hola! Bienvenido a nuestra empresa. Soy tu asistente virtual. ¿En qué puedo ayudarte hoy?']
          }
        },
        {
          stageId: stages[0].id,
          name: 'Activar Sistema IA',
          type: 'automation',
          position: { x: 100, y: 310 },
          config: {
            automationType: 'enable_auto_response'
          }
        },
        {
          stageId: stages[1].id,
          name: 'Solicitar Nombre',
          type: 'action',
          position: { x: 100, y: 440 },
          config: {
            actionType: 'collect_data',
            dataField: 'customerName',
            prompt: 'Para brindarte un mejor servicio, ¿podrías decirme tu nombre?'
          }
        },
        {
          stageId: stages[1].id,
          name: 'Validar Nombre',
          type: 'validation',
          position: { x: 100, y: 570 },
          config: {
            validationType: 'text_length',
            minLength: 2,
            maxLength: 50,
            errorMessage: 'Por favor proporciona un nombre válido (mínimo 2 caracteres)'
          }
        },
        {
          stageId: stages[1].id,
          name: '¿Tipo de Consulta?',
          type: 'condition',
          position: { x: 400, y: 440 },
          config: {
            conditionType: 'keyword_detection',
            keywords: ['precio', 'cotización', 'comprar', 'producto', 'plan', 'servicio']
          }
        },
        {
          stageId: stages[2].id,
          name: 'Info Productos',
          type: 'response',
          position: { x: 600, y: 310 },
          config: {
            responses: ['Excelente {{customerName}}! Tenemos productos increíbles. ¿Te interesa conocer nuestros planes Premium, Estándar o Básico?']
          }
        },
        {
          stageId: stages[2].id,
          name: 'Solicitar Email',
          type: 'action',
          position: { x: 600, y: 440 },
          config: {
            actionType: 'collect_data',
            dataField: 'customerEmail',
            prompt: '¿Podrías compartir tu email para enviarte información detallada y cotizaciones?'
          }
        },
        {
          stageId: stages[2].id,
          name: 'Validar Email',
          type: 'validation',
          position: { x: 600, y: 570 },
          config: {
            validationType: 'email',
            errorMessage: 'Por favor proporciona un email válido (ejemplo: nombre@empresa.com)'
          }
        },
        {
          stageId: stages[2].id,
          name: 'Registrar en CRM',
          type: 'webhook',
          position: { x: 900, y: 440 },
          config: {
            webhookUrl: 'https://api.hubspot.com/crm/v3/objects/contacts',
            httpMethod: 'POST',
            headers: '{"Content-Type": "application/json", "Authorization": "Bearer YOUR_TOKEN"}',
            requestBody: '{"properties": {"firstname": "{{customerName}}", "email": "{{customerEmail}}", "lead_source": "whatsapp", "lifecycle_stage": "lead"}}'
          }
        },
        {
          stageId: stages[3].id,
          name: '¿Alto Interés?',
          type: 'condition',
          position: { x: 900, y: 570 },
          config: {
            conditionType: 'keyword_detection',
            keywords: ['urgente', 'hoy', 'ahora', 'inmediato', 'rápido', 'ya']
          }
        },
        {
          stageId: stages[4].id,
          name: 'Transferir a Ventas',
          type: 'handoff',
          position: { x: 1200, y: 440 },
          config: {
            handoffType: 'assign_by_department',
            department: 'ventas',
            handoffMessage: 'Perfecto {{customerName}}! Veo que tienes un interés alto en nuestros productos. Te conectaré inmediatamente con uno de nuestros especialistas en ventas que podrá ayudarte mejor y ofrecerte las mejores condiciones.'
          }
        },
        {
          stageId: stages[3].id,
          name: 'Programar Seguimiento',
          type: 'schedule',
          position: { x: 1200, y: 570 },
          config: {
            scheduleType: 'follow_up',
            daysAhead: 1,
            timeOfDay: '10:00',
            scheduledMessage: 'Hola {{customerName}}, siguiendo nuestra conversación de ayer sobre nuestros productos, ¿tienes alguna pregunta adicional? ¿Te gustaría que programemos una demo personalizada?'
          }
        },
        {
          stageId: stages[1].id,
          name: 'Pausa Estratégica',
          type: 'delay',
          position: { x: 400, y: 700 },
          config: {
            delayMinutes: 3,
            waitMessage: 'Te daré un momento para que revises la información. Mientras tanto, estoy preparando algunas opciones personalizadas para ti...'
          }
        },
        {
          stageId: stages[2].id,
          name: 'Enviar Promoción',
          type: 'broadcast',
          position: { x: 600, y: 700 },
          config: {
            broadcastMessage: '🎉 ¡Oferta especial solo por hoy! 25% de descuento en todos nuestros planes hasta fin de mes. ¡Aprovecha esta oportunidad única!',
            targetAudience: 'active_leads'
          }
        }
      ])
      .returning();

    // Create connections between nodes
    const connections = await db
      .insert(flowConnections)
      .values([
        { sourceNodeId: nodes[0].id, targetNodeId: nodes[1].id, condition: 'default', label: 'Iniciar' },
        { sourceNodeId: nodes[1].id, targetNodeId: nodes[2].id, condition: 'default', label: 'Activar' },
        { sourceNodeId: nodes[2].id, targetNodeId: nodes[3].id, condition: 'default', label: 'Continuar' },
        { sourceNodeId: nodes[3].id, targetNodeId: nodes[4].id, condition: 'default', label: 'Validar' },
        { sourceNodeId: nodes[4].id, targetNodeId: nodes[5].id, condition: 'valid', label: 'Válido' },
        { sourceNodeId: nodes[4].id, targetNodeId: nodes[3].id, condition: 'invalid', label: 'Error' },
        { sourceNodeId: nodes[5].id, targetNodeId: nodes[6].id, condition: 'interested', label: 'Producto' },
        { sourceNodeId: nodes[5].id, targetNodeId: nodes[13].id, condition: 'other', label: 'Otro' },
        { sourceNodeId: nodes[6].id, targetNodeId: nodes[7].id, condition: 'default', label: 'Continuar' },
        { sourceNodeId: nodes[7].id, targetNodeId: nodes[8].id, condition: 'default', label: 'Validar' },
        { sourceNodeId: nodes[8].id, targetNodeId: nodes[9].id, condition: 'valid', label: 'Válido' },
        { sourceNodeId: nodes[8].id, targetNodeId: nodes[7].id, condition: 'invalid', label: 'Error' },
        { sourceNodeId: nodes[9].id, targetNodeId: nodes[10].id, condition: 'default', label: 'Evaluar' },
        { sourceNodeId: nodes[10].id, targetNodeId: nodes[11].id, condition: 'high_interest', label: 'Alto' },
        { sourceNodeId: nodes[10].id, targetNodeId: nodes[12].id, condition: 'medium_interest', label: 'Medio' },
        { sourceNodeId: nodes[13].id, targetNodeId: nodes[14].id, condition: 'default', label: 'Promoción' }
      ])
      .returning();

    console.log(`✅ Flujo creado: ${stages.length} etapas, ${nodes.length} nodos, ${connections.length} conexiones`);

    res.json({
      success: true,
      message: 'Flujo de ventas funcional creado exitosamente',
      data: {
        stages: stages.length,
        nodes: nodes.length,
        connections: connections.length,
        flowId: stages[0].id
      }
    });

  } catch (error) {
    console.error('Error creating sample flow:', error);
    res.status(500).json({
      success: false,
      error: 'Error creando flujo de ventas'
    });
  }
});

/**
 * Execute flow with WhatsApp message
 */
router.post('/execute', async (req, res) => {
  try {
    const { chatId, message, accountId, senderPhone } = req.body;

    if (!chatId || !message || !accountId) {
      return res.status(400).json({
        success: false,
        error: 'chatId, message y accountId son requeridos'
      });
    }

    console.log(`🚀 Ejecutando flujo para: ${chatId} - Mensaje: ${message.substring(0, 50)}...`);

    // Process message through flow
    const result = await whatsappFlowIntegration.processWhatsAppMessage(
      chatId,
      message,
      accountId,
      senderPhone || chatId
    );

    res.json({
      success: result.success,
      data: {
        response: result.response,
        nextNodeId: result.nextNodeId,
        stageChanged: result.stageChanged,
        sessionData: result.sessionData
      }
    });

  } catch (error) {
    console.error('Error executing flow:', error);
    res.status(500).json({
      success: false,
      error: 'Error ejecutando flujo'
    });
  }
});

/**
 * Get flow execution analytics
 */
router.get('/analytics/:accountId', async (req, res) => {
  try {
    const { accountId } = req.params;
    const days = parseInt(req.query.days as string) || 30;

    // Get flow sessions
    const sessions = await db
      .select()
      .from(conversationFlowSessions)
      .where(eq(conversationFlowSessions.accountId, parseInt(accountId)))
      .orderBy(desc(conversationFlowSessions.startedAt));

    // Get execution logs
    const executions = await db
      .select()
      .from(flowExecutionLog)
      .orderBy(desc(flowExecutionLog.executedAt))
      .limit(100);

    const analytics = {
      totalSessions: sessions.length,
      activeSessions: sessions.filter(s => s.isActive).length,
      completedSessions: sessions.filter(s => s.completedAt).length,
      averageCompletionTime: 0, // Calculate based on data
      conversionRate: 0, // Calculate based on data
      topTriggers: ['hola', 'información', 'precio'], // Extract from data
      executionHistory: executions
    };

    res.json({
      success: true,
      analytics
    });

  } catch (error) {
    console.error('Error getting analytics:', error);
    res.status(500).json({
      success: false,
      error: 'Error obteniendo analíticas'
    });
  }
});

/**
 * Test flow execution (for testing without WhatsApp)
 */
router.post('/test', async (req, res) => {
  try {
    const { message, accountId } = req.body;
    const testChatId = `test_${Date.now()}`;

    console.log(`🧪 Probando flujo: ${message}`);

    const result = await whatsappFlowIntegration.processWhatsAppMessage(
      testChatId,
      message,
      accountId || 1,
      testChatId
    );

    res.json({
      success: true,
      test: true,
      data: {
        chatId: testChatId,
        input: message,
        response: result.response,
        success: result.success,
        nextNodeId: result.nextNodeId
      }
    });

  } catch (error) {
    console.error('Error testing flow:', error);
    res.status(500).json({
      success: false,
      error: 'Error probando flujo'
    });
  }
});

export default router;