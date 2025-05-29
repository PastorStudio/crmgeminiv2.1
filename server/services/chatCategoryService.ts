import { db } from '../db';

interface ChatCategory {
  id: number;
  name: string;
  description: string | null;
  color: string;
  icon: string;
  accountId: number | null;
  createdAt: Date;
}

interface ChatCategoryAssignment {
  id: number;
  chatId: string;
  accountId: number;
  categoryId: number;
  assignedAt: Date;
}

export class ChatCategoryService {
  // Crear tabla de categorías si no existe
  static async initializeDatabase() {
    try {
      await db.execute(`
        CREATE TABLE IF NOT EXISTS chat_categories (
          id SERIAL PRIMARY KEY,
          name VARCHAR(255) NOT NULL,
          description TEXT,
          color VARCHAR(7) DEFAULT '#3B82F6',
          icon VARCHAR(50) DEFAULT 'Tag',
          account_id INTEGER,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
      `);

      await db.execute(`
        CREATE TABLE IF NOT EXISTS chat_category_assignments (
          id SERIAL PRIMARY KEY,
          chat_id VARCHAR(255) NOT NULL,
          account_id INTEGER NOT NULL,
          category_id INTEGER REFERENCES chat_categories(id) ON DELETE CASCADE,
          assigned_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          UNIQUE(chat_id, account_id)
        )
      `);

      console.log('✅ Tablas de categorías inicializadas');
    } catch (error) {
      console.error('❌ Error inicializando tablas de categorías:', error);
    }
  }

  // Obtener todas las categorías
  static async getAllCategories(): Promise<ChatCategory[]> {
    try {
      const result = await db.execute(`
        SELECT id, name, description, color, icon, account_id, created_at
        FROM chat_categories
        ORDER BY created_at DESC
      `);
      return result.rows as ChatCategory[];
    } catch (error) {
      console.error('Error obteniendo categorías:', error);
      return [];
    }
  }

  // Crear nueva categoría
  static async createCategory(data: {
    name: string;
    description?: string;
    color?: string;
    icon?: string;
    accountId?: number;
  }): Promise<ChatCategory | null> {
    try {
      const { name, description, color = '#3B82F6', icon = 'Tag', accountId } = data;
      
      const result = await db.execute(`
        INSERT INTO chat_categories (name, description, color, icon, account_id)
        VALUES ($1, $2, $3, $4, $5)
        RETURNING id, name, description, color, icon, account_id, created_at
      `, [name, description || null, color, icon, accountId || null]);

      return result.rows[0] as ChatCategory;
    } catch (error) {
      console.error('Error creando categoría:', error);
      return null;
    }
  }

  // Asignar chat a categoría
  static async assignChatToCategory(chatId: string, accountId: number, categoryId: number): Promise<boolean> {
    try {
      await db.execute(`
        INSERT INTO chat_category_assignments (chat_id, account_id, category_id)
        VALUES ($1, $2, $3)
        ON CONFLICT (chat_id, account_id)
        DO UPDATE SET category_id = $3, assigned_at = CURRENT_TIMESTAMP
      `, [chatId, accountId, categoryId]);

      return true;
    } catch (error) {
      console.error('Error asignando categoría:', error);
      return false;
    }
  }

  // Obtener categoría de un chat
  static async getChatCategory(chatId: string, accountId: number): Promise<ChatCategory | null> {
    try {
      const result = await db.execute(`
        SELECT c.id, c.name, c.description, c.color, c.icon, c.account_id, c.created_at
        FROM chat_categories c
        JOIN chat_category_assignments a ON c.id = a.category_id
        WHERE a.chat_id = $1 AND a.account_id = $2
      `, [chatId, accountId]);

      return result.rows[0] as ChatCategory || null;
    } catch (error) {
      console.error('Error obteniendo categoría del chat:', error);
      return null;
    }
  }

  // Eliminar asignación de categoría
  static async removeChatFromCategory(chatId: string, accountId: number): Promise<boolean> {
    try {
      await db.execute(`
        DELETE FROM chat_category_assignments
        WHERE chat_id = $1 AND account_id = $2
      `, [chatId, accountId]);

      return true;
    } catch (error) {
      console.error('Error removiendo categoría:', error);
      return false;
    }
  }

  // Obtener chats por categoría
  static async getChatsByCategory(categoryId: number): Promise<string[]> {
    try {
      const result = await db.execute(`
        SELECT chat_id
        FROM chat_category_assignments
        WHERE category_id = $1
      `, [categoryId]);

      return result.rows.map((row: any) => row.chat_id);
    } catch (error) {
      console.error('Error obteniendo chats por categoría:', error);
      return [];
    }
  }

  // Eliminar categoría
  static async deleteCategory(categoryId: number): Promise<boolean> {
    try {
      await db.execute(`
        DELETE FROM chat_categories
        WHERE id = $1
      `, [categoryId]);

      return true;
    } catch (error) {
      console.error('Error eliminando categoría:', error);
      return false;
    }
  }
}