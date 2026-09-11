import { client } from '../config/database';
import { initDatabase } from './init';

export async function resetDatabase() {
  console.log('🧹 Clearing all data from K10 Hub database...');

  // Disable foreign keys temporarily during wipe
  await client.execute('PRAGMA foreign_keys = OFF;');

  const tablesToWipe = [
    'author_applications',
    'flash_logs',
    'comments',
    'project_likes',
    'project_bookmarks',
    'projects',
    'users',
  ];

  for (const table of tablesToWipe) {
    try {
      await client.execute(`DELETE FROM "${table}";`);
      console.log(`  Cleared ${table}`);
    } catch (err) {
      console.warn(`  Could not wipe ${table}:`, err);
    }
  }

  // Reset auto-increment sequences
  try {
    await client.execute('DELETE FROM sqlite_sequence;');
  } catch {
    // sqlite_sequence might be empty or not present
  }

  await client.execute('PRAGMA foreign_keys = ON;');

  console.log('🔨 Re-initializing table structures...');
  await initDatabase();

  console.log('✅ Database reset complete!');
}

if (require.main === module) {
  resetDatabase().catch((err) => {
    console.error('❌ Reset failed:', err);
    process.exit(1);
  });
}
