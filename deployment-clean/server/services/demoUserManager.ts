/**
 * Demo User Management System
 * Creates and manages temporary demo users with 1-day expiration
 */

import { db } from '../db';
import { demoUsers, users } from '@shared/schema';
import { eq, lt } from 'drizzle-orm';
import bcrypt from 'bcrypt';

interface DemoUserConfig {
  customerName: string;
  phoneNumber?: string;
  chatId?: string;
  email?: string;
  companyName?: string;
}

interface DemoUserResult {
  id: number;
  username: string;
  password: string;
  customerName: string;
  loginUrl: string;
  expiresAt: Date;
  status: string;
}

class DemoUserManager {
  /**
   * Crea un usuario demo con credenciales temporales por 1 día
   */
  async createDemoUser(config: DemoUserConfig): Promise<DemoUserResult> {
    try {
      console.log(`🎭 Creando usuario demo para: ${config.customerName}`);

      // Generar credenciales únicas
      const timestamp = Date.now();
      const randomSuffix = Math.random().toString(36).substring(2, 8);
      const username = `demo_${config.customerName.toLowerCase().replace(/[^a-z0-9]/g, '_')}_${randomSuffix}`;
      const password = `demo${Math.random().toString(36).substring(2, 10)}`;
      
      // Encriptar contraseña
      const hashedPassword = await bcrypt.hash(password, 10);

      // Establecer expiración a 1 día (24 horas)
      const expiresAt = new Date();
      expiresAt.setDate(expiresAt.getDate() + 1);

      // Crear registro en demo_users
      const [demoUser] = await db.insert(demoUsers).values({
        customerName: config.customerName,
        phoneNumber: config.phoneNumber || '',
        username,
        password: hashedPassword, // Guardar hash en demo_users
        chatId: config.chatId || '',
        expiresAt,
        status: 'active',
        createdBy: 'system'
      }).returning();

      // Crear usuario real en la tabla users con rol demo
      const [realUser] = await db.insert(users).values({
        username,
        password: hashedPassword,
        email: config.email || `${username}@demo.local`,
        fullName: config.customerName,
        role: 'demo',
        organizationId: 1, // Organización demo por defecto
        isActive: true,
        createdAt: new Date(),
        updatedAt: new Date()
      }).returning();

      console.log(`✅ Usuario demo creado: ${username} (ID: ${demoUser.id})`);
      console.log(`⏰ Expira el: ${expiresAt.toLocaleString()}`);

      return {
        id: demoUser.id,
        username,
        password, // Devolver contraseña sin encriptar para el usuario
        customerName: config.customerName,
        loginUrl: `/demo-login`,
        expiresAt,
        status: 'active'
      };
    } catch (error) {
      console.error('❌ Error creando usuario demo:', error);
      throw new Error('Error al crear usuario demo');
    }
  }

  /**
   * Verifica credenciales de usuario demo
   */
  async verifyDemoUser(username: string, password: string): Promise<any | null> {
    try {
      console.log(`🔐 Verificando credenciales demo para: ${username}`);

      // Buscar usuario demo
      const [demoUser] = await db.select()
        .from(demoUsers)
        .where(eq(demoUsers.username, username))
        .limit(1);

      if (!demoUser) {
        console.log(`❌ Usuario demo no encontrado: ${username}`);
        return null;
      }

      // Verificar si ha expirado
      if (new Date() > demoUser.expiresAt) {
        console.log(`⏰ Usuario demo expirado: ${username}`);
        await this.deactivateDemoUser(demoUser.id);
        return null;
      }

      // Verificar contraseña
      const isPasswordValid = await bcrypt.compare(password, demoUser.password);
      if (!isPasswordValid) {
        console.log(`❌ Contraseña incorrecta para usuario demo: ${username}`);
        return null;
      }

      // Buscar usuario real para sesión
      const [realUser] = await db.select()
        .from(users)
        .where(eq(users.username, username))
        .limit(1);

      if (!realUser || !realUser.isActive) {
        console.log(`❌ Usuario real no encontrado o inactivo: ${username}`);
        return null;
      }

      console.log(`✅ Usuario demo verificado exitosamente: ${username}`);
      
      return {
        id: realUser.id,
        username: realUser.username,
        email: realUser.email,
        fullName: realUser.fullName,
        role: realUser.role,
        organizationId: realUser.organizationId,
        demoUserId: demoUser.id,
        expiresAt: demoUser.expiresAt,
        isDemo: true
      };
    } catch (error) {
      console.error('❌ Error verificando usuario demo:', error);
      return null;
    }
  }

