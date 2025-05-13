import qrcode from 'qrcode-terminal';
import QRCode from 'qrcode';
import { EventEmitter } from 'events';
import { Lead, Message as CRMMessage } from '@shared/schema';
import { storage } from '../storage';
import * as crypto from 'crypto';

interface WhatsAppQRCode {
    qr: string;
    base64Image?: string;
}

/**
 * Servicio simulado para manejar la integración con WhatsApp
 * Para demostración de la autenticación mediante código QR
 */
export class WhatsAppService extends EventEmitter {
    private isReady: boolean = false;
    private qrCode: WhatsAppQRCode | null = null;
    private sessionActive: boolean = false;
    private pendingMessages: Array<{
        to: string;
        message: string;
        leadId?: number;
    }> = [];
    private sessionTimeout: NodeJS.Timeout | null = null;

    constructor() {
        super();
        this.initialize();
    }

    /**
     * Inicializa el cliente simulado de WhatsApp
     */
    private initialize() {
        try {
            console.log('Inicializando WhatsApp (modo simulación)...');
            
            // Generar un código QR aleatorio
            this.generateQRCode();
            
            // Simular que el usuario escanea el QR después de un tiempo aleatorio
            this.sessionTimeout = setTimeout(() => {
                if (!this.sessionActive) {
                    console.log('WhatsApp: simulando autenticación del usuario...');
                    this.sessionActive = true;
                    this.emit('authenticated');
                    
                    // Simular que el cliente está listo
                    setTimeout(() => {
                        console.log('Cliente de WhatsApp listo! (simulado)');
                        this.isReady = true;
                        this.emit('ready');
                        
                        // Procesar mensajes pendientes
                        this.sendPendingMessages();
                    }, 1500);
                }
            }, 15000); // Simular espera de 15 segundos para escaneo
            
        } catch (error) {
            console.error('Error al inicializar WhatsApp (simulado):', error);
            this.emit('error', error);
        }
    }

    /**
     * Genera un código QR aleatorio para la autenticación
     */
    private generateQRCode() {
        // Generar un código único
        const code = crypto.randomBytes(16).toString('hex');
        const qrData = `whatsapp://authenticate/${code}`;
        
        console.log('Generando código QR para WhatsApp (simulado):', code);
        
        // Generar QR para la consola
        qrcode.generate(qrData, { small: true });
        
        // Generar imagen base64 del QR
        QRCode.toDataURL(qrData, (err: any, url: string) => {
            if (err) {
                console.error('Error al generar QR para WhatsApp:', err);
                return;
            }
            
            // Almacenar el código QR para mostrarlo en la interfaz
            this.qrCode = { 
                qr: qrData,
                base64Image: url
            };
            
            // Emitir evento de QR generado
            this.emit('qr', this.qrCode);
        });
    }

    /**
     * Envía los mensajes que quedaron pendientes
     */
    private async sendPendingMessages() {
        if (this.isReady) {
            while (this.pendingMessages.length > 0) {
                const msg = this.pendingMessages.shift();
                if (msg) {
                    await this.sendDirectMessage(msg.to, msg.message, msg.leadId);
                }
            }
        }
    }

    /**
     * Envía un mensaje a un número de WhatsApp (simulado)
     */
    public async sendMessage(phone: string, message: string, leadId?: number) {
        // Normalizar el número de teléfono (eliminar + o espacios)
        const normalizedPhone = phone.replace(/\D/g, '');
        
        if (this.isReady && this.sessionActive) {
            return this.sendDirectMessage(normalizedPhone, message, leadId);
        } else {
            // Si el cliente no está listo, guardar el mensaje para enviarlo después
            this.pendingMessages.push({
                to: normalizedPhone,
                message,
                leadId
            });
            
            return {
                success: false,
                pending: true,
                message: 'Mensaje en cola. El cliente de WhatsApp no está listo.'
            };
        }
    }

