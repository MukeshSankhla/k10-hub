import { client } from '../config/database';
import crypto from 'crypto';

export async function initDatabase(): Promise<void> {
  // Drop legacy/unused tables
  await client.execute('DROP TABLE IF EXISTS project_hardware');
  await client.execute('DROP TABLE IF EXISTS project_libraries');
  await client.execute('DROP TABLE IF EXISTS project_tags');
  await client.execute('DROP TABLE IF EXISTS libraries');
  await client.execute('DROP TABLE IF EXISTS tags');
  await client.execute('DROP TABLE IF EXISTS categories');
  await client.execute('DROP TABLE IF EXISTS authors');

  // Check if projects table needs schema upgrade to string ID
  try {
    const tableInfo = await client.execute("PRAGMA table_info(projects)");
    const hasStringId = tableInfo.rows.some((r: any) => r.name === 'id' && String(r.type).toUpperCase().includes('TEXT'));
    if (!hasStringId) {
      // Check if table is empty before dropping legacy schema
      const rowCountRes = await client.execute("SELECT count(*) as count FROM projects");
      const rowCount = Number(rowCountRes.rows[0]?.count || 0);
      if (rowCount === 0) {
        await client.execute("DROP TABLE IF EXISTS project_hardware");
        await client.execute("DROP TABLE IF EXISTS project_libraries");
        await client.execute("DROP TABLE IF EXISTS project_tags");
        await client.execute("DROP TABLE IF EXISTS tutorials");
        await client.execute("DROP TABLE IF EXISTS firmware_versions");
        await client.execute("DROP TABLE IF EXISTS projects");
      }
    }
  } catch {
    // projects table might not exist yet
  }

  await client.execute(`
    CREATE TABLE IF NOT EXISTS projects (
      id TEXT PRIMARY KEY,
      slug TEXT NOT NULL UNIQUE,
      title TEXT NOT NULL,
      publish_date TEXT,
      type TEXT NOT NULL DEFAULT 'Project',
      level INTEGER NOT NULL DEFAULT 1,
      author TEXT NOT NULL DEFAULT 'Maker',
      author_avatar TEXT,
      author_role TEXT DEFAULT 'author',
      author_id TEXT,
      author_email TEXT,
      status TEXT NOT NULL DEFAULT 'published',
      visibility TEXT NOT NULL DEFAULT 'public',
      flash_count INTEGER NOT NULL DEFAULT 0,
      like_count INTEGER NOT NULL DEFAULT 0,
      view_count INTEGER NOT NULL DEFAULT 0,
      featured INTEGER NOT NULL DEFAULT 0,
      description TEXT NOT NULL,
      cover_image TEXT NOT NULL,
      doc_link TEXT,
      github_link TEXT,
      video_link TEXT,
      project_md_file TEXT,
      markdown_content TEXT,
      compatible_board TEXT DEFAULT 'UNIHIKER K10',
      license TEXT DEFAULT 'MIT',
      tags TEXT,
      firmwares TEXT,
      attachments TEXT,
      created_at INTEGER DEFAULT (unixepoch()),
      updated_at INTEGER DEFAULT (unixepoch())
    );
  `);

  // Ensure project_md_file and attachments columns exist on existing installations
  try {
    const tableInfo = await client.execute("PRAGMA table_info(projects)");
    const hasProjectMdFile = tableInfo.rows.some((r: any) => r.name === 'project_md_file');
    if (!hasProjectMdFile) {
      await client.execute("ALTER TABLE projects ADD COLUMN project_md_file TEXT");
      console.log('✅ Added missing project_md_file column to projects table.');
    }
    const hasAttachments = tableInfo.rows.some((r: any) => r.name === 'attachments');
    if (!hasAttachments) {
      await client.execute("ALTER TABLE projects ADD COLUMN attachments TEXT");
      console.log('✅ Added missing attachments column to projects table.');
    }
  } catch (colErr) {
    console.warn('Column check notice for project schema migration:', colErr);
  }

  // Ensure users table does not have dangling foreign key to dropped authors table
  try {
    const tableSqlRes = await client.execute("SELECT sql FROM sqlite_master WHERE type='table' AND name='users'");
    const sql = String(tableSqlRes.rows[0]?.sql || (tableSqlRes.rows[0] as any)?.[0] || '');
    if (sql.includes('REFERENCES authors')) {
      await client.execute('PRAGMA foreign_keys = OFF');
      await client.execute("CREATE TABLE users_new (id INTEGER PRIMARY KEY AUTOINCREMENT, user_key TEXT UNIQUE, supabase_uid TEXT NOT NULL UNIQUE, email TEXT NOT NULL UNIQUE, name TEXT NOT NULL, avatar_url TEXT, bio TEXT, github_url TEXT, website_url TEXT, social_platform TEXT, social_url TEXT, instagram_url TEXT, youtube_url TEXT, linkedin_url TEXT, role TEXT NOT NULL DEFAULT 'user', status TEXT NOT NULL DEFAULT 'active', is_email_verified INTEGER NOT NULL DEFAULT 0, email_confirmed_at INTEGER, created_at INTEGER DEFAULT (unixepoch()), updated_at INTEGER DEFAULT (unixepoch()), last_sign_in_at INTEGER)");
      await client.execute('INSERT INTO users_new (id, supabase_uid, email, name, avatar_url, bio, github_url, website_url, social_platform, social_url, instagram_url, youtube_url, linkedin_url, role, status, created_at, updated_at, last_sign_in_at) SELECT id, supabase_uid, email, name, avatar_url, bio, github_url, website_url, social_platform, social_url, instagram_url, youtube_url, linkedin_url, role, status, created_at, updated_at, last_sign_in_at FROM users');
      await client.execute('DROP TABLE users');
      await client.execute('ALTER TABLE users_new RENAME TO users');
      await client.execute('PRAGMA foreign_keys = ON');
      console.log('✅ Cleaned up legacy authors foreign key on users table.');
    }
  } catch (userMigrateErr) {
    console.warn('Users migration notice:', userMigrateErr);
  }

  await client.execute(`
    CREATE TABLE IF NOT EXISTS comments (
      id TEXT PRIMARY KEY,
      project_id TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
      parent_id TEXT,
      author_id TEXT NOT NULL,
      author_name TEXT NOT NULL,
      author_avatar TEXT,
      author_email TEXT,
      author_role TEXT DEFAULT 'user',
      content TEXT NOT NULL,
      score INTEGER NOT NULL DEFAULT 0,
      upvoted_by TEXT DEFAULT '[]',
      downvoted_by TEXT DEFAULT '[]',
      is_deleted INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL,
      updated_at TEXT
    );
  `);

  await client.execute(`
    CREATE TABLE IF NOT EXISTS project_likes (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      project_id TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
      user_id TEXT NOT NULL,
      user_email TEXT,
      created_at INTEGER DEFAULT (unixepoch()),
      UNIQUE(project_id, user_id)
    );
  `);

  await client.execute(`
    CREATE TABLE IF NOT EXISTS project_bookmarks (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      project_id TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
      user_id TEXT NOT NULL,
      created_at INTEGER DEFAULT (unixepoch()),
      UNIQUE(project_id, user_id)
    );
  `);

  await client.execute(`
    CREATE TABLE IF NOT EXISTS flash_logs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      project_id TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
      user_id TEXT,
      flashed_at INTEGER DEFAULT (unixepoch())
    );
  `);

  await client.execute(`
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_key TEXT UNIQUE,
      supabase_uid TEXT NOT NULL UNIQUE,
      email TEXT NOT NULL UNIQUE,
      name TEXT NOT NULL,
      avatar_url TEXT,
      bio TEXT,
      github_url TEXT,
      website_url TEXT,
      social_platform TEXT,
      social_url TEXT,
      instagram_url TEXT,
      youtube_url TEXT,
      linkedin_url TEXT,
      role TEXT NOT NULL DEFAULT 'user',
      status TEXT NOT NULL DEFAULT 'active',
      is_email_verified INTEGER NOT NULL DEFAULT 0,
      email_confirmed_at INTEGER,
      created_at INTEGER DEFAULT (unixepoch()),
      updated_at INTEGER DEFAULT (unixepoch()),
      last_sign_in_at INTEGER
    );
  `);

  // Ensure all required columns exist on users table
  const userColumnsToEnsure = [
    { name: 'user_key', type: 'TEXT' },
    { name: 'is_email_verified', type: 'INTEGER NOT NULL DEFAULT 0' },
    { name: 'email_confirmed_at', type: 'INTEGER' },
  ];

  for (const col of userColumnsToEnsure) {
    try {
      await client.execute(`ALTER TABLE users ADD COLUMN ${col.name} ${col.type}`);
      console.log(`✅ Added missing ${col.name} column to users table.`);
    } catch (err: any) {
      const msg = String(err?.message || err || '').toLowerCase();
      if (!msg.includes('duplicate column')) {
        console.warn(`Column check notice for users.${col.name}:`, err);
      }
    }
  }

  // Backfill any existing users missing user_key individually with random hex
  try {
    const existingWithoutKey = await client.execute("SELECT id FROM users WHERE user_key IS NULL");
    for (const r of existingWithoutKey.rows) {
      const id = (r as any).id ?? r[0];
      const newKey = `usr_${crypto.randomBytes(4).toString('hex')}`;
      await client.execute({
        sql: "UPDATE users SET user_key = ? WHERE id = ?",
        args: [newKey, id],
      });
    }
    await client.execute("CREATE UNIQUE INDEX IF NOT EXISTS idx_users_user_key ON users(user_key)");
  } catch (backfillErr) {
    console.warn('user_key backfill notice:', backfillErr);
  }

  await client.execute(`
    CREATE TABLE IF NOT EXISTS author_applications (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL REFERENCES users(id),
      bio TEXT NOT NULL,
      github_url TEXT,
      hardware_experience TEXT NOT NULL,
      sample_project_ideas TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'pending',
      admin_notes TEXT,
      reviewed_by INTEGER REFERENCES users(id),
      created_at INTEGER DEFAULT (unixepoch()),
      updated_at INTEGER DEFAULT (unixepoch()),
      reviewed_at INTEGER
    );
  `);

  await client.execute(`
    CREATE TABLE IF NOT EXISTS notifications (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      type TEXT NOT NULL,
      title TEXT NOT NULL,
      message TEXT NOT NULL,
      icon TEXT NOT NULL DEFAULT 'bell',
      url TEXT,
      is_read INTEGER NOT NULL DEFAULT 0,
      data TEXT,
      created_at INTEGER DEFAULT (unixepoch())
    );
  `);

  // ─── Safe migrations for existing tables ────────────────────────────────────
  const userColumns = [
    'bio TEXT',
    'github_url TEXT',
    'website_url TEXT',
    'social_platform TEXT',
    'social_url TEXT',
    'instagram_url TEXT',
    'youtube_url TEXT',
    'linkedin_url TEXT',
    'is_email_verified INTEGER NOT NULL DEFAULT 0',
    'email_confirmed_at INTEGER',
  ];

  for (const col of userColumns) {
    try {
      await client.execute(`ALTER TABLE users ADD COLUMN ${col}`);
    } catch {
      // Column already exists
    }
  }

  // ─── Database Performance Indexes ──────────────────────────────────────────
  const indexes = [
    'CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);',
    'CREATE INDEX IF NOT EXISTS idx_users_supabase_uid ON users(supabase_uid);',
    'CREATE INDEX IF NOT EXISTS idx_projects_slug ON projects(slug);',
    'CREATE INDEX IF NOT EXISTS idx_projects_status ON projects(status);',
    'CREATE INDEX IF NOT EXISTS idx_projects_author_id ON projects(author_id);',
    'CREATE INDEX IF NOT EXISTS idx_comments_project_id ON comments(project_id);',
    'CREATE INDEX IF NOT EXISTS idx_project_likes_project_id ON project_likes(project_id);',
    'CREATE INDEX IF NOT EXISTS idx_project_bookmarks_user_id ON project_bookmarks(user_id);',
    'CREATE INDEX IF NOT EXISTS idx_notifications_user_id ON notifications(user_id);',
  ];

  for (const idx of indexes) {
    try {
      await client.execute(idx);
    } catch {
      // Index already exists or created
    }
  }
}

