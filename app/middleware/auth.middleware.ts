import jwt from 'jsonwebtoken';
import { Request, Response, NextFunction } from 'express';
import logger from '../utils/logger';
import { prisma } from '../config/database';
import { supabase } from '../supabase';

export const authenticate = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const apiKey = req.headers['x-api-key'] as string;
    const authorization = req.headers['authorization'] as string;

    // Try Supabase JWT first if Bearer token provided
    if (authorization && authorization.startsWith('Bearer ')) {
      const token = authorization.slice('Bearer '.length);
      try {
        // Use Supabase to verify the token
        const { data: { user: supaUser }, error: verifyError } = await supabase.auth.getUser(token);

        if (!verifyError && supaUser) {
          // Check if token is revoked in local DB
          const revoked = await prisma.revokedToken.findUnique({
            where: { token },
          });
          if (revoked) {
            return res.status(401).json({
              success: false,
              error: 'Token has been revoked',
              code: 'ERR_JWT_REVOKED',
            });
          }

          // Attach user info
          (req as any).userId = supaUser.id;
          (req as any).supaUser = supaUser;
          
          // Also attach store info if available
          const store = await prisma.store.findFirst({
            where: { user_id: supaUser.id },
          });
          (req as any).store = store;

          next();
          return;
        }
      } catch {
        // Not a valid Supabase token, continue to API key check
      }
    }

    // Validate API key against database (original flow)
    if (!apiKey) {
      return res.status(401).json({
        success: false,
        error: 'API key required',
        code: 'ERR_API_KEY_MISSING',
      });
    }

    const store = await prisma.store.findUnique({
      where: { api_key: apiKey },
    });

    if (!store) {
      return res.status(401).json({
        success: false,
        error: 'Invalid API key',
        code: 'ERR_API_KEY_INVALID',
      });
    }

    // Check if store is inactive (no credits)
    if (!store.is_active) {
      return res.status(403).json({
        success: false,
        error: 'Store is inactive. Please purchase credits to continue.',
        code: 'ERR_STORE_INACTIVE',
      });
    }

    // If JWT token also provided, verify it
    if (authorization && authorization.startsWith('Bearer ')) {
      const token = authorization.slice('Bearer '.length);
      try {
        const decoded = jwt.verify(token, process.env.JWT_SECRET!) as { userId: string };

        // Check if token is revoked
        const revoked = await prisma.revokedToken.findUnique({
          where: { token },
        });
        if (revoked) {
          return res.status(401).json({
            success: false,
            error: 'Token has been revoked',
            code: 'ERR_JWT_REVOKED',
          });
        }

        (req as any).userId = decoded.userId;
      } catch {
        return res.status(401).json({
          success: false,
          error: 'Invalid or expired JWT token',
          code: 'ERR_JWT_INVALID',
        });
      }
    }

    // Attach store to request for use in protected routes
    (req as any).store = store;
    // Also attach userId from store's user_id for API key auth
    if (store && !((req as any).userId)) {
      (req as any).userId = store.user_id;
    }
    next();
  } catch (error: any) {
    logger.error('Auth middleware error:', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error',
      code: 'ERR_AUTH_MIDDLEWARE',
    });
  }
};

export const optionalAuth = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const apiKey = req.headers['x-api-key'] as string;
    const authorization = req.headers['authorization'] as string;

    // Try Supabase JWT first
    if (authorization && authorization.startsWith('Bearer ')) {
      const token = authorization.slice('Bearer '.length);
      try {
        const { data: { user: supaUser }, error } = await supabase.auth.getUser(token);
        if (!error && supaUser) {
          (req as any).userId = supaUser.id;
          const store = await prisma.store.findFirst({
            where: { user_id: supaUser.id },
          });
          (req as any).store = store;
        }
      } catch {
        // Invalid Supabase token, continue without auth
      }
    }

    // Check API key if available
    if (apiKey) {
      const store = await prisma.store.findUnique({
        where: { api_key: apiKey },
      });
      if (store) {
        (req as any).store = store;
      }
    }
    next();
  } catch (error: any) {
    next();
  }
};