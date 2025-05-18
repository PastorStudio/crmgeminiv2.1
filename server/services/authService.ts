import { Request, Response, NextFunction } from 'express';
import { storage } from '../storage';
import { users, User } from '@shared/schema';
import { eq } from 'drizzle-orm';
import { db } from '../db';
import * as crypto from 'crypto';
import * as jwt from 'jsonwebtoken';

const JWT_SECRET = process.env.JWT_SECRET || 'crm-gemini-secret-key-2025';
const SESSION_DURATION = '24h'; // Token válido por 24 horas

/**
 * Servicio para manejar autenticación y sesiones de usuario
 */
export class AuthService {
  /**
   * Verificar credenciales de usuario
   */
  async verifyCredentials(username: string, password: string): Promise<User | null> {
    try {
      // En producción usaríamos hashes, pero para simplificar usamos texto plano
      const [user] = await db.select().from(users).where(eq(users.username, username));
      
      if (!user) return null;
      
      // En producción: compareHash(password, user.password)
      if (user.password !== password) return null;
      
      return user;
    } catch (error) {
      console.error('Error verificando credenciales:', error);
      return null;
    }
  }
  
  /**
   * Generar token JWT para el usuario autenticado
   */
  generateToken(user: User): string {
    // Evitamos incluir datos sensibles como la contraseña
    const payload = {
      id: user.id,
      username: user.username,
      role: user.role,
      fullName: user.fullName
    };
    
    return jwt.sign(payload, JWT_SECRET, { expiresIn: SESSION_DURATION });
  }
  
  /**
   * Verificar y decodificar token JWT
   */
  verifyToken(token: string): any | null {
    try {
      return jwt.verify(token, JWT_SECRET);
    } catch (error) {
      console.error('Error verificando token:', error);
      return null;
    }
  }
  
  /**
   * Middleware para proteger rutas que requieren autenticación
   */
  authenticate(req: Request, res: Response, next: NextFunction) {
    // Extraer token del header Authorization (Bearer token)
    const authHeader = req.headers.authorization;
    const token = authHeader && authHeader.split(' ')[1];
    
    if (!token) {
      return res.status(401).json({ 
        success: false, 
        message: 'Se requiere autenticación' 
      });
    }
    
    const decoded = this.verifyToken(token);
    if (!decoded) {
      return res.status(401).json({ 
        success: false, 
        message: 'Token inválido o expirado' 
      });
    }
    
    // Añadir información del usuario al request para uso en controladores
    (req as any).user = decoded;
    
    next();
  }
  
  /**
   * Middleware para verificar roles específicos
   */
  authorizeRoles(...roles: string[]) {
    return (req: Request, res: Response, next: NextFunction) => {
      const user = (req as any).user;
      
      if (!user) {
        return res.status(401).json({ 
          success: false, 
          message: 'Se requiere autenticación' 
        });
      }
      
      if (!roles.includes(user.role)) {
        return res.status(403).json({ 
          success: false, 
          message: 'No tiene permiso para acceder a este recurso' 
        });
      }
      
      next();
    };
  }
}

export const authService = new AuthService();