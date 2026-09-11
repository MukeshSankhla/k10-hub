import { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Bell,
  CheckCheck,
  Trash2,
  ExternalLink,
  Zap,
  Heart,
  MessageSquare,
  CornerDownRight,
  Award,
  AlertCircle,
  CheckCircle2,
  Trophy,
  Rocket,
  Sparkles,
  Megaphone,
  Info,
  Shield,
} from 'lucide-react';
import { api, AppNotification } from '../../services/api';
import { useAuth } from '../../contexts/AuthContext';

function renderNotificationIcon(iconName: string) {
  const size = 16;
  switch (iconName?.toLowerCase()) {
    case 'zap':
      return <Zap size={size} style={{ color: '#f59e0b' }} />;
    case 'heart':
      return <Heart size={size} style={{ color: '#ef4444' }} fill="#ef4444" />;
    case 'message-square':
      return <MessageSquare size={size} style={{ color: '#3b82f6' }} />;
    case 'corner-down-right':
      return <CornerDownRight size={size} style={{ color: '#8b5cf6' }} />;
    case 'award':
      return <Award size={size} style={{ color: '#10b981' }} />;
    case 'alert-circle':
    case 'alert':
      return <AlertCircle size={size} style={{ color: '#f97316' }} />;
    case 'check-circle':
      return <CheckCircle2 size={size} style={{ color: '#10b981' }} />;
    case 'trophy':
      return <Trophy size={size} style={{ color: '#f59e0b' }} />;
    case 'rocket':
      return <Rocket size={size} style={{ color: '#6366f1' }} />;
    case 'sparkles':
      return <Sparkles size={size} style={{ color: '#ec4899' }} />;
    case 'megaphone':
      return <Megaphone size={size} style={{ color: '#3b82f6' }} />;
    case 'info':
      return <Info size={size} style={{ color: '#0ea5e9' }} />;
    case 'shield':
      return <Shield size={size} style={{ color: '#10b981' }} />;
    case 'bell':
    default:
      return <Bell size={size} style={{ color: 'var(--color-ink-primary)' }} />;
  }
}

function formatRelativeTime(timestamp: number): string {
  if (!timestamp) return '';
  const now = Math.floor(Date.now() / 1000);
  const diff = Math.max(0, now - timestamp);

  if (diff < 60) return 'Just now';
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  if (diff < 604800) return `${Math.floor(diff / 86400)}d ago`;
  return new Date(timestamp * 1000).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
  });
}

