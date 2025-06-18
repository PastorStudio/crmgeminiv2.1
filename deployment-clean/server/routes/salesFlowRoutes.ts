import { Router } from 'express';
import { db } from '../db';
import { 
  salesFlowStages, 
  flowNodes, 
  flowConnections, 
  conversationFlowSessions, 
  flowExecutionLog,
  salesMetrics 
} from '../../shared/schema';
import { eq, and, desc, count, avg, sql } from 'drizzle-orm';
import { salesFlowEngine } from '../services/salesFlowEngine';

const router = Router();

// Get all sales flow stages
router.get('/stages', async (req, res) => {
  try {
    const stages = await db
      .select()
      .from(salesFlowStages)
      .where(eq(salesFlowStages.isActive, true))
      .orderBy(salesFlowStages.order);
    
    res.json({ success: true, stages });
  } catch (error) {
    console.error('Error fetching sales flow stages:', error);
    res.status(500).json({ success: false, error: 'Failed to fetch stages' });
  }
});

// Get all flow nodes
router.get('/nodes', async (req, res) => {
  try {
    const nodes = await db
      .select()
      .from(flowNodes)
      .where(eq(flowNodes.isActive, true));
    
    res.json({ success: true, nodes });
  } catch (error) {
    console.error('Error fetching flow nodes:', error);
    res.status(500).json({ success: false, error: 'Failed to fetch nodes' });
  }
});

// Get all flow connections
router.get('/connections', async (req, res) => {
  try {
    const connections = await db
      .select()
      .from(flowConnections);
    
    res.json({ success: true, connections });
  } catch (error) {
    console.error('Error fetching flow connections:', error);
    res.status(500).json({ success: false, error: 'Failed to fetch connections' });
  }
});

// Get complete flow data (nodes + connections)
router.get('/', async (req, res) => {
  try {
    const [nodes, connections, stages] = await Promise.all([
      db.select().from(flowNodes).where(eq(flowNodes.isActive, true)),
      db.select().from(flowConnections),
      db.select().from(salesFlowStages).where(eq(salesFlowStages.isActive, true)).orderBy(salesFlowStages.order)
    ]);
    
    res.json({ 
      success: true, 
      flow: { nodes, connections, stages }
    });
  } catch (error) {
    console.error('Error fetching complete flow:', error);
    res.status(500).json({ success: false, error: 'Failed to fetch flow data' });
  }
});

// Save complete flow (nodes + connections)
router.post('/', async (req, res) => {
  try {
    const { nodes, edges } = req.body;
    
    if (!nodes || !edges) {
      return res.status(400).json({ success: false, error: 'Invalid flow data' });
    }

    // Clear existing data (in a transaction)
    await db.delete(flowConnections);
    await db.delete(flowNodes);

    // Insert new nodes
    for (const node of nodes) {
      await db.insert(flowNodes).values({
        name: node.data.label,
        type: node.type,
        position: node.position,
        config: node.data.config || {},
        stageId: node.data.stageId || 1
      });
    }

    // Get inserted nodes to map IDs
    const insertedNodes = await db.select().from(flowNodes);
    const nodeIdMap = new Map();
    
    nodes.forEach((node, index) => {
      nodeIdMap.set(node.id, insertedNodes[index]?.id);
    });

    // Insert new connections
    for (const edge of edges) {
      const sourceNodeId = nodeIdMap.get(edge.source);
      const targetNodeId = nodeIdMap.get(edge.target);
      
      if (sourceNodeId && targetNodeId) {
        await db.insert(flowConnections).values({
          sourceNodeId,
          targetNodeId,
          condition: edge.label || 'default',
          label: edge.label,
          style: edge.style || {}
        });
      }
    }

    res.json({ success: true, message: 'Flow saved successfully' });
  } catch (error) {
    console.error('Error saving flow:', error);
    res.status(500).json({ success: false, error: 'Failed to save flow' });
  }
});

