import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';

// Extend Request interface to include authenticated user
declare global {
  namespace Express {
    interface Request {
      authenticatedUser?: {
        id: number;
        username: string;
        role: string;
      };
    }
  }
}

export const authenticateUser = (req: Request, res: Response, next: NextFunction) => {
  try {
    const authHeader = req.headers.authorization;
    
    // Check for Bearer token
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ 
        error: "Token de acceso requerido",
        message: "Debe proporcionar un token de autenticación válido"
      });
    }

    const token = authHeader.substring(7);
    const decoded = jwt.verify(token, process.env.JWT_SECRET || 'default-secret') as any;
    
    // Attach authenticated user info to request
    req.authenticatedUser = {
      id: decoded.id,
      username: decoded.username,
      role: decoded.role
    };
    
    console.log(`🔐 Usuario autenticado: ${decoded.username} (ID: ${decoded.id})`);
    next();
  } catch (error) {
    console.error('Error de autenticación:', error);
    return res.status(401).json({ 
      error: "Token inválido",
      message: "El token de autenticación ha expirado o es inválido"
    });
  }
};

export const optionalAuth = (req: Request, res: Response, next: NextFunction) => {
  try {
    const authHeader = req.headers.authorization;
    
    if (authHeader && authHeader.startsWith('Bearer ')) {
      const token = authHeader.substring(7);
      const decoded = jwt.verify(token, process.env.JWT_SECRET || 'default-secret') as any;
      
      req.authenticatedUser = {
        id: decoded.id,
        username: decoded.username,
        role: decoded.role
      };
      
      console.log(`🔐 Usuario autenticado (opcional): ${decoded.username} (ID: ${decoded.id})`);
    }
    
    next();
  } catch (error) {
    // For optional auth, we continue even if token is invalid
    console.warn('Token inválido en autenticación opcional:', error);
    next();
  }
};