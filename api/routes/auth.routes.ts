import { Router } from 'express';
import { body } from 'express-validator';
import { authController } from '../controllers/auth.controller';
import { validateRequest } from '../../src/middleware/error.middleware';
import { authenticate } from '../../src/middleware/auth.middleware';

const router = Router();

router.post(
  '/register',
  [
    body('email').trim().notEmpty().withMessage('Email is required').isEmail().withMessage('Valid email required'),
    body('password').trim().notEmpty().withMessage('Password is required').isLength({ min: 6 }),
    body('name').optional().trim().notEmpty(),
  ],
  validateRequest,
  authController.register
);

router.post(
  '/login',
  [
    body('email').trim().notEmpty().withMessage('Email is required').isEmail().withMessage('Valid email required'),
    body('password').trim().notEmpty().withMessage('Password is required'),
  ],
  validateRequest,
  authController.login
);

router.post(
  '/refresh',
  [
    body('token').trim().notEmpty().withMessage('Token is required'),
  ],
  validateRequest,
  authController.refresh
);

router.post(
  '/logout',
  [
    body('api_key').trim().notEmpty().withMessage('API key is required'),
    body('token').trim().notEmpty().withMessage('JWT token is required'),
  ],
  validateRequest,
  authenticate,
  authController.logout
);

router.post(
  '/oauth/sync',
  [
    body('email').trim().notEmpty().withMessage('Email is required').isEmail().withMessage('Valid email required'),
    body('provider').trim().notEmpty().withMessage('Provider is required'),
    body('provider_user_id').trim().notEmpty().withMessage('Provider user ID is required'),
    body('jwt_token').trim().notEmpty().withMessage('JWT token is required'),
    body('name').optional().trim().notEmpty(),
  ],
  validateRequest,
  authController.oauthSync
);

router.post(
  '/forgot-password',
  [
    body('email').trim().notEmpty().withMessage('Email is required').isEmail().withMessage('Valid email required'),
  ],
  validateRequest,
  authController.forgotPassword
);

router.post(
  '/reset-password',
  [
    body('access_token').trim().notEmpty().withMessage('Access token is required'),
    body('refresh_token').trim().notEmpty().withMessage('Refresh token is required'),
    body('new_password').trim().notEmpty().withMessage('New password is required').isLength({ min: 6 }),
  ],
  validateRequest,
  authController.resetPassword
);

export default router;
