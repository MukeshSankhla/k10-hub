import { createClient } from '@libsql/client';
import { drizzle } from 'drizzle-orm/libsql';
import * as schema from '../db/schema';
import { env } from './env';
import path from 'path';
import fs from 'fs';

const isRemoteLibSql =
  env.DATABASE_URL.startsWith('libsql://') ||
  env.DATABASE_URL.startsWith('https://') ||
  env.DATABASE_URL.startsWith('http://');

// Create libSQL client (remote Turso cloud SQLite or local file-based SQLite)
const client = isRemoteLibSql
  ? createClient({
      url: env.DATABASE_URL,
      authToken: env.DATABASE_AUTH_TOKEN || undefined,
    })
  : (() => {
      const backendRootDir = path.resolve(__dirname, '../../');
      const dbPath = path.isAbsolute(env.DATABASE_URL)
        ? env.DATABASE_URL
        : path.resolve(backendRootDir, env.DATABASE_URL);
      const dbDir = path.dirname(dbPath);

      // Ensure the data directory exists when running with a local file
      if (!fs.existsSync(dbDir)) {
        try {
          fs.mkdirSync(dbDir, { recursive: true });
        } catch {
          // May be running in read-only environment
        }
      }

      return createClient({
        url: `file:${dbPath}`,
      });
    })();

// Initialize Drizzle ORM with our schema
export const db = drizzle(client, { schema });

export { client };

export type Database = typeof db;
