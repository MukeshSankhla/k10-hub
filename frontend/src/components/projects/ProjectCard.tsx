import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { Calendar, Zap, Star, Heart, Bookmark, MessageSquare } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { toast } from '../../contexts/ToastContext';
import { ProjectDetail } from '../../config/projectsData';
import { resolveProjectAuthor } from '../../services/projects/projectStorageService';
import { getLocalFlashCount } from '../../services/flasher/flashCountService';
import {
  getProjectLikeCount,
  isProjectLiked,
  toggleProjectLike,
  isProjectBookmarked,
  toggleProjectBookmark,
  getProjectCommentCount,
  subscribeCommunity,
} from '../../services/community/communityService';
import UserBadge, { isKnownAdmin } from '../common/UserBadge';

export function getLevelLabel(level: number | string | undefined): string {
  const num = Number(level);
  switch (num) {
    case 1:
      return 'Beginner';
    case 2:
      return 'Intermediate';
    case 3:
      return 'Advance';
    case 4:
      return 'Expert';
    default:
      return typeof level === 'string' && level ? level : 'Beginner';
  }
}

export interface ProjectCardProps {
  project: ProjectDetail;
  isCurrentAuthor?: (name: string, id?: string) => boolean;
}

/**
 * Standard UNIHIKER K10 Project/Tutorial Card
 * Shared across Homepage, Projects Gallery, and Tutorials Gallery.
 */
