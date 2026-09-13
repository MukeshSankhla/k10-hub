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
} from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import UserBadge, { isKnownAdmin } from '../common/UserBadge';
import NotificationBell from '../notifications/NotificationBell';
import EmailVerificationBanner from '../auth/EmailVerificationBanner';
import { getPublicProjects, resolveProjectAuthor } from '../../services/projects/projectStorageService';

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
          <div style={{ display: 'flex', alignItems: 'center', gap: '36px' }}>
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

            {/* Auth section */}
            {user ? (
              <div style={{ position: 'relative' }} ref={dropdownRef}>
                <button
                  type="button"
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

                  <span style={{ fontSize: '14px', fontWeight: 600, maxWidth: 140, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {displayName}
                  </span>

                  {/* Verification Tick Mark */}
                  <UserBadge role={role} size={15} />

                  <ChevronDown size={14} style={{ color: 'var(--color-ink-tertiary)' }} />
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
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Link
                  to="/login"
                  className="btn btn--ghost"
                  style={{
                    height: '42px',
                    padding: '0 18px',
                    fontSize: '14.5px',
                    fontWeight: 600,
                    borderRadius: '8px',
                    color: 'var(--color-ink-primary)',
                  }}
                >
                  Sign In
                </Link>
                <Link
                  to="/signup"
                  className="btn btn--primary"
                  style={{
                    height: '42px',
                    padding: '0 20px',
                    fontSize: '14.5px',
                    fontWeight: 600,
                    borderRadius: '8px',
                  }}
                >
                  Sign Up
                </Link>
              </div>
            )}

            <button
              className="nav__mobile-toggle btn"
              onClick={() => setMobileOpen(!mobileOpen)}
              aria-label={mobileOpen ? 'Close menu' : 'Open menu'}
              aria-expanded={mobileOpen}
              style={{ width: 42, height: 42, borderRadius: '8px' }}
            >
              {mobileOpen ? <X size={22} /> : <Menu size={22} />}
            </button>
          </div>
        </div>
      </header>

      {/* Mobile Menu */}
      {mobileOpen && (
        <div
          style={{
            position: 'fixed',
            top: 'var(--nav-height)',
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: 'var(--color-paper)',
            zIndex: 99,
            padding: 'var(--space-6)',
            display: 'flex',
            flexDirection: 'column',
            gap: 'var(--space-2)',
            borderTop: '1px solid var(--color-border)',
          }}
          role="dialog"
          aria-label="Mobile navigation"
        >
          {/* Mobile Search Form */}
          <form
            onSubmit={(e) => {
              e.preventDefault();
              if (cleanSearch) {
                setMobileOpen(false);
                navigate(`/projects?q=${encodeURIComponent(cleanSearch)}`);
              }
            }}
            style={{ marginBottom: 'var(--space-3)' }}
          >
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                backgroundColor: 'var(--color-surface)',
                border: '1px solid var(--color-border)',
                borderRadius: 'var(--radius-full)',
                padding: '8px 14px',
              }}
            >
              <Search size={16} style={{ color: 'var(--color-ink-tertiary)', marginRight: 8 }} />
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
            </div>
          </form>

          {NAV_LINKS.map((link) => (
            <Link
              key={link.href}
              to={link.href}
              onClick={() => setMobileOpen(false)}
              style={{
                display: 'block',
                padding: 'var(--space-3) var(--space-4)',
                fontSize: 'var(--text-lg)',
                fontWeight: 500,
                color: 'var(--color-ink-primary)',
                textDecoration: 'none',
                borderRadius: 'var(--radius-md)',
              }}
            >
              {link.label}
            </Link>
          ))}

          {user ? (
            <div style={{ marginTop: 'var(--space-4)', paddingTop: 'var(--space-4)', borderTop: '1px solid var(--color-border)' }}>
              <Link
                to="/profile"
                onClick={() => setMobileOpen(false)}
                style={{
                  display: 'block',
                  padding: 'var(--space-3) var(--space-4)',
                  fontSize: 'var(--text-base)',
                  fontWeight: 600,
                  color: 'var(--color-ink-primary)',
                  textDecoration: 'none',
                }}
              >
                Profile ({displayName})
              </Link>
              {role === 'admin' && (
                <Link
                  to="/admin"
                  onClick={() => setMobileOpen(false)}
                  style={{
                    display: 'block',
                    padding: 'var(--space-3) var(--space-4)',
                    fontSize: 'var(--text-base)',
                    fontWeight: 600,
                    color: 'rgb(220, 38, 38)',
                    textDecoration: 'none',
                  }}
                >
                  Admin Dashboard
                </Link>
              )}
              <button
                type="button"
                onClick={() => {
                  setMobileOpen(false);
                  handleSignOut();
                }}
                className="btn btn--secondary"
                style={{ width: '100%', marginTop: 'var(--space-3)', justifyContent: 'center' }}
              >
                Sign Out
              </button>
            </div>
          ) : (
            <div style={{ marginTop: 'auto', paddingTop: 'var(--space-6)', borderTop: '1px solid var(--color-border)', display: 'flex', flexDirection: 'column', gap: 'var(--space-2)' }}>
              <Link
                to="/login"
                className="btn btn--secondary"
                onClick={() => setMobileOpen(false)}
                style={{ width: '100%', justifyContent: 'center' }}
              >
                Sign In
              </Link>
              <Link
                to="/signup"
                className="btn btn--primary"
                onClick={() => setMobileOpen(false)}
                style={{ width: '100%', justifyContent: 'center' }}
              >
                Sign Up
              </Link>
            </div>
          )}
        </div>
      )}
    </>
  );
}
