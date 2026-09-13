import axios from 'axios';
import { prisma } from '../config/database';
import { v4 as uuidv4 } from 'uuid';
import crypto from 'crypto';
import { env } from '../config/env';

function encrypt(text: string): string {
  const key = crypto.scryptSync(env.encryptionKey, 'salt', 32);
  const iv = crypto.randomBytes(16);
  const cipher = crypto.createCipheriv('aes-256-cbc', key, iv);
  let encrypted = cipher.update(text, 'utf8', 'hex');
  encrypted += cipher.final('hex');
  return `${iv.toString('hex')}:${encrypted}`;
}

function decrypt(encryptedText: string): string {
  const [ivHex, encrypted] = encryptedText.split(':');
  const key = crypto.scryptSync(env.encryptionKey, 'salt', 32);
  const iv = Buffer.from(ivHex, 'hex');
  const decipher = crypto.createDecipheriv('aes-256-cbc', key, iv);
  let decrypted = decipher.update(encrypted, 'hex', 'utf8');
  decrypted += decipher.final('utf8');
  return decrypted;
}

interface ShopifyProduct {
  id: number;
  title: string;
  images: { src: string }[];
  product_type: string;
}

interface WooProduct {
  id: number;
  name: string;
  images: { src: string }[];
  categories: { name: string }[];
}

async function fetchShopifyProducts(storeUrl: string, accessToken: string): Promise<{ external_id: string; title: string; image_url: string | null; category: string | null }[]> {
  const baseUrl = storeUrl.replace(/\/+$/, '');
  const response = await axios.get<{ products: ShopifyProduct[] }>(
    `${baseUrl}/admin/api/2024-01/products.json`,
    {
      headers: {
        'X-Shopify-Access-Token': accessToken,
        'Content-Type': 'application/json',
      },
      timeout: 15000,
    }
  );

  return response.data.products.map((p) => ({
    external_id: String(p.id),
    title: p.title,
    image_url: p.images?.[0]?.src ?? null,
    category: p.product_type || null,
  }));
}

async function fetchWooProducts(storeUrl: string, consumerKey: string, consumerSecret: string): Promise<{ external_id: string; title: string; image_url: string | null; category: string | null }[]> {
  const baseUrl = storeUrl.replace(/\/+$/, '');
  const response = await axios.get<WooProduct[]>(
    `${baseUrl}/wp-json/wc/v3/products`,
    {
      params: {
        consumer_key: consumerKey,
        consumer_secret: consumerSecret,
        per_page: 100,
      },
      timeout: 15000,
    }
  );

  return response.data.map((p) => ({
    external_id: String(p.id),
    title: p.name,
    image_url: p.images?.[0]?.src ?? null,
    category: p.categories?.[0]?.name ?? null,
  }));
}

export const storeService = {
  register: async ({ user_id, store_name, platform, store_url, bank_account_name, bank_account_number, bank_routing_number }: { user_id: string; store_name: string; platform: string; store_url: string; bank_account_name?: string; bank_account_number?: string; bank_routing_number?: string }) => {
    const existingStore = await prisma.store.findFirst({
      where: { store_url },
    });

    if (existingStore) {
      throw new Error('Store already registered with this URL');
    }

    const api_key = `sk_${uuidv4().replace(/-/g, '')}`;

    const store = await prisma.store.create({
      data: {
        store_name,
        platform,
        store_url,
        api_key,
        credits_balance: 5,
        is_active: true,
        user_id,
        bank_account_name,
        bank_account_number,
        bank_routing_number,
      },
    });

    return {
      id: store.id,
      store_name: store.store_name,
      platform: store.platform,
      store_url: store.store_url,
      api_key: store.api_key,
      credits_balance: store.credits_balance,
    };
  },

  getStore: async (storeId: string) => {
    const store = await prisma.store.findUnique({
      where: { id: storeId },
      select: {
        id: true,
        store_name: true,
        platform: true,
        store_url: true,
        api_key: true,
        // access_token intentionally excluded - never expose store credentials
        credits_balance: true,
        is_active: true,
        created_at: true,
      },
    });

    if (!store) {
      throw new Error('Store not found');
    }

    return store;
  },

  updateAccessToken: async (storeId: string, accessToken: string) => {
    const store = await prisma.store.findUnique({ where: { id: storeId } });
    if (!store) throw new Error('Store not found');

    const encryptedToken = encrypt(accessToken);

    await prisma.store.update({
      where: { id: storeId },
      data: { access_token: encryptedToken },
    });

    return { message: 'Access token updated' };
  },

  getProducts: async (storeId: string) => {
    const products = await prisma.product.findMany({
      where: { store_id: storeId },
    });
    return products;
  },

  syncProducts: async (storeId: string) => {
    const store = await prisma.store.findUnique({ where: { id: storeId } });
    if (!store) throw new Error('Store not found');
    if (!store.access_token) throw new Error('Access token not configured. Please set up your store credentials first.');
    if (!store.store_url) throw new Error('Store URL not configured.');

    const decryptedToken = decrypt(store.access_token);

    let remoteProducts: { external_id: string; title: string; image_url: string | null; category: string | null }[] = [];

    if (store.platform === 'shopify') {
      remoteProducts = await fetchShopifyProducts(store.store_url, decryptedToken);
    } else if (store.platform === 'woocommerce') {
      // For WooCommerce, access_token stores "consumerKey:consumerSecret"
      const [consumerKey, consumerSecret] = decryptedToken.split(':');
      if (!consumerKey || !consumerSecret) throw new Error('Invalid WooCommerce credentials format. Expected "consumerKey:consumerSecret".');
      remoteProducts = await fetchWooProducts(store.store_url, consumerKey, consumerSecret);
    } else {
      throw new Error(`Platform "${store.platform}" sync not supported yet.`);
    }

    const syncedProducts = [];
    for (const product of remoteProducts) {
      const existing = await prisma.product.findUnique({
        where: { store_id_external_id: { store_id: storeId, external_id: product.external_id } },
      });

      if (existing) {
        const updated = await prisma.product.update({
          where: { id: existing.id },
          data: {
            title: product.title,
            image_url: product.image_url,
            category: product.category,
            last_synced_at: new Date(),
          },
        });
        syncedProducts.push(updated);
      } else {
        const created = await prisma.product.create({
          data: {
            store_id: storeId,
            external_id: product.external_id,
            title: product.title,
            image_url: product.image_url,
            category: product.category,
            is_tryon_enabled: true,
            last_synced_at: new Date(),
          },
        });
        syncedProducts.push(created);
      }
    }

    return syncedProducts;
  },
};