export default function ProjectCard({ project, isCurrentAuthor }: ProjectCardProps) {
  const { user, profile } = useAuth();
  const authorInfo = resolveProjectAuthor(project, user, profile);
  const isMine =
    authorInfo.isCurrentUser ||
    (isCurrentAuthor ? isCurrentAuthor(project.author, project.authorId) : false);
  const authorProfileUrl = isMine
    ? '/profile'
    : `/profile/${encodeURIComponent(authorInfo.authorId || authorInfo.name)}`;

  const isTutorial = project.type?.toLowerCase() === 'tutorial';
  const isFeatured = Boolean(project.featured || project.isFeatured);
  const flashes = Math.max(project.flashCount || 0, getLocalFlashCount(project.id));

  // Community state
  const uid = user?.id ? String(user.id) : undefined;
  const altUid = profile?.id ? String(profile.id) : undefined;

  const [likeCount, setLikeCount] = useState<number>(() => getProjectLikeCount(project.id));
  const [isLiked, setIsLiked] = useState<boolean>(() => isProjectLiked(project.id, uid || altUid));
  const [isBookmarked, setIsBookmarked] = useState<boolean>(() => isProjectBookmarked(project.id, uid, altUid));
  const [commentCount, setCommentCount] = useState<number>(() => getProjectCommentCount(project.id));

  useEffect(() => {
    const update = () => {
      setLikeCount(getProjectLikeCount(project.id));
      setIsLiked(isProjectLiked(project.id, uid || altUid));
      setIsBookmarked(isProjectBookmarked(project.id, uid, altUid));
      setCommentCount(getProjectCommentCount(project.id));
    };
    const unsub = subscribeCommunity(update);
    return unsub;
  }, [project.id, uid, altUid]);

  return (
    <div
      className="k10-project-card"
      style={{
        backgroundColor: 'var(--color-surface)',
        border: '1px solid var(--color-border)',
        borderRadius: '14px',
        overflow: 'hidden',
        display: 'flex',
        flexDirection: 'column',
        transition: 'transform 0.15s ease, box-shadow 0.15s ease',
        boxShadow: 'var(--shadow-sm)',
        position: 'relative',
        height: '100%',
      }}
    >
      {/* Cover Preview Image (4:3 Ratio) */}
      <Link
        to={`/project/${project.id}`}
        style={{ textDecoration: 'none', display: 'block' }}
        aria-label={`${project.title} — ${project.type || 'Project'}`}
      >
        <div
          style={{
            width: '100%',
            aspectRatio: '4 / 3',
            backgroundColor: '#0a0d14',
            backgroundImage: project.coverImage ? `url(${project.coverImage})` : undefined,
            backgroundSize: 'cover',
            backgroundPosition: 'center',
            position: 'relative',
            overflow: 'hidden',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          {!project.coverImage && (
            <span
              style={{
                fontSize: '11px',
                fontWeight: 700,
                color: 'rgba(255, 255, 255, 0.4)',
                letterSpacing: '0.1em',
                textTransform: 'uppercase',
              }}
            >
              UNIHIKER K10
            </span>
          )}

          {/* Top-Left Level Badge */}
          <div
            style={{
              position: 'absolute',
              top: 12,
              left: 12,
              backgroundColor: 'rgba(0, 0, 0, 0.75)',
              backdropFilter: 'blur(4px)',
              color: '#fff',
              fontSize: '10px',
              fontWeight: 700,
              padding: '3px 8px',
              borderRadius: '6px',
              textTransform: 'uppercase',
              zIndex: 2,
            }}
          >
            {getLevelLabel(project.level)}
          </div>

          {/* Bottom-Left Bookmark Button */}
          <button
            type="button"
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              const currentUserId = user?.id ? String(user.id) : (profile?.id ? String(profile.id) : undefined);
              const altUserId = profile?.id ? String(profile.id) : undefined;
              if (!currentUserId && !altUserId) {
                toast.warning('Please sign in to bookmark projects.', 'Sign In Required');
                return;
              }
              try {
                const bookmarked = toggleProjectBookmark(project.id, currentUserId, altUserId);
                setIsBookmarked(bookmarked);
                if (bookmarked) {
                  toast.success('Bookmarked! View in Profile.', 'Saved');
                } else {
                  toast.info('Removed bookmark.');
                }
              } catch (err: any) {
                toast.warning(err.message || 'Please sign in to bookmark projects.');
              }
            }}
            style={{
              position: 'absolute',
              bottom: 10,
              left: 10,
              zIndex: 3,
              backgroundColor: isBookmarked ? 'var(--color-accent)' : 'rgba(0, 0, 0, 0.65)',
              backdropFilter: 'blur(4px)',
              border: isBookmarked ? 'none' : '1px solid rgba(255, 255, 255, 0.25)',
              color: '#fff',
              borderRadius: '6px',
              width: 28,
              height: 28,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              cursor: 'pointer',
              transition: 'all 0.15s ease',
              boxShadow: '0 2px 6px rgba(0, 0, 0, 0.3)',
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.transform = 'scale(1.1)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.transform = 'scale(1)';
            }}
            title={isBookmarked ? 'Remove from bookmarks' : 'Bookmark this project'}
            aria-label={isBookmarked ? 'Remove from bookmarks' : 'Bookmark this project'}
          >
            <Bookmark size={14} fill={isBookmarked ? '#fff' : 'none'} />
          </button>

          {/* Bottom-Right Like Button (Same style as bookmark) */}
          <button
            type="button"
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              const currentUserId = user?.id || profile?.id;
              if (!currentUserId) {
                toast.warning('Please sign in to like projects.', 'Sign In Required');
                return;
              }
              try {
                const res = toggleProjectLike(project.id, String(currentUserId));
                setIsLiked(res.liked);
                setLikeCount(res.count);
                if (res.liked) {
                  toast.success('Liked project!', 'Success');
                }
              } catch (err: any) {
                toast.warning(err.message || 'Please sign in to like projects.');
              }
            }}
            style={{
              position: 'absolute',
              bottom: 10,
              right: 10,
              zIndex: 3,
              backgroundColor: isLiked ? '#ef4444' : 'rgba(0, 0, 0, 0.65)',
              backdropFilter: 'blur(4px)',
              border: isLiked ? 'none' : '1px solid rgba(255, 255, 255, 0.25)',
              color: '#fff',
              borderRadius: '6px',
              width: 28,
              height: 28,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              cursor: 'pointer',
              transition: 'all 0.15s ease',
              boxShadow: '0 2px 6px rgba(0, 0, 0, 0.3)',
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.transform = 'scale(1.1)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.transform = 'scale(1)';
            }}
            title={isLiked ? 'Unlike this project' : 'Like this project'}
            aria-label={isLiked ? 'Unlike this project' : 'Like this project'}
          >
            <Heart size={14} fill={isLiked ? '#fff' : 'none'} />
          </button>

          {/* Featured Pill if marked as featured (offset to avoid overlapping bottom-left bookmark) */}
          {isFeatured && (
            <div
              style={{
                position: 'absolute',
                bottom: 10,
                left: 44,
                backgroundColor: 'rgba(245, 158, 11, 0.95)',
                backdropFilter: 'blur(4px)',
                color: '#fff',
                fontSize: '9.5px',
                fontWeight: 700,
                padding: '2px 7px',
                borderRadius: '4px',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '3px',
                textTransform: 'uppercase',
                letterSpacing: '0.04em',
                zIndex: 2,
                boxShadow: '0 2px 6px rgba(0,0,0,0.25)',
              }}
            >
              <Star size={10} fill="#fff" /> Featured
            </div>
          )}

          {/* Diagonal Top-Right Corner Ribbon Indicator */}
          <div
            style={{
              position: 'absolute',
              top: 18,
              right: -34,
              width: 130,
              transform: 'rotate(45deg)',
              backgroundColor: isTutorial ? '#EAB308' : '#F59E0B',
              color: '#000000',
              fontSize: '10px',
              fontWeight: 800,
              letterSpacing: '0.08em',
              textTransform: 'uppercase',
              textAlign: 'center',
              padding: '4px 0',
              boxShadow: '0 2px 8px rgba(0, 0, 0, 0.3)',
              pointerEvents: 'none',
              zIndex: 3,
            }}
          >
            {project.type || 'Project'}
          </div>
        </div>
      </Link>

      {/* Card Content */}
      <div style={{ padding: 'var(--space-5)', display: 'flex', flexDirection: 'column', flex: 1 }}>
        <Link
          to={`/project/${project.id}`}
          style={{ textDecoration: 'none', color: 'inherit', display: 'block' }}
        >
          <h3
            style={{
              fontSize: 'var(--text-lg)',
              fontWeight: 700,
              color: 'var(--color-ink-primary)',
              margin: '0 0 var(--space-2) 0',
              lineHeight: 1.3,
            }}
          >
            {project.title}
          </h3>

          <p
            style={{
              fontSize: 'var(--text-xs)',
              color: 'var(--color-ink-secondary)',
              lineHeight: 1.5,
              margin: '0 0 var(--space-5) 0',
              display: '-webkit-box',
              WebkitLineClamp: 3,
              WebkitBoxOrient: 'vertical',
              overflow: 'hidden',
              flex: 1,
            }}
          >
            {project.description}
          </p>
        </Link>

        {/* Card Footer */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            paddingTop: 'var(--space-3)',
            borderTop: '1px solid var(--color-border)',
            marginTop: 'auto',
            gap: '8px',
          }}
        >
          {/* Clickable Author Profile Link */}
          <Link
            to={authorProfileUrl}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '6px',
              textDecoration: 'none',
              color: 'inherit',
              minWidth: 0,
              flexShrink: 1,
            }}
            title={isMine ? 'View your profile' : `View ${authorInfo.name}'s profile`}
          >
            {authorInfo.avatarUrl ? (
              <img
                src={authorInfo.avatarUrl}
                alt={authorInfo.name}
                style={{ width: 22, height: 22, borderRadius: '50%', objectFit: 'cover', flexShrink: 0 }}
              />
            ) : (
              <div
                style={{
                  width: 22,
                  height: 22,
                  borderRadius: '50%',
                  backgroundColor: 'var(--color-ink-primary)',
                  color: 'var(--color-paper)',
                  fontSize: '10px',
                  fontWeight: 700,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  flexShrink: 0,
                }}
              >
                {authorInfo.name.charAt(0)}
              </div>
            )}
            <span
              style={{
                fontSize: '11px',
                fontWeight: 600,
                color: 'var(--color-ink-primary)',
                maxWidth: 90,
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap',
              }}
            >
              {authorInfo.name}
            </span>
            <UserBadge
              role={
                isKnownAdmin({ name: authorInfo.name, role: authorInfo.role })
                  ? 'admin'
                  : authorInfo.role?.toLowerCase().includes('admin')
                  ? 'admin'
                  : authorInfo.role?.toLowerCase().includes('author') || authorInfo.isCurrentUser
                  ? 'author'
                  : 'user'
              }
              size={13}
            />
          </Link>

          {/* Metrics: Flashes, Likes, Comments, Date */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              flexShrink: 0,
              whiteSpace: 'nowrap',
            }}
          >
            <span
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '3px',
                fontSize: '11px',
                fontWeight: 600,
                color: 'var(--color-accent)',
              }}
              title={`${flashes} hardware flashes`}
            >
              <Zap size={11} fill="currentColor" />
              <span>{flashes}</span>
            </span>

            {/* Likes */}
            <button
              type="button"
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                const currentUserId = user?.id || profile?.id;
                if (!currentUserId) {
                  toast.warning('Please sign in to like projects.', 'Sign In Required');
                  return;
                }
                try {
                  const res = toggleProjectLike(project.id, String(currentUserId));
                  setIsLiked(res.liked);
                  setLikeCount(res.count);
                } catch (err: any) {
                  toast.warning(err.message || 'Please sign in to like projects.');
                }
              }}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '3px',
                fontSize: '11px',
                fontWeight: 600,
                color: isLiked ? '#ef4444' : 'var(--color-ink-tertiary)',
                background: 'none',
                border: 'none',
                padding: 0,
                cursor: 'pointer',
              }}
              title={isLiked ? 'Unlike' : 'Like'}
            >
              <Heart size={12} fill={isLiked ? '#ef4444' : 'none'} color={isLiked ? '#ef4444' : 'currentColor'} />
              <span>{likeCount}</span>
            </button>

            {/* Comments */}
            <Link
              to={`/project/${project.id}#discussion`}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '3px',
                fontSize: '11px',
                fontWeight: 500,
                color: 'var(--color-ink-tertiary)',
                textDecoration: 'none',
              }}
              title={`${commentCount} comments`}
            >
              <MessageSquare size={11} />
              <span>{commentCount}</span>
            </Link>

            <div
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '3px',
                fontSize: '11px',
                fontWeight: 500,
                color: 'var(--color-ink-tertiary)',
                whiteSpace: 'nowrap',
                flexShrink: 0,
              }}
              title={project.publishDate || 'Recent'}
            >
              <Calendar size={11} style={{ color: 'var(--color-ink-tertiary)', flexShrink: 0 }} />
              <span style={{ whiteSpace: 'nowrap' }}>
                {project.publishDate ? (project.publishDate.includes(',') ? project.publishDate.split(',')[0] : project.publishDate) : 'Recent'}
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
