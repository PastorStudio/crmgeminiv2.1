import { db } from "../db";
import { messageTemplates, type InsertMessageTemplate, type MessageTemplate } from "@shared/schema";
import { eq } from "drizzle-orm";

// Servicio para gestionar las plantillas de mensajes
export class MessageTemplateService {
  // Obtener todas las plantillas
  async getAllTemplates(): Promise<MessageTemplate[]> {
    return db.select().from(messageTemplates).orderBy(messageTemplates.name);
  }

  // Obtener plantillas por categoría
  async getTemplatesByCategory(category: string): Promise<MessageTemplate[]> {
    return db.select().from(messageTemplates)
      .where(eq(messageTemplates.category, category))
      .orderBy(messageTemplates.name);
  }

  // Obtener una plantilla por ID
  async getTemplateById(id: number): Promise<MessageTemplate | undefined> {
    const result = await db.select().from(messageTemplates)
      .where(eq(messageTemplates.id, id));
    return result[0];
  }

  // Crear una nueva plantilla
  async createTemplate(data: InsertMessageTemplate): Promise<MessageTemplate> {
    const result = await db.insert(messageTemplates)
      .values({
        ...data,
        createdAt: new Date(),
        updatedAt: new Date()
      })
      .returning();
    return result[0];
  }

  // Actualizar una plantilla existente
  async updateTemplate(id: number, data: Partial<InsertMessageTemplate>): Promise<MessageTemplate | undefined> {
    const template = await this.getTemplateById(id);
    if (!template) return undefined;

    const result = await db.update(messageTemplates)
      .set({
        ...data,
        updatedAt: new Date()
      })
      .where(eq(messageTemplates.id, id))
      .returning();
    return result[0];
  }

  // Eliminar una plantilla
  async deleteTemplate(id: number): Promise<boolean> {
    const result = await db.delete(messageTemplates)
      .where(eq(messageTemplates.id, id))
      .returning();
    return result.length > 0;
  }

  // Buscar plantillas por texto
  async searchTemplates(searchText: string): Promise<MessageTemplate[]> {
    const lowerSearchText = searchText.toLowerCase();
    const allTemplates = await this.getAllTemplates();
    
    return allTemplates.filter(template => 
      template.name.toLowerCase().includes(lowerSearchText) ||
      (template.description && template.description.toLowerCase().includes(lowerSearchText)) ||
      template.content.toLowerCase().includes(lowerSearchText) ||
      (template.category && template.category.toLowerCase().includes(lowerSearchText))
    );
  }

  // Analizar variables en una plantilla
  async analyzeTemplateVariables(templateId: number): Promise<string[]> {
    const template = await this.getTemplateById(templateId);
    if (!template) return [];

    // Extraer todas las variables en formato {{variable}}
    const variableRegex = /{{([^}]+)}}/g;
    const variables: string[] = [];
    let match;

    while ((match = variableRegex.exec(template.content)) !== null) {
      if (!variables.includes(match[1])) {
        variables.push(match[1]);
      }
    }

    return variables;
  }

  // Aplicar valores a las variables de una plantilla
  applyVariablesToTemplate(templateContent: string, variables: Record<string, string>): string {
    let result = templateContent;
    
    for (const [key, value] of Object.entries(variables)) {
      const regex = new RegExp(`{{${key}}}`, 'g');
      result = result.replace(regex, value);
    }
    
    return result;
  }
}

export const messageTemplateService = new MessageTemplateService();
