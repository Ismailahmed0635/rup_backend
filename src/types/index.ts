export type User = {
  id: string;
  email: string;
  name?: string;
  password: string;
  created_at: Date;
  updated_at: Date;
};

export type Store = {
  id: string;
  user_id: string;
  store_name: string;
  platform: string;
  store_url: string;
  api_key: string;
  credits_balance: number;
  is_active: boolean;
  created_at: Date;
  updated_at: Date;
};

export type Product = {
  id: string;
  store_id: string;
  external_id: string;
  title: string;
  image_url?: string;
  category?: string;
  is_tryon_enabled: boolean;
  last_synced_at?: Date;
  created_at: Date;
  updated_at: Date;
};

export type CreditTransaction = {
  id: string;
  store_id: string;
  amount: number;
  transaction_type: 'purchase' | 'usage' | 'refund';
  description?: string;
  created_at: Date;
};

export type TryOnSession = {
  id: string;
  store_id: string;
  product_id: string;
  user_photo_id?: string;
  status: 'pending' | 'processing' | 'completed' | 'failed';
  job_id?: string;
  provider?: string;
  credits_used: number;
  created_at: Date;
  completed_at?: Date;
};

export type TryOnResult = {
  id: string;
  session_id: string;
  product_id: string;
  result_image_url: string;
  status: 'completed';
  error_message?: string;
  created_at: Date;
};