import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { supabase, isSupabaseConfigured } from '../services/supabase';
import { api, setAuthTokenGetter, UserProfile, AuthorApplication, UserRole, ProjectSummary } from '../services/api';
import { syncCurrentUserProjects, syncAuthorProfileAcrossProjects, mergeBackendAuthorProjects } from '../services/projects/projectStorageService';

interface AuthContextType {
  user: any | null;
  profile: UserProfile | null;
  application: AuthorApplication | null;
  contributedProjects: ProjectSummary[];
  role: UserRole;
  isEmailVerified: boolean;
  loading: boolean;
  isConfigured: boolean;
  signInWithEmail: (email: string, password: string) => Promise<{ error?: string; isEmailUnconfirmed?: boolean; email?: string }>;
  signUpWithEmail: (email: string, password: string, fullName: string) => Promise<{ error?: string; confirmationRequired?: boolean; email?: string }>;
  resendVerificationEmail: (targetEmail?: string) => Promise<{ success: boolean; message?: string; error?: string }>;
  verifyEmailOtp: (email: string, token: string, type?: 'signup' | 'email') => Promise<{ success: boolean; message?: string; error?: string }>;
  signOut: () => Promise<void>;
  refreshProfile: () => Promise<void>;
  updateProfile: (data: Parameters<typeof api.auth.updateProfile>[0]) => Promise<{ success: boolean; message?: string; error?: string }>;
  applyAuthor: (data: Parameters<typeof api.auth.applyAuthor>[0]) => Promise<{ success: boolean; message?: string; error?: string }>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<any | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [application, setApplication] = useState<AuthorApplication | null>(null);
  const [contributedProjects, setContributedProjects] = useState<ProjectSummary[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchBackendProfile = useCallback(async (token?: string) => {
    try {
      if (token) {
        setAuthTokenGetter(() => token);
      }
      const res = await api.auth.me();
      setProfile(res.user);
      setApplication(res.application);
      if (res.contributedProjects) {
        setContributedProjects(res.contributedProjects);
        mergeBackendAuthorProjects(res.contributedProjects);
      }
      return { success: true, user: res.user };
    } catch (err: any) {
      const errMsg = err?.message || '';
      if (errMsg.includes('ACCOUNT_SUSPENDED') || errMsg.toLowerCase().includes('suspended')) {
        if (isSupabaseConfigured && supabase) {
          await supabase.auth.signOut().catch(() => {});
        }
        setUser(null);
        setProfile(null);
        setApplication(null);
        setAuthTokenGetter(() => null);
        return { error: 'Your account has been suspended. Please contact platform administrators.' };
      }
      console.warn('Could not sync user profile from backend API:', err);
      return { error: errMsg };
    }
  }, []);

  // Initialize live Supabase authentication session
  useEffect(() => {
    let mounted = true;

    async function init() {
      // Local development token support for automated tests & admin preview
      const devToken = localStorage.getItem('k10_dev_token');
      if (devToken && mounted) {
        setUser({ id: 'dev-admin-uid-mukesh', email: 'mukeshdiy1@gmail.com', user_metadata: { name: 'Mukesh Admin' } });
        setAuthTokenGetter(() => devToken);
        await fetchBackendProfile(devToken);
        setLoading(false);
        return;
      }

      if (!isSupabaseConfigured || !supabase) {
        setLoading(false);
        return;
      }

      try {
        const { data: { session } } = await supabase.auth.getSession();
        if (session && mounted) {
          setUser(session.user);
          setAuthTokenGetter(() => session.access_token);
          await fetchBackendProfile(session.access_token);
        }

        const { data: { subscription } } = supabase.auth.onAuthStateChange(async (_event, session) => {
          if (!mounted) return;
          if (session) {
            setUser(session.user);
            setAuthTokenGetter(() => session.access_token);
            await fetchBackendProfile(session.access_token);
          } else {
            setUser(null);
            setProfile(null);
            setApplication(null);
            setAuthTokenGetter(() => null);
          }
        });

        return () => {
          subscription.unsubscribe();
        };
      } catch (err) {
        console.error('Error during Supabase session initialization:', err);
      } finally {
        if (mounted) setLoading(false);
      }
    }

    init();
    return () => {
      mounted = false;
    };
  }, [fetchBackendProfile]);

  // Production Sign In with email & password
  const signInWithEmail = async (email: string, password: string) => {
    if (!isSupabaseConfigured || !supabase) {
      return {
        error: 'Supabase credentials are not configured. Please add VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY to your frontend/.env file.',
      };
    }

    setLoading(true);
    try {
      const trimmedEmail = email.trim().toLowerCase();
      const { data, error } = await supabase.auth.signInWithPassword({
        email: trimmedEmail,
        password,
      });
      if (error) {
        const msg = error.message;
        if (msg.toLowerCase().includes('email not confirmed') || msg.toLowerCase().includes('not confirmed')) {
          return {
            error: 'Your email address is not verified yet. Please check your inbox or resend the verification email.',
            isEmailUnconfirmed: true,
            email: trimmedEmail,
          };
        }
        return { error: msg };
      }

      if (data.session) {
        const activeSession = data.session;
        setUser(data.user);
        setAuthTokenGetter(() => activeSession.access_token);
        const profileRes = await fetchBackendProfile(activeSession.access_token);
        if (profileRes?.error) {
          return { error: profileRes.error };
        }
      }
      return {};
    } catch (err: any) {
      return { error: err.message || 'Failed to sign in' };
    } finally {
      setLoading(false);
    }
  };

  // Production Sign Up with email, password & user metadata
  const signUpWithEmail = async (email: string, password: string, fullName: string) => {
    if (!isSupabaseConfigured || !supabase) {
      return {
        error: 'Supabase credentials are not configured. Please add VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY to your frontend/.env file.',
      };
    }

    setLoading(true);
    try {
      const trimmedEmail = email.trim().toLowerCase();
      const trimmedName = fullName.trim();

      // 1. First attempt registration via backend API
      try {
        const regRes = await fetch('/api/auth/register', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            email: trimmedEmail,
            password,
            name: trimmedName,
          }),
        });

        const regData = await regRes.json();

        if (regRes.status === 409) {
          return { error: 'An account with this email address already exists. Please sign in instead.' };
        }

        if (regRes.ok && regData.success) {
          if (regData.confirmationRequired) {
            return { confirmationRequired: true, email: trimmedEmail };
          }
          // Auto-sign in with the credentials if confirmation is not required
          const loginRes = await signInWithEmail(trimmedEmail, password);
          if (loginRes.error) {
            return { confirmationRequired: false, error: loginRes.error, email: trimmedEmail };
          }
          return { confirmationRequired: false, email: trimmedEmail };
        }

        if (!regRes.ok && regData.error && regData.error !== 'AUTH_CONFIG_ERROR') {
          return { error: regData.message || 'Failed to create account.' };
        }
      } catch (backendErr) {
        console.warn('Backend registration failed, trying client signUp fallback:', backendErr);
      }

