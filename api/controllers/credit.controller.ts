import { Request, Response } from 'express';
import { creditService } from '../../app/services/credit.service';

export const creditController = {
  getBalance: async (req: Request, res: Response) => {
    try {
      const authStore = (req as any).store;
      if (authStore && authStore.id !== req.params.id) {
        return res.status(403).json({ success: false, error: 'Access denied', code: 'ERR_FORBIDDEN' });
      }
      const balance = await creditService.getBalance(req.params.id);
      res.json({ success: true, data: balance });
    } catch (error: any) {
      res.status(404).json({ success: false, error: error.message, code: 'ERR_CREDIT_GET' });
    }
  },

  purchase: async (req: Request, res: Response) => {
    try {
      const authStore = (req as any).store;
      if (authStore && authStore.id !== req.params.id) {
        return res.status(403).json({ success: false, error: 'Access denied', code: 'ERR_FORBIDDEN' });
      }
      const { amount } = req.body;
      const newBalance = await creditService.purchaseCredits(req.params.id, amount);
      res.json({ success: true, data: { credits_balance: newBalance } });
    } catch (error: any) {
      res.status(400).json({ success: false, error: error.message, code: 'ERR_CREDIT_PURCHASE' });
    }
  },

  getTransactions: async (req: Request, res: Response) => {
    try {
      const authStore = (req as any).store;
      if (authStore && authStore.id !== req.params.id) {
        return res.status(403).json({ success: false, error: 'Access denied', code: 'ERR_FORBIDDEN' });
      }
      const transactions = await creditService.getTransactions(req.params.id);
      res.json({ success: true, data: transactions });
    } catch (error: any) {
      res.status(404).json({ success: false, error: error.message, code: 'ERR_CREDIT_TRANSACTIONS' });
    }
  },

  deduct: async (req: Request, res: Response) => {
    try {
      const authStore = (req as any).store;
      if (authStore && authStore.id !== req.params.id) {
        return res.status(403).json({ success: false, error: 'Access denied', code: 'ERR_FORBIDDEN' });
      }
      const result = await creditService.deductCredits(req.params.id);

      if (result.status === 'deactivated') {
        return res.status(200).json({
          success: true,
          data: { message: 'Store deactivated - credits exhausted', credits_balance: 0, is_active: false },
        });
      }

      res.json({ success: true, data: { status: result.status, credits_balance: result.credits_balance } });
    } catch (error: any) {
      res.status(400).json({ success: false, error: error.message, code: 'ERR_CREDIT_DEDUCT' });
    }
  },

  refund: async (req: Request, res: Response) => {
    try {
      const authStore = (req as any).store;
      if (authStore && authStore.id !== req.params.id) {
        return res.status(403).json({ success: false, error: 'Access denied', code: 'ERR_FORBIDDEN' });
      }
      const result = await creditService.refundCredits(req.params.id);
      res.json({ success: true, data: { status: result.status, credits_balance: result.credits_balance } });
    } catch (error: any) {
      res.status(400).json({ success: false, error: error.message, code: 'ERR_CREDIT_REFUND' });
    }
  },
};
