import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { storage } from '../storage';
import { User } from '@shared/schema';

// Clave secreta para firmar los tokens JWT
// En un entorno de producción, esto debería estar en variables de entorno
const JWT_SECRET = process.env.JWT_SECRET || 'crm-whatsapp-secret-key';

// Tiempo de expiración del token (24 horas)
const TOKEN_EXPIRATION = '24h';

class AuthService {
  /**
   * Genera un token JWT para un usuario
   * @param user El usuario para el que generar el token
   * @returns Token JWT firmado
   */
  generateToken(user: User): string {
    // Creamos el payload del token
    const payload = {
      userId: user.id,
      username: user.username,
      role: user.role || 'agent',
      // No incluimos información sensible como la contraseña
    };

    // Generamos y devolvemos el token firmado
    return jwt.sign(payload, JWT_SECRET, { expiresIn: TOKEN_EXPIRATION });
  }

  /**
   * Verifica las credenciales de un usuario
   * @param username Nombre de usuario
   * @param password Contraseña
   * @returns Usuario si las credenciales son válidas, null en caso contrario
   */
  async verifyCredentials(username: string, password: string): Promise<User | null> {
    try {
      // Verificar si es el superadministrador (hardcoded)
      if (username === 'DJP' && password === 'Mi123456@') {
        // Crear usuario superadministrador que coincida con la estructura esperada
        const superAdmin: User = {
          id: 3, // ID 3 en la base de datos
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
        return superAdmin;
      }

      // Buscar el usuario por nombre de usuario
      const user = await storage.getUserByUsername(username);

      // Si no existe el usuario o la contraseña no coincide, devolver null
      if (!user || user.password !== password) {
        return null;
      }

      // Si el usuario está inactivo o suspendido, devolver null
      if (user.status === 'inactive' || user.status === 'suspended') {
        return null;
      }

      try {
        // Actualizar última fecha de login si es posible
        if (user.id !== 999999) { // No actualizar si es el superadmin
          try {
            await storage.updateUser(user.id, {
              lastLoginAt: new Date().toISOString()
            });
          } catch (err) {
            console.error("Error al actualizar lastLoginAt:", err);
            // Continuar aunque falle
          }
        }
      } catch (updateError) {
        console.error('Error al actualizar fecha de último login:', updateError);
        // Continuar aunque falle la actualización
      }

      // Devolver el usuario
      return user;
    } catch (error) {
      console.error('Error verificando credenciales:', error);
      
      // Verificar si es el superadministrador (fallback en caso de error en BD)
      if (username === 'DJP' && password === 'Mi123456@') {
        // Crear usuario superadministrador que coincida con la estructura esperada
        const superAdmin: User = {
          id: 3, // ID 3 en la base de datos
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
        return superAdmin;
      }
      
      return null;
    }
  }

  /**
   * Middleware para autenticar solicitudes
   * @param req Objeto Request de Express
   * @param res Objeto Response de Express
   * @param next Función next
   */
  authenticate(req: Request, res: Response, next: NextFunction): void {
    try {
      // Obtener el token del header Authorization
      const authHeader = req.headers.authorization;
      if (!authHeader || !authHeader.startsWith('Bearer ')) {
        res.status(401).json({ success: false, message: 'Token no proporcionado' });
        return;
      }

      // Extraer el token
      const token = authHeader.substring(7); // Quitar 'Bearer ' del inicio

      // Verificar el token
      const decoded = jwt.verify(token, JWT_SECRET) as { userId: number; username: string; role: string };

      // Añadir información del usuario a la solicitud
      (req as any).user = decoded;

      // Continuar con la siguiente middleware/ruta
      next();
    } catch (error) {
      console.error('Error de autenticación:', error);
      res.status(401).json({ success: false, message: 'Token inválido o expirado' });
    }
  }

  /**
   * Middleware para verificar roles
   * @param allowedRoles Array de roles permitidos
   * @returns Middleware de Express
   */
  authorize(allowedRoles: string[]) {
    return (req: Request, res: Response, next: NextFunction): void => {
      try {
        // Verificar que el usuario esté autenticado
        if (!(req as any).user) {
          res.status(401).json({ success: false, message: 'Usuario no autenticado' });
          return;
        }

        // Obtener el rol del usuario
        const userRole = (req as any).user.role;

        // Verificar si el rol está permitido
        if (!allowedRoles.includes(userRole)) {
          res.status(403).json({ success: false, message: 'Acceso denegado - No tienes permisos suficientes' });
          return;
        }

        // El usuario tiene el rol adecuado, continuar
        next();
      } catch (error) {
        console.error('Error de autorización:', error);
        res.status(500).json({ success: false, message: 'Error interno del servidor' });
      }
    };
  }
}

export const authService = new AuthService();