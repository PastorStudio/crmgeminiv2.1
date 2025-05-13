import { Client, Message } from 'whatsapp-web.js';
import qrcode from 'qrcode-terminal';
import { EventEmitter } from 'events';
import { Lead, Message as CRMMessage } from '@shared/schema';
import { storage } from '../storage';

interface WhatsAppQRCode {
    qr: string;
    base64Image?: string;
}

/**
 * Servicio para manejar la integración con WhatsApp
 * Permite la autenticación mediante código QR y el envío/recepción de mensajes
 */
export class WhatsAppService extends EventEmitter {
    private client: Client | null = null;
    private isReady: boolean = false;
    private qrCode: WhatsAppQRCode | null = null;
    private sessionActive: boolean = false;
    private pendingMessages: Array<{
        to: string;
        message: string;
        leadId?: number;
    }> = [];

    constructor() {
        super();
        this.initialize();
    }

    /**
     * Inicializa el cliente de WhatsApp
     */
    private initialize() {
        try {
            console.log('Inicializando WhatsApp...');
            
            // Crear instancia del cliente
            this.client = new Client({
                puppeteer: {
                    args: [
                        '--no-sandbox',
                        '--disable-setuid-sandbox',
                        '--disable-dev-shm-usage',
                        '--disable-accelerated-2d-canvas',
                        '--no-first-run',
                        '--no-zygote',
                        '--single-process',
                        '--disable-gpu'
                    ],
                }
            });

            // Manejar evento de código QR
            this.client.on('qr', (qr) => {
                console.log('Código QR recibido para WhatsApp:');
                
                // Generar QR para la consola
                qrcode.generate(qr, { small: true });
                
                // Almacenar el código QR para mostrarlo en la interfaz
                this.qrCode = { qr };
                
                // Emitir evento de QR generado
                this.emit('qr', qr);
            });

            // Manejar evento de autenticación
            this.client.on('authenticated', () => {
                console.log('WhatsApp autenticado!');
                this.sessionActive = true;
                this.emit('authenticated');
            });

            // Manejar evento de cliente listo
            this.client.on('ready', () => {
                console.log('Cliente de WhatsApp listo!');
                this.isReady = true;
                this.emit('ready');
                
                // Enviar mensajes pendientes
                this.sendPendingMessages();
            });

            // Manejar evento de desconexión
            this.client.on('disconnected', (reason) => {
                console.log('Cliente de WhatsApp desconectado:', reason);
                this.isReady = false;
                this.sessionActive = false;
                this.emit('disconnected', reason);
                
                // Reinicializar cliente tras desconexión
                setTimeout(() => {
                    this.initialize();
                }, 5000);
            });

            // Manejar evento de mensaje recibido
            this.client.on('message', async (message: Message) => {
                if (message.from.endsWith('@c.us')) { // Verificar que es un mensaje de un chat privado
                    console.log('Mensaje recibido de WhatsApp:', message.body);
                    
                    // Aquí procesamos el mensaje y lo guardamos en el CRM
                    await this.processIncomingMessage(message);
                    
                    this.emit('message', message);
                }
            });

            // Iniciar el cliente
            this.client.initialize();
            
        } catch (error) {
            console.error('Error al inicializar WhatsApp:', error);
            this.emit('error', error);
        }
    }

    /**
     * Procesa un mensaje entrante de WhatsApp y lo guarda en el CRM
     */
    private async processIncomingMessage(message: Message) {
        try {
            const phone = message.from.replace('@c.us', '');
            
            // Buscar si existe un lead con este número de teléfono
            const leads = await storage.getAllLeads();
            let lead = leads.find(lead => lead.phone === phone);
            
            // Si no existe un lead, creamos uno nuevo
            if (!lead) {
                const contact = await message.getContact();
                const name = contact.name || contact.pushname || 'Unknown';
                
                lead = await storage.createLead({
                    fullName: name,
                    email: `${phone}@whatsapp.placeholder`,
                    phone,
                    source: 'whatsapp',
                    status: 'new',
                    assignedTo: 1, // ID del usuario por defecto
                    notes: 'Lead generado automáticamente desde WhatsApp'
                });
            }
            
            // Guardar el mensaje en el CRM
            await storage.createMessage({
                leadId: lead.id,
                userId: null, // Mensaje recibido del cliente, no de un usuario del CRM
                direction: 'incoming',
                channel: 'whatsapp',
                content: message.body,
                read: false
            });
            
        } catch (error) {
            console.error('Error al procesar mensaje de WhatsApp:', error);
        }
    }

    /**
     * Envía los mensajes que quedaron pendientes
     */
    private async sendPendingMessages() {
        if (this.isReady && this.client) {
            while (this.pendingMessages.length > 0) {
                const msg = this.pendingMessages.shift();
                if (msg) {
                    await this.sendDirectMessage(msg.to, msg.message, msg.leadId);
                }
            }
        }
    }

    /**
     * Envía un mensaje a un número de WhatsApp
     */
    public async sendMessage(phone: string, message: string, leadId?: number) {
        // Normalizar el número de teléfono (eliminar + o espacios)
        const normalizedPhone = phone.replace(/\D/g, '');
        
        if (this.isReady && this.client) {
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
     * Envía un mensaje directamente a través del cliente de WhatsApp
     */
    private async sendDirectMessage(phone: string, message: string, leadId?: number) {
        try {
            if (!this.client) {
                throw new Error('Cliente de WhatsApp no inicializado');
            }
            
            // Formato de número de WhatsApp: [código de país][número]@c.us
            const chatId = `${phone}@c.us`;
            
            // Enviar el mensaje
            const response = await this.client.sendMessage(chatId, message);
            
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
            
            return {
                success: true,
                messageId: response.id._serialized,
                timestamp: response.timestamp
            };
            
        } catch (error) {
            console.error('Error al enviar mensaje de WhatsApp:', error);
            return {
                success: false,
                error: error.message
            };
        }
    }

    /**
     * Obtiene el estado actual del cliente
     */
    public getStatus() {
        return {
            initialized: !!this.client,
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
     * Cierra la sesión de WhatsApp
     */
    public async logout() {
        if (this.client) {
            await this.client.logout();
            this.isReady = false;
            this.sessionActive = false;
            this.qrCode = null;
            return { success: true };
        }
        return { success: false, error: 'No hay sesión activa' };
    }

    /**
     * Reinicia la conexión de WhatsApp
     */
    public async restart() {
        if (this.client) {
            await this.client.destroy();
        }
        this.client = null;
        this.isReady = false;
        this.sessionActive = false;
        this.qrCode = null;
        this.initialize();
        return { success: true };
    }

    /**
     * Genera un QR de ejemplo para el modo de desarrollo
     * Este método NO debe usarse en producción
     */
    public generateDemoQR() {
        const demoQR = 'https://gemini-crm-demo.example/qr';
        qrcode.generate(demoQR, { small: true });
        this.qrCode = { qr: demoQR };
        this.emit('qr', demoQR);
        return this.qrCode;
    }
}

// Exportar como singleton
export const whatsappService = new WhatsAppService();