// Create initial demo flow
router.post('/init-demo', async (req, res) => {
  try {
    // Create default stages if they don't exist
    const existingStages = await db.select().from(salesFlowStages);
    
    if (existingStages.length === 0) {
      const defaultStages = [
        { name: 'Prospección', description: 'Primer contacto con leads', order: 1, color: '#10B981', icon: 'user-plus' },
        { name: 'Calificación', description: 'Evaluar interés y capacidad', order: 2, color: '#3B82F6', icon: 'search' },
        { name: 'Propuesta', description: 'Presentar solución', order: 3, color: '#F59E0B', icon: 'file-text' },
        { name: 'Negociación', description: 'Ajustar términos', order: 4, color: '#EF4444', icon: 'handshake' },
        { name: 'Cierre', description: 'Finalizar venta', order: 5, color: '#8B5CF6', icon: 'check-circle' }
      ];

      for (const stage of defaultStages) {
        await db.insert(salesFlowStages).values(stage);
      }
    }

    // Create demo flow nodes
    const demoNodes = [
      {
        name: 'Primer Contacto',
        type: 'trigger',
        position: { x: 250, y: 25 },
        config: {
          triggers: ['hola', 'info', 'precio', 'producto'],
          responses: ['¡Hola! Gracias por contactarnos. ¿En qué puedo ayudarte hoy?']
        },
        stageId: 1
      },
      {
        name: '¿Interés en producto?',
        type: 'condition',
        position: { x: 250, y: 125 },
        config: {
          conditions: [
            { type: 'intent', value: 'interested', nextNodeId: 3, response: 'Perfecto, te ayudo con eso.' },
            { type: 'intent', value: 'price', nextNodeId: 4, response: 'Te explico sobre precios.' }
          ]
        },
        stageId: 2
      },
      {
        name: 'Calificar Lead',
        type: 'action',
        position: { x: 100, y: 225 },
        config: {
          actions: [
            { type: 'collect_name', response: '¿Cuál es tu nombre?' },
            { type: 'update_lead_score', value: 10 }
          ]
        },
        stageId: 2
      },
      {
        name: 'Enviar Información',
        type: 'response',
        position: { x: 400, y: 225 },
        config: {
          responses: ['Hola {customerName}, aquí tienes la información que solicitaste...'],
          aiPrompt: 'Genera una respuesta personalizada con información de productos y precios'
        },
        stageId: 3
      }
    ];

    // Clear existing demo data
    await db.delete(flowConnections);
    await db.delete(flowNodes);

    // Insert demo nodes
    const insertedNodes = [];
    for (const node of demoNodes) {
      const [inserted] = await db.insert(flowNodes).values(node).returning();
      insertedNodes.push(inserted);
    }

    // Create demo connections
    const demoConnections = [
      { sourceNodeId: insertedNodes[0].id, targetNodeId: insertedNodes[1].id, label: 'default' },
      { sourceNodeId: insertedNodes[1].id, targetNodeId: insertedNodes[2].id, label: 'Interesado' },
      { sourceNodeId: insertedNodes[1].id, targetNodeId: insertedNodes[3].id, label: 'Precio' }
    ];

    for (const connection of demoConnections) {
      await db.insert(flowConnections).values(connection);
    }

    res.json({ success: true, message: 'Demo flow created successfully' });
  } catch (error) {
    console.error('Error creating demo flow:', error);
    res.status(500).json({ success: false, error: 'Failed to create demo flow' });
  }
});

// Get flow analytics
router.get('/analytics', async (req, res) => {
  try {
    const accountId = parseInt(req.query.accountId as string) || 1;
    const days = parseInt(req.query.days as string) || 30;
    
    // Get basic metrics
    const [activeConversations] = await db
      .select({ count: count() })
      .from(conversationFlowSessions)
      .where(and(
        eq(conversationFlowSessions.accountId, accountId),
        eq(conversationFlowSessions.isActive, true)
      ));

    // Get stage performance
    const stagePerformance = await db
      .select({
        stageId: salesFlowStages.id,
        stageName: salesFlowStages.name,
        stageColor: salesFlowStages.color,
        totalSessions: count(conversationFlowSessions.id),
        avgTime: avg(sql`EXTRACT(EPOCH FROM (${conversationFlowSessions.lastActivityAt} - ${conversationFlowSessions.startedAt}))`)
      })
      .from(salesFlowStages)
      .leftJoin(conversationFlowSessions, eq(salesFlowStages.id, conversationFlowSessions.currentStageId))
      .where(eq(conversationFlowSessions.accountId, accountId))
      .groupBy(salesFlowStages.id, salesFlowStages.name, salesFlowStages.color);

    // Calculate conversion rate (simplified)
    const totalStarted = stagePerformance.reduce((sum, stage) => sum + Number(stage.totalSessions), 0);
    const completed = stagePerformance.find(s => s.stageName === 'Cierre')?.totalSessions || 0;
    const conversionRate = totalStarted > 0 ? Math.round((Number(completed) / totalStarted) * 100) : 0;

    const analytics = {
      activeConversations: activeConversations.count || 0,
      totalConversations: totalStarted,
      conversionRate,
      avgTime: Math.round(Number(stagePerformance[0]?.avgTime || 0) / 60), // Convert to minutes
      stagePerformance: stagePerformance.map(stage => ({
        ...stage,
        totalSessions: Number(stage.totalSessions),
        avgTime: Math.round(Number(stage.avgTime || 0) / 60)
      }))
    };

    res.json({ success: true, analytics });
  } catch (error) {
    console.error('Error fetching flow analytics:', error);
    res.status(500).json({ success: false, error: 'Failed to fetch analytics' });
  }
});

// Process message through flow
router.post('/process-message', async (req, res) => {
  try {
    const { chatId, accountId, messageText, fromUser = true } = req.body;
    
    if (!chatId || !accountId || !messageText) {
      return res.status(400).json({ 
        success: false, 
        error: 'Missing required fields: chatId, accountId, messageText' 
      });
    }

    const result = await salesFlowEngine.processMessage(chatId, accountId, messageText, fromUser);
    
    res.json({ success: true, result });
  } catch (error) {
    console.error('Error processing message through flow:', error);
    res.status(500).json({ success: false, error: 'Failed to process message' });
  }
});

// Get conversation flow session
router.get('/session/:chatId', async (req, res) => {
  try {
    const { chatId } = req.params;
    const accountId = parseInt(req.query.accountId as string) || 1;
    
    const session = await db
      .select()
      .from(conversationFlowSessions)
      .where(and(
        eq(conversationFlowSessions.chatId, chatId),
        eq(conversationFlowSessions.accountId, accountId),
        eq(conversationFlowSessions.isActive, true)
      ))
      .limit(1);

    if (session.length === 0) {
      return res.status(404).json({ success: false, error: 'Session not found' });
    }

    res.json({ success: true, session: session[0] });
  } catch (error) {
    console.error('Error fetching conversation session:', error);
    res.status(500).json({ success: false, error: 'Failed to fetch session' });
  }
});

export default router;