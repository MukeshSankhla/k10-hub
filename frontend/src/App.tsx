import React, { Suspense, useEffect } from 'react';
import { BrowserRouter, Routes, Route, useLocation } from 'react-router-dom';
import { AuthProvider } from './contexts/AuthContext';
import { ToastProvider } from './contexts/ToastContext';
import ProtectedRoute from './components/auth/ProtectedRoute';

// Automatically scrolls window to top hero on navigation transitions
function ScrollToTop() {
  const { pathname } = useLocation();

  useEffect(() => {
    if (!window.location.hash) {
      window.scrollTo({ top: 0, left: 0, behavior: 'instant' });
    }
  }, [pathname]);

  return null;
}

// Route-based code splitting for production bundle optimization
const HomePage = React.lazy(() => import('./pages/HomePage'));
const LoginPage = React.lazy(() => import('./pages/auth/LoginPage'));
const SignupPage = React.lazy(() => import('./pages/auth/SignupPage'));
const ForgotPasswordPage = React.lazy(() => import('./pages/auth/ForgotPasswordPage'));
const ResetPasswordPage = React.lazy(() => import('./pages/auth/ResetPasswordPage'));
const VerifyEmailPage = React.lazy(() => import('./pages/auth/VerifyEmailPage'));
const ProfilePage = React.lazy(() => import('./pages/auth/ProfilePage'));
const AdminDashboardPage = React.lazy(() => import('./pages/admin/AdminDashboardPage'));
const ProjectsGalleryPage = React.lazy(() => import('./pages/projects/ProjectsGalleryPage'));
const ProjectDetailPage = React.lazy(() => import('./pages/projects/ProjectDetailPage'));
const ProjectEditorPage = React.lazy(() => import('./pages/projects/ProjectEditorPage'));
const AboutPage = React.lazy(() => import('./pages/AboutPage'));
const LegalPage = React.lazy(() => import('./pages/LegalPage'));
const FaqPage = React.lazy(() => import('./pages/FaqPage'));

export default function App() {
  return (
    <AuthProvider>
      <ToastProvider>
        <BrowserRouter>
          <ScrollToTop />
          <Suspense fallback={<PageLoadingFallback />}>
            <Routes>
              <Route path="/" element={<HomePage />} />

              {/* Auth & Verification Routes */}
              <Route path="/login" element={<LoginPage />} />
              <Route path="/signup" element={<SignupPage />} />
              <Route path="/forgot-password" element={<ForgotPasswordPage />} />
              <Route path="/reset-password" element={<ResetPasswordPage />} />
              <Route path="/verify-email" element={<VerifyEmailPage />} />
              <Route path="/auth/callback" element={<VerifyEmailPage />} />
              <Route path="/confirm-email" element={<VerifyEmailPage />} />

              {/* User Account / Profile & Public Creator Profiles */}
              <Route path="/profile" element={<ProfilePage />} />
              <Route path="/profile/:identifier" element={<ProfilePage />} />
              <Route path="/user/:identifier" element={<ProfilePage />} />

              {/* Admin User Management & Author Verification */}
              <Route
                path="/admin"
                element={
                  <ProtectedRoute allowedRoles={['admin']}>
                    <AdminDashboardPage />
                  </ProtectedRoute>
                }
              />

              {/* Hardware Projects, Tutorials & Web Flashing */}
              <Route path="/projects" element={<ProjectsGalleryPage />} />
              <Route path="/tutorials" element={<ProjectsGalleryPage />} />
              <Route path="/project/new" element={<ProjectEditorPage />} />
              <Route path="/projects/new" element={<ProjectEditorPage />} />
              <Route path="/project/:id/edit" element={<ProjectEditorPage />} />
              <Route path="/projects/:id/edit" element={<ProjectEditorPage />} />
              <Route path="/projects/edit/:id" element={<ProjectEditorPage />} />
              <Route path="/project/edit/:id" element={<ProjectEditorPage />} />
              <Route path="/projects/:id" element={<ProjectDetailPage />} />
              <Route path="/project/:id" element={<ProjectDetailPage />} />
              <Route path="/tutorial/:id" element={<ProjectDetailPage />} />
              <Route path="/tutorials/:id" element={<ProjectDetailPage />} />

              {/* Informational & Legal Routes */}
              <Route path="/about" element={<AboutPage />} />
              <Route path="/faq" element={<FaqPage />} />
              <Route path="/legal" element={<LegalPage />} />
              <Route path="/policies" element={<LegalPage />} />
              <Route path="/terms" element={<LegalPage />} />
              <Route path="/privacy" element={<LegalPage />} />
              <Route path="/learn" element={<ComingSoon title="Learn" />} />
              <Route path="/community" element={<ComingSoon title="Community" />} />
              <Route path="*" element={<ComingSoon title="Page Not Found" />} />
            </Routes>
          </Suspense>
        </BrowserRouter>
      </ToastProvider>
    </AuthProvider>
  );
}

function PageLoadingFallback() {
  return (
    <div
      style={{
        minHeight: '100vh',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: 'var(--color-paper)',
        gap: '1rem',
      }}
    >
      <div
        style={{
          width: 44,
          height: 44,
          borderRadius: '12px',
          backgroundColor: 'var(--color-accent)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          boxShadow: '0 4px 16px rgba(249, 115, 22, 0.25)',
          animation: 'pulse 1.6s ease-in-out infinite',
        }}
      >
        <svg width="22" height="22" viewBox="0 0 18 18" fill="none" xmlns="http://www.w3.org/2000/svg">
          <rect x="2" y="2" width="6" height="6" rx="1" fill="#F8F6F1"/>
          <rect x="10" y="2" width="6" height="6" rx="1" fill="#F8F6F1" opacity="0.5"/>
          <rect x="2" y="10" width="6" height="6" rx="1" fill="#F8F6F1" opacity="0.5"/>
          <rect x="10" y="10" width="6" height="6" rx="1" fill="#F8F6F1"/>
        </svg>
      </div>
      <span
        style={{
          fontSize: 'var(--text-xs)',
          letterSpacing: '0.08em',
          textTransform: 'uppercase',
          fontWeight: 600,
          color: 'var(--color-ink-tertiary)',
        }}
      >
        Loading K10 Hub...
      </span>
    </div>
  );
}

function ComingSoon({ title }: { title: string }) {
  return (
    <div style={{
      minHeight: '100vh',
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      gap: '1rem',
      fontFamily: 'var(--font-sans)',
      backgroundColor: 'var(--color-paper)',
    }}>
      <p style={{ fontSize: 'var(--text-xs)', letterSpacing: '0.1em', textTransform: 'uppercase', color: 'var(--color-ink-tertiary)', fontWeight: 600 }}>
        K10 Hub
      </p>
      <h1 style={{ fontSize: 'var(--text-3xl)', fontWeight: 700, color: 'var(--color-ink-primary)', letterSpacing: '-0.02em' }}>
        {title}
      </h1>
      <p style={{ color: 'var(--color-ink-secondary)', fontSize: 'var(--text-base)' }}>
        This section is coming in a future phase.
      </p>
      <a href="/" style={{
        marginTop: '1rem',
        fontSize: 'var(--text-sm)',
        color: 'var(--color-accent)',
        textDecoration: 'none',
        borderBottom: '1px solid currentColor',
        paddingBottom: '1px',
      }}>
        Back to homepage
      </a>
    </div>
  );
}
