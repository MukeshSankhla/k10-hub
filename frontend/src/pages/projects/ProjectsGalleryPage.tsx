import { useState, useEffect, useMemo } from 'react';
import { Link, useLocation, useSearchParams } from 'react-router-dom';
import Header from '../../components/layout/Header';
import Footer from '../../components/layout/Footer';
import { useAuth } from '../../contexts/AuthContext';
import { ProjectDetail, AVAILABLE_TOPICS } from '../../config/projectsData';
import {
  getPublicProjects,
  subscribeProjects,
  syncCurrentUserProjects,
  refreshProjectsFromBackend,
} from '../../services/projects/projectStorageService';
import ProjectCard from '../../components/projects/ProjectCard';
import {
  Search,
  Plus,
  ArrowRight,
  ChevronDown,
  X,
  LayoutGrid,
  List,
} from 'lucide-react';

const LEVEL_CONFIG = [
  {
    level: 1,
    name: 'Beginner',
    tagline: 'First Blink, GPIO & Primitives',
    description: 'Basic hardware control, onboard RGB LEDs, tactile buttons, and first sketch structure.',
    color: '#16a34a',
    bg: 'rgba(22, 163, 74, 0.08)',
    border: 'rgba(22, 163, 74, 0.25)',
  },
  {
    level: 2,
    name: 'Intermediate',
    tagline: 'Sensors, Audio & LCD Display',
    description: 'Color display interfaces, analog/I2C sensor integration, buzzer sound synthesis, and events.',
    color: '#0284c7',
    bg: 'rgba(2, 132, 199, 0.08)',
    border: 'rgba(2, 132, 199, 0.25)',
  },
  {
    level: 3,
    name: 'Advanced',
    tagline: 'IoT, Wireless & Telemetry HUD',
    description: 'Wi-Fi web servers, low-latency ESP-NOW mesh networking, MQTT, and live PC hardware telemetry.',
    color: '#7c3aed',
    bg: 'rgba(124, 58, 237, 0.08)',
    border: 'rgba(124, 58, 237, 0.25)',
  },
  {
    level: 4,
    name: 'Expert',
    tagline: 'Neural AI Vision & Edge Robotics',
    description: 'DVP camera machine learning inference, custom hardware drivers, and autonomous robotics.',
    color: '#ea580c',
    bg: 'rgba(234, 88, 12, 0.08)',
    border: 'rgba(234, 88, 12, 0.25)',
  },
];

