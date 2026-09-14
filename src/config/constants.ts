export const APP_CONSTANTS = {
  creditCostPerTryon: 1,
  minCreditsForTryon: 1,
  emailVerificationTokenExpiresIn: '15m',
  passwordResetTokenExpiresIn: '1h',
  apiKeyExpirationDays: 365,
  passwordMinLength: 6,
  passwordStrengthRequires: {
    minLowercase: 1,
    minUppercase: 1,
    minNumbers: 1,
    minSymbols: 1,
  },
  rateLimit: {
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 100, // limit each IP to 100 requests per windowMs
  },
};