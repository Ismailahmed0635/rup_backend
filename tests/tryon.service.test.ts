import { mockPrisma } from './setup';
import { tryonService } from '../app/services/tryon.service';

// Import setup first to mock dependencies
import './setup';

// Mock kling service
jest.mock('../app/services/kling.service', () => ({
  klingService: {
    createJob: jest.fn(),
    getStatus: jest.fn(),
    getResult: jest.fn(),
  },
}));

import { klingService } from '../app/services/kling.service';

describe('TryOnService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('getSessionsByStore', () => {
    it('should return sessions for a store', async () => {
      const mockSessions = [
        {
          id: 'session-1',
          job_id: 'job_123',
          status: 'completed',
          product_id: 'prod-1',
          credits_used: 1,
          created_at: new Date(),
          completed_at: new Date(),
          product: {
            id: 'prod-1',
            title: 'Test Product',
            image_url: 'https://example.com/image.jpg',
          },
        },
      ];

      mockPrisma.tryOnSession.findMany.mockResolvedValue(mockSessions);

      const result = await tryonService.getSessionsByStore('store-123');

      expect(result).toHaveLength(1);
      expect(result[0].product_name).toBe('Test Product');
    });
  });

  describe('createTryon', () => {
    it('should create a try-on session successfully', async () => {
      const mockSession = {
        id: 'session-123',
        store_id: 'store-123',
        product_id: 'prod-123',
        status: 'pending',
        job_id: 'job_local',
        credits_used: 1,
      };

      const mockKlingResult = {
        jobId: 'kling-job-123',
        status: 'processing',
      };

      // Atomic guarded decrement succeeds
      mockPrisma.store.updateMany.mockResolvedValue({ count: 1 });
      // Post-decrement balance check: still above zero
      mockPrisma.store.findUnique.mockResolvedValue({ credits_balance: 9, is_active: true });
      mockPrisma.tryOnSession.create.mockResolvedValue(mockSession);
      mockPrisma.creditTransaction.create.mockResolvedValue({});
      mockPrisma.tryOnSession.update.mockResolvedValue({});
      (klingService.createJob as jest.Mock).mockResolvedValue(mockKlingResult);

      const result = await tryonService.createTryon({
        store_id: 'store-123',
        product_id: 'prod-123',
        image_base64: 'base64image',
      });

      expect(result).toHaveProperty('job_id');
      expect(result.job_id).toBe('kling-job-123');
      expect(result.status).toBe('processing');
      expect(result.credits_deducted).toBe(1);

      // Atomic guarded decrement must be used (credits_balance > 0 guard)
      expect(mockPrisma.store.updateMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            credits_balance: { gt: 0 },
          }),
        })
      );
    });

    it('should throw error if insufficient credits (atomic guard rejects)', async () => {
      // Guarded decrement matches no rows -> insufficient credits
      mockPrisma.store.updateMany.mockResolvedValue({ count: 0 });

      await expect(
        tryonService.createTryon({
          store_id: 'store-123',
          product_id: 'prod-123',
          image_base64: 'base64image',
        })
      ).rejects.toThrow('Insufficient credits');
    });

    it('should refund credits if Kling API fails', async () => {
      const mockSession = {
        id: 'session-123',
        store_id: 'store-123',
        product_id: 'prod-123',
        status: 'pending',
        job_id: 'job_local',
        credits_used: 1,
      };

      mockPrisma.store.updateMany.mockResolvedValue({ count: 1 });
      mockPrisma.store.findUnique.mockResolvedValue({ credits_balance: 9, is_active: true });
      mockPrisma.tryOnSession.create.mockResolvedValue(mockSession);
      mockPrisma.tryOnSession.update.mockResolvedValue({});
      mockPrisma.creditTransaction.create.mockResolvedValue({});
      mockPrisma.store.update.mockResolvedValue({ credits_balance: 10 });
      (klingService.createJob as jest.Mock).mockRejectedValue(new Error('AI service unavailable'));

      await expect(
        tryonService.createTryon({
          store_id: 'store-123',
          product_id: 'prod-123',
          image_base64: 'base64image',
        })
      ).rejects.toThrow('AI service unavailable');

      // Verify session was marked as failed
      expect(mockPrisma.tryOnSession.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            status: 'failed',
          }),
        })
      );

      // Verify refund was created
      expect(mockPrisma.creditTransaction.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            transaction_type: 'refund',
          }),
        })
      );

      // Verify credit refund on the store
      expect(mockPrisma.store.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            credits_balance: expect.objectContaining({ increment: 1 }),
          }),
        })
      );
    });

    it('should deactivate the store when the last credit is used', async () => {
      const mockSession = {
        id: 'session-123',
        store_id: 'store-123',
        product_id: 'prod-123',
        status: 'pending',
        job_id: 'job_local',
        credits_used: 1,
      };

      mockPrisma.store.updateMany.mockResolvedValue({ count: 1 });
      // Post-decrement balance is zero
      mockPrisma.store.findUnique.mockResolvedValue({ credits_balance: 0, is_active: true });
      mockPrisma.tryOnSession.create.mockResolvedValue(mockSession);
      mockPrisma.creditTransaction.create.mockResolvedValue({});
      (klingService.createJob as jest.Mock).mockResolvedValue({
        jobId: 'kling-job-123',
        status: 'processing',
      });
      mockPrisma.tryOnSession.update.mockResolvedValue({});
      mockPrisma.store.update.mockResolvedValue({});

      await tryonService.createTryon({
        store_id: 'store-123',
        product_id: 'prod-123',
        image_base64: 'base64image',
      });

      // Deactivation update must have been issued
      expect(mockPrisma.store.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            is_active: false,
          }),
        })
      );
    });

    it('should re-activate the store when the last credit is refunded after a Kling failure', async () => {
      const mockSession = {
        id: 'session-123',
        store_id: 'store-123',
        product_id: 'prod-123',
        status: 'pending',
        job_id: 'job_local',
        credits_used: 1,
      };

      mockPrisma.store.updateMany.mockResolvedValue({ count: 1 });
      mockPrisma.store.findUnique.mockResolvedValue({ credits_balance: 0, is_active: false });
      mockPrisma.tryOnSession.create.mockResolvedValue(mockSession);
      mockPrisma.tryOnSession.update.mockResolvedValue({});
      mockPrisma.store.update.mockResolvedValue({});
      mockPrisma.creditTransaction.create.mockResolvedValue({});
      (klingService.createJob as jest.Mock).mockRejectedValue(new Error('AI service unavailable'));

      await expect(
        tryonService.createTryon({
          store_id: 'store-123',
          product_id: 'prod-123',
          image_base64: 'base64image',
        })
      ).rejects.toThrow('AI service unavailable');

      // Refund update must re-activate the store
      expect(mockPrisma.store.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            credits_balance: expect.objectContaining({ increment: 1 }),
            is_active: true,
          }),
        })
      );
    });
  });

  describe('getStatus', () => {
    it('should return terminal status from database without provider call', async () => {
      mockPrisma.tryOnSession.findFirst.mockResolvedValue({
        id: 'session-123',
        job_id: 'job_123',
        status: 'completed',
      });

      const result = await tryonService.getStatus('job_123');

      expect(result).toHaveProperty('status');
      expect(result.status).toBe('completed');
      // Terminal status must be served from DB, no provider round trip
      expect(klingService.getStatus).not.toHaveBeenCalled();
    });

    it('should sync non-terminal status from the provider and persist it', async () => {
      mockPrisma.tryOnSession.findFirst.mockResolvedValue({
        id: 'session-123',
        job_id: 'job_123',
        status: 'processing',
      });
      (klingService.getStatus as jest.Mock).mockResolvedValue({
        job_id: 'job_123',
        status: 'completed',
      });
      mockPrisma.tryOnSession.update.mockResolvedValue({});

      const result = await tryonService.getStatus('job_123');

      expect(result.status).toBe('completed');
      // The DB row must be advanced (state machine), including completed_at
      expect(mockPrisma.tryOnSession.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'session-123' },
          data: expect.objectContaining({
            status: 'completed',
            completed_at: expect.any(Date),
          }),
        })
      );
    });

    it('should fallback to Kling API if session not found', async () => {
      const mockKlingResult = {
        job_id: 'job_123',
        status: 'processing',
      };

      mockPrisma.tryOnSession.findFirst.mockResolvedValue(null);
      (klingService.getStatus as jest.Mock).mockResolvedValue(mockKlingResult);

      const result = await tryonService.getStatus('job_123');

      expect(result.status).toBe('processing');
    });
  });

  describe('getResult', () => {
    it('should return result from database if available (lookup by local session id)', async () => {
      mockPrisma.tryOnSession.findFirst.mockResolvedValue({
        id: 'session-123',
        job_id: 'kling-job-123',
        status: 'completed',
        product_id: 'prod-123',
      });

      const mockResult = {
        session_id: 'session-123',
        status: 'completed',
        result_image_url: 'https://example.com/result.jpg',
        error_message: null,
      };

      mockPrisma.tryOnResult.findFirst.mockResolvedValue(mockResult);

      const result = await tryonService.getResult('kling-job-123');

      expect(result.result_image_url).toBe('https://example.com/result.jpg');
      // Must resolve the session by job_id, then search results by the LOCAL session id
      expect(mockPrisma.tryOnResult.findFirst).toHaveBeenCalledWith({
        where: { session_id: 'session-123' },
      });
    });

    it('should return not_found if session does not exist', async () => {
      mockPrisma.tryOnSession.findFirst.mockResolvedValue(null);
      mockPrisma.tryOnResult.findFirst.mockResolvedValue(null);

      const result = await tryonService.getResult('nonexistent');

      expect(result.status).toBe('not_found');
    });
  });
});
