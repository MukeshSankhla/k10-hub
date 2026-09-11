import type { Config } from 'drizzle-kit';
import * as dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.resolve(__dirname, '.env') });

export default {
  schema: './src/db/schema.ts',
  out: './src/db/migrations',
  dialect: 'sqlite',
  dbCredentials: {
    url: `file:${path.resolve(__dirname, './data/k10hub.db').replace(/\\/g, '/')}`,
  },
  verbose: true,
  strict: true,
} satisfies Config;