    /**
     * Envía un mensaje directamente (simulado)
     */
    private async sendDirectMessage(phone: string, message: string, leadId?: number) {
        try {
            if (!this.isReady) {
                throw new Error('Cliente de WhatsApp no inicializado');
            }
            
            console.log(`Simulando envío de mensaje a ${phone}: ${message}`);
            
            // Guardamos el mensaje en el CRM si se proporcionó un leadId
            if (leadId) {
                await storage.createMessage({
                    leadId,
                    userId: 1, // Usuario del sistema o bot
                    direction: 'outgoing',
                    channel: 'whatsapp',
                    content: message,
                    read: true
                });
            }
            
            // Generar ID de mensaje único
            const messageId = `simulated_${Date.now()}_${crypto.randomBytes(8).toString('hex')}`;
            
            return {
                success: true,
                messageId: messageId,
                timestamp: new Date()
            };
            
        } catch (error: any) {
            console.error('Error al enviar mensaje de WhatsApp (simulado):', error);
            return {
                success: false,
                error: error.message || 'Error desconocido'
            };
        }
    }

    /**
     * Simula recepción de un mensaje
     */
    public simulateIncomingMessage(phone: string, message: string) {
        this.processIncomingMessage(phone, message);
    }

    /**
     * Procesa un mensaje entrante simulado
     */
    private async processIncomingMessage(phone: string, messageText: string) {
        try {
            // Buscar si existe un lead con este número de teléfono
            const leads = await storage.getAllLeads();
            let lead = leads.find(lead => lead.phone === phone || lead.whatsappPhone === phone);
            
            // Si no existe un lead, creamos uno nuevo
            if (!lead) {
                lead = await storage.createLead({
                    fullName: `WhatsApp User ${phone.substring(phone.length - 4)}`,
                    email: `${phone}@whatsapp.placeholder`,
                    phone,
                    whatsappPhone: phone,
                    source: 'whatsapp',
                    status: 'new',
                    assignedTo: 1, // ID del usuario por defecto
                    notes: 'Lead generado automáticamente desde WhatsApp (simulado)'
                });
            }
            
            // Guardar el mensaje en el CRM
            await storage.createMessage({
                leadId: lead.id,
                userId: null, // Mensaje recibido del cliente, no de un usuario del CRM
                direction: 'incoming',
                channel: 'whatsapp',
                content: messageText,
                read: false
            });
            
            // Emitir evento de mensaje recibido
            this.emit('message', {
                from: phone,
                body: messageText,
                timestamp: new Date()
            });
            
        } catch (error) {
            console.error('Error al procesar mensaje de WhatsApp (simulado):', error);
        }
    }

    /**
     * Obtiene el estado actual del cliente
     */
    public getStatus() {
        return {
            initialized: true,
            ready: this.isReady,
            authenticated: this.sessionActive,
            pendingMessages: this.pendingMessages.length
        };
    }

    /**
     * Obtiene el código QR actual para la autenticación
     */
    public getQRCode() {
        return this.qrCode;
    }

    /**
     * Cierra la sesión de WhatsApp (simulado)
     */
    public async logout() {
        this.isReady = false;
        this.sessionActive = false;
        this.qrCode = null;
        
        // Limpiar el timeout si existe
        if (this.sessionTimeout) {
            clearTimeout(this.sessionTimeout);
            this.sessionTimeout = null;
        }
        
        return { success: true };
    }

    /**
     * Reinicia la conexión de WhatsApp (simulado)
     */
    public async restart() {
        // Limpiar el timeout si existe
        if (this.sessionTimeout) {
            clearTimeout(this.sessionTimeout);
            this.sessionTimeout = null;
        }
        
        this.isReady = false;
        this.sessionActive = false;
        this.qrCode = null;
        this.initialize();
        return { success: true };
    }

    /**
     * Genera un QR de ejemplo para el modo de desarrollo
     */
    public generateDemoQR() {
        const demoQR = 'whatsapp://authenticate/demo123456789';
        
        // Generar QR para la consola
        qrcode.generate(demoQR, { small: true });
        
        // Generar imagen base64 del QR
        return new Promise<WhatsAppQRCode>((resolve) => {
            QRCode.toDataURL(demoQR, (err: any, url: string) => {
                const qrData = { qr: demoQR, base64Image: url };
                this.qrCode = qrData;
                this.emit('qr', qrData);
                resolve(qrData);
            });
        });
    }
}

// Exportar como singleton
export const whatsappService = new WhatsAppService();