export default function NotificationBell() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const [notifications, setNotifications] = useState<AppNotification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const popoverRef = useRef<HTMLDivElement>(null);

  const fetchNotifications = useCallback(async () => {
    if (!user) return;
    try {
      const res = await api.notifications.list({ limit: 40 });
      if (res && Array.isArray(res.data)) {
        setNotifications(res.data);
        setUnreadCount(res.unreadCount ?? 0);
      }
    } catch (err) {
      // Silently fail if guest or offline
    }
  }, [user]);

  // Initial fetch and polling on window focus
  useEffect(() => {
    if (!user) {
      setNotifications([]);
      setUnreadCount(0);
      return;
    }

    fetchNotifications();

    const interval = setInterval(fetchNotifications, 30000);
    const handleFocus = () => fetchNotifications();
    window.addEventListener('focus', handleFocus);

    return () => {
      clearInterval(interval);
      window.removeEventListener('focus', handleFocus);
    };
  }, [user, fetchNotifications]);

  // Handle click outside to close popover
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (popoverRef.current && !popoverRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    if (open) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [open]);

  const handleMarkAllRead = async () => {
    try {
      setUnreadCount(0);
      setNotifications((prev) => prev.map((n) => ({ ...n, isRead: true })));
      await api.notifications.markAllAsRead();
    } catch (err) {
      console.warn('Failed to mark all as read:', err);
    }
  };

  const handleNotificationClick = async (notif: AppNotification) => {
    if (!notif.isRead) {
      setNotifications((prev) =>
        prev.map((n) => (n.id === notif.id ? { ...n, isRead: true } : n))
      );
      setUnreadCount((c) => Math.max(0, c - 1));
      api.notifications.markAsRead(notif.id).catch(() => {});
    }

    setOpen(false);

    if (notif.url) {
      if (notif.url.startsWith('http://') || notif.url.startsWith('https://')) {
        window.open(notif.url, '_blank', 'noopener,noreferrer');
      } else {
        navigate(notif.url);
      }
    }
  };

  const handleDeleteNotification = async (e: React.MouseEvent, id: number) => {
    e.stopPropagation();
    const target = notifications.find((n) => n.id === id);
    if (target && !target.isRead) {
      setUnreadCount((c) => Math.max(0, c - 1));
    }
    setNotifications((prev) => prev.filter((n) => n.id !== id));
    try {
      await api.notifications.delete(id);
    } catch (err) {
      console.warn('Failed to delete notification:', err);
    }
  };

  if (!user) return null;

  return (
    <div style={{ position: 'relative' }} ref={popoverRef}>
      <button
        type="button"
        onClick={() => {
          setOpen(!open);
          if (!open) fetchNotifications();
        }}
        aria-label={`Notifications${unreadCount > 0 ? ` (${unreadCount} unread)` : ''}`}
        aria-expanded={open}
        title="Notifications"
        style={{
          width: 42,
          height: 42,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          borderRadius: 'var(--radius-full)',
          border: '1px solid var(--color-border)',
          background: open ? 'var(--color-surface-sunken)' : 'none',
          color: 'var(--color-ink-secondary)',
          cursor: 'pointer',
          position: 'relative',
          transition: 'all 0.15s ease',
        }}
        onMouseEnter={(e) => {
          e.currentTarget.style.color = 'var(--color-ink-primary)';
          e.currentTarget.style.backgroundColor = 'var(--color-surface-sunken)';
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.color = 'var(--color-ink-secondary)';
          e.currentTarget.style.backgroundColor = open ? 'var(--color-surface-sunken)' : 'transparent';
        }}
      >
        <Bell size={18} />
        {unreadCount > 0 && (
          <span
            style={{
              position: 'absolute',
              top: -2,
              right: -2,
              backgroundColor: '#ef4444',
              color: '#ffffff',
              fontSize: '11px',
              fontWeight: 800,
              minWidth: '18px',
              height: '18px',
              padding: '0 4px',
              borderRadius: '999px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              border: '2px solid var(--color-paper)',
              boxShadow: '0 2px 6px rgba(239, 68, 68, 0.4)',
              animation: 'pulse 2s infinite',
            }}
          >
            {unreadCount > 99 ? '99+' : unreadCount}
          </span>
        )}
      </button>

      {/* Popover Dropdown */}
      {open && (
        <div
          style={{
            position: 'absolute',
            top: 'calc(100% + 10px)',
            right: 0,
            width: '380px',
            maxWidth: 'calc(100vw - 32px)',
            backgroundColor: 'var(--color-surface)',
            border: '1px solid var(--color-border)',
            borderRadius: 'var(--radius-xl)',
            boxShadow: '0 16px 40px rgba(0, 0, 0, 0.18)',
            zIndex: 1200,
            display: 'flex',
            flexDirection: 'column',
            maxHeight: '520px',
            overflow: 'hidden',
            animation: 'fadeIn 0.15s ease-out',
          }}
        >
          {/* Popover Header */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              padding: '14px 16px',
              borderBottom: '1px solid var(--color-border)',
              backgroundColor: 'var(--color-surface)',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span style={{ fontSize: '15px', fontWeight: 700, color: 'var(--color-ink-primary)' }}>
                Notifications
              </span>
              {unreadCount > 0 && (
                <span
                  style={{
                    backgroundColor: 'rgba(239, 68, 68, 0.12)',
                    color: '#ef4444',
                    fontSize: '11px',
                    fontWeight: 700,
                    padding: '2px 7px',
                    borderRadius: '999px',
                  }}
                >
                  {unreadCount} new
                </span>
              )}
            </div>

            {notifications.length > 0 && unreadCount > 0 && (
              <button
                type="button"
                onClick={handleMarkAllRead}
                style={{
                  background: 'none',
                  border: 'none',
                  color: 'var(--color-accent)',
                  fontSize: '12px',
                  fontWeight: 600,
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '4px',
                  padding: '4px 6px',
                  borderRadius: 'var(--radius-sm)',
                }}
              >
                <CheckCheck size={14} />
                <span>Mark all read</span>
              </button>
            )}
          </div>

          {/* Notifications List */}
          <div style={{ overflowY: 'auto', flex: 1 }}>
            {notifications.length === 0 ? (
              <div
                style={{
                  padding: '44px 20px',
                  textAlign: 'center',
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  gap: '10px',
                }}
              >
                <div
                  style={{
                    width: 44,
                    height: 44,
                    borderRadius: '50%',
                    backgroundColor: 'var(--color-surface-sunken)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    color: 'var(--color-ink-tertiary)',
                  }}
                >
                  <Bell size={22} opacity={0.6} />
                </div>
                <div style={{ fontSize: '14px', fontWeight: 600, color: 'var(--color-ink-primary)' }}>
                  You&apos;re all caught up!
                </div>
                <div style={{ fontSize: '12px', color: 'var(--color-ink-tertiary)', maxWidth: '240px' }}>
                  No new notifications right now. Alerts for flashes, likes, comments, and approvals will appear here.
                </div>
              </div>
            ) : (
              notifications.map((notif) => (
                <div
                  key={notif.id}
                  onClick={() => handleNotificationClick(notif)}
                  style={{
                    display: 'flex',
                    alignItems: 'flex-start',
                    gap: '12px',
                    padding: '12px 16px',
                    borderBottom: '1px solid var(--color-border-subtle, var(--color-border))',
                    backgroundColor: notif.isRead
                      ? 'transparent'
                      : 'rgba(59, 130, 246, 0.04)',
                    cursor: notif.url ? 'pointer' : 'default',
                    transition: 'background-color 0.15s ease',
                    position: 'relative',
                  }}
                  className="notification-item"
                >
                  {/* Icon badge */}
                  <div
                    style={{
                      width: 32,
                      height: 32,
                      borderRadius: '8px',
                      backgroundColor: notif.isRead
                        ? 'var(--color-surface-sunken)'
                        : 'rgba(59, 130, 246, 0.12)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      flexShrink: 0,
                      marginTop: '2px',
                    }}
                  >
                    {renderNotificationIcon(notif.icon)}
                  </div>

                  {/* Content */}
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        gap: '6px',
                        marginBottom: '3px',
                      }}
                    >
                      <span
                        style={{
                          fontSize: '13px',
                          fontWeight: notif.isRead ? 600 : 700,
                          color: 'var(--color-ink-primary)',
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                          whiteSpace: 'nowrap',
                        }}
                      >
                        {notif.title}
                      </span>
                      <span
                        style={{
                          fontSize: '11px',
                          color: 'var(--color-ink-tertiary)',
                          flexShrink: 0,
                          fontWeight: 500,
                        }}
                      >
                        {formatRelativeTime(notif.createdAt)}
                      </span>
                    </div>

                    <p
                      style={{
                        fontSize: '12.5px',
                        color: notif.isRead
                          ? 'var(--color-ink-secondary)'
                          : 'var(--color-ink-primary)',
                        lineHeight: 1.4,
                        margin: 0,
                        wordBreak: 'break-word',
                      }}
                    >
                      {notif.message}
                    </p>

                    {notif.url && (
                      <div
                        style={{
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '4px',
                          marginTop: '6px',
                          fontSize: '11.5px',
                          fontWeight: 600,
                          color: 'var(--color-accent)',
                        }}
                      >
                        <span>View</span>
                        <ExternalLink size={11} />
                      </div>
                    )}
                  </div>

                  {/* Actions & Read dot */}
                  <div
                    style={{
                      display: 'flex',
                      flexDirection: 'column',
                      alignItems: 'center',
                      gap: '8px',
                      marginLeft: '4px',
                      alignSelf: 'center',
                    }}
                  >
                    {!notif.isRead && (
                      <span
                        style={{
                          width: 8,
                          height: 8,
                          borderRadius: '50%',
                          backgroundColor: '#3b82f6',
                        }}
                        title="Unread"
                      />
                    )}
                    <button
                      type="button"
                      onClick={(e) => handleDeleteNotification(e, notif.id)}
                      title="Delete notification"
                      style={{
                        background: 'none',
                        border: 'none',
                        color: 'var(--color-ink-tertiary)',
                        cursor: 'pointer',
                        padding: '3px',
                        borderRadius: '4px',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        opacity: 0.6,
                      }}
                      onMouseEnter={(e) => {
                        e.currentTarget.style.opacity = '1';
                        e.currentTarget.style.color = '#ef4444';
                      }}
                      onMouseLeave={(e) => {
                        e.currentTarget.style.opacity = '0.6';
                        e.currentTarget.style.color = 'var(--color-ink-tertiary)';
                      }}
                    >
                      <Trash2 size={13} />
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}
