import { Request, Response } from 'express';
import { db } from '../db';
import { sql } from 'drizzle-orm';

// Obtener todas las categorías
export async function getChatCategories(req: Request, res: Response) {
  try {
    const categories = await db.execute(sql`
      SELECT * FROM chat_categories 
      ORDER BY "order" ASC, name ASC
    `);
    
    res.json({ success: true, categories: categories.rows });
  } catch (error) {
    console.error('Error obteniendo categorías:', error);
    res.status(500).json({ success: false, message: 'Error obteniendo categorías' });
  }
}

// Crear nueva categoría
export async function createChatCategory(req: Request, res: Response) {
  try {
    const { name, description, color, icon, accountId } = req.body;
    
    const result = await db.execute(sql`
      INSERT INTO chat_categories (name, description, color, icon, account_id, created_by, created_at)
      VALUES (${name}, ${description || null}, ${color || '#3B82F6'}, ${icon || 'MessageCircle'}, ${accountId || null}, 1, NOW())
      RETURNING *
    `);
    
    res.json({ success: true, category: result.rows[0] });
  } catch (error) {
    console.error('Error creando categoría:', error);
    res.status(500).json({ success: false, message: 'Error creando categoría' });
  }
}

// Asignar chat a categoría
export async function assignChatToCategory(req: Request, res: Response) {
  try {
    const { chatId, accountId, categoryId } = req.body;
    
    // Verificar si ya existe una asignación
    const existing = await db.execute(sql`
      SELECT * FROM chat_category_assignments 
      WHERE chat_id = ${chatId} AND account_id = ${accountId}
    `);
    
    if (existing.rows.length > 0) {
      // Actualizar asignación existente
      const result = await db.execute(sql`
        UPDATE chat_category_assignments 
        SET category_id = ${categoryId}, assigned_at = NOW(), assigned_by = 1
        WHERE chat_id = ${chatId} AND account_id = ${accountId}
        RETURNING *
      `);
      
      res.json({ success: true, assignment: result.rows[0] });
    } else {
      // Crear nueva asignación
      const result = await db.execute(sql`
        INSERT INTO chat_category_assignments (chat_id, account_id, category_id, assigned_by, assigned_at)
        VALUES (${chatId}, ${accountId}, ${categoryId}, 1, NOW())
        RETURNING *
      `);
      
      res.json({ success: true, assignment: result.rows[0] });
    }
  } catch (error) {
    console.error('Error asignando chat a categoría:', error);
    res.status(500).json({ success: false, message: 'Error asignando chat a categoría' });
  }
}

// Obtener categoría de un chat específico
export async function getChatCategory(req: Request, res: Response) {
  try {
    const { chatId, accountId } = req.params;
    
    const result = await db.execute(sql`
      SELECT cc.*, cca.assigned_at
      FROM chat_categories cc
      JOIN chat_category_assignments cca ON cc.id = cca.category_id
      WHERE cca.chat_id = ${chatId} AND cca.account_id = ${parseInt(accountId)}
    `);
    
    if (result.rows.length > 0) {
      res.json({ success: true, category: result.rows[0] });
    } else {
      res.json({ success: true, category: null });
    }
  } catch (error) {
    console.error('Error obteniendo categoría del chat:', error);
    res.status(500).json({ success: false, message: 'Error obteniendo categoría del chat' });
  }
}

// Obtener chats por categoría
export async function getChatsByCategory(req: Request, res: Response) {
  try {
    const { categoryId } = req.params;
    const { accountId } = req.query;
    
    let query = sql`
      SELECT cca.chat_id, cca.account_id, cca.assigned_at, cc.name as category_name, cc.color, cc.icon
      FROM chat_category_assignments cca
      JOIN chat_categories cc ON cc.id = cca.category_id
      WHERE cca.category_id = ${parseInt(categoryId)}
    `;
    
    if (accountId) {
      query = sql`${query} AND cca.account_id = ${parseInt(accountId as string)}`;
    }
    
    const result = await db.execute(query);
    
    res.json({ success: true, chats: result.rows });
  } catch (error) {
    console.error('Error obteniendo chats por categoría:', error);
    res.status(500).json({ success: false, message: 'Error obteniendo chats por categoría' });
  }
}

// Inicializar categorías predeterminadas
export async function initializeDefaultCategories(req: Request, res: Response) {
  try {
    // Crear categorías del sistema si no existen
    const defaultCategories = [
      { name: 'Individual', description: 'Chats individuales', color: '#10B981', icon: 'User', isSystem: true },
      { name: 'Grupos', description: 'Chats de grupo', color: '#8B5CF6', icon: 'Users', isSystem: true },
      { name: 'Ventas', description: 'Chats relacionados con ventas', color: '#EF4444', icon: 'TrendingUp', isSystem: false },
      { name: 'Soporte', description: 'Chats de soporte técnico', color: '#F59E0B', icon: 'HelpCircle', isSystem: false },
      { name: 'Consultas', description: 'Consultas generales', color: '#3B82F6', icon: 'MessageCircle', isSystem: false }
    ];
    
    for (const category of defaultCategories) {
      // Verificar si ya existe
      const existing = await db.execute(sql`
        SELECT id FROM chat_categories WHERE name = ${category.name}
      `);
      
      if (existing.rows.length === 0) {
        await db.execute(sql`
          INSERT INTO chat_categories (name, description, color, icon, is_system, is_default, created_by, created_at)
          VALUES (${category.name}, ${category.description}, ${category.color}, ${category.icon}, ${category.isSystem}, true, 1, NOW())
        `);
      }
    }
    
    res.json({ success: true, message: 'Categorías predeterminadas inicializadas' });
  } catch (error) {
    console.error('Error inicializando categorías:', error);
    res.status(500).json({ success: false, message: 'Error inicializando categorías' });
  }
}