import { Link } from 'react-router-dom';
import { ArrowUpRight } from 'lucide-react';

const PLATFORM_LINKS = [
  { label: 'Projects Gallery', href: '/projects' },
  { label: 'Hands-on Tutorials', href: '/tutorials' },
  { label: 'About K10 Hub', href: '/about' },
  { label: 'Frequently Asked Questions', href: '/faq' },
];

const RESOURCE_LINKS = [
  {
    label: 'UNIHIKER Official',
    href: 'https://www.unihiker.com/',
    title: 'Learning Devices for Exploring: AI, IoT, and Python Coding',
    external: true,
  },
  {
    label: 'Arduino IDE Documentation',
    href: 'https://www.unihiker.com/wiki/K10/GettingStarted/gettingstarted_arduinoide/',
    title: 'Arduino IDE - UNIHIKER Documentation',
    external: true,
  },
  {
    label: 'MicroPython Documentation',
    href: 'https://www.unihiker.com/wiki/K10/GettingStarted/gettingstarted_mpy/',
    title: 'MicroPython - UNIHIKER Documentation',
    external: true,
  },
  {
    label: 'DFRobot Store & Kits',
    href: 'https://www.dfrobot.com/',
    title: 'DFRobot Open-Source Hardware Electronics and Kits',
    external: true,
  },
];

const COMMUNITY_LINKS = [
  {
    label: 'DFRobot Maker Community',
    href: 'https://community.dfrobot.com/',
    title: 'DFRobot Maker Community - A community dedicated to learning open source hardware and sharing maker stories.',
    external: true,
  },
  { label: 'Legal & Policies', href: '/legal', external: false },
  { label: 'Hardware Flashing Safety', href: '/legal', external: false },
  { label: 'Help & Knowledge Base', href: '/faq', external: false },
];

export default function Footer() {
  const year = new Date().getFullYear();

  return (
    <footer className="footer" role="contentinfo">
      <div className="container">
        <div className="footer__inner">
          {/* Brand & Identity Column */}
          <div className="footer__brand">
            <Link to="/" className="footer__brand-header" aria-label="K10 Hub home">
              <div
                className="nav__logo-mark"
                aria-hidden="true"
                style={{
                  width: 32,
                  height: 32,
                  background: 'transparent',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  flexShrink: 0,
                }}
              >
                <svg width="30" height="30" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
                  <rect x="1" y="1" width="6" height="6" rx="1.5" fill="var(--color-ink-primary)" />
                  <rect x="9" y="1" width="6" height="6" rx="1.5" fill="var(--color-ink-primary)" opacity="0.55" />
                  <rect x="1" y="9" width="6" height="6" rx="1.5" fill="var(--color-ink-primary)" opacity="0.55" />
                  <rect x="9" y="9" width="6" height="6" rx="1.5" fill="var(--color-ink-primary)" />
                </svg>
              </div>
              <div>
                <div className="footer__brand-title">K10 Hub</div>
                <div className="footer__brand-subtitle">UNIHIKER K10 Platform</div>
              </div>
            </Link>

            <p className="footer__brand-tagline">
              The open project and firmware platform for the UNIHIKER K10. Discover beginner-friendly builds, author tutorials, and flash firmware directly from your browser.
            </p>
          </div>

          {/* Column 2: Platform */}
          <div className="footer__col">
            <div className="footer__col-title">Platform</div>
            <ul className="footer__links">
              {PLATFORM_LINKS.map((link) => (
                <li key={link.href}>
                  <Link to={link.href} className="footer__link">
                    {link.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          {/* Column 3: Documentation */}
          <div className="footer__col">
            <div className="footer__col-title">Documentation</div>
            <ul className="footer__links">
              {RESOURCE_LINKS.map((link) => (
                <li key={link.href}>
                  <a
                    href={link.href}
                    className="footer__link"
                    title={link.title}
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    <span>{link.label}</span>
                    <ArrowUpRight size={12} className="footer__link-icon" aria-hidden="true" />
                  </a>
                </li>
              ))}
            </ul>
          </div>

          {/* Column 4: Community & Legal */}
          <div className="footer__col">
            <div className="footer__col-title">Community &amp; Legal</div>
            <ul className="footer__links">
              {COMMUNITY_LINKS.map((link) => (
                <li key={link.label}>
                  {link.external ? (
                    <a
                      href={link.href}
                      className="footer__link"
                      title={link.title}
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      <span>{link.label}</span>
                      <ArrowUpRight size={12} className="footer__link-icon" aria-hidden="true" />
                    </a>
                  ) : (
                    <Link to={link.href} className="footer__link">
                      {link.label}
                    </Link>
                  )}
                </li>
              ))}
            </ul>
          </div>
        </div>

        {/* Bottom Bar */}
        <div className="footer__bottom">
          <p className="footer__copyright">
            <span>
              &copy; {year} K10 Hub. Built by{' '}
              <a
                href="https://www.linkedin.com/in/mukeshsankhla/"
                target="_blank"
                rel="noopener noreferrer"
                style={{
                  color: 'inherit',
                  textDecoration: 'underline',
                  textUnderlineOffset: '2px',
                  fontWeight: 500,
                  transition: 'color 0.15s ease',
                }}
                onMouseEnter={(e) => (e.currentTarget.style.color = 'var(--color-ink-primary)')}
                onMouseLeave={(e) => (e.currentTarget.style.color = 'inherit')}
              >
                Mukesh Sankhla
              </a>
              .
            </span>
          </p>

          <div className="footer__legal">
            <span style={{ fontSize: 'var(--text-xs)', color: 'var(--color-ink-tertiary)' }}>
              UNIHIKER K10 is a product of{' '}
              <a
                href="https://www.dfrobot.com/"
                target="_blank"
                rel="noopener noreferrer"
                style={{
                  color: 'inherit',
                  textDecoration: 'underline',
                  textUnderlineOffset: '2px',
                  fontWeight: 500,
                  transition: 'color 0.15s ease',
                }}
                onMouseEnter={(e) => (e.currentTarget.style.color = 'var(--color-ink-primary)')}
                onMouseLeave={(e) => (e.currentTarget.style.color = 'inherit')}
              >
                DFRobot
              </a>
            </span>
          </div>
        </div>
      </div>
    </footer>
  );
}
