import { Router, Request, Response } from 'express';
import { sql } from 'drizzle-orm';
import { db } from '../db';

// Auxiliar para solución de emergencia
const fixRouter = Router();

// Endpoint para verificar la estructura de la tabla users
fixRouter.get('/users-columns', async (req: Request, res: Response) => {
  try {
    const result = await db.execute(sql`
      SELECT column_name, data_type 
      FROM information_schema.columns 
      WHERE table_name = 'users'
    `);
    
    return res.json({
      success: true,
      columns: result.rows
    });
  } catch (error) {
    console.error('Error al obtener columnas:', error);
    return res.status(500).json({
      success: false,
      message: 'Error al verificar estructura de la tabla users'
    });
  }
});

// Endpoint para corregir columnas
fixRouter.post('/fix-fullname', async (req: Request, res: Response) => {
  try {
    // Comprobar si existe la columna full_name
    const checkResult = await db.execute(sql`
      SELECT column_name 
      FROM information_schema.columns 
      WHERE table_name = 'users' AND column_name = 'full_name'
    `);
    
    if (checkResult.rows && checkResult.rows.length > 0) {
      // Tenemos que renombrar full_name a fullName
      await db.execute(sql`
        ALTER TABLE users RENAME COLUMN full_name TO "fullName"
      `);
      return res.json({
        success: true,
        message: 'Columna renombrada de full_name a fullName'
      });
    } else {
      // Comprobamos si ya existe fullName
      const checkFullName = await db.execute(sql`
        SELECT column_name 
        FROM information_schema.columns 
        WHERE table_name = 'users' AND column_name = 'fullName'
      `);
      
      if (checkFullName.rows && checkFullName.rows.length > 0) {
        return res.json({
          success: true,
          message: 'La columna fullName ya existe correctamente'
        });
      } else {
        // Ninguna de las dos existe, tenemos que crearla
        await db.execute(sql`
          ALTER TABLE users ADD COLUMN "fullName" text
        `);
        return res.json({
          success: true,
          message: 'Columna fullName creada correctamente'
        });
      }
    }
  } catch (error) {
    console.error('Error al corregir columna:', error);
    return res.status(500).json({
      success: false,
      message: 'Error al corregir columna fullName',
      error: String(error)
    });
  }
});

export default fixRouter;