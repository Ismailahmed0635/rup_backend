import { Router } from 'express';
import { body } from 'express-validator';
import { storeController } from '../controllers/store.controller';
import { validateRequest } from '../../app/middleware/error.middleware';
import { authenticate } from '../../app/middleware/auth.middleware';

const router = Router();

router.post(
  '/register',
  [
    body('store_name').trim().notEmpty().withMessage('Store name is required'),
    body('platform').isIn(['shopify', 'woocommerce', 'wordpress', 'custom', 'bank_transfer']).withMessage('Valid platform required'),
    body('store_url').trim().notEmpty().withMessage('Store URL is required').isURL().withMessage('Valid store URL required'),
  ],
  validateRequest,
  authenticate,
  storeController.register
);

router.get('/:id', authenticate, storeController.getStore);

router.get('/:id/products', authenticate, storeController.getProducts);

router.post(
  '/:id/products/sync',
  [body('platform').optional().isIn(['shopify', 'woocommerce', 'wordpress', 'custom'])],
  authenticate,
  storeController.syncProducts
);

router.post(
  '/:id/access-token',
  [body('access_token').trim().notEmpty().withMessage('Access token is required')],
  authenticate,
  storeController.updateAccessToken
);

router.put(
  '/:id/products/:productId/toggle',
  authenticate,
  storeController.toggleProduct
);

router.put(
  '/:id/bank-details',
  [
    body('bank_account_name').trim().notEmpty().withMessage('Account name is required'),
    body('bank_account_number').trim().notEmpty().withMessage('Account number is required'),
    body('bank_routing_number').trim().notEmpty().withMessage('Routing number is required'),
  ],
  validateRequest,
  authenticate,
  storeController.updateBankDetails
);

export default router;
