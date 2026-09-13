// Mock Prisma client
const mockPrisma: any = {
  user: {
    findUnique: jest.fn(),
    create: jest.fn(),
    delete: jest.fn(),
  },
  store: {
    findUnique: jest.fn(),
    findFirst: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
    updateMany: jest.fn(),
    deleteMany: jest.fn(),
  },
  product: {
    findMany: jest.fn(),
    findUnique: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
  },
  creditTransaction: {
    create: jest.fn(),
    findMany: jest.fn(),
  },
  tryOnSession: {
    findMany: jest.fn(),
    findFirst: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
  },
  tryOnResult: {
    findFirst: jest.fn(),
    create: jest.fn(),
    upsert: jest.fn(),
  },
  revokedToken: {
    upsert: jest.fn(),
    findUnique: jest.fn(),
  },
  $transaction: jest.fn((fn: any) => fn(mockPrisma)),
};

jest.mock('../app/config/database', () => ({
  prisma: mockPrisma,
}));

// Mock Supabase client
const mockSupabase = {
  auth: {
    signUp: jest.fn(),
    signInWithPassword: jest.fn(),
    getUser: jest.fn(),
    resetPasswordForEmail: jest.fn(),
    setSession: jest.fn(),
    updateUser: jest.fn(),
    signInWithOAuth: jest.fn(),
  },
};

jest.mock('../app/supabase', () => ({
  supabase: mockSupabase,
}));

// Mock bcryptjs
jest.mock('bcryptjs', () => ({
  hash: jest.fn().mockResolvedValue('hashed_password'),
  compare: jest.fn().mockResolvedValue(true),
}));

// Mock uuid
jest.mock('uuid', () => ({
  v4: jest.fn().mockReturnValue('12345678-1234-1234-1234-123456789abc'),
}));

// Mock axios
jest.mock('axios', () => ({
  default: {
    get: jest.fn(),
    post: jest.fn(),
  },
}));

export { mockPrisma, mockSupabase };
