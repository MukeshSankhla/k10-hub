import { Request, Response, NextFunction } from 'express';
import { eq, or } from 'drizzle-orm';
import crypto from 'crypto';
import { db } from '../config/database';
import { users } from '../db/schema';
import { verifyAuthToken, VerifiedAuthUser } from '../services/supabase';
import { env } from '../config/env';

export type UserRole = 'user' | 'author' | 'admin';
export type UserStatus = 'active' | 'suspended';

/**
 * Generates an immutable, unique User ID key in format usr_xxxxxxxx (8 hex chars).
 */
export function generateUserKey(): string {
  return `usr_${crypto.randomBytes(4).toString('hex')}`;
}

export interface DbUser {
  id: number;
  userKey?: string | null;
  supabaseUid: string;
  email: string;
  name: string;
  avatarUrl: string | null;
  bio?: string | null;
  githubUrl?: string | null;
  websiteUrl?: string | null;
  socialPlatform?: string | null;
  socialUrl?: string | null;
  instagramUrl?: string | null;
  youtubeUrl?: string | null;
  linkedinUrl?: string | null;
  role: UserRole;
  status: UserStatus;
  isEmailVerified: boolean;
  emailConfirmedAt?: number | null;
  authorId: number | null;
  createdAt: number | null;
  updatedAt: number | null;
  lastSignInAt: number | null;
}

export interface AuthRequest extends Request {
  user?: DbUser;
  authUser?: VerifiedAuthUser;
}

declare global {
  namespace Express {
    interface Request {
      user?: DbUser;
      authUser?: VerifiedAuthUser;
    }
  }
}

/**
 * Extracts Bearer token from header.
 */
function extractToken(req: Request): string | null {
  const authHeader = req.headers.authorization;
  if (!authHeader) return null;
  const parts = authHeader.split(' ');
  if (parts.length === 2 && parts[0].toLowerCase() === 'bearer') {
    return parts[1];
  }
  return null;
}

/**
 * Ensures or provisions a user in the local database based on Supabase identity.
 */
export async function syncOrProvisionUser(verified: VerifiedAuthUser): Promise<DbUser> {
  const normalizedEmail = (verified.email || '').trim().toLowerCase();
  const now = Math.floor(Date.now() / 1000);
  const adminList = env.ADMIN_EMAILS.split(',').map((e) => e.trim().toLowerCase());
  const isAdminEmail = Boolean(normalizedEmail && adminList.includes(normalizedEmail));

  // 1. Try finding by Supabase UID first
  let existing = await db.query.users.findFirst({
    where: eq(users.supabaseUid, verified.uid),
  });

  // 2. If not found by UID, check by email (handles seeded users or re-registered Supabase auth)
  if (!existing && normalizedEmail) {
    existing = await db.query.users.findFirst({
      where: eq(users.email, normalizedEmail),
    });

    if (existing) {
      // Re-link the existing user to the new Supabase UID
      await db
        .update(users)
        .set({
          supabaseUid: verified.uid,
          updatedAt: now,
        })
        .where(eq(users.id, existing.id));
      existing.supabaseUid = verified.uid;
    }
  }

  if (existing) {
    // If account is suspended, do not refresh lastSignInAt
    if (existing.status === 'suspended') {
      return existing as DbUser;
    }

    // If admin email changed in config, ensure admin status
    let role = existing.role as UserRole;
    if (isAdminEmail && role !== 'admin') {
      role = 'admin';
      await db.update(users).set({ role: 'admin', updatedAt: now }).where(eq(users.id, existing.id));
    }

    // Update last login and avatar/name if newly provided
    const updateData: Record<string, any> = {
      lastSignInAt: now,
    };
    if (!existing.userKey) {
      updateData.userKey = verified.userKey || generateUserKey();
    }
    if (verified.isEmailVerified && !existing.isEmailVerified) {
      updateData.isEmailVerified = true;
      updateData.emailConfirmedAt = verified.emailConfirmedAt || now;
    }
    if (verified.name && verified.name.trim() && verified.name.trim() !== existing.name) {
      updateData.name = verified.name.trim().slice(0, 60);
    }
    if (verified.avatarUrl && verified.avatarUrl !== existing.avatarUrl) {
      updateData.avatarUrl = verified.avatarUrl;
    }

    await db.update(users).set(updateData).where(eq(users.id, existing.id));
    return { ...existing, ...updateData, role, lastSignInAt: now } as DbUser;
  }

  // Determine initial role (admin if configured in ADMIN_EMAILS, else user)
  const initialRole: UserRole = isAdminEmail ? 'admin' : 'user';
  const assignedKey = verified.userKey || generateUserKey();

  try {
    const [inserted] = await db
      .insert(users)
      .values({
        userKey: assignedKey,
        supabaseUid: verified.uid,
        email: normalizedEmail,
        name: (verified.name || normalizedEmail.split('@')[0] || 'Maker').trim().slice(0, 60),
        avatarUrl: verified.avatarUrl || null,
        role: initialRole,
        status: 'active',
        isEmailVerified: verified.isEmailVerified ?? false,
        emailConfirmedAt: verified.emailConfirmedAt || null,
        lastSignInAt: now,
        createdAt: now,
        updatedAt: now,
      })
      .returning();

    return inserted as DbUser;
  } catch (insertErr) {
    // Graceful fallback in case of concurrent insert or race condition
    const fallback = await db.query.users.findFirst({
      where: normalizedEmail
        ? or(eq(users.supabaseUid, verified.uid), eq(users.email, normalizedEmail))
        : eq(users.supabaseUid, verified.uid),
    });

    if (fallback) {
      const fbUpdate: Record<string, any> = { updatedAt: now };
      if (fallback.supabaseUid !== verified.uid) {
        fbUpdate.supabaseUid = verified.uid;
      }
      if (!fallback.userKey) {
        fbUpdate.userKey = assignedKey;
      }
      if (Object.keys(fbUpdate).length > 1 || fbUpdate.supabaseUid) {
        await db.update(users).set(fbUpdate).where(eq(users.id, fallback.id));
      }
      return { ...fallback, ...fbUpdate } as DbUser;
    }

    throw insertErr;
  }
}

