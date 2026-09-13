import { prisma } from '../config/database';

export const creditService = {
  getBalance: async (storeId: string) => {
    const store = await prisma.store.findUnique({
      where: { id: storeId },
      select: { credits_balance: true, is_active: true },
    });

    if (!store) {
      throw new Error('Store not found');
    }

    return {
      credits_balance: store.credits_balance,
      is_active: store.is_active,
    };
  },

  purchaseCredits: async (storeId: string, amount: number) => {
    const store = await prisma.store.update({
      where: { id: storeId },
      data: {
        credits_balance: {
          increment: amount,
        },
        // Re-activate the store so it can use the API again after a purchase
        is_active: true,
      },
      select: { credits_balance: true, is_active: true },
    });

    // Log transaction
    await prisma.creditTransaction.create({
      data: {
        store_id: storeId,
        amount,
        transaction_type: 'purchase',
        description: `Purchased ${amount} credits`,
      },
    });

    return store.credits_balance;
  },

  getTransactions: async (storeId: string) => {
    const transactions = await prisma.creditTransaction.findMany({
      where: { store_id: storeId },
    });

    return transactions;
  },

  // Deduct credits for a try-on attempt
  deductCredits: async (storeId: string) => {
    const store = await prisma.store.findUnique({
      where: { id: storeId },
      select: { credits_balance: true, is_active: true },
    });

    if (!store) {
      throw new Error('Store not found');
    }

    if (store.credits_balance <= 0) {
      // Already out of credits - make sure the store is deactivated
      if (store.is_active) {
        await prisma.store.update({
          where: { id: storeId },
          data: { is_active: false },
        });
      }
      return { status: 'deactivated', credits_balance: 0 };
    }

    // Deduct 1 credit; deactivate when the balance hits exactly zero
    const deactivateOnZero = store.credits_balance === 1;
    const updatedStore = await prisma.store.update({
      where: { id: storeId },
      data: {
        credits_balance: {
          decrement: 1,
        },
        ...(deactivateOnZero ? { is_active: false } : {}),
      },
      select: { credits_balance: true },
    });

    // Log the usage transaction
    await prisma.creditTransaction.create({
      data: {
        store_id: storeId,
        amount: -1,
        transaction_type: 'usage',
        description: 'Credit used for try-on',
      },
    });

    return { status: 'deducted', credits_balance: updatedStore.credits_balance };
  },

  // Refund credits for a failed try-on
  refundCredits: async (storeId: string) => {
    const store = await prisma.store.findUnique({
      where: { id: storeId },
      select: { credits_balance: true, is_active: true },
    });

    if (!store) {
      throw new Error('Store not found');
    }

    // Increase credits by 1; re-activate the store if it was deactivated at 0 credits
    const updatedStore = await prisma.store.update({
      where: { id: storeId },
      data: {
        credits_balance: {
          increment: 1,
        },
        is_active: true,
      },
      select: { credits_balance: true },
    });

    // Log the refund transaction
    await prisma.creditTransaction.create({
      data: {
        store_id: storeId,
        amount: 1,
        transaction_type: 'refund',
        description: 'Credit refunded for failed try-on',
      },
    });

    return { status: 'refunded', credits_balance: updatedStore.credits_balance };
  },
};