import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { env } from '../config/env';

let supabaseClient: SupabaseClient | null = null;

export function isSupabaseConfigured(): boolean {
  return Boolean(
    env.SUPABASE_URL && 
    (env.SUPABASE_SERVICE_ROLE_KEY || env.SUPABASE_ANON_KEY) &&
    !env.SUPABASE_URL.includes('your-project')
  );
}

export function getSupabaseClient(): SupabaseClient | null {
  if (!isSupabaseConfigured()) {
    return null;
  }
  if (!supabaseClient) {
    const key = env.SUPABASE_SERVICE_ROLE_KEY || env.SUPABASE_ANON_KEY;
    supabaseClient = createClient(env.SUPABASE_URL, key, {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    });
  }
  return supabaseClient;
}

export interface VerifiedAuthUser {
  uid: string;
  userKey?: string;
  email: string;
  name?: string;
  avatarUrl?: string;
  isEmailVerified: boolean;
  emailConfirmedAt: number | null;
}

interface CachedVerifiedToken {
  user: VerifiedAuthUser;
  expiresAt: number;
}
const tokenCache = new Map<string, CachedVerifiedToken>();

/**
 * Verifies a real Supabase Bearer JWT token against Supabase Auth.
 */
export async function verifyAuthToken(token: string): Promise<{ user: VerifiedAuthUser | null; error: string | null }> {
  if (!token) {
    return { user: null, error: 'No authorization token provided' };
  }

  // Fast in-memory cache check (60s TTL)
  const now = Date.now();
  const cached = tokenCache.get(token);
  if (cached && cached.expiresAt > now) {
    return { user: cached.user, error: null };
  }

  // Development bypass token for local development & browser tests
  if (process.env.NODE_ENV === 'development' && token === 'dev-admin-token') {
    return {
      user: {
        uid: 'dev-admin-uid-mukesh',
        email: 'mukeshdiy1@gmail.com',
        name: 'Mukesh Admin',
        avatarUrl: undefined,
        isEmailVerified: true,
        emailConfirmedAt: Math.floor(Date.now() / 1000),
      },
      error: null,
    };
  }

  const supabase = getSupabaseClient();
  if (!supabase) {
    return {
      user: null,
      error: 'Supabase authentication service is not configured on the backend. Please provide SUPABASE_URL and SUPABASE_ANON_KEY or SUPABASE_SERVICE_ROLE_KEY in your backend .env file.',
    };
  }

  try {
    const { data, error } = await supabase.auth.getUser(token);
    if (error || !data.user) {
      return { user: null, error: error?.message || 'Invalid or expired authentication session' };
    }

    const sbUser = data.user;
    const metadata = sbUser.user_metadata || {};
    const name = metadata.full_name || metadata.name || sbUser.email?.split('@')[0] || 'K10 Maker';
    const avatarUrl = metadata.avatar_url || metadata.picture;

    const confirmedStr = sbUser.email_confirmed_at || (sbUser as any).confirmed_at;
    const emailConfirmedAt = confirmedStr ? Math.floor(new Date(confirmedStr).getTime() / 1000) : null;
    const isEmailVerified = Boolean(confirmedStr);
    const userKey = metadata.user_key || metadata.userKey || undefined;

    const verifiedUser: VerifiedAuthUser = {
      uid: sbUser.id,
      userKey,
      email: sbUser.email || '',
      name,
      avatarUrl,
      isEmailVerified,
      emailConfirmedAt,
    };

    tokenCache.set(token, {
      user: verifiedUser,
      expiresAt: now + 60 * 1000,
    });

    if (tokenCache.size > 500) {
      for (const [k, v] of tokenCache.entries()) {
        if (v.expiresAt <= now) tokenCache.delete(k);
      }
    }

    return {
      user: verifiedUser,
      error: null,
    };
  } catch (err: any) {
    return { user: null, error: err.message || 'Token verification error' };
  }
}
