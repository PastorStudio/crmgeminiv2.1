/**
 * Sales Flow Engine - Automates conversation routing through sales process
 */
import { db } from '../db';
import { 
  salesFlowStages, 
  flowNodes, 
  flowConnections, 
  conversationFlowSessions, 
  flowExecutionLog,
  salesMetrics 
} from '../../shared/schema';
import { eq, and, desc } from 'drizzle-orm';

interface FlowExecutionResult {
  success: boolean;
  nextNodeId?: number;
  response?: string;
  stageChanged?: boolean;
  newStageId?: number;
  sessionData?: any;
}

export class SalesFlowEngine {
  
  /**
   * Initialize or get conversation flow session
   */
  async initializeConversationFlow(chatId: string, accountId: number, initialMessage: string) {
    try {
      // Check if session already exists
      let session = await db
        .select()
        .from(conversationFlowSessions)
        .where(and(
          eq(conversationFlowSessions.chatId, chatId),
          eq(conversationFlowSessions.accountId, accountId),
          eq(conversationFlowSessions.isActive, true)
        ))
        .limit(1);

      if (session.length === 0) {
        // Create new session starting at first node
        const firstStage = await db
          .select()
          .from(salesFlowStages)
          .where(eq(salesFlowStages.isActive, true))
          .orderBy(salesFlowStages.order)
          .limit(1);

        if (firstStage.length === 0) {
          throw new Error('No active sales flow stages found');
        }

        const firstNode = await db
          .select()
          .from(flowNodes)
          .where(and(
            eq(flowNodes.stageId, firstStage[0].id),
            eq(flowNodes.type, 'trigger'),
            eq(flowNodes.isActive, true)
          ))
          .limit(1);

        if (firstNode.length === 0) {
          throw new Error('No trigger node found for first stage');
        }

        const [newSession] = await db
          .insert(conversationFlowSessions)
          .values({
            chatId,
            accountId,
            currentNodeId: firstNode[0].id,
            currentStageId: firstStage[0].id,
            sessionData: {
              initialMessage,
              leadScore: 0,
              customFields: {}
            }
          })
          .returning();

        session = [newSession];
      }

      return session[0];
    } catch (error) {
      console.error('Error initializing conversation flow:', error);
      throw error;
    }
  }

  /**
   * Process incoming message through flow
   */
  async processMessage(chatId: string, accountId: number, messageText: string, fromUser: boolean = true): Promise<FlowExecutionResult> {
    const startTime = Date.now();
    
    try {
      // Get or create session
      const session = await this.initializeConversationFlow(chatId, accountId, messageText);
      
      if (!session.currentNodeId) {
        throw new Error('No current node in session');
      }

      // Get current node
      const currentNode = await db
        .select()
        .from(flowNodes)
        .where(eq(flowNodes.id, session.currentNodeId))
        .limit(1);

      if (currentNode.length === 0) {
        throw new Error('Current node not found');
      }

      const node = currentNode[0];
      
      // Execute node logic
      const result = await this.executeNode(node, messageText, session, fromUser);
      
      // Log execution
      await this.logExecution(session.id, node.id, session.currentStageId, 'completed', messageText, result.response, Date.now() - startTime, result.success);
      
      // Update session if needed
      if (result.nextNodeId || result.sessionData) {
        await db
          .update(conversationFlowSessions)
          .set({
            currentNodeId: result.nextNodeId || session.currentNodeId,
            currentStageId: result.newStageId || session.currentStageId,
            sessionData: result.sessionData || session.sessionData,
            lastActivityAt: new Date()
          })
          .where(eq(conversationFlowSessions.id, session.id));
      }

      return result;
    } catch (error) {
      console.error('Error processing message through flow:', error);
      return {
        success: false,
        response: 'Lo siento, hubo un error procesando tu mensaje. Por favor intenta de nuevo.'
      };
    }
  }

