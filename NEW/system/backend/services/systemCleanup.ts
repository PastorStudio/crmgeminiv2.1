/**
 * Servicio de limpieza completa del sistema
 * Elimina todas las cachés, sesiones y residuos de conexiones WhatsApp
 */

import fs from 'fs';
import path from 'path';
import { storage } from '../storage';

class SystemCleanupService {
  
  /**
   * Realiza una limpieza completa del sistema
   */
  async performCompleteCleanup(): Promise<{
    success: boolean;
    cleanedItems: string[];
    errors: string[];
  }> {
    const cleanedItems: string[] = [];
    const errors: string[] = [];

    try {
      console.log('🧹 Iniciando limpieza completa del sistema...');

      // 1. Limpiar sesiones de WhatsApp
      await this.cleanWhatsAppSessions(cleanedItems, errors);

      // 2. Limpiar archivos temporales
      await this.cleanTempFiles(cleanedItems, errors);

      // 3. Limpiar códigos QR almacenados
      await this.cleanQRCodes(cleanedItems, errors);

      // 4. Limpiar cachés de navegador
      await this.cleanBrowserCache(cleanedItems, errors);

      // 5. Resetear estados en base de datos
      await this.resetDatabaseStates(cleanedItems, errors);

      // 6. Limpiar logs antiguos
      await this.cleanOldLogs(cleanedItems, errors);

      // 7. Limpiar archivos de sesión de Node.js
      await this.cleanNodeSessions(cleanedItems, errors);

      console.log(`✅ Limpieza completa finalizada. ${cleanedItems.length} elementos limpiados, ${errors.length} errores`);

      return {
        success: errors.length === 0,
        cleanedItems,
        errors
      };

    } catch (error) {
      console.error('❌ Error durante la limpieza completa:', error);
      errors.push(`Error general: ${error.message}`);
      
      return {
        success: false,
        cleanedItems,
        errors
      };
    }
  }

  /**
   * Limpia todas las sesiones de WhatsApp
   */
  private async cleanWhatsAppSessions(cleanedItems: string[], errors: string[]): Promise<void> {
    try {
      const sessionsDir = path.join(process.cwd(), 'temp', 'whatsapp-accounts');
      
      if (fs.existsSync(sessionsDir)) {
        const accounts = fs.readdirSync(sessionsDir);
        
        for (const account of accounts) {
          const accountDir = path.join(sessionsDir, account);
          if (fs.statSync(accountDir).isDirectory()) {
            await this.removeDirectory(accountDir);
            cleanedItems.push(`Sesión WhatsApp: ${account}`);
          }
        }
      }

      // Crear directorio limpio
      if (!fs.existsSync(sessionsDir)) {
        fs.mkdirSync(sessionsDir, { recursive: true });
      }

    } catch (error) {
      errors.push(`Error limpiando sesiones WhatsApp: ${error.message}`);
    }
  }

  /**
   * Limpia archivos temporales
   */
  private async cleanTempFiles(cleanedItems: string[], errors: string[]): Promise<void> {
    try {
      const tempDirs = [
        path.join(process.cwd(), 'temp'),
        path.join(process.cwd(), '.wwebjs_auth'),
        path.join(process.cwd(), '.wwebjs_cache'),
        '/tmp/puppeteer_profiles',
        '/tmp/whatsapp_sessions'
      ];

      for (const tempDir of tempDirs) {
        if (fs.existsSync(tempDir)) {
          const files = fs.readdirSync(tempDir);
          for (const file of files) {
            const filePath = path.join(tempDir, file);
            try {
              if (fs.statSync(filePath).isDirectory()) {
                await this.removeDirectory(filePath);
              } else {
                fs.unlinkSync(filePath);
              }
              cleanedItems.push(`Archivo temporal: ${file}`);
            } catch (fileError) {
              // Continuar con otros archivos
            }
          }
        }
      }

    } catch (error) {
      errors.push(`Error limpiando archivos temporales: ${error.message}`);
    }
  }

  /**
   * Limpia códigos QR almacenados
   */
  private async cleanQRCodes(cleanedItems: string[], errors: string[]): Promise<void> {
    try {
      const qrPaths = [
        path.join(process.cwd(), 'temp', 'qr-codes'),
        path.join(process.cwd(), 'qr-codes'),
        path.join(process.cwd(), 'temp', 'whatsapp-qr')
      ];

      for (const qrPath of qrPaths) {
        if (fs.existsSync(qrPath)) {
          await this.removeDirectory(qrPath);
          cleanedItems.push(`Códigos QR: ${path.basename(qrPath)}`);
        }
      }

    } catch (error) {
      errors.push(`Error limpiando códigos QR: ${error.message}`);
    }
  }

