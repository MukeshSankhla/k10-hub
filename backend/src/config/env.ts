import * as dotenv from 'dotenv';
import { z } from 'zod';
import path from 'path';

// Load .env from backend root
dotenv.config({ path: path.resolve(__dirname, '../../.env') });

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  PORT: z.coerce.number().default(3001),
  HOST: z.string().default(process.env.NODE_ENV === 'production' ? '0.0.0.0' : 'localhost'),
  DATABASE_URL: z.string().default('./data/k10hub.db'),
  DATABASE_AUTH_TOKEN: z.string().default(''),
  CORS_ORIGINS: z.string().default('http://localhost:5173,http://localhost:4173'),
  SUPABASE_URL: z.string().default(''),
  SUPABASE_SERVICE_ROLE_KEY: z.string().default(''),
  SUPABASE_ANON_KEY: z.string().default(''),
  ADMIN_EMAILS: z.string().default('admin@k10hub.io'),
});

const parsed = envSchema.safeParse(process.env);

if (!parsed.success) {
  console.error('❌ Invalid environment variables:');
  console.error(parsed.error.format());
  process.exit(1);
}

export const env = parsed.data;

export const isDevelopment = env.NODE_ENV === 'development';
export const isProduction = env.NODE_ENV === 'production';

export const corsOrigins = env.CORS_ORIGINS.split(',').map((o) => o.trim());
