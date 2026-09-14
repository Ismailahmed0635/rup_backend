export const env = {
  port: process.env.PORT || 5000,
  jwtSecret: process.env.JWT_SECRET || 'default-jwt-secret',
  apiKeySalt: process.env.API_KEY_SALT || 'default-api-key-salt',
  encryptionKey: process.env.ENCRYPTION_KEY || 'default-encryption-key-32-chars!!',
  databaseUrl: process.env.DATABASE_URL || 'file:./dev.db',
  frontendUrl: process.env.FRONTEND_URL || 'http://localhost:3000',
  awsAccessKeyId: process.env.AWS_ACCESS_KEY_ID || '',
  awsSecretAccessKey: process.env.AWS_SECRET_ACCESS_KEY || '',
  awsRegion: process.env.AWS_REGION || 'us-east-1',
  s3BucketName: process.env.S3_BUCKET_NAME || 'rup-tryon-images',
  // AI try-on provider: opentryon-server proxies to Kling AI (OPENTRYON_URL)
  klingApiKey: process.env.KLING_API_KEY || '',
  klingApiSecret: process.env.KLING_API_SECRET || '',
  klingApiUrl: process.env.KLING_API_URL || 'https://api-singapore.klingai.com',
  opentryonUrl: process.env.OPENTRYON_URL || 'http://localhost:8001',
  stripeSecretKey: process.env.STRIPE_SECRET_KEY || '',
  stripeWebhookSecret: process.env.STRIPE_WEBHOOK_SECRET || '',
  sendgridApiKey: process.env.SENDGRID_API_KEY || '',
  fromEmail: process.env.FROM_EMAIL || 'noreply@rup.app',

  // bKash OAuth
  bkashClientId: process.env.BKASH_CLIENT_ID || '',
  bkashClientSecret: process.env.BKASH_CLIENT_SECRET || '',
  bkashUsername: process.env.BKASH_USERNAME || '',
  bkashPassword: process.env.BKASH_PASSWORD || '',
  bkashProviderCode: process.env.BKASH_PROVIDER_CODE || '',

  // Manual bank transfer (company receiving account)
  // Admin/internal operations key - required for credit grants and payment verification
  adminApiKey: process.env.ADMIN_API_KEY || '',
  // Shared secret the payment gateway must send with callbacks
  paymentCallbackSecret: process.env.PAYMENT_CALLBACK_SECRET || '',
  paymentBankName: process.env.PAYMENT_BANK_NAME || '',
  paymentBankAccountName: process.env.PAYMENT_BANK_ACCOUNT_NAME || '',
  paymentBankAccountNumber: process.env.PAYMENT_BANK_ACCOUNT_NUMBER || '',
  paymentBankRoutingNumber: process.env.PAYMENT_BANK_ROUTING_NUMBER || '',
  supportEmail: process.env.SUPPORT_EMAIL || '',
};