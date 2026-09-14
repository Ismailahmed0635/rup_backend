import { Router } from 'express';
import { body } from 'express-validator';
import { tryonController } from '../controllers/tryon.controller';
import { validateRequest } from '../../src/middleware/error.middleware';
import { authenticate } from '../../src/middleware/auth.middleware';

const router = Router();

router.get('/store/:id', authenticate, tryonController.getSessions);

router.post(
  '/',
  [
    body('store_id').trim().notEmpty().withMessage('Store ID is required'),
    body('product_id').trim().notEmpty().withMessage('Product ID is required'),
    body('image_base64').trim().notEmpty().withMessage('Image is required'),
  ],
  validateRequest,
  authenticate,
  tryonController.create
);

router.get('/:jobId/status', authenticate, tryonController.getStatus);

router.get('/:jobId/result', authenticate, tryonController.getResult);

export default router;