  /**
   * Desactiva usuario demo y elimina acceso
   */
  async deactivateDemoUser(demoUserId: number): Promise<boolean> {
    try {
      console.log(`🔒 Desactivando usuario demo ID: ${demoUserId}`);

      // Obtener información del usuario demo
      const [demoUser] = await db.select()
        .from(demoUsers)
        .where(eq(demoUsers.id, demoUserId))
        .limit(1);

      if (!demoUser) {
        console.log(`❌ Usuario demo no encontrado: ${demoUserId}`);
        return false;
      }

      // Actualizar estado a expirado en demo_users
      await db.update(demoUsers)
        .set({ 
          status: 'expired',
          updatedAt: new Date()
        })
        .where(eq(demoUsers.id, demoUserId));

      // Desactivar usuario real
      await db.update(users)
        .set({ 
          isActive: false,
          updatedAt: new Date()
        })
        .where(eq(users.username, demoUser.username));

      console.log(`✅ Usuario demo desactivado: ${demoUser.username}`);
      return true;
    } catch (error) {
      console.error('❌ Error desactivando usuario demo:', error);
      return false;
    }
  }

  /**
   * Limpia usuarios demo expirados automáticamente
   */
  async cleanupExpiredDemoUsers(): Promise<number> {
    try {
      console.log('🧹 Iniciando limpieza de usuarios demo expirados...');

      // Buscar usuarios demo expirados
      const expiredUsers = await db.select()
        .from(demoUsers)
        .where(lt(demoUsers.expiresAt, new Date()));

      let cleanedCount = 0;

      for (const expiredUser of expiredUsers) {
        const success = await this.deactivateDemoUser(expiredUser.id);
        if (success) {
          cleanedCount++;
        }
      }

      console.log(`✅ Limpieza completada: ${cleanedCount} usuarios demo desactivados`);
      return cleanedCount;
    } catch (error) {
      console.error('❌ Error en limpieza de usuarios demo:', error);
      return 0;
    }
  }

  /**
   * Obtiene lista de usuarios demo activos
   */
  async getActiveDemoUsers(): Promise<any[]> {
    try {
      const activeUsers = await db.select({
        id: demoUsers.id,
        username: demoUsers.username,
        customerName: demoUsers.customerName,
        phoneNumber: demoUsers.phoneNumber,
        createdAt: demoUsers.createdAt,
        expiresAt: demoUsers.expiresAt,
        status: demoUsers.status
      })
      .from(demoUsers)
      .where(eq(demoUsers.status, 'active'));

      return activeUsers.map(user => ({
        ...user,
        timeRemaining: this.getTimeRemaining(user.expiresAt),
        isExpired: new Date() > user.expiresAt
      }));
    } catch (error) {
      console.error('❌ Error obteniendo usuarios demo activos:', error);
      return [];
    }
  }

  /**
   * Calcula tiempo restante para expiración
   */
  private getTimeRemaining(expiresAt: Date): string {
    const now = new Date();
    const timeLeft = expiresAt.getTime() - now.getTime();
    
    if (timeLeft <= 0) {
      return 'Expirado';
    }

    const hours = Math.floor(timeLeft / (1000 * 60 * 60));
    const minutes = Math.floor((timeLeft % (1000 * 60 * 60)) / (1000 * 60));

    if (hours > 0) {
      return `${hours}h ${minutes}m`;
    } else {
      return `${minutes}m`;
    }
  }

  /**
   * Programa limpieza automática cada hora
   */
  startAutomaticCleanup(): void {
    console.log('🔄 Iniciando limpieza automática de usuarios demo cada hora...');
    
    // Ejecutar limpieza inmediatamente
    this.cleanupExpiredDemoUsers();
    
    // Programar limpieza cada hora
    setInterval(async () => {
      await this.cleanupExpiredDemoUsers();
    }, 60 * 60 * 1000); // 1 hora
  }

  /**
   * Obtiene estadísticas de usuarios demo
   */
  async getDemoUserStats(): Promise<any> {
    try {
      const allDemoUsers = await db.select()
        .from(demoUsers);

      const stats = {
        total: allDemoUsers.length,
        active: allDemoUsers.filter(u => u.status === 'active' && new Date() <= u.expiresAt).length,
        expired: allDemoUsers.filter(u => u.status === 'expired' || new Date() > u.expiresAt).length,
        createdToday: allDemoUsers.filter(u => {
          const today = new Date();
          const created = new Date(u.createdAt);
          return created.toDateString() === today.toDateString();
        }).length
      };

      return stats;
    } catch (error) {
      console.error('❌ Error obteniendo estadísticas de usuarios demo:', error);
      return { total: 0, active: 0, expired: 0, createdToday: 0 };
    }
  }
}

export const demoUserManager = new DemoUserManager();