/**
 * WhatsApp Flow Integration - Connects visual sales flows to real WhatsApp messaging
 */
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
import { salesFlowEngine } from './salesFlowEngine';

export class WhatsAppFlowIntegration {
  /**
   * Process incoming WhatsApp message through sales flow
   */
  async processWhatsAppMessage(
    chatId: string, 
    messageText: string, 
    accountId: number,
    senderPhone: string
  ) {
    try {
      console.log(`📱 Procesando mensaje WhatsApp en flujo de ventas: ${chatId}`);
      
      // Check if there's an active flow session for this chat
      let session = await db
        .select()
        .from(conversationFlowSessions)
        .where(and(
          eq(conversationFlowSessions.chatId, chatId),
          eq(conversationFlowSessions.isActive, true)
        ))
        .limit(1);

      let flowResult;
      
      if (session.length === 0) {
        // No active session, initialize new flow
        console.log(`🚀 Iniciando nuevo flujo para chat: ${chatId}`);
        flowResult = await salesFlowEngine.initializeConversationFlow(
          chatId, 
          accountId, 
          messageText
        );
        
        // Create or update contact
        await this.upsertContact(senderPhone, chatId, accountId);
        
      } else {
        // Continue existing flow
        console.log(`⚡ Continuando flujo existente para chat: ${chatId}`);
        flowResult = await salesFlowEngine.processMessage(
          chatId, 
          accountId, 
          messageText, 
          true
        );
      }

      // Send response back to WhatsApp if flow generated one
      if (flowResult.success && flowResult.response) {
        await this.sendWhatsAppMessage(accountId, chatId, flowResult.response);
      }

      // Handle stage changes
      if (flowResult.stageChanged && flowResult.newStageId) {
        await this.handleStageChange(chatId, accountId, flowResult.newStageId, flowResult.sessionData);
      }

      // Execute automation actions
      if (flowResult.sessionData?.automationAction) {
        await this.executeAutomationAction(
          accountId, 
          chatId, 
          flowResult.sessionData.automationAction,
          flowResult.sessionData
        );
      }

      return flowResult;
      
    } catch (error) {
      console.error('Error processing WhatsApp message through flow:', error);
      return {
        success: false,
        response: 'Disculpa, hubo un error procesando tu mensaje. Un agente se pondrá en contacto contigo pronto.'
      };
    }
  }

  /**
   * Send message to WhatsApp
   */
  private async sendWhatsAppMessage(accountId: number, chatId: string, message: string) {
    try {
      console.log(`📤 Enviando mensaje WhatsApp: ${chatId} -> ${message.substring(0, 50)}...`);
      
      // Import WhatsApp service dynamically to avoid circular dependencies
      const whatsappManager = await import('./whatsappMultiAccountManager');
      
      if (whatsappManager.whatsappManager) {
        const success = await whatsappManager.whatsappManager.sendMessage(accountId, chatId, message);
        
        if (success) {
          console.log(`✅ Mensaje enviado exitosamente a ${chatId}`);
        } else {
          console.log(`❌ Error enviando mensaje a ${chatId}`);
        }
        
        return success;
      } else {
        console.log(`⚠️ WhatsApp Manager no disponible`);
        return false;
      }
      
    } catch (error) {
      console.error('Error sending WhatsApp message:', error);
      return false;
    }
  }

  /**
   * Create or update contact information
   */
  private async upsertContact(phone: string, chatId: string, accountId: number) {
    try {
      const existingContact = await db
        .select()
        .from(contacts)
        .where(eq(contacts.phone, phone))
        .limit(1);

      if (existingContact.length === 0) {
        // Create new contact
        await db
          .insert(contacts)
          .values({
            name: phone, // Will be updated when we get actual name
            phone: phone,
            source: 'whatsapp',
            whatsappProfile: { chatId, accountId },
            lastSeen: new Date(),
            isActive: true
          });
        
        console.log(`👤 Nuevo contacto creado: ${phone}`);
      } else {
        // Update existing contact
        await db
          .update(contacts)
          .set({
            lastSeen: new Date(),
            whatsappProfile: { 
              ...existingContact[0].whatsappProfile as any, 
              chatId, 
              accountId 
            }
          })
          .where(eq(contacts.phone, phone));
        
        console.log(`👤 Contacto actualizado: ${phone}`);
      }
    } catch (error) {
      console.error('Error upserting contact:', error);
    }
  }

