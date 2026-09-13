import { Request, Response, NextFunction } from 'express';
import { env } from '../config/env';
/**
 * Internal admin middleware - for credit grants, payment verification, and
 * other operations that must never be callable by merchants.
 *
 * Requires header: x-admin-key: <ADMIN_API_KEY from env>
 * Fails closed: if ADMIN_API_KEY is not configured, ALL admin requests are denied.
 */
export const requireAdmin = (req: Request, res: Response, next: NextFunction) => {
  const provided = req.headers['x-admin-key'] as string | undefined;

  if (!env.adminApiKey) {
    return res.status(503).json({
      success: false,
      error: 'Admin operations not configured',
      code: 'ERR_ADMIN_NOT_CONFIGURED',
    });
  }

  if (!provided || provided !== env.adminApiKey) {
    return res.status(403).json({
      success: false,
      error: 'Admin key required',
      code: 'ERR_ADMIN_FORBIDDEN',
    });
  }

  next();
};

/**
 * Gateway callback verifier - payment gateway webhooks must present the shared
 * secret (x-callback-secret header). Fails closed when PAYMENT_CALLBACK_SECRET
 * is not configured: an unsigned callback endpoint would let anyone grant
 * themselves credits by forging "payment success" notifications.
 *
 * Admin key is also accepted so operators can manually mark a verified payment.
 */
export const verifyCallbackAuth = (req: Request, res: Response, next: NextFunction) => {
  const callbackSecret = req.headers['x-callback-secret'] as string | undefined;
  const adminKey = req.headers['x-admin-key'] as string | undefined;

  if (env.paymentCallbackSecret && callbackSecret === env.paymentCallbackSecret) {
    return next();
  }

  if (env.adminApiKey && adminKey === env.adminApiKey) {
    return next();
  }

  return res.status(403).json({
    success: false,
    error: 'Invalid callback signature',
    code: 'ERR_CALLBACK_FORBIDDEN',
  });
};
