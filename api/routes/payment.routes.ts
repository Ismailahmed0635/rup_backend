import { Router } from 'express';
import { body, param } from 'express-validator';
import { paymentController } from '../controllers/payment.controller';
import { verifyCallbackAuth } from '../../src/middleware/admin.middleware';
import { authenticate } from '../../src/middleware/auth.middleware';
import { validateRequest } from '../../src/middleware/error.middleware';

const router = Router();

// Initiate payment (authenticated)
router.post(
  '/initiate',
  [
    body('storeId').notEmpty().withMessage('Store ID required'),
    body('amount').isFloat({ min: 1 }).withMessage('Amount must be positive'),
    body('credits').isInt({ min: 1 }).withMessage('Credits must be positive'),
    body('method').isIn(['bkash', 'nagad', 'stripe']).withMessage('Invalid payment method'),
    body('phoneNumber').optional().isString(),
  ],
  validateRequest,
  authenticate,
  paymentController.initiate
);

// Check payment status (public - for gateway callbacks)
router.get(
  '/status/:paymentId',
  [param('paymentId').notEmpty()],
  validateRequest,
  paymentController.status
);

// Handle callback from payment gateway - webhook MUST present the shared secret
// (x-callback-secret header) or an admin key. Public unsigned callbacks would
// allow anyone to forge payment success and receive free credits.
router.post(
  '/callback',
  [
    body('paymentId').notEmpty().withMessage('Payment ID required'),
    body('status').isIn(['success', 'failed']).withMessage('Invalid status'),
    body('response').optional().isObject(),
  ],
  validateRequest,
  verifyCallbackAuth,
  paymentController.callback
);

// Get payment history (authenticated)
router.get(
  '/history/:storeId',
  authenticate,
  paymentController.history
);

export default router;
