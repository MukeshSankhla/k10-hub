import { integer, sqliteTable, text, real } from 'drizzle-orm/sqlite-core';
import { relations } from 'drizzle-orm';
import { sql } from 'drizzle-orm';


// ─── Projects ─────────────────────────────────────────────────────────────────
export const projects = sqliteTable('projects', {
  id: text('id').primaryKey(),
  slug: text('slug').notNull().unique(),
  title: text('title').notNull(),
  publishDate: text('publish_date'),
  type: text('type').notNull().default('Project'),
  level: integer('level').notNull().default(1),
  author: text('author').notNull().default('Maker'),
  authorAvatar: text('author_avatar'),
  authorRole: text('author_role').default('author'),
  authorId: text('author_id'),
  authorEmail: text('author_email'),
  status: text('status', { enum: ['draft', 'pending_approval', 'published', 'rejected'] }).notNull().default('published'),
  visibility: text('visibility', { enum: ['draft', 'public'] }).notNull().default('public'),
  flashCount: integer('flash_count').notNull().default(0),
  likeCount: integer('like_count').notNull().default(0),
  viewCount: integer('view_count').notNull().default(0),
  featured: integer('featured', { mode: 'boolean' }).notNull().default(false),
  description: text('description').notNull(),
  coverImage: text('cover_image').notNull(),
  docLink: text('doc_link'),
  githubLink: text('github_link'),
  videoLink: text('video_link'),
  projectMdFile: text('project_md_file'),
  markdownContent: text('markdown_content'),
  compatibleBoard: text('compatible_board').default('UNIHIKER K10'),
  license: text('license').default('MIT'),
  tags: text('tags'),
  firmwares: text('firmwares'),
  attachments: text('attachments'),
  createdAt: integer('created_at').default(sql`(unixepoch())`),
  updatedAt: integer('updated_at').default(sql`(unixepoch())`),
});

// ─── Comments ─────────────────────────────────────────────────────────────────
export const comments = sqliteTable('comments', {
  id: text('id').primaryKey(),
  projectId: text('project_id').notNull().references(() => projects.id, { onDelete: 'cascade' }),
  parentId: text('parent_id'),
  authorId: text('author_id').notNull(),
  authorName: text('author_name').notNull(),
  authorAvatar: text('author_avatar'),
  authorEmail: text('author_email'),
  authorRole: text('author_role').default('user'),
  content: text('content').notNull(),
  score: integer('score').notNull().default(0),
  upvotedBy: text('upvoted_by').default('[]'),
  downvotedBy: text('downvoted_by').default('[]'),
  isDeleted: integer('is_deleted', { mode: 'boolean' }).notNull().default(false),
  createdAt: text('created_at').notNull(),
  updatedAt: text('updated_at'),
});

// ─── Project Likes ────────────────────────────────────────────────────────────
export const projectLikes = sqliteTable('project_likes', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  projectId: text('project_id').notNull().references(() => projects.id, { onDelete: 'cascade' }),
  userId: text('user_id').notNull(),
  userEmail: text('user_email'),
  createdAt: integer('created_at').default(sql`(unixepoch())`),
});

// ─── Project Bookmarks ────────────────────────────────────────────────────────
export const projectBookmarks = sqliteTable('project_bookmarks', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  projectId: text('project_id').notNull().references(() => projects.id, { onDelete: 'cascade' }),
  userId: text('user_id').notNull(),
  createdAt: integer('created_at').default(sql`(unixepoch())`),
});

// ─── Flash Logs ───────────────────────────────────────────────────────────────
export const flashLogs = sqliteTable('flash_logs', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  projectId: text('project_id').notNull().references(() => projects.id, { onDelete: 'cascade' }),
  userId: text('user_id'),
  flashedAt: integer('flashed_at').default(sql`(unixepoch())`),
});

// ─── Relations ────────────────────────────────────────────────────────────────
export const projectsRelations = relations(projects, ({ many }) => ({
  comments: many(comments),
  likes: many(projectLikes),
  bookmarks: many(projectBookmarks),
  flashLogs: many(flashLogs),
}));

