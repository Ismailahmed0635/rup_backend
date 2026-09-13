import { Router, Request, Response } from 'express';
import { body, param } from 'express-validator';
import { bkashService } from '../../app/services/bkash.service';
import { authenticate } from '../../app/middleware/auth.middleware';
import { verifyCallbackAuth } from '../../app/middleware/admin.middleware';
import { validateRequest } from '../../app/middleware/error.middleware';

const router = Router();

// STK push initiation - merchant-authenticated (charges real money)
router.post(
  '/initiate',
  [
    body('phoneNumber').trim().notEmpty().withMessage('Phone number is required'),
    body('amount').isFloat({ min: 1 }).withMessage('Amount must be positive'),
    body('transactionId').trim().notEmpty().withMessage('Transaction ID is required'),
  ],
  validateRequest,
  authenticate,
  async (req: Request, res: Response) => {
    try {
      const { phoneNumber, amount, transactionId } = req.body;
      const result = await bkashService.initiateSTKPush(phoneNumber, amount, transactionId);
      res.json({ success: true, data: result });
    } catch (error: any) {
      res.status(500).json({ success: false, error: error.message });
    }
  }
);

// Status check - merchant-authenticated
router.get(
  '/status/:transactionId',
  [param('transactionId').trim().notEmpty().withMessage('Transaction ID is required')],
  validateRequest,
  authenticate,
  async (req: Request, res: Response) => {
    try {
      const { transactionId } = req.params;
      const result = await bkashService.checkStatus(transactionId);
      res.json({ success: true, data: result });
    } catch (error: any) {
      res.status(500).json({ success: false, error: error.message });
    }
  }
);

export default router;
