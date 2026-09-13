import axios from 'axios';
import logger from '../utils/logger';

const OPENTRYON_URL = process.env.OPENTRYON_URL || 'http://localhost:8001';

function handleAxiosError(error: unknown, context: string): never {
  if (axios.isAxiosError(error)) {
    if (error.code === 'ECONNABORTED' || error.code === 'ETIMEDOUT') {
      throw new Error(`${context} - Request timeout`);
    }
    if (error.response?.data?.detail) {
      throw new Error(`${context} - ${error.response.data.detail}`);
    }
    if (error.response?.status === 404) {
      throw new Error(`${context} - Job not found`);
    }
    if (error.response?.status === 500) {
      throw new Error(`${context} - Server error`);
    }
  }
  const message = error instanceof Error ? error.message : String(error);
  throw new Error(`${context} - ${message}`);
}

// Retry wrapper - ONLY for idempotent GET calls.
// Never use for POST /tryon: a retry after a successful-but-slow attempt would
// create a duplicate remote AI job while the local row already recorded one.
async function withRetry<T>(
  fn: () => Promise<T>,
  context: string,
  maxAttempts: number = 3,
  baseDelay: number = 2000
): Promise<T> {
  let attempts = 0;

  while (attempts < maxAttempts) {
    try {
      return await fn();
    } catch (error) {
      attempts++;
      logger.warn(`${context} - Attempt ${attempts}/${maxAttempts} failed`);

      if (attempts === maxAttempts) {
        throw error;
      }

      // Exponential backoff
      const delay = baseDelay * Math.pow(2, attempts - 1);
      await new Promise(resolve => setTimeout(resolve, delay));
    }
  }

  throw new Error(`${context} - Max attempts exceeded`);
}

export const klingService = {
  createJob: async (personImageBase64: string, garmentImageBase64?: string) => {
    const payload: any = {
      person_image: personImageBase64,
      garment_image: garmentImageBase64 || personImageBase64,
    };

    // No retry on this non-idempotent POST (duplicate job risk)
    const response = await axios.post(`${OPENTRYON_URL}/tryon`, payload, {
      headers: { 'Content-Type': 'application/json' },
      timeout: 30000,
    });

    return {
      jobId: response.data.job_id,
      status: response.data.status || 'processing',
      resultUrl: undefined,
      estimatedTime: undefined,
    };
  },

  getStatus: async (jobId: string) => {
    try {
      const response = await axios.get(`${OPENTRYON_URL}/tryon/${jobId}/status`, {
        timeout: 10000,
      });

      return {
        jobId,
        status: response.data.status || 'processing',
        progress: response.data.status === 'completed' ? 100 : undefined,
      };
    } catch (error) {
      handleAxiosError(error, 'Get status failed');
    }
  },

  getResult: async (jobId: string) => {
    try {
      const response = await axios.get(`${OPENTRYON_URL}/tryon/${jobId}/result`, {
        timeout: 10000,
      });

      const data = response.data;

      return {
        jobId,
        status: data.status || 'processing',
        resultImageUrl: data.result_image_url || undefined,
        errorMessage: data.error_message || undefined,
      };
    } catch (error) {
      handleAxiosError(error, 'Get result failed');
    }
  },
};