export const commentsRelations = relations(comments, ({ one }) => ({
  project: one(projects, { fields: [comments.projectId], references: [projects.id] }),
}));

export const projectLikesRelations = relations(projectLikes, ({ one }) => ({
  project: one(projects, { fields: [projectLikes.projectId], references: [projects.id] }),
}));

export const projectBookmarksRelations = relations(projectBookmarks, ({ one }) => ({
  project: one(projects, { fields: [projectBookmarks.projectId], references: [projects.id] }),
}));

export const flashLogsRelations = relations(flashLogs, ({ one }) => ({
  project: one(projects, { fields: [flashLogs.projectId], references: [projects.id] }),
}));

// ─── Users ────────────────────────────────────────────────────────────────────
export const users = sqliteTable('users', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  userKey: text('user_key').unique(),
  supabaseUid: text('supabase_uid').notNull().unique(),
  email: text('email').notNull().unique(),
  name: text('name').notNull(),
  avatarUrl: text('avatar_url'),
  bio: text('bio'),
  githubUrl: text('github_url'),
  websiteUrl: text('website_url'),
  socialPlatform: text('social_platform'),
  socialUrl: text('social_url'),
  instagramUrl: text('instagram_url'),
  youtubeUrl: text('youtube_url'),
  linkedinUrl: text('linkedin_url'),
  role: text('role', { enum: ['user', 'author', 'admin'] }).notNull().default('user'),
  status: text('status', { enum: ['active', 'suspended'] }).notNull().default('active'),
  isEmailVerified: integer('is_email_verified', { mode: 'boolean' }).notNull().default(false),
  emailConfirmedAt: integer('email_confirmed_at'),
  createdAt: integer('created_at').default(sql`(unixepoch())`),
  updatedAt: integer('updated_at').default(sql`(unixepoch())`),
  lastSignInAt: integer('last_sign_in_at'),
});

// ─── Author Applications ──────────────────────────────────────────────────────
export const authorApplications = sqliteTable('author_applications', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  userId: integer('user_id').notNull().references(() => users.id),
  bio: text('bio').notNull(),
  githubUrl: text('github_url'),
  hardwareExperience: text('hardware_experience').notNull(),
  sampleProjectIdeas: text('sample_project_ideas').notNull(),
  status: text('status', { enum: ['pending', 'approved', 'rejected'] }).notNull().default('pending'),
  adminNotes: text('admin_notes'),
  reviewedBy: integer('reviewed_by').references(() => users.id),
  createdAt: integer('created_at').default(sql`(unixepoch())`),
  updatedAt: integer('updated_at').default(sql`(unixepoch())`),
  reviewedAt: integer('reviewed_at'),
});

export const usersRelations = relations(users, ({ many }) => ({
  applications: many(authorApplications),
  notifications: many(notifications),
}));

export const authorApplicationsRelations = relations(authorApplications, ({ one }) => ({
  user: one(users, { fields: [authorApplications.userId], references: [users.id] }),
  reviewer: one(users, { fields: [authorApplications.reviewedBy], references: [users.id] }),
}));

// ─── In-App Notifications ─────────────────────────────────────────────────────
export const notifications = sqliteTable('notifications', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  userId: integer('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  type: text('type').notNull(), // 'milestone_flash' | 'project_like' | 'project_comment' | 'comment_reply' | 'author_application' | 'project_approval' | 'custom'
  title: text('title').notNull(),
  message: text('message').notNull(),
  icon: text('icon').notNull().default('bell'),
  url: text('url'),
  isRead: integer('is_read', { mode: 'boolean' }).notNull().default(false),
  data: text('data'), // JSON string for extra metadata
  createdAt: integer('created_at').default(sql`(unixepoch())`),
});

export const notificationsRelations = relations(notifications, ({ one }) => ({
  user: one(users, { fields: [notifications.userId], references: [users.id] }),
}));

