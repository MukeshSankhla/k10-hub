import { Router, Response, Request } from 'express';
import { z } from 'zod';
import { eq, desc, or, like, and } from 'drizzle-orm';
import { db } from '../../config/database';
import { users, authorApplications } from '../../db/schema';
import { requireAuth, AuthRequest, syncOrProvisionUser } from '../../middleware/auth';
import { projectService } from '../../services/ProjectService';
import { getSupabaseClient } from '../../services/supabase';

const router = Router();

// Helper for safe HTTP/HTTPS URLs
const safeHttpUrl = z.string().trim().max(500).refine((val) => {
  if (!val) return true;
  try {
    const parsed = new URL(val);
    return parsed.protocol === 'http:' || parsed.protocol === 'https:';
  } catch {
    return false;
  }
}, { message: 'Must be a valid HTTP or HTTPS URL' });

// Validation schema for Author Application
const applyAuthorSchema = z.object({
  bio: z.string().trim().min(3, 'Please tell us who you are in at least 3 characters').max(1000, 'Bio cannot exceed 1000 characters'),
  githubUrl: safeHttpUrl.optional().or(z.literal('')),
  hardwareExperience: z.string().trim().max(2000).optional(),
  sampleProjectIdeas: z.string().trim().max(2000).optional(),
  workedOnUnihiker: z.boolean().optional(),
  unihikerProjectUrl: safeHttpUrl.optional().or(z.literal('')),
  acceptedTerms: z.boolean().optional(),
});

// Validation schema for profile update
const updateProfileSchema = z.object({
  name: z.string().trim().min(2, 'Name must be at least 2 characters').max(60, 'Name cannot exceed 60 characters').optional(),
  avatarUrl: safeHttpUrl.optional().or(z.literal('')),
  bio: z.string().trim().max(1000, 'About bio cannot exceed 1000 characters').optional().or(z.literal('')),
  githubUrl: safeHttpUrl.optional().or(z.literal('')),
  websiteUrl: safeHttpUrl.optional().or(z.literal('')),
  socialPlatform: z.string().trim().max(50).optional().or(z.literal('')),
  socialUrl: safeHttpUrl.optional().or(z.literal('')),
  instagramUrl: safeHttpUrl.optional().or(z.literal('')),
  youtubeUrl: safeHttpUrl.optional().or(z.literal('')),
  linkedinUrl: safeHttpUrl.optional().or(z.literal('')),
});

const registerSchema = z.object({
  email: z.string().email('Invalid email address').max(255),
  password: z.string().min(8, 'Password must be at least 8 characters').max(72),
  name: z.string().min(2, 'Name must be at least 2 characters').max(60),
});

/**
 * POST /api/auth/register
 * Register a new user via Supabase Auth & sync into local DB
 */
router.post('/register', async (req: Request, res: Response) => {
  try {
    const parsed = registerSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({
        error: 'VALIDATION_ERROR',
        message: parsed.error.issues[0]?.message || 'Invalid registration details',
      });
    }

    const { email, password, name } = parsed.data;
    const normalizedEmail = email.trim().toLowerCase();

    // Check if user already exists locally
    const existingUser = await db.query.users.findFirst({
      where: eq(users.email, normalizedEmail),
    });
    if (existingUser) {
      return res.status(400).json({
        error: 'USER_ALREADY_EXISTS',
        message: 'An account with this email address already exists. Please sign in instead.',
      });
    }

    // Register with Supabase
    const supabase = getSupabaseClient();
    if (!supabase) {
      return res.status(500).json({
        error: 'AUTH_CONFIG_ERROR',
        message: 'Authentication service not configured.',
      });
    }
    const { data, error } = await supabase.auth.signUp({
      email: normalizedEmail,
      password,
      options: {
        data: { name },
      },
    });

    if (error) {
      const msg = error.message.toLowerCase();
      if (msg.includes('already registered') || msg.includes('user already exists')) {
        return res.status(400).json({
          error: 'USER_ALREADY_EXISTS',
          message: 'An account with this email address already exists. Please sign in instead.',
        });
      }
      return res.status(400).json({
        error: 'REGISTRATION_FAILED',
        message: error.message,
      });
    }

    const isConfirmed = Boolean(data.user?.email_confirmed_at || (data.user as any)?.confirmed_at);
    if (data.user) {
      // Sync into local database
      await syncOrProvisionUser({
        uid: data.user.id,
        email: normalizedEmail,
        name,
        isEmailVerified: isConfirmed,
        emailConfirmedAt: isConfirmed ? Math.floor(Date.now() / 1000) : null,
      });
    }

    return res.status(201).json({
      success: true,
      confirmationRequired: !isConfirmed,
      message: isConfirmed
        ? 'Account created successfully.'
        : 'Account created! Please check your email inbox to verify your email address.',
    });
  } catch (error: any) {
    console.error('Registration error:', error);
    return res.status(500).json({
      error: 'SERVER_ERROR',
      message: error.message || 'An unexpected error occurred during registration.',
    });
  }
});

