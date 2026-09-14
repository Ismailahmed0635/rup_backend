import { prisma } from '../config/database';
import { v4 as uuidv4 } from 'uuid';

export const bankPaymentService = {
  async initiatePayment(
    storeId: string,
    amount: number,
    orderId: string,
    customerInfo: { name: string; email: string; phone?: string }
  ): Promise<any> {
    const store = await prisma.store.findUnique({
      where: { id: storeId },
    });

    if (!store) throw new Error('Store not found');
    if (!store.bank_account_number || !store.bank_account_name) {
      throw new Error('Bank account not configured for this store');
    }

    const paymentId = `BNK_${uuidv4().slice(0, 12).toUpperCase()}`;

    const payment = await prisma.bankPayment.create({
      data: {
        payment_id: paymentId,
        store_id: storeId,
        order_id: orderId,
        amount,
        status: 'PENDING',
        customer_name: customerInfo.name,
        customer_email: customerInfo.email,
        customer_phone: customerInfo.phone,
        bank_account_name: store.bank_account_name,
        bank_account_number: store.bank_account_number,
        bank_routing_number: store.bank_routing_number,
        created_at: new Date(),
      },
    });

    return {
      payment_id: payment.payment_id,
      amount: payment.amount,
      status: payment.status,
      bank_details: {
        account_name: payment.bank_account_name,
        account_number: payment.bank_account_number,
        routing_number: payment.bank_routing_number,
      },
      instructions: `Transfer ${amount} BDT to ${payment.bank_account_name} (Account: ${payment.bank_account_number}) with reference: ${payment.payment_id}`,
    };
  },

  async checkStatus(paymentId: string): Promise<any> {
    const payment = await prisma.bankPayment.findUnique({
      where: { payment_id: paymentId },
    });

    if (!payment) throw new Error('Payment not found');

    return {
      payment_id: payment.payment_id,
      order_id: payment.order_id,
      amount: payment.amount,
      status: payment.status,
      customer_name: payment.customer_name,
      bank_details: {
        account_name: payment.bank_account_name,
        account_number: payment.bank_account_number,
        routing_number: payment.bank_routing_number,
      },
      created_at: payment.created_at,
      verified_at: payment.verified_at,
    };
  },

  async verifyPayment(paymentId: string): Promise<any> {
    const payment = await prisma.bankPayment.update({
      where: { payment_id: paymentId },
      data: {
        status: 'VERIFIED',
        verified_at: new Date(),
      },
    });

    return {
      payment_id: payment.payment_id,
      status: payment.status,
      verified_at: payment.verified_at,
    };
  },

  async listStorePayments(storeId: string, status?: string): Promise<any[]> {
    const payments = await prisma.bankPayment.findMany({
      where: {
        store_id: storeId,
        ...(status && { status }),
      },
      orderBy: { created_at: 'desc' },
    });

    return payments.map(p => ({
      payment_id: p.payment_id,
      order_id: p.order_id,
      amount: p.amount,
      status: p.status,
      created_at: p.created_at,
      verified_at: p.verified_at,
    }));
  },
};