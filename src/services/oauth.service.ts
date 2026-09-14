import { supabase } from '../supabase';
import { prisma } from '../config/database';
import { v4 as uuidv4 } from 'uuid';

export const oauthService = {
  syncOAuthUser: async ({ email, name, provider, providerUserId }: {
    email: string;
    name?: string;
    provider: string;
    providerUserId: string;
  }) => {
    // Check if user exists by email
    let user = await prisma.user.findUnique({ where: { email } });

    if (!user) {
      // Create new user (OAuth users don't have a password, use empty string)
      user = await prisma.user.create({
        data: {
          email,
          name: name || email.split('@')[0],
          password: '',
        },
      });
    }

    // Check if store exists
    let store = await prisma.store.findFirst({ where: { user_id: user.id } });

    if (!store) {
      // Create store with 0 credits (user must purchase credits)
      // TODO: Grant 5 free credits once the real credit-purchase system is live
      store = await prisma.store.create({
        data: {
          user_id: user.id,
          store_name: name || 'My Store',
          platform: 'custom',
          store_url: '',
          api_key: `sk_${uuidv4().replace(/-/g, '')}`,
          credits_balance: 0,
          is_active: true,
        },
      });
    }

    return {
      user_id: user.id,
      store_id: store.id,
      api_key: store.api_key,
      credits_balance: store.credits_balance,
    };
  },
};