  /**
   * Execute specific node logic
   */
  private async executeNode(node: any, messageText: string, session: any, fromUser: boolean): Promise<FlowExecutionResult> {
    const config = node.config || {};
    
    switch (node.type) {
      case 'trigger':
        return this.executeTriggerNode(node, messageText, session, config);
      
      case 'condition':
        return this.executeConditionNode(node, messageText, session, config);
      
      case 'action':
        return this.executeActionNode(node, messageText, session, config);
      
      case 'response':
        return this.executeResponseNode(node, messageText, session, config);
      
      case 'automation':
        return this.executeAutomationNode(node, messageText, session, config);
      
      case 'handoff':
        return this.executeHandoffNode(node, messageText, session, config);
      
      default:
        return {
          success: false,
          response: 'Tipo de nodo no reconocido.'
        };
    }
  }

  /**
   * Execute trigger node (entry points)
   */
  private async executeTriggerNode(node: any, messageText: string, session: any, config: any): Promise<FlowExecutionResult> {
    const triggers = config.triggers || [];
    const messageLC = messageText.toLowerCase();
    
    // Check if message matches any trigger
    const triggered = triggers.some((trigger: string) => 
      messageLC.includes(trigger.toLowerCase())
    );

    if (triggered || triggers.length === 0) {
      // Move to next node
      const nextNode = await this.getNextNode(node.id);
      return {
        success: true,
        nextNodeId: nextNode?.id,
        response: config.responses?.[0] || '¡Hola! Gracias por contactarnos. ¿En qué puedo ayudarte hoy?'
      };
    }

    return { success: false };
  }

  /**
   * Execute condition node (decision points)
   */
  private async executeConditionNode(node: any, messageText: string, session: any, config: any): Promise<FlowExecutionResult> {
    const conditions = config.conditions || [];
    const messageLC = messageText.toLowerCase();
    
    // Evaluate conditions
    for (const condition of conditions) {
      const { type, value, nextNodeId } = condition;
      
      let conditionMet = false;
      
      switch (type) {
        case 'contains':
          conditionMet = messageLC.includes(value.toLowerCase());
          break;
        case 'equals':
          conditionMet = messageLC === value.toLowerCase();
          break;
        case 'starts_with':
          conditionMet = messageLC.startsWith(value.toLowerCase());
          break;
        case 'intent':
          conditionMet = await this.detectIntent(messageText, value);
          break;
      }
      
      if (conditionMet) {
        return {
          success: true,
          nextNodeId,
          response: condition.response
        };
      }
    }

    // Default path if no conditions met
    const defaultNode = await this.getNextNode(node.id, 'default');
    return {
      success: true,
      nextNodeId: defaultNode?.id,
      response: config.defaultResponse || 'No entendí tu respuesta. ¿Podrías ser más específico?'
    };
  }

  /**
   * Execute action node (data collection, updates)
   */
  private async executeActionNode(node: any, messageText: string, session: any, config: any): Promise<FlowExecutionResult> {
    const actions = config.actions || [];
    let updatedSessionData = { ...session.sessionData };
    
    for (const action of actions) {
      switch (action.type) {
        case 'collect_name':
          updatedSessionData.customerName = messageText;
          break;
        case 'collect_email':
          if (this.isValidEmail(messageText)) {
            updatedSessionData.customerEmail = messageText;
          }
          break;
        case 'collect_phone':
          updatedSessionData.customerPhone = messageText;
          break;
        case 'update_lead_score':
          updatedSessionData.leadScore = (updatedSessionData.leadScore || 0) + action.value;
          break;
        case 'set_interest':
          updatedSessionData.interests = updatedSessionData.interests || [];
          updatedSessionData.interests.push(action.value);
          break;
        case 'move_stage':
          const newStage = await db
            .select()
            .from(salesFlowStages)
            .where(eq(salesFlowStages.id, action.stageId))
            .limit(1);
          
          if (newStage.length > 0) {
            return {
              success: true,
              sessionData: updatedSessionData,
              stageChanged: true,
              newStageId: action.stageId,
              nextNodeId: action.nextNodeId,
              response: action.response || `Perfecto, avanzamos al siguiente paso: ${newStage[0].name}`
            };
          }
          break;
      }
    }

    const nextNode = await this.getNextNode(node.id);
    return {
      success: true,
      nextNodeId: nextNode?.id,
      sessionData: updatedSessionData,
      response: config.response || 'Información guardada correctamente.'
    };
  }

