/**
 * Enhanced Demo Detection System
 * Automatically detects demo requests and handles conversation flow
 */

import { demoUserManager } from "./demoUserManager";
import { DemoAgentService } from "./demoAgentService";

interface DemoConversationState {
  chatId: string;
  accountId: number;
  stage: 'detecting' | 'asking_name' | 'creating' | 'completed';
  customerName?: string;
  phoneNumber?: string;
  timestamp: number;
}

class EnhancedDemoDetector {
  private demoAgent = new DemoAgentService();
  private conversationStates = new Map<string, DemoConversationState>();
  
  // Demo detection keywords
  private demoKeywords = [
    'demo', 'prueba', 'test', 'trial', 'gratis', 'free',
    'demostración', 'ejemplo', 'mostrar', 'probar',
    'quiero ver', 'me interesa', 'necesito ver'
  ];

  // Name extraction patterns
  private namePatterns = [
    /mi nombre es\s+([a-záéíóúñ\s]+)/i,
    /me llamo\s+([a-záéíóúñ\s]+)/i,
    /soy\s+([a-záéíóúñ\s]+)/i,
    /my name is\s+([a-z\s]+)/i,
    /i am\s+([a-z\s]+)/i,
    /i'm\s+([a-z\s]+)/i
  ];

  /**
   * Process message for demo detection and handling
   */
  async processMessage(message: string, chatId: string, accountId: number, phoneNumber?: string): Promise<string | null> {
    try {
      const conversationKey = `${accountId}_${chatId}`;
      const currentState = this.conversationStates.get(conversationKey);
      
      console.log(`🔍 Procesando mensaje para demo: "${message.substring(0, 50)}..."`);

      // Check if this is a demo request
      if (!currentState && this.isDemoRequest(message)) {
        console.log(`🎭 Demo request detectado en cuenta ${accountId}`);
        
        // Set conversation state to asking for name
        this.conversationStates.set(conversationKey, {
          chatId,
          accountId,
          stage: 'asking_name',
          phoneNumber,
          timestamp: Date.now()
        });

        return this.demoAgent.generateDemoRequestResponse();
      }

      // Handle name collection
      if (currentState && currentState.stage === 'asking_name') {
        const extractedName = this.extractCustomerName(message);
        
        if (extractedName) {
          console.log(`👤 Nombre extraído: ${extractedName}`);
          
          // Update state with customer name
          currentState.customerName = extractedName;
          currentState.stage = 'creating';
          this.conversationStates.set(conversationKey, currentState);

          // Generate confirmation response
          const confirmationResponse = this.demoAgent.generateNameConfirmationResponse(extractedName);
          
          // Create demo account asynchronously
          this.createDemoAccount(conversationKey, currentState)
            .then(demoResponse => {
              // In a real implementation, you would send this response through WhatsApp
              console.log(`✅ Demo creado para ${extractedName}: ${demoResponse}`);
            })
            .catch(error => {
              console.error(`❌ Error creando demo para ${extractedName}:`, error);
            });

          return confirmationResponse;
        } else {
          return `Por favor, dime tu nombre completo para poder crear tu demo. 

Puedes escribir: "Mi nombre es [tu nombre]"`;
        }
      }

      return null; // No demo-related processing needed
      
    } catch (error) {
      console.error('❌ Error en detector de demo:', error);
      return null;
    }
  }

  /**
   * Check if message contains demo request keywords
   */
  private isDemoRequest(message: string): boolean {
    const lowerMessage = message.toLowerCase();
    return this.demoKeywords.some(keyword => lowerMessage.includes(keyword));
  }

  /**
   * Extract customer name from message
   */
  private extractCustomerName(message: string): string | null {
    for (const pattern of this.namePatterns) {
      const match = message.match(pattern);
      if (match && match[1]) {
        const name = match[1].trim();
        // Validate name (at least 2 characters, only letters and spaces)
        if (name.length >= 2 && /^[a-záéíóúñ\s]+$/i.test(name)) {
          return name;
        }
      }
    }
    return null;
  }