const resendVerificationSchema = z.object({
  email: z.string().email('Invalid email address'),
});

/**
 * POST /api/auth/resend-verification
 * Resends the account verification email via Supabase
 */
router.post('/resend-verification', async (req: Request, res: Response) => {
  try {
    const parsed = resendVerificationSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({
        error: 'VALIDATION_ERROR',
        message: parsed.error.issues[0]?.message || 'Please provide a valid email address.',
      });
    }

    const { email } = parsed.data;
    const normalizedEmail = email.trim().toLowerCase();

    const supabase = getSupabaseClient();
    if (!supabase) {
      return res.status(500).json({
        error: 'AUTH_CONFIG_ERROR',
        message: 'Authentication service is not configured.',
      });
    }

    const { error } = await supabase.auth.resend({
      type: 'signup',
      email: normalizedEmail,
    });

    if (error) {
      return res.status(400).json({
        error: 'RESEND_FAILED',
        message: error.message,
      });
    }

    return res.json({
      success: true,
      message: `A verification link has been sent to ${normalizedEmail}. Please check your inbox.`,
    });
  } catch (error: any) {
    console.error('Resend verification error:', error);
    return res.status(500).json({
      error: 'SERVER_ERROR',
      message: error.message || 'Failed to resend verification email.',
    });
  }
});

const verifyEmailOtpSchema = z.object({
  email: z.string().email('Invalid email address'),
  token: z.string().min(4, 'Verification code is required'),
  type: z.enum(['signup', 'email', 'recovery']).default('signup'),
});

/**
 * POST /api/auth/verify-email
 * Verifies email via OTP code
 */
router.post('/verify-email', async (req: Request, res: Response) => {
  try {
    const parsed = verifyEmailOtpSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({
        error: 'VALIDATION_ERROR',
        message: parsed.error.issues[0]?.message || 'Invalid verification details.',
      });
    }

    const { email, token, type } = parsed.data;
    const normalizedEmail = email.trim().toLowerCase();

    const supabase = getSupabaseClient();
    if (!supabase) {
      return res.status(500).json({
        error: 'AUTH_CONFIG_ERROR',
        message: 'Authentication service is not configured.',
      });
    }

    const { data, error } = await supabase.auth.verifyOtp({
      email: normalizedEmail,
      token: token.trim(),
      type: type as any,
    });

    if (error || !data.user) {
      return res.status(400).json({
        error: 'VERIFICATION_FAILED',
        message: error?.message || 'Invalid or expired verification code.',
      });
    }

    const now = Math.floor(Date.now() / 1000);

    // Sync verified user into database
    await syncOrProvisionUser({
      uid: data.user.id,
      email: normalizedEmail,
      name: data.user.user_metadata?.full_name || data.user.user_metadata?.name || normalizedEmail.split('@')[0],
      isEmailVerified: true,
      emailConfirmedAt: now,
    });

    return res.json({
      success: true,
      message: 'Email address verified successfully!',
      session: data.session,
      user: data.user,
    });
  } catch (error: any) {
    console.error('Email verification error:', error);
    return res.status(500).json({
      error: 'SERVER_ERROR',
      message: error.message || 'Failed to verify email address.',
    });
  }
});

/**
 * GET /api/auth/me
 * Returns current authenticated user profile & role, plus contributed projects
 */
