import { useState, useEffect, useCallback, useRef } from 'react';
import { Link } from 'react-router-dom';
import Header from '../../components/layout/Header';
import Footer from '../../components/layout/Footer';
import { api, UserProfile, AuthorApplication, AdminStats, UserRole, UserStatus } from '../../services/api';
import { ProjectDetail } from '../../config/projectsData';
import {
  getAllProjects,
  approveProject,
  rejectProject,
  deleteProject,
  subscribeProjects,
  toggleFeaturedProject,
  isProjectAuthor,
} from '../../services/projects/projectStorageService';
import { useAuth } from '../../contexts/AuthContext';
import { toast } from '../../contexts/ToastContext';
import UserBadge, { ADMIN_EMAILS } from '../../components/common/UserBadge';
import {
  Users,
  Shield,
  Cpu,
  Clock,
  CheckCircle2,
  XCircle,
  Search,
  ExternalLink,
  RefreshCw,
  Award,
  FolderGit2,
  Check,
  X,
  Eye,
  Edit,
  Trash2,
  ChevronDown,
  ChevronUp,
  RotateCcw,
  ShieldAlert,
  Github,
  Star,
  Zap,
  Bell,
  Megaphone,
  Send,
  Flame,
  Gift,
  Rocket,
  Sparkles,
  Trophy,
  Heart,
  MessageSquare,
  Info,
  AlertCircle,
} from 'lucide-react';

