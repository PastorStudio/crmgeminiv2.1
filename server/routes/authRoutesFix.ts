/**
 * Rutas de autenticación corregidas para usar la columna correcta (fullName vs full_name)
 */
import { Router, Request, Response } from 'express';
import { db } from '../db';
import { users } from '@shared/schema';
import { eq } from 'drizzle-orm';
import { authService } from '../services/authService';

export const authRouter = Router();

// Ruta de inicio de sesión
authRouter.post('/login', async (req: Request, res: Response) => {
  const { username, password } = req.body;
  
  if (!username || !password) {
    return res.status(400).json({
      success: false,
      message: 'Nombre de usuario y contraseña son obligatorios'
    });
  }
  
  try {
    const user = await authService.verifyCredentials(username, password);
    
    if (!user) {
      return res.status(401).json({
        success: false,
        message: 'Credenciales inválidas'
      });
    }
    
    // Generar token JWT
    const token = authService.generateToken(user);
    
    // Responder con el token y la información del usuario
    return res.status(200).json({
      success: true,
      token,
      user: {
        id: user.id,
        username: user.username,
        email: user.email,
        fullName: user.fullName,
        role: user.role,
        status: user.status
      }
    });
  } catch (error) {
    console.error('Error en inicio de sesión:', error);
    return res.status(500).json({
      success: false,
      message: 'Error interno del servidor'
    });
  }
});

// Ruta para obtener información del usuario actual
authRouter.get('/me', authService.authenticate.bind(authService), async (req: Request, res: Response) => {
  const userId = (req as any).user.userId;
  
  // Para los super administradores, retornar datos hardcoded
  if (userId === 3) {
    const superAdmin = {
      id: 3,
      username: 'DJP',
      password: 'Mi123456@',
      email: 'superadmin@crm.com',
      fullName: 'Super Administrador',
      role: 'super_admin',
      createdAt: new Date(),
      updatedAt: new Date(),
      status: 'active',
      department: 'Dirección',
      avatar: '/assets/avatars/superadmin.png',
      supervisorId: null,
      settings: null,
      lastLoginAt: null
    };
    
    return res.json({
      success: true,
      user: superAdmin
    });
  }
  
  // Para usuarios normales de la base de datos
  try {
    const [user] = await db
      .select()
      .from(users)
      .where(eq(users.id, userId));
    
    if (!user) {
      return res.status(404).json({
        success: false,
        message: "Usuario no encontrado"
      });
    }
    
    res.json({
      success: true,
      user: user
    });
  } catch (dbError) {
    console.error("Error específico de base de datos:", dbError);
    // Si hay error en la consulta, intentamos devolver al menos la información básica
    const basicUser = {
      id: userId,
      username: (req as any).user.username,
      role: (req as any).user.role
    };
    
    res.json({
      success: true,
      user: basicUser
    });
  }
});

// Ruta para cerrar sesión
authRouter.post('/logout', (req: Request, res: Response) => {
  // Al ser autenticación con JWT, solo basta con que el cliente elimine el token
  res.status(200).json({
    success: true,
    message: 'Sesión cerrada correctamente'
  });
});