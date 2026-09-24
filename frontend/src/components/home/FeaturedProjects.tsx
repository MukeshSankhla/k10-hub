import { useState, useEffect, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight, Plus } from 'lucide-react';
import { ProjectDetail } from '../../config/projectsData';
import {
  getPublicProjects,
  subscribeProjects,
  refreshProjectsFromBackend,
} from '../../services/projects/projectStorageService';
import ProjectCard from '../projects/ProjectCard';

export default function FeaturedProjects() {
  const [projects, setProjects] = useState<ProjectDetail[]>(() => getPublicProjects());

  useEffect(() => {
    setProjects(getPublicProjects());

    // Explicitly sync latest projects from backend SQLite database
    refreshProjectsFromBackend().then((fresh) => {
      if (fresh && fresh.length > 0) {
        setProjects(
          fresh.filter(
            (p) => (p.status === 'published' || !p.status) && (p.visibility === 'public' || !p.visibility)
          )
        );
      }
    }).catch(() => {});

    const unsubscribe = subscribeProjects((updated) => {
      setProjects(updated.filter((p) => (p.status === 'published' || !p.status) && (p.visibility === 'public' || !p.visibility)));
    });
    return unsubscribe;
  }, []);

  // Filter 4 most recent featured projects (non-tutorials)
  const featuredProjects = useMemo(() => {
    const list = projects.filter((p) => p.type?.toLowerCase() !== 'tutorial');
    const featured = list.filter((p) => p.featured || p.isFeatured);
    const regular = list.filter((p) => !p.featured && !p.isFeatured);
    return [...featured, ...regular].slice(0, 4);
  }, [projects]);

  // Filter 4 most recent featured tutorials
  const featuredTutorials = useMemo(() => {
    const list = projects.filter((p) => p.type?.toLowerCase() === 'tutorial');
    const featured = list.filter((p) => p.featured || p.isFeatured);
    const regular = list.filter((p) => !p.featured && !p.isFeatured);
    return [...featured, ...regular].slice(0, 4);
  }, [projects]);

  // If there are zero items overall, cleanly hide the showcase
  if (projects.length === 0) {
    return null;
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-12)', padding: 'var(--space-8) 0' }}>
      {/* ── Section 1: Featured Projects ─────────────────────────────────────── */}
      <section id="featured-projects" aria-labelledby="featured-projects-title">
        <div className="container">
          {/* Minimal, Simple Header */}
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
                id="featured-projects-title"
                style={{
                  fontSize: 'var(--text-xl)',
                  fontWeight: 700,
                  color: 'var(--color-ink-primary)',
                  letterSpacing: '-0.02em',
                  margin: 0,
                }}
              >
                Featured Projects
              </h2>
            </div>

            <Link
              to="/projects"
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '4px',
                fontSize: 'var(--text-xs)',
                fontWeight: 600,
                color: 'var(--color-accent)',
                textDecoration: 'none',
              }}
            >
              <span>View All</span>
              <ArrowRight size={13} aria-hidden="true" />
            </Link>
          </div>

          {/* Projects Grid (up to 4 items) */}
          {featuredProjects.length > 0 ? (
            <div
              className="featured-showcase-grid"
              role="list"
              aria-label="Featured UNIHIKER K10 Projects"
            >
              {featuredProjects.map((project, idx) => (
                <div key={project.id} role="listitem" style={{ height: '100%' }}>
                  <ProjectCard project={project} priority={idx < 4} />
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
                No projects published yet.
              </p>
              <Link
                to="/project/new"
                className="btn btn--secondary btn--sm"
                style={{ fontSize: '11px', padding: '4px 10px', display: 'inline-flex', alignItems: 'center', gap: '4px' }}
              >
                <Plus size={12} /> Submit a Project
              </Link>
            </div>
          )}
        </div>
      </section>

      {/* ── Section 2: Featured Tutorials ────────────────────────────────────── */}
      <section id="featured-tutorials" aria-labelledby="featured-tutorials-title">
        <div className="container">
          {/* Minimal, Simple Header */}
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
                id="featured-tutorials-title"
                style={{
                  fontSize: 'var(--text-xl)',
                  fontWeight: 700,
                  color: 'var(--color-ink-primary)',
                  letterSpacing: '-0.02em',
                  margin: 0,
                }}
              >
                Featured Tutorials
              </h2>
            </div>

            <Link
              to="/tutorials"
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '4px',
                fontSize: 'var(--text-xs)',
                fontWeight: 600,
                color: '#ca8a04',
                textDecoration: 'none',
              }}
            >
              <span>View All</span>
              <ArrowRight size={13} aria-hidden="true" />
            </Link>
          </div>

          {/* Tutorials Grid (up to 4 items) */}
          {featuredTutorials.length > 0 ? (
            <div
              className="featured-showcase-grid"
              role="list"
              aria-label="Featured UNIHIKER K10 Tutorials"
            >
              {featuredTutorials.map((tutorial, idx) => (
                <div key={tutorial.id} role="listitem" style={{ height: '100%' }}>
                  <ProjectCard project={tutorial} priority={idx < 2} />
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
                No tutorials published yet.
              </p>
              <Link
                to="/project/new?type=tutorial"
                className="btn btn--secondary btn--sm"
                style={{ fontSize: '11px', padding: '4px 10px', display: 'inline-flex', alignItems: 'center', gap: '4px' }}
              >
                <Plus size={12} /> Submit a Tutorial
              </Link>
            </div>
          )}
        </div>
      </section>
    </div>
  );
}
