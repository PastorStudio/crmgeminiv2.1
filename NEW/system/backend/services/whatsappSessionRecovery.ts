/**
 * WhatsApp Session Recovery Service
 * Handles proper cleanup and recovery of WhatsApp sessions to prevent account recreation
 */

import fs from 'fs';
import path from 'path';
import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

export class WhatsAppSessionRecovery {
  private static instance: WhatsAppSessionRecovery;
  private recoveryAttempts: Map<number, number> = new Map();
  private readonly maxRecoveryAttempts = 3;
  private readonly sessionBaseDir = './.wwebjs_auth';

  static getInstance(): WhatsAppSessionRecovery {
    if (!WhatsAppSessionRecovery.instance) {
      WhatsAppSessionRecovery.instance = new WhatsAppSessionRecovery();
    }
    return WhatsAppSessionRecovery.instance;
  }

  /**
   * Performs complete session cleanup for an account
   */
  async cleanupSession(accountId: number): Promise<boolean> {
    try {
      console.log(`🧹 Iniciando limpieza completa de sesión para cuenta ${accountId}`);
      
      const sessionPath = path.join(this.sessionBaseDir, `session-${accountId}`);
      
      // 1. Remove session directory completely
      if (fs.existsSync(sessionPath)) {
        await this.forceRemoveDirectory(sessionPath);
        console.log(`✅ Directorio de sesión eliminado: ${sessionPath}`);
      }

      // 2. Clear any cache files
      const cacheFiles = [
        `./.wwebjs_cache/session-${accountId}*`,
        `./temp/qr-${accountId}*`,
        `./temp/session-${accountId}*`
      ];

      for (const pattern of cacheFiles) {
        try {
          await execAsync(`rm -rf ${pattern}`);
        } catch (error) {
          // Silent cleanup - files may not exist
        }
      }

      // 3. Reset recovery attempt counter
      this.recoveryAttempts.set(accountId, 0);
      
      console.log(`✅ Limpieza completa terminada para cuenta ${accountId}`);
      return true;
    } catch (error) {
      console.error(`❌ Error en limpieza de sesión para cuenta ${accountId}:`, error);
      return false;
    }
  }

  /**
   * Attempts session recovery before full cleanup
   */
  async attemptRecovery(accountId: number): Promise<'recovered' | 'cleanup_needed' | 'failed'> {
    try {
      const attempts = this.recoveryAttempts.get(accountId) || 0;
      
      if (attempts >= this.maxRecoveryAttempts) {
        console.log(`⚠️ Máximo de intentos de recuperación alcanzado para cuenta ${accountId}`);
        return 'cleanup_needed';
      }

      console.log(`🔄 Intento de recuperación ${attempts + 1}/${this.maxRecoveryAttempts} para cuenta ${accountId}`);
      this.recoveryAttempts.set(accountId, attempts + 1);

      const sessionPath = path.join(this.sessionBaseDir, `session-${accountId}`);
      
      // Check if session files are corrupted
      if (await this.isSessionCorrupted(sessionPath)) {
        console.log(`💀 Sesión corrupta detectada para cuenta ${accountId}`);
        return 'cleanup_needed';
      }

      // Attempt to recover by fixing permissions
      if (fs.existsSync(sessionPath)) {
        await execAsync(`chmod -R 755 ${sessionPath}`);
        console.log(`🔧 Permisos corregidos para cuenta ${accountId}`);
        return 'recovered';
      }

      return 'cleanup_needed';
    } catch (error) {
      console.error(`❌ Error en recuperación para cuenta ${accountId}:`, error);
      return 'failed';
    }
  }

