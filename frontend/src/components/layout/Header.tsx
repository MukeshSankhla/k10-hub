import { useState, useEffect, useRef } from 'react';
import { Link, NavLink, useNavigate } from 'react-router-dom';
import {
  Menu,
  X,
  User,
  Shield,
  LogOut,
  ChevronDown,
  Sparkles,
  Search,
  BookOpen,
  Cpu,
  ArrowRight,
  HelpCircle,
  Info,
  ShoppingCart,
  ExternalLink,
  LogIn,
} from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import UserBadge, { isKnownAdmin } from '../common/UserBadge';
import NotificationBell from '../notifications/NotificationBell';
import EmailVerificationBanner from '../auth/EmailVerificationBanner';
import { getPublicProjects, resolveProjectAuthor } from '../../services/projects/projectStorageService';

export const BUY_K10_AFFILIATE_URL =
  'https://www.dfrobot.com/product-2904.html?tracking=wilKriekbs7BI3GBJZ9IVhugyxsApTR05uQK9f1Br0N3xrQ5uLs2gnzzEIaGP7Qm';

const NAV_LINKS = [
  { label: 'Projects', href: '/projects' },
  { label: 'Tutorials', href: '/tutorials' },
];

export default function Header() {
  const [scrolled, setScrolled] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [userDropdownOpen, setUserDropdownOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Global Search State
  const [searchQuery, setSearchQuery] = useState('');
  const [searchOpen, setSearchOpen] = useState(false);
  const searchContainerRef = useRef<HTMLDivElement>(null);

  const { user, profile, role, signOut } = useAuth();
  const navigate = useNavigate();

  // Prevent background scroll when mobile menu is open
  useEffect(() => {
    if (mobileOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => {
      document.body.style.overflow = '';
    };
  }, [mobileOpen]);

  useEffect(() => {
    const handleScroll = () => setScrolled(window.scrollY > 12);
    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  // Close dropdowns on outside click
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setUserDropdownOpen(false);
      }
      if (searchContainerRef.current && !searchContainerRef.current.contains(event.target as Node)) {
        setSearchOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleSignOut = async () => {
    setUserDropdownOpen(false);
    await signOut();
    navigate('/');
  };

  const displayName = profile?.name || user?.user_metadata?.name || user?.email?.split('@')[0] || 'Maker';
  const avatarUrl = profile?.avatarUrl || user?.user_metadata?.avatar_url;

  // Search Results Computation
  const cleanSearch = searchQuery.trim().toLowerCase();
  const allProjects = cleanSearch ? getPublicProjects() : [];

  const matchedProjects = cleanSearch
    ? allProjects
        .filter((p) => p.type !== 'Tutorial')
        .filter((p) =>
          p.title.toLowerCase().includes(cleanSearch) ||
          p.description.toLowerCase().includes(cleanSearch) ||
          p.tags?.some((t) => t.toLowerCase().includes(cleanSearch))
        )
        .slice(0, 3)
    : [];

  const matchedTutorials = cleanSearch
    ? allProjects
        .filter((p) => p.type === 'Tutorial')
        .filter((p) =>
          p.title.toLowerCase().includes(cleanSearch) ||
          p.description.toLowerCase().includes(cleanSearch) ||
          p.tags?.some((t) => t.toLowerCase().includes(cleanSearch))
        )
        .slice(0, 3)
    : [];

  // Distinct Authors
  const authorMap = new Map<string, { name: string; avatar?: string; role?: string; id?: string }>();
  if (cleanSearch) {
    allProjects.forEach((p) => {
      const authorInfo = resolveProjectAuthor(p, user, profile);
      const key = (authorInfo.authorId || authorInfo.name).toLowerCase();
      if (authorInfo.name && !authorMap.has(key)) {
        authorMap.set(key, {
          name: authorInfo.name,
          avatar: authorInfo.avatarUrl,
          role: isKnownAdmin({ name: authorInfo.name, role: authorInfo.role }) ? 'admin' : authorInfo.role,
          id: authorInfo.authorId,
        });
      }
    });

    if (profile?.name) {
      const selfKey = String(profile.id || user?.id || profile.name).toLowerCase();
      if (!authorMap.has(selfKey)) {
        authorMap.set(selfKey, {
          name: profile.name,
          avatar: profile.avatarUrl || user?.user_metadata?.avatar_url,
          role: isKnownAdmin({ name: profile.name, role }) ? 'admin' : (role || 'user'),
          id: String(profile.id || user?.id || ''),
        });
      }
    }
  }

  const matchedAuthors = cleanSearch
    ? Array.from(authorMap.values())
        .filter((a) => a.name.toLowerCase().includes(cleanSearch))
        .slice(0, 3)
    : [];

  const totalResultsCount = matchedProjects.length + matchedTutorials.length + matchedAuthors.length;

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!cleanSearch) return;
    setSearchOpen(false);
    navigate(`/projects?q=${encodeURIComponent(cleanSearch)}`);
  };

  const isCurrentAuthor = (authorName: string, authorId?: string) => {
    const myName = (profile?.name || user?.user_metadata?.name || user?.email?.split('@')[0] || '').toLowerCase();
    const myId = String(profile?.id || user?.id || '').toLowerCase();
    if (authorId && myId && authorId.toLowerCase() === myId) return true;
    if (authorName && myName && authorName.toLowerCase() === myName) return true;
    return false;
  };

  return (
    <>
      <EmailVerificationBanner />
      <header className={`nav ${scrolled ? 'nav--scrolled' : ''}`} role="banner">
        <div className="container nav__inner">
          {/* Left: Brand Wordmark + Navigation Links aligned together */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 'clamp(12px, 3vw, 36px)' }}>
            <Link to="/" className="nav__wordmark" aria-label="K10 Hub home" style={{ display: 'flex', alignItems: 'center', gap: '12px', textDecoration: 'none' }}>
              <div className="nav__logo-mark" aria-hidden="true" style={{ width: 34, height: 34, background: 'transparent', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                <svg width="34" height="34" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
                  <rect x="1" y="1" width="6" height="6" rx="1.5" fill="var(--color-ink-primary)"/>
                  <rect x="9" y="1" width="6" height="6" rx="1.5" fill="var(--color-ink-primary)" opacity="0.55"/>
                  <rect x="1" y="9" width="6" height="6" rx="1.5" fill="var(--color-ink-primary)" opacity="0.55"/>
                  <rect x="9" y="9" width="6" height="6" rx="1.5" fill="var(--color-ink-primary)"/>
                </svg>
              </div>
              <div>
                <div className="nav__wordmark-text" style={{ fontSize: '20px', fontWeight: 800, letterSpacing: '-0.025em', color: 'var(--color-ink-primary)', lineHeight: 1.15 }}>K10 Hub</div>
                <div className="nav__wordmark-sub" style={{ fontSize: '12px', fontWeight: 500, color: 'var(--color-ink-tertiary)', letterSpacing: '0.02em', lineHeight: 1.2 }}>UNIHIKER K10 Platform</div>
              </div>
            </Link>

            {/* Desktop Navigation Links */}
            <nav className="nav__links" aria-label="Primary navigation" style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              {NAV_LINKS.map((link) => (
                <NavLink
                  key={link.href}
                  to={link.href}
                  className={({ isActive }) => `nav__link ${isActive ? 'nav__link--active active' : ''}`}
                >
                  {link.label}
                </NavLink>
              ))}
            </nav>
          </div>

          {/* Center: Global Header Search Bar */}
          <div
            ref={searchContainerRef}
            className="nav__search-desktop"
            style={{
              position: 'relative',
              flex: '1 1 360px',
              maxWidth: 520,
              margin: '0 20px',
            }}
          >
            <form onSubmit={handleSearchSubmit} style={{ position: 'relative', width: '100%' }}>
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  backgroundColor: 'var(--color-surface)',
                  border: searchOpen && cleanSearch ? '1.5px solid var(--color-accent)' : '1.5px solid var(--color-border)',
                  borderRadius: '10px',
                  padding: '0 12px 0 16px',
                  height: '46px',
                  boxShadow: searchOpen && cleanSearch ? '0 0 0 3px var(--color-accent-light)' : 'var(--shadow-xs)',
                  transition: 'all 0.18s ease',
                }}
              >
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => {
                    setSearchQuery(e.target.value);
                    setSearchOpen(true);
                  }}
                  onFocus={() => setSearchOpen(true)}
                  placeholder="Search projects, tutorials..."
                  style={{
                    background: 'none',
                    border: 'none',
                    outline: 'none',
                    fontSize: '15px',
                    fontWeight: 500,
                    color: 'var(--color-ink-primary)',
                    width: '100%',
                  }}
                />
                {searchQuery && (
                  <button
                    type="button"
                    onClick={() => {
                      setSearchQuery('');
                      setSearchOpen(false);
                    }}
                    style={{
                      background: 'none',
                      border: 'none',
                      padding: 4,
                      cursor: 'pointer',
                      color: 'var(--color-ink-tertiary)',
                      display: 'flex',
                      alignItems: 'center',
                      marginRight: 4,
                    }}
                    aria-label="Clear search"
                  >
                    <X size={16} />
                  </button>
                )}
                <button
                  type="submit"
                  style={{
                    background: 'none',
                    border: 'none',
                    padding: 4,
                    cursor: 'pointer',
                    color: 'var(--color-ink-tertiary)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    transition: 'color 0.15s ease',
                  }}
                  aria-label="Submit search"
                  title="Search"
                  onMouseEnter={(e) => {
                    e.currentTarget.style.color = 'var(--color-ink-primary)';
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.color = 'var(--color-ink-tertiary)';
                  }}
                >
                  <Search size={18} />
                </button>
              </div>
            </form>

            {/* Dropdown Live Results */}
            {searchOpen && cleanSearch && (
              <div
                style={{
                  position: 'absolute',
                  top: 'calc(100% + 8px)',
                  left: 0,
                  right: 0,
                  backgroundColor: 'var(--color-surface)',
                  border: '1px solid var(--color-border)',
                  borderRadius: 'var(--radius-xl)',
                  boxShadow: '0 12px 32px rgba(0, 0, 0, 0.15)',
                  padding: 'var(--space-3)',
                  zIndex: 1100,
                  maxHeight: 420,
                  overflowY: 'auto',
                }}
              >
                {totalResultsCount === 0 ? (
                  <div style={{ padding: 'var(--space-4)', textAlign: 'center', color: 'var(--color-ink-tertiary)', fontSize: 'var(--text-xs)' }}>
                    No results found for &quot;{searchQuery}&quot;
                  </div>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-3)' }}>
                    {/* Projects Section */}
                    {matchedProjects.length > 0 && (
                      <div>
                        <div style={{ fontSize: '11px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--color-ink-tertiary)', padding: '2px 8px', display: 'flex', alignItems: 'center', gap: '5px' }}>
                          <Cpu size={13} style={{ color: 'var(--color-accent)' }} /> Projects
                        </div>
                        {matchedProjects.map((p) => (
                          <div
                            key={p.id}
                            onClick={() => {
                              setSearchOpen(false);
                              setSearchQuery('');
                              navigate(`/project/${p.id}`);
                            }}
                            style={{
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'space-between',
                              padding: '8px 10px',
                              borderRadius: 'var(--radius-md)',
                              cursor: 'pointer',
                              transition: 'background-color 0.15s ease',
                            }}
                            className="nav__dropdown-item"
                          >
                            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', overflow: 'hidden' }}>
                              <div style={{ width: 32, height: 32, borderRadius: '6px', overflow: 'hidden', backgroundColor: 'var(--color-paper)', flexShrink: 0 }}>
                                <img src={p.coverImage} alt={p.title} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                              </div>
                              <div style={{ overflow: 'hidden' }}>
                                <div style={{ fontSize: '13px', fontWeight: 600, color: 'var(--color-ink-primary)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                                  {p.title}
                                </div>
                                <div style={{ fontSize: '11.5px', color: 'var(--color-ink-tertiary)' }}>
                                  by {p.author}
                                </div>
                              </div>
                            </div>
                            <ArrowRight size={13} style={{ color: 'var(--color-ink-tertiary)', flexShrink: 0, marginLeft: 8 }} />
                          </div>
                        ))}
                      </div>
                    )}

                    {/* Tutorials Section */}
                    {matchedTutorials.length > 0 && (
                      <div>
                        <div style={{ fontSize: '11px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--color-ink-tertiary)', padding: '2px 8px', display: 'flex', alignItems: 'center', gap: '5px' }}>
                          <BookOpen size={13} style={{ color: 'rgb(202, 138, 4)' }} /> Tutorials
                        </div>
                        {matchedTutorials.map((t) => (
                          <div
                            key={t.id}
                            onClick={() => {
                              setSearchOpen(false);
                              setSearchQuery('');
                              navigate(`/project/${t.id}`);
                            }}
                            style={{
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'space-between',
                              padding: '8px 10px',
                              borderRadius: 'var(--radius-md)',
                              cursor: 'pointer',
                              transition: 'background-color 0.15s ease',
                            }}
                            className="nav__dropdown-item"
                          >
                            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', overflow: 'hidden' }}>
                              <div style={{ width: 32, height: 32, borderRadius: '6px', overflow: 'hidden', backgroundColor: 'var(--color-paper)', flexShrink: 0 }}>
                                <img src={t.coverImage} alt={t.title} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                              </div>
                              <div style={{ overflow: 'hidden' }}>
                                <div style={{ fontSize: '13px', fontWeight: 600, color: 'var(--color-ink-primary)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                                  {t.title}
                                </div>
                                <div style={{ fontSize: '11.5px', color: 'var(--color-ink-tertiary)' }}>
                                  by {t.author}
                                </div>
                              </div>
                            </div>
                            <ArrowRight size={13} style={{ color: 'var(--color-ink-tertiary)', flexShrink: 0, marginLeft: 8 }} />
                          </div>
                        ))}
                      </div>
                    )}

                    {/* Authors / Creators Section */}
                    {matchedAuthors.length > 0 && (
                      <div>
                        <div style={{ fontSize: '10.5px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--color-ink-tertiary)', padding: '2px 8px', display: 'flex', alignItems: 'center', gap: '5px' }}>
                          <User size={12} style={{ color: '#0284c7' }} /> Creators
                        </div>
                        {matchedAuthors.map((a, idx) => (
                          <div
                            key={idx}
                            onClick={() => {
                              setSearchOpen(false);
                              setSearchQuery('');
                              if (isCurrentAuthor(a.name, a.id)) {
                                navigate('/profile');
                              } else {
                                navigate(`/profile/${encodeURIComponent(a.id || a.name)}`);
                              }
                            }}
                            style={{
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'space-between',
                              padding: '6px 8px',
                              borderRadius: 'var(--radius-md)',
                              cursor: 'pointer',
                              transition: 'background-color 0.15s ease',
                            }}
                            className="nav__dropdown-item"
                          >
                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                              {a.avatar ? (
                                <img src={a.avatar} alt={a.name} style={{ width: 26, height: 26, borderRadius: '50%', objectFit: 'cover' }} />
                              ) : (
                                <div style={{ width: 26, height: 26, borderRadius: '50%', backgroundColor: 'var(--color-ink-primary)', color: '#fff', fontSize: '11px', fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                  {a.name.charAt(0).toUpperCase()}
                                </div>
                              )}
                              <div style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
                                <span style={{ fontSize: '12.5px', fontWeight: 600, color: 'var(--color-ink-primary)' }}>
                                  {a.name}
                                </span>
                                <UserBadge role={a.role} size={14} />
                              </div>
                            </div>
                            <span style={{ fontSize: '11px', color: 'var(--color-accent)', fontWeight: 600 }}>
                              {isCurrentAuthor(a.name, a.id) ? 'My Profile' : 'View Profile'}
                            </span>
                          </div>
                        ))}
                      </div>
                    )}

                    {/* View All Query Results Footer */}
                    <div style={{ borderTop: '1px solid var(--color-border)', paddingTop: '6px', textAlign: 'center' }}>
                      <button
                        type="button"
                        onClick={handleSearchSubmit}
                        style={{
                          background: 'none',
                          border: 'none',
                          color: 'var(--color-accent)',
                          fontSize: '11.5px',
                          fontWeight: 600,
                          cursor: 'pointer',
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '4px',
                        }}
                      >
                        <span>View all matching results</span>
                        <ArrowRight size={12} />
                      </button>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Actions */}
          <div className="nav__actions" style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            {/* Notification Bell */}
            {user && <NotificationBell />}

            {/* Buy UNIHIKER K10 Affiliate Button */}
            <a
              href={BUY_K10_AFFILIATE_URL}
              target="_blank"
              rel="noopener noreferrer"
              className="nav__buy-btn btn btn--accent"
              title="STEM AI Agent Coding Board | UNIHIKER K10 - Vision, Voice, TinyML | DFRobot"
              aria-label="Buy UNIHIKER K10 on DFRobot"
            >
              <ShoppingCart size={15} />
              <span>Buy K10</span>
            </a>

            {/* Auth section */}
            {user ? (
              <div style={{ position: 'relative' }} ref={dropdownRef} className="nav__auth-desktop">
                <button
                  type="button"
                  className="nav__user-btn"
                  onClick={() => setUserDropdownOpen(!userDropdownOpen)}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.6rem',
                    background: 'none',
                    border: '1px solid var(--color-border)',
                    borderRadius: 'var(--radius-full)',
                    padding: '4px 14px 4px 5px',
                    height: '42px',
                    cursor: 'pointer',
                    color: 'var(--color-ink-primary)',
                  }}
                  aria-expanded={userDropdownOpen}
                >
                  {avatarUrl ? (
                    <img
                      src={avatarUrl}
                      alt={displayName}
                      style={{ width: 32, height: 32, borderRadius: '50%', objectFit: 'cover' }}
                    />
                  ) : (
                    <div style={{
                      width: 32,
                      height: 32,
                      borderRadius: '50%',
                      backgroundColor: 'var(--color-ink-primary)',
                      color: '#fff',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      fontSize: '13px',
                      fontWeight: 700,
                    }}>
                      {displayName.charAt(0).toUpperCase()}
                    </div>
                  )}

                  <span className="nav__user-btn-name" style={{ fontSize: '14px', fontWeight: 600, maxWidth: 140, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {displayName}
                  </span>

                  {/* Verification Tick Mark */}
                  <UserBadge role={role} size={15} />

                  <ChevronDown className="nav__user-btn-chevron" size={14} style={{ color: 'var(--color-ink-tertiary)' }} />
                </button>

                {/* Dropdown Menu */}
                {userDropdownOpen && (
                  <div style={{
                    position: 'absolute',
                    top: 'calc(100% + 8px)',
                    right: 0,
                    width: 230,
                    backgroundColor: 'var(--color-surface)',
                    border: '1px solid var(--color-border)',
                    borderRadius: 'var(--radius-lg)',
                    boxShadow: 'var(--shadow-lg)',
                    padding: 'var(--space-2)',
                    zIndex: 1000,
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '2px',
                  }}>
                    <div style={{ padding: 'var(--space-2) var(--space-3)', borderBottom: '1px solid var(--color-border)', marginBottom: 'var(--space-1)' }}>
                      <div style={{ fontSize: '13.5px', fontWeight: 600, color: 'var(--color-ink-primary)' }}>{displayName}</div>
                      <div style={{ fontSize: '11.5px', color: 'var(--color-ink-tertiary)', textOverflow: 'ellipsis', overflow: 'hidden' }}>{profile?.email || user.email}</div>
                    </div>

                    <Link
                      to="/profile"
                      onClick={() => setUserDropdownOpen(false)}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '0.6rem',
                        padding: '8px 12px',
                        fontSize: '13.5px',
                        fontWeight: 500,
                        color: 'var(--color-ink-primary)',
                        textDecoration: 'none',
                        borderRadius: 'var(--radius-md)',
                      }}
                      className="nav__dropdown-item"
                    >
                      <User size={15} /> My Profile
                    </Link>

                    {role === 'admin' && (
                      <Link
                        to="/admin"
                        onClick={() => setUserDropdownOpen(false)}
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: '0.6rem',
                          padding: '8px 12px',
                          fontSize: '13.5px',
                          fontWeight: 500,
                          color: 'rgb(220, 38, 38)',
                          textDecoration: 'none',
                          borderRadius: 'var(--radius-md)',
                        }}
                        className="nav__dropdown-item"
                      >
                        <Shield size={15} /> Admin Dashboard
                      </Link>
                    )}

                    {role === 'user' && (
                      <Link
                        to="/profile"
                        onClick={() => setUserDropdownOpen(false)}
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: '0.6rem',
                          padding: '8px 12px',
                          fontSize: '13.5px',
                          fontWeight: 500,
                          color: 'var(--color-accent)',
                          textDecoration: 'none',
                          borderRadius: 'var(--radius-md)',
                        }}
                        className="nav__dropdown-item"
                      >
                        <Sparkles size={15} /> Apply for Author
                      </Link>
                    )}

                    <div style={{ height: 1, backgroundColor: 'var(--color-border)', margin: '4px 0' }} />

                    <button
                      type="button"
                      onClick={handleSignOut}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '0.6rem',
                        padding: '8px 12px',
                        fontSize: '13.5px',
                        fontWeight: 500,
                        color: 'var(--color-ink-secondary)',
                        background: 'none',
                        border: 'none',
                        width: '100%',
                        textAlign: 'left',
                        cursor: 'pointer',
                        borderRadius: 'var(--radius-md)',
                      }}
                      className="nav__dropdown-item"
                    >
                      <LogOut size={15} /> Sign Out
                    </button>
                  </div>
                )}
              </div>
            ) : (
              <div style={{ display: 'flex', alignItems: 'center' }} className="nav__auth-desktop">
                <Link
                  to="/login"
                  className="btn btn--secondary nav__guest-signin"
                  style={{
                    height: '42px',
                    padding: '0 18px',
                    fontSize: '13.5px',
                    fontWeight: 600,
                    borderRadius: 'var(--radius-md)',
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '7px',
                    color: 'var(--color-ink-primary)',
                    whiteSpace: 'nowrap',
                  }}
                >
                  <LogIn size={15} />
                  <span>Sign In</span>
                </Link>
              </div>
            )}

            <button
              type="button"
              className="nav__mobile-toggle"
              onClick={() => setMobileOpen(!mobileOpen)}
              aria-label={mobileOpen ? 'Close navigation menu' : 'Open navigation menu'}
              aria-expanded={mobileOpen}
              title={mobileOpen ? 'Close menu' : 'Open menu'}
            >
              {mobileOpen ? <X size={22} /> : <Menu size={22} />}
            </button>
          </div>
        </div>
      </header>

      {/* Mobile Side Menu Backdrop Overlay */}
      {mobileOpen && (
        <div
          className="nav__mobile-overlay"
          onClick={() => setMobileOpen(false)}
          aria-hidden="true"
        />
      )}

      {/* Mobile Side Menu Drawer (Slides out from right) */}
      <aside
        className={`nav__mobile-drawer ${mobileOpen ? 'nav__mobile-drawer--open' : ''}`}
        role="dialog"
        aria-modal="true"
        aria-label="Navigation menu"
      >
        {/* Drawer Header */}
        <div className="nav__mobile-drawer-header">
          <Link
            to="/"
            onClick={() => setMobileOpen(false)}
            style={{ display: 'flex', alignItems: 'center', gap: '10px', textDecoration: 'none' }}
          >
            <div
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
              <svg width="28" height="28" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
                <rect x="1" y="1" width="6" height="6" rx="1.5" fill="var(--color-ink-primary)" />
                <rect x="9" y="1" width="6" height="6" rx="1.5" fill="var(--color-ink-primary)" opacity="0.55" />
                <rect x="1" y="9" width="6" height="6" rx="1.5" fill="var(--color-ink-primary)" opacity="0.55" />
                <rect x="9" y="9" width="6" height="6" rx="1.5" fill="var(--color-ink-primary)" />
              </svg>
            </div>
            <div>
              <div style={{ fontSize: '17px', fontWeight: 800, color: 'var(--color-ink-primary)', letterSpacing: '-0.02em', lineHeight: 1.1 }}>
                K10 Hub
              </div>
              <div style={{ fontSize: '11px', fontWeight: 500, color: 'var(--color-ink-tertiary)', letterSpacing: '0.02em' }}>
                UNIHIKER K10 Platform
              </div>
            </div>
          </Link>

          <button
            type="button"
            onClick={() => setMobileOpen(false)}
            aria-label="Close menu"
            style={{
              background: 'none',
              border: '1px solid var(--color-border)',
              borderRadius: '8px',
              width: 36,
              height: 36,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              cursor: 'pointer',
              color: 'var(--color-ink-primary)',
            }}
          >
            <X size={20} />
          </button>
        </div>

        {/* Drawer Scrollable Content */}
        <div className="nav__mobile-drawer-body">
          {/* Mobile Search Input */}
          <form
            onSubmit={(e) => {
              e.preventDefault();
              if (cleanSearch) {
                setMobileOpen(false);
                navigate(`/projects?q=${encodeURIComponent(cleanSearch)}`);
              }
            }}
            style={{ marginBottom: '16px' }}
          >
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                backgroundColor: 'var(--color-surface)',
                border: '1px solid var(--color-border)',
                borderRadius: '10px',
                padding: '8px 12px',
                boxShadow: 'var(--shadow-xs)',
              }}
            >
              <Search size={16} style={{ color: 'var(--color-ink-tertiary)', marginRight: 8, flexShrink: 0 }} />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search projects, tutorials..."
                style={{
                  background: 'none',
                  border: 'none',
                  outline: 'none',
                  fontSize: '14px',
                  color: 'var(--color-ink-primary)',
                  width: '100%',
                }}
              />
              {searchQuery && (
                <button
                  type="button"
                  onClick={() => setSearchQuery('')}
                  style={{ background: 'none', border: 'none', padding: 2, cursor: 'pointer', color: 'var(--color-ink-tertiary)' }}
                  aria-label="Clear search text"
                >
                  <X size={14} />
                </button>
              )}
            </div>
          </form>

          {/* User Account / Profile Section */}
          {user ? (
            <div
              style={{
                backgroundColor: 'var(--color-paper)',
                border: '1px solid var(--color-border)',
                borderRadius: '12px',
                padding: '12px 14px',
                marginBottom: '18px',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '10px' }}>
                {avatarUrl ? (
                  <img
                    src={avatarUrl}
                    alt={displayName}
                    style={{ width: 40, height: 40, borderRadius: '50%', objectFit: 'cover' }}
                  />
                ) : (
                  <div
                    style={{
                      width: 40,
                      height: 40,
                      borderRadius: '50%',
                      backgroundColor: 'var(--color-ink-primary)',
                      color: '#fff',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      fontSize: '15px',
                      fontWeight: 700,
                    }}
                  >
                    {displayName.charAt(0).toUpperCase()}
                  </div>
                )}
                <div style={{ overflow: 'hidden', flex: 1 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
                    <span style={{ fontSize: '14.5px', fontWeight: 700, color: 'var(--color-ink-primary)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                      {displayName}
                    </span>
                    <UserBadge role={role} size={15} />
                  </div>
                  <div style={{ fontSize: '11.5px', color: 'var(--color-ink-tertiary)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                    {profile?.email || user.email}
                  </div>
                </div>
              </div>

              {/* User quick links */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '3px', borderTop: '1px solid var(--color-border)', paddingTop: '8px' }}>
                <Link
                  to="/profile"
                  onClick={() => setMobileOpen(false)}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px',
                    padding: '8px 10px',
                    fontSize: '13.5px',
                    fontWeight: 600,
                    color: 'var(--color-ink-primary)',
                    textDecoration: 'none',
                    borderRadius: '6px',
                  }}
                  className="nav__dropdown-item"
                >
                  <User size={15} style={{ color: 'var(--color-accent)' }} />
                  <span>My Profile</span>
                </Link>

                {role === 'admin' && (
                  <Link
                    to="/admin"
                    onClick={() => setMobileOpen(false)}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '8px',
                      padding: '8px 10px',
                      fontSize: '13.5px',
                      fontWeight: 600,
                      color: 'rgb(220, 38, 38)',
                      textDecoration: 'none',
                      borderRadius: '6px',
                    }}
                    className="nav__dropdown-item"
                  >
                    <Shield size={15} />
                    <span>Admin Dashboard</span>
                  </Link>
                )}

                {role === 'user' && (
                  <Link
                    to="/profile"
                    onClick={() => setMobileOpen(false)}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '8px',
                      padding: '8px 10px',
                      fontSize: '13.5px',
                      fontWeight: 600,
                      color: 'var(--color-accent)',
                      textDecoration: 'none',
                      borderRadius: '6px',
                    }}
                    className="nav__dropdown-item"
                  >
                    <Sparkles size={15} />
                    <span>Apply for Author</span>
                  </Link>
                )}
              </div>
            </div>
          ) : (
            /* Guest Card */
            <div
              style={{
                backgroundColor: 'var(--color-paper)',
                border: '1px solid var(--color-border)',
                borderRadius: '12px',
                padding: '14px',
                marginBottom: '18px',
                display: 'flex',
                flexDirection: 'column',
                gap: '8px',
              }}
            >
              <div style={{ fontSize: '13.5px', fontWeight: 700, color: 'var(--color-ink-primary)' }}>
                Maker Community
              </div>
              <div style={{ fontSize: '12px', color: 'var(--color-ink-tertiary)', lineHeight: 1.4 }}>
                Sign in to bookmark builds, publish tutorials, and flash UNIHIKER K10.
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px', marginTop: '4px' }}>
                <Link
                  to="/login"
                  onClick={() => setMobileOpen(false)}
                  className="btn btn--secondary"
                  style={{ justifyContent: 'center', height: '40px', fontSize: '13.5px', fontWeight: 600 }}
                >
                  Sign In
                </Link>
                <Link
                  to="/signup"
                  onClick={() => setMobileOpen(false)}
                  className="btn btn--primary"
                  style={{ justifyContent: 'center', height: '40px', fontSize: '13.5px', fontWeight: 600 }}
                >
                  Sign Up
                </Link>
              </div>
            </div>
          )}

          {/* Buy UNIHIKER K10 Affiliate CTA */}
          <div style={{ marginBottom: '18px' }}>
            <a
              href={BUY_K10_AFFILIATE_URL}
              target="_blank"
              rel="noopener noreferrer"
              className="btn btn--accent"
              style={{
                width: '100%',
                justifyContent: 'center',
                height: '44px',
                fontSize: '14px',
                fontWeight: 600,
                borderRadius: '8px',
                gap: '8px',
                textDecoration: 'none',
                boxShadow: '0 2px 8px rgba(29, 78, 216, 0.22)',
              }}
              title="STEM AI Agent Coding Board | UNIHIKER K10 - Vision, Voice, TinyML | DFRobot"
            >
              <ShoppingCart size={16} />
              <span>Buy UNIHIKER K10</span>
              <ExternalLink size={14} style={{ opacity: 0.8 }} />
            </a>
          </div>

          {/* Primary Navigation Links */}
          <div style={{ marginBottom: '16px' }}>
            <div
              style={{
                fontSize: '10.5px',
                fontWeight: 700,
                textTransform: 'uppercase',
                letterSpacing: '0.08em',
                color: 'var(--color-ink-tertiary)',
                padding: '4px 10px 8px 10px',
              }}
            >
              Explore
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '3px' }}>
              <NavLink
                to="/projects"
                onClick={() => setMobileOpen(false)}
                className={({ isActive }) => `nav__mobile-link ${isActive ? 'nav__mobile-link--active' : ''}`}
              >
                <Cpu size={17} style={{ color: 'var(--color-accent)' }} />
                <span>Projects Gallery</span>
              </NavLink>

              <NavLink
                to="/tutorials"
                onClick={() => setMobileOpen(false)}
                className={({ isActive }) => `nav__mobile-link ${isActive ? 'nav__mobile-link--active' : ''}`}
              >
                <BookOpen size={17} style={{ color: 'rgb(202, 138, 4)' }} />
                <span>Tutorials & Guides</span>
              </NavLink>

              <NavLink
                to="/faq"
                onClick={() => setMobileOpen(false)}
                className={({ isActive }) => `nav__mobile-link ${isActive ? 'nav__mobile-link--active' : ''}`}
              >
                <HelpCircle size={17} style={{ color: 'var(--color-ink-secondary)' }} />
                <span>FAQ & Troubleshooting</span>
              </NavLink>

              <NavLink
                to="/about"
                onClick={() => setMobileOpen(false)}
                className={({ isActive }) => `nav__mobile-link ${isActive ? 'nav__mobile-link--active' : ''}`}
              >
                <Info size={17} style={{ color: 'var(--color-ink-secondary)' }} />
                <span>About K10 Hub</span>
              </NavLink>
            </div>
          </div>
        </div>

        {/* Drawer Footer */}
        <div className="nav__mobile-drawer-footer">
          {user ? (
            <button
              type="button"
              onClick={() => {
                setMobileOpen(false);
                handleSignOut();
              }}
              className="btn btn--secondary"
              style={{
                width: '100%',
                justifyContent: 'center',
                gap: '8px',
                height: '42px',
                color: 'var(--color-ink-secondary)',
                fontWeight: 600,
              }}
            >
              <LogOut size={16} />
              <span>Sign Out</span>
            </button>
          ) : (
            <div style={{ textAlign: 'center', fontSize: '11px', color: 'var(--color-ink-tertiary)' }}>
              UNIHIKER K10 Platform • Learn. Build. Flash.
            </div>
          )}
        </div>
      </aside>
    </>
  );
}