router.get('/me', requireAuth, async (req: AuthRequest, res: Response) => {
  try {
    const user = req.user!;

    const userRecord = await db.query.users.findFirst({
      where: eq(users.id, user.id),
    });

    const dbUser = (userRecord || user) as any;

    // Fetch latest application if any
    const latestApplication = await db.query.authorApplications.findFirst({
      where: eq(authorApplications.userId, user.id),
      orderBy: [desc(authorApplications.createdAt)],
    });

    // Fetch contributed projects for this author/admin
    let contributedProjects: any[] = [];
    if (dbUser.role === 'admin' || dbUser.role === 'author') {
      contributedProjects = await projectService.getProjectsByAuthor(dbUser.id, dbUser.email, dbUser.supabaseUid);
    }

    return res.json({
      user: {
        id: dbUser.id,
        supabaseUid: dbUser.supabaseUid,
        email: dbUser.email,
        name: dbUser.name,
        avatarUrl: dbUser.avatarUrl,
        bio: dbUser.bio || null,
        githubUrl: dbUser.githubUrl || null,
        websiteUrl: dbUser.websiteUrl || null,
        socialPlatform: dbUser.socialPlatform || 'linkedin',
        socialUrl: dbUser.socialUrl || null,
        instagramUrl: dbUser.instagramUrl || null,
        youtubeUrl: dbUser.youtubeUrl || null,
        linkedinUrl: dbUser.linkedinUrl || null,
        role: dbUser.role,
        status: dbUser.status,
        isEmailVerified: Boolean(dbUser.isEmailVerified),
        emailConfirmedAt: dbUser.emailConfirmedAt || null,
        authorId: dbUser.id,
        author: {
          id: dbUser.id,
          name: dbUser.name,
          bio: dbUser.bio,
          avatarUrl: dbUser.avatarUrl,
          githubUrl: dbUser.githubUrl,
          websiteUrl: dbUser.websiteUrl,
          role: dbUser.role,
        },
        createdAt: dbUser.createdAt,
        lastSignInAt: dbUser.lastSignInAt,
      },
      application: latestApplication || null,
      contributedProjects,
    });
  } catch (error: any) {
    console.error('Error fetching /me:', error);
    return res.status(500).json({ error: 'INTERNAL_ERROR', message: error.message });
  }
});

/**
 * PATCH /api/auth/profile
 * Update user profile details (Name, About/Bio, GitHub, Social Links, Avatar)
 */
router.patch('/profile', requireAuth, async (req: AuthRequest, res: Response) => {
  try {
    const user = req.user!;
    const parseResult = updateProfileSchema.safeParse(req.body);

    if (!parseResult.success) {
      return res.status(400).json({
        error: 'VALIDATION_ERROR',
        message: parseResult.error.errors[0]?.message || 'Invalid profile data',
      });
    }

    const data = parseResult.data;
    const now = Math.floor(Date.now() / 1000);
    const updates: any = { updatedAt: now };

    if (data.name !== undefined) updates.name = data.name;
    if (data.avatarUrl !== undefined) updates.avatarUrl = data.avatarUrl || null;
    if (data.bio !== undefined) updates.bio = data.bio || null;
    if (data.githubUrl !== undefined) updates.githubUrl = data.githubUrl || null;
    if (data.websiteUrl !== undefined) updates.websiteUrl = data.websiteUrl || null;
    if (data.socialPlatform !== undefined) updates.socialPlatform = data.socialPlatform || null;
    if (data.socialUrl !== undefined) updates.socialUrl = data.socialUrl || null;
    if (data.instagramUrl !== undefined) updates.instagramUrl = data.instagramUrl || null;
    if (data.youtubeUrl !== undefined) updates.youtubeUrl = data.youtubeUrl || null;
    if (data.linkedinUrl !== undefined) updates.linkedinUrl = data.linkedinUrl || null;

    await db.update(users).set(updates).where(eq(users.id, user.id));

    const updatedUser = await db.query.users.findFirst({
      where: eq(users.id, user.id),
    });

    return res.json({
      success: true,
      message: 'Profile updated successfully!',
      user: updatedUser,
    });
  } catch (error: any) {
    console.error('Error updating profile:', error);
    return res.status(500).json({ error: 'UPDATE_ERROR', message: error.message });
  }
});

/**
 * POST /api/auth/sync
 * Sync profile info after login / registration
 */
router.post('/sync', requireAuth, async (req: AuthRequest, res: Response) => {
  try {
    const user = req.user!;
    const body = updateProfileSchema.safeParse(req.body);

    if (body.success) {
      const now = Math.floor(Date.now() / 1000);
      const updates: any = { updatedAt: now };
      if (body.data.name) updates.name = body.data.name;
      if (body.data.avatarUrl) updates.avatarUrl = body.data.avatarUrl;

      await db.update(users).set(updates).where(eq(users.id, user.id));
      req.user = { ...user, ...updates };
    }

    return res.json({
      success: true,
      user: req.user,
    });
  } catch (error: any) {
    return res.status(500).json({ error: 'SYNC_ERROR', message: error.message });
  }
});

