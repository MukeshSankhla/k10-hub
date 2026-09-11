export interface Category {
  id: number;
  slug: string;
  name: string;
  description: string | null;
  iconName: string | null;
  color: string | null;
  sortOrder: number;
}

const STATIC_CATEGORIES: Category[] = [
  {
    id: 1,
    slug: 'fundamentals',
    name: 'Fundamentals',
    description: 'Core electronics — GPIO, LEDs, buttons and basic hardware interaction.',
    iconName: 'cpu',
    color: '#1D4ED8',
    sortOrder: 1,
  },
  {
    id: 2,
    slug: 'sensors-io',
    name: 'Sensors & I/O',
    description: 'Explore the K10 sensors, display, camera, audio and connectivity.',
    iconName: 'activity',
    color: '#047857',
    sortOrder: 2,
  },
  {
    id: 3,
    slug: 'ai-vision',
    name: 'AI & Vision',
    description: 'Computer vision, face detection, recognition and AI applications.',
    iconName: 'eye',
    color: '#6D28D9',
    sortOrder: 3,
  },
  {
    id: 4,
    slug: 'community',
    name: 'Community',
    description: 'Projects built by makers, developers and educators around the world.',
    iconName: 'users',
    color: '#B45309',
    sortOrder: 4,
  },
];

export class CategoryService {
  async getCategories(): Promise<Category[]> {
    return STATIC_CATEGORIES;
  }

  async getCategoryBySlug(slug: string): Promise<Category | null> {
    const found = STATIC_CATEGORIES.find((c) => c.slug === slug);
    return found ?? null;
  }
}

export const categoryService = new CategoryService();