  /**
   * Checks if session directory is corrupted
   */
  private async isSessionCorrupted(sessionPath: string): Promise<boolean> {
    try {
      if (!fs.existsSync(sessionPath)) {
        return false; // Not corrupted, just doesn't exist
      }

      // Check for lock files that indicate corruption
      const lockFiles = ['SingletonLock', '.lock'];
      for (const lockFile of lockFiles) {
        const lockPath = path.join(sessionPath, lockFile);
        if (fs.existsSync(lockPath)) {
          console.log(`🔒 Lock file detectado: ${lockPath}`);
          return true;
        }
      }

      // Check if main session files exist
      const requiredFiles = ['Default', 'Local State'];
      for (const file of requiredFiles) {
        const filePath = path.join(sessionPath, file);
        if (!fs.existsSync(filePath)) {
          console.log(`❌ Archivo de sesión faltante: ${filePath}`);
          return true;
        }
      }

      return false;
    } catch (error) {
      console.error(`Error verificando corrupción de sesión:`, error);
      return true; // Assume corrupted if we can't check
    }
  }

  /**
   * Forces removal of directory even if locked
   */
  private async forceRemoveDirectory(dirPath: string): Promise<void> {
    try {
      // First try normal removal
      if (fs.existsSync(dirPath)) {
        fs.rmSync(dirPath, { recursive: true, force: true });
      }
    } catch (error) {
      // If normal removal fails, use system commands
      try {
        await execAsync(`rm -rf "${dirPath}"`);
      } catch (cmdError) {
        // Last resort - try to unlock and remove
        try {
          await execAsync(`chmod -R 777 "${dirPath}" && rm -rf "${dirPath}"`);
        } catch (finalError) {
          console.error(`No se pudo eliminar directorio ${dirPath}:`, finalError);
          throw finalError;
        }
      }
    }
  }

  /**
   * Prepares account for fresh connection
   */
  async prepareForFreshConnection(accountId: number): Promise<boolean> {
    try {
      console.log(`🚀 Preparando cuenta ${accountId} para conexión fresca`);
      
      // Full cleanup
      const cleanupSuccess = await this.cleanupSession(accountId);
      if (!cleanupSuccess) {
        return false;
      }

      // Create fresh session directory with proper permissions
      const sessionPath = path.join(this.sessionBaseDir, `session-${accountId}`);
      if (!fs.existsSync(this.sessionBaseDir)) {
        fs.mkdirSync(this.sessionBaseDir, { recursive: true });
      }

      // Reset recovery attempts
      this.recoveryAttempts.delete(accountId);
      
      console.log(`✅ Cuenta ${accountId} preparada para conexión fresca`);
      return true;
    } catch (error) {
      console.error(`❌ Error preparando cuenta ${accountId}:`, error);
      return false;
    }
  }

  /**
   * Gets recovery status for an account
   */
  getRecoveryStatus(accountId: number): {
    attempts: number;
    canRecover: boolean;
    needsCleanup: boolean;
  } {
    const attempts = this.recoveryAttempts.get(accountId) || 0;
    return {
      attempts,
      canRecover: attempts < this.maxRecoveryAttempts,
      needsCleanup: attempts >= this.maxRecoveryAttempts
    };
  }

  /**
   * Emergency cleanup for all sessions
   */
  async emergencyCleanupAll(): Promise<boolean> {
    try {
      console.log(`🚨 Iniciando limpieza de emergencia de todas las sesiones`);
      
      // Clear all session directories
      if (fs.existsSync(this.sessionBaseDir)) {
        await this.forceRemoveDirectory(this.sessionBaseDir);
      }

      // Clear cache
      await execAsync(`rm -rf ./.wwebjs_cache/*`);
      await execAsync(`rm -rf ./temp/qr-*`);
      await execAsync(`rm -rf ./temp/session-*`);

      // Reset all counters
      this.recoveryAttempts.clear();
      
      console.log(`✅ Limpieza de emergencia completada`);
      return true;
    } catch (error) {
      console.error(`❌ Error en limpieza de emergencia:`, error);
      return false;
    }
  }
}

export const sessionRecovery = WhatsAppSessionRecovery.getInstance();