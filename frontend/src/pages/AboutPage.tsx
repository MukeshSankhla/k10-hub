import { Link } from 'react-router-dom';
import Header from '../components/layout/Header';
import Footer from '../components/layout/Footer';
import {
  Cpu,
  Zap,
  Users,
  ArrowRight,
  Layers,
} from 'lucide-react';

export default function AboutPage() {
  return (
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column', backgroundColor: 'var(--color-paper)' }}>
      <Header />

      <main style={{ flex: 1, paddingTop: 'calc(var(--nav-height) + var(--space-8))', paddingBottom: 'var(--space-16)' }}>
        <div className="container" style={{ maxWidth: 960 }}>
          
          {/* Eyebrow & Hero Header */}
          <div style={{ marginBottom: 'var(--space-12)' }}>
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
                About K10 Hub
              </span>
            </div>

            <h1 style={{
              fontSize: 'clamp(2.2rem, 4.5vw, 3.4rem)',
              fontWeight: 800,
              color: 'var(--color-ink-primary)',
              letterSpacing: '-0.03em',
              lineHeight: 1.15,
              marginBottom: 'var(--space-4)',
            }}>
              Democratizing Edge AI &amp; Physical Computing for the <span style={{ color: 'var(--color-accent)' }}>UNIHIKER K10</span>.
            </h1>

            <p style={{
              fontSize: 'clamp(1.05rem, 1.3vw, 1.25rem)',
              color: 'var(--color-ink-secondary)',
              lineHeight: 1.6,
              maxWidth: '68ch',
            }}>
              K10 Hub is the premier community learning and firmware distribution platform for the UNIHIKER K10 microcomputer.
              From first LED blinks to on-device computer vision and IoT telemetry, we eliminate development friction so you can focus on building.
            </p>
          </div>

          {/* Core Mission Cards */}
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
            gap: 'var(--space-6)',
            marginBottom: 'var(--space-14)',
          }}>
            <div style={{
              backgroundColor: 'var(--color-surface)',
              border: '1px solid var(--color-border)',
              borderRadius: 'var(--radius-xl)',
              padding: 'var(--space-6)',
              boxShadow: 'var(--shadow-sm)',
            }}>
              <div style={{
                width: 42,
                height: 42,
                borderRadius: '10px',
                backgroundColor: 'rgba(234, 88, 12, 0.1)',
                color: 'var(--color-accent)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                marginBottom: 'var(--space-4)',
              }}>
                <Zap size={22} />
              </div>
              <h2 style={{ fontSize: 'var(--text-lg)', fontWeight: 700, color: 'var(--color-ink-primary)', marginBottom: 'var(--space-2)' }}>
                Zero-Install Web Flashing
              </h2>
              <p style={{ color: 'var(--color-ink-secondary)', fontSize: 'var(--text-sm)', lineHeight: 1.6, margin: 0 }}>
                Forget complicated IDE setups, Python virtualenvs, and serial driver headaches. Flash tested binary firmware straight to your K10 board via the Web Serial API directly inside your web browser.
              </p>
            </div>

            <div style={{
              backgroundColor: 'var(--color-surface)',
              border: '1px solid var(--color-border)',
              borderRadius: 'var(--radius-xl)',
              padding: 'var(--space-6)',
              boxShadow: 'var(--shadow-sm)',
            }}>
              <div style={{
                width: 42,
                height: 42,
                borderRadius: '10px',
                backgroundColor: 'rgba(37, 99, 235, 0.1)',
                color: '#2563eb',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                marginBottom: 'var(--space-4)',
              }}>
                <Cpu size={22} />
              </div>
              <h2 style={{ fontSize: 'var(--text-lg)', fontWeight: 700, color: 'var(--color-ink-primary)', marginBottom: 'var(--space-2)' }}>
                Real-World Edge AI
              </h2>
              <p style={{ color: 'var(--color-ink-secondary)', fontSize: 'var(--text-sm)', lineHeight: 1.6, margin: 0 }}>
                Harness the onboard GC2145 camera module and the ESP32-S3 dual-core vector AI accelerator. Build face recognition, posture tracking, edge classifiers, and ambient sensing apps with zero guesswork.
              </p>
            </div>

            <div style={{
              backgroundColor: 'var(--color-surface)',
              border: '1px solid var(--color-border)',
              borderRadius: 'var(--radius-xl)',
              padding: 'var(--space-6)',
              boxShadow: 'var(--shadow-sm)',
            }}>
              <div style={{
                width: 42,
                height: 42,
                borderRadius: '10px',
                backgroundColor: 'rgba(22, 163, 74, 0.1)',
                color: '#16a34a',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                marginBottom: 'var(--space-4)',
              }}>
                <Users size={22} />
              </div>
              <h2 style={{ fontSize: 'var(--text-lg)', fontWeight: 700, color: 'var(--color-ink-primary)', marginBottom: 'var(--space-2)' }}>
                Maker-First Ecosystem
              </h2>
              <p style={{ color: 'var(--color-ink-secondary)', fontSize: 'var(--text-sm)', lineHeight: 1.6, margin: 0 }}>
                Every tutorial, circuit diagram, and snippet is authored and validated by real makers. Share your builds, bookmark guides, and connect with other hardware creators worldwide.
              </p>
            </div>
          </div>

          {/* Hardware Feature Callout */}
          <div style={{
            backgroundColor: 'var(--color-surface)',
            border: '1px solid var(--color-border)',
            borderRadius: 'var(--radius-2xl)',
            padding: 'clamp(var(--space-6), 4vw, var(--space-10))',
            boxShadow: 'var(--shadow-md)',
            marginBottom: 'var(--space-14)',
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: 'var(--space-2)' }}>
              <Layers size={18} color="var(--color-accent)" />
              <span style={{ fontSize: 'var(--text-xs)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--color-accent)' }}>
                Hardware Specifications
              </span>
            </div>

            <h2 style={{ fontSize: 'var(--text-2xl)', fontWeight: 800, color: 'var(--color-ink-primary)', marginBottom: 'var(--space-4)' }}>
              Engineered for the UNIHIKER K10 Ecosystem
            </h2>

            <p style={{ color: 'var(--color-ink-secondary)', fontSize: 'var(--text-base)', lineHeight: 1.6, marginBottom: 'var(--space-8)' }}>
              The UNIHIKER K10 microcomputer brings workstation-grade versatility into an educational handheld form-factor. K10 Hub provides tailored projects designed specifically around every onboard peripheral:
            </p>

            <div style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
              gap: 'var(--space-4)',
            }}>
              <div style={{ padding: 'var(--space-4)', backgroundColor: 'var(--color-paper)', borderRadius: 'var(--radius-lg)', border: '1px solid var(--color-border)' }}>
                <div style={{ fontWeight: 700, color: 'var(--color-ink-primary)', fontSize: 'var(--text-sm)' }}>ESP32-S3 Core</div>
                <div style={{ fontSize: 'var(--text-xs)', color: 'var(--color-ink-secondary)', marginTop: '4px' }}>Dual-core Xtensa LX7 @ 240MHz · 16MB Flash · 8MB PSRAM</div>
              </div>

              <div style={{ padding: 'var(--space-4)', backgroundColor: 'var(--color-paper)', borderRadius: 'var(--radius-lg)', border: '1px solid var(--color-border)' }}>
                <div style={{ fontWeight: 700, color: 'var(--color-ink-primary)', fontSize: 'var(--text-sm)' }}>2.8" Color LCD</div>
                <div style={{ fontSize: 'var(--text-xs)', color: 'var(--color-ink-secondary)', marginTop: '4px' }}>240×320 resolution · SPI high-speed graphics · Backlight control</div>
              </div>

              <div style={{ padding: 'var(--space-4)', backgroundColor: 'var(--color-paper)', borderRadius: 'var(--radius-lg)', border: '1px solid var(--color-border)' }}>
                <div style={{ fontWeight: 700, color: 'var(--color-ink-primary)', fontSize: 'var(--text-sm)' }}>Vision &amp; Audio</div>
                <div style={{ fontSize: 'var(--text-xs)', color: 'var(--color-ink-secondary)', marginTop: '4px' }}>2MP GC2145 camera · 2× MEMS mics · I²S Class-D speaker</div>
              </div>

              <div style={{ padding: 'var(--space-4)', backgroundColor: 'var(--color-paper)', borderRadius: 'var(--radius-lg)', border: '1px solid var(--color-border)' }}>
                <div style={{ fontWeight: 700, color: 'var(--color-ink-primary)', fontSize: 'var(--text-sm)' }}>Expansion &amp; I/O</div>
                <div style={{ fontSize: 'var(--text-xs)', color: 'var(--color-ink-secondary)', marginTop: '4px' }}>Micro:bit edge bus · Gravity I²C &amp; IO1/IO2 · MicroSD slot</div>
              </div>
            </div>
          </div>

          {/* Call to action */}
          <div style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            flexWrap: 'wrap',
            gap: 'var(--space-6)',
            padding: 'var(--space-8)',
            borderRadius: 'var(--radius-xl)',
            backgroundColor: 'var(--color-paper-warm)',
            border: '1px solid var(--color-border)',
          }}>
            <div>
              <h2 style={{ fontSize: 'var(--text-xl)', fontWeight: 800, color: 'var(--color-ink-primary)', margin: 0 }}>
                Ready to start building?
              </h2>
              <p style={{ color: 'var(--color-ink-secondary)', fontSize: 'var(--text-sm)', margin: 'var(--space-1) 0 0' }}>
                Browse our gallery of hands-on builds or connect your K10 board right now.
              </p>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-3)' }}>
              <Link to="/projects" className="btn btn--primary">
                Explore Projects
                <ArrowRight size={15} />
              </Link>
              <Link to="/tutorials" className="btn btn--secondary">
                Start Learning
              </Link>
            </div>
          </div>

        </div>
      </main>

      <Footer />
    </div>
  );
}
