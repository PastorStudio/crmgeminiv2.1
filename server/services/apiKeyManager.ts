import fs from 'fs';
import path from 'path';
import crypto from 'crypto';

/**
 * Servicio para gestionar las claves API de Gemini
 * - Genera claves temporales para desarrollo
 * - Almacena las claves de forma segura
 * - Actualiza y rota las claves automáticamente
 */
export class ApiKeyManager {
  private configPath: string;
  private apiKeys: {
    gemini: {
      key: string;
      expiry?: Date;
      isTemporary: boolean;
    }
  };

  constructor() {
    this.configPath = path.join(process.cwd(), '.api-keys.json');
    this.apiKeys = {
      gemini: {
        key: '',
        isTemporary: false
      }
    };
    this.loadKeys();
  }

  /**
   * Carga las claves API almacenadas o genera unas nuevas si no existen
   */
  private loadKeys(): void {
    try {
      if (fs.existsSync(this.configPath)) {
        const data = fs.readFileSync(this.configPath, 'utf8');
        const keys = JSON.parse(data);
        this.apiKeys = keys;

        // Verificar si hay una clave de entorno que tenga prioridad
        if (process.env.GEMINI_API_KEY) {
          this.apiKeys.gemini.key = process.env.GEMINI_API_KEY;
          this.apiKeys.gemini.isTemporary = false;
        }
      } else {
        // Verificar si hay una clave de entorno
        if (process.env.GEMINI_API_KEY) {
          this.apiKeys.gemini.key = process.env.GEMINI_API_KEY;
          this.apiKeys.gemini.isTemporary = false;
        } else {
          // Generar una clave temporal para desarrollo
          this.generateTemporaryKey();
        }
        this.saveKeys();
      }
    } catch (error) {
      console.error('Error al cargar las claves API:', error);
      this.generateTemporaryKey();
    }
  }

  /**
   * Guarda las claves API en un archivo
   */
  private saveKeys(): void {
    try {
      fs.writeFileSync(this.configPath, JSON.stringify(this.apiKeys, null, 2));
    } catch (error) {
      console.error('Error al guardar las claves API:', error);
    }
  }

  /**
   * Genera una clave temporal para uso de desarrollo
   * Nota: En un entorno de producción real, esto se conectaría con el servicio de Google
   * para obtener una clave válida usando OAuth2 o similar
   */
  private generateTemporaryKey(): void {
    // En un entorno real, esta función haría una llamada a la API de Google
    // para solicitar una clave API temporal con los permisos adecuados
    
    // Para desarrollo, generamos una clave aleatoria
    const tempKey = 'DEV-' + crypto.randomBytes(16).toString('hex');
    
    // Establecer una fecha de expiración (24 horas desde ahora)
    const expiry = new Date();
    expiry.setHours(expiry.getHours() + 24);
    
    this.apiKeys.gemini.key = tempKey;
    this.apiKeys.gemini.expiry = expiry;
    this.apiKeys.gemini.isTemporary = true;
    
    console.log('Se generó una clave API temporal para Gemini. Esta clave solo es para desarrollo.');
  }

  /**
   * Actualiza la clave API de Gemini
   */
  public updateGeminiKey(newKey: string): void {
    this.apiKeys.gemini.key = newKey;
    this.apiKeys.gemini.isTemporary = false;
    delete this.apiKeys.gemini.expiry; // Eliminar fecha de expiración si existe
    this.saveKeys();
  }

  /**
   * Obtiene la clave API de Gemini
   */
  public getGeminiKey(): string {
    // Verificar si la clave está expirada (si es temporal)
    if (this.apiKeys.gemini.isTemporary && this.apiKeys.gemini.expiry) {
      const now = new Date();
      if (now > new Date(this.apiKeys.gemini.expiry)) {
        this.generateTemporaryKey();
        this.saveKeys();
      }
    }
    
    return this.apiKeys.gemini.key;
  }

  /**
   * Verifica si hay una clave API válida para Gemini
   */
  public hasValidGeminiKey(): boolean {
    return !!this.apiKeys.gemini.key && 
           (!this.apiKeys.gemini.isTemporary || 
            (this.apiKeys.gemini.expiry && new Date() < new Date(this.apiKeys.gemini.expiry)));
  }

  /**
   * Verifica si estamos usando una clave de desarrollo temporal
   */
  public isUsingTemporaryKey(): boolean {
    return this.apiKeys.gemini.isTemporary;
  }
}

// Exportar una instancia singleton
export const apiKeyManager = new ApiKeyManager();