/**
 * POST /api/auth/apply-author
 * Authenticated user submits an application to become a verified Author
 */
router.post('/apply-author', requireAuth, async (req: AuthRequest, res: Response) => {
  try {
    const user = req.user!;

    if (user.role === 'author' || user.role === 'admin') {
      return res.status(400).json({
        error: 'ALREADY_AUTHOR',
        message: `You already have ${user.role} privileges on K10 Hub!`,
      });
    }

    const { bio, githubUrl, hardwareExperience, sampleProjectIdeas } = req.body;

    if (!bio || !hardwareExperience || !sampleProjectIdeas) {
      return res.status(400).json({
        error: 'MISSING_FIELDS',
        message: 'Bio, hardware experience, and project ideas are required.',
      });
    }

    // Check if there is already a pending application
    const existing = await db.query.authorApplications.findFirst({
      where: and(
        eq(authorApplications.userId, user.id),
        eq(authorApplications.status, 'pending')
      ),
    });

    if (existing) {
      return res.status(400).json({
        error: 'DUPLICATE_APPLICATION',
        message: 'You already have an author application pending review.',
      });
    }

    const now = Math.floor(Date.now() / 1000);
    const [inserted] = await db
      .insert(authorApplications)
      .values({
        userId: user.id,
        bio: bio.trim(),
        githubUrl: githubUrl ? githubUrl.trim() : null,
        hardwareExperience: hardwareExperience.trim(),
        sampleProjectIdeas: sampleProjectIdeas.trim(),
        status: 'pending',
        createdAt: now,
        updatedAt: now,
      })
      .returning();

    return res.status(201).json({
      success: true,
      message: 'Your author application has been submitted successfully!',
      application: inserted,
    });
  } catch (error: any) {
    console.error('Apply author error:', error);
    return res.status(500).json({ error: 'APPLICATION_ERROR', message: error.message });
  }
});

/**
 * GET /api/auth/my-application
 */
router.get('/my-application', requireAuth, async (req: AuthRequest, res: Response) => {
  try {
    const user = req.user!;
    const latest = await db.query.authorApplications.findFirst({
      where: eq(authorApplications.userId, user.id),
      orderBy: [desc(authorApplications.createdAt)],
    });

    return res.json({ application: latest || null });
  } catch (error: any) {
    return res.status(500).json({ error: 'QUERY_ERROR', message: error.message });
  }
});

/**
 * GET /api/auth/profile/:identifier
 * Public user / creator profile lookup
 */
router.get('/profile/:identifier', async (req: Request, res: Response) => {
  try {
    const { identifier } = req.params;
    if (!identifier) {
      return res.status(400).json({ error: 'MISSING_IDENTIFIER', message: 'Identifier is required' });
    }

    const clean = identifier.trim();
    const isNumeric = /^\d+$/.test(clean);

    let userRecord = null;
    if (isNumeric) {
      userRecord = await db.query.users.findFirst({
        where: eq(users.id, parseInt(clean)),
      });
    }

    if (!userRecord) {
      userRecord = await db.query.users.findFirst({
        where: or(
          eq(users.supabaseUid, clean),
          eq(users.email, clean.toLowerCase()),
          like(users.name, `%${clean}%`)
        ),
      });
    }

    if (userRecord) {
      return res.json({
        user: {
          id: userRecord.id,
          name: userRecord.name,
          avatarUrl: userRecord.avatarUrl,
          bio: userRecord.bio || null,
          githubUrl: userRecord.githubUrl || null,
          websiteUrl: userRecord.websiteUrl || null,
          socialPlatform: userRecord.socialPlatform || 'linkedin',
          socialUrl: userRecord.socialUrl || null,
          instagramUrl: userRecord.instagramUrl || null,
          youtubeUrl: userRecord.youtubeUrl || null,
          linkedinUrl: userRecord.linkedinUrl || null,
          role: userRecord.role,
        }
      });
    }

    return res.status(404).json({ error: 'USER_NOT_FOUND', message: 'User not found' });
  } catch (err: any) {
    return res.status(500).json({ error: 'QUERY_ERROR', message: err.message });
  }
});

export default router;
