import 'dotenv/config';

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const DEFAULT_ALLOWED_ORIGINS = [
  'https://solidaritytn.org',
  'https://www.solidaritytn.org',
  'https://islamicquestionnaire-work.vercel.app',
  'http://localhost:5173',
  'http://localhost:5174'
];

function parseOrigins() {
  const configured = [
    process.env.CORS_ORIGINS,
    process.env.FRONTEND_URL,
    process.env.CLIENT_ORIGINS
  ]
    .filter(Boolean)
    .flatMap((value) => value.split(','))
    .map((value) => value.trim().replace(/\/$/, ''))
    .filter((value) => Boolean(value) && value !== '*');

  const origins = [...DEFAULT_ALLOWED_ORIGINS, ...configured];

  if (process.env.NODE_ENV !== 'production') {
    origins.push('http://localhost:3000');
  }

  return Array.from(new Set(origins));
}

export function validateEnv() {
  const errors = [];

  if (!process.env.MONGODB_URI || !process.env.MONGODB_URI.trim()) {
    errors.push('MONGODB_URI is required.');
  }

  if (!process.env.JWT_SECRET || process.env.JWT_SECRET.trim().length < 32) {
    errors.push('JWT_SECRET must be at least 32 characters long.');
  }

  const adminEmail = (process.env.ADMIN_EMAIL || '').trim().toLowerCase();
  if (!adminEmail || !EMAIL_REGEX.test(adminEmail)) {
    errors.push('ADMIN_EMAIL must be a valid email address.');
  }

  const hasHash = Boolean(process.env.ADMIN_PASSWORD_HASH && process.env.ADMIN_PASSWORD_HASH.trim());
  const hasPlain = Boolean(process.env.ADMIN_PASSWORD && process.env.ADMIN_PASSWORD.trim().length > 0);
  if (!hasHash && !hasPlain) {
    errors.push('Either ADMIN_PASSWORD_HASH or ADMIN_PASSWORD must be configured.');
  }

  if (errors.length > 0) {
    throw new Error(`Environment validation failed:\n- ${errors.join('\n- ')}`);
  }
}

export const env = {
  nodeEnv: process.env.NODE_ENV || 'development',
  port: Number(process.env.PORT) || 5000,
  mongodbUri: (process.env.MONGODB_URI || '').trim(),
  dbName: 'IslamicForm',
  jwtSecret: (process.env.JWT_SECRET || '').trim(),
  jwtExpiresIn: (process.env.JWT_EXPIRES_IN || '8h').trim(),
  adminEmail: (process.env.ADMIN_EMAIL || '').trim().toLowerCase(),
  adminPassword: process.env.ADMIN_PASSWORD || '',
  adminPasswordHash: (process.env.ADMIN_PASSWORD_HASH || '').trim(),
  allowedOrigins: parseOrigins()
};