  /**
   * Handle sales stage changes
   */
  private async handleStageChange(
    chatId: string, 
    accountId: number, 
    newStageId: number, 
    sessionData: any
  ) {
    try {
      console.log(`📈 Cambio de etapa detectado para chat ${chatId} -> Etapa ${newStageId}`);
      
      // Create or update lead based on stage
      if (sessionData.customerPhone || sessionData.customerEmail) {
        await this.createOrUpdateLead(chatId, accountId, newStageId, sessionData);
      }

      // Trigger stage-specific automations
      await this.triggerStageAutomations(newStageId, chatId, accountId, sessionData);
      
    } catch (error) {
      console.error('Error handling stage change:', error);
    }
  }

  /**
   * Create or update lead based on conversation data
   */
  private async createOrUpdateLead(
    chatId: string, 
    accountId: number, 
    stageId: number, 
    sessionData: any
  ) {
    try {
      // Find contact by phone
      const contact = await db
        .select()
        .from(contacts)
        .where(eq(contacts.phone, sessionData.customerPhone || chatId))
        .limit(1);

      if (contact.length > 0) {
        // Check if lead already exists
        const existingLead = await db
          .select()
          .from(leads)
          .where(and(
            eq(leads.contactId, contact[0].id),
            eq(leads.whatsappAccountId, accountId)
          ))
          .limit(1);

        const leadData = {
          title: `Lead desde WhatsApp - ${sessionData.customerName || contact[0].name}`,
          status: this.mapStageToLeadStatus(stageId),
          stage: this.mapStageToLeadStage(stageId),
          value: sessionData.budget ? parseFloat(sessionData.budget) : undefined,
          probability: this.calculateProbabilityFromStage(stageId),
          source: 'whatsapp',
          lastContactDate: new Date(),
          notes: `Conversación iniciada desde flujo de ventas automatizado. Intereses: ${sessionData.interests?.join(', ') || 'No especificado'}`
        };

        if (existingLead.length === 0) {
          // Create new lead
          await db
            .insert(leads)
            .values({
              contactId: contact[0].id,
              whatsappAccountId: accountId,
              ...leadData
            });
          
          console.log(`🎯 Nuevo lead creado para contacto: ${contact[0].name}`);
        } else {
          // Update existing lead
          await db
            .update(leads)
            .set(leadData)
            .where(eq(leads.id, existingLead[0].id));
          
          console.log(`🎯 Lead actualizado para contacto: ${contact[0].name}`);
        }
      }
    } catch (error) {
      console.error('Error creating/updating lead:', error);
    }
  }