  /**
   * Execute response node (AI-generated responses)
   */
  private async executeResponseNode(node: any, messageText: string, session: any, config: any): Promise<FlowExecutionResult> {
    let response = '';
    
    if (config.aiPrompt) {
      // Generate AI response using the configured prompt
      response = await this.generateAIResponse(config.aiPrompt, messageText, session);
    } else if (config.responses && config.responses.length > 0) {
      // Use predefined responses
      response = config.responses[Math.floor(Math.random() * config.responses.length)];
    } else {
      response = 'Gracias por tu mensaje. Un agente se pondrá en contacto contigo pronto.';
    }

    // Replace variables in response
    response = this.replaceVariables(response, session);

    const nextNode = await this.getNextNode(node.id);
    return {
      success: true,
      nextNodeId: nextNode?.id,
      response
    };
  }

  /**
   * Get next node in flow
   */
  private async getNextNode(currentNodeId: number, condition: string = 'default') {
    const connections = await db
      .select({
        targetNodeId: flowConnections.targetNodeId,
        condition: flowConnections.condition
      })
      .from(flowConnections)
      .where(eq(flowConnections.sourceNodeId, currentNodeId));

    // Find connection matching condition
    let connection = connections.find(c => c.condition === condition);
    if (!connection && condition !== 'default') {
      connection = connections.find(c => c.condition === 'default' || !c.condition);
    }
    if (!connection && connections.length > 0) {
      connection = connections[0];
    }

    if (connection) {
      const nextNodes = await db
        .select()
        .from(flowNodes)
        .where(eq(flowNodes.id, connection.targetNodeId))
        .limit(1);
      
      return nextNodes[0] || null;
    }

    return null;
  }

  /**
   * Generate AI response using external agent
   */
  private async generateAIResponse(prompt: string, messageText: string, session: any): Promise<string> {
    try {
      // Use the existing AI service to generate response
      const { trulyIndependentAutoResponse } = await import('./trulyIndependentAutoResponse');
      
      const contextualPrompt = `
${prompt}

Contexto de la conversación:
- Cliente: ${session.sessionData?.customerName || 'Cliente'}
- Etapa actual: ${session.currentStageId}
- Puntuación de lead: ${session.sessionData?.leadScore || 0}
- Intereses: ${session.sessionData?.interests?.join(', ') || 'No definidos'}

Mensaje del cliente: ${messageText}

Responde de manera profesional y personalizada:`;

      // Generate response (this would integrate with your existing AI system)
      return `Gracias por tu interés, ${session.sessionData?.customerName || 'estimado cliente'}. Permíteme ayudarte con eso.`;
    } catch (error) {
      console.error('Error generating AI response:', error);
      return 'Gracias por tu mensaje. Te responderé en breve.';
    }
  }

  /**
   * Detect intent using AI
   */
  private async detectIntent(messageText: string, targetIntent: string): Promise<boolean> {
    // Simple keyword-based intent detection
    const intentKeywords: Record<string, string[]> = {
      'interested': ['interesado', 'interested', 'quiero', 'deseo', 'me gusta'],
      'price': ['precio', 'cost', 'cuanto', 'how much', 'valor'],
      'demo': ['demo', 'prueba', 'test', 'demostración'],
      'not_interested': ['no gracias', 'not interested', 'no me interesa']
    };

    const keywords = intentKeywords[targetIntent] || [];
    const messageLC = messageText.toLowerCase();
    
    return keywords.some(keyword => messageLC.includes(keyword));
  }

  /**
   * Replace variables in response text
   */
  private replaceVariables(text: string, session: any): string {
    const variables: Record<string, string> = {
      '{customerName}': session.sessionData?.customerName || 'estimado cliente',
      '{customerEmail}': session.sessionData?.customerEmail || '',
      '{customerPhone}': session.sessionData?.customerPhone || '',
      '{leadScore}': session.sessionData?.leadScore?.toString() || '0'
    };

    let result = text;
    Object.entries(variables).forEach(([key, value]) => {
      result = result.replace(new RegExp(key, 'g'), value);
    });

    return result;
  }

  /**
   * Validate email format
   */
  private isValidEmail(email: string): boolean {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
  }

