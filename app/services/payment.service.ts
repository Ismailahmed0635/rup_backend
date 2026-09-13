import { prisma } from '../config/database';
import { v4 as uuidv4 } from 'uuid';
import { bkashService } from './bkash.service';
import { creditService } from './credit.service';
import logger from '../utils/logger';

export interface PaymentInitiation {
  storeId: string;
  amount: number;
  credits: number;
  method: 'bkash' | 'nagad' | 'stripe';
  phoneNumber?: string;
}

export interface PaymentResult {
  paymentId: string;
  status: 'pending' | 'processing' | 'completed' | 'failed';
  amount: number;
  credits: number;
  method: string;
  paymentUrl?: string;
  transactionId?: string | null;
}

export const paymentService = {
  // Initiate a payment
  initiatePayment: async (data: PaymentInitiation): Promise<PaymentResult> => {
    const { storeId, amount, credits, method, phoneNumber } = data;

    // Verify store exists
    const store = await prisma.store.findUnique({
      where: { id: storeId },
    });

    if (!store) {
      throw new Error('Store not found');
    }

    // Create payment record
    const paymentId = `PAY_${uuidv4().slice(0, 12).toUpperCase()}`;

    const payment = await prisma.payment.create({
      data: {
        payment_id: paymentId,
        store_id: storeId,
        amount,
        credits,
        method,
        status: 'pending',
        phone_number: phoneNumber,
        created_at: new Date(),
      },
    });

    logger.info(`Payment initiated: ${paymentId} for ${credits} credits (${amount} BDT)`);

    // Initiate payment based on method
    switch (method) {
      case 'bkash':
        return await paymentService.initiateBkashPayment(payment, phoneNumber);
      case 'nagad':
        return await paymentService.initiateNagadPayment(payment, phoneNumber);
      case 'stripe':
        return await paymentService.initiateStripePayment(payment);
      default:
        throw new Error('Invalid payment method');
    }
  },

  // Initiate bKash payment
  initiateBkashPayment: async (payment: any, phoneNumber?: string): Promise<PaymentResult> => {
    if (!phoneNumber) {
      throw new Error('Phone number required for bKash');
    }

    try {
      const result = await bkashService.initiateSTKPush(
        phoneNumber,
        payment.amount,
        payment.payment_id,
        `Rup Try-On: ${payment.credits} credits`
      );

      // Update payment with transaction ID
      await prisma.payment.update({
        where: { payment_id: payment.payment_id },
        data: {
          transaction_id: result.transaction_id,
          status: 'processing',
          gateway_response: JSON.stringify(result),
        },
      });

      return {
        paymentId: payment.payment_id,
        status: 'processing',
        amount: payment.amount,
        credits: payment.credits,
        method: 'bkash',
        transactionId: result.transaction_id,
      };
    } catch (error: any) {
      // Update payment as failed
      await prisma.payment.update({
        where: { payment_id: payment.payment_id },
        data: {
          status: 'failed',
          error_message: error.message,
        },
      });

      throw new Error(`bKash payment failed: ${error.message}`);
    }
  },

  // Initiate Nagad payment (placeholder)
  initiateNagadPayment: async (payment: any, phoneNumber?: string): Promise<PaymentResult> => {
    // TODO: Implement Nagad payment
    throw new Error('Nagad payment not yet implemented');
  },

  // Initiate Stripe payment (placeholder)
  initiateStripePayment: async (payment: any): Promise<PaymentResult> => {
    // TODO: Implement Stripe payment
    throw new Error('Stripe payment not yet implemented');
  },

  // Handle payment callback from gateway (idempotent: credits are only added once)
  handleCallback: async (paymentId: string, status: string, gatewayResponse: any): Promise<void> => {
    const payment = await prisma.payment.findUnique({
      where: { payment_id: paymentId },
    });

    if (!payment) {
      logger.error(`Payment not found for callback: ${paymentId}`);
      return;
    }

    const newStatus = status === 'success' ? 'completed' : 'failed';

    // Guarded transition: only pending/processing payments may move to completed/failed.
    // Duplicate/replayed/out-of-order callbacks then hit count === 0 and are ignored,
    // so credits can never be granted twice (PERF-013).
    const updated = await prisma.payment.updateMany({
      where: {
        payment_id: paymentId,
        status: { in: ['pending', 'processing'] },
      },
      data: {
        status: newStatus,
        gateway_response: typeof gatewayResponse === 'string' ? gatewayResponse : JSON.stringify(gatewayResponse ?? null),
        updated_at: new Date(),
      },
    });

    if (updated.count === 0) {
      logger.warn(`Duplicate/ignored callback for payment ${paymentId} (already ${payment.status})`);
      return;
    }

    // If payment successful, add credits to store (exactly once, on first transition)
    if (newStatus === 'completed') {
      await creditService.purchaseCredits(payment.store_id, payment.credits);
      logger.info(`Payment completed: ${paymentId} - ${payment.credits} credits added`);
    }
  },

  // Check payment status
  checkStatus: async (paymentId: string): Promise<PaymentResult> => {
    const payment = await prisma.payment.findUnique({
      where: { payment_id: paymentId },
    });

    if (!payment) {
      throw new Error('Payment not found');
    }

    return {
      paymentId: payment.payment_id,
      status: payment.status as any,
      amount: payment.amount,
      credits: payment.credits,
      method: payment.method,
      transactionId: payment.transaction_id,
    };
  },

  // Get payment history for a store
  getPaymentHistory: async (storeId: string): Promise<PaymentResult[]> => {
    const payments = await prisma.payment.findMany({
      where: { store_id: storeId },
      orderBy: { created_at: 'desc' },
      take: 50,
    });

    return payments.map(p => ({
      paymentId: p.payment_id,
      status: p.status as any,
      amount: p.amount,
      credits: p.credits,
      method: p.method,
      transactionId: p.transaction_id,
    }));
  },
};
