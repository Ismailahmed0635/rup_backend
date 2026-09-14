import { supabase } from '../supabase';
import jwt from 'jsonwebtoken';
import { prisma } from '../config/database';
import { hashPassword, comparePassword } from '../utils/crypto';
import { v4 as uuidv4 } from 'uuid';

export const authService = {
  register: async ({ email, password, name, store_name }: { email: string; password: string; name?: string; store_name?: string }) => {
    // Check if user already exists in local DB
    const existingUser = await prisma.user.findUnique({
      where: { email },
    });

    if (existingUser) {
      throw new Error('User already exists with this email');
    }

    // Hash password for local storage (optional - can use Supabase only)
    const passwordHash = await hashPassword(password);

    // Create user in local DB for store/credits tracking
    const user = await prisma.user.create({
      data: {
        email,
        name,
        password: passwordHash,
      },
    });

    // Create store with 0 credits (user must purchase credits)
    // TODO: Grant 5 free credits once the real credit-purchase system is live
    const store = await prisma.store.create({
      data: {
        user_id: user.id,
        store_name: store_name || name || 'My Store',
        platform: 'custom',
        store_url: '',
        api_key: `sk_${uuidv4().replace(/-/g, '')}`,
        credits_balance: 0,
        is_active: true,
      },
    });

    // Register user in Supabase Auth
    const { data: supaData, error } = await supabase.auth.signUp({
      email,
      password,
    });

    if (error) {
      // If Supabase sign up fails, clean up local store and user
      await prisma.store.deleteMany({ where: { user_id: user.id } });
      await prisma.user.delete({ where: { id: user.id } });
      throw new Error(error.message);
    }

    return {
      user_id: user.id,
      store_id: store.id,
      api_key: store.api_key,
      credits_balance: store.credits_balance,
      jwt_token: supaData.session?.access_token || generateJwt(user.id),
      supa_user_id: supaData.user?.id,
    };
  },

  login: async ({ email, password }: { email: string; password: string }) => {
    // Login via Supabase Auth
    const { data: supaData, error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (error || !supaData.session) {
      throw new Error('Invalid credentials');
    }

    // Get user ID from Supabase JWT
    const userId = supaData.session.user.id;

    // Get associated store from local DB
    const store = await prisma.store.findFirst({
      where: { user_id: userId },
    });

    return {
      user_id: userId,
      store_id: store?.id,
      api_key: store?.api_key,
      credits_balance: store?.credits_balance,
      jwt_token: supaData.session.access_token,
      supa_user_id: supaData.session.user.id,
    };
  },
};

function generateJwt(userId: string): string {
  const secret = process.env.JWT_SECRET!;
  return jwt.sign({ userId }, secret, { expiresIn: '7d' });
}