// ProjectCommentsSection.tsx
// Reddit-style nested community discussion thread for UNIHIKER K10 Projects & Tutorials.

import { useState, useEffect, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { toast } from '../../contexts/ToastContext';
import { ProjectDetail } from '../../config/projectsData';
import {
  ProjectComment,
  CommentTreeNode,
  buildCommentTree,
  getProjectComments,
  addComment,
  voteComment,
  deleteComment,
  subscribeCommunity,
} from '../../services/community/communityService';
import UserBadge from '../common/UserBadge';
import {
  MessageSquare,
  ChevronUp,
  ChevronDown,
  Reply,
  Trash2,
  Send,
  CornerDownRight,
  MinusSquare,
  PlusSquare,
  Sparkles,
} from 'lucide-react';

interface ProjectCommentsSectionProps {
  project: ProjectDetail;
}

function timeAgo(dateString: string): string {
  try {
    const d = new Date(dateString);
    const now = new Date();
    const diffMs = now.getTime() - d.getTime();
    const diffSec = Math.floor(diffMs / 1000);
    if (diffSec < 60) return 'just now';
    const diffMin = Math.floor(diffSec / 60);
    if (diffMin < 60) return `${diffMin}m ago`;
    const diffHours = Math.floor(diffMin / 60);
    if (diffHours < 24) return `${diffHours}h ago`;
    const diffDays = Math.floor(diffHours / 24);
    if (diffDays < 30) return `${diffDays}d ago`;
    return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  } catch (e) {
    return 'recently';
  }
}

export default function ProjectCommentsSection({ project }: ProjectCommentsSectionProps) {
  const { user, profile, role } = useAuth();
  const [comments, setComments] = useState<ProjectComment[]>(() => getProjectComments(project.id));
  const [sortBy, setSortBy] = useState<'top' | 'newest' | 'oldest'>('top');
  const [rootContent, setRootContent] = useState('');
  const [isSubmittingRoot, setIsSubmittingRoot] = useState(false);

  // Sync with community updates
  useEffect(() => {
    setComments(getProjectComments(project.id));
    const unsubscribe = subscribeCommunity(() => {
      setComments(getProjectComments(project.id));
    });
    return unsubscribe;
  }, [project.id]);

  const currentAuthorName =
    profile?.name ||
    user?.user_metadata?.name ||
    (user?.email ? user.email.split('@')[0] : 'Maker');
  const currentAuthorAvatar =
    profile?.avatarUrl ||
    user?.user_metadata?.avatar_url;
  const currentAuthorRole = role || 'user';
  const currentAuthorId = user?.id || profile?.id;
  const currentAuthorEmail = profile?.email || user?.email;

  // Handler for adding top-level comment
  const handleAddRootComment = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!currentAuthorId) {
      toast.warning('Please sign in to post comments.', 'Sign In Required');
      return;
    }
    if (!rootContent.trim()) {
      toast.warning('Please enter a comment before posting.');
      return;
    }

    setIsSubmittingRoot(true);
    try {
      addComment(project.id, rootContent, null, {
        name: currentAuthorName,
        email: currentAuthorEmail,
        avatar: currentAuthorAvatar,
        role: currentAuthorRole,
        id: String(currentAuthorId),
      });
      setRootContent('');
      toast.success('Comment posted to discussion!');
    } catch (err: any) {
      toast.error(err.message || 'Failed to post comment.');
    } finally {
      setIsSubmittingRoot(false);
    }
  };

  // Build and sort tree
  const treeNodes = useMemo(() => {
    const list = [...comments];
    if (sortBy === 'top') {
      list.sort((a, b) => b.score - a.score || new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
    } else if (sortBy === 'newest') {
      list.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
    } else {
      list.sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());
    }
    return buildCommentTree(list);
  }, [comments, sortBy]);

  const activeCommentsCount = comments.filter((c) => !c.isDeleted).length;

  return (
    <div
      id="discussion"
      style={{
        marginTop: 'var(--space-10)',
        backgroundColor: 'var(--color-surface)',
        border: '1px solid var(--color-border)',
        borderRadius: '16px',
        padding: 'clamp(var(--space-6), 3vw, var(--space-8))',
        boxShadow: 'var(--shadow-sm)',
      }}
    >
      {/* Header bar */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexWrap: 'wrap',
          gap: 'var(--space-4)',
          borderBottom: '1px solid var(--color-border)',
          paddingBottom: 'var(--space-4)',
          marginBottom: 'var(--space-6)',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <div
            style={{
              width: 34,
              height: 34,
              borderRadius: '8px',
              backgroundColor: 'var(--color-accent-muted)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: 'var(--color-accent)',
            }}
          >
            <MessageSquare size={18} />
          </div>
          <div>
            <h3
              style={{
                fontSize: 'var(--text-lg)',
                fontWeight: 700,
                color: 'var(--color-ink-primary)',
                margin: 0,
                lineHeight: 1.2,
              }}
            >
              Community Discussion
            </h3>
            <span style={{ fontSize: '12px', color: 'var(--color-ink-tertiary)' }}>
              {activeCommentsCount} {activeCommentsCount === 1 ? 'thought' : 'thoughts'} & nested replies
            </span>
          </div>
        </div>

        {/* Sort Controls */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
          <span style={{ fontSize: '12px', color: 'var(--color-ink-tertiary)', fontWeight: 500 }}>
            Sort by:
          </span>
          {(['top', 'newest', 'oldest'] as const).map((mode) => (
            <button
              key={mode}
              type="button"
              onClick={() => setSortBy(mode)}
              style={{
                fontSize: '11px',
                fontWeight: sortBy === mode ? 700 : 500,
                padding: '4px 10px',
                borderRadius: '6px',
                border: '1px solid',
                borderColor: sortBy === mode ? 'var(--color-accent)' : 'var(--color-border)',
                backgroundColor: sortBy === mode ? 'var(--color-accent-muted)' : 'var(--color-paper)',
                color: sortBy === mode ? 'var(--color-accent)' : 'var(--color-ink-secondary)',
                cursor: 'pointer',
                textTransform: 'capitalize',
                transition: 'all 0.15s ease',
              }}
            >
              {mode}
            </button>
          ))}
        </div>
      </div>

      {/* Main Comment Box or Sign-In Prompt */}
      {!user && !profile ? (
        <div
          style={{
            marginBottom: 'var(--space-8)',
            backgroundColor: 'var(--color-paper)',
            border: '1px solid var(--color-border)',
            borderRadius: '12px',
            padding: 'var(--space-6)',
            textAlign: 'center',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            gap: 'var(--space-3)',
          }}
        >
          <div
            style={{
              width: 42,
              height: 42,
              borderRadius: '50%',
              backgroundColor: 'var(--color-accent-muted)',
              color: 'var(--color-accent)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <MessageSquare size={20} />
          </div>
          <h4 style={{ fontSize: '15px', fontWeight: 700, margin: 0, color: 'var(--color-ink-primary)' }}>
            Sign In to Join Discussion
          </h4>
          <p style={{ fontSize: '13px', color: 'var(--color-ink-secondary)', maxWidth: 440, margin: 0, lineHeight: 1.5 }}>
            Only verified maker accounts can post comments, ask hardware questions, and like or bookmark builds.
          </p>
          <Link
            to="/login"
            className="btn btn--primary btn--sm"
            style={{ textDecoration: 'none', marginTop: '4px' }}
          >
            Sign In with Maker Account
          </Link>
        </div>
      ) : (
        <div
          style={{
            display: 'flex',
            gap: 'var(--space-3)',
            marginBottom: 'var(--space-8)',
            backgroundColor: 'var(--color-paper)',
            border: '1px solid var(--color-border)',
            borderRadius: '12px',
            padding: 'var(--space-4)',
          }}
        >
          {/* User avatar */}
          <div style={{ flexShrink: 0 }}>
            {currentAuthorAvatar ? (
              <img
                src={currentAuthorAvatar}
                alt={currentAuthorName}
                style={{ width: 36, height: 36, borderRadius: '50%', objectFit: 'cover' }}
              />
            ) : (
              <div
                style={{
                  width: 36,
                  height: 36,
                  borderRadius: '50%',
                  backgroundColor: 'var(--color-accent-muted)',
                  color: 'var(--color-accent)',
                  fontSize: '14px',
                  fontWeight: 700,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                {currentAuthorName.charAt(0).toUpperCase()}
              </div>
            )}
          </div>

          {/* Textarea & Submit */}
          <div style={{ flex: 1 }}>
            <textarea
              rows={3}
              value={rootContent}
              onChange={(e) => setRootContent(e.target.value)}
              placeholder={`Comment as ${currentAuthorName}... Share your build results, questions about hardware pins, or firmware tips.`}
              style={{
                width: '100%',
                fontSize: '13px',
                fontFamily: 'inherit',
                padding: '10px 12px',
                borderRadius: '8px',
                border: '1px solid var(--color-border)',
                backgroundColor: 'var(--color-surface)',
                color: 'var(--color-ink-primary)',
                resize: 'vertical',
                outline: 'none',
                boxSizing: 'border-box',
                minHeight: 70,
              }}
            />
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                marginTop: '8px',
                flexWrap: 'wrap',
                gap: '8px',
              }}
            >
              <span style={{ fontSize: '11px', color: 'var(--color-ink-tertiary)' }}>
                Markdown supported • Be constructive and helpful to fellow makers.
              </span>
              <button
                type="button"
                onClick={() => handleAddRootComment()}
                disabled={isSubmittingRoot || !rootContent.trim()}
                className="btn btn--primary btn--sm"
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '6px',
                  padding: '6px 14px',
                  fontSize: '12px',
                  borderRadius: '6px',
                }}
              >
                <Send size={13} />
                <span>{isSubmittingRoot ? 'Posting...' : 'Comment'}</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Comment Tree View */}
      {treeNodes.length === 0 ? (
        <div
          style={{
            textAlign: 'center',
            padding: 'var(--space-10) var(--space-4)',
            backgroundColor: 'var(--color-paper)',
            borderRadius: '12px',
            border: '1px dashed var(--color-border)',
          }}
        >
          <Sparkles size={32} style={{ color: 'var(--color-accent)', margin: '0 auto var(--space-2)' }} />
          <h4 style={{ fontSize: '14px', fontWeight: 600, color: 'var(--color-ink-primary)', margin: '0 0 4px 0' }}>
            No comments yet
          </h4>
          <p style={{ fontSize: '12px', color: 'var(--color-ink-tertiary)', margin: 0, maxWidth: 380, marginInline: 'auto' }}>
            Be the first to share your thoughts, ask questions about this build, or verify firmware flashing on UNIHIKER K10!
          </p>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}>
          {treeNodes.map((node) => (
            <CommentNodeItem
              key={node.comment.id}
              node={node}
              project={project}
              depth={0}
            />
          ))}
        </div>
      )}
    </div>
  );
}

// ─── RECURSIVE REDDIT-STYLE COMMENT NODE ───────────────────────────────────────

interface CommentNodeItemProps {
  node: CommentTreeNode;
  project: ProjectDetail;
  depth: number;
}

function CommentNodeItem({ node, project, depth }: CommentNodeItemProps) {
  const { user, profile, role } = useAuth();
  const comment = node.comment;
  const [collapsed, setCollapsed] = useState(false);
  const [showReplyBox, setShowReplyBox] = useState(false);
  const [replyContent, setReplyContent] = useState('');
  const [isSubmittingReply, setIsSubmittingReply] = useState(false);

  const currentUserId = user?.id || profile?.id;
  const currentVisitorId = currentUserId || 'visitor_anon';
  const hasUpvoted = comment.upvotedBy.includes(String(currentVisitorId));
  const hasDownvoted = comment.downvotedBy.includes(String(currentVisitorId));

  const isOP =
    Boolean(project.author && comment.authorName.toLowerCase() === project.author.toLowerCase()) ||
    Boolean(project.authorId && comment.authorId && String(project.authorId).toLowerCase() === String(comment.authorId).toLowerCase()) ||
    Boolean(project.authorEmail && comment.authorEmail && project.authorEmail.toLowerCase() === comment.authorEmail.toLowerCase());

  const canDelete =
    Boolean(currentUserId && comment.authorId && String(currentUserId).toLowerCase() === String(comment.authorId).toLowerCase()) ||
    role === 'admin' ||
    Boolean(profile?.email && comment.authorEmail && profile.email.toLowerCase() === comment.authorEmail.toLowerCase());

  const handleVote = (type: 'up' | 'down') => {
    if (!currentUserId) {
      toast.warning('Please sign in to vote on discussion comments.', 'Sign In Required');
      return;
    }
    try {
      voteComment(comment.id, type, String(currentUserId));
    } catch (err: any) {
      toast.warning(err.message || 'Please sign in to vote.');
    }
  };

  const handleDelete = () => {
    if (window.confirm('Are you sure you want to delete this comment?')) {
      deleteComment(comment.id, currentUserId ? String(currentUserId) : undefined);
      toast.info('Comment removed.');
    }
  };

  const handleSendReply = () => {
    if (!currentUserId) {
      toast.warning('Please sign in to reply to comments.', 'Sign In Required');
      return;
    }
    if (!replyContent.trim()) {
      toast.warning('Reply cannot be empty.');
      return;
    }

    setIsSubmittingReply(true);
    try {
      const currentAuthorName =
        profile?.name ||
        user?.user_metadata?.name ||
        (user?.email ? user.email.split('@')[0] : 'Maker');
      const currentAuthorAvatar =
        profile?.avatarUrl ||
        user?.user_metadata?.avatar_url;

      addComment(project.id, replyContent, comment.id, {
        name: currentAuthorName,
        email: profile?.email || user?.email,
        avatar: currentAuthorAvatar,
        role: role || 'user',
        id: String(currentUserId),
      });

      setReplyContent('');
      setShowReplyBox(false);
      toast.success('Reply submitted!');
    } catch (err: any) {
      toast.error(err.message || 'Failed to submit reply.');
    } finally {
      setIsSubmittingReply(false);
    }
  };

  // Count total descendants for collapsed view
  const countDescendants = (n: CommentTreeNode): number => {
    return n.children.reduce((acc, child) => acc + 1 + countDescendants(child), 0);
  };
  const totalChildren = countDescendants(node);

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        position: 'relative',
      }}
    >
      <div style={{ display: 'flex', gap: '8px' }}>
        {/* Reddit-style Vertical Guide Line & Collapse button */}
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            width: 20,
            flexShrink: 0,
            cursor: 'pointer',
          }}
          onClick={() => setCollapsed(!collapsed)}
          title={collapsed ? 'Expand thread' : 'Collapse thread'}
        >
          <button
            type="button"
            style={{
              background: 'none',
              border: 'none',
              padding: 0,
              cursor: 'pointer',
              color: 'var(--color-ink-tertiary)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            {collapsed ? <PlusSquare size={13} /> : <MinusSquare size={13} />}
          </button>
          {!collapsed && (
            <div
              className="reddit-thread-line"
              style={{
                flex: 1,
                width: 2,
                backgroundColor: 'var(--color-border)',
                marginTop: 4,
                borderRadius: 1,
                transition: 'background-color 0.15s ease',
              }}
            />
          )}
        </div>

        {/* Comment Body Content */}
        <div style={{ flex: 1, minWidth: 0 }}>
          {/* Header row: Author, Badges, Timestamp, OP */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              flexWrap: 'wrap',
              fontSize: '12px',
              color: 'var(--color-ink-tertiary)',
              marginBottom: '4px',
            }}
          >
            {comment.authorAvatar ? (
              <img
                src={comment.authorAvatar}
                alt={comment.authorName}
                style={{ width: 18, height: 18, borderRadius: '50%', objectFit: 'cover' }}
              />
            ) : (
              <div
                style={{
                  width: 18,
                  height: 18,
                  borderRadius: '50%',
                  backgroundColor: 'var(--color-accent-muted)',
                  color: 'var(--color-accent)',
                  fontSize: '10px',
                  fontWeight: 700,
                  display: 'inline-flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                {comment.authorName.charAt(0).toUpperCase()}
              </div>
            )}

            <span style={{ fontWeight: 700, color: 'var(--color-ink-primary)' }}>
              {comment.authorName}
            </span>

            {/* OP (Original Poster) Badge */}
            {isOP && (
              <span
                style={{
                  fontSize: '9.5px',
                  fontWeight: 800,
                  color: 'var(--color-accent)',
                  backgroundColor: 'var(--color-accent-muted)',
                  border: '1px solid var(--color-accent-light)',
                  padding: '1px 5px',
                  borderRadius: '4px',
                  letterSpacing: '0.04em',
                }}
                title="Author of this Project / Tutorial"
              >
                OP
              </span>
            )}

            {/* Role Badge */}
            {comment.authorRole && (
              <UserBadge
                role={
                  comment.authorRole.toLowerCase().includes('admin')
                    ? 'admin'
                    : comment.authorRole.toLowerCase().includes('author')
                    ? 'author'
                    : 'user'
                }
                size={12}
              />
            )}

            <span>•</span>
            <span title={comment.createdAt}>{timeAgo(comment.createdAt)}</span>

            {/* Score in header when collapsed */}
            {collapsed && (
              <span style={{ color: 'var(--color-accent)', fontWeight: 600 }}>
                • {comment.score} pts ({totalChildren + 1} comments hidden)
              </span>
            )}
          </div>

          {/* Comment text & Actions (only visible when not collapsed) */}
          {!collapsed && (
            <>
              {/* Text */}
              <div
                style={{
                  fontSize: '13px',
                  lineHeight: 1.55,
                  color: comment.isDeleted ? 'var(--color-ink-tertiary)' : 'var(--color-ink-primary)',
                  fontStyle: comment.isDeleted ? 'italic' : 'normal',
                  margin: '4px 0 8px 0',
                  wordBreak: 'break-word',
                  whiteSpace: 'pre-line',
                }}
              >
                {comment.content}
              </div>

              {/* Action Buttons: Upvote, Downvote, Reply, Delete */}
              {!comment.isDeleted && (
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '12px',
                    fontSize: '11.5px',
                    fontWeight: 600,
                    color: 'var(--color-ink-tertiary)',
                    marginBottom: '8px',
                  }}
                >
                  {/* Upvote & Downvote Pill */}
                  <div
                    style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '4px',
                      backgroundColor: 'var(--color-paper)',
                      border: '1px solid var(--color-border)',
                      borderRadius: '20px',
                      padding: '2px 8px',
                    }}
                  >
                    <button
                      type="button"
                      onClick={() => handleVote('up')}
                      style={{
                        background: 'none',
                        border: 'none',
                        padding: 0,
                        cursor: 'pointer',
                        color: hasUpvoted ? '#f97316' : 'var(--color-ink-tertiary)',
                        display: 'flex',
                        alignItems: 'center',
                      }}
                      title="Upvote"
                    >
                      <ChevronUp size={15} strokeWidth={hasUpvoted ? 3 : 2} />
                    </button>

                    <span
                      style={{
                        fontSize: '11px',
                        fontWeight: 700,
                        color:
                          hasUpvoted
                            ? '#f97316'
                            : hasDownvoted
                            ? '#3b82f6'
                            : 'var(--color-ink-primary)',
                        minWidth: 14,
                        textAlign: 'center',
                      }}
                    >
                      {comment.score}
                    </span>

                    <button
                      type="button"
                      onClick={() => handleVote('down')}
                      style={{
                        background: 'none',
                        border: 'none',
                        padding: 0,
                        cursor: 'pointer',
                        color: hasDownvoted ? '#3b82f6' : 'var(--color-ink-tertiary)',
                        display: 'flex',
                        alignItems: 'center',
                      }}
                      title="Downvote"
                    >
                      <ChevronDown size={15} strokeWidth={hasDownvoted ? 3 : 2} />
                    </button>
                  </div>

                  {/* Reply Button */}
                  <button
                    type="button"
                    onClick={() => {
                      if (!currentUserId) {
                        toast.warning('Please sign in to reply to comments.', 'Sign In Required');
                        return;
                      }
                      setShowReplyBox(!showReplyBox);
                    }}
                    style={{
                      background: 'none',
                      border: 'none',
                      padding: 0,
                      cursor: 'pointer',
                      color: showReplyBox ? 'var(--color-accent)' : 'var(--color-ink-secondary)',
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '4px',
                      fontSize: '11.5px',
                    }}
                  >
                    <Reply size={13} />
                    <span>Reply</span>
                  </button>

                  {/* Delete Button */}
                  {canDelete && (
                    <button
                      type="button"
                      onClick={handleDelete}
                      style={{
                        background: 'none',
                        border: 'none',
                        padding: 0,
                        cursor: 'pointer',
                        color: 'var(--color-ink-tertiary)',
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '4px',
                        fontSize: '11.5px',
                      }}
                      title="Delete your comment"
                    >
                      <Trash2 size={12} />
                      <span>Delete</span>
                    </button>
                  )}
                </div>
              )}

              {/* Inline Reply Composer */}
              {showReplyBox && (
                <div
                  style={{
                    margin: '8px 0 12px 0',
                    padding: '10px 12px',
                    backgroundColor: 'var(--color-paper)',
                    border: '1px solid var(--color-border)',
                    borderRadius: '10px',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '8px',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '11px', color: 'var(--color-ink-tertiary)' }}>
                    <CornerDownRight size={13} color="var(--color-accent)" />
                    <span>Replying to <strong>{comment.authorName}</strong></span>
                  </div>
                  <textarea
                    rows={2}
                    value={replyContent}
                    onChange={(e) => setReplyContent(e.target.value)}
                    placeholder="Write a constructive reply..."
                    autoFocus
                    style={{
                      width: '100%',
                      fontSize: '12px',
                      padding: '8px 10px',
                      borderRadius: '6px',
                      border: '1px solid var(--color-border)',
                      backgroundColor: 'var(--color-surface)',
                      color: 'var(--color-ink-primary)',
                      resize: 'vertical',
                      boxSizing: 'border-box',
                      outline: 'none',
                    }}
                  />
                  <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px' }}>
                    <button
                      type="button"
                      onClick={() => {
                        setShowReplyBox(false);
                        setReplyContent('');
                      }}
                      className="btn btn--secondary btn--sm"
                      style={{ fontSize: '11px', padding: '4px 10px', height: 'auto' }}
                    >
                      Cancel
                    </button>
                    <button
                      type="button"
                      onClick={handleSendReply}
                      disabled={isSubmittingReply || !replyContent.trim()}
                      className="btn btn--primary btn--sm"
                      style={{ fontSize: '11px', padding: '4px 12px', height: 'auto', display: 'inline-flex', alignItems: 'center', gap: '4px' }}
                    >
                      <Send size={11} />
                      <span>{isSubmittingReply ? 'Replying...' : 'Reply'}</span>
                    </button>
                  </div>
                </div>
              )}

              {/* Nested Children */}
              {node.children.length > 0 && (
                <div
                  style={{
                    display: 'flex',
                    flexDirection: 'column',
                    gap: 'var(--space-3)',
                    marginTop: '8px',
                    paddingLeft: '4px',
                  }}
                >
                  {node.children.map((child) => (
                    <CommentNodeItem
                      key={child.comment.id}
                      node={child}
                      project={project}
                      depth={depth + 1}
                    />
                  ))}
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
