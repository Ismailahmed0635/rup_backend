import { mockPrisma } from './setup';
import { creditService } from '../app/services/credit.service';

// Import setup first to mock dependencies
import './setup';

describe('CreditService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('getBalance', () => {
    it('should return credit balance for a store', async () => {
      const mockStore = {
        credits_balance: 100,
        is_active: true,
      };

      mockPrisma.store.findUnique.mockResolvedValue(mockStore);

      const result = await creditService.getBalance('store-123');

      expect(result.credits_balance).toBe(100);
      expect(result.is_active).toBe(true);
    });

    it('should throw error if store not found', async () => {
      mockPrisma.store.findUnique.mockResolvedValue(null);

      await expect(creditService.getBalance('nonexistent')).rejects.toThrow('Store not found');
    });
  });

  describe('purchaseCredits', () => {
    it('should add credits to store', async () => {
      const mockStore = {
        credits_balance: 105,
      };

      mockPrisma.store.update.mockResolvedValue(mockStore);
      mockPrisma.creditTransaction.create.mockResolvedValue({});

      const result = await creditService.purchaseCredits('store-123', 5);

      expect(result).toBe(105);
      expect(mockPrisma.store.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'store-123' },
          data: expect.objectContaining({
            credits_balance: expect.objectContaining({
              increment: 5,
            }),
          }),
        })
      );
      expect(mockPrisma.creditTransaction.create).toHaveBeenCalled();
    });

    it('should re-activate a deactivated store when credits are purchased', async () => {
      mockPrisma.store.update.mockResolvedValue({ credits_balance: 105, is_active: true });
      mockPrisma.creditTransaction.create.mockResolvedValue({});

      const result = await creditService.purchaseCredits('store-123', 5);

      expect(result).toBe(105);
      expect(mockPrisma.store.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ is_active: true }),
        })
      );
    });
  });

  describe('deductCredits', () => {
    it('should deduct 1 credit from store', async () => {
      const mockStore = {
        credits_balance: 99,
        is_active: true,
      };

      mockPrisma.store.findUnique.mockResolvedValue({ credits_balance: 100, is_active: true });
      mockPrisma.store.update.mockResolvedValue(mockStore);
      mockPrisma.creditTransaction.create.mockResolvedValue({});

      const result = await creditService.deductCredits('store-123');

      expect(result.status).toBe('deducted');
      expect(result.credits_balance).toBe(99);
    });

    it('should deactivate store when credits hit zero', async () => {
      mockPrisma.store.findUnique.mockResolvedValue({ credits_balance: 0, is_active: true });
      mockPrisma.store.update.mockResolvedValue({});

      const result = await creditService.deductCredits('store-123');

      expect(result.status).toBe('deactivated');
      expect(result.credits_balance).toBe(0);
      expect(mockPrisma.store.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ is_active: false }),
        })
      );
    });

    it('should deactivate store when the last credit is spent (1 -> 0)', async () => {
      mockPrisma.store.findUnique.mockResolvedValue({ credits_balance: 1, is_active: true });
      mockPrisma.store.update.mockResolvedValue({ credits_balance: 0 });
      mockPrisma.creditTransaction.create.mockResolvedValue({});

      const result = await creditService.deductCredits('store-123');

      expect(result.status).toBe('deducted');
      expect(result.credits_balance).toBe(0);
      expect(mockPrisma.store.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ is_active: false }),
        })
      );
    });

    it('should not deactivate when credits remain after deduction', async () => {
      mockPrisma.store.findUnique.mockResolvedValue({ credits_balance: 5, is_active: true });
      mockPrisma.store.update.mockResolvedValue({ credits_balance: 4 });
      mockPrisma.creditTransaction.create.mockResolvedValue({});

      const result = await creditService.deductCredits('store-123');

      expect(result.status).toBe('deducted');
      expect(result.credits_balance).toBe(4);
      const updateCall = mockPrisma.store.update.mock.calls[0][0] as any;
      expect(updateCall.data.is_active).toBeUndefined();
    });

    it('should throw error if store not found', async () => {
      mockPrisma.store.findUnique.mockResolvedValue(null);

      await expect(creditService.deductCredits('nonexistent')).rejects.toThrow('Store not found');
    });
  });

  describe('refundCredits', () => {
    it('should refund 1 credit to store', async () => {
      const mockStore = {
        credits_balance: 101,
      };

      mockPrisma.store.findUnique.mockResolvedValue({ credits_balance: 100, is_active: true });
      mockPrisma.store.update.mockResolvedValue(mockStore);
      mockPrisma.creditTransaction.create.mockResolvedValue({});

      const result = await creditService.refundCredits('store-123');

      expect(result.status).toBe('refunded');
      expect(result.credits_balance).toBe(101);
    });

    it('should re-activate a deactivated store when refunded', async () => {
      mockPrisma.store.findUnique.mockResolvedValue({ credits_balance: 0, is_active: false });
      mockPrisma.store.update.mockResolvedValue({ credits_balance: 1 });
      mockPrisma.creditTransaction.create.mockResolvedValue({});

      const result = await creditService.refundCredits('store-123');

      expect(result.status).toBe('refunded');
      expect(result.credits_balance).toBe(1);
      expect(mockPrisma.store.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ is_active: true }),
        })
      );
    });
  });

  describe('getTransactions', () => {
    it('should return transactions for a store', async () => {
      const mockTransactions = [
        {
          id: 'tx-1',
          store_id: 'store-123',
          amount: 5,
          transaction_type: 'purchase',
          created_at: new Date(),
        },
        {
          id: 'tx-2',
          store_id: 'store-123',
          amount: -1,
          transaction_type: 'usage',
          created_at: new Date(),
        },
      ];

      mockPrisma.creditTransaction.findMany.mockResolvedValue(mockTransactions);

      const result = await creditService.getTransactions('store-123');

      expect(result).toHaveLength(2);
      expect(result[0].transaction_type).toBe('purchase');
    });
  });
});
