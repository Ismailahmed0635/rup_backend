import { mockPrisma, mockSupabase } from './setup';
import { authService } from '../app/services/auth.service';

// Import setup first to mock dependencies
import './setup';

describe('AuthService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('register', () => {
    it('should register a new user successfully', async () => {
      const mockUser = {
        id: 'user-123',
        email: 'test@example.com',
        name: 'Test User',
        password: 'hashed_password',
      };

      const mockStore = {
        id: 'store-123',
        user_id: 'user-123',
        store_name: 'Test Store',
        api_key: 'sk_1234567890abcdef',
        credits_balance: 5,
        is_active: true,
      };

      const mockSupaData = {
        user: { id: 'supa-user-123' },
        session: { access_token: 'supa-jwt-token' },
      };

      mockPrisma.user.findUnique.mockResolvedValue(null);
      mockPrisma.user.create.mockResolvedValue(mockUser);
      mockPrisma.store.create.mockResolvedValue(mockStore);
      mockSupabase.auth.signUp.mockResolvedValue({ data: mockSupaData, error: null });

      const result = await authService.register({
        email: 'test@example.com',
        password: 'password123',
        name: 'Test User',
      });

      expect(result).toHaveProperty('user_id');
      expect(result).toHaveProperty('store_id');
      expect(result).toHaveProperty('api_key');
      expect(result).toHaveProperty('jwt_token');
      expect(result.credits_balance).toBe(5);
      expect(mockPrisma.user.create).toHaveBeenCalled();
      expect(mockPrisma.store.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            credits_balance: 0,
            is_active: true,
          }),
        })
      );
      expect(mockSupabase.auth.signUp).toHaveBeenCalled();
    });

    it('should throw error if user already exists', async () => {
      const existingUser = {
        id: 'user-123',
        email: 'test@example.com',
      };

      mockPrisma.user.findUnique.mockResolvedValue(existingUser);

      await expect(
        authService.register({
          email: 'test@example.com',
          password: 'password123',
        })
      ).rejects.toThrow('User already exists with this email');
    });

    it('should rollback local user if Supabase signup fails', async () => {
      const mockUser = {
        id: 'user-123',
        email: 'test@example.com',
      };

      mockPrisma.user.findUnique.mockResolvedValue(null);
      mockPrisma.user.create.mockResolvedValue(mockUser);
      mockSupabase.auth.signUp.mockResolvedValue({
        data: null,
        error: { message: 'Supabase error' },
      });

      await expect(
        authService.register({
          email: 'test@example.com',
          password: 'password123',
        })
      ).rejects.toThrow('Supabase error');

      expect(mockPrisma.user.delete).toHaveBeenCalledWith({
        where: { id: 'user-123' },
      });
    });
  });

  describe('login', () => {
    it('should login successfully with valid credentials', async () => {
      const mockSupaData = {
        user: { id: 'supa-user-123' },
        session: { access_token: 'supa-jwt-token', user: { id: 'supa-user-123' } },
      };

      const mockStore = {
        id: 'store-123',
        api_key: 'sk_1234567890abcdef',
        credits_balance: 10,
      };

      mockSupabase.auth.signInWithPassword.mockResolvedValue({
        data: mockSupaData,
        error: null,
      });
      mockPrisma.store.findFirst.mockResolvedValue(mockStore);

      const result = await authService.login({
        email: 'test@example.com',
        password: 'password123',
      });

      expect(result).toHaveProperty('jwt_token');
      expect(result.user_id).toBe('supa-user-123');
      expect(result.store_id).toBe('store-123');
    });

    it('should throw error with invalid credentials', async () => {
      mockSupabase.auth.signInWithPassword.mockResolvedValue({
        data: null,
        error: { message: 'Invalid credentials' },
      });

      await expect(
        authService.login({
          email: 'test@example.com',
          password: 'wrongpassword',
        })
      ).rejects.toThrow('Invalid credentials');
    });
  });
});
