/**
 * AUTOMATIC WHATSAPP RESPONDER - Complete AI Agent Integration
 * 
 * This service automatically responds to incoming WhatsApp messages using external AI agents
 * Follows all functional requirements: connection check, agent verification, toggle control, etc.
 */

interface WhatsAppAccount {
  id: number;
  name: string;
  status: string;
  assignedAgentId: string | null;
  aiToggleEnabled: boolean;
  isConnected: boolean;
}

interface IncomingMessage {
  id: string;
  chatId: string;
  body: string;
  fromMe: boolean;
  timestamp: number;
  accountId: number;
  contactName: string;
  contactPhone: string;
}

interface ExternalAgent {
  id: string;
  name: string;
  agentUrl: string;
  isActive: boolean;
}

export class AutomaticWhatsAppResponder {
  private isRunning: boolean = false;
  private intervalId: NodeJS.Timeout | null = null;
  private processedMessages: Set<string> = new Set();
  
  constructor() {
    console.log('🤖 Automatic WhatsApp Responder initialized');
  }

  /**
   * START - Main entry point for the automatic responder system
   */
  async start(): Promise<void> {
    if (this.isRunning) {
      console.log('⚠️ Automatic responder already running');
      return;
    }

    this.isRunning = true;
    console.log('🚀 Starting Automatic WhatsApp Responder System...');
    
    // Start monitoring every 2 seconds
    this.intervalId = setInterval(async () => {
      await this.processIncomingMessages();
    }, 2000);

    console.log('✅ Automatic WhatsApp Responder started successfully');
  }

