import { db } from '../config/database';
import { initDatabase } from './init';
import { projects } from './schema';

async function seed() {
  console.log('🌱 Seeding K10 Hub database...');

  // Ensure tables exist first
  await initDatabase();

  // ─── Projects ───────────────────────────────────────────────────────────────
  console.log('  Creating projects...');
  const now = Math.floor(Date.now() / 1000);
  await db.insert(projects).values([
    {
      id: 'ai-buddy',
      slug: 'ai-buddy',
      title: 'Ai Buddy - DIY AI Companion',
      publishDate: '10 Sep 2026, 09:00 AM',
      type: 'Project',
      level: 2,
      author: 'Mukesh Sankhla',
      authorAvatar: '',
      authorRole: 'admin',
      authorId: '1',
      authorEmail: 'mukesh@makerbrains.com',
      status: 'published',
      visibility: 'public',
      flashCount: 12,
      likeCount: 5,
      viewCount: 42,
      featured: true,
      description: 'An interactive desktop AI companion powered by UNIHIKER K10 featuring voice expressions, real-time sensors, and eye animations.',
      coverImage: 'https://images.unsplash.com/photo-1535378917042-10a22c95931a?auto=format&fit=crop&w=1200&q=80',
      docLink: '',
      githubLink: 'https://github.com/mukeshsankhla/k10-ai-buddy',
      videoLink: '',
      markdownContent: `# Ai Buddy - DIY AI Companion\n\nWelcome to the **Ai Buddy** project! This project turns your UNIHIKER K10 into an emotive desktop robot companion.\n\n### Features\n- 🤖 Expressive LCD face animations\n- 🎙️ Onboard microphone speech recognition\n- 🔊 Built-in speaker TTS audio feedback\n- 💡 RGB status indicators\n\n### Hardware Required\n- UNIHIKER K10 Board\n- USB-C Cable\n\n### Getting Started\nPlug in your K10 and click **Flash Device** to get started!`,
      compatibleBoard: 'UNIHIKER K10',
      license: 'MIT',
      tags: JSON.stringify(['AI & Machine Learning', 'Robotics', 'Smart Devices']),
      firmwares: JSON.stringify([
        {
          version: 'v1.0.0',
          name: 'Ai Buddy Initial Firmware',
          releaseDate: '10 Sep 2026, 09:00 AM',
          firmwareUrl: '',
          flashAddress: '0x00',
          versionNote: 'Initial public build with animated expressions and sensor loop.',
        }
      ]),
      createdAt: now,
      updatedAt: now,
    }
  ]).onConflictDoNothing();

  console.log('✅ Database seeded successfully!');
  process.exit(0);
}

seed().catch((err) => {
  console.error('❌ Seed failed:', err);
  process.exit(1);
});

