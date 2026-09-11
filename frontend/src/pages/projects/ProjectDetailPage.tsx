import { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import Header from '../../components/layout/Header';
import Footer from '../../components/layout/Footer';
import WebFlasherPanel from '../../components/projects/WebFlasherPanel';
import ProjectDocumentation from '../../components/projects/ProjectDocumentation';
import { ProjectDetail } from '../../config/projectsData';
import { useAuth } from '../../contexts/AuthContext';
import {
  Github,
  ExternalLink,
  Award,
  ChevronRight,
  Share2,
  Flame,
  Cpu,
  Edit3,
  Video,
  AlertCircle,
  Clock,
  Star,
  Heart,
  Bookmark,
  MessageSquare,
} from 'lucide-react';
import ProjectCommentsSection from '../../components/community/ProjectCommentsSection';
import {
  getProjectLikeCount,
  isProjectLiked,
  toggleProjectLike,
  isProjectBookmarked,
  toggleProjectBookmark,
  getProjectCommentCount,
  subscribeCommunity,
} from '../../services/community/communityService';
import { subscribeProjectFlashCount } from '../../services/flasher/flashCountService';
import {
  getProjectById as getStoredProjectById,
  subscribeProjects,
  parseVideoEmbedUrl,
  isProjectAuthor,
  toggleFeaturedProject,
  resolveProjectAuthor,
} from '../../services/projects/projectStorageService';
import UserBadge from '../../components/common/UserBadge';
import { toast } from '../../contexts/ToastContext';

export default function ProjectDetailPage() {
  const { id } = useParams<{ id: string }>();
  const { user, profile, role } = useAuth();

  const [currentProject, setCurrentProject] = useState<ProjectDetail | undefined>(() =>
    id ? getStoredProjectById(id) : undefined
  );

  // Sync with project storage updates
  useEffect(() => {
    if (id) {
      const found = getStoredProjectById(id);
      setCurrentProject(found);
    }
    const unsubStorage = subscribeProjects(() => {
      if (id) {
        const updated = getStoredProjectById(id);
        setCurrentProject(updated);
      }
    });
    return () => unsubStorage();
  }, [id]);

  const [flashCount, setFlashCount] = useState<number>(() => currentProject?.flashCount || 0);
  const [copiedLink, setCopiedLink] = useState(false);

  const uid = user?.id ? String(user.id) : undefined;
  const altUid = profile?.id ? String(profile.id) : undefined;

  // Community state (Likes, Bookmarks, Comments)
  const [likeCount, setLikeCount] = useState<number>(() =>
    id ? getProjectLikeCount(id) : 0
  );
  const [isLiked, setIsLiked] = useState<boolean>(() =>
    id ? isProjectLiked(id, uid || altUid) : false
  );
  const [isBookmarked, setIsBookmarked] = useState<boolean>(() =>
    id ? isProjectBookmarked(id, uid, altUid) : false
  );
  const [commentCount, setCommentCount] = useState<number>(() =>
    id ? getProjectCommentCount(id) : 0
  );

  // Sync community state
  useEffect(() => {
    if (!id) return;
    const updateStats = () => {
      setLikeCount(getProjectLikeCount(id));
      setIsLiked(isProjectLiked(id, uid || altUid));
      setIsBookmarked(isProjectBookmarked(id, uid, altUid));
      setCommentCount(getProjectCommentCount(id));
    };
    updateStats();
    const unsubCommunity = subscribeCommunity(updateStats);
    return () => unsubCommunity();
  }, [id, uid, altUid]);

  // Subscribe to real-time Firestore flash count
  useEffect(() => {
    if (!currentProject?.id) return;
    const unsubscribe = subscribeProjectFlashCount(currentProject.id, (count) => {
      if (typeof count === 'number') {
        setFlashCount(count);
      }
    });
    return () => unsubscribe();
  }, [currentProject?.id]);

  if (!currentProject) {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column', backgroundColor: 'var(--color-paper)' }}>
        <Header />
        <main style={{ flex: 1, paddingTop: 'calc(var(--nav-height) + var(--space-12))', paddingBottom: 'var(--space-16)' }}>
          <div className="container" style={{ maxWidth: 600, textAlign: 'center' }}>
            <Cpu size={48} style={{ color: 'var(--color-ink-tertiary)', margin: '0 auto var(--space-4)' }} />
            <h1 style={{ fontSize: 'var(--text-2xl)', fontWeight: 700, color: 'var(--color-ink-primary)', marginBottom: 'var(--space-2)' }}>
              Project Not Found
            </h1>
            <p style={{ color: 'var(--color-ink-secondary)', fontSize: 'var(--text-sm)', marginBottom: 'var(--space-6)' }}>
              The project or tutorial you are looking for does not exist or may have been deleted.
            </p>
            <Link to="/projects" className="btn btn--primary">
              Browse Projects Gallery
            </Link>
          </div>
        </main>
        <Footer />
      </div>
    );
  }

  const project = currentProject;
  const isAuthor = isProjectAuthor(project, user, profile);
  const canEdit = (role === 'author' || role === 'admin') && isAuthor;
  const parsedVideo = parseVideoEmbedUrl(project.videoLink);
  const authorInfo = resolveProjectAuthor(project, user, profile);
  const isMine =
    authorInfo.isCurrentUser ||
    (project.authorEmail && (project.authorEmail.toLowerCase() === (profile?.email || user?.email || '').toLowerCase())) ||
    (project.authorId && (String(project.authorId).toLowerCase() === String(profile?.id || user?.id || '').toLowerCase()));
  const authorProfileUrl = isMine
    ? '/profile'
    : `/profile/${encodeURIComponent(authorInfo.authorId || authorInfo.name)}`;

  const handleFlashSuccess = () => {
    setFlashCount((prev) => prev + 1);
  };

  const handleShare = () => {
    if (navigator.clipboard) {
      navigator.clipboard.writeText(window.location.href).then(() => {
        setCopiedLink(true);
        toast.success('Project link copied to clipboard!');
        setTimeout(() => setCopiedLink(false), 1500);
      });
    }
  };

  const handleToggleLike = () => {
    if (!currentProject) return;
    const currentUserId = user?.id || profile?.id;
    if (!currentUserId) {
      toast.warning('Please sign in to like this project.', 'Sign In Required');
      return;
    }
    try {
      const res = toggleProjectLike(currentProject.id, String(currentUserId));
      setIsLiked(res.liked);
      setLikeCount(res.count);
      if (res.liked) {
        toast.success('Liked! Added to your appreciated builds.');
      }
    } catch (err: any) {
      toast.warning(err.message || 'Please sign in to like projects.');
    }
  };

  const handleToggleBookmark = () => {
    if (!currentProject) return;
    const currentUserId = user?.id ? String(user.id) : (profile?.id ? String(profile.id) : undefined);
    const altUserId = profile?.id ? String(profile.id) : undefined;
    if (!currentUserId && !altUserId) {
      toast.warning('Please sign in to bookmark projects.', 'Sign In Required');
      return;
    }
    try {
      const bookmarked = toggleProjectBookmark(currentProject.id, currentUserId, altUserId);
      setIsBookmarked(bookmarked);
      if (bookmarked) {
        toast.success('Project bookmarked! View it anytime in your Profile.', 'Saved to Bookmarks');
      } else {
        toast.info('Removed from bookmarks.');
      }
    } catch (err: any) {
      toast.warning(err.message || 'Please sign in to bookmark projects.');
    }
  };

  return (
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column', backgroundColor: 'var(--color-paper)' }}>
      <Header />

      {/* Main container with nav-height padding-top to prevent top cutoff under fixed navbar */}
      <main style={{ flex: 1, paddingTop: 'calc(var(--nav-height) + var(--space-6))', paddingBottom: 'var(--space-16)' }}>
        <div className="container">
          
          {/* Breadcrumbs */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              fontSize: 'var(--text-xs)',
              color: 'var(--color-ink-tertiary)',
              marginBottom: 'var(--space-5)',
            }}
          >
            <Link to="/" style={{ color: 'var(--color-ink-secondary)', textDecoration: 'none' }}>
              Home
            </Link>
            <ChevronRight size={13} />
            <Link to="/projects" style={{ color: 'var(--color-ink-secondary)', textDecoration: 'none' }}>
              Projects
            </Link>
            <ChevronRight size={13} />
            <span style={{ color: 'var(--color-ink-primary)', fontWeight: 600 }}>{project.title}</span>
          </div>

          {/* Moderation Status Banner for Non-Published Projects */}
          {project.status && project.status !== 'published' && (
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                flexWrap: 'wrap',
                gap: 'var(--space-3)',
                padding: '12px 18px',
                borderRadius: '12px',
                marginBottom: 'var(--space-6)',
                backgroundColor:
                  project.status === 'pending_approval'
                    ? 'rgba(234, 179, 8, 0.1)'
                    : project.status === 'rejected'
                    ? 'rgba(239, 68, 68, 0.1)'
                    : 'rgba(100, 116, 139, 0.1)',
                border:
                  project.status === 'pending_approval'
                    ? '1px solid rgba(234, 179, 8, 0.3)'
                    : project.status === 'rejected'
                    ? '1px solid rgba(239, 68, 68, 0.3)'
                    : '1px solid rgba(100, 116, 139, 0.3)',
                color:
                  project.status === 'pending_approval'
                    ? '#ca8a04'
                    : project.status === 'rejected'
                    ? 'rgb(220, 38, 38)'
                    : 'var(--color-ink-secondary)',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)' }}>
                {project.status === 'pending_approval' ? (
                  <AlertCircle size={18} />
                ) : project.status === 'rejected' ? (
                  <AlertCircle size={18} />
                ) : (
                  <Clock size={18} />
                )}
                <div>
                  <span style={{ fontWeight: 700, fontSize: 'var(--text-xs)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                    {project.status === 'pending_approval'
                      ? 'Pending Admin Verification'
                      : project.status === 'rejected'
                      ? 'Verification Rejected'
                      : 'Draft Preview'}
                  </span>
                  <span style={{ fontSize: '12px', marginLeft: '8px', opacity: 0.9 }}>
                    {project.status === 'pending_approval'
                      ? 'This project is under administrator review before publication to the catalog.'
                      : project.status === 'rejected'
                      ? 'This project was not approved by administrators. Please review and update details.'
                      : 'This project is saved as a private draft. Only you and administrators can view it.'}
                  </span>
                </div>
              </div>

              {isAuthor && (
                <Link
                  to={`/project/${project.id}/edit`}
                  className="btn btn--secondary btn--sm"
                  style={{ fontSize: '11px', padding: '4px 12px' }}
                >
                  Edit Details
                </Link>
              )}
            </div>
          )}

          {/* ══════════════════════════════════════════════════════════════════ */}
          {/* HERO SECTION                                                       */}
          {/* ══════════════════════════════════════════════════════════════════ */}
          {/* Project Hero Header Card */}
          <section
            style={{
              backgroundColor: 'var(--color-surface)',
              border: '1px solid var(--color-border)',
              borderRadius: '16px',
              padding: 'clamp(var(--space-6), 3vw, var(--space-8))',
              boxShadow: '0 4px 20px -4px rgba(0, 0, 0, 0.05)',
              marginBottom: 'var(--space-8)',
              position: 'relative',
              overflow: 'hidden',
              background: 'linear-gradient(180deg, var(--color-surface) 0%, #FAFAF8 100%)',
            }}
          >
            <div className="project-hero-grid">
              {/* Hero Left: Aligned to Top and Bottom Extremes */}
              <div
                style={{
                  display: 'flex',
                  flexDirection: 'column',
                  justifyContent: 'space-between',
                  height: '100%',
                  minWidth: 0,
                }}
              >
                {/* Top Extreme Block: Badges, Title, Description */}
                <div>
                  {/* Badges Row (Refined Gentle Rounded Styles) */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap', marginBottom: 'var(--space-3)' }}>
                    {/* Type Badge */}
                    <span
                      style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '5px',
                        fontSize: '11px',
                        fontWeight: 700,
                        textTransform: 'uppercase',
                        letterSpacing: '0.06em',
                        padding: '3px 10px',
                        borderRadius: '6px',
                        backgroundColor: 'var(--color-paper)',
                        border: '1px solid var(--color-border)',
                        color: 'var(--color-ink-primary)',
                      }}
                    >
                      <Cpu size={13} style={{ color: 'var(--color-accent)' }} />
                      <span>{project.type || 'Project'}</span>
                    </span>

                    {/* Level / Difficulty Badge */}
                    {(() => {
                      const lvlNum = Number(project.level) || 1;
                      const LEVEL_MAP: Record<number, { name: string; color: string; bg: string; border: string }> = {
                        1: {
                          name: 'Beginner',
                          color: '#16a34a',
                          bg: 'rgba(22, 163, 74, 0.08)',
                          border: 'rgba(22, 163, 74, 0.25)',
                        },
                        2: {
                          name: 'Intermediate',
                          color: '#0284c7',
                          bg: 'rgba(2, 132, 199, 0.08)',
                          border: 'rgba(2, 132, 199, 0.25)',
                        },
                        3: {
                          name: 'Advanced',
                          color: '#7c3aed',
                          bg: 'rgba(124, 58, 237, 0.08)',
                          border: 'rgba(124, 58, 237, 0.25)',
                        },
                        4: {
                          name: 'Expert',
                          color: '#ea580c',
                          bg: 'rgba(234, 88, 12, 0.08)',
                          border: 'rgba(234, 88, 12, 0.25)',
                        },
                      };

                      const lvlInfo = LEVEL_MAP[lvlNum] || {
                        name: typeof project.level === 'string' && project.level ? project.level : 'Beginner',
                        color: '#0284c7',
                        bg: 'rgba(2, 132, 199, 0.08)',
                        border: 'rgba(2, 132, 199, 0.25)',
                      };

                      return (
                        <span
                          style={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '5px',
                            fontSize: '11px',
                            fontWeight: 600,
                            padding: '3px 10px',
                            borderRadius: '6px',
                            backgroundColor: lvlInfo.bg,
                            border: `1px solid ${lvlInfo.border}`,
                            color: lvlInfo.color,
                          }}
                        >
                          <Award size={13} />
                          <span>{lvlInfo.name}</span>
                        </span>
                      );
                    })()}

                    {/* Flash Count Badge */}
                    <span
                      style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '5px',
                        fontSize: '11px',
                        fontWeight: 700,
                        padding: '3px 10px',
                        borderRadius: '6px',
                        backgroundColor: 'var(--color-accent-muted)',
                        border: '1px solid var(--color-accent-light)',
                        color: 'var(--color-accent)',
                      }}
                    >
                      <Flame size={13} />
                      <span>{flashCount} Flashes</span>
                    </span>

                    {/* Featured Status Badge if project is featured */}
                    {(project.featured || project.isFeatured) && (
                      <span
                        style={{
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '5px',
                          fontSize: '11px',
                          fontWeight: 700,
                          padding: '3px 10px',
                          borderRadius: '6px',
                          backgroundColor: 'rgba(245, 158, 11, 0.12)',
                          border: '1px solid rgba(245, 158, 11, 0.35)',
                          color: '#d97706',
                        }}
                      >
                        <Star size={13} fill="#f59e0b" color="#f59e0b" />
                        <span>Featured</span>
                      </span>
                    )}
                  </div>

                  {/* Main Title */}
                  <h1
                    style={{
                      fontSize: 'clamp(var(--text-2xl), 3vw, var(--text-4xl))',
                      fontWeight: 800,
                      letterSpacing: '-0.025em',
                      lineHeight: 1.2,
                      color: 'var(--color-ink-primary)',
                      margin: '0 0 var(--space-3) 0',
                    }}
                  >
                    {project.title}
                  </h1>

                  {/* Quick Description */}
                  <p
                    style={{
                      fontSize: 'var(--text-base)',
                      lineHeight: 1.65,
                      color: 'var(--color-ink-secondary)',
                      margin: 0,
                      maxWidth: 620,
                    }}
                  >
                    {project.description}
                  </p>

                  {/* Creator Byline & Published Date */}
                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '10px',
                      marginTop: 'var(--space-4)',
                      flexWrap: 'wrap',
                    }}
                  >
                    <Link
                      to={authorProfileUrl}
                      style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '8px',
                        textDecoration: 'none',
                        color: 'var(--color-ink-primary)',
                      }}
                      title={isMine ? 'View your profile' : `View ${authorInfo.name}'s profile`}
                    >
                      {authorInfo.avatarUrl ? (
                        <img
                          src={authorInfo.avatarUrl}
                          alt={authorInfo.name}
                          style={{
                            width: 24,
                            height: 24,
                            borderRadius: '50%',
                            objectFit: 'cover',
                            display: 'block',
                          }}
                        />
                      ) : (
                        <span
                          style={{
                            width: 24,
                            height: 24,
                            borderRadius: '50%',
                            backgroundColor: 'var(--color-ink-primary)',
                            color: '#fff',
                            fontSize: '11px',
                            fontWeight: 700,
                            display: 'inline-flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                          }}
                        >
                          {authorInfo.name.charAt(0)}
                        </span>
                      )}
                      <span style={{ fontSize: '13.5px', fontWeight: 600 }}>{authorInfo.name}</span>
                      <UserBadge
                        role={
                          authorInfo.role?.toLowerCase().includes('admin')
                            ? 'admin'
                            : authorInfo.role?.toLowerCase().includes('author') || authorInfo.isCurrentUser
                            ? 'author'
                            : 'user'
                        }
                        size={14}
                      />
                    </Link>

                    {project.publishDate && (
                      <>
                        <span style={{ color: 'var(--color-border)', userSelect: 'none' }}>•</span>
                        <span style={{ fontSize: '12.5px', color: 'var(--color-ink-tertiary)', display: 'inline-flex', alignItems: 'center', gap: '5px' }}>
                          <Clock size={13} /> Published {project.publishDate}
                        </span>
                      </>
                    )}
                  </div>
                </div>

                {/* Bottom Actions Row: Arranged by Relevance and Aligned */}
                {(() => {
                  const heroBtnStyle: React.CSSProperties = {
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '0.45rem',
                    height: '36px',
                    padding: '0 13px',
                    fontSize: '13px',
                    fontWeight: 500,
                    borderRadius: '8px',
                    boxSizing: 'border-box',
                    textDecoration: 'none',
                    cursor: 'pointer',
                  };

                  const heroIconBtnStyle: React.CSSProperties = {
                    display: 'inline-flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    width: '36px',
                    height: '36px',
                    padding: 0,
                    borderRadius: '8px',
                    boxSizing: 'border-box',
                    textDecoration: 'none',
                    cursor: 'pointer',
                    transition: 'all 0.15s ease',
                  };

                  return (
                    <div
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        gap: 'var(--space-3)',
                        flexWrap: 'wrap',
                        marginTop: 'var(--space-6)',
                        paddingTop: 'var(--space-4)',
                        borderTop: '1px solid var(--color-border)',
                      }}
                    >
                      {/* Left: Project Links & Management */}
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                        {project.githubLink && (
                          <a
                            href={project.githubLink}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="btn btn--secondary"
                            style={heroBtnStyle}
                          >
                            <Github size={15} />
                            <span>GitHub Source</span>
                          </a>
                        )}

                        {project.docLink && (
                          <a
                            href={project.docLink}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="btn btn--secondary"
                            style={heroBtnStyle}
                          >
                            <ExternalLink size={15} />
                            <span>Project Guide</span>
                          </a>
                        )}

                        {canEdit && (
                          <Link
                            to={`/project/${project.id}/edit`}
                            className="btn btn--secondary"
                            title="Edit Project / Tutorial"
                            style={heroBtnStyle}
                          >
                            <Edit3 size={14} />
                            <span>Edit {project.type || 'Project'}</span>
                          </Link>
                        )}

                        {role === 'admin' && (
                          <button
                            type="button"
                            onClick={() => {
                              toggleFeaturedProject(project.id);
                              setCurrentProject(getStoredProjectById(project.id));
                            }}
                            className="btn btn--secondary"
                            style={{
                              ...heroBtnStyle,
                              color: (project.featured || project.isFeatured) ? '#d97706' : 'var(--color-ink-secondary)',
                              backgroundColor: (project.featured || project.isFeatured) ? 'rgba(245, 158, 11, 0.12)' : undefined,
                              borderColor: (project.featured || project.isFeatured) ? 'rgba(245, 158, 11, 0.4)' : undefined,
                            }}
                            title={(project.featured || project.isFeatured) ? 'Unfeature this project' : 'Feature this project on Home'}
                          >
                            <Star size={14} fill={(project.featured || project.isFeatured) ? '#f59e0b' : 'none'} color={(project.featured || project.isFeatured) ? '#f59e0b' : 'currentColor'} />
                            <span>{(project.featured || project.isFeatured) ? 'Featured' : 'Feature'}</span>
                          </button>
                        )}
                      </div>

                      {/* Right: Community & Social Icon Buttons (Like, Comment, Bookmark, Share) */}
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                        {/* Like Icon Button */}
                        <button
                          type="button"
                          onClick={handleToggleLike}
                          className="btn btn--secondary"
                          title={isLiked ? `Unlike (${likeCount})` : `Like (${likeCount})`}
                          aria-label={isLiked ? 'Unlike this project' : 'Like this project'}
                          style={{
                            ...heroIconBtnStyle,
                            ...(likeCount > 0 ? { width: 'auto', padding: '0 9px', gap: '5px' } : {}),
                            color: isLiked ? '#ef4444' : 'var(--color-ink-primary)',
                            backgroundColor: isLiked ? 'rgba(239, 68, 68, 0.08)' : undefined,
                            borderColor: isLiked ? 'rgba(239, 68, 68, 0.35)' : undefined,
                          }}
                        >
                          <Heart size={16} fill={isLiked ? '#ef4444' : 'none'} color={isLiked ? '#ef4444' : 'currentColor'} />
                          {likeCount > 0 && <span style={{ fontSize: '12px', fontWeight: 600 }}>{likeCount}</span>}
                        </button>

                        {/* Comment Icon Button */}
                        <a
                          href="#discussion"
                          className="btn btn--secondary"
                          title={`Discussion (${commentCount} ${commentCount === 1 ? 'comment' : 'comments'})`}
                          aria-label="Jump to community discussion"
                          style={{
                            ...heroIconBtnStyle,
                            ...(commentCount > 0 ? { width: 'auto', padding: '0 9px', gap: '5px' } : {}),
                          }}
                        >
                          <MessageSquare size={16} />
                          {commentCount > 0 && <span style={{ fontSize: '12px', fontWeight: 600 }}>{commentCount}</span>}
                        </a>

                        {/* Bookmark Icon Button */}
                        <button
                          type="button"
                          onClick={handleToggleBookmark}
                          className="btn btn--secondary"
                          title={isBookmarked ? 'Remove from bookmarks' : 'Bookmark this project'}
                          aria-label={isBookmarked ? 'Remove bookmark' : 'Bookmark project'}
                          style={{
                            ...heroIconBtnStyle,
                            color: isBookmarked ? 'var(--color-accent)' : 'var(--color-ink-primary)',
                            backgroundColor: isBookmarked ? 'var(--color-accent-muted)' : undefined,
                            borderColor: isBookmarked ? 'var(--color-accent-light)' : undefined,
                          }}
                        >
                          <Bookmark size={16} fill={isBookmarked ? 'var(--color-accent)' : 'none'} color={isBookmarked ? 'var(--color-accent)' : 'currentColor'} />
                        </button>

                        {/* Share Icon Button */}
                        <button
                          type="button"
                          onClick={handleShare}
                          className="btn btn--secondary"
                          title={copiedLink ? 'Link Copied!' : 'Share this project'}
                          aria-label="Share this project"
                          style={{
                            ...heroIconBtnStyle,
                            color: copiedLink ? 'var(--color-accent)' : undefined,
                            borderColor: copiedLink ? 'var(--color-accent)' : undefined,
                          }}
                        >
                          <Share2 size={16} />
                        </button>
                      </div>
                    </div>
                  );
                })()}
              </div>

              {/* Hero Right: Cover Image (4:3 Ratio, height 100% matching Left Extreme) */}
              <div style={{ display: 'flex', alignItems: 'stretch', justifyContent: 'center', height: '100%' }}>
                <div
                  style={{
                    position: 'relative',
                    width: '100%',
                    height: '100%',
                    minHeight: 340,
                    aspectRatio: '4 / 3',
                    borderRadius: '12px',
                    overflow: 'hidden',
                    border: '1px solid var(--color-border)',
                    boxShadow: '0 8px 24px -4px rgba(0, 0, 0, 0.12)',
                    backgroundColor: '#000',
                  }}
                >
                  <img
                    src={project.coverImage}
                    alt={project.title}
                    style={{
                      width: '100%',
                      height: '100%',
                      objectFit: 'cover',
                      display: 'block',
                    }}
                  />
                </div>
              </div>
            </div>
          </section>

          {/* ══════════════════════════════════════════════════════════════════ */}
          {/* BODY: 3 COLUMNS (2 for Markdown Document, 1 for Firmware Flashing) */}
          {/* ══════════════════════════════════════════════════════════════════ */}
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'minmax(0, 2fr) minmax(320px, 1fr)',
              gap: 'var(--space-8)',
              alignItems: 'start',
            }}
          >
            {/* 2 COLUMNS: Video Embed & Markdown Document */}
            <div style={{ minWidth: 0 }}>
              {/* Video Integration Player Embed */}
              {parsedVideo && (
                <div
                  style={{
                    marginBottom: 'var(--space-6)',
                    backgroundColor: 'var(--color-surface)',
                    borderRadius: '16px',
                    border: '1px solid var(--color-border)',
                    overflow: 'hidden',
                    boxShadow: 'var(--shadow-sm)',
                  }}
                >
                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      padding: '10px 16px',
                      backgroundColor: 'var(--color-paper)',
                      borderBottom: '1px solid var(--color-border)',
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <Video size={16} color="var(--color-accent)" />
                      <span style={{ fontSize: '11px', fontWeight: 700, color: 'var(--color-ink-primary)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                        Video Demonstration & Guide
                      </span>
                    </div>
                    {project.videoLink && (
                      <a
                        href={project.videoLink}
                        target="_blank"
                        rel="noopener noreferrer"
                        style={{ fontSize: '11px', color: 'var(--color-ink-tertiary)', display: 'flex', alignItems: 'center', gap: '4px', textDecoration: 'none' }}
                      >
                        External Link <ExternalLink size={11} />
                      </a>
                    )}
                  </div>

                  <div style={{ position: 'relative', width: '100%', aspectRatio: '16 / 9', backgroundColor: '#000' }}>
                    {parsedVideo.type === 'youtube' || parsedVideo.type === 'vimeo' ? (
                      <iframe
                        src={parsedVideo.embedUrl}
                        title={`${project.title} Video Player`}
                        allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
                        allowFullScreen
                        style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', border: 'none' }}
                      />
                    ) : (
                      <video
                        src={parsedVideo.embedUrl}
                        controls
                        style={{ width: '100%', height: '100%', objectFit: 'contain' }}
                      />
                    )}
                  </div>
                </div>
              )}

              <ProjectDocumentation project={project} />
              <ProjectCommentsSection project={project} />
            </div>

            {/* 1 COLUMN: Firmware Flashing Station */}
            <div id="flasher-station" style={{ minWidth: 0 }}>
              <WebFlasherPanel project={project} onFlashSuccess={handleFlashSuccess} />
            </div>
          </div>
        </div>
      </main>

      <Footer />
    </div>
  );
}
