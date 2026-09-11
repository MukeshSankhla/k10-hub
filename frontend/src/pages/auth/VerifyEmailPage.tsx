import React, { useState, useEffect } from 'react';
import { Link, useNavigate, useSearchParams, useLocation } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { supabase, isSupabaseConfigured } from '../../services/supabase';
import Header from '../../components/layout/Header';
import Footer from '../../components/layout/Footer';
import { Mail, CheckCircle2, AlertCircle, ArrowRight, RefreshCw, ShieldCheck, KeyRound } from 'lucide-react';

export default function VerifyEmailPage() {
  const [searchParams] = useSearchParams();
  const location = useLocation();
  const navigate = useNavigate();
  const { user, isEmailVerified, resendVerificationEmail, verifyEmailOtp, refreshProfile } = useAuth();

  const [email, setEmail] = useState<string>(() => {
    return searchParams.get('email') || user?.email || '';
  });
  const [otpCode, setOtpCode] = useState('');
  const [status, setStatus] = useState<'verifying' | 'success' | 'awaiting' | 'error'>('awaiting');
  const [message, setMessage] = useState('');
  const [resendCooldown, setResendCooldown] = useState(0);
  const [isResending, setIsResending] = useState(false);
  const [isSubmittingOtp, setIsSubmittingOtp] = useState(false);

  // Cooldown countdown timer
  useEffect(() => {
    if (resendCooldown <= 0) return;
    const interval = setInterval(() => {
      setResendCooldown((prev) => (prev > 0 ? prev - 1 : 0));
    }, 1000);
    return () => clearInterval(interval);
  }, [resendCooldown]);

  // Handle URL token verification on mount
  useEffect(() => {
    const processVerification = async () => {
      // 1. Check if user is already verified
      if (isEmailVerified) {
        setStatus('success');
        setMessage('Your email address is already verified!');
        return;
      }

      // 2. Check query params (token_hash, code)
      const tokenHash = searchParams.get('token_hash');
      const type = (searchParams.get('type') || 'signup') as any;
      const code = searchParams.get('code');

      // 3. Check hash fragment (#access_token=... or #error=...)
      const hashParams = new URLSearchParams(location.hash.startsWith('#') ? location.hash.substring(1) : location.hash);
      const hashAccessToken = hashParams.get('access_token');
      const hashError = hashParams.get('error_description') || hashParams.get('error');

      if (hashError) {
        setStatus('error');
        setMessage(decodeURIComponent(hashError));
        return;
      }

      if (tokenHash) {
        setStatus('verifying');
        setMessage('Verifying your email address...');
        try {
          if (isSupabaseConfigured && supabase) {
            const { error } = await supabase.auth.verifyOtp({
              token_hash: tokenHash,
              type: type || 'signup',
            });
            if (error) {
              setStatus('error');
              setMessage(error.message || 'Verification link has expired or is invalid.');
            } else {
              await refreshProfile();
              setStatus('success');
              setMessage('Your email has been verified successfully!');
            }
          }
        } catch (err: any) {
          setStatus('error');
          setMessage(err.message || 'Failed to verify email.');
        }
        return;
      }

      if (code && isSupabaseConfigured && supabase) {
        setStatus('verifying');
        setMessage('Exchanging verification code...');
        try {
          const { error } = await supabase.auth.exchangeCodeForSession(code);
          if (error) {
            setStatus('error');
            setMessage(error.message || 'Verification code could not be redeemed.');
          } else {
            await refreshProfile();
            setStatus('success');
            setMessage('Your email has been verified successfully!');
          }
        } catch (err: any) {
          setStatus('error');
          setMessage(err.message || 'Failed to verify code.');
        }
        return;
      }

      if (hashAccessToken) {
        setStatus('success');
        setMessage('Email verified successfully! You are now logged in.');
        await refreshProfile();
        return;
      }

      // If email provided in query or logged in
      const queryEmail = searchParams.get('email') || user?.email;
      if (queryEmail) {
        setEmail(queryEmail);
      }
      setStatus('awaiting');
    };

    processVerification();
  }, [searchParams, location.hash, isEmailVerified, refreshProfile, user]);

  const handleResend = async () => {
    if (resendCooldown > 0 || isResending) return;
    const target = email.trim() || user?.email;
    if (!target) {
      setMessage('Please enter your email address to receive a verification link.');
      return;
    }

    setIsResending(true);
    const res = await resendVerificationEmail(target);
    setIsResending(false);

    if (res.success) {
      setResendCooldown(60);
      setMessage(res.message || 'Verification email resent! Please check your inbox.');
    } else {
      setMessage(res.error || 'Failed to resend verification email.');
    }
  };

  const handleOtpSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleanOtp = otpCode.trim();
    if (!cleanOtp) return;
    if (!email.trim()) {
      setMessage('Please enter the email address associated with your account.');
      return;
    }

    setIsSubmittingOtp(true);
    setMessage('');
    const res = await verifyEmailOtp(email.trim(), cleanOtp, 'signup');
    setIsSubmittingOtp(false);

    if (res.success) {
      setStatus('success');
      setMessage('Your email has been verified successfully!');
      await refreshProfile();
    } else {
      setStatus('error');
      setMessage(res.error || 'Invalid verification code. Please check and try again.');
    }
  };

  return (
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column', backgroundColor: 'var(--color-paper)' }}>
      <Header />

      <main style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 'calc(var(--nav-height) + var(--space-8)) var(--space-4) var(--space-12)' }}>
        <div style={{ width: '100%', maxWidth: 500 }}>
          <div style={{
            backgroundColor: 'var(--color-surface)',
            border: '1px solid var(--color-border)',
            borderRadius: 'var(--radius-xl)',
            padding: 'var(--space-8)',
            boxShadow: 'var(--shadow-lg)',
            textAlign: 'center',
          }}>

            {/* VERIFYING STATE */}
            {status === 'verifying' && (
              <div>
                <div style={{
                  width: 56,
                  height: 56,
                  borderRadius: '50%',
                  backgroundColor: 'rgba(59, 130, 246, 0.1)',
                  color: 'rgb(37, 99, 235)',
                  display: 'inline-flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  marginBottom: 'var(--space-4)',
                }}>
                  <RefreshCw size={28} className="animate-spin" style={{ animation: 'spin 1.5s linear infinite' }} />
                </div>
                <h1 style={{ fontSize: 'var(--text-2xl)', fontWeight: 700, color: 'var(--color-ink-primary)', margin: '0 0 var(--space-2)' }}>
                  Verifying Email...
                </h1>
                <p style={{ color: 'var(--color-ink-secondary)', fontSize: 'var(--text-sm)', lineHeight: 1.6 }}>
                  {message || 'Confirming your verification link. Please hold on a moment...'}
                </p>
              </div>
            )}

            {/* SUCCESS STATE */}
            {status === 'success' && (
              <div>
                <div style={{
                  width: 56,
                  height: 56,
                  borderRadius: '50%',
                  backgroundColor: 'rgba(34, 197, 94, 0.1)',
                  color: 'rgb(22, 163, 74)',
                  display: 'inline-flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  marginBottom: 'var(--space-4)',
                }}>
                  <ShieldCheck size={32} />
                </div>
                <h1 style={{ fontSize: 'var(--text-2xl)', fontWeight: 700, color: 'var(--color-ink-primary)', margin: '0 0 var(--space-2)' }}>
                  Email Verified!
                </h1>
                <p style={{ color: 'var(--color-ink-secondary)', fontSize: 'var(--text-sm)', lineHeight: 1.6, marginBottom: 'var(--space-6)' }}>
                  {message || 'Your email address has been verified. Your K10 Hub account is fully activated.'}
                </p>

                <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-3)' }}>
                  <button
                    onClick={() => navigate('/profile')}
                    style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: '0.5rem',
                      width: '100%',
                      padding: '0.75rem 1rem',
                      backgroundColor: 'var(--color-accent)',
                      color: 'var(--color-paper)',
                      border: 'none',
                      borderRadius: 'var(--radius-md)',
                      fontSize: 'var(--text-sm)',
                      fontWeight: 600,
                      cursor: 'pointer',
                    }}
                  >
                    Go to Your Profile <ArrowRight size={16} />
                  </button>
                  <Link
                    to="/projects"
                    style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      width: '100%',
                      padding: '0.75rem 1rem',
                      backgroundColor: 'transparent',
                      color: 'var(--color-ink-secondary)',
                      border: '1px solid var(--color-border)',
                      borderRadius: 'var(--radius-md)',
                      fontSize: 'var(--text-sm)',
                      fontWeight: 500,
                      textDecoration: 'none',
                    }}
                  >
                    Explore Hardware Projects
                  </Link>
                </div>
              </div>
            )}

            {/* AWAITING / RESEND / OTP STATE */}
            {(status === 'awaiting' || status === 'error') && (
              <div>
                <div style={{
                  width: 56,
                  height: 56,
                  borderRadius: '50%',
                  backgroundColor: status === 'error' ? 'rgba(239, 68, 68, 0.1)' : 'rgba(249, 115, 22, 0.1)',
                  color: status === 'error' ? 'rgb(220, 38, 38)' : 'var(--color-accent)',
                  display: 'inline-flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  marginBottom: 'var(--space-4)',
                }}>
                  {status === 'error' ? <AlertCircle size={30} /> : <Mail size={30} />}
                </div>

                <h1 style={{ fontSize: 'var(--text-2xl)', fontWeight: 700, color: 'var(--color-ink-primary)', margin: '0 0 var(--space-2)' }}>
                  {status === 'error' ? 'Verification Notice' : 'Verify Your Email'}
                </h1>

                <p style={{ color: 'var(--color-ink-secondary)', fontSize: 'var(--text-sm)', lineHeight: 1.6, marginBottom: 'var(--space-4)' }}>
                  {email ? (
                    <>
                      We sent a verification link to <strong style={{ color: 'var(--color-ink-primary)' }}>{email}</strong>.
                      Click the link in the email or enter your verification code below.
                    </>
                  ) : (
                    'Please verify your email address to unlock project publishing, bookmarks, and author applications.'
                  )}
                </p>

                {message && (
                  <div style={{
                    display: 'flex',
                    alignItems: 'flex-start',
                    gap: '0.6rem',
                    backgroundColor: status === 'error' ? 'rgba(239, 68, 68, 0.1)' : 'rgba(34, 197, 94, 0.1)',
                    border: `1px solid ${status === 'error' ? 'rgba(239, 68, 68, 0.3)' : 'rgba(34, 197, 94, 0.3)'}`,
                    color: status === 'error' ? 'rgb(220, 38, 38)' : 'rgb(22, 163, 74)',
                    padding: 'var(--space-3) var(--space-4)',
                    borderRadius: 'var(--radius-md)',
                    fontSize: 'var(--text-xs)',
                    textAlign: 'left',
                    marginBottom: 'var(--space-5)',
                  }}>
                    {status === 'error' ? <AlertCircle size={16} style={{ flexShrink: 0, marginTop: 1 }} /> : <CheckCircle2 size={16} style={{ flexShrink: 0, marginTop: 1 }} />}
                    <span>{message}</span>
                  </div>
                )}

                {/* Optional 6-digit OTP code entry */}
                <form onSubmit={handleOtpSubmit} style={{ marginBottom: 'var(--space-6)', textAlign: 'left' }}>
                  <label style={{ display: 'block', fontSize: 'var(--text-xs)', fontWeight: 600, color: 'var(--color-ink-secondary)', marginBottom: 'var(--space-2)' }}>
                    Have a 6-digit verification code?
                  </label>
                  <div style={{ display: 'flex', gap: 'var(--space-2)' }}>
                    <div style={{ position: 'relative', flex: 1 }}>
                      <KeyRound size={16} style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: 'var(--color-ink-tertiary)' }} />
                      <input
                        type="text"
                        value={otpCode}
                        onChange={(e) => setOtpCode(e.target.value)}
                        placeholder="e.g. 123456"
                        maxLength={10}
                        style={{
                          width: '100%',
                          padding: '0.65rem 0.75rem 0.65rem 2.4rem',
                          backgroundColor: 'var(--color-paper)',
                          border: '1px solid var(--color-border)',
                          borderRadius: 'var(--radius-md)',
                          fontSize: 'var(--text-sm)',
                          color: 'var(--color-ink-primary)',
                          letterSpacing: '0.1em',
                        }}
                      />
                    </div>
                    <button
                      type="submit"
                      disabled={isSubmittingOtp || otpCode.trim().length < 4}
                      style={{
                        padding: '0.65rem 1rem',
                        backgroundColor: 'var(--color-ink-primary)',
                        color: 'var(--color-paper)',
                        border: 'none',
                        borderRadius: 'var(--radius-md)',
                        fontSize: 'var(--text-xs)',
                        fontWeight: 600,
                        cursor: isSubmittingOtp || otpCode.trim().length < 4 ? 'not-allowed' : 'pointer',
                        opacity: isSubmittingOtp || otpCode.trim().length < 4 ? 0.6 : 1,
                      }}
                    >
                      {isSubmittingOtp ? 'Checking...' : 'Verify'}
                    </button>
                  </div>
                </form>

                {/* Resend button */}
                <div style={{
                  padding: 'var(--space-4)',
                  backgroundColor: 'var(--color-paper)',
                  borderRadius: 'var(--radius-lg)',
                  border: '1px solid var(--color-border)',
                  marginBottom: 'var(--space-5)',
                }}>
                  <p style={{ fontSize: 'var(--text-xs)', color: 'var(--color-ink-secondary)', margin: '0 0 var(--space-3)' }}>
                    Didn't receive the email? Check your spam folder or request a new verification link.
                  </p>
                  <button
                    onClick={handleResend}
                    disabled={resendCooldown > 0 || isResending}
                    style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: '0.4rem',
                      padding: '0.6rem 1rem',
                      backgroundColor: resendCooldown > 0 ? 'var(--color-border)' : 'var(--color-surface)',
                      color: resendCooldown > 0 ? 'var(--color-ink-tertiary)' : 'var(--color-ink-primary)',
                      border: '1px solid var(--color-border)',
                      borderRadius: 'var(--radius-md)',
                      fontSize: 'var(--text-xs)',
                      fontWeight: 600,
                      cursor: resendCooldown > 0 || isResending ? 'not-allowed' : 'pointer',
                    }}
                  >
                    <RefreshCw size={14} className={isResending ? 'animate-spin' : ''} />
                    {isResending ? 'Sending...' : resendCooldown > 0 ? `Resend email in ${resendCooldown}s` : 'Resend Verification Email'}
                  </button>
                </div>

                <div style={{ display: 'flex', justifyContent: 'center', gap: 'var(--space-4)', fontSize: 'var(--text-xs)' }}>
                  <Link to="/login" style={{ color: 'var(--color-ink-secondary)', textDecoration: 'none' }}>
                    &larr; Back to sign in
                  </Link>
                  <span style={{ color: 'var(--color-border)' }}>|</span>
                  <Link to="/profile" style={{ color: 'var(--color-accent)', textDecoration: 'none', fontWeight: 600 }}>
                    Go to Profile
                  </Link>
                </div>
              </div>
            )}

          </div>
        </div>
      </main>

      <Footer />
    </div>
  );
}
