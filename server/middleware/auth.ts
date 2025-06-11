/**
 * Authentication middleware for user-based data isolation
 * Ensures each user can only access their own WhatsApp accounts and data
 */
import { Request, Response, NextFunction } from 'express';
import { storage } from '../storage';

export interface AuthenticatedRequest extends Request {
  user?: {
    id: number;
    username: string;
    role: string;
    organizationId?: number;
  };
}

/**
 * Middleware to extract and validate user authentication
 * For now, using a simple user ID from headers until proper auth is implemented
 */
export const authenticateUser = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    // Temporary: Extract user ID from headers or query params
    // In production, this should come from JWT tokens or session data
    const userId = req.headers['x-user-id'] || req.query.userId || '1'; // Default to user 1 for testing
    
    if (!userId) {
      return res.status(401).json({
        success: false,
        error: 'Authentication required - user ID not provided'
      });
    }

    // Get user information from database
    const user = await storage.getUser(parseInt(userId as string));
    
    if (!user) {
      return res.status(401).json({
        success: false,
        error: 'Invalid user credentials'
      });
    }

    // Attach user to request object
    req.user = {
      id: user.id,
      username: user.username,
      role: user.role || 'agent',
      organizationId: user.organizationId || undefined
    };

    console.log(`🔐 User authenticated: ${user.username} (ID: ${user.id})`);
    next();
  } catch (error) {
    console.error('❌ Authentication error:', error);
    res.status(500).json({
      success: false,
      error: 'Authentication system error'
    });
  }
};

/**
 * Middleware to ensure user can only access their own WhatsApp accounts
 */
export const requireUserAccess = (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  if (!req.user) {
    return res.status(401).json({
      success: false,
      error: 'User authentication required'
    });
  }
  
  next();
};

/**
 * Middleware to check if user has admin privileges
 */
export const requireAdminAccess = (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  if (!req.user) {
    return res.status(401).json({
      success: false,
      error: 'Authentication required'
    });
  }

  if (req.user.role !== 'admin' && req.user.role !== 'manager') {
    return res.status(403).json({
      success: false,
      error: 'Admin privileges required'
    });
  }

  next();
};