import { prisma } from '../config/database';
import { v4 as uuidv4 } from 'uuid';
import { klingService } from './kling.service';
import { creditService } from './credit.service';
import logger from '../utils/logger';

const TERMINAL_STATUSES = new Set(['completed', 'failed']);

export const tryonService = {
  getSessionsByStore: async (storeId: string) => {
    const sessions = await prisma.tryOnSession.findMany({
      where: { store_id: storeId },
      include: {
        product: {
          select: {
            id: true,
            title: true,
            image_url: true,
          },
        },
      },
      orderBy: { created_at: 'desc' },
    });

    return sessions.map(session => ({
      id: session.id,
      job_id: session.job_id,
      status: session.status,
      product_id: session.product_id,
      product_name: session.product?.title || 'Unknown Product',
      product_image: session.product?.image_url,
      credits_used: session.credits_used,
      created_at: session.created_at,
      completed_at: session.completed_at,
    }));
  },

  createTryon: async ({ store_id, product_id, image_base64 }: { store_id: string; product_id: string; image_base64: string }) => {
    // Phase 1 (SHORT transaction): atomically debit credits and create the session.
    // The AI network call happens OUTSIDE this transaction so SQLite writes are
    // never blocked while we wait on the provider (PERF-006).
    const localJobId = `job_${uuidv4().replace(/-/g, '')}`;

    const session = await prisma.$transaction(async (tx) => {
      // Atomic guarded decrement: only succeeds if credits_balance > 0.
      // Prevents the read-then-decrement overdraw race.
      const debited = await tx.store.updateMany({
        where: { id: store_id, credits_balance: { gt: 0 }, is_active: true },
        data: { credits_balance: { decrement: 1 } },
      });

      if (debited.count === 0) {
        throw new Error('Insufficient credits');
      }

      // Deactivate the store when the balance hits zero
      const store = await tx.store.findUnique({
        where: { id: store_id },
        select: { credits_balance: true, is_active: true },
      });
      if (store && store.credits_balance === 0 && store.is_active) {
        await tx.store.update({
          where: { id: store_id },
          data: { is_active: false },
        });
      }

      const created = await tx.tryOnSession.create({
        data: {
          store_id,
          product_id,
          status: 'pending',
          job_id: localJobId,
          credits_used: 1,
        },
      });

      await tx.creditTransaction.create({
        data: {
          store_id,
          amount: -1,
          transaction_type: 'usage',
          description: 'Credit used for try-on',
        },
      });

      return created;
    });

    // Phase 2 (outside transaction): submit the job to the AI provider
    let klingResult: { jobId: string; status: string; resultUrl?: string };
    try {
      klingResult = await klingService.createJob(image_base64);
    } catch (error: any) {
      logger.error('Kling API failed, refunding credits:', error);

      // Phase 3 (small transaction): mark failed and refund the credit
      await prisma.$transaction(async (tx) => {
        await tx.tryOnSession.update({
          where: { id: session.id },
          data: { status: 'failed', completed_at: new Date() },
        });

        await tx.store.update({
          where: { id: store_id },
          data: {
            credits_balance: { increment: 1 },
            is_active: true,
          },
        });

        await tx.creditTransaction.create({
          data: {
            store_id,
            amount: 1,
            transaction_type: 'refund',
            description: 'Credit refunded for failed AI try-on',
          },
        });
      });

      throw new Error(error.message || 'AI try-on failed');
    }

    // Record the provider job id so status/result lookups resolve by it
    await prisma.tryOnSession.update({
      where: { id: session.id },
      data: {
        job_id: klingResult.jobId,
        status: klingResult.status || 'processing',
      },
    });

    return {
      job_id: klingResult.jobId,
      status: klingResult.status || 'processing',
      store_id,
      product_id,
      credits_deducted: 1,
      result_url: klingResult.resultUrl,
    };
  },

  getStatus: async (jobId: string) => {
    const session = await prisma.tryOnSession.findFirst({
      where: { job_id: jobId },
    });

    if (!session) {
      // Not a local session - ask the provider directly (external job id)
      return klingService.getStatus(jobId);
    }

    // Terminal states are authoritative in the DB - no provider call needed
    if (TERMINAL_STATUSES.has(session.status)) {
      return {
        job_id: session.job_id,
        status: session.status,
      };
    }

    // Non-terminal: sync from the provider and persist transitions (PERF-007).
    // Without this, sessions never reach "completed" and clients poll forever.
    try {
      const provider = await klingService.getStatus(session.job_id || jobId);

      if (provider.status === 'completed' || provider.status === 'failed') {
        await prisma.tryOnSession.update({
          where: { id: session.id },
          data: {
            status: provider.status,
            ...(provider.status === 'completed' ? { completed_at: new Date() } : {}),
          },
        });
        return {
          job_id: session.job_id,
          status: provider.status,
        };
      }

      if (provider.status && provider.status !== session.status) {
        await prisma.tryOnSession.update({
          where: { id: session.id },
          data: { status: provider.status },
        });
      }
    } catch (error) {
      // Provider unreachable - keep serving the DB status so clients can keep polling
      logger.warn(`Status sync failed for job ${jobId}:`, error);
    }

    return {
      job_id: session.job_id,
      status: session.status,
    };
  },

  getResult: async (jobId: string) => {
    const session = await prisma.tryOnSession.findFirst({
      where: { job_id: jobId },
    });

    if (!session) {
      return {
        job_id: jobId,
        status: 'not_found',
        result_image_url: '',
        error_message: 'Try-on session not found',
      };
    }

    // Look results up by the LOCAL session id (TryOnResult.session_id stores it).
    // Searching by the provider job id here never matched (PERF-019).
    const result = await prisma.tryOnResult.findFirst({
      where: { session_id: session.id },
    });

    if (result) {
      return {
        job_id: session.job_id || jobId,
        status: result.status,
        result_image_url: result.result_image_url,
        error_message: result.error_message,
      };
    }

    if (session.status === 'failed') {
      return {
        job_id: session.job_id || jobId,
        status: 'failed',
        result_image_url: '',
        error_message: 'AI try-on failed',
      };
    }

    if (session.status === 'completed') {
      const klingResult = await klingService.getResult(session.job_id || jobId);

      // upsert guards against duplicate creates on concurrent calls
      const saved = await prisma.tryOnResult.upsert({
        where: { session_id: session.id },
        update: {
          result_image_url: klingResult.resultImageUrl || '',
          status: klingResult.status,
        },
        create: {
          session_id: session.id,
          product_id: session.product_id,
          result_image_url: klingResult.resultImageUrl || '',
          status: klingResult.status,
        },
      });

      return {
        job_id: session.job_id || jobId,
        status: saved.status,
        result_image_url: saved.result_image_url,
        error_message: saved.error_message,
      };
    }

    // Still processing - sync status once, then report
    const statusInfo = await tryonService.getStatus(session.job_id || jobId);
    return {
      job_id: session.job_id || jobId,
      status: statusInfo.status,
      result_image_url: '',
      error_message: 'Processing',
    };
  },
};
