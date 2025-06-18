/**
 * Sistema de Gestión de Intervenciones Manuales
 * Maneja pausas temporales de respuestas automáticas cuando hay intervención manual
 * Asegura privacidad total por usuario mediante filtrado automático
 */

import { db } from "../db";
import { eq, and } from "drizzle-orm";

interface InterventionRecord {
  id: string;
  userId: number;
  accountId: number;
  chatId: string;
  interventionAt: Date;
  pauseUntil: Date;
  isActive: boolean;
}

interface ChatInterventionContext {
  userId: number;
  accountId: number;
  chatId: string;
  fromMe: boolean;
  timestamp: Date;
}

/**
 * Gestor de intervenciones con aislamiento total por usuario
 */
class InterventionManager {
  private static instance: InterventionManager;
  private interventions: Map<string, InterventionRecord> = new Map();
  private readonly DEFAULT_PAUSE_MINUTES = 30;

  private constructor() {
    this.loadActiveInterventions();
    // Limpiar intervenciones expiradas cada 5 minutos
    setInterval(() => this.cleanExpiredInterventions(), 5 * 60 * 1000);
  }

  static getInstance(): InterventionManager {
    if (!InterventionManager.instance) {
      InterventionManager.instance = new InterventionManager();
    }
    return InterventionManager.instance;
  }

  /**
   * Carga intervenciones activas desde la base de datos (filtradas por usuario)
   */
  private async loadActiveInterventions(): Promise<void> {
    try {
      const query = `
        SELECT 
          id, user_id, account_id, chat_id, 
          intervention_at, pause_until, is_active
        FROM chat_interventions 
        WHERE is_active = true AND pause_until > NOW()
      `;
      
      const result = await pool.query(query);
      
      result.rows.forEach(row => {
        const key = this.generateKey(row.user_id, row.account_id, row.chat_id);
        this.interventions.set(key, {
          id: row.id,
          userId: row.user_id,
          accountId: row.account_id,
          chatId: row.chat_id,
          interventionAt: row.intervention_at,
          pauseUntil: row.pause_until,
          isActive: row.is_active
        });
      });
      
      console.log(`🔒 Intervenciones activas cargadas: ${this.interventions.size}`);
    } catch (error) {
      console.error('❌ Error cargando intervenciones:', error);
    }
  }

  /**
   * Genera clave única para identificar intervención por usuario
   */
  private generateKey(userId: number, accountId: number, chatId: string): string {
    return `${userId}_${accountId}_${chatId}`;
  }

  /**
   * Registra una intervención manual con aislamiento por usuario
   */
  async registerIntervention(context: ChatInterventionContext): Promise<boolean> {
    try {
      // Solo registrar si el mensaje es enviado manualmente (fromMe = true)
      if (!context.fromMe) {
        return false;
      }

      const key = this.generateKey(context.userId, context.accountId, context.chatId);
      const pauseUntil = new Date(context.timestamp.getTime() + (this.DEFAULT_PAUSE_MINUTES * 60 * 1000));
      
      // Verificar que la cuenta WhatsApp pertenece al usuario (seguridad)
      const accountCheck = await pool.query(
        'SELECT id FROM whatsapp_accounts WHERE id = $1 AND user_id = $2',
        [context.accountId, context.userId]
      );

      if (accountCheck.rows.length === 0) {
        console.warn(`⚠️ Intento de acceso no autorizado: Usuario ${context.userId} a cuenta ${context.accountId}`);
        return false;
      }

      // Desactivar intervención anterior si existe
      await this.deactivateExistingIntervention(context.userId, context.accountId, context.chatId);

      // Crear nueva intervención en base de datos
      const insertQuery = `
        INSERT INTO chat_interventions (
          id, user_id, account_id, chat_id, 
          intervention_at, pause_until, is_active
        ) VALUES ($1, $2, $3, $4, $5, $6, $7)
        RETURNING id
      `;
      
      const interventionId = `int_${context.userId}_${Date.now()}`;
      await pool.query(insertQuery, [
        interventionId,
        context.userId,
        context.accountId,
        context.chatId,
        context.timestamp,
        pauseUntil,
        true
      ]);

      // Almacenar en memoria para acceso rápido
      const intervention: InterventionRecord = {
        id: interventionId,
        userId: context.userId,
        accountId: context.accountId,
        chatId: context.chatId,
        interventionAt: context.timestamp,
        pauseUntil: pauseUntil,
        isActive: true
      };

      this.interventions.set(key, intervention);

      console.log(`🔒 Intervención registrada para usuario ${context.userId} - Chat pausado hasta: ${pauseUntil.toLocaleString()}`);
      return true;

    } catch (error) {
      console.error('❌ Error registrando intervención:', error);
      return false;
    }
  }

