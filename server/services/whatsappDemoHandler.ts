import { demoAgentService } from "./demoAgentService";

/**
 * WhatsApp Demo Handler
 * Integrates demo agent service with WhatsApp automated responses
 */
export class WhatsAppDemoHandler {
  
  /**
   * Process incoming WhatsApp messages for demo requests
   */
  async processMessage(chatId: string, phoneNumber: string, message: string): Promise<string | null> {
    try {
      // Check if this is a demo request
      if (demoAgentService.isDemoRequest(message)) {
        console.log(`🎭 Demo request detected from ${phoneNumber}: ${message}`);
        
        // Ask for customer name
        const nameRequest = demoAgentService.generateDemoRequestResponse();
        return nameRequest;
      }

      // Check if this is a name response after demo request
      const extractedName = demoAgentService.extractCustomerName(message);
      if (extractedName) {
        console.log(`📝 Customer name provided from ${phoneNumber}: ${message}`);
        
        try {
          // Create demo account
          const demo = await demoAgentService.processMessage(chatId, phoneNumber, message);
          
          if (demo) {
            // Generate success response with login details
            const successMessage = demoAgentService.generateDemoCredentialsResponse(demo);
            return successMessage;
          }
        } catch (error) {
          console.error("Error creating demo:", error);
          return "Lo siento, hubo un error creando tu demo. Por favor intenta nuevamente o contacta soporte.";
        }
      }

      // Not a demo-related message
      return null;
      
    } catch (error) {
      console.error("Error in WhatsApp demo handler:", error);
      return null;
    }
  }

  /**
   * Check if message should be handled by demo agent
   */
  shouldHandle(message: string): boolean {
    return demoAgentService.isDemoRequest(message) || 
           (demoAgentService.extractCustomerName(message) !== null);
  }
}

export const whatsappDemoHandler = new WhatsAppDemoHandler();