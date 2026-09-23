import React, { useState, useEffect, useMemo } from 'react';
import { Link, useSearchParams, useLocation, useParams, useNavigate } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { api } from '../../services/api';
import Header from '../../components/layout/Header';
import Footer from '../../components/layout/Footer';
import ProjectCard from '../../components/projects/ProjectCard';
import {
  Shield,
  Cpu,
  CheckCircle2,
  Clock,
  AlertCircle,
  LogOut,
  Sparkles,
  ExternalLink,
  Github,
  Award,
  Edit3,
  Globe,
  Instagram,
  Youtube,
  Linkedin,
  FolderGit2,
  Eye,
  Plus,
  BookOpen,
  Trash2,
  ShieldAlert,
  Mail,
  ArrowLeft,
  Lock,
  AlertTriangle,
  Bookmark,
  Copy,
  Check,
  Search,
  X,
} from 'lucide-react';
import { ProjectDetail } from '../../config/projectsData';
import { toast } from '../../contexts/ToastContext';
import { containsInappropriateWords, censorBadWords, validateUrl } from '../../utils/contentModeration';
import {
  getUserBookmarkedProjects,
  fetchUserBookmarksFromDb,
  toggleProjectBookmark,
  subscribeCommunity,
} from '../../services/community/communityService';
import {
  getAllProjects,
  refreshProjectsFromBackend,
  deleteProject,
  subscribeProjects,
  isProjectAuthor,
  syncAuthorProfileAcrossProjects,
  syncCurrentUserProjects,
  saveKnownAuthor,
} from '../../services/projects/projectStorageService';
import UserBadge, { isKnownAdmin } from '../../components/common/UserBadge';

const getNameLockStorageKey = (idOrEmail: string) => `k10_name_locked_${idOrEmail.trim().toLowerCase()}`;

function isNameChangeLocked(idOrEmail?: string): boolean {
  if (!idOrEmail) return false;
  return localStorage.getItem(getNameLockStorageKey(idOrEmail)) === 'true';
}

function lockNameChange(idOrEmail?: string): void {
  if (!idOrEmail) return;
  localStorage.setItem(getNameLockStorageKey(idOrEmail), 'true');
}