  /**
   * Log flow execution
   */
  private async logExecution(sessionId: number, nodeId: number, stageId: number, action: string, messageText: string, aiResponse?: string, executionTime?: number, success: boolean = true) {
    try {
      await db.insert(flowExecutionLog).values({
        sessionId,
        nodeId,
        stageId,
        action,
        messageText: messageText.substring(0, 500), // Limit length
        aiResponse: aiResponse?.substring(0, 1000),
        executionTime,
        success
      });
    } catch (error) {
      console.error('Error logging flow execution:', error);
    }
  }

  /**
   * Execute automation node (system integrations)
   */
  private async executeAutomationNode(node: any, messageText: string, session: any, config: any): Promise<FlowExecutionResult> {
    const automationType = config.automationType;
    
    try {
      switch (automationType) {
        case 'enable_auto_response':
          await this.enableAutoResponse(session.accountId);
          break;
        
        case 'disable_auto_response':
          await this.disableAutoResponse(session.accountId);
          break;
        
        case 'change_agent':
          await this.changeAIAgent(session.accountId, config.newAgentId);
          break;
        
        case 'create_ticket':
          await this.createTicket(session.chatId, session.accountId, messageText);
          break;
        
        case 'update_lead_score':
          session.sessionData.leadScore = (session.sessionData.leadScore || 0) + (config.scoreValue || 10);
          break;
      }

      const nextNode = await this.getNextNode(node.id);
      return {
        success: true,
        nextNodeId: nextNode?.id,
        sessionData: session.sessionData,
        response: `Automatización "${automationType}" ejecutada correctamente.`
      };
    } catch (error) {
      console.error('Error executing automation node:', error);
      return {
        success: false,
        response: 'Error ejecutando automatización.'
      };
    }
  }

  /**
   * Execute handoff node (transfer to human agents)
   */
  private async executeHandoffNode(node: any, messageText: string, session: any, config: any): Promise<FlowExecutionResult> {
    const handoffType = config.handoffType;
    const handoffMessage = config.handoffMessage || 'Te estoy conectando con un agente especializado.';
    
    try {
      let assignedAgentId;
      
      switch (handoffType) {
        case 'assign_to_agent':
          assignedAgentId = await this.assignToSpecificAgent(session.chatId, session.accountId, config.assignedAgentId);
          break;
        
        case 'assign_by_department':
          assignedAgentId = await this.assignByDepartment(session.chatId, session.accountId, config.department);
          break;
        
        case 'assign_next_available':
          assignedAgentId = await this.assignToNextAvailable(session.chatId, session.accountId);
          break;
        
        case 'create_ticket_assign':
          const ticketId = await this.createTicketAndAssign(session.chatId, session.accountId, messageText);
          assignedAgentId = ticketId;
          break;
      }

      // Disable auto responses when transferring to human agent
      await this.disableAutoResponse(session.accountId);
      
      // Mark session as completed (transferred to human)
      await db
        .update(conversationFlowSessions)
        .set({
          isActive: false,
          completedAt: new Date()
        })
        .where(eq(conversationFlowSessions.id, session.id));

      return {
        success: true,
        response: handoffMessage,
        sessionData: {
          ...session.sessionData,
          assignedAgent: assignedAgentId,
          transferredAt: new Date()
        }
      };
    } catch (error) {
      console.error('Error executing handoff node:', error);
      return {
        success: false,
        response: 'Error realizando transferencia. Un agente se pondrá en contacto contigo pronto.'
      };
    }
  }

  /**
   * Enable automatic responses for account
   */
  private async enableAutoResponse(accountId: number) {
    await db
      .update(whatsappAccounts)
      .set({ autoResponseEnabled: true })
      .where(eq(whatsappAccounts.id, accountId));
  }

  /**
   * Disable automatic responses for account
   */
  private async disableAutoResponse(accountId: number) {
    await db
      .update(whatsappAccounts)
      .set({ autoResponseEnabled: false })
      .where(eq(whatsappAccounts.id, accountId));
  }

  /**
   * Change AI agent for account
   */
  private async changeAIAgent(accountId: number, newAgentId: string) {
    await db
      .update(whatsappAccounts)
      .set({ assignedExternalAgentId: newAgentId })
      .where(eq(whatsappAccounts.id, accountId));
  }

