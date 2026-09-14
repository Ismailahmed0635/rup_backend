import { Request, Response } from 'express';
import { storeService } from '../../src/services/store.service';
import { prisma } from '../../src/config/database';

export const storeController = {
  register: async (req: Request, res: Response) => {
    try {
      const { store_name, platform, store_url, bank_account_name, bank_account_number, bank_routing_number } = req.body;
      const userId = (req as any).userId;
      if (!userId) {
        return res.status(401).json({ success: false, error: 'User not authenticated', code: 'ERR_NOT_AUTHENTICATED' });
      }
      const result = await storeService.register({ user_id: userId, store_name, platform, store_url, bank_account_name, bank_account_number, bank_routing_number });
      res.status(201).json({ success: true, data: result });
    } catch (error: any) {
      res.status(400).json({ success: false, error: error.message, code: 'ERR_STORE_REGISTER' });
    }
  },

  getStore: async (req: Request, res: Response) => {
    try {
      const store = await storeService.getStore(req.params.id);
      const authStore = (req as any).store;
      if (authStore && authStore.id !== store.id) {
        return res.status(403).json({ success: false, error: 'Access denied', code: 'ERR_FORBIDDEN' });
      }
      res.json({ success: true, data: store });
    } catch (error: any) {
      res.status(404).json({ success: false, error: error.message, code: 'ERR_STORE_GET' });
    }
  },

  getProducts: async (req: Request, res: Response) => {
    try {
      const authStore = (req as any).store;
      if (authStore && authStore.id !== req.params.id) {
        return res.status(403).json({ success: false, error: 'Access denied', code: 'ERR_FORBIDDEN' });
      }
      const products = await storeService.getProducts(req.params.id);
      res.json({ success: true, data: products });
    } catch (error: any) {
      res.status(404).json({ success: false, error: error.message, code: 'ERR_PRODUCTS_GET' });
    }
  },

  syncProducts: async (req: Request, res: Response) => {
    try {
      const authStore = (req as any).store;
      if (authStore && authStore.id !== req.params.id) {
        return res.status(403).json({ success: false, error: 'Access denied', code: 'ERR_FORBIDDEN' });
      }
      const products = await storeService.syncProducts(req.params.id);
      res.json({ success: true, data: { products, synced: products.length } });
    } catch (error: any) {
      res.status(400).json({ success: false, error: error.message, code: 'ERR_PRODUCTS_SYNC' });
    }
  },

  updateAccessToken: async (req: Request, res: Response) => {
    try {
      const authStore = (req as any).store;
      if (authStore && authStore.id !== req.params.id) {
        return res.status(403).json({ success: false, error: 'Access denied', code: 'ERR_FORBIDDEN' });
      }
      const { access_token } = req.body;
      const result = await storeService.updateAccessToken(req.params.id, access_token);
      res.json({ success: true, data: result });
    } catch (error: any) {
      res.status(400).json({ success: false, error: error.message, code: 'ERR_STORE_ACCESS_TOKEN' });
    }
  },

  toggleProduct: async (req: Request, res: Response) => {
    try {
      const { id, productId } = req.params;
      const authStore = (req as any).store;
      if (authStore && authStore.id !== id) {
        return res.status(403).json({ success: false, error: 'Access denied', code: 'ERR_FORBIDDEN' });
      }

      const product = await prisma.product.findFirst({
        where: { id: productId, store_id: id },
      });

      if (!product) {
        return res.status(404).json({ success: false, error: 'Product not found', code: 'ERR_PRODUCT_NOT_FOUND' });
      }

      const updated = await prisma.product.update({
        where: { id: productId },
        data: { is_tryon_enabled: !product.is_tryon_enabled },
      });

      res.json({ success: true, data: updated });
    } catch (error: any) {
      res.status(400).json({ success: false, error: error.message, code: 'ERR_PRODUCT_TOGGLE' });
    }
  },

  updateBankDetails: async (req: Request, res: Response) => {
    try {
      const { id } = req.params;
      const authStore = (req as any).store;
      if (authStore && authStore.id !== id) {
        return res.status(403).json({ success: false, error: 'Access denied', code: 'ERR_FORBIDDEN' });
      }

      const { bank_account_name, bank_account_number, bank_routing_number } = req.body;

      const store = await prisma.store.findUnique({ where: { id } });
      if (!store) {
        return res.status(404).json({ success: false, error: 'Store not found', code: 'ERR_STORE_NOT_FOUND' });
      }

      const updated = await prisma.store.update({
        where: { id },
        data: {
          bank_account_name,
          bank_account_number,
          bank_routing_number,
        },
      });

      res.json({ success: true, data: updated });
    } catch (error: any) {
      res.status(400).json({ success: false, error: error.message, code: 'ERR_BANK_UPDATE' });
    }
  },
};
