import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { Mail, RefreshCw, X, CheckCircle2 } from 'lucide-react';

export default function EmailVerificationBanner() {
  const { user, isEmailVerified, resendVerificationEmail } = useAuth();
  const [dismissed, setDismissed] = useState(false);
  const [resending, setResending] = useState(false);
  const [feedback, setFeedback] = useState('');
  const [cooldown, setCooldown] = useState(0);

  // Only show if user is signed in and unverified, and banner not dismissed
  if (!user || isEmailVerified || dismissed) {
    return null;
  }

  const handleResend = async () => {
    if (cooldown > 0 || resending) return;
    setResending(true);
    setFeedback('');
    const res = await resendVerificationEmail();
    setResending(false);

    if (res.success) {
      setFeedback(res.message || 'Verification link sent!');
      setCooldown(60);
      const timer = setInterval(() => {
        setCooldown((c) => {
          if (c <= 1) {
            clearInterval(timer);
            return 0;
          }
          return c - 1;
        });
      }, 1000);
    } else {
      setFeedback(res.error || 'Failed to resend email.');
    }
  };

  return (
    <div
      style={{
        backgroundColor: '#fef3c7',
        borderBottom: '1px solid #fde68a',
        color: '#92400e',
        fontSize: '12.5px',
        padding: '6px 16px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        position: 'relative',
        zIndex: 50,
        fontWeight: 500,
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
        <Mail size={15} style={{ flexShrink: 0, color: '#d97706' }} />
        <span>
          Please verify your email address (<strong>{user.email}</strong>) to unlock all community features.
        </span>
        {feedback ? (
          <span style={{ color: '#15803d', fontWeight: 600, display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
            <CheckCircle2 size={13} /> {feedback}
          </span>
        ) : (
          <button
            onClick={handleResend}
            disabled={resending || cooldown > 0}
            style={{
              background: 'none',
              border: 'none',
              color: '#b45309',
              textDecoration: 'underline',
              fontWeight: 700,
              cursor: resending || cooldown > 0 ? 'not-allowed' : 'pointer',
              padding: 0,
              fontSize: 'inherit',
              display: 'inline-flex',
              alignItems: 'center',
              gap: '4px',
            }}
          >
            {resending && <RefreshCw size={12} className="animate-spin" />}
            {resending ? 'Sending...' : cooldown > 0 ? `Resend in ${cooldown}s` : 'Resend verification email'}
          </button>
        )}
        <Link
          to={`/verify-email?email=${encodeURIComponent(user.email || '')}`}
          style={{
            color: '#b45309',
            fontWeight: 700,
            textDecoration: 'underline',
            fontSize: 'inherit',
            marginLeft: '4px',
          }}
        >
          Enter code &rarr;
        </Link>
      </div>

      <button
        onClick={() => setDismissed(true)}
        title="Dismiss notice"
        style={{
          background: 'none',
          border: 'none',
          color: '#92400e',
          cursor: 'pointer',
          padding: '2px',
          display: 'inline-flex',
          alignItems: 'center',
          opacity: 0.7,
        }}
      >
        <X size={14} />
      </button>
    </div>
  );
}
