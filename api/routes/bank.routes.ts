import { Router, Request, Response } from 'express';
import { bankPaymentService } from '../../src/services/bank.payment.service';
import { authenticate } from '../../src/middleware/auth.middleware';
import { env } from '../../src/config/env';

const router = Router();

// Public: which bank account customers should transfer to (from server config)
router.get('/config', (req: Request, res: Response) => {
  const configured = Boolean(
    env.paymentBankName &&
    env.paymentBankAccountName &&
    env.paymentBankAccountNumber
  );

  if (!configured) {
    return res.json({ success: true, data: { configured: false } });
  }

  res.json({
    success: true,
    data: {
      configured: true,
      bank_name: env.paymentBankName,
      account_name: env.paymentBankAccountName,
      account_number: env.paymentBankAccountNumber,
      routing_number: env.paymentBankRoutingNumber || null,
      support_email: env.supportEmail || null,
    },
  });
});

router.post('/initiate', authenticate, async (req: Request, res: Response) => {
  try {
    const { storeId, amount, orderId, customerInfo } = req.body;
    const result = await bankPaymentService.initiatePayment(storeId, amount, orderId, customerInfo);
    res.json({ success: true, data: result });
  } catch (error: any) {
    res.status(400).json({ success: false, error: error.message });
  }
});

router.get('/status/:paymentId', async (req: Request, res: Response) => {
  try {
    const { paymentId } = req.params;
    const result = await bankPaymentService.checkStatus(paymentId);
    res.json({ success: true, data: result });
  } catch (error: any) {
    res.status(404).json({ success: false, error: error.message });
  }
});

router.post('/verify', authenticate, async (req: Request, res: Response) => {
  try {
    const { paymentId } = req.body;
    const result = await bankPaymentService.verifyPayment(paymentId);
    res.json({ success: true, data: result });
  } catch (error: any) {
    res.status(400).json({ success: false, error: error.message });
  }
});

router.get('/store/:storeId', authenticate, async (req: Request, res: Response) => {
  try {
    const { storeId } = req.params;
    const { status } = req.query;
    const result = await bankPaymentService.listStorePayments(storeId, status as string);
    res.json({ success: true, data: result });
  } catch (error: any) {
    res.status(400).json({ success: false, error: error.message });
  }
});

export default router;