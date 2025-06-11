import { db } from "../db";
import { demoUsers } from "@shared/schema";
import { eq } from "drizzle-orm";

interface DemoRequest {
  customerName: string;
  phoneNumber: string;
  chatId: string;
}

export class DemoAgentService {
  private demoKeywords = [
    'demo', 'prueba', 'test', 'trial', 'gratis', 'free',
    'quiero probar', 'me interesa', 'necesito ver',
    'mostrar', 'demostración', 'ejemplo'
  ];

  private namePatterns = [
    /mi nombre es\s+([a-záéíóúñ\s]+)/i,
    /me llamo\s+([a-záéíóúñ\s]+)/i,
    /soy\s+([a-záéíóúñ\s]+)/i,
    /my name is\s+([a-z\s]+)/i,
    /i am\s+([a-z\s]+)/i,
    /i'm\s+([a-z\s]+)/i
  ];

  /**
   * Detect if message contains demo request keywords
   */
  isDemoRequest(message: string): boolean {
    const lowerMessage = message.toLowerCase();
    return this.demoKeywords.some(keyword => lowerMessage.includes(keyword));
  }

  /**
   * Extract customer name from message
   */
  extractCustomerName(message: string): string | null {
    for (const pattern of this.namePatterns) {
      const match = message.match(pattern);
      if (match && match[1]) {
        return match[1].trim();
      }
    }
    return null;
  }

  /**
   * Generate demo request response
   */
  generateDemoRequestResponse(): string {
    return `¡Hola! Me da mucho gusto saber que estás interesado en nuestro sistema CRM con IA. 

¿Te gustaría que te dé acceso para una prueba del sistema por 3 días completamente GRATIS?

Para crear tu demo personalizado, necesito conocer tu nombre. 

Por favor escríbeme: "Mi nombre es [tu nombre]" y te crearé tu acceso inmediatamente.

Con el demo podrás:
✅ Gestionar contactos y leads
✅ Automatizar respuestas de WhatsApp
✅ Usar IA avanzada para ventas
✅ Ver reportes en tiempo real
✅ Acceso completo por 3 días

¿Cuál es tu nombre?`;
  }

  /**
   * Generate name confirmation response
   */
  generateNameConfirmationResponse(name: string): string {
    return `Perfecto ${name}! 🎉

Estoy creando tu demo personalizado ahora mismo...

Tu acceso incluirá:
🔑 Usuario único y contraseña estándar
⏰ Acceso completo por 3 días
🚀 Todas las funciones premium
📊 Panel de administración completo

En unos segundos te envío tus credenciales de acceso.`;
  }

  /**
   * Generate demo credentials response
   */
  generateDemoCredentialsResponse(demo: any): string {
    return `¡Tu demo está listo! 🎯

🔐 **CREDENCIALES DE ACCESO:**
👤 Usuario: \`${demo.username}\`
🔑 Contraseña: \`demo123456\`

🌐 **ENLACE DE ACCESO:**
${demo.loginUrl}

⏰ **VÁLIDO HASTA:** ${new Date(demo.expiresAt).toLocaleDateString('es-ES', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    })} (3 días de acceso)

**¿Qué puedes hacer en tu demo?**
✅ Gestionar contactos y leads
✅ Configurar respuestas automáticas
✅ Usar IA para generar respuestas
✅ Ver estadísticas en tiempo real
✅ Probar integración con WhatsApp

**IMPORTANTE:** El sistema se deshabilitará automáticamente al cumplirse exactamente 3 días desde la creación.

**¿Te gusta el sistema?**
Responde "QUIERO PLAN" y te ayudo a elegir el plan perfecto para tu negocio.

¡Disfruta explorando tu demo! 🚀`;
  }

  /**
   * Create demo account
   */
  async createDemo(demoRequest: DemoRequest): Promise<any> {
    try {
      console.log(`🎭 Creating demo for: ${demoRequest.customerName}`);

      // Generate unique username and password
      const timestamp = Date.now();
      const username = `demo_${demoRequest.customerName.toLowerCase().replace(/\s+/g, '_')}_${timestamp}`;
      const password = `demo${Math.random().toString(36).substring(2, 8)}`;

      // Set expiration to 1 day from now
      const expiresAt = new Date();
      expiresAt.setDate(expiresAt.getDate() + 1);

      // Create demo user in database
      const [demoUser] = await db.insert(demoUsers).values({
        customerName: demoRequest.customerName,
        phoneNumber: demoRequest.phoneNumber,
        username,
        password,
        chatId: demoRequest.chatId,
        expiresAt,
        status: 'active',
        createdBy: 'agent'
      }).returning();

      console.log(`✅ Demo created successfully: ${username}`);

      return {
        id: demoUser.id,
        customerName: demoUser.customerName,
        username: demoUser.username,
        password: demoUser.password,
        expiresAt: demoUser.expiresAt,
        loginUrl: `https://${process.env.REPLIT_DEV_DOMAIN || 'localhost:5000'}/demo-login`
      };
    } catch (error) {
      console.error("Error creating demo:", error);
      throw error;
    }
  }

  /**
   * Process incoming WhatsApp message for demo requests
   */
  async processMessage(message: string, phoneNumber: string, chatId: string): Promise<string | null> {
    try {
      // Check if it's a demo request
      if (this.isDemoRequest(message)) {
        // Try to extract name from the same message
        const extractedName = this.extractCustomerName(message);
        
        if (extractedName) {
          // Create demo immediately
          const demo = await this.createDemo({
            customerName: extractedName,
            phoneNumber,
            chatId
          });
          
          return this.generateDemoCredentialsResponse(demo);
        } else {
          // Ask for name
          return this.generateDemoRequestResponse();
        }
      }

      // Check if message contains a name after demo request
      const extractedName = this.extractCustomerName(message);
      if (extractedName) {
        // Check if there was a recent demo request from this number
        const recentDemo = await db.select()
          .from(demoUsers)
          .where(eq(demoUsers.phoneNumber, phoneNumber))
          .orderBy(demoUsers.createdAt)
          .limit(1);

        // If no recent demo, create one
        if (recentDemo.length === 0) {
          const demo = await this.createDemo({
            customerName: extractedName,
            phoneNumber,
            chatId
          });
          
          return this.generateDemoCredentialsResponse(demo);
        }
      }

      return null; // No demo-related response needed
    } catch (error) {
      console.error("Error processing demo message:", error);
      return "Lo siento, hubo un error procesando tu solicitud. Por favor intenta nuevamente.";
    }
  }

  /**
   * Get demo statistics
   */
  async getDemoStats(): Promise<any> {
    try {
      const totalDemos = await db.select().from(demoUsers);
      const activeDemos = totalDemos.filter(demo => 
        new Date() <= new Date(demo.expiresAt) && demo.status === 'active'
      );
      const expiredDemos = totalDemos.filter(demo => 
        new Date() > new Date(demo.expiresAt) || demo.status === 'expired'
      );
      const convertedDemos = totalDemos.filter(demo => demo.status === 'converted');

      return {
        total: totalDemos.length,
        active: activeDemos.length,
        expired: expiredDemos.length,
        converted: convertedDemos.length,
        conversionRate: totalDemos.length > 0 ? (convertedDemos.length / totalDemos.length * 100).toFixed(2) : 0
      };
    } catch (error) {
      console.error("Error getting demo stats:", error);
      return {
        total: 0,
        active: 0,
        expired: 0,
        converted: 0,
        conversionRate: 0
      };
    }
  }
}

export const demoAgentService = new DemoAgentService();