      // 2. Client fallback
      const { data, error } = await supabase.auth.signUp({
        email: trimmedEmail,
        password,
        options: {
          data: {
            full_name: trimmedName,
            name: trimmedName,
          },
          emailRedirectTo: `${window.location.origin}/verify-email`,
        },
      });

      if (error) {
        if (error.message.toLowerCase().includes('rate limit')) {
          return {
            error: 'Email rate limit reached on Supabase. If you already have an account, please click "Sign in" below.',
          };
        }
        return { error: error.message };
      }

      if (data.session) {
        const activeSession = data.session;
        setUser(data.user);
        setAuthTokenGetter(() => activeSession.access_token);
        await fetchBackendProfile(activeSession.access_token);
        return { confirmationRequired: false, email: trimmedEmail };
      }

      // If Supabase project has email confirmation enabled
      return { confirmationRequired: true, email: trimmedEmail };
    } catch (err: any) {
      return { error: err.message || 'Failed to sign up' };
    } finally {
      setLoading(false);
    }
  };

  // Resend Verification Email via backend API with client fallback
  const resendVerificationEmail = async (targetEmail?: string) => {
    const emailToUse = (targetEmail || user?.email || profile?.email || '').trim().toLowerCase();
    if (!emailToUse) {
      return { success: false, error: 'No email address available to resend verification.' };
    }

    try {
      // 1. Attempt backend endpoint
      try {
        const res = await api.auth.resendVerification(emailToUse);
        if (res.success) {
          return { success: true, message: res.message };
        }
      } catch (beErr) {
        console.warn('Backend resend failed, falling back to Supabase client:', beErr);
      }

      // 2. Client Supabase fallback
      if (isSupabaseConfigured && supabase) {
        const { error } = await supabase.auth.resend({
          type: 'signup',
          email: emailToUse,
          options: {
            emailRedirectTo: `${window.location.origin}/verify-email`,
          },
        });
        if (error) {
          return { success: false, error: error.message };
        }
        return { success: true, message: `Verification email resent to ${emailToUse}. Please check your inbox.` };
      }
      return { success: false, error: 'Authentication service is not configured.' };
    } catch (err: any) {
      return { success: false, error: err.message || 'Failed to resend verification email.' };
    }
  };

  // Verify Email via 6-digit OTP code
  const verifyEmailOtp = async (email: string, token: string, type: 'signup' | 'email' = 'signup') => {
    const normalizedEmail = email.trim().toLowerCase();
    const cleanToken = token.trim();

    try {
      // 1. Attempt backend verification
      try {
        const res = await api.auth.verifyEmailOtp(normalizedEmail, cleanToken, type);
        if (res.success) {
          if (res.session) {
            setUser(res.user);
            setAuthTokenGetter(() => res.session.access_token);
            await fetchBackendProfile(res.session.access_token);
          } else {
            await fetchBackendProfile();
          }
          return { success: true, message: res.message };
        }
      } catch (beErr) {
        console.warn('Backend verify OTP failed, falling back to client Supabase:', beErr);
      }

      // 2. Client fallback
      if (isSupabaseConfigured && supabase) {
        const { data, error } = await supabase.auth.verifyOtp({
          email: normalizedEmail,
          token: cleanToken,
          type: type as any,
        });
        if (error) {
          return { success: false, error: error.message };
        }
        const activeSession = data.session;
        if (activeSession) {
          setUser(data.user);
          setAuthTokenGetter(() => activeSession.access_token);
          await fetchBackendProfile(activeSession.access_token);
        }
        return { success: true, message: 'Email address verified successfully!' };
      }
      return { success: false, error: 'Authentication service is not configured.' };
    } catch (err: any) {
      return { success: false, error: err.message || 'Verification failed.' };
    }
  };

  // Production Sign Out
  const signOut = async () => {
    setLoading(true);
    try {
      if (isSupabaseConfigured && supabase) {
        await supabase.auth.signOut();
      }
      localStorage.removeItem('k10_dev_token');
      setUser(null);
      setProfile(null);
      setApplication(null);
      setContributedProjects([]);
      setAuthTokenGetter(() => null);
    } catch (err) {
      console.error('Sign out error:', err);
    } finally {
      setLoading(false);
    }
  };

  const refreshProfile = async () => {
    await fetchBackendProfile();
  };

  // Update user profile
  const updateProfile = async (data: Parameters<typeof api.auth.updateProfile>[0]) => {
    try {
      // 1. Sync metadata directly to Supabase Auth so user_metadata is updated in Supabase
      if (isSupabaseConfigured && supabase && user) {
        try {
          const clientMetadataUpdates: Record<string, any> = {};
          if (data.name !== undefined && data.name.trim()) {
            clientMetadataUpdates.name = data.name.trim();
            clientMetadataUpdates.full_name = data.name.trim();
          }
          if (data.avatarUrl !== undefined) {
            clientMetadataUpdates.avatar_url = data.avatarUrl;
          }
          if (Object.keys(clientMetadataUpdates).length > 0) {
            const { data: sbData, error: sbErr } = await supabase.auth.updateUser({
              data: clientMetadataUpdates,
            });
            if (!sbErr && sbData?.user) {
              setUser(sbData.user);
            }
          }
        } catch (sbClientErr) {
          console.warn('Could not sync user update directly to Supabase client:', sbClientErr);
        }
      }

      // 2. Persist profile update to backend
      const res = await api.auth.updateProfile(data);
      setProfile(res.user);
      if (res.user) {
        setUser((prev: any) => prev ? {
          ...prev,
          user_metadata: {
            ...(prev.user_metadata || {}),
            name: res.user.name,
            full_name: res.user.name,
            avatar_url: res.user.avatarUrl || prev?.user_metadata?.avatar_url,
          },
        } : null);

        syncAuthorProfileAcrossProjects(
          {
            id: res.user.id,
            email: res.user.email,
            name: res.user.name,
          },
          {
            name: res.user.name,
            avatarUrl: res.user.avatarUrl || undefined,
            role: res.user.role,
            email: res.user.email,
          }
        );
      }
      await fetchBackendProfile();
      return { success: true, message: res.message };
    } catch (err: any) {
      return { success: false, error: err.message || 'Failed to update profile' };
    }
  };

  // Sync projects belonging to current user when auth state changes
  useEffect(() => {
    if (user || profile) {
      syncCurrentUserProjects(user, profile);
    }
  }, [user, profile]);

  // Submit author verification application
  const applyAuthor = async (data: Parameters<typeof api.auth.applyAuthor>[0]) => {
    try {
      const res = await api.auth.applyAuthor(data);
      setApplication(res.application);
      await fetchBackendProfile();
      return { success: true, message: res.message };
    } catch (err: any) {
      return { success: false, error: err.message || 'Failed to submit author application' };
    }
  };

  const isEmailVerified = Boolean(
    user?.email_confirmed_at ||
    (user as any)?.confirmed_at ||
    profile?.isEmailVerified
  );

  const role: UserRole = !user ? 'unknown' : (profile?.role || 'user');

  return (
    <AuthContext.Provider
      value={{
        user,
        profile,
        application,
        contributedProjects,
        role,
        isEmailVerified,
        loading,
        isConfigured: isSupabaseConfigured,
        signInWithEmail,
        signUpWithEmail,
        resendVerificationEmail,
        verifyEmailOtp,
        signOut,
        refreshProfile,
        updateProfile,
        applyAuthor,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
