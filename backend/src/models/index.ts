import type { InferSelectModel, InferInsertModel } from 'drizzle-orm';
import * as schema from '../db/schema';

export type Project = InferSelectModel<typeof schema.projects>;
export type NewProject = InferInsertModel<typeof schema.projects>;

export type Comment = InferSelectModel<typeof schema.comments>;
export type NewComment = InferInsertModel<typeof schema.comments>;

export type ProjectLike = InferSelectModel<typeof schema.projectLikes>;
export type NewProjectLike = InferInsertModel<typeof schema.projectLikes>;

export type ProjectBookmark = InferSelectModel<typeof schema.projectBookmarks>;
export type NewProjectBookmark = InferInsertModel<typeof schema.projectBookmarks>;

export type FlashLog = InferSelectModel<typeof schema.flashLogs>;
export type NewFlashLog = InferInsertModel<typeof schema.flashLogs>;

export type AppNotification = InferSelectModel<typeof schema.notifications>;
export type NewAppNotification = InferInsertModel<typeof schema.notifications>;