  /**
   * Verifica si un chat tiene intervención activa (con filtrado por usuario)
   */
  async isInterventionActive(userId: number, accountId: number, chatId: string): Promise<boolean> {
    try {
      // Verificar seguridad: el usuario tiene acceso a esta cuenta
      const accountCheck = await pool.query(
        'SELECT id FROM whatsapp_accounts WHERE id = $1 AND user_id = $2',
        [accountId, userId]
      );

      if (accountCheck.rows.length === 0) {
        return false; // Sin acceso, no hay intervención válida
      }

      const key = this.generateKey(userId, accountId, chatId);
      const intervention = this.interventions.get(key);

      if (!intervention || !intervention.isActive) {
        return false;
      }

      const now = new Date();
      if (now >= intervention.pauseUntil) {
        // Intervención expirada, desactivar
        await this.deactivateIntervention(intervention.id);
        this.interventions.delete(key);
        return false;
      }

      return true;
    } catch (error) {
      console.error('❌ Error verificando intervención:', error);
      return false;
    }
  }

  /**
   * Obtiene información de intervención activa para un usuario específico
   */
  async getInterventionInfo(userId: number, accountId: number, chatId: string): Promise<InterventionRecord | null> {
    try {
      // Verificar acceso del usuario a la cuenta
      const accountCheck = await pool.query(
        'SELECT id FROM whatsapp_accounts WHERE id = $1 AND user_id = $2',
        [accountId, userId]
      );

      if (accountCheck.rows.length === 0) {
        return null;
      }

      const key = this.generateKey(userId, accountId, chatId);
      const intervention = this.interventions.get(key);

      if (!intervention || !intervention.isActive) {
        return null;
      }

      // Verificar si aún está activa
      const now = new Date();
      if (now >= intervention.pauseUntil) {
        await this.deactivateIntervention(intervention.id);
        this.interventions.delete(key);
        return null;
      }

      return intervention;
    } catch (error) {
      console.error('❌ Error obteniendo información de intervención:', error);
      return null;
    }
  }

  /**
   * Desactiva intervención existente para un chat específico del usuario
   */
  private async deactivateExistingIntervention(userId: number, accountId: number, chatId: string): Promise<void> {
    try {
      await pool.query(
        'UPDATE chat_interventions SET is_active = false WHERE user_id = $1 AND account_id = $2 AND chat_id = $3 AND is_active = true',
        [userId, accountId, chatId]
      );

      const key = this.generateKey(userId, accountId, chatId);
      this.interventions.delete(key);
    } catch (error) {
      console.error('❌ Error desactivando intervención existente:', error);
    }
  }

  /**
   * Desactiva una intervención específica
   */
  private async deactivateIntervention(interventionId: string): Promise<void> {
    try {
      await pool.query(
        'UPDATE chat_interventions SET is_active = false WHERE id = $1',
        [interventionId]
      );
    } catch (error) {
      console.error('❌ Error desactivando intervención:', error);
    }
  }

  /**
   * Limpia intervenciones expiradas de memoria y base de datos
   */
  private async cleanExpiredInterventions(): Promise<void> {
    try {
      const now = new Date();
      const expiredKeys: string[] = [];

      // Identificar intervenciones expiradas en memoria
      for (const [key, intervention] of this.interventions.entries()) {
        if (now >= intervention.pauseUntil) {
          expiredKeys.push(key);
          await this.deactivateIntervention(intervention.id);
        }
      }

      // Remover de memoria
      expiredKeys.forEach(key => this.interventions.delete(key));

      if (expiredKeys.length > 0) {
        console.log(`🧹 Intervenciones expiradas limpiadas: ${expiredKeys.length}`);
      }

      // Limpiar base de datos
      await pool.query(
        'UPDATE chat_interventions SET is_active = false WHERE is_active = true AND pause_until <= NOW()'
      );

    } catch (error) {
      console.error('❌ Error limpiando intervenciones expiradas:', error);
    }
  }

  /**
   * Obtiene todas las intervenciones activas para un usuario específico
   */
  async getUserActiveInterventions(userId: number): Promise<InterventionRecord[]> {
    try {
      const userInterventions: InterventionRecord[] = [];
      
      for (const intervention of this.interventions.values()) {
        if (intervention.userId === userId && intervention.isActive) {
          const now = new Date();
          if (now < intervention.pauseUntil) {
            userInterventions.push(intervention);
          }
        }
      }

      return userInterventions;
    } catch (error) {
      console.error('❌ Error obteniendo intervenciones del usuario:', error);
      return [];
    }
  }

  /**
   * Forzar fin de intervención (solo para el propietario del chat)
   */
  async endIntervention(userId: number, accountId: number, chatId: string): Promise<boolean> {
    try {
      // Verificar acceso del usuario
      const accountCheck = await pool.query(
        'SELECT id FROM whatsapp_accounts WHERE id = $1 AND user_id = $2',
        [accountId, userId]
      );

      if (accountCheck.rows.length === 0) {
        return false;
      }

      const key = this.generateKey(userId, accountId, chatId);
      const intervention = this.interventions.get(key);

      if (intervention) {
        await this.deactivateIntervention(intervention.id);
        this.interventions.delete(key);
        console.log(`🔓 Intervención finalizada manualmente por usuario ${userId} para chat ${chatId}`);
        return true;
      }

      return false;
    } catch (error) {
      console.error('❌ Error finalizando intervención:', error);
      return false;
    }
  }
}

export const interventionManager = InterventionManager.getInstance();