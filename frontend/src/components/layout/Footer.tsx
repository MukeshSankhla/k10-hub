import { Link } from 'react-router-dom';
import { Github, ExternalLink } from 'lucide-react';

const PLATFORM_LINKS = [
  { label: 'Learn', href: '/learn' },
  { label: 'Projects', href: '/projects' },
  { label: 'Community', href: '/community' },
  { label: 'About', href: '/about' },
];

const RESOURCE_LINKS = [
  { label: 'UNIHIKER K10', href: 'https://www.dfrobot.com/product-2671.html', external: true },
  { label: 'Arduino Docs', href: 'https://www.arduino.cc/reference/en/', external: true },
  { label: 'MicroPython', href: 'https://micropython.org/', external: true },
  { label: 'DFRobot', href: 'https://www.dfrobot.com/', external: true },
];

const DEVELOPER_LINKS = [
  { label: 'GitHub', href: 'https://github.com/mukeshsankhla', external: true },
  { label: 'EasyFlash', href: 'https://mukeshsankhla.github.io/EasyFlash/', external: true },
  { label: 'API Reference', href: '/api/health', external: true },
];

export default function Footer() {
  const year = new Date().getFullYear();

  return (
    <footer className="footer" role="contentinfo">
      <div className="container">
        <div className="footer__inner">
          {/* Brand */}
          <div className="footer__brand">
            <Link to="/" className="footer__brand-name" style={{ textDecoration: 'none' }}>
              K10 Hub
            </Link>
            <p className="footer__brand-tagline">
              Learn, build and explore with the UNIHIKER K10 — from LED Blink to AI Vision.
            </p>
            <a
              href="https://github.com/mukeshsankhla"
              target="_blank"
              rel="noopener noreferrer"
              className="btn btn--secondary btn--sm"
              style={{ alignSelf: 'flex-start', marginTop: 'var(--space-2)' }}
            >
              <Github size={14} aria-hidden="true" />
              GitHub
            </a>
          </div>

          {/* Platform Links */}
          <div>
            <p className="footer__col-title">Platform</p>
            <ul className="footer__links">
              {PLATFORM_LINKS.map((link) => (
                <li key={link.href}>
                  <Link to={link.href} className="footer__link">{link.label}</Link>
                </li>
              ))}
            </ul>
          </div>

          {/* Resources */}
          <div>
            <p className="footer__col-title">Resources</p>
            <ul className="footer__links">
              {RESOURCE_LINKS.map((link) => (
                <li key={link.href}>
                  <a
                    href={link.href}
                    className="footer__link"
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    {link.label}
                    <ExternalLink size={10} aria-hidden="true" style={{ display: 'inline', marginLeft: '4px', verticalAlign: 'middle', opacity: 0.5 }} />
                  </a>
                </li>
              ))}
            </ul>
          </div>

          {/* Developer */}
          <div>
            <p className="footer__col-title">Developer</p>
            <ul className="footer__links">
              {DEVELOPER_LINKS.map((link) => (
                <li key={link.href}>
                  <a
                    href={link.href}
                    className="footer__link"
                    target={link.external ? '_blank' : undefined}
                    rel={link.external ? 'noopener noreferrer' : undefined}
                  >
                    {link.label}
                    {link.external && <ExternalLink size={10} aria-hidden="true" style={{ display: 'inline', marginLeft: '4px', verticalAlign: 'middle', opacity: 0.5 }} />}
                  </a>
                </li>
              ))}
            </ul>
          </div>
        </div>

        {/* Bottom bar */}
        <div className="footer__bottom">
          <p className="footer__copyright">
            &copy; {year} K10 Hub. Built by Mukesh Sankhla.
          </p>
          <div className="footer__legal">
            <span className="footer__link" style={{ fontSize: 'var(--text-xs)', color: 'var(--color-ink-tertiary)' }}>
              UNIHIKER K10 is a product of DFRobot
            </span>
          </div>
        </div>
      </div>
    </footer>
  );
}
