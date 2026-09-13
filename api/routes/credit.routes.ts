import { Router } from 'express';
import { body } from 'express-validator';
import { creditController } from '../controllers/credit.controller';
import { validateRequest } from '../../app/middleware/error.middleware';
import { authenticate } from '../../app/middleware/auth.middleware';
import { requireAdmin } from '../../app/middleware/admin.middleware';

const router = Router();

router.get('/:id/credits', authenticate, creditController.getBalance);

// SECURITY: admin-only. This endpoint grants credits directly and must never be
// callable by merchants (previously ANY authenticated store could self-credit).
// Credit grants now happen only after payment verification (admin or gateway flow).
router.post(
  '/:id/credits/purchase',
  [body('amount').isInt({ min: 1 }).withMessage('Amount must be a positive integer')],
  validateRequest,
  requireAdmin,
  creditController.purchase
);

router.get('/:id/credits/transactions', authenticate, creditController.getTransactions);

router.post('/:id/credits/deduct', authenticate, creditController.deduct);

router.post('/:id/credits/refund', authenticate, creditController.refund);

export default router;
