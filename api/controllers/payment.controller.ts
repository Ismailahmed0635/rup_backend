import { Request, Response } from 'express';
import { paymentService } from '../../app/services/payment.service';
import { body, param } from 'express-validator';

export const paymentController = {
  // Initiate payment
  initiate: async (req: Request, res: Response) => {
    try {
      const { storeId, amount, credits, method, phoneNumber } = req.body;

      // Verify store ownership
      const authStore = (req as any).store;
      if (authStore && authStore.id !== storeId) {
        return res.status(403).json({ 
          success: false, 
          error: 'Access denied',
          code: 'ERR_FORBIDDEN' 
        });
      }

      const result = await paymentService.initiatePayment({
        storeId,
        amount,
        credits,
        method,
        phoneNumber,
      });

      res.json({ success: true, data: result });
    } catch (error: any) {
      res.status(400).json({ 
        success: false, 
        error: error.message,
        code: 'ERR_PAYMENT_INITIATE' 
      });
    }
  },

  // Check payment status
  status: async (req: Request, res: Response) => {
    try {
      const { paymentId } = req.params;

      const result = await paymentService.checkStatus(paymentId);

      res.json({ success: true, data: result });
    } catch (error: any) {
      res.status(404).json({ 
        success: false, 
        error: error.message,
        code: 'ERR_PAYMENT_STATUS' 
      });
    }
  },

  // Handle callback from payment gateway
  callback: async (req: Request, res: Response) => {
    try {
      const { paymentId, status, response } = req.body;

      await paymentService.handleCallback(paymentId, status, response);

      res.json({ success: true });
    } catch (error: any) {
      res.status(400).json({ 
        success: false, 
        error: error.message,
        code: 'ERR_PAYMENT_CALLBACK' 
      });
    }
  },

  // Get payment history
  history: async (req: Request, res: Response) => {
    try {
      const { storeId } = req.params;

      // Verify store ownership
      const authStore = (req as any).store;
      if (authStore && authStore.id !== storeId) {
        return res.status(403).json({ 
          success: false, 
          error: 'Access denied',
          code: 'ERR_FORBIDDEN' 
        });
      }

      const result = await paymentService.getPaymentHistory(storeId);

      res.json({ success: true, data: result });
    } catch (error: any) {
      res.status(400).json({ 
        success: false, 
        error: error.message,
        code: 'ERR_PAYMENT_HISTORY' 
      });
    }
  },
};