  /**
   * STOP - Stop the automatic responder system
   */
  stop(): void {
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }
    this.isRunning = false;
    console.log('🛑 Automatic WhatsApp Responder stopped');
  }

  /**
   * STEP 1: CHECK WHATSAPP CONNECTION STATUS
   */
  private async checkWhatsAppConnection(accountId: number): Promise<boolean> {
    try {
      const response = await fetch(`http://127.0.0.1:5000/api/whatsapp-accounts/${accountId}/status`);
      if (!response.ok) {
        console.log(`❌ WhatsApp account ${accountId} not connected - Status check failed`);
        return false;
      }

      const data = await response.json();
      
      if (data.status !== 'ready') {
        console.log(`❌ WhatsApp account ${accountId} not connected - Status: ${data.status}`);
        return false;
      }

      console.log(`✅ WhatsApp account ${accountId} is connected and ready`);
      return true;
    } catch (error) {
      console.log(`❌ WhatsApp account ${accountId} not connected - Connection error:`, error);
      return false;
    }
  }

  /**
   * STEP 2: VERIFY ASSIGNED AGENT
   */
  private async getAssignedAgent(accountId: number): Promise<ExternalAgent | null> {
    try {
      // Get account configuration
      const accountResponse = await fetch(`http://127.0.0.1:5000/api/whatsapp-accounts/${accountId}/agent-config`);
      if (!accountResponse.ok) {
        console.log(`❌ No AI agent assigned to WhatsApp account ${accountId} - Config not found`);
        return null;
      }

      const accountData = await accountResponse.json();
      
      if (!accountData.assignedAgentId) {
        console.log(`❌ No AI agent assigned to WhatsApp account ${accountId}`);
        return null;
      }

      // Get agent details
      const agentResponse = await fetch(`http://127.0.0.1:5000/api/external-agents/${accountData.assignedAgentId}`);
      if (!agentResponse.ok) {
        console.log(`❌ Assigned agent ${accountData.assignedAgentId} not found`);
        return null;
      }

      const agent = await agentResponse.json();
      
      if (!agent.isActive) {
        console.log(`❌ Assigned agent ${agent.name} is not active`);
        return null;
      }

      console.log(`✅ Active AI agent found: ${agent.name} for account ${accountId}`);
      return agent;

    } catch (error) {
      console.log(`❌ Error verifying assigned agent for account ${accountId}:`, error);
      return null;
    }
  }

  /**
   * STEP 3: CHECK AI ON/OFF TOGGLE STATUS
   */
  private async checkAIToggleStatus(accountId: number): Promise<boolean> {
    try {
      const response = await fetch(`http://127.0.0.1:5000/api/whatsapp-accounts/${accountId}/ai-toggle-status`);
      if (!response.ok) {
        console.log(`❌ Could not check AI toggle status for account ${accountId}`);
        return false;
      }

      const data = await response.json();
      
      if (!data.aiEnabled) {
        console.log(`🔴 AI toggle is OFF for account ${accountId} - Automation disabled`);
        return false;
      }

      console.log(`🟢 AI toggle is ON for account ${accountId} - Automation enabled`);
      return true;
    } catch (error) {
      console.log(`❌ Error checking AI toggle for account ${accountId}:`, error);
      return false;
    }
  }

  /**
   * STEP 4: MONITOR INCOMING MESSAGES
   */
  private async getIncomingMessages(accountId: number): Promise<IncomingMessage[]> {
    try {
      const response = await fetch(`http://127.0.0.1:5000/api/whatsapp-accounts/${accountId}/recent-messages`);
      if (!response.ok) {
        return [];
      }

      const data = await response.json();
      const messages = data.messages || [];

      // Filter for new incoming messages (not from us, not already processed)
      const newIncomingMessages = messages.filter((msg: any) => 
        !msg.fromMe && 
        !this.processedMessages.has(msg.id) &&
        Date.now() - msg.timestamp < 30000 // Only messages from last 30 seconds
      );

      // Mark messages with red indicator and "Last Received" title
      for (const message of newIncomingMessages) {
        console.log(`🔴 Last Received: "${message.body}" from ${message.contactName}`);
      }

      return newIncomingMessages;
    } catch (error) {
      console.log(`❌ Error getting incoming messages for account ${accountId}:`, error);
      return [];
    }
  }

  /**
   * STEP 5: GENERATE RESPONSE WITH EXTERNAL AGENT
   */
  private async generateAgentResponse(agent: ExternalAgent, message: IncomingMessage): Promise<string | null> {
    try {
      console.log(`🤖 Sending message to agent ${agent.name}: "${message.body}"`);

      const response = await fetch(`http://127.0.0.1:5000/api/external-agents/${agent.id}/send`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          message: message.body,
          chatContext: {
            contactName: message.contactName,
            contactPhone: message.contactPhone
          },
          userInfo: {
            chatId: message.chatId,
            accountId: message.accountId,
            name: message.contactName
          }
        }),
      });

      if (!response.ok) {
        console.log(`❌ Agent ${agent.name} failed to respond - Status: ${response.status}`);
        return null;
      }

      const data = await response.json();
      
      if (data.success && data.response) {
        console.log(`✅ Agent ${agent.name} responded: "${data.response}"`);
        return data.response;
      } else {
        console.log(`❌ Agent ${agent.name} error: ${data.error || 'No response generated'}`);
        return null;
      }

    } catch (error) {
      console.log(`❌ Error generating response with agent ${agent.name}:`, error);
      return null;
    }
  }

  /**
   * STEP 6: SEND REPLY BACK TO WHATSAPP CHAT
   */
  private async sendReplyToWhatsApp(accountId: number, chatId: string, replyText: string): Promise<boolean> {
    try {
      console.log(`📤 Sending automatic reply to chat ${chatId}: "${replyText}"`);

      const response = await fetch(`http://127.0.0.1:5000/api/whatsapp-accounts/${accountId}/send-message`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          chatId: chatId,
          message: replyText,
          automated: true
        }),
      });

      if (!response.ok) {
        console.log(`❌ Failed to send reply to WhatsApp - Status: ${response.status}`);
        return false;
      }

      const data = await response.json();
      
      if (data.success) {
        console.log(`✅ Automatic reply sent successfully to chat ${chatId}`);
        return true;
      } else {
        console.log(`❌ Failed to send reply: ${data.error || 'Unknown error'}`);
        return false;
      }

    } catch (error) {
      console.log(`❌ Error sending reply to WhatsApp:`, error);
      return false;
    }
  }

  /**
   * MAIN PROCESSING LOGIC - Orchestrates all steps
   */
  private async processIncomingMessages(): Promise<void> {
    try {
      // Get all WhatsApp accounts
      const accountsResponse = await fetch('http://127.0.0.1:5000/api/whatsapp-accounts');
      if (!accountsResponse.ok) {
        return;
      }

      const accountsData = await accountsResponse.json();
      const accounts = accountsData.accounts || [];

      for (const account of accounts) {
        await this.processAccountMessages(account.id);
      }

    } catch (error) {
      console.log('❌ Error in main processing logic:', error);
    }
  }

  /**
   * PROCESS MESSAGES FOR A SPECIFIC ACCOUNT
   */
  private async processAccountMessages(accountId: number): Promise<void> {
    try {
      // STEP 1: Check WhatsApp connection
      const isConnected = await this.checkWhatsAppConnection(accountId);
      if (!isConnected) {
        return; // Skip if not connected
      }

      // STEP 2: Verify assigned agent
      const assignedAgent = await this.getAssignedAgent(accountId);
      if (!assignedAgent) {
        return; // Skip if no agent assigned
      }

      // STEP 3: Check AI toggle status
      const aiToggleEnabled = await this.checkAIToggleStatus(accountId);
      if (!aiToggleEnabled) {
        return; // Skip if AI is turned off
      }

      // STEP 4: Get incoming messages
      const incomingMessages = await this.getIncomingMessages(accountId);
      
      for (const message of incomingMessages) {
        // Mark as processed immediately to avoid duplicates
        this.processedMessages.add(message.id);

        console.log(`🔄 Processing message from ${message.contactName} in account ${accountId}`);

        // STEP 5: Generate response with external agent
        const agentResponse = await this.generateAgentResponse(assignedAgent, message);
        
        if (agentResponse) {
          // STEP 6: Send reply back to WhatsApp
          const sent = await this.sendReplyToWhatsApp(accountId, message.chatId, agentResponse);
          
          if (sent) {
            console.log(`✅ Complete automation cycle finished for message: "${message.body}"`);
          }
        }

        // Add small delay between messages to avoid overwhelming
        await new Promise(resolve => setTimeout(resolve, 1000));
      }

    } catch (error) {
      console.log(`❌ Error processing messages for account ${accountId}:`, error);
    }
  }

  /**
   * GET STATUS - Returns current status of the responder
   */
  getStatus(): { running: boolean; processedCount: number } {
    return {
      running: this.isRunning,
      processedCount: this.processedMessages.size
    };
  }

  /**
   * CLEAR PROCESSED MESSAGES - Cleanup method
   */
  clearProcessedMessages(): void {
    this.processedMessages.clear();
    console.log('🧹 Cleared processed messages cache');
  }
}

// Export singleton instance
export const automaticWhatsAppResponder = new AutomaticWhatsAppResponder();