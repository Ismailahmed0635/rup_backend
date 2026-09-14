import { Request, Response } from 'express';
import { tryonService } from '../../src/services/tryon.service';

export const tryonController = {
  getSessions: async (req: Request, res: Response) => {
    try {
      const { id } = req.params;
      const authStore = (req as any).store;
      if (authStore && authStore.id !== id) {
        return res.status(403).json({ success: false, error: 'Access denied', code: 'ERR_FORBIDDEN' });
      }
      const sessions = await tryonService.getSessionsByStore(id);
      res.json({ success: true, data: sessions });
    } catch (error: any) {
      res.status(500).json({ success: false, error: error.message, code: 'ERR_SESSIONS_LIST' });
    }
  },

  create: async (req: Request, res: Response) => {
    try {
      const { store_id, product_id, image_base64 } = req.body;
      const authStore = (req as any).store;
      if (authStore && authStore.id !== store_id) {
        return res.status(403).json({ success: false, error: 'Access denied', code: 'ERR_FORBIDDEN' });
      }
      const result = await tryonService.createTryon({ store_id, product_id, image_base64 });
      res.status(201).json({ success: true, data: result });
    } catch (error: any) {
      res.status(400).json({ success: false, error: error.message, code: 'ERR_TRYON_CREATE' });
    }
  },

  getStatus: async (req: Request, res: Response) => {
    try {
      const result = await tryonService.getStatus(req.params.jobId);
      res.json({ success: true, data: result });
    } catch (error: any) {
      res.status(404).json({ success: false, error: error.message, code: 'ERR_TRYON_STATUS' });
    }
  },

  getResult: async (req: Request, res: Response) => {
    try {
      const result = await tryonService.getResult(req.params.jobId);
      res.json({ success: true, data: result });
    } catch (error: any) {
      res.status(404).json({ success: false, error: error.message, code: 'ERR_TRYON_RESULT' });
    }
  },
};