  /**
   * Limpia cachés del navegador
   */
  private async cleanBrowserCache(cleanedItems: string[], errors: string[]): Promise<void> {
    try {
      const cachePaths = [
        path.join(require('os').homedir(), '.cache', 'puppeteer'),
        path.join(require('os').homedir(), '.config', 'chromium'),
        '/tmp/.org.chromium.Chromium.*',
        '/dev/shm/chromium*'
      ];

      for (const cachePath of cachePaths) {
        if (cachePath.includes('*')) {
          // Manejar patrones con wildcard
          const basePath = cachePath.split('*')[0];
          const baseDir = path.dirname(basePath);
          const pattern = path.basename(basePath);
          
          if (fs.existsSync(baseDir)) {
            const files = fs.readdirSync(baseDir);
            for (const file of files) {
              if (file.startsWith(pattern.replace('*', ''))) {
                const fullPath = path.join(baseDir, file);
                try {
                  if (fs.statSync(fullPath).isDirectory()) {
                    await this.removeDirectory(fullPath);
                  } else {
                    fs.unlinkSync(fullPath);
                  }
                  cleanedItems.push(`Cache navegador: ${file}`);
                } catch (fileError) {
                  // Continuar con otros archivos
                }
              }
            }
          }
        } else if (fs.existsSync(cachePath)) {
          await this.removeDirectory(cachePath);
          cleanedItems.push(`Cache navegador: ${path.basename(cachePath)}`);
        }
      }

    } catch (error) {
      errors.push(`Error limpiando cache del navegador: ${error.message}`);
    }
  }

  /**
   * Resetea estados en la base de datos
   */
  private async resetDatabaseStates(cleanedItems: string[], errors: string[]): Promise<void> {
    try {
      // Resetear estados de cuentas WhatsApp
      const accounts = await storage.getAllWhatsappAccounts();
      
      for (const account of accounts) {
        await storage.updateWhatsappAccount(account.id, {
          status: 'inactive',
          sessionData: null,
          lastActiveAt: null
        });
      }
      
      cleanedItems.push(`Estados de base de datos: ${accounts.length} cuentas reseteadas`);

    } catch (error) {
      errors.push(`Error reseteando estados de base de datos: ${error.message}`);
    }
  }

  /**
   * Limpia logs antiguos
   */
  private async cleanOldLogs(cleanedItems: string[], errors: string[]): Promise<void> {
    try {
      const logPaths = [
        path.join(process.cwd(), 'logs'),
        path.join(process.cwd(), 'temp', 'logs'),
        '/tmp/whatsapp-logs'
      ];

      for (const logPath of logPaths) {
        if (fs.existsSync(logPath)) {
          const files = fs.readdirSync(logPath);
          for (const file of files) {
            const filePath = path.join(logPath, file);
            const stats = fs.statSync(filePath);
            
            // Eliminar logs más antiguos de 24 horas
            const ageHours = (Date.now() - stats.mtime.getTime()) / (1000 * 60 * 60);
            if (ageHours > 24) {
              fs.unlinkSync(filePath);
              cleanedItems.push(`Log antiguo: ${file}`);
            }
          }
        }
      }

    } catch (error) {
      errors.push(`Error limpiando logs antiguos: ${error.message}`);
    }
  }

  /**
   * Limpia sesiones de Node.js
   */
  private async cleanNodeSessions(cleanedItems: string[], errors: string[]): Promise<void> {
    try {
      const sessionPaths = [
        path.join(process.cwd(), 'sessions'),
        path.join(process.cwd(), 'node_sessions'),
        '/tmp/express-sessions'
      ];

      for (const sessionPath of sessionPaths) {
        if (fs.existsSync(sessionPath)) {
          await this.removeDirectory(sessionPath);
          cleanedItems.push(`Sesiones Node.js: ${path.basename(sessionPath)}`);
        }
      }

    } catch (error) {
      errors.push(`Error limpiando sesiones Node.js: ${error.message}`);
    }
  }

  /**
   * Elimina un directorio recursivamente
   */
  private async removeDirectory(dirPath: string): Promise<void> {
    if (!fs.existsSync(dirPath)) return;

    const files = fs.readdirSync(dirPath);
    
    for (const file of files) {
      const filePath = path.join(dirPath, file);
      const stat = fs.statSync(filePath);
      
      if (stat.isDirectory()) {
        await this.removeDirectory(filePath);
      } else {
        try {
          fs.unlinkSync(filePath);
        } catch (error) {
          // Continuar con otros archivos si uno falla
        }
      }
    }
    
    try {
      fs.rmdirSync(dirPath);
    } catch (error) {
      // El directorio puede no estar vacío o tener permisos especiales
    }
  }

  /**
   * Limpieza rápida para reiniciar conexiones
   */
  async quickCleanup(): Promise<{ success: boolean; message: string }> {
    try {
      console.log('⚡ Realizando limpieza rápida...');

      // Limpiar solo sesiones críticas
      const sessionsDir = path.join(process.cwd(), 'temp', 'whatsapp-accounts');
      if (fs.existsSync(sessionsDir)) {
        await this.removeDirectory(sessionsDir);
        fs.mkdirSync(sessionsDir, { recursive: true });
      }

      // Resetear estados en base de datos
      const accounts = await storage.getAllWhatsappAccounts();
      for (const account of accounts) {
        await storage.updateWhatsappAccount(account.id, {
          status: 'inactive',
          sessionData: null
        });
      }

      return {
        success: true,
        message: `Limpieza rápida completada. ${accounts.length} conexiones reseteadas.`
      };

    } catch (error) {
      return {
        success: false,
        message: `Error en limpieza rápida: ${error.message}`
      };
    }
  }
}

export const systemCleanupService = new SystemCleanupService();