  /**
   * Create demo account and generate credentials response
   */
  private async createDemoAccount(conversationKey: string, state: DemoConversationState): Promise<string> {
    try {
      if (!state.customerName) {
        throw new Error('Customer name is required');
      }

      // Check for existing demo to prevent duplicates
      const existingDemo = await this.checkExistingDemo(state.customerName);
      if (existingDemo) {
        // Update conversation state
        state.stage = 'completed';
        this.conversationStates.set(conversationKey, state);
        
        return `⚠️ Ya tienes un demo activo creado anteriormente.

🔐 **TUS CREDENCIALES EXISTENTES:**
👤 Usuario: \`${existingDemo.username}\`
🔑 Contraseña: \`demo123456\`

⏰ **Válido hasta:** ${new Date(existingDemo.expiresAt).toLocaleDateString('es-ES', {
          year: 'numeric',
          month: 'long',
          day: 'numeric',
          hour: '2-digit',
          minute: '2-digit'
        })}

¡Puedes seguir usando tu demo existente! 🚀`;
      }

      // Create new demo user
      const demoUser = await demoUserManager.createDemoUser({
        customerName: state.customerName,
        phoneNumber: state.phoneNumber || '',
        email: `${state.customerName.toLowerCase().replace(/\s+/g, '')}@demo.local`,
        companyName: '',
        chatId: state.chatId
      });

      // Update conversation state
      state.stage = 'completed';
      this.conversationStates.set(conversationKey, state);

      console.log(`✅ Demo creado exitosamente para: ${state.customerName}`);

      return this.demoAgent.generateDemoCredentialsResponse(demoUser);
      
    } catch (error) {
      console.error('❌ Error creando demo account:', error);
      
      // Update conversation state
      state.stage = 'completed';
      this.conversationStates.set(conversationKey, state);

      if (error.message.includes('Ya existe un demo activo')) {
        return `⚠️ Ya tienes un demo activo para este nombre. Cada cliente puede tener solo un demo a la vez.

Si necesitas ayuda con tu demo existente, escribe "AYUDA DEMO".`;
      }

      return `❌ Hubo un error al crear tu demo. Por favor intenta nuevamente en unos minutos.

Si el problema persiste, contacta a nuestro soporte técnico.`;
    }
  }

  /**
   * Check for existing active demo for customer
   */
  private async checkExistingDemo(customerName: string): Promise<any | null> {
    try {
      const activeDemos = await demoUserManager.getActiveDemoUsers();
      return activeDemos.find(demo => 
        demo.customerName.toLowerCase() === customerName.toLowerCase() && 
        !demo.isExpired
      ) || null;
    } catch (error) {
      console.error('❌ Error checking existing demo:', error);
      return null;
    }
  }

  /**
   * Clean up old conversation states (older than 1 hour)
   */
  cleanupOldStates(): void {
    const oneHourAgo = Date.now() - (60 * 60 * 1000);
    
    for (const [key, state] of this.conversationStates.entries()) {
      if (state.timestamp < oneHourAgo) {
        this.conversationStates.delete(key);
        console.log(`🧹 Limpiado estado de conversación antiguo: ${key}`);
      }
    }
  }

  /**
   * Get conversation statistics
   */
  getStats(): any {
    const states = Array.from(this.conversationStates.values());
    
    return {
      totalConversations: states.length,
      askingName: states.filter(s => s.stage === 'asking_name').length,
      creating: states.filter(s => s.stage === 'creating').length,
      completed: states.filter(s => s.stage === 'completed').length
    };
  }

  /**
   * Start automatic cleanup of old states
   */
  startAutomaticCleanup(): void {
    // Clean up every 30 minutes
    setInterval(() => {
      this.cleanupOldStates();
    }, 30 * 60 * 1000);
    
    console.log('🔄 Limpieza automática de estados de conversación iniciada');
  }
}

export const enhancedDemoDetector = new EnhancedDemoDetector();