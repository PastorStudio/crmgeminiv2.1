import { Request } from 'express';
import { db } from '../db';
import { leads, messages, activities, users, whatsappAccounts } from '@shared/schema';
import { eq, and, or, inArray } from 'drizzle-orm';

export class RoleBasedAccessService {
  
  // Obtener leads filtrados por rol y permisos
  static async getFilteredLeads(req: Request) {
    const user = req.user!;
    
    let query = db.select().from(leads);
    
    switch (user.role) {
      case 'super_admin':
      case 'admin':
        // Acceso completo a todos los leads
        return query;
        
      case 'supervisor':
        // Acceso a leads del departamento
        if (user.department) {
          const departmentUsers = await db
            .select({ id: users.id })
            .from(users)
            .where(eq(users.department, user.department));
          
          const userIds = departmentUsers.map(u => u.id);
          return query.where(inArray(leads.assigneeId, userIds));
        }
        return query.where(eq(leads.assigneeId, user.id));
        
      case 'agent':
      default:
        // Solo leads asignados al usuario
        return query.where(eq(leads.assigneeId, user.id));
    }
  }
  
  // Obtener mensajes filtrados por rol y permisos
  static async getFilteredMessages(req: Request) {
    const user = req.user!;
    
    let query = db.select().from(messages);
    
    switch (user.role) {
      case 'super_admin':
      case 'admin':
        return query;
        
      case 'supervisor':
        if (user.department) {
          // Obtener usuarios del departamento
          const departmentUsers = await db
            .select({ id: users.id })
            .from(users)
            .where(eq(users.department, user.department));
          
          const userIds = departmentUsers.map(u => u.id);
          
          // Obtener leads asignados a usuarios del departamento
          const departmentLeads = await db
            .select({ id: leads.id })
            .from(leads)
            .where(inArray(leads.assigneeId, userIds));
          
          const leadIds = departmentLeads.map(l => l.id);
          return query.where(inArray(messages.leadId, leadIds));
        }
        return query.where(eq(messages.leadId, user.id));
        
      case 'agent':
      default:
        // Solo mensajes de leads asignados
        const userLeads = await db
          .select({ id: leads.id })
          .from(leads)
          .where(eq(leads.assigneeId, user.id));
        
        const leadIds = userLeads.map(l => l.id);
        return query.where(inArray(messages.leadId, leadIds));
    }
  }
  
  // Obtener actividades filtradas por rol y permisos
  static async getFilteredActivities(req: Request) {
    const user = req.user!;
    
    let query = db.select().from(activities);
    
    switch (user.role) {
      case 'super_admin':
      case 'admin':
        return query;
        
      case 'supervisor':
        if (user.department) {
          const departmentUsers = await db
            .select({ id: users.id })
            .from(users)
            .where(eq(users.department, user.department));
          
          const userIds = departmentUsers.map(u => u.id);
          return query.where(inArray(activities.userId, userIds));
        }
        return query.where(eq(activities.userId, user.id));
        
      case 'agent':
      default:
        return query.where(eq(activities.userId, user.id));
    }
  }
  
  // Verificar si el usuario puede acceder a un lead específico
  static async canAccessLead(req: Request, leadId: number): Promise<boolean> {
    const user = req.user!;
    
    if (['super_admin', 'admin'].includes(user.role)) {
      return true;
    }
    
    const [lead] = await db
      .select()
      .from(leads)
      .where(eq(leads.id, leadId));
    
    if (!lead) {
      return false;
    }
    
    if (user.role === 'agent') {
      return lead.assigneeId === user.id;
    }
    
    if (user.role === 'supervisor' && user.department) {
      if (lead.assigneeId) {
        const [assignee] = await db
          .select({ department: users.department })
          .from(users)
          .where(eq(users.id, lead.assigneeId));
        
        return assignee?.department === user.department;
      }
    }
    
    return false;
  }
  
  // Verificar si el usuario puede acceder a una cuenta de WhatsApp
  static async canAccessWhatsAppAccount(req: Request, accountId: number): Promise<boolean> {
    const user = req.user!;
    
    if (['super_admin', 'admin'].includes(user.role)) {
      return true;
    }
    
    const [account] = await db
      .select()
      .from(whatsappAccounts)
      .where(eq(whatsappAccounts.id, accountId));
    
    if (!account) {
      return false;
    }
    
    // Los supervisores pueden acceder si están en el mismo departamento que el admin de la cuenta
    if (user.role === 'supervisor' && user.department && account.adminId) {
      const [admin] = await db
        .select({ department: users.department })
        .from(users)
        .where(eq(users.id, account.adminId));
      
      return admin?.department === user.department;
    }
    
    // Los agentes pueden acceder si son el admin de la cuenta
    if (user.role === 'agent') {
      return account.adminId === user.id;
    }
    
    return false;
  }
  
  // Obtener estadísticas del dashboard filtradas por rol
  static async getDashboardStats(req: Request) {
    const user = req.user!;
    
    if (['super_admin', 'admin'].includes(user.role)) {
      // Estadísticas globales
      return {
        scope: 'global',
        description: 'Estadísticas de toda la organización'
      };
    }
    
    if (user.role === 'supervisor' && user.department) {
      // Estadísticas del departamento
      return {
        scope: 'department',
        department: user.department,
        description: `Estadísticas del departamento: ${user.department}`
      };
    }
    
    // Estadísticas personales
    return {
      scope: 'personal',
      userId: user.id,
      description: 'Estadísticas personales'
    };
  }
  
  // Verificar permisos para crear/editar leads
  static canModifyLead(req: Request, lead?: any): boolean {
    const user = req.user!;
    
    if (['super_admin', 'admin'].includes(user.role)) {
      return true;
    }
    
    if (user.role === 'supervisor') {
      return true; // Los supervisores pueden crear/editar leads
    }
    
    if (user.role === 'agent') {
      // Los agentes solo pueden editar sus leads asignados
      return !lead || lead.assigneeId === user.id;
    }
    
    return false;
  }
  
  // Obtener lista de usuarios que el usuario actual puede ver/gestionar
  static async getAccessibleUsers(req: Request) {
    const user = req.user!;
    
    let query = db.select({
      id: users.id,
      username: users.username,
      fullName: users.fullName,
      email: users.email,
      role: users.role,
      department: users.department,
      status: users.status
    }).from(users);
    
    switch (user.role) {
      case 'super_admin':
        return query; // Ve todos los usuarios
        
      case 'admin':
        return query.where(eq(users.role, 'agent')); // Ve solo agentes
        
      case 'supervisor':
        if (user.department) {
          return query.where(
            and(
              eq(users.department, user.department),
              or(eq(users.role, 'agent'), eq(users.id, user.id))
            )
          );
        }
        return query.where(eq(users.id, user.id));
        
      case 'agent':
      default:
        return query.where(eq(users.id, user.id)); // Solo se ve a sí mismo
    }
  }
}