/**
 * Servicio de integración para automatización de agentes externos usando Python/Selenium
 * Este servicio actúa como puente entre el sistema Node.js y el script de Python
 */

import { spawn } from 'child_process';
import path from 'path';

interface SeleniumResponse {
  success: boolean;
  response?: string;
  error?: string;
  agent_type?: string;
  agent_id?: string;
  timestamp?: number;
}

export class SeleniumIntegrationService {
  private static instance: SeleniumIntegrationService;
  private pythonScriptPath: string;

  constructor() {
    this.pythonScriptPath = path.join(process.cwd(), 'server', 'services', 'seleniumAgentService.py');
  }

  static getInstance(): SeleniumIntegrationService {
    if (!SeleniumIntegrationService.instance) {
      SeleniumIntegrationService.instance = new SeleniumIntegrationService();
    }
    return SeleniumIntegrationService.instance;
  }

  /**
   * Obtener respuesta de un agente externo usando web scraping
   */
  async getAgentResponse(agentUrl: string, message: string, agentId?: string): Promise<SeleniumResponse> {
    return new Promise((resolve) => {
      try {
        console.log(`🤖 Iniciando web scraping para agente: ${agentUrl}`);
        
        const args = [this.pythonScriptPath, agentUrl, message];
        if (agentId) {
          args.push(agentId);
        }

        const pythonProcess = spawn('python3', args, {
          stdio: ['pipe', 'pipe', 'pipe'],
          timeout: 60000 // 60 segundos timeout
        });

        let stdout = '';
        let stderr = '';

        pythonProcess.stdout.on('data', (data) => {
          stdout += data.toString();
        });

        pythonProcess.stderr.on('data', (data) => {
          stderr += data.toString();
        });

        pythonProcess.on('close', (code) => {
          if (code === 0) {
            try {
              const result = JSON.parse(stdout);
              console.log(`✅ Respuesta obtenida del agente externo: ${result.response?.substring(0, 100)}...`);
              resolve(result);
            } catch (parseError) {
              console.error('❌ Error parseando respuesta JSON:', parseError);
              resolve({
                success: false,
                error: `Error parseando respuesta: ${parseError}`
              });
            }
          } else {
            console.error(`❌ Proceso Python terminó con código: ${code}`);
            console.error(`Stderr: ${stderr}`);
            resolve({
              success: false,
              error: `Proceso terminó con código ${code}: ${stderr}`
            });
          }
        });

        pythonProcess.on('error', (error) => {
          console.error('❌ Error ejecutando proceso Python:', error);
          resolve({
            success: false,
            error: `Error ejecutando Python: ${error.message}`
          });
        });

        // Timeout manual
        setTimeout(() => {
          pythonProcess.kill();
          resolve({
            success: false,
            error: 'Timeout: El proceso tardó más de 60 segundos'
          });
        }, 60000);

      } catch (error) {
        console.error('❌ Error general en getAgentResponse:', error);
        resolve({
          success: false,
          error: `Error general: ${error}`
        });
      }
    });
  }

  /**
   * Verificar si el servicio de Python está disponible
   */
  async isAvailable(): Promise<boolean> {
    return new Promise((resolve) => {
      try {
        const pythonProcess = spawn('python3', ['--version'], {
          stdio: ['pipe', 'pipe', 'pipe'],
          timeout: 5000
        });

        pythonProcess.on('close', (code) => {
          resolve(code === 0);
        });

        pythonProcess.on('error', () => {
          resolve(false);
        });

        setTimeout(() => {
          pythonProcess.kill();
          resolve(false);
        }, 5000);

      } catch (error) {
        resolve(false);
      }
    });
  }

  /**
   * Obtener respuesta con reintentos automáticos
   */
  async getAgentResponseWithRetry(
    agentUrl: string, 
    message: string, 
    agentId?: string, 
    maxRetries: number = 2
  ): Promise<SeleniumResponse> {
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      console.log(`🔄 Intento ${attempt}/${maxRetries} para agente: ${agentUrl}`);
      
      const result = await this.getAgentResponse(agentUrl, message, agentId);
      
      if (result.success && result.response) {
        console.log(`✅ Éxito en intento ${attempt}`);
        return result;
      }
      
      if (attempt < maxRetries) {
        console.log(`⚠️ Intento ${attempt} falló, reintentando en 3 segundos...`);
        await new Promise(resolve => setTimeout(resolve, 3000));
      }
    }
    
    console.log(`❌ Todos los intentos fallaron para agente: ${agentUrl}`);
    return {
      success: false,
      error: `Fallaron todos los ${maxRetries} intentos`
    };
  }
}

// Instancia singleton
export const seleniumIntegration = SeleniumIntegrationService.getInstance();