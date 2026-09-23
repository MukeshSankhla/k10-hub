// projectsData.ts
// Comprehensive catalog of projects with firmware configurations and documentation.

export interface FirmwareConfig {
  version: string;
  name: string;
  releaseDate: string;
  firmwareUrl: string;
  flashAddress: string;
  versionNote: string;
}

export interface ProjectAttachment {
  name: string;
  fileUrl: string;
  fileSize?: string;
  fileType?: string;
}

export interface ProjectDetail {
  id: string;
  title: string;
  publishDate: string;
  type: string;
  level: number;
  author: string;
  authorAvatar?: string;
  authorRole?: string;
  authorId?: string;
  authorEmail?: string;
  status?: 'draft' | 'pending_approval' | 'published' | 'rejected';
  visibility?: 'draft' | 'public';
  flashCount: number;
  featured?: boolean;
  isFeatured?: boolean;
  description: string;
  coverImage: string;
  docLink?: string;
  githubLink?: string;
  videoLink?: string;
  projectMdFile?: string | null;
  markdownContent?: string;
  compatibleBoard?: string;
  license?: string;
  tags?: string[];
  firmwares: FirmwareConfig[];
  attachments?: ProjectAttachment[];
}

export const AVAILABLE_TOPICS = [
  'AI & Machine Learning',
  'Computer Vision',
  'IoT',
  'Robotics',
  'Automation',
  'Embedded Systems',
  'Sensors & Electronics',
  'HMI',
  'Data & Cloud',
  'Programming',
  'STEM Education',
  'Smart Devices',
  'Edge Computing',
  'Multimedia',
  'Industrial Applications',
] as const;

export type Topic = (typeof AVAILABLE_TOPICS)[number];

export const PROJECTS_DATA: ProjectDetail[] = [];

export function getProjectById(id: string): ProjectDetail | undefined {
  return PROJECTS_DATA.find((p) => p.id.toLowerCase() === id.toLowerCase());
}

