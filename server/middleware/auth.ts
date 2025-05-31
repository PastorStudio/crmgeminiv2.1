import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { db } from '../db';
import { users } from '@shared/schema';
import { eq } from 'drizzle-orm';

// Extender la interfaz Request para incluir user
declare global {
  namespace Express {
    interface Request {
      user?: {
        id: number;
        username: string;
        role: string;
        department?: string;
        supervisorId?: number;
      };
    }
  }
}

const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key';

// Middleware de autenticación
export const authenticateToken = async (req: Request, res: Response, next: NextFunction) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) {
    return res.status(401).json({ error: 'Token de acceso requerido' });
  }

  try {
    const decoded = jwt.verify(token, JWT_SECRET) as any;
    
    // Buscar usuario en la base de datos
    const [user] = await db
      .select({
        id: users.id,
        username: users.username,
        role: users.role,
        department: users.department,
        supervisorId: users.supervisorId,
        status: users.status
      })
      .from(users)
      .where(eq(users.id, decoded.userId));

    if (!user || user.status !== 'active') {
      return res.status(401).json({ error: 'Usuario no válido o inactivo' });
    }

    req.user = user;
    next();
  } catch (error) {
    return res.status(403).json({ error: 'Token no válido' });
  }
};

// Middleware de autorización por roles
export const authorize = (roles: string[]) => {
  return (req: Request, res: Response, next: NextFunction) => {
    if (!req.user) {
      return res.status(401).json({ error: 'Usuario no autenticado' });
    }

    if (!roles.includes(req.user.role)) {
      return res.status(403).json({ error: 'Permisos insuficientes' });
    }

    next();
  };
};

// Middleware para verificar si el usuario puede acceder a un recurso específico
export const canAccessResource = (resourceType: 'lead' | 'message' | 'activity' | 'whatsapp_account') => {
  return (req: Request, res: Response, next: NextFunction) => {
    if (!req.user) {
      return res.status(401).json({ error: 'Usuario no autenticado' });
    }

    // Los super_admin y admin pueden acceder a todo
    if (['super_admin', 'admin'].includes(req.user.role)) {
      return next();
    }

    // Los supervisores pueden acceder a recursos de su departamento
    if (req.user.role === 'supervisor') {
      req.canAccessAll = false;
      req.filterByDepartment = true;
      return next();
    }

    // Los agentes solo pueden acceder a sus recursos asignados
    if (req.user.role === 'agent') {
      req.canAccessAll = false;
      req.filterByUser = true;
      return next();
    }

    return res.status(403).json({ error: 'Permisos insuficientes' });
  };
};

// Función helper para generar JWT
export const generateToken = (userId: number, username: string, role: string) => {
  return jwt.sign(
    { userId, username, role },
    JWT_SECRET,
    { expiresIn: '24h' }
  );
};

// Función helper para obtener permisos del usuario
export const getUserPermissions = (role: string) => {
  const permissions = {
    super_admin: [
      'read_all', 'write_all', 'delete_all', 'manage_users', 'manage_system'
    ],
    admin: [
      'read_all', 'write_all', 'delete_all', 'manage_users'
    ],
    supervisor: [
      'read_department', 'write_department', 'manage_agents'
    ],
    agent: [
      'read_assigned', 'write_assigned'
    ]
  };

  return permissions[role as keyof typeof permissions] || [];
};

declare global {
  namespace Express {
    interface Request {
      canAccessAll?: boolean;
      filterByDepartment?: boolean;
      filterByUser?: boolean;
    }
  }
}