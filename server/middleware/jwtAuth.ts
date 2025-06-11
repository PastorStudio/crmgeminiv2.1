/**
 * JWT Authentication Middleware
 * Extracts and validates JWT tokens for user authentication
 */

import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { db } from '../db';
import { users, demoUsers } from '@shared/schema';
import { eq } from 'drizzle-orm';

interface JWTPayload {
  userId: number;
  username: string;
  role: string;
  customerName?: string;
  demoUserId?: number;
  isDemo?: boolean;
}

export interface AuthenticatedRequest extends Request {
  user?: {
    id: number;
    username: string;
    role: string;
    isDemo?: boolean;
    demoUserId?: number;
    allowedAccountIds?: number[];
  };
}

/**
 * JWT Authentication middleware
 */
export const authenticateJWT = async (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
) => {
  try {
    const authHeader = req.headers.authorization;
    const token = authHeader && authHeader.split(' ')[1];

    if (!token) {
      return res.status(401).json({
        success: false,
        error: 'Token de acceso requerido'
      });
    }

    // Verify JWT token
    const decoded = jwt.verify(
      token,
      process.env.JWT_SECRET || 'crm-whatsapp-secret-key'
    ) as JWTPayload;

    // Check if it's a demo user
    if (decoded.role === 'demo') {
      console.log(`🎭 Autenticando usuario demo: ${decoded.username}`);
      
      // Verify demo user exists and is active
      const [demoUser] = await db
        .select()
        .from(demoUsers)
        .where(eq(demoUsers.username, decoded.username));

      if (!demoUser) {
        return res.status(401).json({
          success: false,
          error: 'Usuario demo no encontrado'
        });
      }

      // Check if demo is expired
      const now = new Date();
      if (new Date(demoUser.expiresAt) < now) {
        return res.status(401).json({
          success: false,
          error: 'Sesión demo expirada'
        });
      }

      // Set demo user info
      req.user = {
        id: demoUser.id,
        username: demoUser.username,
        role: 'demo',
        isDemo: true,
        demoUserId: demoUser.id
      };

      console.log(`✅ Usuario demo autenticado: ${decoded.username} (ID: ${demoUser.id})`);
    } else {
      // Handle regular users
      const [user] = await db
        .select()
        .from(users)
        .where(eq(users.id, decoded.userId));

      if (!user) {
        return res.status(401).json({
          success: false,
          error: 'Usuario no encontrado'
        });
      }

      if (user.status !== 'active') {
        return res.status(401).json({
          success: false,
          error: 'Cuenta inactiva'
        });
      }

      req.user = {
        id: user.id,
        username: user.username,
        role: user.role,
        isDemo: false
      };

      console.log(`✅ Usuario regular autenticado: ${user.username} (Rol: ${user.role})`);
    }

    next();
  } catch (error) {
    console.error('❌ Error en autenticación JWT:', error);
    
    if (error instanceof jwt.JsonWebTokenError) {
      return res.status(401).json({
        success: false,
        error: 'Token inválido'
      });
    }

    if (error instanceof jwt.TokenExpiredError) {
      return res.status(401).json({
        success: false,
        error: 'Token expirado'
      });
    }

    return res.status(500).json({
      success: false,
      error: 'Error de autenticación'
    });
  }
};

/**
 * Optional JWT middleware - doesn't fail if no token provided
 */
export const optionalJWT = async (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
) => {
  try {
    const authHeader = req.headers.authorization;
    const token = authHeader && authHeader.split(' ')[1];

    if (!token) {
      return next();
    }

    // Use the same logic as authenticateJWT but don't fail if token is invalid
    await authenticateJWT(req, res, next);
  } catch (error) {
    // If authentication fails, continue without user info
    console.log('⚠️ Token opcional inválido, continuando sin autenticación');
    next();
  }
};