export default function ProfilePage() {
  const {
    user,
    profile,
    application,
    role,
    isEmailVerified,
    loading,
    signOut,
    applyAuthor,
    updateProfile,
    refreshProfile,
  } = useAuth();

  const navigate = useNavigate();
  const { identifier } = useParams<{ identifier?: string }>();
  const [searchParams, setSearchParams] = useSearchParams();
  const location = useLocation();

  // Redirect to home page if user is not authenticated and trying to view own profile (/profile)
  useEffect(() => {
    if (!identifier && !loading && !user) {
      navigate('/', { replace: true });
    }
  }, [identifier, loading, user, navigate]);

  const isSelf = Boolean(
    identifier &&
    (
      (profile?.id && String(profile.id).toLowerCase() === identifier.toLowerCase()) ||
      (profile?.userKey && profile.userKey.toLowerCase() === identifier.toLowerCase()) ||
      (user?.id && String(user.id).toLowerCase() === identifier.toLowerCase()) ||
      (profile?.name && profile.name.toLowerCase() === identifier.toLowerCase()) ||
      (user?.user_metadata?.name && user.user_metadata.name.toLowerCase() === identifier.toLowerCase()) ||
      (user?.email && user.email.toLowerCase() === identifier.toLowerCase()) ||
      (user?.email && user.email.split('@')[0].toLowerCase() === identifier.toLowerCase())
    )
  );

  const isOwnProfile = !identifier || isSelf;
  const [publicUser, setPublicUser] = useState<any>(null);
  const [copiedKey, setCopiedKey] = useState(false);

  useEffect(() => {
    if (!isOwnProfile && identifier) {
      api.auth.getPublicProfile(identifier)
        .then((res) => {
          if (res && res.user) {
            setPublicUser(res.user);
            saveKnownAuthor({
              id: res.user.id ? String(res.user.id) : undefined,
              name: res.user.name,
              avatarUrl: res.user.avatarUrl || undefined,
              role: res.user.role,
              email: res.user.email,
            });
          }
        })
        .catch(() => {});
    }
  }, [isOwnProfile, identifier]);

  // Ensure current user's projects are linked and synchronized
  useEffect(() => {
    if (user || profile) {
      syncCurrentUserProjects(user, profile);
    }
  }, [user, profile]);

  // Author Project / Tutorial Management State (Filtered to author)
  const [allProjects, setAllProjects] = useState<ProjectDetail[]>(() => getAllProjects());

  useEffect(() => {
    setAllProjects(getAllProjects());
    refreshProjectsFromBackend().catch(() => {});
    const unsubscribe = subscribeProjects((updated) => {
      setAllProjects(updated);
    });
    return unsubscribe;
  }, [user, profile]);

  // Find projects published by this public author
  const cleanParamId = (identifier || '').trim().toLowerCase();
  const publicAuthorProjects = useMemo(() => {
    if (isOwnProfile) return [];
    return allProjects.filter((p) => {
      if (p.status !== 'published' && p.status) return false;
      const matchId = p.authorId && p.authorId.toLowerCase() === cleanParamId;
      const matchName = p.author && p.author.toLowerCase() === cleanParamId;
      const matchEmail = p.authorEmail && p.authorEmail.toLowerCase() === cleanParamId;
      const matchPrefix = p.authorEmail && p.authorEmail.split('@')[0].toLowerCase() === cleanParamId;
      return matchId || matchName || matchEmail || matchPrefix;
    });
  }, [allProjects, isOwnProfile, cleanParamId]);

  const publicSampleProject = publicAuthorProjects[0];

  const projectsList = isOwnProfile
    ? allProjects.filter((p) => isProjectAuthor(p, user, profile))
    : publicAuthorProjects;

  // Bookmarked projects
  const [bookmarkedProjects, setBookmarkedProjects] = useState<ProjectDetail[]>(() =>
    getUserBookmarkedProjects(user?.id ? String(user.id) : undefined, profile?.id ? String(profile.id) : undefined)
  );

  useEffect(() => {
    const updateBookmarks = () => {
      setBookmarkedProjects(
        getUserBookmarkedProjects(user?.id ? String(user.id) : undefined, profile?.id ? String(profile.id) : undefined)
      );
    };
    updateBookmarks();

    if (user?.id || profile?.id) {
      fetchUserBookmarksFromDb(user?.id ? String(user.id) : undefined, profile?.id ? String(profile.id) : undefined)
        .then(() => updateBookmarks())
        .catch(() => {});
    }

    const unsub = subscribeCommunity(updateBookmarks);
    return unsub;
  }, [user?.id, profile?.id]);

  const resolveInitialTab = (): 'published' | 'draft' | 'pending_approval' | 'bookmarked' => {
    const tabParam = searchParams.get('tab');
    if (tabParam === 'draft') return 'draft';
    if (tabParam === 'review' || tabParam === 'pending_approval') return 'pending_approval';
    if (tabParam === 'published') return 'published';
    if (tabParam === 'bookmarked' || tabParam === 'bookmarks' || tabParam === 'saved') {
      return bookmarkedProjects.length > 0 ? 'bookmarked' : 'published';
    }
    if (location.hash === '#draft' || location.hash === '#drafts') return 'draft';
    if (location.hash === '#review') return 'pending_approval';
    if (location.hash === '#bookmarks' || location.hash === '#saved') {
      return bookmarkedProjects.length > 0 ? 'bookmarked' : 'published';
    }
    if (role === 'user' && isOwnProfile) {
      return bookmarkedProjects.length > 0 ? 'bookmarked' : 'published';
    }
    return 'published';
  };

  const [projectStatusFilter, setProjectStatusFilter] = useState<'published' | 'draft' | 'pending_approval' | 'bookmarked'>(resolveInitialTab);

  // Default tab to bookmarked for regular users if they have bookmarks
  useEffect(() => {
    if (role === 'user' && isOwnProfile && projectStatusFilter !== 'bookmarked' && bookmarkedProjects.length > 0) {
      const tabParam = searchParams.get('tab');
      if (!tabParam || tabParam === 'published') {
        setProjectStatusFilter('bookmarked');
      }
    }
  }, [role, isOwnProfile, searchParams, bookmarkedProjects.length]);

  // If there are no bookmarks and current tab is bookmarked, revert to published
  useEffect(() => {
    if (projectStatusFilter === 'bookmarked' && bookmarkedProjects.length === 0) {
      setProjectStatusFilter('published');
      setSearchParams((prev) => {
        const next = new URLSearchParams(prev);
        if (next.get('tab') === 'bookmarked' || next.get('tab') === 'bookmarks' || next.get('tab') === 'saved') {
          next.delete('tab');
        }
        return next;
      }, { replace: true });
    }
  }, [projectStatusFilter, bookmarkedProjects.length, setSearchParams]);

  // Sync tab with URL search parameter or hash
  useEffect(() => {
    const tabParam = searchParams.get('tab');
    if (tabParam === 'draft') {
      setProjectStatusFilter('draft');
    } else if (tabParam === 'review' || tabParam === 'pending_approval') {
      setProjectStatusFilter('pending_approval');
    } else if (tabParam === 'published') {
      setProjectStatusFilter('published');
    } else if (tabParam === 'bookmarked' || tabParam === 'bookmarks' || tabParam === 'saved') {
      if (bookmarkedProjects.length > 0) {
        setProjectStatusFilter('bookmarked');
      } else {
        setProjectStatusFilter('published');
      }
    } else if (location.hash === '#draft' || location.hash === '#drafts') {
      setProjectStatusFilter('draft');
    } else if (location.hash === '#review') {
      setProjectStatusFilter('pending_approval');
    } else if (location.hash === '#bookmarks' || location.hash === '#saved') {
      if (bookmarkedProjects.length > 0) {
        setProjectStatusFilter('bookmarked');
      } else {
        setProjectStatusFilter('published');
      }
    }
  }, [searchParams, location.hash, bookmarkedProjects.length]);

  const handleSelectTab = (tabId: 'published' | 'draft' | 'pending_approval' | 'bookmarked') => {
    setProjectStatusFilter(tabId);
    setSearchParams((prev) => {
      const next = new URLSearchParams(prev);
      next.set('tab', tabId === 'pending_approval' ? 'review' : tabId);
      return next;
    }, { replace: true });
  };

  const [projectTypeFilter, setProjectTypeFilter] = useState<'all' | 'Project' | 'Tutorial'>('all');

  const statusFilteredProjects = useMemo(() => {
    if (projectStatusFilter === 'bookmarked') {
      return bookmarkedProjects;
    }
    return projectsList.filter((p) => {
      if (!isOwnProfile) return p.status === 'published' || !p.status;
      if (projectStatusFilter === 'published') return p.status === 'published' || !p.status;
      return p.status === projectStatusFilter;
    });
  }, [projectsList, isOwnProfile, projectStatusFilter, bookmarkedProjects]);

  const [searchQuery, setSearchQuery] = useState('');

  const displayedProjects = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return statusFilteredProjects.filter((p) => {
      if (projectTypeFilter !== 'all') {
        const pType = (p.type || 'Project').toLowerCase();
        if (pType !== projectTypeFilter.toLowerCase()) return false;
      }
      if (!q) return true;
      const titleMatch = (p.title || '').toLowerCase().includes(q);
      const descMatch = (p.description || '').toLowerCase().includes(q);
      const tagMatch = Array.isArray(p.tags) && p.tags.some((t: string) => t.toLowerCase().includes(q));
      const authorMatch = (p.author || '').toLowerCase().includes(q);
      return titleMatch || descMatch || tagMatch || authorMatch;
    });
  }, [statusFilteredProjects, projectTypeFilter, searchQuery]);

  // Pagination / Load More batching (6 items at a time)
  const [visibleLimit, setVisibleLimit] = useState(6);

  useEffect(() => {
    setVisibleLimit(6);
  }, [projectStatusFilter, projectTypeFilter, searchQuery]);

  const visibleProjects = useMemo(() => {
    return displayedProjects.slice(0, visibleLimit);
  }, [displayedProjects, visibleLimit]);

  const typeCounts = useMemo(() => {
    return {
      all: statusFilteredProjects.length,
      project: statusFilteredProjects.filter(p => (p.type || 'Project').toLowerCase() === 'project').length,
      tutorial: statusFilteredProjects.filter(p => (p.type || '').toLowerCase() === 'tutorial').length,
    };
  }, [statusFilteredProjects]);

  const handleDeleteProject = (id: string, title: string) => {
    toast.confirm({
      title: 'Delete Project',
      message: `Are you sure you want to delete "${title}"? This will permanently remove the project and its firmware binaries.`,
      confirmLabel: 'Delete',
      cancelLabel: 'Cancel',
      type: 'danger',
      onConfirm: () => {
        deleteProject(id);
        toast.success(`Project "${title}" has been deleted.`);
      },
    });
  };

  // Author Application Modal state
  const [showApplyModal, setShowApplyModal] = useState(false);
  const [appWhoYouAre, setAppWhoYouAre] = useState('');
  const [appPortfolioUrl, setAppPortfolioUrl] = useState('');
  const [workedOnUnihiker, setWorkedOnUnihiker] = useState(false);
  const [unihikerProjectUrl, setUnihikerProjectUrl] = useState('');
  const [acceptPolicies, setAcceptPolicies] = useState(false);
  const [appSubmitError, setAppSubmitError] = useState('');
  const [appSubmitting, setAppSubmitting] = useState(false);
  const [appFieldErrors, setAppFieldErrors] = useState<{ whoYouAre?: string; unihikerUrl?: string; policies?: string }>({});

  // Profile Edit Modal state
  const [showEditModal, setShowEditModal] = useState(false);
  const [editName, setEditName] = useState('');
  const [editAvatarUrl, setEditAvatarUrl] = useState('');
  const [editBio, setEditBio] = useState('');
  const [editGithubUrl, setEditGithubUrl] = useState('');
  const [editSocialPlatform, setEditSocialPlatform] = useState('');
  const [editSocialUrl, setEditSocialUrl] = useState('');
  const [editInstagramUrl, setEditInstagramUrl] = useState('');
  const [editYoutubeUrl, setEditYoutubeUrl] = useState('');
  const [editLinkedinUrl, setEditLinkedinUrl] = useState('');
  const [editWebsiteUrl, setEditWebsiteUrl] = useState('');
  const [editSubmitting, setEditSubmitting] = useState(false);
  const [editError, setEditError] = useState('');
  const [editSuccessMsg, setEditSuccessMsg] = useState('');
  const [editFieldErrors, setEditFieldErrors] = useState<{ name?: string }>({});

  const userKey = useMemo(() => {
    return String(profile?.id || user?.id || profile?.email || user?.email || '').trim().toLowerCase();
  }, [profile, user]);

  const [isNameLocked, setIsNameLocked] = useState<boolean>(() => isNameChangeLocked(userKey));

  useEffect(() => {
    if (userKey) {
      setIsNameLocked(isNameChangeLocked(userKey));
    }
  }, [userKey, showEditModal]);

  // Only initialize defaults on initial load, NEVER overwrite while modal is open or tab is switched
  const hasInitializedEdit = React.useRef(false);
  useEffect(() => {
    if (profile && !hasInitializedEdit.current && !showEditModal) {
      hasInitializedEdit.current = true;
      setEditName(profile.name || user?.user_metadata?.name || '');
      setEditAvatarUrl(profile.avatarUrl || user?.user_metadata?.avatar_url || '');
      setEditBio(profile.bio || profile.author?.bio || '');
      setEditGithubUrl(profile.githubUrl || profile.author?.githubUrl || '');
      setEditSocialPlatform(profile.socialPlatform || profile.author?.socialPlatform || 'Instagram');
      setEditSocialUrl(profile.socialUrl || profile.author?.socialUrl || '');
      setEditInstagramUrl(profile.instagramUrl || profile.author?.instagramUrl || '');
      setEditYoutubeUrl(profile.youtubeUrl || profile.author?.youtubeUrl || '');
      setEditLinkedinUrl(profile.linkedinUrl || profile.author?.linkedinUrl || '');
      setEditWebsiteUrl(profile.websiteUrl || profile.author?.websiteUrl || '');
    }
  }, [profile, user, showEditModal]);

  const handleOpenEditModal = () => {
    setEditError('');
    setEditSuccessMsg('');
    setEditFieldErrors({});
    if (userKey) {
      setIsNameLocked(isNameChangeLocked(userKey));
    }
    if (profile) {
      setEditName(profile.name || user?.user_metadata?.name || '');
      setEditAvatarUrl(profile.avatarUrl || user?.user_metadata?.avatar_url || '');
      setEditBio(profile.bio || profile.author?.bio || '');
      setEditGithubUrl(profile.githubUrl || profile.author?.githubUrl || '');
      setEditSocialPlatform(profile.socialPlatform || profile.author?.socialPlatform || 'Instagram');
      setEditSocialUrl(profile.socialUrl || profile.author?.socialUrl || '');
      setEditInstagramUrl(profile.instagramUrl || profile.author?.instagramUrl || '');
      setEditYoutubeUrl(profile.youtubeUrl || profile.author?.youtubeUrl || '');
      setEditLinkedinUrl(profile.linkedinUrl || profile.author?.linkedinUrl || '');
      setEditWebsiteUrl(profile.websiteUrl || profile.author?.websiteUrl || '');
    }
    setShowEditModal(true);
  };

  const handleOpenApplyModal = () => {
    if (application && application.status === 'approved' && role === 'user') {
      toast.error('You were previously an approved Author and your role was demoted. Please contact the Platform Administrator at admin@k10hub.io to request reinstatement.');
      return;
    }
    setAppSubmitError('');
    setAppFieldErrors({});
    setShowApplyModal(true);
  };

  const handleSignOut = async () => {
    await signOut();
    navigate('/');
  };

  const handleApplySubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setAppSubmitError('');
    const errors: { whoYouAre?: string; unihikerUrl?: string; policies?: string } = {};

    if (!appWhoYouAre.trim()) {
      errors.whoYouAre = 'This field is required. Please tell us who you are.';
    }

    if (workedOnUnihiker && !unihikerProjectUrl.trim()) {
      errors.unihikerUrl = 'Project or repository URL is required when UNIHIKER board experience is checked.';
    }

    if (!acceptPolicies) {
      errors.policies = 'You must read and accept the Author Legal Policies to proceed.';
    }

    if (Object.keys(errors).length > 0) {
      setAppFieldErrors(errors);
      setAppSubmitError('Please fill in all required fields marked with * and accept the legal policies.');
      return;
    }

    if (containsInappropriateWords(appWhoYouAre)) {
      setAppSubmitError('Inappropriate language detected. K10 Hub is a professional platform for all age groups.');
      return;
    }

    if (appPortfolioUrl.trim() && !validateUrl(appPortfolioUrl, 'Portfolio URL').isValid) {
      setAppSubmitError(validateUrl(appPortfolioUrl, 'Portfolio URL').error || 'Invalid Portfolio URL');
      return;
    }

    if (unihikerProjectUrl.trim() && !validateUrl(unihikerProjectUrl, 'Project URL').isValid) {
      setAppSubmitError(validateUrl(unihikerProjectUrl, 'Project URL').error || 'Invalid Project URL');
      return;
    }

    setAppFieldErrors({});
    setAppSubmitting(true);

    const hardwareExp = workedOnUnihiker
      ? `Worked on UNIHIKER: Yes (${unihikerProjectUrl.trim()})`
      : 'Worked on UNIHIKER: No (New to UNIHIKER)';

    const res = await applyAuthor({
      bio: censorBadWords(appWhoYouAre.trim()),
      githubUrl: appPortfolioUrl.trim() || undefined,
      hardwareExperience: hardwareExp,
      sampleProjectIdeas: 'Accepted K10 Hub Author Legal Policies and Publishing Code of Conduct.',
      workedOnUnihiker,
      unihikerProjectUrl: unihikerProjectUrl.trim() || undefined,
      acceptedTerms: acceptPolicies,
    });

    setAppSubmitting(false);

    if (!res.success) {
      setAppSubmitError(res.error || 'Failed to submit application');
    } else {
      setShowApplyModal(false);
      await refreshProfile();
    }
  };

  const executeSaveProfile = async (shouldLockName: boolean) => {
    if (editName.trim() && containsInappropriateWords(editName)) {
      setEditError('Inappropriate language detected in Name. K10 Hub is a professional platform for all age groups.');
      toast.warning('Inappropriate language detected in Name.');
      return;
    }

    if (editBio.trim() && containsInappropriateWords(editBio)) {
      setEditError('Inappropriate language detected in Bio. K10 Hub is a professional platform for all age groups.');
      toast.warning('Inappropriate language detected in Bio.');
      return;
    }

    const linksToValidate = [
      { url: editGithubUrl, name: 'GitHub Link' },
      { url: editSocialUrl, name: 'Social Link' },
      { url: editInstagramUrl, name: 'Instagram Link' },
      { url: editYoutubeUrl, name: 'YouTube Link' },
      { url: editLinkedinUrl, name: 'LinkedIn Link' },
      { url: editWebsiteUrl, name: 'Website Link' },
    ];

    for (const link of linksToValidate) {
      if (link.url.trim()) {
        const v = validateUrl(link.url, link.name);
        if (!v.isValid) {
          setEditError(v.error || `Invalid ${link.name}`);
          toast.error(v.error || `Invalid ${link.name}`);
          return;
        }
      }
    }

    setEditSubmitting(true);

    const res = await updateProfile({
      name: censorBadWords(editName.trim()) || undefined,
      avatarUrl: editAvatarUrl.trim() || undefined,
      bio: censorBadWords(editBio.trim()) || undefined,
      githubUrl: editGithubUrl.trim() || undefined,
      socialPlatform: editSocialPlatform || undefined,
      socialUrl: editSocialUrl.trim() || undefined,
      instagramUrl: editInstagramUrl.trim() || undefined,
      youtubeUrl: editYoutubeUrl.trim() || undefined,
      linkedinUrl: editLinkedinUrl.trim() || undefined,
      websiteUrl: editWebsiteUrl.trim() || undefined,
    });

    setEditSubmitting(false);

    if (!res.success) {
      setEditError(res.error || 'Failed to save profile changes');
      toast.error(res.error || 'Failed to save profile changes');
    } else {
      if (shouldLockName && userKey) {
        lockNameChange(userKey);
        setIsNameLocked(true);
      }

      // Synchronize updated author profile across all projects owned by this user
      syncAuthorProfileAcrossProjects(
        {
          id: profile?.id || user?.id,
          email: profile?.email || user?.email,
          name: profile?.name || user?.user_metadata?.name || user?.user_metadata?.full_name,
        },
        {
          name: editName.trim(),
          avatarUrl: editAvatarUrl.trim(),
          role: role,
          email: profile?.email || user?.email,
        }
      );

      toast.success(shouldLockName ? 'Profile updated and display name permanently locked!' : 'Profile updated successfully!');
      setEditSuccessMsg('Profile updated successfully!');
      setTimeout(() => {
        setEditSuccessMsg('');
        setShowEditModal(false);
      }, 700);
    }
  };

  const handleEditProfileSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setEditError('');
    setEditSuccessMsg('');
    setEditFieldErrors({});

    const trimmedName = editName.trim();
    if (!trimmedName) {
      setEditFieldErrors({ name: 'Display Name is required.' });
      setEditError('Please fill in the required Display Name.');
      return;
    }

    const currentSavedName = (profile?.name || user?.user_metadata?.name || user?.user_metadata?.full_name || '').trim();
    const isNameAltered = trimmedName !== currentSavedName;

    if (isNameAltered && isNameLocked) {
      toast.error('Display Name cannot be changed. The lifetime one-time limit has been reached.');
      setEditName(currentSavedName);
      return;
    }

    if (isNameAltered && !isNameLocked) {
      toast.confirm({
        title: 'Confirm Lifetime Name Change',
        message: `Are you sure you want to change your Display Name to "${trimmedName}"? You can only change your name ONCE in your account's lifetime. Once saved, it will be permanently locked and cannot be changed again.`,
        confirmLabel: 'Confirm & Lock Name',
        cancelLabel: 'Cancel',
        type: 'warning',
        onConfirm: async () => {
          await executeSaveProfile(true);
        },
      });
      return;
    }

    // Name did not change, saving other profile fields
    await executeSaveProfile(false);
  };

  const displayName = isOwnProfile
    ? (profile?.name || user?.user_metadata?.name || user?.email?.split('@')[0] || 'Maker')
    : (publicUser?.name || publicSampleProject?.author || decodeURIComponent(identifier || 'Creator'));

  const displayEmail = isOwnProfile ? (profile?.email || user?.email || '') : '';
  const displayUserKey = isOwnProfile
    ? (profile?.userKey || user?.user_metadata?.user_key || user?.user_metadata?.userKey)
    : (publicUser?.userKey || null);
  const avatarUrl = isOwnProfile
    ? (profile?.avatarUrl || user?.user_metadata?.avatar_url)
    : (publicUser?.avatarUrl || publicSampleProject?.authorAvatar);

  const rawRole = isOwnProfile
    ? role
    : (publicUser?.role || publicSampleProject?.authorRole || 'author');

  const roleToDisplay = isKnownAdmin({
    name: displayName,
    email: isOwnProfile ? displayEmail : (publicUser?.email || publicSampleProject?.authorEmail),
    role: rawRole,
  })
    ? 'admin'
    : rawRole;

  const bio = isOwnProfile
    ? (profile?.bio || profile?.author?.bio || '')
    : (publicUser?.bio || `Hardware developer and creator on UNIHIKER K10 Platform. Published ${publicAuthorProjects.length} build(s).`);

  const githubUrl = isOwnProfile
    ? (profile?.githubUrl || profile?.author?.githubUrl || '')
    : (publicUser?.githubUrl || '');

  const socialPlatform = isOwnProfile ? (profile?.socialPlatform || profile?.author?.socialPlatform || '') : (publicUser?.socialPlatform || '');
  const socialUrl = isOwnProfile ? (profile?.socialUrl || profile?.author?.socialUrl || '') : (publicUser?.socialUrl || '');
  const instagramUrl = isOwnProfile ? (profile?.instagramUrl || profile?.author?.instagramUrl || '') : (publicUser?.instagramUrl || '');
  const youtubeUrl = isOwnProfile ? (profile?.youtubeUrl || profile?.author?.youtubeUrl || '') : (publicUser?.youtubeUrl || '');
  const linkedinUrl = isOwnProfile ? (profile?.linkedinUrl || profile?.author?.linkedinUrl || '') : (publicUser?.linkedinUrl || '');
  const websiteUrl = isOwnProfile ? (profile?.websiteUrl || profile?.author?.websiteUrl || '') : (publicUser?.websiteUrl || '');

  // Consolidate social links list for display
  const socialLinks: { label: string; url: string; icon: React.ReactNode; color: string }[] = [];

  if (githubUrl) {
    socialLinks.push({
      label: 'GitHub',
      url: githubUrl.startsWith('http') ? githubUrl : `https://${githubUrl}`,
      icon: <Github size={14} />,
      color: 'var(--color-ink-primary)',
    });
  }

  if (instagramUrl) {
    socialLinks.push({
      label: 'Instagram',
      url: instagramUrl.startsWith('http') ? instagramUrl : `https://${instagramUrl}`,
      icon: <Instagram size={14} />,
      color: '#E4405F',
    });
  }

  if (youtubeUrl) {
    socialLinks.push({
      label: 'YouTube',
      url: youtubeUrl.startsWith('http') ? youtubeUrl : `https://${youtubeUrl}`,
      icon: <Youtube size={14} />,
      color: '#FF0000',
    });
  }

  if (linkedinUrl) {
    socialLinks.push({
      label: 'LinkedIn',
      url: linkedinUrl.startsWith('http') ? linkedinUrl : `https://${linkedinUrl}`,
      icon: <Linkedin size={14} />,
      color: '#0A66C2',
    });
  }

  if (websiteUrl) {
    socialLinks.push({
      label: 'Website',
      url: websiteUrl.startsWith('http') ? websiteUrl : `https://${websiteUrl}`,
      icon: <Globe size={14} />,
      color: 'var(--color-accent)',
    });
  }

  // If user specified a custom social platform & url not already added
  if (socialUrl && !socialLinks.some((l) => l.url.includes(socialUrl))) {
    const platLower = (socialPlatform || 'Social').toLowerCase();
    let icon = <Globe size={14} />;
    let color = 'var(--color-accent)';
    if (platLower.includes('insta')) {
      icon = <Instagram size={14} />;
      color = '#E4405F';
    } else if (platLower.includes('youtu')) {
      icon = <Youtube size={14} />;
      color = '#FF0000';
    } else if (platLower.includes('linked')) {
      icon = <Linkedin size={14} />;
      color = '#0A66C2';
    }

    socialLinks.push({
      label: socialPlatform || 'Social',
      url: socialUrl.startsWith('http') ? socialUrl : `https://${socialUrl}`,
      icon,
      color,
    });
  }

  return (
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column', backgroundColor: 'var(--color-paper)' }}>
      <Header />

      {/* Main container with nav-height padding-top to prevent top cutoff under fixed navbar */}
      <main style={{ flex: 1, paddingTop: 'calc(var(--nav-height) + var(--space-8))', paddingBottom: 'var(--space-16)' }}>
        <div className="container" style={{ maxWidth: 920 }}>
          
          {/* Main User Card */}
          <div
            style={{
              backgroundColor: 'var(--color-surface)',
              border: '1px solid var(--color-border)',
              borderRadius: 'var(--radius-xl)',
              padding: 'var(--space-8)',
              boxShadow: 'var(--shadow-md)',
              marginBottom: 'var(--space-8)',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', flexWrap: 'wrap', gap: 'var(--space-6)' }}>
              
              {/* Left Column: Avatar + Identity Info */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-5)', flex: '1 1 340px' }}>
                {avatarUrl ? (
                  <img
                    src={avatarUrl}
                    alt={displayName}
                    style={{
                      width: 84,
                      height: 84,
                      borderRadius: '50%',
                      objectFit: 'cover',
                      border: '3px solid var(--color-surface)',
                      boxShadow: '0 0 0 2px var(--color-border)',
                    }}
                  />
                ) : (
                  <div
                    style={{
                      width: 84,
                      height: 84,
                      borderRadius: '50%',
                      backgroundColor: 'var(--color-ink-primary)',
                      color: 'var(--color-paper)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      fontSize: 'var(--text-3xl)',
                      fontWeight: 700,
                      boxShadow: '0 0 0 2px var(--color-border)',
                    }}
                  >
                    {displayName.charAt(0).toUpperCase()}
                  </div>
                )}

                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)', flexWrap: 'wrap' }}>
                    <h1 style={{ fontSize: 'var(--text-2xl)', fontWeight: 700, color: 'var(--color-ink-primary)', margin: 0 }}>
                      {displayName}
                    </h1>
                    <UserBadge role={roleToDisplay} size={20} />
                    {displayUserKey && (
                      <button
                        type="button"
                        onClick={() => {
                          const textToCopy = `${displayName} (${displayUserKey})`;
                          navigator.clipboard.writeText(textToCopy);
                          setCopiedKey(true);
                          toast.success(`Copied "${textToCopy}" to clipboard!`);
                          setTimeout(() => setCopiedKey(false), 1500);
                        }}
                        title={`Copy User Name & ID: ${displayName} (${displayUserKey})`}
                        aria-label="Copy User Name and ID"
                        style={{
                          display: 'inline-flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          width: '26px',
                          height: '26px',
                          padding: 0,
                          borderRadius: '6px',
                          border: '1px solid var(--color-border)',
                          backgroundColor: copiedKey ? 'rgba(34, 197, 94, 0.1)' : 'var(--color-paper)',
                          color: copiedKey ? '#16a34a' : 'var(--color-ink-tertiary)',
                          cursor: 'pointer',
                          transition: 'all 0.15s ease',
                        }}
                      >
                        {copiedKey ? <Check size={13} color="#16a34a" /> : <Copy size={13} />}
                      </button>
                    )}
                  </div>

                  <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)', marginTop: 'var(--space-1)', flexWrap: 'wrap' }}>
                    <p style={{ color: 'var(--color-ink-secondary)', fontSize: 'var(--text-sm)', margin: 0 }}>
                      {isOwnProfile ? displayEmail : `${publicAuthorProjects.length} Contributed Build(s)`}
                    </p>
                    {isOwnProfile && displayEmail && (
                      isEmailVerified ? (
                        <span style={{
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '3px',
                          fontSize: '11px',
                          color: '#16a34a',
                          backgroundColor: 'rgba(34, 197, 94, 0.1)',
                          padding: '2px 8px',
                          borderRadius: '12px',
                          fontWeight: 600,
                        }}>
                          <CheckCircle2 size={12} /> Verified
                        </span>
                      ) : (
                        <Link
                          to={`/verify-email?email=${encodeURIComponent(displayEmail)}`}
                          style={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '3px',
                            fontSize: '11px',
                            color: '#d97706',
                            backgroundColor: 'rgba(245, 158, 11, 0.12)',
                            padding: '2px 8px',
                            borderRadius: '12px',
                            fontWeight: 600,
                            textDecoration: 'none',
                          }}
                        >
                          <AlertCircle size={12} /> Unverified &bull; Verify now
                        </Link>
                      )
                    )}
                  </div>
                </div>
              </div>

              {/* Right Column: Actions */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)', flexWrap: 'wrap' }}>
                {isOwnProfile ? (
                  <>
                    <button
                      type="button"
                      onClick={handleOpenEditModal}
                      className="btn btn--secondary btn--sm"
                      style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}
                    >
                      <Edit3 size={14} /> Edit Profile
                    </button>

                    {role === 'admin' && (
                      <Link to="/admin" className="btn btn--primary btn--sm" style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                        <Shield size={14} /> Admin Dashboard
                      </Link>
                    )}

                    <button
                      type="button"
                      onClick={handleSignOut}
                      className="btn btn--ghost btn--sm"
                      style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', color: 'var(--color-ink-secondary)' }}
                    >
                      <LogOut size={14} /> Sign Out
                    </button>
                  </>
                ) : (
                  <Link
                    to="/projects"
                    className="btn btn--secondary btn--sm"
                    style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', textDecoration: 'none' }}
                  >
                    <ArrowLeft size={14} /> Back to Projects
                  </Link>
                )}
              </div>
            </div>

            {/* About / Bio Section */}
            <div
              style={{
                marginTop: 'var(--space-6)',
                paddingTop: 'var(--space-6)',
                borderTop: '1px solid var(--color-border)',
              }}
            >
              <h2 style={{ fontSize: 'var(--text-xs)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--color-ink-tertiary)', marginBottom: 'var(--space-2)' }}>
                About
              </h2>

              {bio ? (
                <p style={{ fontSize: 'var(--text-sm)', color: 'var(--color-ink-primary)', lineHeight: 1.6, margin: 0 }}>
                  {bio}
                </p>
              ) : (
                <p style={{ fontSize: 'var(--text-sm)', color: 'var(--color-ink-tertiary)', fontStyle: 'italic', margin: 0 }}>
                  No bio added yet. Click &quot;Edit Profile&quot; to introduce yourself to the UNIHIKER K10 community.
                </p>
              )}
            </div>

            {/* Social & Connect Row */}
            <div style={{ marginTop: 'var(--space-5)' }}>
              <div style={{ fontSize: 'var(--text-xs)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--color-ink-tertiary)', marginBottom: 'var(--space-2)' }}>
                Connect & Links
              </div>

              {socialLinks.length > 0 ? (
                <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)', flexWrap: 'wrap' }}>
                  {socialLinks.map((s, idx) => (
                    <a
                      key={idx}
                      href={s.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '0.4rem',
                        fontSize: 'var(--text-xs)',
                        fontWeight: 600,
                        padding: '6px 12px',
                        borderRadius: 'var(--radius-full)',
                        backgroundColor: 'var(--color-paper)',
                        border: '1px solid var(--color-border)',
                        color: s.color,
                        textDecoration: 'none',
                        transition: 'all 0.15s ease',
                      }}
                    >
                      {s.icon}
                      <span>{s.label}</span>
                      <ExternalLink size={11} style={{ opacity: 0.6 }} />
                    </a>
                  ))}
                </div>
              ) : (
                <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)' }}>
                  <button
                    type="button"
                    onClick={handleOpenEditModal}
                    className="btn btn--ghost btn--sm"
                    style={{ fontSize: 'var(--text-xs)', padding: '4px 10px', display: 'inline-flex', alignItems: 'center', gap: '0.3rem' }}
                  >
                    <Plus size={13} /> Add GitHub & Social Media Links
                  </button>
                </div>
              )}
            </div>
          </div>

          {/* Author: Creator Studio Action Bar (Only on own profile) */}
          {isOwnProfile && (role === 'author' || role === 'admin') && (
            <div
              style={{
                backgroundColor: 'var(--color-surface)',
                border: '1px solid var(--color-border)',
                borderRadius: 'var(--radius-lg)',
                padding: '0.75rem 1.25rem',
                boxShadow: 'var(--shadow-xs, 0 1px 2px rgba(0,0,0,0.04))',
                marginBottom: 'var(--space-6)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                flexWrap: 'wrap',
                gap: 'var(--space-3)',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-3)' }}>
                <div
                  style={{
                    width: '32px',
                    height: '32px',
                    borderRadius: 'var(--radius-md)',
                    backgroundColor: 'rgba(37, 99, 235, 0.08)',
                    color: 'rgb(37, 99, 235)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    flexShrink: 0,
                  }}
                >
                  <Cpu size={16} />
                </div>
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)' }}>
                    <span style={{ fontSize: 'var(--text-sm)', fontWeight: 600, color: 'var(--color-ink-primary)' }}>
                      Creator Studio
                    </span>
                    <span
                      style={{
                        fontSize: '0.6875rem',
                        fontWeight: 600,
                        padding: '1px 6px',
                        borderRadius: '999px',
                        backgroundColor: 'rgba(34, 197, 94, 0.1)',
                        color: 'rgb(22, 163, 74)',
                      }}
                    >
                      Author
                    </span>
                  </div>
                  <p style={{ color: 'var(--color-ink-muted)', fontSize: 'var(--text-xs)', margin: 0 }}>
                    Share UNIHIKER K10 tutorials, firmware, and projects
                  </p>
                </div>
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)' }}>
                <Link
                  to="/project/new?type=Project"
                  className="btn btn--primary"
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '0.35rem',
                    padding: '0.4rem 0.85rem',
                    fontSize: 'var(--text-xs)',
                    textDecoration: 'none',
                  }}
                >
                  <Plus size={14} /> New Project
                </Link>
                <Link
                  to="/project/new?type=Tutorial"
                  className="btn btn--secondary"
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '0.35rem',
                    padding: '0.4rem 0.85rem',
                    fontSize: 'var(--text-xs)',
                    textDecoration: 'none',
                  }}
                >
                  <BookOpen size={14} /> New Tutorial
                </Link>
              </div>
            </div>
          )}

          {/* Section: Contributed Projects & Bookmarks (All users see Bookmarks; Authors/Admins see Full Studio) */}
          {((isOwnProfile ? (role === 'user' ? bookmarkedProjects.length > 0 : true) : publicAuthorProjects.length > 0)) && (
            <div
              id="contributed-projects"
              style={{
                backgroundColor: 'var(--color-surface)',
                border: '1px solid var(--color-border)',
                borderRadius: 'var(--radius-xl)',
                padding: 'var(--space-8)',
                boxShadow: 'var(--shadow-sm)',
                marginBottom: 'var(--space-8)',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 'var(--space-5)', flexWrap: 'wrap', gap: 'var(--space-4)' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)' }}>
                  {role === 'user' && isOwnProfile ? (
                    <Bookmark size={20} color="var(--color-accent)" />
                  ) : (
                    <FolderGit2 size={20} color="var(--color-accent)" />
                  )}
                  <h2 style={{ fontSize: 'var(--text-xl)', fontWeight: 700, color: 'var(--color-ink-primary)', margin: 0 }}>
                    {!isOwnProfile
                      ? `${displayName}'s Published Builds`
                      : role === 'user'
                      ? 'Bookmarked Projects & Tutorials'
                      : 'Contributed Projects & Tutorials'}
                  </h2>
                  <span
                    style={{
                      backgroundColor: 'var(--color-paper)',
                      border: '1px solid var(--color-border)',
                      fontSize: 'var(--text-xs)',
                      fontWeight: 700,
                      padding: '2px 8px',
                      borderRadius: 'var(--radius-full)',
                      color: 'var(--color-ink-secondary)',
                    }}
                  >
                    {searchQuery.trim()
                      ? `${displayedProjects.length} found`
                      : role === 'user' && isOwnProfile
                      ? bookmarkedProjects.length
                      : projectStatusFilter === 'bookmarked'
                      ? bookmarkedProjects.length
                      : projectsList.length}
                  </span>
                </div>

                {/* Browse Catalog Link */}
                <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)' }}>
                  <Link to="/projects" className="btn btn--ghost btn--sm" style={{ display: 'flex', alignItems: 'center', gap: '0.3rem', fontSize: 'var(--text-xs)' }}>
                    Browse Catalog <ExternalLink size={12} />
                  </Link>
                </div>
              </div>

              {/* Filter Toolbar: Status Tabs & Type Filter Pills */}
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  gap: 'var(--space-3)',
                  marginBottom: 'var(--space-6)',
                  flexWrap: 'wrap',
                }}
              >
                {/* Left: Status Filter Tabs (Published, Draft, Review, Bookmarks) - Only for own profile */}
                {isOwnProfile ? (
                  <div
                    style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '4px',
                      backgroundColor: 'var(--color-paper)',
                      border: '1px solid var(--color-border)',
                      padding: '3px 4px',
                      borderRadius: '10px',
                      flexWrap: 'wrap',
                    }}
                  >
                    {(role === 'user'
                      ? (bookmarkedProjects.length > 0 ? [{ id: 'bookmarked', label: 'Bookmarks', count: bookmarkedProjects.length }] : [])
                      : [
                          { id: 'published', label: 'Published', count: projectsList.filter(p => p.status === 'published' || !p.status).length },
                          { id: 'draft', label: 'Draft', count: projectsList.filter(p => p.status === 'draft').length },
                          { id: 'pending_approval', label: 'Review', count: projectsList.filter(p => p.status === 'pending_approval').length },
                          ...(bookmarkedProjects.length > 0 ? [{ id: 'bookmarked', label: 'Bookmarks', count: bookmarkedProjects.length }] : []),
                        ]
                    ).map((tab) => {
                      const isActive = projectStatusFilter === tab.id;
                      return (
                        <button
                          key={tab.id}
                          type="button"
                          onClick={() => handleSelectTab(tab.id as any)}
                          style={{
                            border: 'none',
                            outline: 'none',
                            cursor: 'pointer',
                            fontSize: '12px',
                            fontWeight: isActive ? 600 : 500,
                            padding: '5px 12px',
                            borderRadius: '7px',
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '6px',
                            backgroundColor: isActive ? 'var(--color-ink-primary)' : 'transparent',
                            color: isActive ? '#ffffff' : 'var(--color-ink-secondary)',
                            boxShadow: isActive ? '0 1px 3px rgba(0, 0, 0, 0.12)' : 'none',
                            transition: 'all 0.15s ease',
                          }}
                        >
                          <span>{tab.label}</span>
                          <span
                            style={{
                              fontSize: '10px',
                              padding: '1px 6px',
                              borderRadius: '999px',
                              backgroundColor: isActive ? 'rgba(255, 255, 255, 0.22)' : 'var(--color-surface)',
                              border: isActive ? 'none' : '1px solid var(--color-border)',
                              color: isActive ? '#ffffff' : 'var(--color-ink-tertiary)',
                              fontWeight: 700,
                            }}
                          >
                            {tab.count}
                          </span>
                        </button>
                      );
                    })}
                  </div>
                ) : (
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: 'var(--text-xs)', color: 'var(--color-ink-secondary)', fontWeight: 600 }}>
                    <span>Published Works</span>
                  </div>
                )}

                {/* Right: Type Filter Pills (All Types, Projects, Tutorials) */}
                <div
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '4px',
                    backgroundColor: 'var(--color-paper)',
                    border: '1px solid var(--color-border)',
                    padding: '3px 4px',
                    borderRadius: '10px',
                  }}
                >
                  <button
                    type="button"
                    onClick={() => setProjectTypeFilter('all')}
                    style={{
                      border: 'none',
                      outline: 'none',
                      cursor: 'pointer',
                      fontSize: '12px',
                      fontWeight: projectTypeFilter === 'all' ? 600 : 500,
                      padding: '5px 12px',
                      borderRadius: '7px',
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '5px',
                      backgroundColor: projectTypeFilter === 'all' ? 'var(--color-ink-primary)' : 'transparent',
                      color: projectTypeFilter === 'all' ? '#ffffff' : 'var(--color-ink-secondary)',
                      boxShadow: projectTypeFilter === 'all' ? '0 1px 3px rgba(0, 0, 0, 0.12)' : 'none',
                      transition: 'all 0.15s ease',
                    }}
                  >
                    <span>All Types</span>
                    <span
                      style={{
                        fontSize: '10px',
                        padding: '1px 6px',
                        borderRadius: '999px',
                        backgroundColor: projectTypeFilter === 'all' ? 'rgba(255, 255, 255, 0.22)' : 'var(--color-surface)',
                        border: projectTypeFilter === 'all' ? 'none' : '1px solid var(--color-border)',
                        color: projectTypeFilter === 'all' ? '#ffffff' : 'var(--color-ink-tertiary)',
                        fontWeight: 700,
                      }}
                    >
                      {typeCounts.all}
                    </span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setProjectTypeFilter('Project')}
                    style={{
                      border: 'none',
                      outline: 'none',
                      cursor: 'pointer',
                      fontSize: '12px',
                      fontWeight: projectTypeFilter === 'Project' ? 600 : 500,
                      padding: '5px 12px',
                      borderRadius: '7px',
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '5px',
                      backgroundColor: projectTypeFilter === 'Project' ? 'var(--color-ink-primary)' : 'transparent',
                      color: projectTypeFilter === 'Project' ? '#ffffff' : 'var(--color-ink-secondary)',
                      boxShadow: projectTypeFilter === 'Project' ? '0 1px 3px rgba(0, 0, 0, 0.12)' : 'none',
                      transition: 'all 0.15s ease',
                    }}
                  >
                    <Cpu size={12} />
                    <span>Projects</span>
                    <span
                      style={{
                        fontSize: '10px',
                        padding: '1px 6px',
                        borderRadius: '999px',
                        backgroundColor: projectTypeFilter === 'Project' ? 'rgba(255, 255, 255, 0.22)' : 'var(--color-surface)',
                        border: projectTypeFilter === 'Project' ? 'none' : '1px solid var(--color-border)',
                        color: projectTypeFilter === 'Project' ? '#ffffff' : 'var(--color-ink-tertiary)',
                        fontWeight: 700,
                      }}
                    >
                      {typeCounts.project}
                    </span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setProjectTypeFilter('Tutorial')}
                    style={{
                      border: 'none',
                      outline: 'none',
                      cursor: 'pointer',
                      fontSize: '12px',
                      fontWeight: projectTypeFilter === 'Tutorial' ? 600 : 500,
                      padding: '5px 12px',
                      borderRadius: '7px',
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '5px',
                      backgroundColor: projectTypeFilter === 'Tutorial' ? 'var(--color-ink-primary)' : 'transparent',
                      color: projectTypeFilter === 'Tutorial' ? '#ffffff' : 'var(--color-ink-secondary)',
                      boxShadow: projectTypeFilter === 'Tutorial' ? '0 1px 3px rgba(0, 0, 0, 0.12)' : 'none',
                      transition: 'all 0.15s ease',
                    }}
                  >
                    <BookOpen size={12} />
                    <span>Tutorials</span>
                    <span
                      style={{
                        fontSize: '10px',
                        padding: '1px 6px',
                        borderRadius: '999px',
                        backgroundColor: projectTypeFilter === 'Tutorial' ? 'rgba(255, 255, 255, 0.22)' : 'var(--color-surface)',
                        border: projectTypeFilter === 'Tutorial' ? 'none' : '1px solid var(--color-border)',
                        color: projectTypeFilter === 'Tutorial' ? '#ffffff' : 'var(--color-ink-tertiary)',
                        fontWeight: 700,
                      }}
                    >
                      {typeCounts.tutorial}
                    </span>
                  </button>
                </div>
              </div>

              {/* Search Input for Contributed Projects & Tutorials */}
              <div style={{ marginBottom: 'var(--space-6)', position: 'relative' }}>
                <Search
                  size={15}
                  style={{
                    position: 'absolute',
                    left: '12px',
                    top: '50%',
                    transform: 'translateY(-50%)',
                    color: 'var(--color-ink-tertiary)',
                    pointerEvents: 'none',
                  }}
                />
                <input
                  type="text"
                  placeholder="Search contributed projects, tutorials, or tags..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  style={{
                    width: '100%',
                    height: '38px',
                    paddingLeft: '36px',
                    paddingRight: searchQuery ? '36px' : '12px',
                    borderRadius: '8px',
                    border: '1px solid var(--color-border)',
                    backgroundColor: 'var(--color-paper)',
                    color: 'var(--color-ink-primary)',
                    fontSize: 'var(--text-sm)',
                    outline: 'none',
                    transition: 'border-color 0.15s ease, background-color 0.15s ease',
                    boxSizing: 'border-box',
                  }}
                  onFocus={(e) => {
                    e.currentTarget.style.borderColor = 'var(--color-accent)';
                    e.currentTarget.style.backgroundColor = 'var(--color-surface)';
                  }}
                  onBlur={(e) => {
                    e.currentTarget.style.borderColor = 'var(--color-border)';
                    e.currentTarget.style.backgroundColor = 'var(--color-paper)';
                  }}
                />
                {searchQuery && (
                  <button
                    type="button"
                    onClick={() => setSearchQuery('')}
                    title="Clear search"
                    aria-label="Clear search"
                    style={{
                      position: 'absolute',
                      right: '10px',
                      top: '50%',
                      transform: 'translateY(-50%)',
                      background: 'none',
                      border: 'none',
                      color: 'var(--color-ink-tertiary)',
                      cursor: 'pointer',
                      padding: '4px',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                    }}
                  >
                    <X size={14} />
                  </button>
                )}
              </div>

              {displayedProjects && displayedProjects.length > 0 ? (
                <>
                  <div
                    className="profile-projects-grid"
                    role="list"
                    aria-label="Profile UNIHIKER K10 Projects & Tutorials"
                  >
                    {visibleProjects.map((project) => (
                      <div key={project.id} role="listitem" style={{ height: '100%' }}>
                        <ProjectCard
                          project={project}
                          isCurrentAuthor={() => isOwnProfile}
                          compactLevelBadge={true}
                          hideDescription={true}
                          statusBadge={
                            isOwnProfile ? (
                              <span
                                title={`Status: ${project.status === 'pending_approval' ? 'In Review' : (project.status || 'Published')}`}
                                style={{
                                  display: 'inline-block',
                                  width: 8,
                                  height: 8,
                                  borderRadius: '50%',
                                  backgroundColor:
                                    project.status === 'draft'
                                      ? '#94a3b8'
                                      : project.status === 'pending_approval'
                                      ? '#fde047'
                                      : project.status === 'rejected'
                                      ? '#ef4444'
                                      : '#22c55e',
                                  flexShrink: 0,
                                }}
                              />
                            ) : undefined
                          }
                        actionToolbar={
                          isOwnProfile ? (
                            projectStatusFilter === 'bookmarked' ? (
                              <>
                                <Link
                                  to={`/project/${project.id}`}
                                  style={{
                                    flex: 1,
                                    height: '32px',
                                    display: 'inline-flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    gap: '6px',
                                    fontSize: '12px',
                                    fontWeight: 600,
                                    padding: '0 12px',
                                    borderRadius: '7px',
                                    textDecoration: 'none',
                                    boxSizing: 'border-box',
                                    backgroundColor: 'var(--color-ink-primary)',
                                    color: '#ffffff',
                                    transition: 'all 0.15s ease',
                                    boxShadow: '0 1px 3px rgba(0, 0, 0, 0.12)',
                                  }}
                                >
                                  <Eye size={13} />
                                  <span>View Build</span>
                                </Link>

                                <button
                                  type="button"
                                  onClick={() => {
                                    toggleProjectBookmark(project.id, user?.id ? String(user.id) : undefined, profile?.id ? String(profile.id) : undefined);
                                    setBookmarkedProjects(getUserBookmarkedProjects(user?.id ? String(user.id) : undefined, profile?.id ? String(profile.id) : undefined));
                                    toast.info('Removed from bookmarks.');
                                  }}
                                  title="Remove from Bookmarks"
                                  aria-label="Remove from Bookmarks"
                                  style={{
                                    width: '32px',
                                    height: '32px',
                                    minWidth: '32px',
                                    display: 'inline-flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    padding: 0,
                                    borderRadius: '7px',
                                    border: '1px solid var(--color-border)',
                                    backgroundColor: 'var(--color-surface)',
                                    color: 'var(--color-accent)',
                                    boxSizing: 'border-box',
                                    cursor: 'pointer',
                                    transition: 'all 0.15s ease',
                                  }}
                                >
                                  <Bookmark size={14} fill="currentColor" />
                                </button>
                              </>
                            ) : (role === 'author' || role === 'admin') ? (
                              <>
                                <Link
                                  to={`/project/${project.id}/edit`}
                                  style={{
                                    flex: 1,
                                    height: '32px',
                                    display: 'inline-flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    gap: '6px',
                                    fontSize: '12px',
                                    fontWeight: 600,
                                    padding: '0 12px',
                                    borderRadius: '7px',
                                    textDecoration: 'none',
                                    boxSizing: 'border-box',
                                    backgroundColor: 'var(--color-surface)',
                                    border: '1px solid var(--color-border)',
                                    color: 'var(--color-ink-primary)',
                                    transition: 'all 0.15s ease',
                                    boxShadow: '0 1px 2px rgba(0, 0, 0, 0.04)',
                                  }}
                                >
                                  <Edit3 size={13} />
                                  <span>Edit</span>
                                </Link>

                                <Link
                                  to={`/project/${project.id}`}
                                  style={{
                                    flex: 1,
                                    height: '32px',
                                    display: 'inline-flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    gap: '6px',
                                    fontSize: '12px',
                                    fontWeight: 600,
                                    padding: '0 12px',
                                    borderRadius: '7px',
                                    textDecoration: 'none',
                                    boxSizing: 'border-box',
                                    backgroundColor: 'var(--color-ink-primary)',
                                    color: '#ffffff',
                                    transition: 'all 0.15s ease',
                                    boxShadow: '0 1px 3px rgba(0, 0, 0, 0.12)',
                                  }}
                                >
                                  <Eye size={13} />
                                  <span>View</span>
                                </Link>

                                <button
                                  type="button"
                                  onClick={() => handleDeleteProject(project.id, project.title)}
                                  title="Delete Project"
                                  aria-label={`Delete ${project.title}`}
                                  style={{
                                    width: '32px',
                                    height: '32px',
                                    minWidth: '32px',
                                    display: 'inline-flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    padding: 0,
                                    borderRadius: '7px',
                                    border: '1px solid transparent',
                                    backgroundColor: 'transparent',
                                    color: 'var(--color-ink-tertiary)',
                                    boxSizing: 'border-box',
                                    cursor: 'pointer',
                                    transition: 'all 0.15s ease',
                                  }}
                                >
                                  <Trash2 size={14} />
                                </button>
                              </>
                            ) : (
                              <>
                                <Link
                                  to={`/project/${project.id}`}
                                  style={{
                                    flex: 1,
                                    height: '32px',
                                    display: 'inline-flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    gap: '6px',
                                    fontSize: '12px',
                                    fontWeight: 600,
                                    padding: '0 12px',
                                    borderRadius: '7px',
                                    textDecoration: 'none',
                                    boxSizing: 'border-box',
                                    backgroundColor: 'var(--color-ink-primary)',
                                    color: '#ffffff',
                                    transition: 'all 0.15s ease',
                                    boxShadow: '0 1px 3px rgba(0, 0, 0, 0.12)',
                                  }}
                                >
                                  <Eye size={13} />
                                  <span>View</span>
                                </Link>

                                <button
                                  type="button"
                                  onClick={() => handleDeleteProject(project.id, project.title)}
                                  title="Delete Project"
                                  aria-label={`Delete ${project.title}`}
                                  style={{
                                    width: '32px',
                                    height: '32px',
                                    minWidth: '32px',
                                    display: 'inline-flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    padding: 0,
                                    borderRadius: '7px',
                                    border: '1px solid transparent',
                                    backgroundColor: 'transparent',
                                    color: 'var(--color-ink-tertiary)',
                                    boxSizing: 'border-box',
                                    cursor: 'pointer',
                                    transition: 'all 0.15s ease',
                                  }}
                                >
                                  <Trash2 size={14} />
                                </button>
                              </>
                            )
                          ) : (
                            <Link
                              to={`/project/${project.id}`}
                              style={{
                                width: '100%',
                                height: '32px',
                                display: 'inline-flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                gap: '6px',
                                fontSize: '12px',
                                fontWeight: 600,
                                padding: '0 12px',
                                borderRadius: '7px',
                                textDecoration: 'none',
                                boxSizing: 'border-box',
                                backgroundColor: 'var(--color-surface)',
                                border: '1px solid var(--color-border)',
                                color: 'var(--color-ink-primary)',
                                transition: 'all 0.15s ease',
                              }}
                            >
                              <Eye size={13} />
                              <span>View Project</span>
                            </Link>
                          )
                        }
                      />
                    </div>
                  ))}
                </div>

                {visibleLimit < displayedProjects.length && (
                  <div style={{ display: 'flex', justifyContent: 'center', marginTop: 'var(--space-8)' }}>
                    <button
                      type="button"
                      onClick={() => setVisibleLimit((prev) => prev + 6)}
                      className="btn btn--secondary"
                      style={{
                        padding: '10px 24px',
                        fontSize: '13px',
                        fontWeight: 600,
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '8px',
                        borderRadius: '8px',
                        boxShadow: 'var(--shadow-sm)',
                        cursor: 'pointer',
                      }}
                    >
                      <Plus size={14} />
                      <span>Show More ({displayedProjects.length - visibleLimit} remaining)</span>
                    </button>
                  </div>
                )}
              </>
              ) : (
                <div
                  style={{
                    padding: 'var(--space-10) var(--space-4)',
                    textAlign: 'center',
                    backgroundColor: 'var(--color-paper)',
                    borderRadius: 'var(--radius-lg)',
                    border: '1px dashed var(--color-border)',
                  }}
                >
                  <FolderGit2 size={36} style={{ color: 'var(--color-ink-tertiary)', margin: '0 auto var(--space-3)', opacity: 0.6 }} />
                  <h3 style={{ fontSize: 'var(--text-base)', fontWeight: 600, color: 'var(--color-ink-primary)', margin: '0 0 var(--space-1) 0' }}>
                    {searchQuery
                      ? `No results matching "${searchQuery}"`
                      : projectTypeFilter !== 'all'
                      ? `No ${projectTypeFilter === 'Project' ? 'projects' : 'tutorials'} found`
                      : projectStatusFilter === 'bookmarked'
                      ? 'No Bookmarked Builds Yet'
                      : projectStatusFilter === 'draft'
                      ? 'No drafts found'
                      : projectStatusFilter === 'pending_approval'
                      ? 'No projects currently in review'
                      : projectStatusFilter === 'published'
                      ? 'No published works yet'
                      : 'No contributions yet'}
                  </h3>
                  <p style={{ fontSize: 'var(--text-sm)', color: 'var(--color-ink-secondary)', maxWidth: 420, margin: '0 auto', lineHeight: 1.5 }}>
                    {searchQuery
                      ? 'Try adjusting your search terms or clearing the search query to view all items.'
                      : projectTypeFilter !== 'all'
                      ? `There are no ${projectTypeFilter.toLowerCase()}s under the selected filter criteria.`
                      : projectStatusFilter === 'bookmarked'
                      ? 'Projects and tutorials you bookmark across the platform will be collected here for quick reference and direct Web Serial flashing.'
                      : projectStatusFilter === 'draft'
                      ? 'Projects and tutorials saved as drafts will appear here with instant edit and preview access.'
                      : projectStatusFilter === 'pending_approval'
                      ? 'Submissions waiting for administrative verification will appear here.'
                      : 'Hardware projects, technical tutorials, and firmware builds created by this author will appear here.'}
                  </p>
                  {searchQuery ? (
                    <div style={{ marginTop: 'var(--space-4)' }}>
                      <button
                        type="button"
                        onClick={() => setSearchQuery('')}
                        className="btn btn--secondary btn--sm"
                        style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}
                      >
                        <X size={13} /> Clear Search
                      </button>
                    </div>
                  ) : projectStatusFilter === 'bookmarked' ? (
                    <div style={{ marginTop: 'var(--space-4)' }}>
                      <Link to="/projects" className="btn btn--primary btn--sm">
                        Explore Catalog & Bookmark Builds
                      </Link>
                    </div>
                  ) : null}
                </div>
              )}
            </div>
          )}

          {/* Section: Role Specific Portals */}

          {/* User: Apply to become an Author (Only on own profile) */}
          {isOwnProfile && role === 'user' && (
            <div
              style={{
                backgroundColor: 'var(--color-surface)',
                border: '1px solid var(--color-border)',
                borderRadius: 'var(--radius-lg)',
                padding: application && application.status === 'approved' ? '0.75rem 1.25rem' : 'var(--space-8)',
                boxShadow: 'var(--shadow-xs, 0 1px 2px rgba(0,0,0,0.04))',
              }}
            >
              {application && application.status === 'pending' ? (
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-3)', color: 'rgb(202, 138, 4)', marginBottom: 'var(--space-3)' }}>
                    <Clock size={24} />
                    <h2 style={{ fontSize: 'var(--text-xl)', fontWeight: 700, margin: 0, color: 'var(--color-ink-primary)' }}>
                      Author Application Under Review
                    </h2>
                  </div>
                  <p style={{ color: 'var(--color-ink-secondary)', fontSize: 'var(--text-sm)', lineHeight: 1.6, marginBottom: 'var(--space-4)' }}>
                    Thank you for applying to become a verified UNIHIKER K10 Creator! Our platform administrators are reviewing your submission. You will be automatically granted the <strong>Author</strong> role upon approval.
                  </p>
                  <div
                    style={{
                      backgroundColor: 'var(--color-paper)',
                      padding: 'var(--space-4)',
                      borderRadius: 'var(--radius-lg)',
                      border: '1px solid var(--color-border)',
                    }}
                  >
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-3)' }}>
                      <div>
                        <div style={{ fontSize: 'var(--text-xs)', fontWeight: 600, textTransform: 'uppercase', color: 'var(--color-ink-tertiary)', marginBottom: 'var(--space-1)' }}>
                          Who You Are
                        </div>
                        <p style={{ fontSize: 'var(--text-sm)', color: 'var(--color-ink-primary)', margin: 0 }}>
                          {application.bio}
                        </p>
                      </div>
                      {application.hardwareExperience && (
                        <div>
                          <div style={{ fontSize: 'var(--text-xs)', fontWeight: 600, textTransform: 'uppercase', color: 'var(--color-ink-tertiary)', marginBottom: 'var(--space-1)' }}>
                            UNIHIKER Experience
                          </div>
                          <p style={{ fontSize: 'var(--text-sm)', color: 'var(--color-ink-primary)', margin: 0 }}>
                            {application.hardwareExperience}
                          </p>
                        </div>
                      )}
                      {application.githubUrl && (
                        <div>
                          <div style={{ fontSize: 'var(--text-xs)', fontWeight: 600, textTransform: 'uppercase', color: 'var(--color-ink-tertiary)', marginBottom: 'var(--space-1)' }}>
                            GitHub / Portfolio
                          </div>
                          <a
                            href={application.githubUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            style={{ fontSize: 'var(--text-sm)', color: 'var(--color-accent)', textDecoration: 'none', display: 'inline-flex', alignItems: 'center', gap: '0.3rem', fontWeight: 600 }}
                          >
                            {application.githubUrl} <ExternalLink size={12} />
                          </a>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              ) : application && application.status === 'approved' ? (
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    flexWrap: 'wrap',
                    gap: 'var(--space-3)',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-3)' }}>
                    <div
                      style={{
                        width: '32px',
                        height: '32px',
                        borderRadius: 'var(--radius-md)',
                        backgroundColor: 'rgba(220, 38, 38, 0.08)',
                        color: 'rgb(220, 38, 38)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        flexShrink: 0,
                      }}
                    >
                      <ShieldAlert size={16} />
                    </div>
                    <div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)' }}>
                        <span style={{ fontSize: 'var(--text-sm)', fontWeight: 600, color: 'var(--color-ink-primary)' }}>
                          Author Privileges Revoked
                        </span>
                        <span
                          style={{
                            fontSize: '0.6875rem',
                            fontWeight: 600,
                            padding: '1px 6px',
                            borderRadius: '999px',
                            backgroundColor: 'rgba(239, 68, 68, 0.1)',
                            color: 'rgb(220, 38, 38)',
                          }}
                        >
                          Demoted
                        </span>
                      </div>
                      <p style={{ color: 'var(--color-ink-muted)', fontSize: 'var(--text-xs)', margin: 0 }}>
                        Author access revoked by administrator. Contact <strong style={{ color: 'var(--color-ink-primary)' }}>admin@k10hub.io</strong> to appeal.
                      </p>
                    </div>
                  </div>

                  <a
                    href={`mailto:admin@k10hub.io?subject=${encodeURIComponent(`Author Role Reinstatement Request - ${displayName}`)}&body=${encodeURIComponent(`Hello Platform Administrator,\n\nI was previously an approved Author on K10 Hub (${displayEmail}), but my author access was demoted. I would like to appeal and request reinstatement of my author privileges.\n\nAccount: ${displayEmail}\nName: ${displayName}\n\nThank you.`)}`}
                    className="btn btn--secondary btn--sm"
                    style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '0.35rem',
                      padding: '0.4rem 0.85rem',
                      fontSize: 'var(--text-xs)',
                      textDecoration: 'none',
                    }}
                  >
                    <Mail size={13} /> Email Admin
                  </a>
                </div>
              ) : application && application.status === 'rejected' ? (
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-3)', color: 'rgb(220, 38, 38)', marginBottom: 'var(--space-3)' }}>
                    <AlertCircle size={24} />
                    <h2 style={{ fontSize: 'var(--text-xl)', fontWeight: 700, margin: 0, color: 'var(--color-ink-primary)' }}>
                      Application Not Approved
                    </h2>
                  </div>
                  <p style={{ color: 'var(--color-ink-secondary)', fontSize: 'var(--text-sm)', lineHeight: 1.6 }}>
                    Your recent author request was not approved at this time.
                    {application.adminNotes && (
                      <span style={{ display: 'block', marginTop: 'var(--space-2)', fontStyle: 'italic' }}>
                        Admin feedback: &quot;{application.adminNotes}&quot;
                      </span>
                    )}
                  </p>
                  <button
                    type="button"
                    onClick={handleOpenApplyModal}
                    className="btn btn--primary btn--sm"
                    style={{ marginTop: 'var(--space-4)' }}
                  >
                    Re-apply for Author Status
                  </button>
                </div>
              ) : (
                  <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', flexWrap: 'wrap', gap: 'var(--space-4)', margin: 0 }}>
                    <div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)', color: 'var(--color-accent)', marginBottom: 'var(--space-2)' }}>
                        <Award size={20} />
                        <span style={{ fontSize: 'var(--text-xs)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em' }}>
                          Creator Program
                        </span>
                      </div>
                      <h2 style={{ fontSize: 'var(--text-xl)', fontWeight: 700, color: 'var(--color-ink-primary)', margin: 0 }}>
                        Become a Verified UNIHIKER K10 Author
                      </h2>
                      <p style={{ color: 'var(--color-ink-secondary)', fontSize: 'var(--text-sm)', marginTop: 'var(--space-1)', maxWidth: 540 }}>
                        Authors can publish hardware projects, write interactive step-by-step tutorials, distribute compiled firmware builds, and share open-source libraries.
                      </p>
                    </div>

                    <button
                      type="button"
                      onClick={handleOpenApplyModal}
                      className="btn btn--primary"
                      style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}
                    >
                      <Sparkles size={16} /> Apply for Author Role
                    </button>
                  </div>
              )}
            </div>
          )}

          {/* Admin: System Overview */}
          {role === 'admin' && (
            <div
              style={{
                backgroundColor: 'var(--color-surface)',
                border: '1px solid var(--color-border)',
                borderRadius: 'var(--radius-xl)',
                padding: 'var(--space-8)',
                boxShadow: 'var(--shadow-sm)',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 'var(--space-4)' }}>
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)', color: 'rgb(220, 38, 38)', marginBottom: 'var(--space-1)' }}>
                    <Shield size={18} />
                    <span style={{ fontSize: 'var(--text-xs)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em' }}>
                      Administrator Privileges
                    </span>
                  </div>
                  <h2 style={{ fontSize: 'var(--text-xl)', fontWeight: 700, color: 'var(--color-ink-primary)', margin: 0 }}>
                    Platform Administration Hub
                  </h2>
                  <p style={{ color: 'var(--color-ink-secondary)', fontSize: 'var(--text-sm)', marginTop: 'var(--space-1)' }}>
                    Manage platform users, review creator author applications, and configure system permissions.
                  </p>
                </div>

                <Link to="/admin" className="btn btn--primary" style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                  <Shield size={16} /> Open Admin Panel
                </Link>
              </div>
            </div>
          )}

        </div>
      </main>

      {/* Edit Profile Modal */}
      {showEditModal && (
        <div
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: 'rgba(0, 0, 0, 0.65)',
            backdropFilter: 'blur(4px)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 1000,
            padding: 'var(--space-4)',
          }}
        >
          <div
            style={{
              backgroundColor: 'var(--color-surface)',
              border: '1px solid var(--color-border)',
              borderRadius: 'var(--radius-xl)',
              width: '100%',
              maxWidth: 620,
              maxHeight: '90vh',
              overflowY: 'auto',
              padding: 'var(--space-8)',
              boxShadow: 'var(--shadow-xl)',
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 'var(--space-5)' }}>
              <div>
                <h2 style={{ fontSize: 'var(--text-xl)', fontWeight: 700, color: 'var(--color-ink-primary)', margin: 0 }}>
                  Edit Profile
                </h2>
                <p style={{ fontSize: 'var(--text-xs)', color: 'var(--color-ink-secondary)', marginTop: 'var(--space-1)', margin: 0 }}>
                  Update your public name, bio, GitHub, and social media handles.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setShowEditModal(false)}
                className="btn btn--ghost btn--sm"
                style={{ fontSize: 'var(--text-lg)' }}
              >
                ✕
              </button>
            </div>

            {editError && (
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.5rem',
                  backgroundColor: 'rgba(239, 68, 68, 0.1)',
                  border: '1px solid rgba(239, 68, 68, 0.3)',
                  color: 'rgb(220, 38, 38)',
                  padding: 'var(--space-3)',
                  borderRadius: 'var(--radius-md)',
                  fontSize: 'var(--text-sm)',
                  marginBottom: 'var(--space-4)',
                }}
              >
                <AlertCircle size={18} />
                <span>{editError}</span>
              </div>
            )}

            {editSuccessMsg && (
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.5rem',
                  backgroundColor: 'rgba(34, 197, 94, 0.1)',
                  border: '1px solid rgba(34, 197, 94, 0.3)',
                  color: 'rgb(34, 197, 94)',
                  padding: 'var(--space-3)',
                  borderRadius: 'var(--radius-md)',
                  fontSize: 'var(--text-sm)',
                  marginBottom: 'var(--space-4)',
                }}
              >
                <CheckCircle2 size={18} />
                <span>{editSuccessMsg}</span>
              </div>
            )}

            <form onSubmit={handleEditProfileSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}>
              
              {/* Display Name */}
              <div>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 'var(--space-1)' }}>
                  <label style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: 'var(--text-xs)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--color-ink-secondary)', margin: 0 }}>
                    <span>Display Name</span>
                    <span style={{ color: '#ef4444' }}>*</span>
                  </label>
                  {isNameLocked && (
                    <span
                      style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '4px',
                        fontSize: '11px',
                        color: 'var(--color-ink-tertiary)',
                        backgroundColor: 'var(--color-paper)',
                        border: '1px solid var(--color-border)',
                        padding: '2px 8px',
                        borderRadius: 'var(--radius-full)',
                        fontWeight: 600,
                      }}
                    >
                      <Lock size={11} /> Locked
                    </span>
                  )}
                </div>

                <div style={{ position: 'relative' }}>
                  <input
                    type="text"
                    value={editName}
                    disabled={isNameLocked}
                    readOnly={isNameLocked}
                    onChange={(e) => {
                      if (!isNameLocked) {
                        setEditName(e.target.value);
                        if (editFieldErrors.name) setEditFieldErrors({});
                      }
                    }}
                    placeholder="Your Name or Maker Handle"
                    style={{
                      width: '100%',
                      padding: isNameLocked ? '10px 12px 10px 34px' : '10px 12px',
                      backgroundColor: isNameLocked ? 'var(--color-bg)' : 'var(--color-paper)',
                      border: editFieldErrors.name ? '1px solid #ef4444' : '1px solid var(--color-border)',
                      borderRadius: 'var(--radius-md)',
                      fontSize: 'var(--text-sm)',
                      color: isNameLocked ? 'var(--color-ink-secondary)' : 'var(--color-ink-primary)',
                      outline: 'none',
                      cursor: isNameLocked ? 'not-allowed' : 'text',
                      opacity: isNameLocked ? 0.85 : 1,
                      boxSizing: 'border-box',
                    }}
                  />
                  {isNameLocked && (
                    <Lock
                      size={14}
                      style={{
                        position: 'absolute',
                        left: 12,
                        top: '50%',
                        transform: 'translateY(-50%)',
                        color: 'var(--color-ink-tertiary)',
                      }}
                    />
                  )}
                </div>

                {editFieldErrors.name && (
                  <p style={{ color: '#ef4444', fontSize: '11px', marginTop: '4px', display: 'flex', alignItems: 'center', gap: '4px', fontWeight: 500 }}>
                    ⚠ {editFieldErrors.name}
                  </p>
                )}

                {/* Warning notice before changing name / Locked status notice */}
                {!isNameLocked ? (
                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'flex-start',
                      gap: '8px',
                      padding: '10px 12px',
                      backgroundColor: 'rgba(234, 179, 8, 0.08)',
                      border: '1px solid rgba(234, 179, 8, 0.3)',
                      borderRadius: 'var(--radius-md)',
                      marginTop: '8px',
                    }}
                  >
                    <AlertTriangle size={15} style={{ color: '#d97706', flexShrink: 0, marginTop: '2px' }} />
                    <p style={{ margin: 0, fontSize: '11.5px', color: '#b45309', lineHeight: 1.45 }}>
                      <strong>Important Notice:</strong> You can only change your Display Name <strong>once in a lifetime</strong>. After saving, this name will be permanently locked across all your projects and cannot be modified again.
                    </p>
                  </div>
                ) : (
                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '8px',
                      padding: '8px 12px',
                      backgroundColor: 'rgba(100, 116, 139, 0.07)',
                      border: '1px solid rgba(100, 116, 139, 0.2)',
                      borderRadius: 'var(--radius-md)',
                      marginTop: '8px',
                    }}
                  >
                    <Lock size={13} style={{ color: 'var(--color-ink-tertiary)', flexShrink: 0 }} />
                    <p style={{ margin: 0, fontSize: '11.5px', color: 'var(--color-ink-tertiary)', lineHeight: 1.4 }}>
                      Display Name has been permanently set (1-time change limit reached).
                    </p>
                  </div>
                )}
              </div>

              {/* Avatar URL */}
              <div>
                <label style={{ display: 'block', fontSize: 'var(--text-xs)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--color-ink-secondary)', marginBottom: 'var(--space-1)' }}>
                  Avatar Image URL
                </label>
                <input
                  type="url"
                  value={editAvatarUrl}
                  onChange={(e) => setEditAvatarUrl(e.target.value)}
                  placeholder="https://example.com/avatar.jpg"
                  style={{
                    width: '100%',
                    padding: '10px 12px',
                    backgroundColor: 'var(--color-paper)',
                    border: '1px solid var(--color-border)',
                    borderRadius: 'var(--radius-md)',
                    fontSize: 'var(--text-sm)',
                    color: 'var(--color-ink-primary)',
                    outline: 'none',
                  }}
                />
              </div>

              {/* About / Bio */}
              <div>
                <label style={{ display: 'block', fontSize: 'var(--text-xs)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--color-ink-secondary)', marginBottom: 'var(--space-1)' }}>
                  About / Bio
                </label>
                <textarea
                  rows={3}
                  value={editBio}
                  onChange={(e) => setEditBio(e.target.value)}
                  placeholder="Share a short bio, your embedded hardware focus, or what you build with UNIHIKER K10..."
                  style={{
                    width: '100%',
                    padding: '10px 12px',
                    backgroundColor: 'var(--color-paper)',
                    border: '1px solid var(--color-border)',
                    borderRadius: 'var(--radius-md)',
                    fontSize: 'var(--text-sm)',
                    color: 'var(--color-ink-primary)',
                    outline: 'none',
                    resize: 'vertical',
                  }}
                />
              </div>

              {/* GitHub Link */}
              <div>
                <label style={{ display: 'block', fontSize: 'var(--text-xs)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--color-ink-secondary)', marginBottom: 'var(--space-1)' }}>
                  GitHub Profile URL
                </label>
                <div style={{ position: 'relative' }}>
                  <Github size={18} style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: 'var(--color-ink-tertiary)' }} />
                  <input
                    type="url"
                    value={editGithubUrl}
                    onChange={(e) => setEditGithubUrl(e.target.value)}
                    placeholder="https://github.com/yourusername"
                    style={{
                      width: '100%',
                      padding: '10px 12px 10px 38px',
                      backgroundColor: 'var(--color-paper)',
                      border: '1px solid var(--color-border)',
                      borderRadius: 'var(--radius-md)',
                      fontSize: 'var(--text-sm)',
                      color: 'var(--color-ink-primary)',
                      outline: 'none',
                    }}
                  />
                </div>
              </div>

              {/* Social Media Links Section */}
              <div style={{ borderTop: '1px solid var(--color-border)', paddingTop: 'var(--space-4)' }}>
                <div style={{ fontSize: 'var(--text-xs)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--color-ink-primary)', marginBottom: 'var(--space-3)' }}>
                  Social Media Links
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: 'var(--space-3)' }}>
                  
                  {/* Instagram */}
                  <div>
                    <label style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: 'var(--text-xs)', color: 'var(--color-ink-secondary)', marginBottom: '4px' }}>
                      <Instagram size={13} color="#E4405F" /> Instagram
                    </label>
                    <input
                      type="url"
                      value={editInstagramUrl}
                      onChange={(e) => setEditInstagramUrl(e.target.value)}
                      placeholder="https://instagram.com/handle"
                      style={{
                        width: '100%',
                        padding: '8px 10px',
                        backgroundColor: 'var(--color-paper)',
                        border: '1px solid var(--color-border)',
                        borderRadius: 'var(--radius-md)',
                        fontSize: 'var(--text-xs)',
                        color: 'var(--color-ink-primary)',
                        outline: 'none',
                      }}
                    />
                  </div>

                  {/* YouTube */}
                  <div>
                    <label style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: 'var(--text-xs)', color: 'var(--color-ink-secondary)', marginBottom: '4px' }}>
                      <Youtube size={13} color="#FF0000" /> YouTube
                    </label>
                    <input
                      type="url"
                      value={editYoutubeUrl}
                      onChange={(e) => setEditYoutubeUrl(e.target.value)}
                      placeholder="https://youtube.com/@channel"
                      style={{
                        width: '100%',
                        padding: '8px 10px',
                        backgroundColor: 'var(--color-paper)',
                        border: '1px solid var(--color-border)',
                        borderRadius: 'var(--radius-md)',
                        fontSize: 'var(--text-xs)',
                        color: 'var(--color-ink-primary)',
                        outline: 'none',
                      }}
                    />
                  </div>

                  {/* LinkedIn */}
                  <div>
                    <label style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: 'var(--text-xs)', color: 'var(--color-ink-secondary)', marginBottom: '4px' }}>
                      <Linkedin size={13} color="#0A66C2" /> LinkedIn
                    </label>
                    <input
                      type="url"
                      value={editLinkedinUrl}
                      onChange={(e) => setEditLinkedinUrl(e.target.value)}
                      placeholder="https://linkedin.com/in/username"
                      style={{
                        width: '100%',
                        padding: '8px 10px',
                        backgroundColor: 'var(--color-paper)',
                        border: '1px solid var(--color-border)',
                        borderRadius: 'var(--radius-md)',
                        fontSize: 'var(--text-xs)',
                        color: 'var(--color-ink-primary)',
                        outline: 'none',
                      }}
                    />
                  </div>

                  {/* Personal Website */}
                  <div>
                    <label style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: 'var(--text-xs)', color: 'var(--color-ink-secondary)', marginBottom: '4px' }}>
                      <Globe size={13} color="var(--color-accent)" /> Website / Portfolio
                    </label>
                    <input
                      type="url"
                      value={editWebsiteUrl}
                      onChange={(e) => setEditWebsiteUrl(e.target.value)}
                      placeholder="https://yourportfolio.dev"
                      style={{
                        width: '100%',
                        padding: '8px 10px',
                        backgroundColor: 'var(--color-paper)',
                        border: '1px solid var(--color-border)',
                        borderRadius: 'var(--radius-md)',
                        fontSize: 'var(--text-xs)',
                        color: 'var(--color-ink-primary)',
                        outline: 'none',
                      }}
                    />
                  </div>

                </div>
              </div>

              {/* Submit Buttons */}
              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 'var(--space-3)', marginTop: 'var(--space-4)' }}>
                <button
                  type="button"
                  onClick={() => setShowEditModal(false)}
                  className="btn btn--secondary"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={editSubmitting}
                  className="btn btn--primary"
                  style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}
                >
                  {editSubmitting ? 'Saving Changes...' : 'Save Profile'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Author Application Modal */}
      {showApplyModal && (
        <div
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: 'rgba(0, 0, 0, 0.65)',
            backdropFilter: 'blur(4px)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 1000,
            padding: 'var(--space-4)',
          }}
        >
          <div
            style={{
              backgroundColor: 'var(--color-surface)',
              border: '1px solid var(--color-border)',
              borderRadius: 'var(--radius-xl)',
              width: '100%',
              maxWidth: 560,
              maxHeight: '90vh',
              overflowY: 'auto',
              padding: 'var(--space-8)',
              boxShadow: 'var(--shadow-xl)',
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 'var(--space-4)' }}>
              <div>
                <h2 style={{ fontSize: 'var(--text-xl)', fontWeight: 700, color: 'var(--color-ink-primary)', margin: 0 }}>
                  Apply to Become a K10 Author
                </h2>
                <p style={{ fontSize: 'var(--text-xs)', color: 'var(--color-ink-secondary)', marginTop: 'var(--space-1)', margin: 0 }}>
                  Tell us about your embedded experience and the UNIHIKER K10 hardware you build with.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setShowApplyModal(false)}
                className="btn btn--ghost btn--sm"
                style={{ fontSize: 'var(--text-lg)' }}
              >
                ✕
              </button>
            </div>

            {appSubmitError && (
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.5rem',
                  backgroundColor: 'rgba(239, 68, 68, 0.1)',
                  border: '1px solid rgba(239, 68, 68, 0.3)',
                  color: 'rgb(220, 38, 38)',
                  padding: 'var(--space-3)',
                  borderRadius: 'var(--radius-md)',
                  fontSize: 'var(--text-sm)',
                  marginBottom: 'var(--space-4)',
                }}
              >
                <AlertCircle size={18} />
                <span>{appSubmitError}</span>
              </div>
            )}

            <form onSubmit={handleApplySubmit} style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}>
              {/* Field 1: Who you are */}
              <div>
                <label style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: 'var(--text-xs)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--color-ink-secondary)', marginBottom: 'var(--space-1)' }}>
                  <span>Who You Are</span>
                  <span style={{ color: '#ef4444' }}>*</span>
                </label>
                <textarea
                  rows={2}
                  value={appWhoYouAre}
                  onChange={(e) => {
                    setAppWhoYouAre(e.target.value);
                    if (appFieldErrors.whoYouAre) {
                      setAppFieldErrors((prev) => ({ ...prev, whoYouAre: undefined }));
                    }
                  }}
                  placeholder="Tell us briefly about yourself, maker background, or expertise..."
                  style={{
                    width: '100%',
                    padding: '10px 12px',
                    backgroundColor: 'var(--color-paper)',
                    border: appFieldErrors.whoYouAre ? '1px solid #ef4444' : '1px solid var(--color-border)',
                    borderRadius: 'var(--radius-md)',
                    fontSize: 'var(--text-sm)',
                    color: 'var(--color-ink-primary)',
                    outline: 'none',
                    resize: 'vertical',
                  }}
                />
                {appFieldErrors.whoYouAre && (
                  <p style={{ color: '#ef4444', fontSize: '11px', marginTop: '4px', display: 'flex', alignItems: 'center', gap: '4px', fontWeight: 500 }}>
                    ⚠ {appFieldErrors.whoYouAre}
                  </p>
                )}
              </div>

              {/* Field 2: GitHub or project portfolio URL */}
              <div>
                <label style={{ display: 'block', fontSize: 'var(--text-xs)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--color-ink-secondary)', marginBottom: 'var(--space-1)' }}>
                  GitHub or Project Portfolio URL
                </label>
                <div style={{ position: 'relative' }}>
                  <Github size={18} style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: 'var(--color-ink-tertiary)' }} />
                  <input
                    type="url"
                    placeholder="https://github.com/yourhandle or website"
                    value={appPortfolioUrl}
                    onChange={(e) => setAppPortfolioUrl(e.target.value)}
                    style={{
                      width: '100%',
                      padding: '10px 12px 10px 38px',
                      backgroundColor: 'var(--color-paper)',
                      border: '1px solid var(--color-border)',
                      borderRadius: 'var(--radius-md)',
                      fontSize: 'var(--text-sm)',
                      color: 'var(--color-ink-primary)',
                      outline: 'none',
                    }}
                  />
                </div>
              </div>

              {/* Field 3: Have you worked on UNIHIKER projects? (Checkbox) */}
              <div>
                <label
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    cursor: 'pointer',
                    backgroundColor: 'var(--color-paper)',
                    border: '1px solid var(--color-border)',
                    borderRadius: 'var(--radius-md)',
                    padding: '10px 14px',
                  }}
                >
                  <span style={{ fontSize: 'var(--text-sm)', color: 'var(--color-ink-primary)', fontWeight: 600 }}>
                    Did you work with UNIHIKER board?
                  </span>
                  <input
                    type="checkbox"
                    checked={workedOnUnihiker}
                    onChange={(e) => {
                      setWorkedOnUnihiker(e.target.checked);
                      if (!e.target.checked) {
                        setUnihikerProjectUrl('');
                        setAppFieldErrors((prev) => ({ ...prev, unihikerUrl: undefined }));
                      }
                    }}
                    style={{ cursor: 'pointer', accentColor: 'var(--color-accent)', width: 18, height: 18 }}
                  />
                </label>
              </div>

              {/* Field 4: If yes ask for URL */}
              {workedOnUnihiker && (
                <div>
                  <label style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: 'var(--text-xs)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--color-ink-secondary)', marginBottom: 'var(--space-1)' }}>
                    <span>UNIHIKER Project or Repository URL</span>
                    <span style={{ color: '#ef4444' }}>*</span>
                  </label>
                  <input
                    type="url"
                    placeholder="https://github.com/username/unihiker-project"
                    value={unihikerProjectUrl}
                    onChange={(e) => {
                      setUnihikerProjectUrl(e.target.value);
                      if (appFieldErrors.unihikerUrl) {
                        setAppFieldErrors((prev) => ({ ...prev, unihikerUrl: undefined }));
                      }
                    }}
                    style={{
                      width: '100%',
                      padding: '10px 12px',
                      backgroundColor: 'var(--color-paper)',
                      border: appFieldErrors.unihikerUrl ? '1px solid #ef4444' : '1px solid var(--color-border)',
                      borderRadius: 'var(--radius-md)',
                      fontSize: 'var(--text-sm)',
                      color: 'var(--color-ink-primary)',
                      outline: 'none',
                    }}
                  />
                  {appFieldErrors.unihikerUrl ? (
                    <p style={{ color: '#ef4444', fontSize: '11px', marginTop: '4px', display: 'flex', alignItems: 'center', gap: '4px', fontWeight: 500 }}>
                      ⚠ {appFieldErrors.unihikerUrl}
                    </p>
                  ) : (
                    <span style={{ display: 'block', fontSize: '11px', color: 'var(--color-ink-tertiary)', marginTop: '4px' }}>
                      Provide a link to your code repository, demo video, or project documentation.
                    </span>
                  )}
                </div>
              )}

              {/* Field 5: Author Legal Policies (Always expanded, checkbox below) */}
              <div
                style={{
                  backgroundColor: 'var(--color-paper)',
                  border: appFieldErrors.policies ? '1px solid #ef4444' : '1px solid var(--color-border)',
                  borderRadius: 'var(--radius-lg)',
                  padding: 'var(--space-4)',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 'var(--space-3)',
                }}
              >
                <div>
                  <div style={{ fontSize: 'var(--text-xs)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--color-ink-primary)', marginBottom: 'var(--space-2)' }}>
                    Author Guidelines & Legal Policies
                  </div>
                  <ul style={{ margin: 0, paddingLeft: '18px', fontSize: '11.5px', color: 'var(--color-ink-secondary)', lineHeight: 1.6 }}>
                    <li><strong>Content Ownership:</strong> You retain ownership of your original guides and firmware. You grant K10 Hub a non-exclusive license to host and distribute them.</li>
                    <li><strong>Firmware Safety:</strong> Binaries must be safe, free of malicious code, and intended for UNIHIKER K10 / ESP32-S3 boards.</li>
                    <li><strong>Attribution:</strong> Open-source libraries and code snippets must respect their respective licenses (MIT, Apache, GPL).</li>
                    <li><strong>Community Standards:</strong> Content must be respectful, educational, and suitable for the global maker community.</li>
                  </ul>
                </div>

                <div style={{ paddingTop: 'var(--space-3)', borderTop: '1px solid var(--color-border)', display: 'flex', alignItems: 'flex-start', gap: 'var(--space-2)' }}>
                  <input
                    id="author-legal-terms"
                    type="checkbox"
                    checked={acceptPolicies}
                    onChange={(e) => {
                      setAcceptPolicies(e.target.checked);
                      if (appFieldErrors.policies) {
                        setAppFieldErrors((prev) => ({ ...prev, policies: undefined }));
                      }
                    }}
                    style={{ marginTop: '2px', cursor: 'pointer', accentColor: 'var(--color-accent)', width: 16, height: 16 }}
                  />
                  <label
                    htmlFor="author-legal-terms"
                    style={{ fontSize: 'var(--text-xs)', color: 'var(--color-ink-primary)', cursor: 'pointer', lineHeight: 1.5, fontWeight: 500 }}
                  >
                    I have read and accept the <strong>K10 Hub Author Legal Policies</strong> and Publishing Code of Conduct. <span style={{ color: '#ef4444' }}>*</span>
                  </label>
                </div>
                {appFieldErrors.policies && (
                  <p style={{ color: '#ef4444', fontSize: '11px', margin: 0, display: 'flex', alignItems: 'center', gap: '4px', fontWeight: 500 }}>
                    ⚠ {appFieldErrors.policies}
                  </p>
                )}
              </div>

              {/* Actions */}
              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 'var(--space-3)', marginTop: 'var(--space-2)' }}>
                <button
                  type="button"
                  onClick={() => setShowApplyModal(false)}
                  className="btn btn--secondary"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={appSubmitting}
                  className="btn btn--primary"
                  style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}
                >
                  {appSubmitting ? 'Submitting Application...' : 'Submit Application'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      <Footer />
    </div>
  );
}
