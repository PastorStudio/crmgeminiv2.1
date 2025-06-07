import { db } from './db';
import { leads, whatsappAccounts } from '@shared/schema';
import { eq, desc } from 'drizzle-orm';

/**
 * Database adapter to handle schema mismatches and provide consistent data access
 */
export class DatabaseAdapter {
  
  /**
   * Get all leads with proper error handling and data transformation
   */
  async getAllLeads(): Promise<any[]> {
    try {
      const rawLeads = await db.select().from(leads).orderBy(desc(leads.createdAt));
      
      // Transform database leads to expected format
      return rawLeads.map(lead => ({
        id: lead.id,
        name: lead.name || 'Lead sin nombre',
        email: lead.email || '',
        phone: lead.phone || '',
        company: lead.company || '',
        notes: lead.notes || '',
        source: lead.source || 'whatsapp',
        priority: lead.priority || 'medium',
        status: lead.status || 'new',
        budget: lead.budget || 0,
        tags: lead.tags || [],
        assigneeId: lead.assigneeId || null,
        createdAt: lead.createdAt,
        updatedAt: lead.updatedAt,
        // Add missing fields with defaults for compatibility
        contactId: lead.id, // Use lead id as contactId for compatibility
        whatsappAccountId: 1, // Default to account 1
        title: lead.name || 'Lead sin título',
        stage: 'lead',
        value: lead.budget?.toString() || '0',
        currency: 'USD',
        probability: 0,
        assignedTo: lead.assigneeId,
        expectedCloseDate: null,
        actualCloseDate: null,
        lastContactDate: lead.updatedAt,
        nextFollowUpDate: null,
        customFields: {}
      }));
    } catch (error) {
      console.error('Error getting all leads:', error);
      return [];
    }
  }

  /**
   * Get lead by ID with proper error handling
   */
  async getLead(id: number): Promise<any | undefined> {
    try {
      const [lead] = await db.select().from(leads).where(eq(leads.id, id));
      
      if (!lead) return undefined;
      
      // Transform to expected format
      return {
        id: lead.id,
        name: lead.name || 'Lead sin nombre',
        email: lead.email || '',
        phone: lead.phone || '',
        company: lead.company || '',
        notes: lead.notes || '',
        source: lead.source || 'whatsapp',
        priority: lead.priority || 'medium',
        status: lead.status || 'new',
        budget: lead.budget || 0,
        tags: lead.tags || [],
        assigneeId: lead.assigneeId || null,
        createdAt: lead.createdAt,
        updatedAt: lead.updatedAt,
        // Add missing fields for compatibility
        contactId: lead.id,
        whatsappAccountId: 1,
        title: lead.name || 'Lead sin título',
        stage: 'lead',
        value: lead.budget?.toString() || '0',
        currency: 'USD',
        probability: 0,
        assignedTo: lead.assigneeId,
        expectedCloseDate: null,
        actualCloseDate: null,
        lastContactDate: lead.updatedAt,
        nextFollowUpDate: null,
        customFields: {}
      };
    } catch (error) {
      console.error('Error getting lead:', error);
      return undefined;
    }
  }

  /**
   * Update lead with proper error handling
   */
  async updateLead(id: number, updates: any): Promise<any | undefined> {
    try {
      // Map updates to actual database fields
      const dbUpdates: any = {
        updatedAt: new Date()
      };
      
      if (updates.name) dbUpdates.name = updates.name;
      if (updates.email) dbUpdates.email = updates.email;
      if (updates.phone) dbUpdates.phone = updates.phone;
      if (updates.company) dbUpdates.company = updates.company;
      if (updates.notes) dbUpdates.notes = updates.notes;
      if (updates.source) dbUpdates.source = updates.source;
      if (updates.priority) dbUpdates.priority = updates.priority;
      if (updates.status) dbUpdates.status = updates.status;
      if (updates.budget !== undefined) dbUpdates.budget = updates.budget;
      if (updates.tags) dbUpdates.tags = updates.tags;
      if (updates.assigneeId !== undefined) dbUpdates.assigneeId = updates.assigneeId;
      
      const [lead] = await db
        .update(leads)
        .set(dbUpdates)
        .where(eq(leads.id, id))
        .returning();
      
      return lead ? this.transformLead(lead) : undefined;
    } catch (error) {
      console.error('Error updating lead:', error);
      return undefined;
    }
  }

  /**
   * Get WhatsApp accounts with proper error handling
   */
  async getWhatsAppAccounts(): Promise<any[]> {
    try {
      return await db.select().from(whatsappAccounts).orderBy(desc(whatsappAccounts.createdAt));
    } catch (error) {
      console.error('Error getting WhatsApp accounts:', error);
      return [];
    }
  }

  /**
   * Transform raw lead data to expected format
   */
  private transformLead(lead: any): any {
    return {
      id: lead.id,
      name: lead.name || 'Lead sin nombre',
      email: lead.email || '',
      phone: lead.phone || '',
      company: lead.company || '',
      notes: lead.notes || '',
      source: lead.source || 'whatsapp',
      priority: lead.priority || 'medium',
      status: lead.status || 'new',
      budget: lead.budget || 0,
      tags: lead.tags || [],
      assigneeId: lead.assigneeId || null,
      createdAt: lead.createdAt,
      updatedAt: lead.updatedAt,
      contactId: lead.id,
      whatsappAccountId: 1,
      title: lead.name || 'Lead sin título',
      stage: 'lead',
      value: lead.budget?.toString() || '0',
      currency: 'USD',
      probability: 0,
      assignedTo: lead.assigneeId,
      expectedCloseDate: null,
      actualCloseDate: null,
      lastContactDate: lead.updatedAt,
      nextFollowUpDate: null,
      customFields: {}
    };
  }

  /**
   * Create test data if database is empty
   */
  async ensureTestData(): Promise<void> {
    try {
      const existingLeads = await db.select().from(leads);
      
      if (existingLeads.length === 0) {
        console.log('📊 Creando datos de prueba para Gemini AI...');
        
        const testLeads = [
          {
            name: 'Juan Pérez',
            email: 'juan@email.com',
            phone: '+507 6123-4567',
            company: 'Empresa ABC',
            notes: 'Interesado en servicios de telecomunicaciones',
            source: 'whatsapp',
            priority: 'high',
            status: 'new',
            budget: 5000,
            tags: ['telecomunicaciones', 'empresa'],
            assigneeId: null
          },
          {
            name: 'María González',
            email: 'maria@email.com',
            phone: '+507 6234-5678',
            company: 'Tech Solutions',
            notes: 'Necesita consultoría técnica',
            source: 'whatsapp',
            priority: 'medium',
            status: 'contacted',
            budget: 3000,
            tags: ['consultoría', 'tech'],
            assigneeId: null
          },
          {
            name: 'Carlos Rodríguez',
            email: 'carlos@email.com',
            phone: '+507 6345-6789',
            company: 'Innovate Corp',
            notes: 'Proyecto de automatización',
            source: 'whatsapp',
            priority: 'high',
            status: 'qualified',
            budget: 8000,
            tags: ['automatización', 'proyecto'],
            assigneeId: null
          }
        ];
        
        await db.insert(leads).values(testLeads);
        console.log('✅ Datos de prueba creados correctamente');
      }
    } catch (error) {
      console.error('Error ensuring test data:', error);
    }
  }
}

export const databaseAdapter = new DatabaseAdapter();