  /**
   * Execute automation actions triggered by flow
   */
  private async executeAutomationAction(
    accountId: number,
    chatId: string,
    action: string,
    sessionData: any
  ) {
    try {
      console.log(`🤖 Ejecutando automatización: ${action} para chat ${chatId}`);
      
      switch (action) {
        case 'enable_auto_response':
          await this.enableAutoResponse(accountId);
          break;
          
        case 'disable_auto_response':
          await this.disableAutoResponse(accountId);
          break;
          
        case 'change_agent':
          await this.changeAIAgent(accountId, sessionData.newAgentId);
          break;
          
        case 'create_ticket':
          await this.createSupportTicket(chatId, accountId, sessionData);
          break;
          
        case 'schedule_follow_up':
          await this.scheduleFollowUp(chatId, accountId, sessionData);
          break;
          
        case 'send_broadcast':
          await this.sendBroadcastMessage(accountId, sessionData);
          break;
          
        case 'webhook_call':
          await this.executeWebhook(sessionData.webhookConfig, sessionData);
          break;
      }
      
    } catch (error) {
      console.error('Error executing automation action:', error);
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
    
    console.log(`✅ Respuestas automáticas activadas para cuenta ${accountId}`);
  }

  /**
   * Disable automatic responses for account
   */
  private async disableAutoResponse(accountId: number) {
    await db
      .update(whatsappAccounts)
      .set({ autoResponseEnabled: false })
      .where(eq(whatsappAccounts.id, accountId));
    
    console.log(`❌ Respuestas automáticas desactivadas para cuenta ${accountId}`);
  }

  /**
   * Change AI agent for account
   */
  private async changeAIAgent(accountId: number, newAgentId: string) {
    await db
      .update(whatsappAccounts)
      .set({ assignedExternalAgentId: newAgentId })
      .where(eq(whatsappAccounts.id, accountId));
    
    console.log(`🔄 Agente IA cambiado a ${newAgentId} para cuenta ${accountId}`);
  }

  /**
   * Create support ticket
   */
  private async createSupportTicket(chatId: string, accountId: number, sessionData: any) {
    // Implementation would depend on your ticket system
    console.log(`🎫 Ticket de soporte creado para chat ${chatId}`);
    return `ticket_${Date.now()}`;
  }

  /**
   * Schedule follow-up message
   */
  private async scheduleFollowUp(chatId: string, accountId: number, sessionData: any) {
    const followUpDate = new Date();
    followUpDate.setDate(followUpDate.getDate() + (sessionData.daysAhead || 1));
    followUpDate.setHours(parseInt(sessionData.timeOfDay?.split(':')[0] || '9'), 
                          parseInt(sessionData.timeOfDay?.split(':')[1] || '0'));

    // Store scheduled message (would integrate with scheduler service)
    console.log(`⏰ Seguimiento programado para ${followUpDate.toISOString()} - Chat: ${chatId}`);
  }

  /**
   * Send broadcast message to target audience
   */
  private async sendBroadcastMessage(accountId: number, sessionData: any) {
    const { broadcastMessage, targetAudience } = sessionData;
    
    // Get target contacts based on audience criteria
    let targetContacts: any[] = [];
    
    switch (targetAudience) {
      case 'all_contacts':
        targetContacts = await db.select().from(contacts).where(eq(contacts.isActive, true));
        break;
      case 'active_leads':
        targetContacts = await db
          .select({ phone: contacts.phone })
          .from(contacts)
          .innerJoin(leads, eq(leads.contactId, contacts.id))
          .where(and(
            eq(contacts.isActive, true),
            eq(leads.status, 'active')
          ));
        break;
      // Add more audience types as needed
    }

    // Send broadcast to each contact
    for (const contact of targetContacts) {
      await this.sendWhatsAppMessage(accountId, contact.phone, broadcastMessage);
      // Add small delay to avoid rate limiting
      await new Promise(resolve => setTimeout(resolve, 1000));
    }
    
    console.log(`📢 Mensaje de difusión enviado a ${targetContacts.length} contactos`);
  }

  /**
   * Execute webhook call
   */
  private async executeWebhook(webhookConfig: any, sessionData: any) {
    try {
      const { webhookUrl, httpMethod, headers, requestBody } = webhookConfig;
      
      // Replace variables in request body
      const processedBody = this.replaceVariables(requestBody, sessionData);
      
      const response = await fetch(webhookUrl, {
        method: httpMethod || 'POST',
        headers: JSON.parse(headers || '{"Content-Type": "application/json"}'),
        body: httpMethod !== 'GET' ? processedBody : undefined
      });
      
      console.log(`🌐 Webhook ejecutado: ${webhookUrl} - Status: ${response.status}`);
      return response.ok;
      
    } catch (error) {
      console.error('Error executing webhook:', error);
      return false;
    }
  }

  /**
   * Replace variables in text with session data
   */
  private replaceVariables(text: string, sessionData: any): string {
    let result = text;
    
    const variables = {
      customerName: sessionData.customerName || 'Cliente',
      customerPhone: sessionData.customerPhone || '',
      customerEmail: sessionData.customerEmail || '',
      budget: sessionData.budget || '',
      interests: sessionData.interests?.join(', ') || '',
      timeline: sessionData.timeline || ''
    };

    Object.entries(variables).forEach(([key, value]) => {
      result = result.replace(new RegExp(`{{${key}}}`, 'g'), value.toString());
    });

    return result;
  }

  /**
   * Trigger stage-specific automations
   */
  private async triggerStageAutomations(
    stageId: number, 
    chatId: string, 
    accountId: number, 
    sessionData: any
  ) {
    // Implementation for stage-specific automations
    console.log(`🔧 Ejecutando automatizaciones para etapa ${stageId}`);
  }

  /**
   * Map sales flow stage to lead status
   */
  private mapStageToLeadStatus(stageId: number): string {
    // This mapping would be configurable based on your stages
    const stageMapping: Record<number, string> = {
      1: 'new',
      2: 'contacted', 
      3: 'qualified',
      4: 'proposal',
      5: 'negotiation'
    };
    
    return stageMapping[stageId] || 'new';
  }

  /**
   * Map sales flow stage to lead stage
   */
  private mapStageToLeadStage(stageId: number): string {
    const stageMapping: Record<number, string> = {
      1: 'lead',
      2: 'lead',
      3: 'opportunity',
      4: 'quote',
      5: 'deal'
    };
    
    return stageMapping[stageId] || 'lead';
  }

  /**
   * Calculate probability based on stage
   */
  private calculateProbabilityFromStage(stageId: number): number {
    const probabilityMapping: Record<number, number> = {
      1: 10,
      2: 25,
      3: 50,
      4: 75,
      5: 90
    };
    
    return probabilityMapping[stageId] || 10;
  }
}

export const whatsappFlowIntegration = new WhatsAppFlowIntegration();