import React from 'react';
import { Navigate, useLocation, Link } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { ShieldAlert, ArrowLeft } from 'lucide-react';
import { UserRole } from '../../services/api';

interface ProtectedRouteProps {
  children: React.ReactNode;
  allowedRoles?: UserRole[];
}

export default function ProtectedRoute({ children, allowedRoles }: ProtectedRouteProps) {
  const { user, role, loading } = useAuth();
  const location = useLocation();

  if (loading) {
    return (
      <div style={{
        minHeight: '80vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        fontFamily: 'var(--font-sans)',
        color: 'var(--color-ink-secondary)'
      }}>
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '1rem' }}>
          <div className="spinner" style={{ width: 32, height: 32, border: '3px solid var(--color-border)', borderTopColor: 'var(--color-accent)', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }}></div>
          <p style={{ fontSize: 'var(--text-sm)' }}>Authenticating...</p>
        </div>
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  // If role-restricted and user does not have permission
  if (allowedRoles && allowedRoles.length > 0) {
    // Admin has access to all roles
    const hasAccess = role === 'admin' || allowedRoles.includes(role);

    if (!hasAccess) {
      return (
        <div style={{
          minHeight: '80vh',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          textAlign: 'center',
          padding: 'var(--space-8)',
          backgroundColor: 'var(--color-paper)',
          fontFamily: 'var(--font-sans)'
        }}>
          <div style={{
            width: 64,
            height: 64,
            borderRadius: '50%',
            backgroundColor: 'rgba(239, 68, 68, 0.1)',
            color: 'rgb(239, 68, 68)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            marginBottom: 'var(--space-4)'
          }}>
            <ShieldAlert size={32} />
          </div>
          <h1 style={{ fontSize: 'var(--text-2xl)', fontWeight: 700, color: 'var(--color-ink-primary)', marginBottom: 'var(--space-2)' }}>
            Access Restricted
          </h1>
          <p style={{ color: 'var(--color-ink-secondary)', maxWidth: 440, marginBottom: 'var(--space-6)', lineHeight: 1.6 }}>
            This page requires <strong>{allowedRoles.join(' or ')}</strong> privileges. Your current role is <span style={{ textTransform: 'capitalize', fontWeight: 600, color: 'var(--color-accent)' }}>{role}</span>.
          </p>
          <div style={{ display: 'flex', gap: 'var(--space-3)' }}>
            <Link to="/" className="btn btn--secondary" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <ArrowLeft size={16} /> Return Home
            </Link>
            {role === 'user' && allowedRoles.includes('author') && (
              <Link to="/profile" className="btn btn--primary">
                Apply for Author Status
              </Link>
            )}
          </div>
        </div>
      );
    }
  }

  return <>{children}</>;
}