export default function ProjectsGalleryPage() {
  const { user, profile, role } = useAuth();
  const isAuthorOrAdmin = role === 'author' || role === 'admin';
  const location = useLocation();
  const [searchParams, setSearchParams] = useSearchParams();

  // Page Mode: Projects vs Tutorials
  const isTutorialsMode = location.pathname.startsWith('/tutorials');
  const pageType = isTutorialsMode ? 'Tutorial' : 'Project';
  const pageTitle = isTutorialsMode ? 'Tutorials' : 'Projects';
  const pageSubtitle = isTutorialsMode
    ? 'Step-by-step guides, wiring instructions, and hands-on walkthroughs for UNIHIKER K10.'
    : 'Open-source hardware builds and pre-compiled firmware editions for UNIHIKER K10.';

  // Storage data
  const [allProjects, setAllProjects] = useState<ProjectDetail[]>(() => getPublicProjects());

  useEffect(() => {
    setAllProjects(getPublicProjects());

    refreshProjectsFromBackend().then((fresh) => {
      if (fresh && fresh.length > 0) {
        setAllProjects(getPublicProjects());
      }
    }).catch(() => {});

    const unsubscribe = subscribeProjects(() => {
      setAllProjects(getPublicProjects());
    });
    return unsubscribe;
  }, []);

  useEffect(() => {
    if (user || profile) {
      syncCurrentUserProjects(user, profile);
    }
  }, [user, profile]);

  // Filter items by type (Projects vs Tutorials)
  const baseItems = useMemo(() => {
    return allProjects.filter((p) =>
      isTutorialsMode ? p.type === 'Tutorial' : p.type !== 'Tutorial'
    );
  }, [allProjects, isTutorialsMode]);

  // Filter States
  const paramLevel = searchParams.get('level');
  const paramQuery = searchParams.get('q');
  const paramTag = searchParams.get('tag');

  const [selectedLevel, setSelectedLevel] = useState<number>(() => {
    if (paramLevel && !isNaN(Number(paramLevel))) {
      const lvl = Number(paramLevel);
      if (lvl >= 1 && lvl <= 4) return lvl;
    }
    return 0; // 0 = All Levels (shows 4 level sections)
  });

  const [searchTerm, setSearchTerm] = useState<string>(paramQuery || '');
  const [selectedTag, setSelectedTag] = useState<string>(paramTag || 'All');
  const [sortBy, setSortBy] = useState<'newest' | 'flashes' | 'title'>('newest');
  const [viewMode, setViewMode] = useState<'grid' | 'sections'>('grid');

  // Sync state with URL params
  useEffect(() => {
    if (paramLevel && !isNaN(Number(paramLevel))) {
      const lvl = Number(paramLevel);
      if (lvl >= 1 && lvl <= 4) setSelectedLevel(lvl);
    } else {
      setSelectedLevel(0);
    }
  }, [paramLevel]);

  useEffect(() => {
    if (paramQuery !== null) setSearchTerm(paramQuery);
  }, [paramQuery]);

  useEffect(() => {
    if (paramTag !== null) setSelectedTag(paramTag);
  }, [paramTag]);

  // Available topics / tags filter list (includes all official topics + custom project tags)
  const allTags = useMemo(() => {
    const customTags = new Set<string>();
    allProjects.forEach((p: ProjectDetail) => {
      p.tags?.forEach((t: string) => {
        if (t && !AVAILABLE_TOPICS.includes(t as any)) {
          customTags.add(t);
        }
      });
    });
    return ['All', ...AVAILABLE_TOPICS, ...Array.from(customTags)];
  }, [allProjects]);

  const isCurrentAuthor = (authorName: string, authorId?: string) => {
    const myName = (profile?.name || user?.user_metadata?.name || user?.email?.split('@')[0] || '').toLowerCase();
    const myId = String(profile?.id || user?.id || '').toLowerCase();
    if (authorId && myId && authorId.toLowerCase() === myId) return true;
    if (authorName && myName && authorName.toLowerCase() === myName) return true;
    return false;
  };

  // Handle Level Selection & URL sync
  const handleSelectLevel = (level: number) => {
    setSelectedLevel(level);
    setSearchParams((prev) => {
      const next = new URLSearchParams(prev);
      if (level === 0) {
        next.delete('level');
      } else {
        next.set('level', String(level));
      }
      return next;
    }, { replace: true });
  };

  // Handle Search Change & URL sync
  const handleSearchChange = (val: string) => {
    setSearchTerm(val);
    setSearchParams((prev) => {
      const next = new URLSearchParams(prev);
      if (!val.trim()) {
        next.delete('q');
      } else {
        next.set('q', val.trim());
      }
      return next;
    }, { replace: true });
  };

  // Handle Tag Selection & URL sync
  const handleSelectTag = (tag: string) => {
    setSelectedTag(tag);
    setSearchParams((prev) => {
      const next = new URLSearchParams(prev);
      if (tag === 'All') {
        next.delete('tag');
      } else {
        next.set('tag', tag);
      }
      return next;
    }, { replace: true });
  };

  const handleClearFilters = () => {
    setSelectedLevel(0);
    setSearchTerm('');
    setSelectedTag('All');
    setSearchParams({}, { replace: true });
  };

  // Filtered Items (when in filter view or sorting)
  const filteredItems = useMemo(() => {
    return baseItems.filter((p) => {
      const matchesLevel = selectedLevel === 0 || p.level === selectedLevel;
      const matchesSearch =
        !searchTerm.trim() ||
        p.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
        p.description.toLowerCase().includes(searchTerm.toLowerCase()) ||
        p.author.toLowerCase().includes(searchTerm.toLowerCase());
      const matchesTag =
        selectedTag === 'All' ||
        p.tags?.some((t) => t.toLowerCase() === selectedTag.toLowerCase());

      return matchesLevel && matchesSearch && matchesTag;
    }).sort((a, b) => {
      if (sortBy === 'flashes') {
        return (b.flashCount || 0) - (a.flashCount || 0);
      }
      if (sortBy === 'title') {
        return a.title.localeCompare(b.title);
      }
      return 0; // Default order
    });
  }, [baseItems, selectedLevel, searchTerm, selectedTag, sortBy]);

  return (
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column', backgroundColor: 'var(--color-paper)' }}>
      <Header />

      <main style={{ flex: 1, paddingTop: 'calc(var(--nav-height) + var(--space-8))', paddingBottom: 'var(--space-16)' }}>
        <div className="container">

          {/* Header Bar */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              flexWrap: 'wrap',
              gap: 'var(--space-3)',
              marginBottom: 'var(--space-4)',
            }}
          >
            <div>
              <h1
                style={{
                  fontSize: 'clamp(var(--text-xl), 2.5vw, var(--text-2xl))',
                  fontWeight: 800,
                  color: 'var(--color-ink-primary)',
                  letterSpacing: '-0.02em',
                  margin: '0 0 2px 0',
                }}
              >
                {pageTitle}
              </h1>
              <p style={{ color: 'var(--color-ink-secondary)', fontSize: 'var(--text-xs)', margin: 0 }}>
                {pageSubtitle}
              </p>
            </div>

            {/* Author Action */}
            {isAuthorOrAdmin && (
              <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-3)' }}>
                <Link
                  to={`/project/new?type=${pageType}`}
                  className="btn btn--primary btn--sm"
                  style={{ display: 'inline-flex', alignItems: 'center', gap: '0.4rem', textDecoration: 'none' }}
                >
                  <Plus size={15} /> New {pageType}
                </Link>
              </div>
            )}
          </div>

          {/* Hackster-style Minimal Dropdown Filter Bar */}
          <div
            className="gallery-filter-bar"
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: 'var(--space-3)',
              flexWrap: 'wrap',
              paddingBottom: 'var(--space-4)',
              borderBottom: '1px solid var(--color-border)',
              marginBottom: 'var(--space-6)',
            }}
          >
            {/* Left: Compact Dropdowns */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
              {/* 1. Sort / Trending */}
              <div style={{ position: 'relative' }}>
                <select
                  value={sortBy}
                  onChange={(e) => setSortBy(e.target.value as any)}
                  style={{
                    appearance: 'none',
                    WebkitAppearance: 'none',
                    padding: '6px 26px 6px 12px',
                    fontSize: '12px',
                    fontWeight: 500,
                    borderRadius: '6px',
                    border: '1px solid var(--color-border)',
                    backgroundColor: 'var(--color-surface)',
                    color: 'var(--color-ink-primary)',
                    cursor: 'pointer',
                    outline: 'none',
                  }}
                >
                  <option value="newest">Trending</option>
                  <option value="flashes">Most Flashed</option>
                  <option value="title">Alphabetical</option>
                </select>
                <ChevronDown
                  size={12}
                  style={{
                    position: 'absolute',
                    right: 8,
                    top: '50%',
                    transform: 'translateY(-50%)',
                    pointerEvents: 'none',
                    color: 'var(--color-ink-tertiary)',
                  }}
                />
              </div>

              {/* 2. Difficulty / Level */}
              <div style={{ position: 'relative' }}>
                <select
                  value={selectedLevel === 0 ? 'all' : String(selectedLevel)}
                  onChange={(e) => handleSelectLevel(e.target.value === 'all' ? 0 : Number(e.target.value))}
                  style={{
                    appearance: 'none',
                    WebkitAppearance: 'none',
                    padding: '6px 26px 6px 12px',
                    fontSize: '12px',
                    fontWeight: selectedLevel !== 0 ? 700 : 500,
                    borderRadius: '6px',
                    border: selectedLevel !== 0 ? '1px solid var(--color-accent-light)' : '1px solid var(--color-border)',
                    backgroundColor: selectedLevel !== 0 ? 'var(--color-accent-muted)' : 'var(--color-surface)',
                    color: selectedLevel !== 0 ? 'var(--color-accent)' : 'var(--color-ink-primary)',
                    cursor: 'pointer',
                    outline: 'none',
                  }}
                >
                  <option value="all">All difficulties</option>
                  <option value="1">Beginner</option>
                  <option value="2">Intermediate</option>
                  <option value="3">Advanced</option>
                  <option value="4">Expert</option>
                </select>
                <ChevronDown
                  size={12}
                  style={{
                    position: 'absolute',
                    right: 8,
                    top: '50%',
                    transform: 'translateY(-50%)',
                    pointerEvents: 'none',
                    color: selectedLevel !== 0 ? 'var(--color-accent)' : 'var(--color-ink-tertiary)',
                  }}
                />
              </div>

              {/* 3. Topics / Categories */}
              <div style={{ position: 'relative' }}>
                <select
                  value={selectedTag}
                  onChange={(e) => handleSelectTag(e.target.value)}
                  style={{
                    appearance: 'none',
                    WebkitAppearance: 'none',
                    padding: '6px 26px 6px 12px',
                    fontSize: '12px',
                    fontWeight: selectedTag !== 'All' ? 700 : 500,
                    borderRadius: '6px',
                    border: selectedTag !== 'All' ? '1px solid var(--color-accent-light)' : '1px solid var(--color-border)',
                    backgroundColor: selectedTag !== 'All' ? 'var(--color-accent-muted)' : 'var(--color-surface)',
                    color: selectedTag !== 'All' ? 'var(--color-accent)' : 'var(--color-ink-primary)',
                    cursor: 'pointer',
                    outline: 'none',
                  }}
                >
                  <option value="All">All topics</option>
                  {allTags.filter((t) => t !== 'All').map((tag) => (
                    <option key={tag} value={tag}>
                      {tag}
                    </option>
                  ))}
                </select>
                <ChevronDown
                  size={12}
                  style={{
                    position: 'absolute',
                    right: 8,
                    top: '50%',
                    transform: 'translateY(-50%)',
                    pointerEvents: 'none',
                    color: selectedTag !== 'All' ? 'var(--color-accent)' : 'var(--color-ink-tertiary)',
                  }}
                />
              </div>

              {/* Clear Filters */}
              {(selectedLevel !== 0 || selectedTag !== 'All' || searchTerm) && (
                <button
                  type="button"
                  onClick={handleClearFilters}
                  style={{
                    background: 'none',
                    border: 'none',
                    padding: '4px 8px',
                    fontSize: '11.5px',
                    fontWeight: 600,
                    color: 'rgb(220, 38, 38)',
                    cursor: 'pointer',
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '3px',
                  }}
                >
                  <X size={12} /> Clear filters
                </button>
              )}
            </div>

            {/* Right: Search & View Toggle */}
            <div className="gallery-filter-search" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <div style={{ position: 'relative', width: 200 }}>
                <Search
                  size={13}
                  style={{
                    position: 'absolute',
                    left: 10,
                    top: '50%',
                    transform: 'translateY(-50%)',
                    color: 'var(--color-ink-tertiary)',
                  }}
                />
                <input
                  type="text"
                  value={searchTerm}
                  onChange={(e) => handleSearchChange(e.target.value)}
                  placeholder={`Search ${pageTitle.toLowerCase()}...`}
                  style={{
                    width: '100%',
                    padding: '5px 24px 5px 28px',
                    fontSize: '12px',
                    borderRadius: '6px',
                    border: '1px solid var(--color-border)',
                    backgroundColor: 'var(--color-surface)',
                    color: 'var(--color-ink-primary)',
                    outline: 'none',
                  }}
                />
                {searchTerm && (
                  <button
                    type="button"
                    onClick={() => handleSearchChange('')}
                    style={{
                      position: 'absolute',
                      right: 6,
                      top: '50%',
                      transform: 'translateY(-50%)',
                      background: 'none',
                      border: 'none',
                      cursor: 'pointer',
                      color: 'var(--color-ink-tertiary)',
                      display: 'flex',
                      alignItems: 'center',
                    }}
                  >
                    <X size={11} />
                  </button>
                )}
              </div>

              {/* View Switcher */}
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  backgroundColor: 'var(--color-surface)',
                  borderRadius: '6px',
                  border: '1px solid var(--color-border)',
                  padding: '2px',
                }}
              >
                <button
                  type="button"
                  onClick={() => setViewMode('grid')}
                  title="Grid View"
                  style={{
                    padding: '4px 7px',
                    border: 'none',
                    borderRadius: '4px',
                    backgroundColor: viewMode === 'grid' ? 'var(--color-paper)' : 'transparent',
                    color: viewMode === 'grid' ? 'var(--color-accent)' : 'var(--color-ink-tertiary)',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                  }}
                >
                  <LayoutGrid size={13} />
                </button>
                <button
                  type="button"
                  onClick={() => setViewMode('sections')}
                  title="Group by Level"
                  style={{
                    padding: '4px 7px',
                    border: 'none',
                    borderRadius: '4px',
                    backgroundColor: viewMode === 'sections' ? 'var(--color-paper)' : 'transparent',
                    color: viewMode === 'sections' ? 'var(--color-accent)' : 'var(--color-ink-tertiary)',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                  }}
                >
                  <List size={13} />
                </button>
              </div>
            </div>
          </div>

          {/* Projects Content: Clean, Immediate Hackster Grid */}
          {filteredItems.length === 0 ? (
            <div
              style={{
                padding: 'var(--space-12) var(--space-4)',
                textAlign: 'center',
                backgroundColor: 'var(--color-surface)',
                borderRadius: 'var(--radius-xl)',
                border: '1px dashed var(--color-border)',
              }}
            >
              <Search size={36} style={{ color: 'var(--color-ink-tertiary)', opacity: 0.5, margin: '0 auto var(--space-3)' }} />
              <h3 style={{ fontSize: 'var(--text-base)', fontWeight: 700, color: 'var(--color-ink-primary)', margin: '0 0 var(--space-1) 0' }}>
                No matching {pageTitle.toLowerCase()} found
              </h3>
              <p style={{ fontSize: 'var(--text-xs)', color: 'var(--color-ink-secondary)', maxWidth: 360, margin: '0 auto var(--space-4)' }}>
                Try selecting another difficulty or clearing active filters.
              </p>
              <button
                type="button"
                onClick={handleClearFilters}
                className="btn btn--secondary btn--sm"
              >
                Clear Filters
              </button>
            </div>
          ) : (isTutorialsMode && selectedLevel === 0 && !searchTerm.trim() && selectedTag === 'All') ? (
            /* 4 Tutorial Sections: Beginners, Inter, Advance, Expert (Each showing 4 tutorials, same as home page) */
            <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-12)' }}>
              {LEVEL_CONFIG.map((lvl) => {
                const sectionItems = baseItems.filter((p) => p.level === lvl.level);
                const displayItems = sectionItems.slice(0, 4);

                return (
                  <section key={lvl.level} id={`section-${lvl.name.toLowerCase()}`} aria-labelledby={`title-${lvl.level}`}>
                    {/* Header matching home page featured showcase style */}
                    <div
                      style={{
                        display: 'flex',
                        alignItems: 'baseline',
                        justifyContent: 'space-between',
                        marginBottom: 'var(--space-4)',
                        paddingBottom: 'var(--space-3)',
                        borderBottom: '1px solid var(--color-border)',
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <h2
                          id={`title-${lvl.level}`}
                          style={{
                            fontSize: 'var(--text-xl)',
                            fontWeight: 700,
                            color: 'var(--color-ink-primary)',
                            letterSpacing: '-0.02em',
                            margin: 0,
                          }}
                        >
                          {lvl.name}
                        </h2>
                        {sectionItems.length > 0 && (
                          <span
                            style={{
                              fontSize: '11px',
                              fontWeight: 700,
                              padding: '2px 7px',
                              borderRadius: 'var(--radius-full)',
                              backgroundColor: lvl.bg,
                              color: lvl.color,
                            }}
                          >
                            {sectionItems.length}
                          </span>
                        )}
                        <span style={{ fontSize: '12px', color: 'var(--color-ink-tertiary)', marginLeft: '4px' }}>
                          — {lvl.description}
                        </span>
                      </div>

                      <button
                        type="button"
                        onClick={() => handleSelectLevel(lvl.level)}
                        style={{
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '4px',
                          fontSize: 'var(--text-xs)',
                          fontWeight: 600,
                          color: lvl.color,
                          background: 'none',
                          border: 'none',
                          cursor: 'pointer',
                          padding: 0,
                        }}
                      >
                        <span>View All ({sectionItems.length})</span>
                        <ArrowRight size={13} aria-hidden="true" />
                      </button>
                    </div>

                    {/* 4-item showcase grid matching home page */}
                    {displayItems.length > 0 ? (
                      <div
                        className="featured-showcase-grid"
                        role="list"
                        aria-label={`${lvl.name} UNIHIKER K10 Tutorials`}
                      >
                        {displayItems.map((tutorial) => (
                          <div key={tutorial.id} role="listitem" style={{ height: '100%' }}>
                            <ProjectCard project={tutorial} isCurrentAuthor={isCurrentAuthor} />
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div
                        style={{
                          padding: 'var(--space-8) var(--space-4)',
                          textAlign: 'center',
                          backgroundColor: 'var(--color-surface)',
                          borderRadius: 'var(--radius-lg)',
                          border: '1px dashed var(--color-border)',
                        }}
                      >
                        <p style={{ fontSize: 'var(--text-xs)', color: 'var(--color-ink-secondary)', margin: '0 0 var(--space-2) 0' }}>
                          No {lvl.name.toLowerCase()} tutorials published yet.
                        </p>
                        {isAuthorOrAdmin ? (
                          <Link
                            to={`/project/new?type=tutorial`}
                            className="btn btn--secondary btn--sm"
                            style={{ fontSize: '11px', padding: '4px 10px', display: 'inline-flex', alignItems: 'center', gap: '4px' }}
                          >
                            <Plus size={12} /> Submit a {lvl.name} Tutorial
                          </Link>
                        ) : null}
                      </div>
                    )}
                  </section>
                );
              })}
            </div>
          ) : viewMode === 'sections' && selectedLevel === 0 ? (
            /* By Level Sections Mode (Only renders levels with projects!) */
            <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-8)' }}>
              {LEVEL_CONFIG.map((lvl) => {
                const levelItems = filteredItems.filter((p) => p.level === lvl.level);
                if (levelItems.length === 0) return null;
                return (
                  <section key={lvl.level} style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-3)' }}>
                    <div
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        paddingBottom: 'var(--space-2)',
                        borderBottom: `2px solid ${lvl.border}`,
                      }}
                    >
                      <div>
                        <h2 style={{ fontSize: 'var(--text-base)', fontWeight: 700, color: 'var(--color-ink-primary)', margin: 0 }}>
                          {lvl.name}
                        </h2>
                        <p style={{ fontSize: '11.5px', color: 'var(--color-ink-secondary)', margin: '1px 0 0 0' }}>
                          {lvl.description}
                        </p>
                      </div>

                      <button
                        type="button"
                        onClick={() => handleSelectLevel(lvl.level)}
                        className="btn btn--secondary btn--sm"
                        style={{
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '5px',
                          fontSize: '11.5px',
                          padding: '3px 10px',
                          borderColor: lvl.border,
                        }}
                      >
                        <span>View All</span>
                        <span
                          style={{
                            backgroundColor: 'var(--color-paper)',
                            borderRadius: 'var(--radius-full)',
                            padding: '1px 6px',
                            fontSize: '10px',
                            fontWeight: 700,
                          }}
                        >
                          {levelItems.length}
                        </span>
                        <ArrowRight size={12} />
                      </button>
                    </div>

                    <div
                      style={{
                        display: 'grid',
                        gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))',
                        gap: 'var(--space-6)',
                      }}
                    >
                      {levelItems.map((p) => (
                        <ProjectCard key={p.id} project={p} isCurrentAuthor={isCurrentAuthor} />
                      ))}
                    </div>
                  </section>
                );
              })}
            </div>
          ) : (
            /* Clean Hackster-style Grid */
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))',
                gap: 'var(--space-6)',
              }}
            >
              {filteredItems.map((p) => (
                <ProjectCard key={p.id} project={p} isCurrentAuthor={isCurrentAuthor} />
              ))}
            </div>
          )}

        </div>
      </main>

      <Footer />
    </div>
  );
}