/**
 * Middleware: Optional Auth. Populates req.user if a valid token is present, but doesn't block guests.
 */
export async function optionalAuth(req: Request, _res: Response, next: NextFunction) {
  try {
    const token = extractToken(req);
    if (!token) return next();

    const { user: verified, error } = await verifyAuthToken(token);
    if (error || !verified) return next();

    const dbUser = await syncOrProvisionUser(verified);
    if (dbUser.status !== 'suspended') {
      req.user = dbUser;
      req.authUser = verified;
    }
  } catch (err) {
    console.error('optionalAuth error:', err);
  }
  next();
}

/**
 * Middleware: Required Auth. Returns 401 if missing, invalid, or suspended.
 */
export async function requireAuth(req: Request, res: Response, next: NextFunction) {
  const token = extractToken(req);
  if (!token) {
    return res.status(401).json({
      error: 'UNAUTHORIZED',
      message: 'Authentication required. Please sign in.',
    });
  }

  const { user: verified, error } = await verifyAuthToken(token);
  if (error || !verified) {
    return res.status(401).json({
      error: 'INVALID_TOKEN',
      message: error || 'Your session has expired. Please sign in again.',
    });
  }

  try {
    const dbUser = await syncOrProvisionUser(verified);

    if (dbUser.status === 'suspended') {
      return res.status(403).json({
        error: 'ACCOUNT_SUSPENDED',
        message: 'Your account has been suspended. Please contact platform administrators.',
      });
    }

    req.user = dbUser;
    req.authUser = verified;
    next();
  } catch (err: any) {
    console.error('requireAuth database error:', err);
    return res.status(500).json({
      error: 'DATABASE_ERROR',
      message: 'Could not resolve user profile.',
    });
  }
}

/**
 * Middleware: Enforce minimum required role(s).
 */
export function requireRole(...allowedRoles: UserRole[]) {
  return (req: Request, res: Response, next: NextFunction) => {
    if (!req.user) {
      return res.status(401).json({
        error: 'UNAUTHORIZED',
        message: 'Authentication required.',
      });
    }

    // Admins always have access to everything
    if (req.user.role === 'admin' || allowedRoles.includes(req.user.role)) {
      return next();
    }

    return res.status(403).json({
      error: 'FORBIDDEN',
      message: `Access denied. Requires one of roles: [${allowedRoles.join(', ')}]. Current role: ${req.user.role}`,
    });
  };
}

export const requireAdmin = [requireAuth, requireRole('admin')];
export const requireAuthor = [requireAuth, requireRole('author', 'admin')];