  /**
   * Create ticket from conversation
   */
  private async createTicket(chatId: string, accountId: number, messageText: string) {
    // This would integrate with your existing ticket system
    // Implementation depends on your ticket schema
    return `ticket_${Date.now()}`;
  }

  /**
   * Assign chat to specific agent
   */
  private async assignToSpecificAgent(chatId: string, accountId: number, agentUsername: string) {
    const agent = await db
      .select()
      .from(users)
      .where(eq(users.username, agentUsername))
      .limit(1);

    if (agent.length > 0) {
      await db
        .insert(chatAssignments)
        .values({
          chatId,
          accountId,
          assignedToId: agent[0].id,
          status: 'active',
          category: 'sales'
        })
        .onConflictDoUpdate({
          target: chatAssignments.chatId,
          set: {
            assignedToId: agent[0].id,
            assignedAt: new Date()
          }
        });
      
      return agent[0].id;
    }
    return null;
  }

  /**
   * Assign chat by department
   */
  private async assignByDepartment(chatId: string, accountId: number, department: string) {
    const agents = await db
      .select()
      .from(users)
      .where(and(
        eq(users.department, department),
        eq(users.status, 'active'),
        eq(users.role, 'agent')
      ));

    if (agents.length > 0) {
      // Assign to first available agent in department
      const selectedAgent = agents[0];
      
      await db
        .insert(chatAssignments)
        .values({
          chatId,
          accountId,
          assignedToId: selectedAgent.id,
          status: 'active',
          category: department
        })
        .onConflictDoUpdate({
          target: chatAssignments.chatId,
          set: {
            assignedToId: selectedAgent.id,
            assignedAt: new Date()
          }
        });
      
      return selectedAgent.id;
    }
    return null;
  }

  /**
   * Assign to next available agent
   */
  private async assignToNextAvailable(chatId: string, accountId: number) {
    const availableAgents = await db
      .select()
      .from(users)
      .where(and(
        eq(users.status, 'active'),
        eq(users.role, 'agent')
      ));

    if (availableAgents.length > 0) {
      // Simple round-robin assignment
      const selectedAgent = availableAgents[Math.floor(Math.random() * availableAgents.length)];
      
      await db
        .insert(chatAssignments)
        .values({
          chatId,
          accountId,
          assignedToId: selectedAgent.id,
          status: 'active',
          category: 'general'
        })
        .onConflictDoUpdate({
          target: chatAssignments.chatId,
          set: {
            assignedToId: selectedAgent.id,
            assignedAt: new Date()
          }
        });
      
      return selectedAgent.id;
    }
    return null;
  }

  /**
   * Create ticket and assign
   */
  private async createTicketAndAssign(chatId: string, accountId: number, messageText: string) {
    // Create ticket first
    const ticketId = await this.createTicket(chatId, accountId, messageText);
    
    // Then assign to next available agent
    await this.assignToNextAvailable(chatId, accountId);
    
    return ticketId;
  }

  /**
   * Get conversation flow analytics
   */
  async getFlowAnalytics(accountId: number, days: number = 30) {
    try {
      const since = new Date();
      since.setDate(since.getDate() - days);

      // Get stage performance
      const stagePerformance = await db
        .select({
          stageId: salesFlowStages.id,
          stageName: salesFlowStages.name,
          totalSessions: 'COUNT(DISTINCT conversationFlowSessions.id)',
          avgTime: 'AVG(EXTRACT(EPOCH FROM (conversationFlowSessions.last_activity_at - conversationFlowSessions.started_at)))'
        })
        .from(salesFlowStages)
        .leftJoin(conversationFlowSessions, eq(salesFlowStages.id, conversationFlowSessions.currentStageId))
        .where(eq(conversationFlowSessions.accountId, accountId))
        .groupBy(salesFlowStages.id, salesFlowStages.name);

      return {
        stagePerformance,
        totalConversations: stagePerformance.reduce((sum, stage) => sum + parseInt(stage.totalSessions as string), 0)
      };
    } catch (error) {
      console.error('Error getting flow analytics:', error);
      return { stagePerformance: [], totalConversations: 0 };
    }
  }
}

export const salesFlowEngine = new SalesFlowEngine();