/**
 * Sistema de Creación Automática de Usuarios Demo en Tiempo Real
 * Detecta nombres completos en mensajes de WhatsApp y crea automáticamente usuarios demo
 */

import { db, pool } from '../db';
import { demoUsers } from '@shared/schema';
import bcrypt from 'bcrypt';
import { createDemoExpirationDate } from '../utils/demoConstants';

interface DemoCreationResult {
  success: boolean;
  username?: string;
  password?: string;
  error?: string;
  fullName?: string;
  expiresAt?: Date;
}

export class RealtimeDemoCreator {
  private static instance: RealtimeDemoCreator;
  private namePattern = /^[A-ZÁÉÍÓÚÑ][a-záéíóúñ]+\s+[A-ZÁÉÍÓÚÑ][a-záéíóúñ]+(?:\s+[A-ZÁÉÍÓÚÑ][a-záéíóúñ]+)*$/;
  private processedMessages = new Set<string>();

  static getInstance(): RealtimeDemoCreator {
    if (!RealtimeDemoCreator.instance) {
      RealtimeDemoCreator.instance = new RealtimeDemoCreator();
    }
    return RealtimeDemoCreator.instance;
  }

  /**
   * Detecta si un mensaje contiene un nombre completo válido
   */
  private detectFullName(message: string): string | null {
    const cleanMessage = message.trim();
    
    // Patrones comunes que indican que alguien está dando su nombre
    const nameIndicators = [
      /mi\s+nombre\s+es\s+([A-ZÁÉÍÓÚÑ][a-záéíóúñ]+\s+[A-ZÁÉÍÓÚÑ][a-záéíóúñ]+(?:\s+[A-ZÁÉÍÓÚÑ][a-záéíóúñ]+)*)/i,
      /me\s+llamo\s+([A-ZÁÉÍÓÚÑ][a-záéíóúñ]+\s+[A-ZÁÉÍÓÚÑ][a-záéíóúñ]+(?:\s+[A-ZÁÉÍÓÚÑ][a-záéíóúñ]+)*)/i,
      /soy\s+([A-ZÁÉÍÓÚÑ][a-záéíóúñ]+\s+[A-ZÁÉÍÓÚÑ][a-záéíóúñ]+(?:\s+[A-ZÁÉÍÓÚÑ][a-záéíóúñ]+)*)/i,
      /^([A-ZÁÉÍÓÚÑ][a-záéíóúñ]+\s+[A-ZÁÉÍÓÚÑ][a-záéíóúñ]+(?:\s+[A-ZÁÉÍÓÚÑ][a-záéíóúñ]+)*)$/
    ];

    for (const pattern of nameIndicators) {
      const match = cleanMessage.match(pattern);
      if (match && match[1]) {
        const name = match[1].trim();
        // Verificar que tiene al menos 2 palabras y menos de 6
        const words = name.split(/\s+/);
        if (words.length >= 2 && words.length <= 5) {
          return name;
        }
      }
    }

    // Si el mensaje es solo un nombre completo (sin indicadores)
    if (this.namePattern.test(cleanMessage)) {
      const words = cleanMessage.split(/\s+/);
      if (words.length >= 2 && words.length <= 5) {
        return cleanMessage;
      }
    }

    return null;
  }

  /**
   * Genera un username único basado en el nombre completo
   */
  private async generateUsername(fullName: string): Promise<string> {
    const cleanName = fullName
      .toLowerCase()
      .replace(/[áàäâ]/g, 'a')
      .replace(/[éèëê]/g, 'e')
      .replace(/[íìïî]/g, 'i')
      .replace(/[óòöô]/g, 'o')
      .replace(/[úùüû]/g, 'u')
      .replace(/ñ/g, 'n')
      .replace(/[^a-z\s]/g, '')
      .replace(/\s+/g, '_');

    const baseUsername = `demo_${cleanName}`;
    
    // Verificar si el username ya existe
    const existingResult = await pool.query(
      'SELECT username FROM demo_users WHERE username LIKE $1',
      [`${baseUsername}%`]
    );

    if (existingResult.rows.length === 0) {
      return baseUsername;
    }

    // Si existe, agregar un número secuencial
    let counter = 1;
    let uniqueUsername = `${baseUsername}_${counter.toString().padStart(3, '0')}`;
    
    while (existingResult.rows.some(row => row.username === uniqueUsername)) {
      counter++;
      uniqueUsername = `${baseUsername}_${counter.toString().padStart(3, '0')}`;
    }

    return uniqueUsername;
  }

  /**
   * Genera una contraseña simple y memorable
   */
  private generatePassword(): string {
    const adjectives = ['rapido', 'fuerte', 'brillante', 'inteligente', 'activo'];
    const numbers = Math.floor(Math.random() * 99) + 1;
    const adjective = adjectives[Math.floor(Math.random() * adjectives.length)];
    return `${adjective}${numbers}`;
  }

  /**
   * Genera un número demo único secuencial
   */
  private async generateDemoNumber(): Promise<number> {
    const result = await pool.query(`
      SELECT COALESCE(MAX(demo_number), 0) + 1 as next_number 
      FROM demo_users
    `);
    return result.rows[0].next_number;
  }

