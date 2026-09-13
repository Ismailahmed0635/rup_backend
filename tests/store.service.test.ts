import { mockPrisma } from './setup';
import { storeService } from '../app/services/store.service';

// Import setup first to mock dependencies
import './setup';

describe('StoreService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('register', () => {
    it('should register a new store successfully', async () => {
      const mockStore = {
        id: 'store-123',
        store_name: 'Test Store',
        platform: 'shopify',
        store_url: 'https://test.myshopify.com',
        api_key: 'sk_1234567890abcdef',
        credits_balance: 5,
        is_active: true,
      };

      mockPrisma.store.findFirst.mockResolvedValue(null);
      mockPrisma.store.create.mockResolvedValue(mockStore);

      const result = await storeService.register({
        user_id: 'user-123',
        store_name: 'Test Store',
        platform: 'shopify',
        store_url: 'https://test.myshopify.com',
      });

      expect(result).toHaveProperty('id');
      expect(result.store_name).toBe('Test Store');
      expect(result.credits_balance).toBe(5);
      expect(mockPrisma.store.create).toHaveBeenCalled();
    });

    it('should throw error if store URL already exists', async () => {
      const existingStore = {
        id: 'store-123',
        store_url: 'https://test.myshopify.com',
      };

      mockPrisma.store.findFirst.mockResolvedValue(existingStore);

      await expect(
        storeService.register({
          user_id: 'user-123',
          store_name: 'Test Store',
          platform: 'shopify',
          store_url: 'https://test.myshopify.com',
        })
      ).rejects.toThrow('Store already registered with this URL');
    });
  });

  describe('getStore', () => {
    it('should return store details', async () => {
      const mockStore = {
        id: 'store-123',
        store_name: 'Test Store',
        platform: 'shopify',
        store_url: 'https://test.myshopify.com',
        api_key: 'sk_1234567890abcdef',
        credits_balance: 100,
        is_active: true,
        created_at: new Date(),
      };

      mockPrisma.store.findUnique.mockResolvedValue(mockStore);

      const result = await storeService.getStore('store-123');

      expect(result.id).toBe('store-123');
      expect(result.store_name).toBe('Test Store');
    });

    it('should throw error if store not found', async () => {
      mockPrisma.store.findUnique.mockResolvedValue(null);

      await expect(storeService.getStore('nonexistent')).rejects.toThrow('Store not found');
    });
  });

  describe('getProducts', () => {
    it('should return products for a store', async () => {
      const mockProducts = [
        {
          id: 'prod-1',
          store_id: 'store-123',
          title: 'Test Product 1',
          image_url: 'https://example.com/image1.jpg',
          category: 'Clothing',
          is_tryon_enabled: true,
        },
        {
          id: 'prod-2',
          store_id: 'store-123',
          title: 'Test Product 2',
          image_url: 'https://example.com/image2.jpg',
          category: 'Accessories',
          is_tryon_enabled: false,
        },
      ];

      mockPrisma.product.findMany.mockResolvedValue(mockProducts);

      const result = await storeService.getProducts('store-123');

      expect(result).toHaveLength(2);
      expect(result[0].title).toBe('Test Product 1');
    });
  });

  describe('syncProducts', () => {
    it('should throw error if store not found', async () => {
      mockPrisma.store.findUnique.mockResolvedValue(null);

      await expect(storeService.syncProducts('nonexistent')).rejects.toThrow('Store not found');
    });

    it('should throw error if access token not configured', async () => {
      mockPrisma.store.findUnique.mockResolvedValue({
        id: 'store-123',
        platform: 'shopify',
        access_token: null,
        store_url: 'https://test.myshopify.com',
      });

      await expect(storeService.syncProducts('store-123')).rejects.toThrow(
        'Access token not configured'
      );
    });

    it('should throw error if store URL not configured', async () => {
      mockPrisma.store.findUnique.mockResolvedValue({
        id: 'store-123',
        platform: 'shopify',
        access_token: 'token123',
        store_url: null,
      });

      await expect(storeService.syncProducts('store-123')).rejects.toThrow(
        'Store URL not configured'
      );
    });
  });
});