export default function AdminDashboardPage() {
  const { user, profile } = useAuth();
  const [activeTab, setActiveTab] = useState<'users' | 'applications' | 'projects' | 'notifications'>('users');
  const [stats, setStats] = useState<AdminStats | null>(null);

  // Broadcast Notification State
  const [broadcastTitle, setBroadcastTitle] = useState('');
  const [broadcastMessage, setBroadcastMessage] = useState('');
  const [broadcastUrl, setBroadcastUrl] = useState('');
  const [broadcastIcon, setBroadcastIcon] = useState('bell');
  const [broadcastTarget, setBroadcastTarget] = useState<'all' | 'users' | 'authors' | 'specific'>('all');
  const [selectedUserIds, setSelectedUserIds] = useState<number[]>([]);
  const [broadcastLoading, setBroadcastLoading] = useState(false);
  const [broadcastSuccessInfo, setBroadcastSuccessInfo] = useState<string | null>(null);
  const [userSearchQuery, setUserSearchQuery] = useState('');
  const [allUsersForSelect, setAllUsersForSelect] = useState<UserProfile[]>([]);
  const [loadingAllUsers, setLoadingAllUsers] = useState(false);

  // Projects Verification & Moderation State
  const [projectsList, setProjectsList] = useState<ProjectDetail[]>(() => getAllProjects());
  const [projectStatusFilter, setProjectStatusFilter] = useState<'all' | 'featured' | 'pending_approval' | 'published' | 'draft' | 'rejected'>('all');
  const [projectSearchQuery, setProjectSearchQuery] = useState('');

  // Users state
  const [usersList, setUsersList] = useState<UserProfile[]>([]);
  const [usersLoading, setUsersLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [roleFilter, setRoleFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState('all');
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);

  // Applications state
  const [applications, setApplications] = useState<AuthorApplication[]>([]);
  const [appsLoading, setAppsLoading] = useState(false);
  const [appStatusFilter, setAppStatusFilter] = useState<'pending' | 'approved' | 'demoted' | 'rejected'>('pending');
  const [expandedAppIds, setExpandedAppIds] = useState<Record<number, boolean>>({});
  const hasAutoSelectedFilter = useRef(false);
  const [actionMessage, setActionMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // Toggle card expansion
  const toggleExpandApp = (id: number) => {
    setExpandedAppIds((prev) => ({ ...prev, [id]: !prev[id] }));
  };

  // Re-grant Author role to a demoted creator with confirmation
  const handleRestoreAuthor = (userId: number, userName?: string) => {
    const targetName = userName || `User #${userId}`;
    toast.confirm({
      title: 'Confirm Author Reinstatement',
      message: `Are you sure you want to reinstate Author role privileges for "${targetName}"?`,
      confirmLabel: 'Reinstate Author',
      cancelLabel: 'Cancel',
      type: 'info',
      onConfirm: async () => {
        try {
          await api.admin.updateUserRole(userId, 'author');
          toast.success(`Author role successfully restored for ${targetName}.`);
          setActionMessage({ type: 'success', text: `Author role successfully restored.` });
          loadApplications();
          loadStats();
        } catch (err: any) {
          toast.error(err.message || 'Failed to restore Author role');
          setActionMessage({ type: 'error', text: err.message || 'Failed to restore Author role' });
        }
      },
    });
  };

  // Helper to detect URLs in plain text and render them as interactive clickable links
  const renderTextWithLinks = (text: string) => {
    if (!text) return null;
    const urlRegex = /(https?:\/\/[^\s\)\],]+)/g;
    const parts = text.split(urlRegex);

    return parts.map((part, i) => {
      if (urlRegex.test(part)) {
        return (
          <a
            key={i}
            href={part}
            target="_blank"
            rel="noopener noreferrer"
            style={{
              color: 'var(--color-accent)',
              textDecoration: 'underline',
              wordBreak: 'break-all',
              display: 'inline-flex',
              alignItems: 'center',
              gap: '3px',
              fontWeight: 600,
            }}
            onClick={(e) => e.stopPropagation()}
          >
            {part} <ExternalLink size={12} style={{ flexShrink: 0 }} />
          </a>
        );
      }
      return part;
    });
  };

  // Formatted render for Hardware Experience with clean badge and showcase link
  const renderHardwareDetails = (text: string) => {
    if (!text) return <span style={{ color: 'var(--color-ink-tertiary)', fontSize: '13px' }}>No hardware details provided</span>;

    const urlMatch = text.match(/https?:\/\/[^\s\)\],]+/);
    const foundUrl = urlMatch ? urlMatch[0] : null;

    const isYes = /worked on unihiker:\s*yes/i.test(text);
    const isNo = /worked on unihiker:\s*no/i.test(text);

    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
          <span style={{ fontSize: '12px', color: 'var(--color-ink-secondary)' }}>UNIHIKER Experience:</span>
          <span
            style={{
              fontSize: '11px',
              fontWeight: 700,
              padding: '2px 8px',
              borderRadius: 'var(--radius-full)',
              backgroundColor: isYes ? 'rgba(34, 197, 94, 0.12)' : isNo ? 'rgba(100, 116, 139, 0.12)' : 'rgba(37, 99, 235, 0.1)',
              color: isYes ? 'rgb(22, 163, 74)' : isNo ? 'rgb(100, 116, 139)' : 'rgb(37, 99, 235)',
            }}
          >
            {isYes ? 'Experienced' : isNo ? 'New to Platform' : 'Specified'}
          </span>
        </div>

        {foundUrl && (
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginTop: '2px' }}>
            <span style={{ fontSize: '11px', color: 'var(--color-ink-tertiary)' }}>Showcase:</span>
            <a
              href={foundUrl}
              target="_blank"
              rel="noopener noreferrer"
              style={{
                color: 'var(--color-accent)',
                fontSize: '12px',
                fontWeight: 600,
                textDecoration: 'none',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '4px',
              }}
              onClick={(e) => e.stopPropagation()}
            >
              {foundUrl.replace(/^https?:\/\/(www\.)?/, '')} <ExternalLink size={11} />
            </a>
          </div>
        )}

        {!isYes && !isNo && (
          <div style={{ fontSize: '13px', color: 'var(--color-ink-primary)', lineHeight: 1.5 }}>
            {renderTextWithLinks(text)}
          </div>
        )}
      </div>
    );
  };

  // Rejection modal
  const [rejectModalAppId, setRejectModalAppId] = useState<number | null>(null);
  const [rejectNotes, setRejectNotes] = useState('');

  // Load Admin Stats
  const loadStats = useCallback(async () => {
    try {
      const data = await api.admin.getStats();
      setStats(data);
    } catch (err) {
      console.error('Failed to load stats:', err);
    }
  }, []);

  // Load Users List
  const loadUsers = useCallback(async () => {
    setUsersLoading(true);
    try {
      const res = await api.admin.getUsers({
        page,
        pageSize: 15,
        search: searchQuery,
        role: roleFilter,
        status: statusFilter,
      });
      setUsersList(res.data);
      if (res.meta?.totalPages) {
        setTotalPages(res.meta.totalPages);
      }
    } catch (err: any) {
      console.error('Failed to load users:', err);
    } finally {
      setUsersLoading(false);
    }
  }, [page, searchQuery, roleFilter, statusFilter]);

  // Load Applications
  const loadApplications = useCallback(async () => {
    setAppsLoading(true);
    try {
      const res = await api.admin.getAuthorApplications(appStatusFilter);
      setApplications(res.data);
    } catch (err: any) {
      console.error('Failed to load applications:', err);
    } finally {
      setAppsLoading(false);
    }
  }, [appStatusFilter]);

  useEffect(() => {
    loadStats();
  }, [loadStats]);

  // Auto-select Author Applications filter: Pending if there are pending requests, otherwise Approved
  useEffect(() => {
    if (!hasAutoSelectedFilter.current && stats !== null) {
      hasAutoSelectedFilter.current = true;
      if (stats.pendingApplications > 0) {
        setAppStatusFilter('pending');
      } else {
        setAppStatusFilter('approved');
      }
    }
  }, [stats]);

  // Load all users for multi-user target picker
  const loadAllUsersForPicker = useCallback(async () => {
    setLoadingAllUsers(true);
    try {
      const res = await api.admin.getUsers({ page: 1, pageSize: 100 });
      setAllUsersForSelect(res.data);
    } catch (err) {
      console.error('Failed to load users for notification target picker:', err);
    } finally {
      setLoadingAllUsers(false);
    }
  }, []);

  useEffect(() => {
    if (activeTab === 'users') {
      loadUsers();
    } else if (activeTab === 'applications') {
      loadApplications();
    } else if (activeTab === 'notifications' && allUsersForSelect.length === 0) {
      loadAllUsersForPicker();
    }
  }, [activeTab, loadUsers, loadApplications, allUsersForSelect.length, loadAllUsersForPicker]);

  const handleSendBroadcast = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!broadcastTitle.trim()) {
      toast.error('Notification title is required');
      return;
    }
    if (!broadcastMessage.trim()) {
      toast.error('Notification description/message is required');
      return;
    }
    if (broadcastTarget === 'specific' && selectedUserIds.length === 0) {
      toast.error('Please select at least one recipient user for custom delivery');
      return;
    }

    setBroadcastLoading(true);
    setBroadcastSuccessInfo(null);
    try {
      const res = await api.notifications.broadcast({
        title: broadcastTitle.trim(),
        message: broadcastMessage.trim(),
        url: broadcastUrl.trim() || undefined,
        icon: broadcastIcon,
        target: broadcastTarget,
        targetUserIds: broadcastTarget === 'specific' ? selectedUserIds : undefined,
      });

      toast.success(`Broadcast sent successfully to ${res.count} recipient(s)!`);
      setBroadcastSuccessInfo(`Broadcast delivered to ${res.count} recipient(s) (${broadcastTarget.toUpperCase()}).`);
      setBroadcastTitle('');
      setBroadcastMessage('');
      setBroadcastUrl('');
      if (broadcastTarget === 'specific') {
        setSelectedUserIds([]);
      }
    } catch (err: any) {
      toast.error(err.message || 'Failed to dispatch broadcast notification');
    } finally {
      setBroadcastLoading(false);
    }
  };

  const toggleSelectUser = (id: number) => {
    setSelectedUserIds((prev) =>
      prev.includes(id) ? prev.filter((userId) => userId !== id) : [...prev, id]
    );
  };

  // Role update handler with confirmation dialog
  const handleRoleChange = (
    userId: number,
    newRole: UserRole,
    userName?: string,
    currentRole?: UserRole
  ) => {
    if (newRole === currentRole) return;

    const roleNames: Record<string, string> = {
      admin: 'Administrator',
      author: 'Author',
      user: 'Standard Maker (User)',
    };

    const targetName = userName || `User #${userId}`;
    const oldRoleName = currentRole ? roleNames[currentRole] || currentRole : 'current role';
    const newRoleName = roleNames[newRole] || newRole;

    toast.confirm({
      title: 'Confirm User Role Change',
      message: `Are you sure you want to change the role of "${targetName}" from ${oldRoleName} to ${newRoleName}?`,
      confirmLabel: 'Change Role',
      cancelLabel: 'Cancel',
      type: newRole === 'admin' ? 'warning' : 'info',
      onConfirm: async () => {
        try {
          const res = await api.admin.updateUserRole(userId, newRole);
          toast.success(res.message || `Role updated to ${newRoleName}.`);
          setActionMessage({ type: 'success', text: res.message });
          loadUsers();
          loadStats();
        } catch (err: any) {
          toast.error(err.message || 'Failed to update user role');
          setActionMessage({ type: 'error', text: err.message || 'Failed to update user role' });
          loadUsers();
        }
      },
      onCancel: () => {
        // Force refresh usersList state to keep the select input in sync with unchanged role
        setUsersList((prev) => [...prev]);
      },
    });
  };

  // Status toggle handler
  const handleStatusChange = async (userId: number, newStatus: UserStatus) => {
    try {
      const res = await api.admin.updateUserStatus(userId, newStatus);
      setActionMessage({ type: 'success', text: res.message });
      loadUsers();
    } catch (err: any) {
      setActionMessage({ type: 'error', text: err.message || 'Failed to update user status' });
    }
  };

  // Permanently delete user handler with modal confirmation
  const handleDeleteUser = (targetUser: UserProfile) => {
    const isSelf =
      (profile && profile.id === targetUser.id) ||
      (user && String(user.id) === String(targetUser.id)) ||
      (user && user.email?.toLowerCase() === targetUser.email.toLowerCase());
    if (isSelf) {
      toast.error('You cannot delete your own administrator account.');
      return;
    }

    if (ADMIN_EMAILS.includes(targetUser.email.toLowerCase())) {
      toast.error('Primary system administrators configured in ADMIN_EMAILS cannot be deleted.');
      return;
    }

    toast.confirm({
      title: 'Permanently Delete User',
      message: `Are you sure you want to permanently delete "${targetUser.name}" (${targetUser.email})? This will delete their authentication account, profile, comments, bookmarks, likes, flash logs, and authored projects. This action cannot be undone.`,
      confirmLabel: 'Delete Permanently',
      cancelLabel: 'Cancel',
      type: 'danger',
      onConfirm: async () => {
        try {
          const res = await api.admin.deleteUser(targetUser.id);
          toast.success(res.message || `User "${targetUser.name}" deleted successfully.`);
          setActionMessage({ type: 'success', text: res.message });
          loadUsers();
          loadStats();
        } catch (err: any) {
          toast.error(err.message || 'Failed to delete user');
          setActionMessage({ type: 'error', text: err.message || 'Failed to delete user' });
          loadUsers();
        }
      },
    });
  };

  // Approve author application
  const handleApproveApp = async (appId: number) => {
    try {
      const res = await api.admin.approveAuthorApplication(appId);
      setActionMessage({ type: 'success', text: res.message });
      loadApplications();
      loadStats();
    } catch (err: any) {
      setActionMessage({ type: 'error', text: err.message || 'Failed to approve application' });
    }
  };

  // Reject author application
  const handleRejectApp = async () => {
    if (!rejectModalAppId) return;
    try {
      const res = await api.admin.rejectAuthorApplication(rejectModalAppId, rejectNotes);
      setActionMessage({ type: 'success', text: res.message });
      setRejectModalAppId(null);
      setRejectNotes('');
      loadApplications();
      loadStats();
    } catch (err: any) {
      setActionMessage({ type: 'error', text: err.message || 'Failed to reject application' });
    }
  };

  // Sync projects from storage
  useEffect(() => {
    setProjectsList(getAllProjects());
    const unsub = subscribeProjects((updated) => {
      setProjectsList(updated);
    });
    return unsub;
  }, []);

  const handleApproveProject = (id: string, title: string) => {
    const success = approveProject(id);
    if (success) {
      setActionMessage({ type: 'success', text: `Approved "${title}". It is now live in the public catalog.` });
      setProjectsList(getAllProjects());
    }
  };

  const handleRejectProject = (id: string, title: string) => {
    const success = rejectProject(id);
    if (success) {
      setActionMessage({ type: 'success', text: `Rejected "${title}". Status updated to rejected.` });
      setProjectsList(getAllProjects());
    }
  };

  const handleDeleteProject = (id: string, title: string) => {
    toast.confirm({
      title: 'Delete Project',
      message: `Are you sure you want to permanently remove "${title}"? This cannot be undone.`,
      confirmText: 'Delete',
      cancelText: 'Cancel',
      type: 'danger',
      onConfirm: () => {
        const success = deleteProject(id);
        if (success) {
          toast.success(`Deleted "${title}".`, 'Project Removed');
          setActionMessage({ type: 'success', text: `Deleted "${title}".` });
          setProjectsList(getAllProjects());
        }
      },
    });
  };

  const handleToggleFeatured = (id: string, title: string) => {
    toggleFeaturedProject(id);
    const updated = getAllProjects();
    setProjectsList(updated);
    const curr = updated.find((p) => p.id === id);
    const isNow = Boolean(curr?.featured || curr?.isFeatured);
    setActionMessage({
      type: 'success',
      text: isNow ? `"${title}" is now featured on the Home page.` : `"${title}" removed from Home featured section.`,
    });
  };

  return (
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column', backgroundColor: 'var(--color-paper)' }}>
      <Header />

      <main style={{ flex: 1, paddingTop: 'calc(var(--nav-height) + var(--space-8))', paddingBottom: 'var(--space-12)' }}>
        <div className="container">
          {/* Page Title */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 'var(--space-4)', marginBottom: 'var(--space-6)' }}>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)', color: 'rgb(220, 38, 38)', marginBottom: 'var(--space-1)' }}>
                <Shield size={20} />
                <span style={{ fontSize: 'var(--text-xs)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em' }}>
                  Platform Control
                </span>
              </div>
              <h1 style={{ fontSize: 'var(--text-3xl)', fontWeight: 700, color: 'var(--color-ink-primary)', margin: 0, letterSpacing: '-0.02em' }}>
                Admin & User Management
              </h1>
            </div>

            <button
              onClick={() => {
                loadStats();
                if (activeTab === 'users') loadUsers();
                else loadApplications();
              }}
              className="btn btn--secondary btn--sm"
              style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}
            >
              <RefreshCw size={14} /> Refresh Data
            </button>
          </div>

          {/* Feedback message */}
          {actionMessage && (
            <div style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              padding: 'var(--space-3) var(--space-4)',
              borderRadius: 'var(--radius-md)',
              marginBottom: 'var(--space-6)',
              backgroundColor: actionMessage.type === 'success' ? 'rgba(34, 197, 94, 0.1)' : 'rgba(239, 68, 68, 0.1)',
              border: `1px solid ${actionMessage.type === 'success' ? 'rgba(34, 197, 94, 0.3)' : 'rgba(239, 68, 68, 0.3)'}`,
              color: actionMessage.type === 'success' ? 'rgb(22, 163, 74)' : 'rgb(220, 38, 38)',
              fontSize: 'var(--text-sm)',
            }}>
              <span>{actionMessage.text}</span>
              <button
                onClick={() => setActionMessage(null)}
                style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'inherit', fontWeight: 'bold' }}
              >
                ✕
              </button>
            </div>
          )}

          {/* Metrics Row */}
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
            gap: 'var(--space-4)',
            marginBottom: 'var(--space-8)',
          }}>
            <div style={{
              backgroundColor: 'var(--color-surface)',
              border: '1px solid var(--color-border)',
              borderRadius: 'var(--radius-lg)',
              padding: 'var(--space-4) var(--space-5)',
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', color: 'var(--color-ink-tertiary)' }}>
                <span style={{ fontSize: 'var(--text-xs)', fontWeight: 600, textTransform: 'uppercase' }}>Total Users</span>
                <Users size={18} />
              </div>
              <div style={{ fontSize: 'var(--text-3xl)', fontWeight: 700, color: 'var(--color-ink-primary)', marginTop: 'var(--space-2)' }}>
                {stats?.totalUsers ?? '—'}
              </div>
              <div style={{ fontSize: 'var(--text-xs)', color: 'var(--color-ink-secondary)', marginTop: 'var(--space-1)' }}>
                Registered maker accounts
              </div>
            </div>

            <div style={{
              backgroundColor: 'var(--color-surface)',
              border: '1px solid var(--color-border)',
              borderRadius: 'var(--radius-lg)',
              padding: 'var(--space-4) var(--space-5)',
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', color: 'rgb(37, 99, 235)' }}>
                <span style={{ fontSize: 'var(--text-xs)', fontWeight: 600, textTransform: 'uppercase' }}>Verified Authors</span>
                <Cpu size={18} />
              </div>
              <div style={{ fontSize: 'var(--text-3xl)', fontWeight: 700, color: 'var(--color-ink-primary)', marginTop: 'var(--space-2)' }}>
                {stats?.usersByRole.author ?? '—'}
              </div>
              <div style={{ fontSize: 'var(--text-xs)', color: 'var(--color-ink-secondary)', marginTop: 'var(--space-1)' }}>
                Approved content publishers
              </div>
            </div>

            <div style={{
              backgroundColor: 'var(--color-surface)',
              border: '1px solid var(--color-border)',
              borderRadius: 'var(--radius-lg)',
              padding: 'var(--space-4) var(--space-5)',
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', color: 'rgb(220, 38, 38)' }}>
                <span style={{ fontSize: 'var(--text-xs)', fontWeight: 600, textTransform: 'uppercase' }}>Administrators</span>
                <Shield size={18} />
              </div>
              <div style={{ fontSize: 'var(--text-3xl)', fontWeight: 700, color: 'var(--color-ink-primary)', marginTop: 'var(--space-2)' }}>
                {stats?.usersByRole.admin ?? '—'}
              </div>
              <div style={{ fontSize: 'var(--text-xs)', color: 'var(--color-ink-secondary)', marginTop: 'var(--space-1)' }}>
                Full system control
              </div>
            </div>

            <div style={{
              backgroundColor: (stats?.pendingApplications || 0) > 0 ? 'rgba(234, 179, 8, 0.08)' : 'var(--color-surface)',
              border: `1px solid ${(stats?.pendingApplications || 0) > 0 ? 'rgba(234, 179, 8, 0.4)' : 'var(--color-border)'}`,
              borderRadius: 'var(--radius-lg)',
              padding: 'var(--space-4) var(--space-5)',
              cursor: 'pointer',
            }}
            onClick={() => setActiveTab('applications')}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', color: 'rgb(202, 138, 4)' }}>
                <span style={{ fontSize: 'var(--text-xs)', fontWeight: 600, textTransform: 'uppercase' }}>Author Requests</span>
                <Clock size={18} />
              </div>
              <div style={{ fontSize: 'var(--text-3xl)', fontWeight: 700, color: (stats?.pendingApplications || 0) > 0 ? 'rgb(161, 98, 7)' : 'var(--color-ink-primary)', marginTop: 'var(--space-2)' }}>
                {stats?.pendingApplications ?? '—'}
              </div>
              <div style={{ fontSize: 'var(--text-xs)', color: 'var(--color-ink-secondary)', marginTop: 'var(--space-1)' }}>
                Awaiting review
              </div>
            </div>

            {/* Pending Projects Stat Card */}
            <div
              style={{
                backgroundColor: projectsList.filter(p => p.status === 'pending_approval').length > 0 ? 'rgba(245, 158, 11, 0.08)' : 'var(--color-surface)',
                border: `1px solid ${projectsList.filter(p => p.status === 'pending_approval').length > 0 ? 'rgba(245, 158, 11, 0.4)' : 'var(--color-border)'}`,
                borderRadius: 'var(--radius-lg)',
                padding: 'var(--space-4) var(--space-5)',
                cursor: 'pointer',
              }}
              onClick={() => {
                setActiveTab('projects');
                setProjectStatusFilter('pending_approval');
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', color: '#d97706' }}>
                <span style={{ fontSize: 'var(--text-xs)', fontWeight: 600, textTransform: 'uppercase' }}>Pending Projects</span>
                <FolderGit2 size={18} />
              </div>
              <div style={{ fontSize: 'var(--text-3xl)', fontWeight: 700, color: projectsList.filter(p => p.status === 'pending_approval').length > 0 ? '#d97706' : 'var(--color-ink-primary)', marginTop: 'var(--space-2)' }}>
                {projectsList.filter(p => p.status === 'pending_approval').length}
              </div>
              <div style={{ fontSize: 'var(--text-xs)', color: 'var(--color-ink-secondary)', marginTop: 'var(--space-1)' }}>
                Awaiting verification
              </div>
            </div>
          </div>

          {/* Tab Navigation */}
          <div style={{
            display: 'flex',
            gap: 'var(--space-2)',
            borderBottom: '1px solid var(--color-border)',
            marginBottom: 'var(--space-6)',
          }}>
            <button
              onClick={() => setActiveTab('users')}
              style={{
                padding: 'var(--space-3) var(--space-5)',
                fontSize: 'var(--text-sm)',
                fontWeight: 600,
                color: activeTab === 'users' ? 'var(--color-ink-primary)' : 'var(--color-ink-tertiary)',
                backgroundColor: 'transparent',
                border: 'none',
                borderBottom: activeTab === 'users' ? '2px solid var(--color-ink-primary)' : '2px solid transparent',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '0.4rem',
              }}
            >
              <Users size={16} /> User Management
            </button>

            <button
              onClick={() => setActiveTab('applications')}
              style={{
                padding: 'var(--space-3) var(--space-5)',
                fontSize: 'var(--text-sm)',
                fontWeight: 600,
                color: activeTab === 'applications' ? 'var(--color-ink-primary)' : 'var(--color-ink-tertiary)',
                backgroundColor: 'transparent',
                border: 'none',
                borderBottom: activeTab === 'applications' ? '2px solid var(--color-ink-primary)' : '2px solid transparent',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '0.4rem',
              }}
            >
              <Award size={16} /> Author Applications
              {(stats?.pendingApplications || 0) > 0 && (
                <span style={{
                  backgroundColor: 'rgb(234, 179, 8)',
                  color: '#fff',
                  borderRadius: 'var(--radius-full)',
                  padding: '1px 6px',
                  fontSize: '11px',
                  fontWeight: 700,
                }}>
                  {stats?.pendingApplications}
                </span>
              )}
            </button>

            <button
              onClick={() => setActiveTab('projects')}
              style={{
                padding: 'var(--space-3) var(--space-5)',
                fontSize: 'var(--text-sm)',
                fontWeight: 600,
                color: activeTab === 'projects' ? 'var(--color-ink-primary)' : 'var(--color-ink-tertiary)',
                backgroundColor: 'transparent',
                border: 'none',
                borderBottom: activeTab === 'projects' ? '2px solid var(--color-ink-primary)' : '2px solid transparent',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '0.4rem',
              }}
            >
              <FolderGit2 size={16} /> Project Verification &amp; Moderation
              {projectsList.filter(p => p.status === 'pending_approval').length > 0 && (
                <span style={{
                  backgroundColor: '#f59e0b',
                  color: '#000',
                  borderRadius: 'var(--radius-full)',
                  padding: '1px 6px',
                  fontSize: '11px',
                  fontWeight: 800,
                }}>
                  {projectsList.filter(p => p.status === 'pending_approval').length}
                </span>
              )}
            </button>

            <button
              onClick={() => setActiveTab('notifications')}
              style={{
                padding: 'var(--space-3) var(--space-5)',
                fontSize: 'var(--text-sm)',
                fontWeight: 600,
                color: activeTab === 'notifications' ? 'var(--color-ink-primary)' : 'var(--color-ink-tertiary)',
                backgroundColor: 'transparent',
                border: 'none',
                borderBottom: activeTab === 'notifications' ? '2px solid var(--color-ink-primary)' : '2px solid transparent',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '0.4rem',
              }}
            >
              <Megaphone size={16} /> Broadcast Notifications
            </button>
          </div>

          {/* Tab 1: User Management */}
          {activeTab === 'users' && (
            <div style={{
              backgroundColor: 'var(--color-surface)',
              border: '1px solid var(--color-border)',
              borderRadius: 'var(--radius-xl)',
              padding: 'var(--space-6)',
              boxShadow: 'var(--shadow-sm)',
            }}>
              {/* Filters Bar */}
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 'var(--space-3)', marginBottom: 'var(--space-6)' }}>
                {/* Search */}
                <div style={{ position: 'relative', flex: 1, minWidth: 240 }}>
                  <Search size={16} style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: 'var(--color-ink-tertiary)' }} />
                  <input
                    type="text"
                    placeholder="Search by name, email, or user ID (usr_...)..."
                    value={searchQuery}
                    onChange={(e) => {
                      setSearchQuery(e.target.value);
                      setPage(1);
                    }}
                    style={{
                      width: '100%',
                      padding: '8px 12px 8px 36px',
                      backgroundColor: 'var(--color-paper)',
                      border: '1px solid var(--color-border)',
                      borderRadius: 'var(--radius-md)',
                      fontSize: 'var(--text-sm)',
                      outline: 'none',
                    }}
                  />
                </div>

                {/* Role filter */}
                <select
                  value={roleFilter}
                  onChange={(e) => {
                    setRoleFilter(e.target.value);
                    setPage(1);
                  }}
                  style={{
                    padding: '8px 12px',
                    backgroundColor: 'var(--color-paper)',
                    border: '1px solid var(--color-border)',
                    borderRadius: 'var(--radius-md)',
                    fontSize: 'var(--text-sm)',
                    outline: 'none',
                    color: 'var(--color-ink-primary)',
                  }}
                >
                  <option value="all">All Roles</option>
                  <option value="user">Users</option>
                  <option value="author">Authors</option>
                  <option value="admin">Admins</option>
                </select>

                {/* Status filter */}
                <select
                  value={statusFilter}
                  onChange={(e) => {
                    setStatusFilter(e.target.value);
                    setPage(1);
                  }}
                  style={{
                    padding: '8px 12px',
                    backgroundColor: 'var(--color-paper)',
                    border: '1px solid var(--color-border)',
                    borderRadius: 'var(--radius-md)',
                    fontSize: 'var(--text-sm)',
                    outline: 'none',
                    color: 'var(--color-ink-primary)',
                  }}
                >
                  <option value="all">All Statuses</option>
                  <option value="active">Active</option>
                  <option value="suspended">Suspended</option>
                </select>
              </div>

              {/* Users Table */}
              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: 'var(--text-sm)' }}>
                  <thead>
                    <tr style={{ borderBottom: '1px solid var(--color-border)', color: 'var(--color-ink-tertiary)', fontSize: 'var(--text-xs)', textTransform: 'uppercase' }}>
                      <th style={{ padding: 'var(--space-3)' }}>User</th>
                      <th style={{ padding: 'var(--space-3)' }}>Role</th>
                      <th style={{ padding: 'var(--space-3)' }}>Status</th>
                      <th style={{ padding: 'var(--space-3)' }}>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {usersLoading ? (
                      <tr>
                        <td colSpan={4} style={{ textAlign: 'center', padding: 'var(--space-8)', color: 'var(--color-ink-secondary)' }}>
                          Loading users...
                        </td>
                      </tr>
                    ) : usersList.length === 0 ? (
                      <tr>
                        <td colSpan={4} style={{ textAlign: 'center', padding: 'var(--space-8)', color: 'var(--color-ink-secondary)' }}>
                          No users found matching current filters.
                        </td>
                      </tr>
                    ) : (
                      usersList.map((u) => (
                        <tr key={u.id} style={{ borderBottom: '1px solid var(--color-border)' }}>
                          {/* User info */}
                          <td style={{ padding: 'var(--space-3)' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-3)' }}>
                              {u.avatarUrl ? (
                                <img src={u.avatarUrl} alt={u.name} style={{ width: 36, height: 36, borderRadius: '50%', objectFit: 'cover' }} />
                              ) : (
                                <div style={{ width: 36, height: 36, borderRadius: '50%', backgroundColor: 'var(--color-ink-primary)', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 600 }}>
                                  {u.name.charAt(0).toUpperCase()}
                                </div>
                              )}
                              <div>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                                  <span style={{ fontWeight: 600, color: 'var(--color-ink-primary)' }}>{u.name}</span>
                                  <UserBadge role={u.role} size={15} />
                                </div>
                                <div style={{ fontSize: 'var(--text-xs)', color: 'var(--color-ink-secondary)' }}>{u.email}</div>
                                {u.userKey && (
                                  <div style={{ marginTop: '2px' }}>
                                    <span
                                      title="Unique immutable User ID"
                                      style={{
                                        fontFamily: 'monospace',
                                        fontSize: '11px',
                                        color: 'var(--color-ink-secondary)',
                                        backgroundColor: 'var(--color-paper)',
                                        padding: '1px 6px',
                                        borderRadius: '4px',
                                        border: '1px solid var(--color-border)',
                                        display: 'inline-block',
                                      }}
                                    >
                                      {u.userKey}
                                    </span>
                                  </div>
                                )}
                              </div>
                            </div>
                          </td>

                          {/* Role */}
                          <td style={{ padding: 'var(--space-3)' }}>
                            <select
                              value={u.role}
                              onChange={(e) => handleRoleChange(u.id, e.target.value as UserRole, u.name, u.role)}
                              style={{
                                padding: '4px 8px',
                                borderRadius: 'var(--radius-md)',
                                fontSize: 'var(--text-xs)',
                                fontWeight: 600,
                                outline: 'none',
                                cursor: 'pointer',
                                backgroundColor:
                                  u.role === 'admin'
                                    ? 'rgba(239, 68, 68, 0.1)'
                                    : u.role === 'author'
                                    ? 'rgba(37, 99, 235, 0.1)'
                                    : 'rgba(22, 163, 74, 0.1)',
                                color:
                                  u.role === 'admin'
                                    ? 'rgb(220, 38, 38)'
                                    : u.role === 'author'
                                    ? 'rgb(37, 99, 235)'
                                    : 'rgb(22, 163, 74)',
                                border: '1px solid currentColor',
                              }}
                            >
                              <option value="user">User</option>
                              <option value="author">Author</option>
                              <option value="admin">Admin</option>
                            </select>
                          </td>

                          {/* Status */}
                          <td style={{ padding: 'var(--space-3)' }}>
                            <span style={{
                              padding: '2px 8px',
                              borderRadius: 'var(--radius-full)',
                              fontSize: 'var(--text-xs)',
                              fontWeight: 600,
                              backgroundColor: u.status === 'active' ? 'rgba(34, 197, 94, 0.1)' : 'rgba(239, 68, 68, 0.1)',
                              color: u.status === 'active' ? 'rgb(22, 163, 74)' : 'rgb(220, 38, 38)',
                            }}>
                              {u.status}
                            </span>
                          </td>

                          {/* Actions */}
                          <td style={{ padding: 'var(--space-3)' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)' }}>
                              {u.status === 'active' ? (
                                <button
                                  type="button"
                                  onClick={() => handleStatusChange(u.id, 'suspended')}
                                  className="btn btn--ghost btn--sm"
                                  style={{ color: 'rgb(220, 38, 38)', fontSize: 'var(--text-xs)' }}
                                  title="Suspend account"
                                >
                                  Suspend
                                </button>
                              ) : (
                                <button
                                  type="button"
                                  onClick={() => handleStatusChange(u.id, 'active')}
                                  className="btn btn--ghost btn--sm"
                                  style={{ color: 'rgb(22, 163, 74)', fontSize: 'var(--text-xs)' }}
                                  title="Reactivate account"
                                >
                                  Reactivate
                                </button>
                              )}

                              {/* Permanent Delete User button */}
                              {(() => {
                                const isSelf =
                                  (profile && profile.id === u.id) ||
                                  (user && String(user.id) === String(u.id)) ||
                                  (user && user.email?.toLowerCase() === u.email.toLowerCase());
                                const isProtectedAdmin = ADMIN_EMAILS.includes(u.email.toLowerCase());
                                if (isSelf || isProtectedAdmin) return null;

                                return (
                                  <button
                                    type="button"
                                    onClick={() => handleDeleteUser(u)}
                                    className="btn btn--ghost btn--sm"
                                    style={{
                                      color: 'rgb(239, 68, 68)',
                                      fontSize: 'var(--text-xs)',
                                      display: 'inline-flex',
                                      alignItems: 'center',
                                      gap: '4px',
                                      padding: '4px 8px',
                                      borderColor: 'rgba(239, 68, 68, 0.25)',
                                    }}
                                    title={`Delete ${u.name} from everywhere`}
                                  >
                                    <Trash2 size={13} aria-hidden="true" />
                                    <span>Delete</span>
                                  </button>
                                );
                              })()}
                            </div>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>

              {/* Pagination controls */}
              {totalPages > 1 && (
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 'var(--space-4)', paddingTop: 'var(--space-4)', borderTop: '1px solid var(--color-border)', fontSize: 'var(--text-xs)', color: 'var(--color-ink-secondary)' }}>
                  <span>Page {page} of {totalPages}</span>
                  <div style={{ display: 'flex', gap: 'var(--space-2)' }}>
                    <button
                      type="button"
                      disabled={page <= 1}
                      onClick={() => setPage((p) => Math.max(1, p - 1))}
                      className="btn btn--secondary btn--sm"
                    >
                      Previous
                    </button>
                    <button
                      type="button"
                      disabled={page >= totalPages}
                      onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                      className="btn btn--secondary btn--sm"
                    >
                      Next
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Tab 2: Author Applications */}
          {activeTab === 'applications' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}>
              {/* Status Filter (Pending, Approved, Demoted, Rejected) */}
              <div style={{ display: 'flex', gap: 'var(--space-2)' }}>
                {(['pending', 'approved', 'demoted', 'rejected'] as const).map((st) => (
                  <button
                    key={st}
                    onClick={() => setAppStatusFilter(st)}
                    className={`btn btn--sm ${appStatusFilter === st ? 'btn--primary' : 'btn--secondary'}`}
                    style={{ textTransform: 'capitalize', display: 'inline-flex', alignItems: 'center', gap: '0.4rem' }}
                  >
                    <span>{st}</span>
                    {st === 'pending' && stats?.pendingApplications ? (
                      <span
                        style={{
                          backgroundColor: appStatusFilter === 'pending' ? 'rgba(255,255,255,0.25)' : 'var(--color-paper)',
                          fontSize: '11px',
                          fontWeight: 700,
                          padding: '1px 6px',
                          borderRadius: 'var(--radius-full)',
                        }}
                      >
                        {stats.pendingApplications}
                      </span>
                    ) : null}
                  </button>
                ))}
              </div>

              {appsLoading ? (
                <div style={{ textAlign: 'center', padding: 'var(--space-8)', color: 'var(--color-ink-secondary)' }}>
                  Loading applications...
                </div>
              ) : applications.length === 0 ? (
                <div style={{
                  backgroundColor: 'var(--color-surface)',
                  border: '1px solid var(--color-border)',
                  borderRadius: 'var(--radius-xl)',
                  padding: 'var(--space-8)',
                  textAlign: 'center',
                  color: 'var(--color-ink-secondary)',
                }}>
                  No author applications found under &quot;{appStatusFilter}&quot;.
                </div>
              ) : (
                applications.map((app) => {
                  const isExpanded = !!expandedAppIds[app.id];
                  const isDemoted = app.status === 'approved' && app.user?.role === 'user';

                  return (
                    <div
                      key={app.id}
                      style={{
                        backgroundColor: 'var(--color-surface)',
                        border: isDemoted ? '1px solid rgba(239, 68, 68, 0.3)' : '1px solid var(--color-border)',
                        borderRadius: 'var(--radius-xl)',
                        padding: '18px 22px',
                        boxShadow: 'var(--shadow-sm)',
                        transition: 'box-shadow 0.15s ease, border-color 0.15s ease',
                      }}
                    >
                      {/* Card Header Bar */}
                      <div
                        onClick={() => toggleExpandApp(app.id)}
                        style={{
                          display: 'flex',
                          justifyContent: 'space-between',
                          alignItems: 'center',
                          flexWrap: 'wrap',
                          gap: 'var(--space-4)',
                          cursor: 'pointer',
                          userSelect: 'none',
                        }}
                      >
                        <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-3)' }}>
                          <div
                            style={{
                              width: 42,
                              height: 42,
                              borderRadius: '50%',
                              backgroundColor: isDemoted ? '#b91c1c' : 'var(--color-ink-primary)',
                              color: '#fff',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              fontWeight: 700,
                              fontSize: '16px',
                              flexShrink: 0,
                            }}
                          >
                            {(app.user?.name || 'M').charAt(0).toUpperCase()}
                          </div>
                          <div>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)' }}>
                              <h3 style={{ fontSize: 'var(--text-base)', fontWeight: 700, margin: 0, color: 'var(--color-ink-primary)' }}>
                                {app.user?.name || `Applicant #${app.userId}`}
                              </h3>
                              {isDemoted ? (
                                <span style={{
                                  fontSize: '10px',
                                  fontWeight: 800,
                                  padding: '2px 8px',
                                  borderRadius: 'var(--radius-full)',
                                  textTransform: 'uppercase',
                                  letterSpacing: '0.05em',
                                  backgroundColor: 'rgba(239, 68, 68, 0.12)',
                                  color: 'rgb(220, 38, 38)',
                                  border: '1px solid rgba(239, 68, 68, 0.3)',
                                }}>
                                  Demoted
                                </span>
                              ) : (
                                <span style={{
                                  fontSize: '10px',
                                  fontWeight: 700,
                                  padding: '2px 8px',
                                  borderRadius: 'var(--radius-full)',
                                  textTransform: 'uppercase',
                                  letterSpacing: '0.04em',
                                  backgroundColor:
                                    app.status === 'approved'
                                      ? 'rgba(34, 197, 94, 0.1)'
                                      : app.status === 'rejected'
                                      ? 'rgba(239, 68, 68, 0.1)'
                                      : 'rgba(234, 179, 8, 0.1)',
                                  color:
                                    app.status === 'approved'
                                      ? 'rgb(22, 163, 74)'
                                      : app.status === 'rejected'
                                      ? 'rgb(220, 38, 38)'
                                      : 'rgb(161, 98, 7)',
                                }}>
                                  {app.status}
                                </span>
                              )}
                            </div>
                            <p style={{ fontSize: 'var(--text-xs)', color: 'var(--color-ink-secondary)', margin: '2px 0 0 0' }}>
                              {app.user?.email}
                              {isDemoted && <span style={{ color: 'rgb(220, 38, 38)', marginLeft: '6px' }}>• Prior author access revoked</span>}
                            </p>
                          </div>
                        </div>

                        {/* Actions & Details Toggle */}
                        <div
                          style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)' }}
                          onClick={(e) => e.stopPropagation()}
                        >
                          {app.status === 'pending' && (
                            <>
                              <button
                                type="button"
                                onClick={() => handleApproveApp(app.id)}
                                className="btn btn--primary btn--sm"
                                style={{ backgroundColor: 'rgb(22, 163, 74)', borderColor: 'rgb(22, 163, 74)', display: 'inline-flex', alignItems: 'center', gap: '0.3rem', fontSize: 'var(--text-xs)' }}
                              >
                                <CheckCircle2 size={14} /> Approve Author
                              </button>
                              <button
                                type="button"
                                onClick={() => setRejectModalAppId(app.id)}
                                className="btn btn--secondary btn--sm"
                                style={{ color: 'rgb(220, 38, 38)', display: 'inline-flex', alignItems: 'center', gap: '0.3rem', fontSize: 'var(--text-xs)' }}
                              >
                                <XCircle size={14} /> Reject
                              </button>
                            </>
                          )}

                          {isDemoted && app.user && (
                            <button
                              type="button"
                              onClick={() => handleRestoreAuthor(app.user!.id, app.user?.name)}
                              className="btn btn--primary btn--sm"
                              style={{ backgroundColor: 'rgb(37, 99, 235)', borderColor: 'rgb(37, 99, 235)', display: 'inline-flex', alignItems: 'center', gap: '0.35rem', fontSize: 'var(--text-xs)' }}
                            >
                              <RotateCcw size={13} /> Re-grant Author
                            </button>
                          )}

                          <button
                            type="button"
                            onClick={() => toggleExpandApp(app.id)}
                            className="btn btn--ghost btn--sm"
                            style={{ display: 'inline-flex', alignItems: 'center', gap: '0.3rem', fontSize: 'var(--text-xs)', padding: '6px 12px', color: 'var(--color-ink-secondary)' }}
                          >
                            <span>{isExpanded ? 'Hide' : 'Details'}</span>
                            {isExpanded ? <ChevronUp size={15} /> : <ChevronDown size={15} />}
                          </button>
                        </div>
                      </div>

                      {/* Structured Details Card (Expanded) */}
                      {isExpanded && (
                        <div
                          style={{
                            marginTop: 'var(--space-4)',
                            backgroundColor: 'var(--color-paper)',
                            border: '1px solid var(--color-border)',
                            borderRadius: 'var(--radius-lg)',
                            padding: 'var(--space-5)',
                            display: 'flex',
                            flexDirection: 'column',
                            gap: 'var(--space-4)',
                          }}
                        >
                          {/* Row 1: Bio & Hardware Experience (Balanced 2 Columns) */}
                          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 'var(--space-5)' }}>
                            <div>
                              <div style={{ fontSize: '10.5px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--color-ink-tertiary)', marginBottom: '6px' }}>
                                Maker Bio & Overview
                              </div>
                              <p style={{ fontSize: '13px', color: 'var(--color-ink-primary)', margin: 0, lineHeight: 1.6 }}>
                                {app.bio || 'No bio provided.'}
                              </p>
                            </div>

                            <div>
                              <div style={{ fontSize: '10.5px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--color-ink-tertiary)', marginBottom: '6px' }}>
                                Board & Hardware Background
                              </div>
                              {renderHardwareDetails(app.hardwareExperience)}
                            </div>
                          </div>

                          {/* Row 2: Publishing Agreement & Intent */}
                          <div style={{ paddingTop: 'var(--space-3)', borderTop: '1px solid var(--color-border)' }}>
                            <div style={{ fontSize: '10.5px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--color-ink-tertiary)', marginBottom: '4px' }}>
                              Creator Agreement & Intent
                            </div>
                            <p style={{ fontSize: '12.5px', color: 'var(--color-ink-secondary)', margin: 0, lineHeight: 1.5 }}>
                              {app.sampleProjectIdeas || 'Accepted K10 Hub Author Legal Policies and Publishing Code of Conduct.'}
                            </p>
                          </div>

                          {/* Row 3: Reference Links */}
                          {app.githubUrl && (
                            <div style={{ paddingTop: 'var(--space-3)', borderTop: '1px solid var(--color-border)', display: 'flex', alignItems: 'center', gap: 'var(--space-3)', flexWrap: 'wrap' }}>
                              <span style={{ fontSize: '10.5px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--color-ink-tertiary)' }}>
                                External Profile:
                              </span>
                              <a
                                href={app.githubUrl.startsWith('http') ? app.githubUrl : `https://${app.githubUrl}`}
                                target="_blank"
                                rel="noopener noreferrer"
                                style={{
                                  display: 'inline-flex',
                                  alignItems: 'center',
                                  gap: '0.35rem',
                                  fontSize: '12px',
                                  color: 'var(--color-accent)',
                                  textDecoration: 'none',
                                  fontWeight: 600,
                                }}
                                onClick={(e) => e.stopPropagation()}
                              >
                                <Github size={13} />
                                <span>{app.githubUrl.replace(/^https?:\/\/(www\.)?/, '')}</span>
                                <ExternalLink size={11} />
                              </a>
                            </div>
                          )}

                          {/* Row 4: Demoted Account Notice */}
                          {isDemoted && (
                            <div
                              style={{
                                padding: '12px 14px',
                                backgroundColor: 'rgba(239, 68, 68, 0.08)',
                                borderRadius: 'var(--radius-md)',
                                border: '1px solid rgba(239, 68, 68, 0.25)',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'space-between',
                                gap: 'var(--space-3)',
                                flexWrap: 'wrap',
                              }}
                            >
                              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                <ShieldAlert size={18} color="rgb(220, 38, 38)" style={{ flexShrink: 0 }} />
                                <div>
                                  <div style={{ fontWeight: 700, fontSize: '12px', color: 'rgb(220, 38, 38)' }}>
                                    Author Role Revoked
                                  </div>
                                  <div style={{ fontSize: '11px', color: 'var(--color-ink-secondary)' }}>
                                    This creator was previously approved, but is currently demoted to User.
                                  </div>
                                </div>
                              </div>

                              {app.user && (
                                <button
                                  type="button"
                                  onClick={() => handleRestoreAuthor(app.user!.id, app.user?.name)}
                                  className="btn btn--primary btn--sm"
                                  style={{ fontSize: '11px', padding: '4px 10px', display: 'inline-flex', alignItems: 'center', gap: '0.3rem' }}
                                >
                                  <RotateCcw size={12} /> Re-grant Author Role
                                </button>
                              )}
                            </div>
                          )}

                          {/* Row 5: Admin Feedback (if rejected) */}
                          {app.adminNotes && (
                            <div style={{ padding: '8px 12px', backgroundColor: 'rgba(239, 68, 68, 0.06)', borderRadius: 'var(--radius-md)', border: '1px solid rgba(239, 68, 68, 0.2)' }}>
                              <div style={{ fontSize: '10.5px', fontWeight: 700, textTransform: 'uppercase', color: 'rgb(220, 38, 38)', marginBottom: '2px' }}>
                                Admin Review Feedback
                              </div>
                              <p style={{ fontSize: '12px', color: 'var(--color-ink-primary)', margin: 0 }}>
                                {app.adminNotes}
                              </p>
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })
              )}
            </div>
          )}

          {/* Tab 3: Project Verification & Moderation */}
          {activeTab === 'projects' && (
            <div style={{
              backgroundColor: 'var(--color-surface)',
              border: '1px solid var(--color-border)',
              borderRadius: 'var(--radius-xl)',
              padding: 'var(--space-6)',
              boxShadow: 'var(--shadow-sm)',
            }}>
              {/* Header & Subtitle */}
              <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', flexWrap: 'wrap', gap: 'var(--space-3)', marginBottom: 'var(--space-6)' }}>
                <div>
                  <h2 style={{ fontSize: 'var(--text-lg)', fontWeight: 700, margin: '0 0 var(--space-1) 0', color: 'var(--color-ink-primary)' }}>
                    Project Verification &amp; Moderation Queue
                  </h2>
                  <p style={{ fontSize: 'var(--text-xs)', color: 'var(--color-ink-secondary)', margin: 0 }}>
                    Review projects submitted by authors. Only approved projects are visible on the public platform.
                  </p>
                </div>

                <Link
                  to="/projects/new"
                  className="btn btn--primary btn--sm"
                  style={{ display: 'inline-flex', alignItems: 'center', gap: '0.4rem' }}
                >
                  <FolderGit2 size={14} /> Create Official Project
                </Link>
              </div>

              {/* Filters Bar */}
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 'var(--space-3)', marginBottom: 'var(--space-6)' }}>
                {/* Search */}
                <div style={{ position: 'relative', flex: 1, minWidth: 260 }}>
                  <Search size={16} style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: 'var(--color-ink-tertiary)' }} />
                  <input
                    type="text"
                    placeholder="Search by title, author, or tags..."
                    value={projectSearchQuery}
                    onChange={(e) => setProjectSearchQuery(e.target.value)}
                    style={{
                      width: '100%',
                      padding: '8px 12px 8px 36px',
                      borderRadius: 'var(--radius-md)',
                      border: '1px solid var(--color-border)',
                      backgroundColor: 'var(--color-paper)',
                      fontSize: 'var(--text-sm)',
                      outline: 'none',
                    }}
                  />
                </div>

                {/* Status Filter Buttons */}
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap' }}>
                  {[
                    { key: 'all', label: 'All Items', count: projectsList.length },
                    { key: 'featured', label: '⭐ Featured', count: projectsList.filter(p => p.featured || p.isFeatured).length },
                    { key: 'pending_approval', label: 'Pending Review', count: projectsList.filter(p => p.status === 'pending_approval').length },
                    { key: 'published', label: 'Published & Live', count: projectsList.filter(p => p.status === 'published' || !p.status).length },
                    { key: 'draft', label: 'Drafts', count: projectsList.filter(p => p.status === 'draft').length },
                    { key: 'rejected', label: 'Rejected', count: projectsList.filter(p => p.status === 'rejected').length },
                  ].map((filterItem) => (
                    <button
                      key={filterItem.key}
                      type="button"
                      onClick={() => setProjectStatusFilter(filterItem.key as any)}
                      style={{
                        padding: '6px 12px',
                        borderRadius: 'var(--radius-full)',
                        fontSize: 'var(--text-xs)',
                        fontWeight: 600,
                        border: projectStatusFilter === filterItem.key ? '1px solid var(--color-accent)' : '1px solid var(--color-border)',
                        backgroundColor: projectStatusFilter === filterItem.key ? 'var(--color-accent)' : 'var(--color-paper)',
                        color: projectStatusFilter === filterItem.key ? '#fff' : 'var(--color-ink-secondary)',
                        cursor: 'pointer',
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '6px',
                        transition: 'all 0.15s ease',
                      }}
                    >
                      <span>{filterItem.label}</span>
                      <span
                        style={{
                          fontSize: '10px',
                          padding: '1px 5px',
                          borderRadius: '10px',
                          backgroundColor: projectStatusFilter === filterItem.key ? 'rgba(255,255,255,0.25)' : 'rgba(0,0,0,0.06)',
                          color: projectStatusFilter === filterItem.key ? '#fff' : 'var(--color-ink-primary)',
                          fontWeight: 700,
                        }}
                      >
                        {filterItem.count}
                      </span>
                    </button>
                  ))}
                </div>
              </div>

              {/* Projects Table */}
              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
                  <thead>
                    <tr style={{ borderBottom: '1px solid var(--color-border)', color: 'var(--color-ink-tertiary)', fontSize: 'var(--text-xs)', textTransform: 'uppercase' }}>
                      <th style={{ padding: 'var(--space-3)' }}>Project</th>
                      <th style={{ padding: 'var(--space-3)' }}>Author</th>
                      <th style={{ padding: 'var(--space-3)' }}>Classification</th>
                      <th style={{ padding: 'var(--space-3)' }}>Status</th>
                      <th style={{ padding: 'var(--space-3)' }}>Builds</th>
                      <th style={{ padding: 'var(--space-3)', textAlign: 'right' }}>Moderation Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {projectsList
                      .filter((p) => {
                        const matchesFilter =
                          projectStatusFilter === 'all'
                            ? true
                            : projectStatusFilter === 'featured'
                            ? Boolean(p.featured || p.isFeatured)
                            : projectStatusFilter === 'published'
                            ? p.status === 'published' || !p.status
                            : p.status === projectStatusFilter;

                        const q = projectSearchQuery.toLowerCase();
                        const matchesSearch =
                          !q ||
                          p.title.toLowerCase().includes(q) ||
                          p.author.toLowerCase().includes(q) ||
                          p.description.toLowerCase().includes(q);

                        return matchesFilter && matchesSearch;
                      })
                      .map((p) => (
                        <tr key={p.id} style={{ borderBottom: '1px solid var(--color-border)' }}>
                          {/* Project Info with thumbnail */}
                          <td style={{ padding: 'var(--space-3)' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-3)' }}>
                              <img
                                src={p.coverImage}
                                alt={p.title}
                                style={{ width: 48, height: 36, borderRadius: '6px', objectFit: 'cover', border: '1px solid var(--color-border)' }}
                              />
                              <div>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                                  <Link
                                    to={`/project/${p.id}`}
                                    style={{ fontWeight: 700, color: 'var(--color-ink-primary)', textDecoration: 'none', fontSize: 'var(--text-sm)' }}
                                  >
                                    {p.title}
                                  </Link>
                                  {(p.featured || p.isFeatured) && (
                                    <span
                                      style={{
                                        fontSize: '9px',
                                        fontWeight: 700,
                                        backgroundColor: 'rgba(245, 158, 11, 0.15)',
                                        color: '#d97706',
                                        border: '1px solid rgba(245, 158, 11, 0.35)',
                                        borderRadius: '4px',
                                        padding: '1px 5px',
                                        display: 'inline-flex',
                                        alignItems: 'center',
                                        gap: '2px',
                                        lineHeight: 1.3,
                                      }}
                                    >
                                      <Star size={9} fill="#d97706" /> FEATURED
                                    </span>
                                  )}
                                </div>
                                <div style={{ fontSize: '11px', color: 'var(--color-ink-tertiary)', fontFamily: 'monospace' }}>
                                  slug: {p.id}
                                </div>
                              </div>
                            </div>
                          </td>

                          {/* Author with UserBadge */}
                          <td style={{ padding: 'var(--space-3)' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                              <span style={{ fontSize: 'var(--text-xs)', fontWeight: 600, color: 'var(--color-ink-primary)' }}>
                                {p.author}
                              </span>
                              <UserBadge role={p.authorRole?.toLowerCase().includes('admin') ? 'admin' : 'author'} size={14} />
                            </div>
                            <div style={{ fontSize: '10px', color: 'var(--color-ink-tertiary)' }}>
                              {p.authorRole || 'Hardware Author'}
                            </div>
                          </td>

                          {/* Type */}
                          <td style={{ padding: 'var(--space-3)' }}>
                            <span
                              style={{
                                fontSize: '10px',
                                fontWeight: 700,
                                textTransform: 'uppercase',
                                padding: '2px 8px',
                                borderRadius: '4px',
                                backgroundColor: p.type?.toLowerCase() === 'tutorial' ? 'rgba(234, 179, 8, 0.15)' : 'rgba(245, 158, 11, 0.15)',
                                color: p.type?.toLowerCase() === 'tutorial' ? '#ca8a04' : '#d97706',
                              }}
                            >
                              {p.type || 'Project'}
                            </span>
                          </td>

                          {/* Status */}
                          <td style={{ padding: 'var(--space-3)' }}>
                            <span
                              style={{
                                fontSize: '11px',
                                fontWeight: 700,
                                padding: '3px 10px',
                                borderRadius: 'var(--radius-full)',
                                textTransform: 'uppercase',
                                letterSpacing: '0.04em',
                                backgroundColor:
                                  p.status === 'published' || !p.status
                                    ? 'rgba(34, 197, 94, 0.15)'
                                    : p.status === 'pending_approval'
                                    ? 'rgba(234, 179, 8, 0.15)'
                                    : p.status === 'rejected'
                                    ? 'rgba(239, 68, 68, 0.15)'
                                    : 'rgba(100, 116, 139, 0.15)',
                                color:
                                  p.status === 'published' || !p.status
                                    ? '#16a34a'
                                    : p.status === 'pending_approval'
                                    ? '#ca8a04'
                                    : p.status === 'rejected'
                                    ? '#dc2626'
                                    : '#64748b',
                                border:
                                  p.status === 'published' || !p.status
                                    ? '1px solid rgba(34, 197, 94, 0.3)'
                                    : p.status === 'pending_approval'
                                    ? '1px solid rgba(234, 179, 8, 0.3)'
                                    : p.status === 'rejected'
                                    ? '1px solid rgba(239, 68, 68, 0.3)'
                                    : '1px solid rgba(100, 116, 139, 0.3)',
                              }}
                            >
                              {p.status === 'published' || !p.status
                                ? 'Published'
                                : p.status === 'pending_approval'
                                ? 'Pending Review'
                                : p.status === 'rejected'
                                ? 'Rejected'
                                : 'Draft'}
                            </span>
                          </td>

                          {/* Firmwares count & Flashes */}
                          <td style={{ padding: 'var(--space-3)', fontSize: 'var(--text-xs)', color: 'var(--color-ink-secondary)' }}>
                            <div>{p.firmwares?.length || 0} build(s)</div>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '3px', color: 'var(--color-accent)', fontWeight: 600, fontSize: '11px', marginTop: '2px' }}>
                              <Zap size={11} fill="currentColor" /> {p.flashCount || 0} flashes
                            </div>
                          </td>

                          {/* Moderation Actions */}
                          <td style={{ padding: 'var(--space-3)', textAlign: 'right' }}>
                            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: '6px' }}>
                              {/* 1-Click Feature Toggle */}
                              <button
                                type="button"
                                onClick={() => handleToggleFeatured(p.id, p.title)}
                                className="btn btn--sm"
                                style={{
                                  backgroundColor: (p.featured || p.isFeatured) ? 'rgba(245, 158, 11, 0.15)' : 'var(--color-paper)',
                                  color: (p.featured || p.isFeatured) ? '#d97706' : 'var(--color-ink-secondary)',
                                  border: (p.featured || p.isFeatured) ? '1px solid rgba(245, 158, 11, 0.4)' : '1px solid var(--color-border)',
                                  padding: '4px 8px',
                                  fontSize: '11px',
                                  display: 'inline-flex',
                                  alignItems: 'center',
                                  gap: '4px',
                                  cursor: 'pointer',
                                }}
                                title={(p.featured || p.isFeatured) ? 'Remove from Home featured section' : 'Feature on Home page'}
                              >
                                <Star size={12} fill={(p.featured || p.isFeatured) ? '#f59e0b' : 'none'} color={(p.featured || p.isFeatured) ? '#f59e0b' : 'currentColor'} />
                                <span>{(p.featured || p.isFeatured) ? 'Featured' : 'Feature'}</span>
                              </button>

                              {/* 1-Click Approve & Publish */}
                              {(p.status !== 'published') && (
                                <button
                                  type="button"
                                  onClick={() => handleApproveProject(p.id, p.title)}
                                  className="btn btn--sm"
                                  style={{
                                    backgroundColor: '#16a34a',
                                    color: '#fff',
                                    border: 'none',
                                    padding: '4px 10px',
                                    fontSize: '11px',
                                    display: 'inline-flex',
                                    alignItems: 'center',
                                    gap: '4px',
                                  }}
                                  title="Approve and make visible on public platform"
                                >
                                  <Check size={13} /> Approve
                                </button>
                              )}

                              {/* Reject button */}
                              {p.status === 'pending_approval' && (
                                <button
                                  type="button"
                                  onClick={() => handleRejectProject(p.id, p.title)}
                                  className="btn btn--sm"
                                  style={{
                                    backgroundColor: 'rgba(239, 68, 68, 0.1)',
                                    color: '#dc2626',
                                    border: '1px solid rgba(239, 68, 68, 0.3)',
                                    padding: '4px 10px',
                                    fontSize: '11px',
                                    display: 'inline-flex',
                                    alignItems: 'center',
                                    gap: '4px',
                                  }}
                                  title="Reject submission"
                                >
                                  <X size={13} /> Reject
                                </button>
                              )}

                              <Link
                                to={`/project/${p.id}`}
                                className="btn btn--secondary btn--sm"
                                style={{ padding: '4px 8px', fontSize: '11px' }}
                                title="View Public Page"
                              >
                                <Eye size={13} />
                              </Link>

                              {isProjectAuthor(p, user, profile) && (
                                <Link
                                  to={`/project/${p.id}/edit`}
                                  className="btn btn--secondary btn--sm"
                                  style={{ padding: '4px 8px', fontSize: '11px' }}
                                  title="Edit Project Details"
                                >
                                  <Edit size={13} />
                                </Link>
                              )}

                              <button
                                type="button"
                                onClick={() => handleDeleteProject(p.id, p.title)}
                                className="btn btn--ghost btn--sm"
                                style={{ color: '#dc2626', padding: '4px 6px' }}
                                title="Delete Project"
                              >
                                <Trash2 size={14} />
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Tab 4: Broadcast Notifications Center */}
          {activeTab === 'notifications' && (
            <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1.4fr) minmax(0, 1fr)', gap: 'var(--space-6)', alignItems: 'start' }}>
              {/* Left Column: Dispatch Form */}
              <div style={{
                backgroundColor: 'var(--color-surface)',
                border: '1px solid var(--color-border)',
                borderRadius: 'var(--radius-xl)',
                padding: 'var(--space-6)',
                boxShadow: 'var(--shadow-sm)',
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-3)', marginBottom: 'var(--space-4)' }}>
                  <div style={{
                    width: 40,
                    height: 40,
                    borderRadius: 'var(--radius-lg)',
                    backgroundColor: 'rgba(99, 102, 241, 0.12)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    color: '#6366f1',
                  }}>
                    <Megaphone size={22} />
                  </div>
                  <div>
                    <h2 style={{ fontSize: 'var(--text-lg)', fontWeight: 700, margin: 0, color: 'var(--color-ink-primary)' }}>
                      Send Custom Notification
                    </h2>
                    <p style={{ fontSize: 'var(--text-xs)', color: 'var(--color-ink-secondary)', margin: '2px 0 0 0' }}>
                      Deliver in-app push announcements directly to user notification trays
                    </p>
                  </div>
                </div>

                {broadcastSuccessInfo && (
                  <div style={{
                    padding: 'var(--space-3) var(--space-4)',
                    backgroundColor: 'rgba(16, 185, 129, 0.1)',
                    border: '1px solid rgba(16, 185, 129, 0.3)',
                    borderRadius: 'var(--radius-md)',
                    color: '#059669',
                    fontSize: 'var(--text-sm)',
                    fontWeight: 600,
                    marginBottom: 'var(--space-4)',
                    display: 'flex',
                    alignItems: 'center',
                    gap: 'var(--space-2)',
                  }}>
                    <CheckCircle2 size={16} /> {broadcastSuccessInfo}
                  </div>
                )}

                <form onSubmit={handleSendBroadcast} style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-5)' }}>
                  {/* Step 1: Audience Selection */}
                  <div>
                    <label style={{ display: 'block', fontSize: 'var(--text-xs)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--color-ink-secondary)', marginBottom: 'var(--space-2)' }}>
                      1. Target Audience
                    </label>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))', gap: 'var(--space-2)' }}>
                      {[
                        { id: 'all', label: 'Send to All', desc: 'All registered accounts' },
                        { id: 'users', label: 'Send to Users', desc: 'Standard users only' },
                        { id: 'authors', label: 'Send to Authors', desc: 'Verified creators only' },
                        { id: 'specific', label: 'Particular Users', desc: 'Multi-select specific users' },
                      ].map((tgt) => (
                        <button
                          key={tgt.id}
                          type="button"
                          onClick={() => setBroadcastTarget(tgt.id as any)}
                          style={{
                            padding: 'var(--space-3)',
                            borderRadius: 'var(--radius-lg)',
                            border: `2px solid ${broadcastTarget === tgt.id ? 'var(--color-accent)' : 'var(--color-border)'}`,
                            backgroundColor: broadcastTarget === tgt.id ? 'rgba(99, 102, 241, 0.08)' : 'var(--color-paper)',
                            color: broadcastTarget === tgt.id ? 'var(--color-accent)' : 'var(--color-ink-primary)',
                            textAlign: 'left',
                            cursor: 'pointer',
                            transition: 'all 0.15s ease',
                          }}
                        >
                          <div style={{ fontWeight: 700, fontSize: 'var(--text-xs)' }}>{tgt.label}</div>
                          <div style={{ fontSize: '11px', color: 'var(--color-ink-tertiary)', marginTop: '2px' }}>{tgt.desc}</div>
                        </button>
                      ))}
                    </div>

                    {/* Particular users picker */}
                    {broadcastTarget === 'specific' && (
                      <div style={{
                        marginTop: 'var(--space-3)',
                        padding: 'var(--space-3)',
                        borderRadius: 'var(--radius-lg)',
                        backgroundColor: 'var(--color-paper)',
                        border: '1px solid var(--color-border)',
                      }}>
                        <div style={{ display: 'flex', gap: 'var(--space-2)', marginBottom: 'var(--space-2)', alignItems: 'center' }}>
                          <div style={{ position: 'relative', flex: 1 }}>
                            <Search size={14} style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: 'var(--color-ink-tertiary)' }} />
                            <input
                              type="text"
                              value={userSearchQuery}
                              onChange={(e) => setUserSearchQuery(e.target.value)}
                              placeholder="Search users by name or email..."
                              style={{
                                width: '100%',
                                paddingLeft: '32px',
                                paddingRight: '10px',
                                paddingTop: '6px',
                                paddingBottom: '6px',
                                fontSize: 'var(--text-xs)',
                                borderRadius: 'var(--radius-md)',
                                border: '1px solid var(--color-border)',
                                backgroundColor: 'var(--color-surface)',
                                color: 'var(--color-ink-primary)',
                                outline: 'none',
                              }}
                            />
                          </div>
                          <button
                            type="button"
                            onClick={() => {
                              const filtered = allUsersForSelect.filter(
                                (u) =>
                                  (u.name && u.name.toLowerCase().includes(userSearchQuery.toLowerCase())) ||
                                  u.email.toLowerCase().includes(userSearchQuery.toLowerCase())
                              );
                              setSelectedUserIds(Array.from(new Set([...selectedUserIds, ...filtered.map((u) => u.id)])));
                            }}
                            className="btn btn--secondary btn--sm"
                            style={{ fontSize: '11px', padding: '5px 8px', whiteSpace: 'nowrap' }}
                          >
                            Select Filtered
                          </button>
                          <button
                            type="button"
                            onClick={() => setSelectedUserIds([])}
                            className="btn btn--ghost btn--sm"
                            style={{ fontSize: '11px', padding: '5px 8px', whiteSpace: 'nowrap' }}
                          >
                            Clear
                          </button>
                        </div>

                        <div style={{ fontSize: '11px', color: 'var(--color-ink-secondary)', marginBottom: 'var(--space-2)', display: 'flex', justifyContent: 'space-between' }}>
                          <span>Select recipients:</span>
                          <span style={{ fontWeight: 700, color: 'var(--color-accent)' }}>
                            {selectedUserIds.length} user(s) selected
                          </span>
                        </div>

                        <div style={{
                          maxHeight: 180,
                          overflowY: 'auto',
                          display: 'flex',
                          flexDirection: 'column',
                          gap: '4px',
                          paddingRight: '4px',
                        }}>
                          {loadingAllUsers ? (
                            <div style={{ padding: 'var(--space-3)', textAlign: 'center', fontSize: 'var(--text-xs)', color: 'var(--color-ink-tertiary)' }}>
                              Loading users list...
                            </div>
                          ) : (
                            allUsersForSelect
                              .filter((u) => {
                                if (!userSearchQuery) return true;
                                const q = userSearchQuery.toLowerCase();
                                return (
                                  (u.name && u.name.toLowerCase().includes(q)) ||
                                  u.email.toLowerCase().includes(q)
                                );
                              })
                              .map((u) => {
                                const isSelected = selectedUserIds.includes(u.id);
                                return (
                                  <label
                                    key={u.id}
                                    style={{
                                      display: 'flex',
                                      alignItems: 'center',
                                      gap: '8px',
                                      padding: '5px 8px',
                                      borderRadius: 'var(--radius-md)',
                                      backgroundColor: isSelected ? 'rgba(99, 102, 241, 0.1)' : 'var(--color-surface)',
                                      border: `1px solid ${isSelected ? 'var(--color-accent)' : 'var(--color-border)'}`,
                                      cursor: 'pointer',
                                      fontSize: 'var(--text-xs)',
                                    }}
                                  >
                                    <input
                                      type="checkbox"
                                      checked={isSelected}
                                      onChange={() => toggleSelectUser(u.id)}
                                      style={{ cursor: 'pointer' }}
                                    />
                                    <div style={{
                                      width: 20,
                                      height: 20,
                                      borderRadius: '50%',
                                      backgroundColor: 'var(--color-accent)',
                                      color: '#fff',
                                      fontSize: '10px',
                                      fontWeight: 700,
                                      display: 'flex',
                                      alignItems: 'center',
                                      justifyContent: 'center',
                                      flexShrink: 0,
                                    }}>
                                      {u.name ? u.name[0].toUpperCase() : 'U'}
                                    </div>
                                    <span style={{ fontWeight: 600, color: 'var(--color-ink-primary)' }}>{u.name || u.email}</span>
                                    <span style={{ color: 'var(--color-ink-tertiary)', fontSize: '11px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', flex: 1 }}>
                                      {u.email}
                                    </span>
                                    <span style={{
                                      fontSize: '10px',
                                      padding: '1px 5px',
                                      borderRadius: 'var(--radius-full)',
                                      backgroundColor: u.role === 'admin' ? 'rgba(239, 68, 68, 0.1)' : u.role === 'author' ? 'rgba(16, 185, 129, 0.1)' : 'rgba(100, 116, 139, 0.1)',
                                      color: u.role === 'admin' ? '#ef4444' : u.role === 'author' ? '#10b981' : 'var(--color-ink-tertiary)',
                                      fontWeight: 700,
                                      textTransform: 'uppercase',
                                    }}>
                                      {u.role}
                                    </span>
                                  </label>
                                );
                              })
                          )}
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Step 2: Select Icon */}
                  <div>
                    <label style={{ display: 'block', fontSize: 'var(--text-xs)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--color-ink-secondary)', marginBottom: 'var(--space-2)' }}>
                      2. Notification Icon
                    </label>
                    <div style={{
                      display: 'grid',
                      gridTemplateColumns: 'repeat(auto-fill, minmax(44px, 1fr))',
                      gap: 'var(--space-2)',
                      padding: 'var(--space-2)',
                      backgroundColor: 'var(--color-paper)',
                      borderRadius: 'var(--radius-lg)',
                      border: '1px solid var(--color-border)',
                    }}>
                      {[
                        { id: 'bell', label: 'Default Bell', Icon: Bell, color: '#6366f1' },
                        { id: 'megaphone', label: 'Announcement', Icon: Megaphone, color: '#ec4899' },
                        { id: 'rocket', label: 'Launch', Icon: Rocket, color: '#f59e0b' },
                        { id: 'sparkles', label: 'Feature', Icon: Sparkles, color: '#8b5cf6' },
                        { id: 'zap', label: 'Flash / Milestone', Icon: Zap, color: '#eab308' },
                        { id: 'trophy', label: 'Trophy', Icon: Trophy, color: '#10b981' },
                        { id: 'award', label: 'Award', Icon: Award, color: '#06b6d4' },
                        { id: 'heart', label: 'Heart', Icon: Heart, color: '#ef4444' },
                        { id: 'message-square', label: 'Community', Icon: MessageSquare, color: '#3b82f6' },
                        { id: 'flame', label: 'Trending', Icon: Flame, color: '#f97316' },
                        { id: 'star', label: 'Star', Icon: Star, color: '#eab308' },
                        { id: 'gift', label: 'Gift', Icon: Gift, color: '#14b8a6' },
                        { id: 'info', label: 'Info', Icon: Info, color: '#0ea5e9' },
                        { id: 'alert-circle', label: 'Alert', Icon: AlertCircle, color: '#f43f5e' },
                        { id: 'shield', label: 'Security', Icon: Shield, color: '#64748b' },
                      ].map((item) => {
                        const isSelected = broadcastIcon === item.id;
                        return (
                          <button
                            key={item.id}
                            type="button"
                            title={item.label}
                            onClick={() => setBroadcastIcon(item.id)}
                            style={{
                              width: '100%',
                              aspectRatio: '1/1',
                              borderRadius: 'var(--radius-md)',
                              border: `2px solid ${isSelected ? item.color : 'transparent'}`,
                              backgroundColor: isSelected ? 'rgba(99, 102, 241, 0.15)' : 'var(--color-surface)',
                              color: item.color,
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              cursor: 'pointer',
                              transform: isSelected ? 'scale(1.08)' : 'none',
                              boxShadow: isSelected ? `0 0 10px ${item.color}40` : 'none',
                              transition: 'all 0.15s ease',
                            }}
                          >
                            <item.Icon size={20} />
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  {/* Step 3: Notification Details */}
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-3)' }}>
                    <div>
                      <label style={{ display: 'block', fontSize: 'var(--text-xs)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--color-ink-secondary)', marginBottom: '4px' }}>
                        3. Title *
                      </label>
                      <input
                        type="text"
                        required
                        value={broadcastTitle}
                        onChange={(e) => setBroadcastTitle(e.target.value)}
                        placeholder="e.g. UNIHIKER K10 PlatformIO Firmware 2.0 Released!"
                        style={{
                          width: '100%',
                          padding: '10px 12px',
                          fontSize: 'var(--text-sm)',
                          borderRadius: 'var(--radius-md)',
                          border: '1px solid var(--color-border)',
                          backgroundColor: 'var(--color-paper)',
                          color: 'var(--color-ink-primary)',
                          outline: 'none',
                        }}
                      />
                    </div>

                    <div>
                      <label style={{ display: 'block', fontSize: 'var(--text-xs)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--color-ink-secondary)', marginBottom: '4px' }}>
                        Short Description / Message *
                      </label>
                      <textarea
                        required
                        rows={3}
                        value={broadcastMessage}
                        onChange={(e) => setBroadcastMessage(e.target.value)}
                        placeholder="Write a clear, engaging notification message that will appear in user inboxes..."
                        style={{
                          width: '100%',
                          padding: '10px 12px',
                          fontSize: 'var(--text-sm)',
                          borderRadius: 'var(--radius-md)',
                          border: '1px solid var(--color-border)',
                          backgroundColor: 'var(--color-paper)',
                          color: 'var(--color-ink-primary)',
                          outline: 'none',
                          resize: 'vertical',
                        }}
                      />
                    </div>

                    <div>
                      <label style={{ display: 'block', fontSize: 'var(--text-xs)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--color-ink-secondary)', marginBottom: '4px' }}>
                        Target Destination URL (Optional)
                      </label>
                      <input
                        type="text"
                        value={broadcastUrl}
                        onChange={(e) => setBroadcastUrl(e.target.value)}
                        placeholder="e.g. /project/12 or https://unihiker.com"
                        style={{
                          width: '100%',
                          padding: '10px 12px',
                          fontSize: 'var(--text-sm)',
                          borderRadius: 'var(--radius-md)',
                          border: '1px solid var(--color-border)',
                          backgroundColor: 'var(--color-paper)',
                          color: 'var(--color-ink-primary)',
                          outline: 'none',
                        }}
                      />
                      <div style={{ fontSize: '11px', color: 'var(--color-ink-tertiary)', marginTop: '4px' }}>
                        When users click on the notification item, they will be navigated to this destination.
                      </div>
                    </div>
                  </div>

                  {/* Submit Button */}
                  <div style={{ paddingTop: 'var(--space-2)' }}>
                    <button
                      type="submit"
                      disabled={broadcastLoading}
                      className="btn btn--primary"
                      style={{
                        width: '100%',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: 'var(--space-2)',
                        padding: '12px',
                        fontSize: 'var(--text-sm)',
                        fontWeight: 700,
                        backgroundColor: '#6366f1',
                        borderColor: '#6366f1',
                      }}
                    >
                      <Send size={16} />
                      {broadcastLoading ? 'Dispatching Broadcast...' : 'Send Broadcast Notification'}
                    </button>
                  </div>
                </form>
              </div>

              {/* Right Column: Live Preview & Delivery Overview */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}>
                {/* Live Preview Card */}
                <div style={{
                  backgroundColor: 'var(--color-surface)',
                  border: '1px solid var(--color-border)',
                  borderRadius: 'var(--radius-xl)',
                  padding: 'var(--space-5)',
                  boxShadow: 'var(--shadow-sm)',
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 'var(--space-3)' }}>
                    <span style={{ fontSize: 'var(--text-xs)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--color-ink-secondary)' }}>
                      In-App Notification Live Preview
                    </span>
                    <span style={{
                      fontSize: '10px',
                      fontWeight: 700,
                      backgroundColor: 'rgba(99, 102, 241, 0.1)',
                      color: '#6366f1',
                      padding: '2px 8px',
                      borderRadius: 'var(--radius-full)',
                    }}>
                      User View
                    </span>
                  </div>

                  <div style={{
                    backgroundColor: 'var(--color-paper)',
                    borderRadius: 'var(--radius-lg)',
                    border: '1px solid var(--color-border)',
                    overflow: 'hidden',
                  }}>
                    {/* Simulated tray header */}
                    <div style={{
                      padding: '8px 12px',
                      borderBottom: '1px solid var(--color-border)',
                      fontSize: '11px',
                      color: 'var(--color-ink-tertiary)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                    }}>
                      <span>Notifications Tray (Unread)</span>
                      <span style={{ width: 8, height: 8, borderRadius: '50%', backgroundColor: '#6366f1' }} />
                    </div>

                    {/* Notification item */}
                    <div style={{
                      display: 'flex',
                      alignItems: 'flex-start',
                      gap: '12px',
                      padding: '14px',
                      backgroundColor: 'rgba(99, 102, 241, 0.04)',
                    }}>
                      {/* Icon */}
                      <div style={{
                        width: 36,
                        height: 36,
                        borderRadius: 'var(--radius-md)',
                        backgroundColor: 'rgba(99, 102, 241, 0.12)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        color: '#6366f1',
                        flexShrink: 0,
                      }}>
                        {broadcastIcon === 'megaphone' && <Megaphone size={18} />}
                        {broadcastIcon === 'rocket' && <Rocket size={18} />}
                        {broadcastIcon === 'sparkles' && <Sparkles size={18} />}
                        {broadcastIcon === 'zap' && <Zap size={18} />}
                        {broadcastIcon === 'trophy' && <Trophy size={18} />}
                        {broadcastIcon === 'award' && <Award size={18} />}
                        {broadcastIcon === 'heart' && <Heart size={18} />}
                        {broadcastIcon === 'message-square' && <MessageSquare size={18} />}
                        {broadcastIcon === 'flame' && <Flame size={18} />}
                        {broadcastIcon === 'star' && <Star size={18} />}
                        {broadcastIcon === 'gift' && <Gift size={18} />}
                        {broadcastIcon === 'info' && <Info size={18} />}
                        {broadcastIcon === 'alert-circle' && <AlertCircle size={18} />}
                        {broadcastIcon === 'shield' && <Shield size={18} />}
                        {broadcastIcon === 'bell' && <Bell size={18} />}
                      </div>

                      {/* Content */}
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '8px' }}>
                          <span style={{
                            fontSize: '13px',
                            fontWeight: 700,
                            color: 'var(--color-ink-primary)',
                            lineHeight: 1.3,
                          }}>
                            {broadcastTitle || 'Notification Title Preview'}
                          </span>
                          <span style={{ fontSize: '11px', color: 'var(--color-ink-tertiary)', whiteSpace: 'nowrap' }}>
                            Just now
                          </span>
                        </div>

                        <p style={{
                          fontSize: '12px',
                          color: 'var(--color-ink-secondary)',
                          lineHeight: 1.4,
                          margin: '4px 0 0 0',
                          wordBreak: 'break-word',
                        }}>
                          {broadcastMessage || 'Your message description will be rendered here just as the user sees it in their notification bell drawer.'}
                        </p>

                        {broadcastUrl && (
                          <div style={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '4px',
                            fontSize: '11px',
                            color: 'var(--color-accent)',
                            fontWeight: 600,
                            marginTop: '6px',
                          }}>
                            <ExternalLink size={11} /> {broadcastUrl}
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                </div>

                {/* Delivery Target Details Card */}
                <div style={{
                  backgroundColor: 'var(--color-surface)',
                  border: '1px solid var(--color-border)',
                  borderRadius: 'var(--radius-xl)',
                  padding: 'var(--space-5)',
                  boxShadow: 'var(--shadow-sm)',
                }}>
                  <h3 style={{ fontSize: 'var(--text-sm)', fontWeight: 700, margin: '0 0 var(--space-3) 0', color: 'var(--color-ink-primary)' }}>
                    Delivery Scope &amp; Info
                  </h3>

                  <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-2)', fontSize: 'var(--text-xs)' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 0', borderBottom: '1px solid var(--color-border)' }}>
                      <span style={{ color: 'var(--color-ink-secondary)' }}>Target Audience:</span>
                      <span style={{ fontWeight: 700, color: 'var(--color-ink-primary)', textTransform: 'uppercase' }}>
                        {broadcastTarget === 'specific' ? `Particular Users (${selectedUserIds.length})` : broadcastTarget}
                      </span>
                    </div>

                    <div style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 0', borderBottom: '1px solid var(--color-border)' }}>
                      <span style={{ color: 'var(--color-ink-secondary)' }}>Delivery Medium:</span>
                      <span style={{ fontWeight: 600, color: 'var(--color-ink-primary)' }}>In-App Bell &amp; Persistent DB</span>
                    </div>

                    <div style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 0', borderBottom: '1px solid var(--color-border)' }}>
                      <span style={{ color: 'var(--color-ink-secondary)' }}>Selected Icon:</span>
                      <span style={{ fontWeight: 600, color: 'var(--color-ink-primary)', textTransform: 'capitalize' }}>
                        {broadcastIcon}
                      </span>
                    </div>

                    <div style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 0' }}>
                      <span style={{ color: 'var(--color-ink-secondary)' }}>Destination Click:</span>
                      <span style={{ fontWeight: 600, color: broadcastUrl ? 'var(--color-accent)' : 'var(--color-ink-tertiary)' }}>
                        {broadcastUrl ? 'Interactive URL Navigation' : 'Mark as Read'}
                      </span>
                    </div>
                  </div>
                </div>

                {/* System Triggers Info */}
                <div style={{
                  backgroundColor: 'var(--color-surface)',
                  border: '1px solid var(--color-border)',
                  borderRadius: 'var(--radius-xl)',
                  padding: 'var(--space-5)',
                  boxShadow: 'var(--shadow-sm)',
                }}>
                  <h3 style={{ fontSize: 'var(--text-sm)', fontWeight: 700, margin: '0 0 var(--space-2) 0', color: 'var(--color-ink-primary)' }}>
                    Automatic System Triggers Active
                  </h3>
                  <p style={{ fontSize: '11px', color: 'var(--color-ink-secondary)', margin: '0 0 var(--space-3) 0', lineHeight: 1.4 }}>
                    In addition to manual admin broadcasts, the system automatically dispatches in-app notifications for:
                  </p>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', fontSize: '11px', color: 'var(--color-ink-primary)' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <Zap size={13} color="#eab308" />
                      <span><strong>Flash Milestones:</strong> 10, 50, 100, 1000 complete flashes</span>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <Heart size={13} color="#ef4444" />
                      <span><strong>Project Engagement:</strong> Likes on user's projects</span>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <MessageSquare size={13} color="#3b82f6" />
                      <span><strong>Comments &amp; Replies:</strong> New comments and looped thread replies</span>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <Award size={13} color="#06b6d4" />
                      <span><strong>Author Review:</strong> Application approval or rejection notes</span>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <CheckCircle2 size={13} color="#10b981" />
                      <span><strong>Project Approvals:</strong> Moderation approvals for public showcase</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      </main>

      {/* Reject Modal */}
      {rejectModalAppId && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          backgroundColor: 'rgba(0, 0, 0, 0.6)',
          backdropFilter: 'blur(4px)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 999,
          padding: 'var(--space-4)',
        }}>
          <div style={{
            backgroundColor: 'var(--color-surface)',
            border: '1px solid var(--color-border)',
            borderRadius: 'var(--radius-xl)',
            width: '100%',
            maxWidth: 480,
            padding: 'var(--space-6)',
            boxShadow: 'var(--shadow-xl)',
          }}>
            <h3 style={{ fontSize: 'var(--text-lg)', fontWeight: 700, margin: '0 0 var(--space-2) 0', color: 'var(--color-ink-primary)' }}>
              Reject Author Application
            </h3>
            <p style={{ fontSize: 'var(--text-sm)', color: 'var(--color-ink-secondary)', margin: '0 0 var(--space-4) 0' }}>
              Provide constructive feedback to the applicant on why their request was not approved at this time.
            </p>

            <textarea
              rows={3}
              value={rejectNotes}
              onChange={(e) => setRejectNotes(e.target.value)}
              placeholder="e.g. Please include more details about your UNIHIKER K10 hardware build plans or link to past Arduino/PlatformIO repositories."
              style={{
                width: '100%',
                padding: '10px 12px',
                backgroundColor: 'var(--color-paper)',
                border: '1px solid var(--color-border)',
                borderRadius: 'var(--radius-md)',
                fontSize: 'var(--text-sm)',
                outline: 'none',
                marginBottom: 'var(--space-4)',
              }}
            />

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 'var(--space-2)' }}>
              <button
                type="button"
                onClick={() => setRejectModalAppId(null)}
                className="btn btn--secondary btn--sm"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleRejectApp}
                className="btn btn--primary btn--sm"
                style={{ backgroundColor: 'rgb(220, 38, 38)', borderColor: 'rgb(220, 38, 38)' }}
              >
                Confirm Rejection
              </button>
            </div>
          </div>
        </div>
      )}

      <Footer />
    </div>
  );
}