  /**
   * Crea automáticamente un usuario demo
   */
  private async createDemoUser(fullName: string, chatId: string): Promise<DemoCreationResult> {
    try {
      console.log(`🚀 Creando usuario demo automático para: ${fullName}`);

      const username = await this.generateUsername(fullName);
      const password = this.generatePassword();
      const hashedPassword = await bcrypt.hash(password, 10);
      const expiresAt = createDemoExpirationDate();
      const demoNumber = await this.generateDemoNumber();

      // Crear usuario demo en la base de datos
      const result = await pool.query(`
        INSERT INTO demo_users (username, password, customer_name, full_name, email, phone_number, demo_number, chat_id, status, created_at, expires_at)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, NOW(), $10)
        RETURNING id, username, customer_name, full_name, demo_number, created_at, expires_at
      `, [
        username,
        hashedPassword,
        fullName, // customer_name
        fullName, // full_name
        `${username}@demo.local`,
        '', // phone_number (empty string as default)
        demoNumber,
        chatId,
        'active',
        expiresAt
      ]);

      const newUser = result.rows[0];
      
      console.log(`✅ Usuario demo creado exitosamente:`, {
        id: newUser.id,
        username: newUser.username,
        fullName: newUser.full_name,
        expiresAt: newUser.expires_at
      });

      return {
        success: true,
        username,
        password,
        fullName,
        expiresAt
      };

    } catch (error) {
      console.error('❌ Error creando usuario demo automático:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Error desconocido'
      };
    }
  }

  /**
   * Genera el mensaje de respuesta con las credenciales
   */
  private generateWelcomeMessage(result: DemoCreationResult): string {
    if (!result.success || !result.username || !result.password) {
      return "Lo siento, hubo un error al crear tu cuenta demo. Por favor, inténtalo más tarde.";
    }

    const expirationDate = result.expiresAt ? 
      new Date(result.expiresAt).toLocaleDateString('es-ES', {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
      }) : '72 horas';

    return `🎉 ¡Hola ${result.fullName}! Tu cuenta demo ha sido creada exitosamente.

📱 **Credenciales de acceso:**
👤 Usuario: \`${result.username}\`
🔐 Contraseña: \`${result.password}\`

⏰ **Tu cuenta demo expira el:** ${expirationDate}

🔗 **Para acceder:** Ve a la página de login y usa tus credenciales

✨ ¡Disfruta explorando todas las funcionalidades del sistema!

💡 **Tip:** Guarda estas credenciales en un lugar seguro.`;
  }

  /**
   * Procesa un mensaje de WhatsApp y crea automáticamente un demo si detecta un nombre
   */
  async processMessage(
    message: string, 
    chatId: string, 
    messageId: string,
    accountId: number = 1
  ): Promise<{ shouldRespond: boolean; responseMessage?: string }> {
    
    // Evitar procesar el mismo mensaje múltiples veces
    const messageKey = `${chatId}_${messageId}`;
    if (this.processedMessages.has(messageKey)) {
      return { shouldRespond: false };
    }

    console.log(`🔍 Analizando mensaje para creación automática de demo: "${message}"`);

    const detectedName = this.detectFullName(message);
    if (!detectedName) {
      console.log('❌ No se detectó nombre completo válido');
      return { shouldRespond: false };
    }

    console.log(`✅ Nombre completo detectado: ${detectedName}`);
    
    // Marcar mensaje como procesado
    this.processedMessages.add(messageKey);

    // Verificar si ya existe un usuario demo para este chat
    const existingDemoResult = await pool.query(`
      SELECT username FROM demo_users 
      WHERE full_name ILIKE $1 AND status = 'active'
      ORDER BY created_at DESC LIMIT 1
    `, [`%${detectedName}%`]);

    if (existingDemoResult.rows.length > 0) {
      console.log(`⚠️ Ya existe usuario demo para: ${detectedName}`);
      return {
        shouldRespond: true,
        responseMessage: `Hola ${detectedName}! Parece que ya tienes una cuenta demo creada. Si tienes problemas para acceder, contacta con soporte.`
      };
    }

    // Crear usuario demo
    const demoResult = await this.createDemoUser(detectedName, chatId);
    
    if (demoResult.success) {
      const welcomeMessage = this.generateWelcomeMessage(demoResult);
      console.log(`📤 Enviando credenciales de demo a ${detectedName}`);
      
      return {
        shouldRespond: true,
        responseMessage: welcomeMessage
      };
    } else {
      console.error(`❌ Error en creación de demo para ${detectedName}:`, demoResult.error);
      return {
        shouldRespond: true,
        responseMessage: "Lo siento, hubo un error al crear tu cuenta demo. Por favor, inténtalo más tarde o contacta con soporte."
      };
    }
  }

  /**
   * Limpia mensajes procesados (para evitar acumulación de memoria)
   */
  clearProcessedMessages(): void {
    this.processedMessages.clear();
    console.log('🧹 Cache de mensajes procesados limpiado');
  }

  /**
   * Obtiene estadísticas del procesador
   */
  getStats(): { processedMessages: number } {
    return {
      processedMessages: this.processedMessages.size
    };
  }
}

export const realtimeDemoCreator = RealtimeDemoCreator.getInstance();