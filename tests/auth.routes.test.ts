import request from 'supertest';
import express from 'express';

// Mock all dependencies before importing anything
jest.mock('../app/supabase', () => ({
  supabase: {
    auth: {
      signUp: jest.fn().mockResolvedValue({
        data: {
          user: { id: 'supa-user-123' },
          session: { access_token: 'supa-jwt-token' },
        },
        error: null,
      }),
      signInWithPassword: jest.fn().mockResolvedValue({
        data: {
          user: { id: 'supa-user-123' },
          session: { access_token: 'supa-jwt-token', user: { id: 'supa-user-123' } },
        },
        error: null,
      }),
      getUser: jest.fn().mockResolvedValue({
        data: { user: { id: 'supa-user-123' } },
        error: null,
      }),
      resetPasswordForEmail: jest.fn().mockResolvedValue({ error: null }),
    },
  },
}));

jest.mock('../app/config/database', () => ({
  prisma: {
    user: {
      findUnique: jest.fn().mockResolvedValue(null),
      create: jest.fn().mockResolvedValue({
        id: 'user-123',
        email: 'test@example.com',
        name: 'Test User',
      }),
    },
    store: {
      create: jest.fn().mockResolvedValue({
        id: 'store-123',
        api_key: 'sk_1234567890abcdef',
        credits_balance: 5,
      }),
      findFirst: jest.fn().mockResolvedValue({
        id: 'store-123',
        api_key: 'sk_1234567890abcdef',
        credits_balance: 10,
      }),
    },
    revokedToken: {
      upsert: jest.fn(),
    },
  },
}));

jest.mock('../app/utils/crypto', () => ({
  hashPassword: jest.fn().mockResolvedValue('hashed_password'),
  comparePassword: jest.fn().mockResolvedValue(true),
}));

jest.mock('uuid', () => ({
  v4: jest.fn().mockReturnValue('12345678-1234-1234-1234-123456789abc'),
}));

// Now import the app after mocking
import authRoutes from '../api/routes/auth.routes';

const app = express();
app.use(express.json());
app.use('/api/auth', authRoutes);

describe('Auth API Routes', () => {
  describe('POST /api/auth/register', () => {
    it('should register a new user', async () => {
      const response = await request(app)
        .post('/api/auth/register')
        .send({
          email: 'test@example.com',
          password: 'password123',
          name: 'Test User',
        });

      expect(response.status).toBe(201);
      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveProperty('user_id');
      expect(response.body.data).toHaveProperty('store_id');
      expect(response.body.data).toHaveProperty('api_key');
    });

    it('should return 400 if email is invalid', async () => {
      const response = await request(app)
        .post('/api/auth/register')
        .send({
          email: 'invalid-email',
          password: 'password123',
        });

      expect(response.status).toBe(400);
    });

    it('should return 400 if password is too short', async () => {
      const response = await request(app)
        .post('/api/auth/register')
        .send({
          email: 'test@example.com',
          password: '123',
        });

      expect(response.status).toBe(400);
    });
  });

  describe('POST /api/auth/login', () => {
    it('should login successfully', async () => {
      const response = await request(app)
        .post('/api/auth/login')
        .send({
          email: 'test@example.com',
          password: 'password123',
        });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveProperty('jwt_token');
    });

    it('should return 401 with invalid credentials', async () => {
      const { supabase } = require('../app/supabase');
      supabase.auth.signInWithPassword.mockResolvedValueOnce({
        data: null,
        error: { message: 'Invalid credentials' },
      });

      const response = await request(app)
        .post('/api/auth/login')
        .send({
          email: 'test@example.com',
          password: 'wrongpassword',
        });

      expect(response.status).toBe(401);
    });
  });

  describe('POST /api/auth/forgot-password', () => {
    it('should send password reset email', async () => {
      const response = await request(app)
        .post('/api/auth/forgot-password')
        .send({
          email: 'test@example.com',
        });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
    });

    it('should return 400 if email is invalid', async () => {
      const response = await request(app)
        .post('/api/auth/forgot-password')
        .send({
          email: 'invalid-email',
        });

      expect(response.status).toBe(400);
    });
  });
});
