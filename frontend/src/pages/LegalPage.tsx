import { useState } from 'react';
import Header from '../components/layout/Header';
import Footer from '../components/layout/Footer';
import { Shield, FileText, Lock, AlertTriangle } from 'lucide-react';

export default function LegalPage() {
  const [activeTab, setActiveTab] = useState<'terms' | 'privacy' | 'hardware' | 'cookies'>('terms');

  return (
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column', backgroundColor: 'var(--color-paper)' }}>
      <Header />

      <main style={{ flex: 1, paddingTop: 'calc(var(--nav-height) + var(--space-8))', paddingBottom: 'var(--space-16)' }}>
        <div className="container" style={{ maxWidth: 920 }}>

          {/* Header */}
          <div style={{ marginBottom: 'var(--space-10)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: 'var(--space-3)' }}>
              <span style={{ width: 24, height: 2, backgroundColor: 'var(--color-accent)' }} />
              <span style={{
                fontFamily: 'var(--font-mono)',
                fontSize: '0.75rem',
                fontWeight: 700,
                letterSpacing: '0.08em',
                color: 'var(--color-accent)',
                textTransform: 'uppercase',
              }}>
                Policies &amp; Governance
              </span>
            </div>

            <h1 style={{
              fontSize: 'clamp(2rem, 4vw, 3rem)',
              fontWeight: 800,
              color: 'var(--color-ink-primary)',
              letterSpacing: '-0.03em',
              lineHeight: 1.15,
              marginBottom: 'var(--space-3)',
            }}>
              Legal &amp; Policies
            </h1>

            <p style={{
              fontSize: 'var(--text-base)',
              color: 'var(--color-ink-secondary)',
              maxWidth: '65ch',
              lineHeight: 1.6,
            }}>
              Transparency, safety, and open hardware integrity. Read our terms of service, privacy policy, and hardware flashing guidelines.
            </p>
          </div>

          {/* Tabs Navigation */}
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: 'var(--space-2)',
            borderBottom: '1px solid var(--color-border)',
            marginBottom: 'var(--space-8)',
            overflowX: 'auto',
            paddingBottom: '2px',
          }}>
            <button
              type="button"
              onClick={() => setActiveTab('terms')}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '8px',
                padding: '0.65rem 1.1rem',
                border: 'none',
                borderBottom: activeTab === 'terms' ? '2px solid var(--color-accent)' : '2px solid transparent',
                backgroundColor: 'transparent',
                color: activeTab === 'terms' ? 'var(--color-ink-primary)' : 'var(--color-ink-tertiary)',
                fontWeight: activeTab === 'terms' ? 700 : 500,
                fontSize: 'var(--text-sm)',
                cursor: 'pointer',
                transition: 'all 0.15s ease',
              }}
            >
              <FileText size={16} />
              Terms of Service
            </button>

            <button
              type="button"
              onClick={() => setActiveTab('privacy')}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '8px',
                padding: '0.65rem 1.1rem',
                border: 'none',
                borderBottom: activeTab === 'privacy' ? '2px solid var(--color-accent)' : '2px solid transparent',
                backgroundColor: 'transparent',
                color: activeTab === 'privacy' ? 'var(--color-ink-primary)' : 'var(--color-ink-tertiary)',
                fontWeight: activeTab === 'privacy' ? 700 : 500,
                fontSize: 'var(--text-sm)',
                cursor: 'pointer',
                transition: 'all 0.15s ease',
              }}
            >
              <Lock size={16} />
              Privacy Policy
            </button>

            <button
              type="button"
              onClick={() => setActiveTab('hardware')}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '8px',
                padding: '0.65rem 1.1rem',
                border: 'none',
                borderBottom: activeTab === 'hardware' ? '2px solid var(--color-accent)' : '2px solid transparent',
                backgroundColor: 'transparent',
                color: activeTab === 'hardware' ? 'var(--color-ink-primary)' : 'var(--color-ink-tertiary)',
                fontWeight: activeTab === 'hardware' ? 700 : 500,
                fontSize: 'var(--text-sm)',
                cursor: 'pointer',
                transition: 'all 0.15s ease',
              }}
            >
              <AlertTriangle size={16} />
              Hardware &amp; Flashing Disclaimer
            </button>

            <button
              type="button"
              onClick={() => setActiveTab('cookies')}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '8px',
                padding: '0.65rem 1.1rem',
                border: 'none',
                borderBottom: activeTab === 'cookies' ? '2px solid var(--color-accent)' : '2px solid transparent',
                backgroundColor: 'transparent',
                color: activeTab === 'cookies' ? 'var(--color-ink-primary)' : 'var(--color-ink-tertiary)',
                fontWeight: activeTab === 'cookies' ? 700 : 500,
                fontSize: 'var(--text-sm)',
                cursor: 'pointer',
                transition: 'all 0.15s ease',
              }}
            >
              <Shield size={16} />
              Trademark Notice
            </button>
          </div>

          {/* Tab Content */}
          <div style={{
            backgroundColor: 'var(--color-surface)',
            border: '1px solid var(--color-border)',
            borderRadius: 'var(--radius-xl)',
            padding: 'clamp(var(--space-6), 4vw, var(--space-10))',
            boxShadow: 'var(--shadow-sm)',
            lineHeight: 1.7,
            color: 'var(--color-ink-secondary)',
          }}>
            {activeTab === 'terms' && (
              <div>
                <h2 style={{ fontSize: 'var(--text-xl)', fontWeight: 800, color: 'var(--color-ink-primary)', marginBottom: 'var(--space-4)' }}>
                  Terms of Service
                </h2>
                <p>
                  Welcome to K10 Hub. By accessing or using our website, firmware flashing services, and project community, you agree to be bound by these Terms of Service.
                </p>
                <h3 style={{ fontSize: 'var(--text-md)', fontWeight: 700, color: 'var(--color-ink-primary)', marginTop: 'var(--space-6)', marginBottom: 'var(--space-2)' }}>
                  1. Community Submissions &amp; Open Source
                </h3>
                <p>
                  Makers and authors retain copyright over their original hardware designs, schematics, and code submissions. By publishing content to K10 Hub, you grant the platform a non-exclusive license to host, display, and distribute the project for community educational purposes.
                </p>
                <h3 style={{ fontSize: 'var(--text-md)', fontWeight: 700, color: 'var(--color-ink-primary)', marginTop: 'var(--space-6)', marginBottom: 'var(--space-2)' }}>
                  2. Acceptable Use
                </h3>
                <p>
                  You agree not to upload harmful code, malicious firmware binaries, or content that violates intellectual property rights. Respectful conduct in project discussions and reviews is required at all times.
                </p>
              </div>
            )}

            {activeTab === 'privacy' && (
              <div>
                <h2 style={{ fontSize: 'var(--text-xl)', fontWeight: 800, color: 'var(--color-ink-primary)', marginBottom: 'var(--space-4)' }}>
                  Privacy Policy
                </h2>
                <p>
                  K10 Hub is committed to privacy. We do not sell your personal information, nor do we deploy intrusive third-party cross-site trackers.
                </p>
                <h3 style={{ fontSize: 'var(--text-md)', fontWeight: 700, color: 'var(--color-ink-primary)', marginTop: 'var(--space-6)', marginBottom: 'var(--space-2)' }}>
                  1. Information We Collect
                </h3>
                <ul style={{ paddingLeft: 'var(--space-6)', margin: 'var(--space-3) 0' }}>
                  <li>Account Details: Email address, display name, and optional avatar URL when you sign up.</li>
                  <li>Maker Activity: Projects created, tutorials authored, likes, and bookmarked projects.</li>
                  <li>Security Identifiers: Unique immutable User IDs (`usr_xxxxxxxx`) used for author attribution.</li>
                </ul>
                <h3 style={{ fontSize: 'var(--text-md)', fontWeight: 700, color: 'var(--color-ink-primary)', marginTop: 'var(--space-6)', marginBottom: 'var(--space-2)' }}>
                  2. Account Deletion &amp; Data Rights
                </h3>
                <p>
                  Users have full authority over their account. You can update your profile details at any time or request complete account deletion via the platform administration.
                </p>
              </div>
            )}

            {activeTab === 'hardware' && (
              <div>
                <h2 style={{ fontSize: 'var(--text-xl)', fontWeight: 800, color: 'var(--color-ink-primary)', marginBottom: 'var(--space-4)' }}>
                  Hardware &amp; Web Flashing Disclaimer
                </h2>
                <div style={{
                  padding: 'var(--space-4)',
                  backgroundColor: 'rgba(245, 158, 11, 0.1)',
                  borderLeft: '4px solid #f59e0b',
                  borderRadius: 'var(--radius-md)',
                  marginBottom: 'var(--space-6)',
                  color: 'var(--color-ink-primary)',
                  fontSize: 'var(--text-sm)',
                }}>
                  <strong>Important Safety Notice:</strong> Ensure you use a certified USB Type-C data cable connected directly to your computer or powered USB hub when flashing firmware.
                </div>
                <h3 style={{ fontSize: 'var(--text-md)', fontWeight: 700, color: 'var(--color-ink-primary)', marginBottom: 'var(--space-2)' }}>
                  1. Browser Web Serial Flashing
                </h3>
                <p>
                  K10 Hub utilizes the standardized Web Serial API to communicate directly with your ESP32-S3 microcontroller. Flashing replaces existing flash ROM contents. Always save your personal scripts or code before writing new firmware images.
                </p>
                <h3 style={{ fontSize: 'var(--text-md)', fontWeight: 700, color: 'var(--color-ink-primary)', marginTop: 'var(--space-6)', marginBottom: 'var(--space-2)' }}>
                  2. Electrical &amp; Wiring Safety
                </h3>
                <p>
                  When connecting external components to the Micro:bit edge connector, Gravity I²C, or IO ports, verify pinout voltages (3.3V vs 5V) to avoid damaging hardware sensors or onboard ICs.
                </p>
              </div>
            )}

            {activeTab === 'cookies' && (
              <div>
                <h2 style={{ fontSize: 'var(--text-xl)', fontWeight: 800, color: 'var(--color-ink-primary)', marginBottom: 'var(--space-4)' }}>
                  Trademark &amp; Affiliation Notice
                </h2>
                <p>
                  <strong>UNIHIKER</strong> and <strong>DFRobot</strong> are registered trademarks of DFRobot (Shanghai DFRobot Co., Ltd.).
                </p>
                <p style={{ marginTop: 'var(--space-4)' }}>
                  K10 Hub is an independent community project created to foster open-source educational computing, tutorials, and browser-based tooling for UNIHIKER K10 microcomputers. All product names, logos, and brands are property of their respective owners.
                </p>
              </div>
            )}
          </div>

        </div>
      </main>

      <Footer />
    </div>
  );
}
