import { useState, useEffect } from 'react';
import { useParams, useNavigate, useSearchParams, Link } from 'react-router-dom';
import Header from '../../components/layout/Header';
import Footer from '../../components/layout/Footer';
import { useAuth } from '../../contexts/AuthContext';
import { toast } from '../../contexts/ToastContext';
import { api } from '../../services/api';
import { ProjectDetail, FirmwareConfig, ProjectAttachment, AVAILABLE_TOPICS } from '../../config/projectsData';
import {
  getProjectById,
  saveProjectAsync,
  formatCurrentPublishDate,
  parseVideoEmbedUrl,
  isProjectAuthor,
  normalizeImageUrl,
  normalizeMarkdownUrl,
} from '../../services/projects/projectStorageService';
import { marked } from 'marked';
import { convertGithubBlobToRaw } from '../../utils/githubUrl';
import { containsInappropriateWords, censorBadWords, validateUrl } from '../../utils/contentModeration';
import {
  Cpu,
  ArrowLeft,
  Save,
  AlertCircle,
  Plus,
  Trash2,
  Loader2,
  Sparkles,
  Send,
  Eye,
  ShieldAlert,
  Check,
  CheckCircle2,
  Paperclip,
} from 'lucide-react';

export default function ProjectEditorPage() {
  const { id: paramId } = useParams<{ id: string }>();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { user, profile, role } = useAuth();

  const isEditing = Boolean(paramId);
  const typeParam = searchParams.get('type');
  const initialType: 'Project' | 'Tutorial' =
    typeParam?.toLowerCase() === 'tutorial' ? 'Tutorial' : 'Project';

  // Form State
  const [title, setTitle] = useState('');
  const [slugId, setSlugId] = useState('');
  const [slugTouched, setSlugTouched] = useState(false);
  const [type, setType] = useState<'Project' | 'Tutorial'>(initialType);
  const [level, setLevel] = useState<number>(1);
  const [description, setDescription] = useState('');

  // Media
  const [coverImage, setCoverImage] = useState('');
  const [coverImageError, setCoverImageError] = useState(false);
  const [videoLink, setVideoLink] = useState('');

  // Documentation URL (as requested: simple .md file URL)
  const [projectMdFile, setProjectMdFile] = useState('');
  const [mdPreviewContent, setMdPreviewContent] = useState<string | null>(null);
  const [mdPreviewLoading, setMdPreviewLoading] = useState(false);
  const [mdPreviewError, setMdPreviewError] = useState<string | null>(null);
  const [showMdPreview, setShowMdPreview] = useState(false);

  // Author information automatically resolved from active authenticated user
  const currentAuthorName = profile?.name || user?.user_metadata?.full_name || user?.user_metadata?.name || user?.email?.split('@')[0] || 'Maker';
  const currentAuthorId = profile?.id ? String(profile.id) : (user?.id ? String(user.id) : '');
  const currentAuthorRole = profile?.role === 'admin' ? 'admin' : profile?.role === 'author' ? 'author' : 'user';
  const currentAuthorAvatar = profile?.avatarUrl || user?.user_metadata?.avatar_url || '';

  const [existingProject, setExistingProject] = useState<ProjectDetail | null>(null);
  const [hasEditPermission, setHasEditPermission] = useState<boolean>(true);
  const [status, setStatus] = useState<'draft' | 'pending_approval' | 'published' | 'rejected'>('draft');
  const [githubLink, setGithubLink] = useState('');
  const [docLink, setDocLink] = useState('');
  const [license, setLicense] = useState('MIT');
  const [selectedTopics, setSelectedTopics] = useState<string[]>([]);
  const [customTagsInput, setCustomTagsInput] = useState('UNIHIKER K10');

  // Firmwares List
  const [firmwares, setFirmwares] = useState<FirmwareConfig[]>([
    {
      version: 'v1.0.0',
      name: 'Default Production Edition',
      releaseDate: formatCurrentPublishDate(),
      firmwareUrl: '',
      flashAddress: '0x0000',
      versionNote: '',
    },
  ]);

  // File Attachments List
  const [attachments, setAttachments] = useState<ProjectAttachment[]>([]);

  const [publishDate, setPublishDate] = useState('');
  const [flashCount, setFlashCount] = useState(0);
  const [formError, setFormError] = useState('');
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [isSaving, setIsSaving] = useState(false);

  // Auto-slug generation from title
  const handleTitleChange = (val: string) => {
    setTitle(val);
    if (!slugTouched && !isEditing) {
      const generatedSlug = val
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/(^-|-$)+/g, '');
      setSlugId(generatedSlug);
    }
  };

  // Load project if in editing mode and verify author permissions
  useEffect(() => {
    let isMounted = true;

    const populateFromProject = (existing: ProjectDetail) => {
      setExistingProject(existing);
      const authorized = (role === 'author' || role === 'admin') && isProjectAuthor(existing, user, profile);
      setHasEditPermission(authorized);

      if (authorized) {
        setTitle(existing.title || '');
        setSlugId(existing.id || '');
        setSlugTouched(true);
        setType((existing.type as 'Project' | 'Tutorial') || 'Project');
        setLevel(existing.level || 1);
        setDescription(existing.description || '');
        setCoverImage(existing.coverImage || '');
        setVideoLink(existing.videoLink || '');
        setProjectMdFile(existing.projectMdFile || '');
        setGithubLink(existing.githubLink || '');
        setDocLink(existing.docLink || '');
        setLicense(existing.license || 'MIT');
        if (existing.tags && Array.isArray(existing.tags)) {
          const matchedTopics = existing.tags.filter((t) => AVAILABLE_TOPICS.includes(t as any));
          const otherTags = existing.tags.filter((t) => !AVAILABLE_TOPICS.includes(t as any));
          setSelectedTopics(matchedTopics);
          setCustomTagsInput(otherTags.join(', '));
        } else {
          setSelectedTopics([]);
          setCustomTagsInput('');
        }
        setPublishDate(existing.publishDate || '');
        setStatus(existing.status || 'published');
        setFlashCount(existing.flashCount || 0);
        if (existing.firmwares && existing.firmwares.length > 0) {
          setFirmwares(existing.firmwares);
        }
        if (existing.attachments && existing.attachments.length > 0) {
          setAttachments(existing.attachments);
        } else {
          setAttachments([]);
        }
      } else {
        setFormError('Permission denied: Only the original author has permission to edit this project or tutorial.');
      }
    };

    if (isEditing && paramId) {
      const existing = getProjectById(paramId);
      if (existing) {
        populateFromProject(existing);
      } else {
        // Fallback: Fetch directly from backend API
        api.projects.get(paramId)
          .then((res) => {
            if (!isMounted) return;
            if (res && res.data) {
              populateFromProject(res.data);
            } else {
              setExistingProject(null);
              setHasEditPermission(false);
              setFormError(`Project with ID "${paramId}" was not found.`);
            }
          })
          .catch(() => {
            if (!isMounted) return;
            setExistingProject(null);
            setHasEditPermission(false);
            setFormError(`Project with ID "${paramId}" was not found.`);
          });
      }
    } else {
      const canCreate = role === 'author' || role === 'admin';
      setHasEditPermission(canCreate);
      setStatus('draft');
    }

    return () => {
      isMounted = false;
    };
  }, [isEditing, paramId, user, profile, role]);

  // Test fetch remote .md file for live preview
  const handleTestFetchMd = async () => {
    const rawUrl = projectMdFile.trim();
    if (!rawUrl) {
      setMdPreviewError('Please enter a valid Markdown (.md) URL first.');
      return;
    }
    const cleanUrl = normalizeMarkdownUrl(rawUrl);
    setProjectMdFile(cleanUrl);
    setMdPreviewLoading(true);
    setMdPreviewError(null);
    setShowMdPreview(true);

    try {
      const res = await fetch(cleanUrl);
      if (!res.ok) {
        throw new Error(`HTTP ${res.status}: Failed to fetch file`);
      }
      const text = await res.text();
      setMdPreviewContent(text);
      setMdPreviewLoading(false);
    } catch (err: any) {
      setMdPreviewError(err.message || 'Failed to fetch remote markdown file.');
      setMdPreviewLoading(false);
    }
  };

  // Add / Remove Firmware row
  const handleAddFirmware = () => {
    setFirmwares([
      ...firmwares,
      {
        version: `v1.${firmwares.length}.0`,
        name: 'New Firmware Edition',
        releaseDate: formatCurrentPublishDate(),
        firmwareUrl: '',
        flashAddress: '0x0000',
        versionNote: '',
      },
    ]);
  };

  const handleRemoveFirmware = (idx: number) => {
    if (firmwares.length <= 1) {
      toast.warning('You must have at least one firmware build configured.', 'Firmware Required');
      return;
    }
    setFirmwares(firmwares.filter((_, i) => i !== idx));
  };

  const handleFirmwareChange = (idx: number, field: keyof FirmwareConfig, value: string) => {
    let finalValue = value;
    if (field === 'firmwareUrl') {
      finalValue = convertGithubBlobToRaw(value);
    }
    const updated = [...firmwares];
    updated[idx] = { ...updated[idx], [field]: finalValue };
    setFirmwares(updated);
  };

  // Add / Remove Attachment row
  const handleAddAttachment = () => {
    setAttachments([
      ...attachments,
      {
        name: '',
        fileUrl: '',
        fileSize: '',
        fileType: '',
      },
    ]);
  };

  const handleRemoveAttachment = (idx: number) => {
    setAttachments(attachments.filter((_, i) => i !== idx));
  };

  const handleAttachmentChange = (idx: number, field: keyof ProjectAttachment, value: string) => {
    const updated = [...attachments];
    let sanitizedVal = value;

    if (field === 'fileUrl') {
      sanitizedVal = convertGithubBlobToRaw(value.trim());
      // Auto-infer name and fileType if currently empty
      if (!updated[idx].name || !updated[idx].name.trim()) {
        try {
          const urlObj = new URL(sanitizedVal.startsWith('http') ? sanitizedVal : `https://${sanitizedVal}`);
          const segment = urlObj.pathname.split('/').filter(Boolean).pop();
          if (segment) {
            updated[idx].name = decodeURIComponent(segment);
            const dot = segment.lastIndexOf('.');
            if (dot !== -1) {
              updated[idx].fileType = segment.substring(dot + 1).toUpperCase();
            }
          }
        } catch {
          // ignore
        }
      }
    } else if (field === 'name') {
      // Auto infer fileType if name contains extension and fileType is empty
      const dot = value.lastIndexOf('.');
      if (dot !== -1 && !updated[idx].fileType) {
        updated[idx].fileType = value.substring(dot + 1).toUpperCase();
      }
    }

    updated[idx] = {
      ...updated[idx],
      [field]: sanitizedVal,
    };
    setAttachments(updated);
  };

  // Toggle topic selection
  const toggleTopic = (topic: string) => {
    setSelectedTopics((prev) =>
      prev.includes(topic) ? prev.filter((t) => t !== topic) : [...prev, topic]
    );
  };

  // Submit Handler
  const handleSave = async (targetStatus?: 'draft' | 'pending_approval' | 'published') => {
    setFormError('');
    setFieldErrors({});

    const newErrors: Record<string, string> = {};
    const cleanSlug = slugId.trim().toLowerCase();

    if (!title.trim()) {
      newErrors.title = 'Project Title is required.';
    } else if (containsInappropriateWords(title)) {
      newErrors.title = 'Inappropriate language detected. K10 Hub is a professional platform for all age groups.';
    }

    if (!cleanSlug) {
      newErrors.slugId = 'Project URL Slug ID is required.';
    }

    const isDraft = (targetStatus || status) === 'draft';

    if (!isDraft && !description.trim()) {
      newErrors.description = 'Short Pitch overview is required.';
    } else if (description.trim() && containsInappropriateWords(description)) {
      newErrors.description = 'Inappropriate language detected. K10 Hub is a professional platform for all age groups.';
    }

    if (customTagsInput && containsInappropriateWords(customTagsInput)) {
      newErrors.customTags = 'Inappropriate language detected in tags.';
    }

    // Validate link insertions
    if (coverImage.trim()) {
      const v = validateUrl(coverImage, 'Cover Image URL');
      if (!v.isValid) newErrors.coverImage = v.error || 'Invalid Cover Image URL';
    }

    // Documentation URL (.md) is strictly required
    if (!projectMdFile.trim()) {
      newErrors.projectMdFile = 'Documentation URL (.md file) is required.';
    } else {
      const v = validateUrl(projectMdFile, 'Markdown Guide URL');
      if (!v.isValid) newErrors.projectMdFile = v.error || 'Invalid Markdown Guide URL';
    }

    if (videoLink.trim()) {
      const v = validateUrl(videoLink, 'Video Link');
      if (!v.isValid) newErrors.videoLink = v.error || 'Invalid Video Link';
    }

    if (githubLink.trim()) {
      const v = validateUrl(githubLink, 'GitHub Link');
      if (!v.isValid) newErrors.githubLink = v.error || 'Invalid GitHub Link';
    }

    if (docLink.trim()) {
      const v = validateUrl(docLink, 'Documentation Link');
      if (!v.isValid) newErrors.docLink = v.error || 'Invalid Documentation Link';
    }

    // Firmware builds validation (Version, Flash Address, .bin URL are required)
    if (firmwares.length === 0) {
      newErrors.firmwares = 'At least one firmware build configuration is required.';
    } else {
      for (let i = 0; i < firmwares.length; i++) {
        const fw = firmwares[i];
        if (!fw.version.trim()) {
          newErrors[`fw_${i}_version`] = `Firmware Version is required for Build #${i + 1}.`;
        }
        if (!fw.flashAddress || !fw.flashAddress.trim()) {
          newErrors[`fw_${i}_address`] = `Flash Address is required for Build #${i + 1} (e.g. 0x0000 or 0x00).`;
        }
        if (!fw.firmwareUrl.trim()) {
          newErrors[`fw_${i}_url`] = `Firmware Binary URL (.bin) is required for Build #${i + 1}.`;
        } else {
          const v = validateUrl(fw.firmwareUrl, `Firmware #${i + 1} URL`);
          if (!v.isValid) newErrors[`fw_${i}_url`] = v.error || 'Invalid Firmware URL';
        }
        if (fw.name && containsInappropriateWords(fw.name)) {
          newErrors[`fw_${i}_name`] = `Inappropriate language in Firmware edition #${i + 1}.`;
        }
        if (fw.versionNote && containsInappropriateWords(fw.versionNote)) {
          newErrors[`fw_${i}_note`] = `Inappropriate language in Firmware release notes #${i + 1}.`;
        }
      }
    }

    // Attachments validation
    for (let i = 0; i < attachments.length; i++) {
      const att = attachments[i];
      if (att.fileUrl && att.fileUrl.trim()) {
        const v = validateUrl(att.fileUrl, `Attachment #${i + 1} URL`);
        if (!v.isValid) newErrors[`att_${i}_url`] = v.error || 'Invalid Attachment URL';
      } else if (att.name && att.name.trim()) {
        newErrors[`att_${i}_url`] = `File Download URL is required for Attachment #${i + 1}.`;
      }
      if (att.name && containsInappropriateWords(att.name)) {
        newErrors[`att_${i}_name`] = `Inappropriate language in Attachment #${i + 1} name.`;
      }
    }

    // Check slug collision if creating new
    if (!isEditing && cleanSlug) {
      const existing = getProjectById(cleanSlug);
      if (existing) {
        newErrors.slugId = `A project with slug "${cleanSlug}" already exists. Please choose a unique title.`;
      }
    }

    if (Object.keys(newErrors).length > 0) {
      setFieldErrors(newErrors);
      setFormError('Please fill in all required fields marked with * before proceeding.');
      const firstKey = Object.keys(newErrors)[0];
      const el = document.getElementById(`input-${firstKey}`);
      if (el) {
        el.scrollIntoView({ behavior: 'smooth', block: 'center' });
        el.focus();
      } else {
        window.scrollTo({ top: 0, behavior: 'smooth' });
      }
      return;
    }

    // Check permission if editing
    if (isEditing && existingProject && !((role === 'author' || role === 'admin') && isProjectAuthor(existingProject, user, profile))) {
      setFormError('Permission denied: Only the original author has permission to edit this project or tutorial.');
      return;
    }

    if (!isEditing && role !== 'admin' && role !== 'author') {
      setFormError('Permission denied: Active Author privileges are required to create projects.');
      return;
    }

    setIsSaving(true);

    try {
      const parsedCustomTags = customTagsInput
        .split(',')
        .map((t) => t.trim())
        .filter(Boolean);
      const combinedTags = Array.from(new Set([...selectedTopics, ...parsedCustomTags]));

      const nextStatus = targetStatus || status;
      const nextVisibility = nextStatus === 'published' ? 'public' : 'draft';
      const currentDate = formatCurrentPublishDate();

      // Automatically assign release date to firmwares and sanitize GitHub URLs
      const stampedFirmwares = firmwares
        .filter((f) => f.name.trim() || f.version.trim())
        .map((f) => ({
          ...f,
          firmwareUrl: convertGithubBlobToRaw(f.firmwareUrl),
          releaseDate: f.releaseDate && f.releaseDate.trim() ? f.releaseDate : currentDate,
        }));

      // Sanitize attachments
      const stampedAttachments = attachments
        .filter((a) => a.fileUrl && a.fileUrl.trim())
        .map((a) => ({
          ...a,
          fileUrl: convertGithubBlobToRaw(a.fileUrl.trim()),
          name: a.name.trim() || a.fileUrl.split('/').pop() || 'Attachment',
          fileSize: a.fileSize?.trim() || undefined,
          fileType: a.fileType?.trim() || undefined,
        }));

      const finalAuthorId = currentAuthorId || (isEditing && existingProject ? existingProject.authorId : '');
      const finalAuthor =
        isProjectAuthor(existingProject, user, profile) || !existingProject
          ? currentAuthorName
          : (existingProject?.author || currentAuthorName);
      const finalAuthorRole =
        isProjectAuthor(existingProject, user, profile) || !existingProject
          ? currentAuthorRole
          : (existingProject?.authorRole || currentAuthorRole);
      const finalAuthorAvatar =
        isProjectAuthor(existingProject, user, profile) || !existingProject
          ? currentAuthorAvatar
          : (existingProject?.authorAvatar || currentAuthorAvatar);
      const finalAuthorEmail =
        profile?.email || user?.email || existingProject?.authorEmail || '';

      const projectToSave: ProjectDetail = {
        id: cleanSlug,
        title: censorBadWords(title.trim()),
        type,
        level,
        author: censorBadWords(finalAuthor),
        authorId: finalAuthorId,
        authorRole: finalAuthorRole,
        authorAvatar: finalAuthorAvatar,
        authorEmail: finalAuthorEmail,
        status: nextStatus,
        visibility: nextVisibility,
        publishDate: nextStatus === 'published' ? (publishDate || currentDate) : (publishDate || ''),
        flashCount: flashCount || 0,
        description: censorBadWords(description.trim()) || 'Work in progress draft.',
        coverImage: coverImage.trim() || '/images/Place Holder.png',
        videoLink: videoLink.trim() || undefined,
        projectMdFile: projectMdFile.trim() || null,
        markdownContent: mdPreviewContent ? censorBadWords(mdPreviewContent) : undefined,
        githubLink: githubLink.trim() || undefined,
        docLink: docLink.trim() || undefined,
        license: license.trim() || 'MIT',
        tags: combinedTags.length > 0 ? combinedTags : ['UNIHIKER K10'],
        firmwares: stampedFirmwares,
        attachments: stampedAttachments,
      };

      await saveProjectAsync(projectToSave);
      setIsSaving(false);

      if (nextStatus === 'pending_approval') {
        toast.success(
          'Your project has been submitted for Admin Verification! Once verified, it will be published to the public catalog.',
          'Submitted for Review'
        );
        navigate('/profile?tab=review#contributed-projects');
      } else if (nextStatus === 'draft') {
        toast.success(
          'Draft saved successfully! You can access it anytime in your Profile under the Draft tab.',
          'Draft Saved'
        );
        navigate('/profile?tab=draft#contributed-projects');
      } else {
        toast.success(
          isEditing ? `${type} updated successfully!` : `${type} published successfully!`,
          isEditing ? 'Updated' : 'Published'
        );
        // Navigate to project detail page
        navigate(`/project/${cleanSlug}`);
      }
    } catch (err: any) {
      setIsSaving(false);
      setFormError(err.message || 'Failed to save project.');
    }
  };

  const parsedVideo = parseVideoEmbedUrl(videoLink);

  if (!hasEditPermission) {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column', backgroundColor: 'var(--color-paper)' }}>
        <Header />
        <main style={{ flex: 1, paddingTop: 'calc(var(--nav-height) + var(--space-12))', paddingBottom: 'var(--space-16)' }}>
          <div className="container" style={{ maxWidth: 600, textAlign: 'center' }}>
            <ShieldAlert size={48} style={{ color: 'rgb(220, 38, 38)', margin: '0 auto var(--space-4)' }} />
            <h1 style={{ fontSize: 'var(--text-2xl)', fontWeight: 700, color: 'var(--color-ink-primary)', marginBottom: 'var(--space-2)' }}>
              {isEditing ? 'Permission Denied' : 'Author Privileges Required'}
            </h1>
            <p style={{ color: 'var(--color-ink-secondary)', fontSize: 'var(--text-sm)', marginBottom: 'var(--space-6)', lineHeight: 1.6 }}>
              {!user
                ? 'You must be signed in with an Author account to create or edit projects.'
                : isEditing
                ? `Only the original author has permission to edit this ${existingProject?.type || 'project'}.`
                : 'Active Author privileges are required to create and publish projects or tutorials.'}
            </p>
            <div style={{ display: 'flex', justifyContent: 'center', gap: 'var(--space-3)', flexWrap: 'wrap' }}>
              {!user ? (
                <Link to="/login" className="btn btn--primary">
                  Sign In
                </Link>
              ) : !isEditing ? (
                <Link to="/profile" className="btn btn--primary">
                  Apply for Author Status
                </Link>
              ) : existingProject ? (
                <Link to={`/project/${existingProject.id}`} className="btn btn--primary">
                  View Project
                </Link>
              ) : null}
              <Link to="/projects" className="btn btn--secondary">
                Browse Projects Gallery
              </Link>
            </div>
          </div>
        </main>
        <Footer />
      </div>
    );
  }

  return (
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column', backgroundColor: 'var(--color-paper)' }}>
      <Header />

      <main style={{ flex: 1, paddingTop: 'calc(var(--nav-height) + var(--space-6))', paddingBottom: 'var(--space-16)' }}>
        <div className="container">

          {/* Breadcrumb & Quick Action Bar */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 'var(--space-4)', marginBottom: 'var(--space-6)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)' }}>
              <button
                type="button"
                onClick={() => navigate(-1)}
                className="btn btn--ghost btn--sm"
                style={{ display: 'inline-flex', alignItems: 'center', gap: '0.4rem', fontSize: 'var(--text-xs)' }}
              >
                <ArrowLeft size={14} /> Back
              </button>
              <span style={{ color: 'var(--color-ink-tertiary)', fontSize: 'var(--text-xs)' }}>/</span>
              <Link to="/projects" style={{ color: 'var(--color-ink-secondary)', textDecoration: 'none', fontSize: 'var(--text-xs)' }}>
                Projects
              </Link>
              <span style={{ color: 'var(--color-ink-tertiary)', fontSize: 'var(--text-xs)' }}>/</span>
              <span style={{ color: 'var(--color-accent)', fontWeight: 600, fontSize: 'var(--text-xs)' }}>
                {isEditing ? `Edit: ${title || paramId}` : `Create New ${type}`}
              </span>
            </div>

            {/* Top Action Buttons: Draft & Submit for Review / Publish / Update */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-3)' }}>
              <button
                type="button"
                onClick={() => navigate('/projects')}
                className="btn btn--secondary btn--sm"
              >
                Cancel
              </button>
              {!isEditing && (
                <button
                  type="button"
                  onClick={() => handleSave('draft')}
                  disabled={isSaving}
                  className="btn btn--secondary btn--sm"
                  style={{ display: 'inline-flex', alignItems: 'center', gap: '0.4rem' }}
                >
                  <Save size={14} /> Save Draft
                </button>
              )}
              <button
                type="button"
                onClick={() =>
                  handleSave(
                    isEditing
                      ? (existingProject?.status === 'published' || role === 'admin' ? 'published' : 'pending_approval')
                      : role === 'admin'
                      ? 'published'
                      : 'pending_approval'
                  )
                }
                disabled={isSaving}
                className="btn btn--primary btn--sm"
                style={{ display: 'inline-flex', alignItems: 'center', gap: '0.4rem' }}
              >
                {isSaving ? (
                  <Loader2 size={14} className="animate-spin" />
                ) : isEditing ? (
                  <CheckCircle2 size={14} />
                ) : role === 'admin' ? (
                  <Sparkles size={14} />
                ) : (
                  <Send size={14} />
                )}
                {isSaving
                  ? 'Saving...'
                  : isEditing
                  ? 'Update'
                  : role === 'admin'
                  ? 'Publish'
                  : 'Submit for Review'}
              </button>
            </div>
          </div>

          {/* Page Header */}
          <div style={{ marginBottom: 'var(--space-8)' }}>
            <div
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '6px',
                fontSize: 'var(--text-xs)',
                fontWeight: 700,
                textTransform: 'uppercase',
                letterSpacing: '0.08em',
                color: 'var(--color-accent)',
                marginBottom: 'var(--space-2)',
              }}
            >
              <Cpu size={14} /> Author Creator Studio
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-3)', marginBottom: 'var(--space-2)' }}>
              <h1
                style={{
                  fontSize: 'clamp(var(--text-2xl), 3vw, var(--text-3xl))',
                  fontWeight: 800,
                  color: 'var(--color-ink-primary)',
                  letterSpacing: '-0.02em',
                  margin: 0,
                }}
              >
                {isEditing ? `Edit Project: ${title || paramId}` : `Create New ${type}`}
              </h1>
              <span
                style={{
                  fontSize: '11px',
                  fontWeight: 700,
                  padding: '3px 10px',
                  borderRadius: 'var(--radius-full)',
                  textTransform: 'uppercase',
                  letterSpacing: '0.05em',
                  backgroundColor:
                    status === 'published'
                      ? 'rgba(34, 197, 94, 0.15)'
                      : status === 'pending_approval'
                      ? 'rgba(234, 179, 8, 0.15)'
                      : status === 'rejected'
                      ? 'rgba(239, 68, 68, 0.15)'
                      : 'rgba(100, 116, 139, 0.15)',
                  color:
                    status === 'published'
                      ? '#16a34a'
                      : status === 'pending_approval'
                      ? '#ca8a04'
                      : status === 'rejected'
                      ? '#dc2626'
                      : '#64748b',
                  border:
                    status === 'published'
                      ? '1px solid rgba(34, 197, 94, 0.3)'
                      : status === 'pending_approval'
                      ? '1px solid rgba(234, 179, 8, 0.3)'
                      : status === 'rejected'
                      ? '1px solid rgba(239, 68, 68, 0.3)'
                      : '1px solid rgba(100, 116, 139, 0.3)',
                }}
              >
                {status === 'published'
                  ? 'Published'
                  : status === 'pending_approval'
                  ? 'Pending Verification'
                  : status === 'rejected'
                  ? 'Rejected'
                  : 'Draft'}
              </span>
            </div>
            <p style={{ color: 'var(--color-ink-secondary)', fontSize: 'var(--text-sm)', maxWidth: 680, margin: 0, lineHeight: 1.6 }}>
              Configure your UNIHIKER K10 hardware project or tutorial, link your remote Markdown guide, connect video walkthroughs, and attach pre-compiled firmware binaries for 1-click browser flashing.
            </p>
          </div>

          {/* Error Banner */}
          {formError && (
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 'var(--space-3)',
                padding: '12px 16px',
                backgroundColor: 'rgba(239, 68, 68, 0.1)',
                border: '1px solid rgba(239, 68, 68, 0.25)',
                borderRadius: 'var(--radius-lg)',
                color: '#dc2626',
                fontSize: 'var(--text-sm)',
                marginBottom: 'var(--space-6)',
              }}
            >
              <AlertCircle size={18} />
              <span>{formError}</span>
            </div>
          )}

          <form onSubmit={(e) => { e.preventDefault(); handleSave(); }} style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-6)' }}>

            {/* ── Section 1: Basic Details ─────────────────────────────────── */}
            <div
              style={{
                backgroundColor: 'var(--color-surface)',
                border: '1px solid var(--color-border)',
                borderRadius: 'var(--radius-xl)',
                padding: 'var(--space-8)',
                boxShadow: 'var(--shadow-sm)',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: 'var(--space-4)' }}>
                <span
                  style={{
                    width: 24,
                    height: 24,
                    borderRadius: 'var(--radius-full)',
                    backgroundColor: 'var(--color-accent)',
                    color: '#fff',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: '12px',
                    fontWeight: 700,
                  }}
                >
                  1
                </span>
                <h2 style={{ fontSize: 'var(--text-lg)', fontWeight: 700, margin: 0, color: 'var(--color-ink-primary)' }}>
                  Basic Details
                </h2>
              </div>

              {/* Title & Hidden Slug */}
              <div style={{ marginBottom: 'var(--space-5)' }}>
                <label style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: 'var(--text-xs)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--color-ink-secondary)', marginBottom: '6px' }}>
                  <span>Title</span> <span style={{ color: '#dc2626' }}>*</span>
                </label>
                <input
                  id="input-title"
                  type="text"
                  value={title}
                  onChange={(e) => {
                    handleTitleChange(e.target.value);
                    if (fieldErrors.title) {
                      setFieldErrors((prev) => {
                        const copy = { ...prev };
                        delete copy.title;
                        return copy;
                      });
                    }
                  }}
                  placeholder="Ai Buddy - DIY AI Companion"
                  style={{
                    width: '100%',
                    padding: '10px 14px',
                    backgroundColor: 'var(--color-paper)',
                    border: fieldErrors.title ? '1px solid #dc2626' : '1px solid var(--color-border)',
                    borderRadius: 'var(--radius-md)',
                    fontSize: 'var(--text-sm)',
                    color: 'var(--color-ink-primary)',
                    outline: 'none',
                  }}
                />
                {fieldErrors.title && (
                  <p style={{ color: '#dc2626', fontSize: '11px', marginTop: '4px', display: 'flex', alignItems: 'center', gap: '4px', fontWeight: 500 }}>
                    ⚠ {fieldErrors.title}
                  </p>
                )}
                {slugId && (
                  <div style={{ fontSize: '11px', color: 'var(--color-ink-tertiary)', marginTop: '4px' }}>
                    Path: <code>/project/{slugId}</code>
                  </div>
                )}
                {fieldErrors.slugId && (
                  <p style={{ color: '#dc2626', fontSize: '11px', marginTop: '4px', display: 'flex', alignItems: 'center', gap: '4px', fontWeight: 500 }}>
                    ⚠ {fieldErrors.slugId}
                  </p>
                )}
                {/* Hidden slug input auto-filled based on title */}
                <input type="hidden" value={slugId} />
              </div>

              {/* Short Pitch */}
              <div style={{ marginBottom: 'var(--space-5)' }}>
                <label style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: 'var(--text-xs)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--color-ink-secondary)', marginBottom: '6px' }}>
                  <span>Short Pitch</span> <span style={{ color: '#dc2626' }}>*</span>
                </label>
                <textarea
                  id="input-description"
                  rows={3}
                  value={description}
                  onChange={(e) => {
                    setDescription(e.target.value);
                    if (fieldErrors.description) {
                      setFieldErrors((prev) => {
                        const copy = { ...prev };
                        delete copy.description;
                        return copy;
                      });
                    }
                  }}
                  placeholder="A brief 1-2 sentence overview of your project..."
                  style={{
                    width: '100%',
                    padding: '10px 14px',
                    backgroundColor: 'var(--color-paper)',
                    border: fieldErrors.description ? '1px solid #dc2626' : '1px solid var(--color-border)',
                    borderRadius: 'var(--radius-md)',
                    fontSize: 'var(--text-sm)',
                    color: 'var(--color-ink-primary)',
                    outline: 'none',
                    lineHeight: 1.5,
                    resize: 'vertical',
                  }}
                />
                {fieldErrors.description && (
                  <p style={{ color: '#dc2626', fontSize: '11px', marginTop: '4px', display: 'flex', alignItems: 'center', gap: '4px', fontWeight: 500 }}>
                    ⚠ {fieldErrors.description}
                  </p>
                )}
              </div>

              {/* Cover Image URL & 4:3 Auto-crop Preview */}
              <div>
                <label style={{ display: 'block', fontSize: 'var(--text-xs)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--color-ink-secondary)', marginBottom: '6px' }}>
                  Cover Image URL
                </label>
                <input
                  type="url"
                  value={coverImage}
                  onChange={(e) => {
                    const val = e.target.value;
                    const normalized = convertGithubBlobToRaw(val);
                    setCoverImage(normalized);
                    setCoverImageError(false);
                  }}
                  onBlur={(e) => {
                    const normalized = convertGithubBlobToRaw(e.target.value);
                    if (normalized !== coverImage) {
                      setCoverImage(normalized);
                      setCoverImageError(false);
                    }
                  }}
                  placeholder="https://.../cover.png, .gif, or GitHub blob URL"
                  style={{
                    width: '100%',
                    padding: '10px 14px',
                    backgroundColor: 'var(--color-paper)',
                    border: '1px solid var(--color-border)',
                    borderRadius: 'var(--radius-md)',
                    fontSize: 'var(--text-sm)',
                    color: 'var(--color-ink-primary)',
                    outline: 'none',
                    marginBottom: coverImage.trim() ? 'var(--space-2)' : 0,
                  }}
                />
                <span style={{ display: 'block', fontSize: '10.5px', color: 'var(--color-ink-tertiary)', marginTop: '4px', marginBottom: 'var(--space-2)' }}>
                  GitHub links (e.g. <code>github.com/.../blob/...</code>) are automatically converted to raw image links.
                </span>
                {coverImage.trim() && !coverImageError && (
                  <div
                    style={{
                      width: '100%',
                      maxWidth: 280,
                      aspectRatio: '4 / 3',
                      backgroundColor: '#0f172a',
                      borderRadius: 'var(--radius-lg)',
                      overflow: 'hidden',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      border: '1px solid var(--color-border)',
                      marginTop: 'var(--space-2)',
                    }}
                  >
                    <img
                      src={normalizeImageUrl(coverImage)}
                      alt="Cover Preview"
                      style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
                      onLoad={() => setCoverImageError(false)}
                      onError={() => setCoverImageError(true)}
                    />
                  </div>
                )}
                {coverImage.trim() && coverImageError && (
                  <p style={{ color: '#dc2626', fontSize: '11px', marginTop: '6px', display: 'flex', alignItems: 'center', gap: '4px', fontWeight: 500 }}>
                    ⚠ Unable to load image preview. Please check the URL or provide a direct image link.
                  </p>
                )}
              </div>
            </div>

            {/* ── Section 2: Video & Documentation ───────────────────────── */}
            <div
              style={{
                backgroundColor: 'var(--color-surface)',
                border: '1px solid var(--color-border)',
                borderRadius: 'var(--radius-xl)',
                padding: 'var(--space-8)',
                boxShadow: 'var(--shadow-sm)',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: 'var(--space-4)' }}>
                <span
                  style={{
                    width: 24,
                    height: 24,
                    borderRadius: 'var(--radius-full)',
                    backgroundColor: 'var(--color-accent)',
                    color: '#fff',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: '12px',
                    fontWeight: 700,
                  }}
                >
                  2
                </span>
                <h2 style={{ fontSize: 'var(--text-lg)', fontWeight: 700, margin: 0, color: 'var(--color-ink-primary)' }}>
                  Video & Documentation
                </h2>
              </div>

              {/* Video URL */}
              <div style={{ marginBottom: 'var(--space-5)' }}>
                <label style={{ display: 'block', fontSize: 'var(--text-xs)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--color-ink-secondary)', marginBottom: '6px' }}>
                  Video URL (YouTube / Vimeo / MP4)
                </label>
                <input
                  type="url"
                  value={videoLink}
                  onChange={(e) => setVideoLink(e.target.value)}
                  placeholder="https://www.youtube.com/watch?v=..."
                  style={{
                    width: '100%',
                    padding: '10px 14px',
                    backgroundColor: 'var(--color-paper)',
                    border: '1px solid var(--color-border)',
                    borderRadius: 'var(--radius-md)',
                    fontSize: 'var(--text-sm)',
                    color: 'var(--color-ink-primary)',
                    outline: 'none',
                  }}
                />
                {videoLink && parsedVideo?.embedUrl && (
                  <div
                    style={{
                      width: '100%',
                      maxWidth: 400,
                      aspectRatio: '16 / 9',
                      backgroundColor: '#0f172a',
                      borderRadius: 'var(--radius-lg)',
                      overflow: 'hidden',
                      marginTop: 'var(--space-2)',
                      border: '1px solid var(--color-border)',
                    }}
                  >
                    <iframe
                      src={parsedVideo.embedUrl}
                      title="Video Preview"
                      allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                      allowFullScreen
                      style={{ width: '100%', height: '100%', border: 'none' }}
                    />
                  </div>
                )}
              </div>

              {/* Documentation URL */}
              <div>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '6px' }}>
                  <label style={{ fontSize: 'var(--text-xs)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--color-ink-secondary)' }}>
                    Documentation URL (.md file) <span style={{ color: '#ef4444' }}>*</span>
                  </label>
                  {projectMdFile.trim() && (
                    <button
                      type="button"
                      onClick={handleTestFetchMd}
                      disabled={mdPreviewLoading}
                      className="btn btn--secondary btn--sm"
                      style={{ fontSize: '11px', padding: '3px 10px', display: 'inline-flex', alignItems: 'center', gap: '4px' }}
                    >
                      {mdPreviewLoading ? <Loader2 size={12} className="animate-spin" /> : <Eye size={12} />}
                      {mdPreviewLoading ? 'Fetching...' : showMdPreview ? 'Hide Preview' : 'Preview'}
                    </button>
                  )}
                </div>
                <input
                  id="input-projectMdFile"
                  type="url"
                  value={projectMdFile}
                  onChange={(e) => {
                    const val = e.target.value;
                    const normalized = convertGithubBlobToRaw(val);
                    setProjectMdFile(normalized);
                    if (mdPreviewError) setMdPreviewError(null);
                    if (fieldErrors.projectMdFile) {
                      setFieldErrors((prev) => {
                        const next = { ...prev };
                        delete next.projectMdFile;
                        return next;
                      });
                    }
                  }}
                  onBlur={(e) => {
                    const normalized = convertGithubBlobToRaw(e.target.value);
                    if (normalized !== projectMdFile) {
                      setProjectMdFile(normalized);
                      if (mdPreviewError) setMdPreviewError(null);
                    }
                  }}
                  placeholder="https://raw.githubusercontent.com/.../README.md or GitHub blob URL"
                  style={{
                    width: '100%',
                    padding: '10px 14px',
                    backgroundColor: 'var(--color-paper)',
                    border: fieldErrors.projectMdFile ? '1px solid #ef4444' : '1px solid var(--color-border)',
                    borderRadius: 'var(--radius-md)',
                    fontSize: 'var(--text-sm)',
                    fontFamily: 'monospace',
                    color: 'var(--color-ink-primary)',
                    outline: 'none',
                  }}
                />
                {fieldErrors.projectMdFile && (
                  <div style={{ marginTop: '6px', color: '#dc2626', fontSize: 'var(--text-xs)', display: 'flex', alignItems: 'center', gap: '5px' }}>
                    <AlertCircle size={13} />
                    <span>{fieldErrors.projectMdFile}</span>
                  </div>
                )}
                <span style={{ display: 'block', fontSize: '10.5px', color: 'var(--color-ink-tertiary)', marginTop: '4px' }}>
                  GitHub links (e.g. <code>github.com/.../blob/.../readme.md</code>) are automatically converted to raw content links.
                </span>

                {mdPreviewError && (
                  <div style={{ marginTop: 'var(--space-2)', color: '#dc2626', fontSize: 'var(--text-xs)', display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <AlertCircle size={14} />
                    <span>{mdPreviewError}</span>
                  </div>
                )}

                {showMdPreview && mdPreviewContent && (
                  <div
                    style={{
                      marginTop: 'var(--space-4)',
                      padding: 'var(--space-4)',
                      backgroundColor: 'var(--color-paper)',
                      borderRadius: 'var(--radius-md)',
                      border: '1px solid var(--color-border)',
                      maxHeight: '320px',
                      overflowY: 'auto',
                    }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 'var(--space-2)' }}>
                      <span style={{ fontSize: '11px', fontWeight: 700, color: 'var(--color-ink-secondary)' }}>Markdown Preview</span>
                      <button
                        type="button"
                        onClick={() => setShowMdPreview(false)}
                        className="btn btn--ghost btn--sm"
                        style={{ fontSize: '10px', padding: '2px 6px' }}
                      >
                        Hide
                      </button>
                    </div>
                    <div
                      className="k10-markdown-body"
                      dangerouslySetInnerHTML={{ __html: marked.parse(mdPreviewContent) as string }}
                    />
                  </div>
                )}
              </div>
            </div>

            {/* ── Section 3: Firmware Builds ─────────────────────────────── */}
            <div
              style={{
                backgroundColor: 'var(--color-surface)',
                border: '1px solid var(--color-border)',
                borderRadius: 'var(--radius-xl)',
                padding: 'var(--space-8)',
                boxShadow: 'var(--shadow-sm)',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 'var(--space-3)', marginBottom: 'var(--space-4)' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <span
                    style={{
                      width: 24,
                      height: 24,
                      borderRadius: 'var(--radius-full)',
                      backgroundColor: 'var(--color-accent)',
                      color: '#fff',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      fontSize: '12px',
                      fontWeight: 700,
                    }}
                  >
                    3
                  </span>
                  <h2 style={{ fontSize: 'var(--text-lg)', fontWeight: 700, margin: 0, color: 'var(--color-ink-primary)' }}>
                    Firmware Builds
                  </h2>
                </div>

                <button
                  type="button"
                  onClick={handleAddFirmware}
                  className="btn btn--secondary btn--sm"
                  style={{ display: 'inline-flex', alignItems: 'center', gap: '0.4rem', fontSize: 'var(--text-xs)' }}
                >
                  <Plus size={13} /> Add Version
                </button>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}>
                {firmwares.map((fw, idx) => (
                  <div
                    key={idx}
                    style={{
                      padding: 'var(--space-4)',
                      backgroundColor: 'var(--color-paper)',
                      borderRadius: 'var(--radius-lg)',
                      border: '1px solid var(--color-border)',
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 'var(--space-3)' }}>
                      <span style={{ fontSize: 'var(--text-xs)', fontWeight: 700, color: 'var(--color-ink-secondary)' }}>
                        Build #{idx + 1}
                      </span>
                      {firmwares.length > 1 && (
                        <button
                          type="button"
                          onClick={() => handleRemoveFirmware(idx)}
                          className="btn btn--ghost btn--sm"
                          style={{ color: '#dc2626', padding: '2px 6px' }}
                          title="Remove build"
                        >
                          <Trash2 size={14} />
                        </button>
                      )}
                    </div>

                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: 'var(--space-3)', marginBottom: 'var(--space-3)' }}>
                      <div>
                        <label style={{ display: 'block', fontSize: '11px', fontWeight: 600, color: 'var(--color-ink-tertiary)', marginBottom: '4px' }}>
                          Version <span style={{ color: '#ef4444' }}>*</span>
                        </label>
                        <input
                          id={`input-fw_${idx}_version`}
                          type="text"
                          value={fw.version}
                          onChange={(e) => {
                            handleFirmwareChange(idx, 'version', e.target.value);
                            if (fieldErrors[`fw_${idx}_version`]) {
                              setFieldErrors((prev) => {
                                const next = { ...prev };
                                delete next[`fw_${idx}_version`];
                                return next;
                              });
                            }
                          }}
                          placeholder="v1.0.0"
                          style={{
                            width: '100%',
                            padding: '8px 10px',
                            backgroundColor: 'var(--color-surface)',
                            border: fieldErrors[`fw_${idx}_version`] ? '1px solid #ef4444' : '1px solid var(--color-border)',
                            borderRadius: 'var(--radius-md)',
                            fontSize: 'var(--text-xs)',
                            fontFamily: 'monospace',
                            color: 'var(--color-ink-primary)',
                            outline: 'none',
                          }}
                        />
                        {fieldErrors[`fw_${idx}_version`] && (
                          <span style={{ display: 'block', color: '#dc2626', fontSize: '10px', marginTop: '3px' }}>
                            {fieldErrors[`fw_${idx}_version`]}
                          </span>
                        )}
                      </div>
                      <div>
                        <label style={{ display: 'block', fontSize: '11px', fontWeight: 600, color: 'var(--color-ink-tertiary)', marginBottom: '4px' }}>
                          Edition / Name
                        </label>
                        <input
                          type="text"
                          value={fw.name}
                          onChange={(e) => handleFirmwareChange(idx, 'name', e.target.value)}
                          placeholder="Default Release Build"
                          style={{
                            width: '100%',
                            padding: '8px 10px',
                            backgroundColor: 'var(--color-surface)',
                            border: '1px solid var(--color-border)',
                            borderRadius: 'var(--radius-md)',
                            fontSize: 'var(--text-xs)',
                            color: 'var(--color-ink-primary)',
                            outline: 'none',
                          }}
                        />
                      </div>
                      <div>
                        <label style={{ display: 'block', fontSize: '11px', fontWeight: 600, color: 'var(--color-ink-tertiary)', marginBottom: '4px' }}>
                          Flash Address <span style={{ color: '#ef4444' }}>*</span>
                        </label>
                        <input
                          id={`input-fw_${idx}_address`}
                          type="text"
                          value={fw.flashAddress || ''}
                          onChange={(e) => {
                            handleFirmwareChange(idx, 'flashAddress', e.target.value);
                            if (fieldErrors[`fw_${idx}_address`]) {
                              setFieldErrors((prev) => {
                                const next = { ...prev };
                                delete next[`fw_${idx}_address`];
                                return next;
                              });
                            }
                          }}
                          placeholder="0x0000"
                          style={{
                            width: '100%',
                            padding: '8px 10px',
                            backgroundColor: 'var(--color-surface)',
                            border: fieldErrors[`fw_${idx}_address`] ? '1px solid #ef4444' : '1px solid var(--color-border)',
                            borderRadius: 'var(--radius-md)',
                            fontSize: 'var(--text-xs)',
                            fontFamily: 'monospace',
                            color: 'var(--color-ink-primary)',
                            outline: 'none',
                          }}
                        />
                        {fieldErrors[`fw_${idx}_address`] && (
                          <span style={{ display: 'block', color: '#dc2626', fontSize: '10px', marginTop: '3px' }}>
                            {fieldErrors[`fw_${idx}_address`]}
                          </span>
                        )}
                      </div>
                    </div>

                    <div style={{ marginBottom: 'var(--space-3)' }}>
                      <label style={{ display: 'block', fontSize: '11px', fontWeight: 600, color: 'var(--color-ink-tertiary)', marginBottom: '4px' }}>
                        Firmware Binary URL (.bin) <span style={{ color: '#ef4444' }}>*</span>
                      </label>
                      <input
                        id={`input-fw_${idx}_url`}
                        type="url"
                        value={fw.firmwareUrl}
                        onChange={(e) => {
                          handleFirmwareChange(idx, 'firmwareUrl', e.target.value);
                          if (fieldErrors[`fw_${idx}_url`]) {
                            setFieldErrors((prev) => {
                              const next = { ...prev };
                              delete next[`fw_${idx}_url`];
                              return next;
                            });
                          }
                        }}
                        onBlur={(e) => {
                          const converted = convertGithubBlobToRaw(e.target.value);
                          if (converted !== e.target.value) {
                            handleFirmwareChange(idx, 'firmwareUrl', converted);
                          }
                        }}
                        placeholder="https://.../firmware.bin or https://github.com/.../blob/..."
                        style={{
                          width: '100%',
                          padding: '8px 10px',
                          backgroundColor: 'var(--color-surface)',
                          border: fieldErrors[`fw_${idx}_url`] ? '1px solid #ef4444' : '1px solid var(--color-border)',
                          borderRadius: 'var(--radius-md)',
                          fontSize: 'var(--text-xs)',
                          fontFamily: 'monospace',
                          color: 'var(--color-ink-primary)',
                          outline: 'none',
                        }}
                      />
                      {fieldErrors[`fw_${idx}_url`] && (
                        <span style={{ display: 'block', color: '#dc2626', fontSize: '10px', marginTop: '3px' }}>
                          {fieldErrors[`fw_${idx}_url`]}
                        </span>
                      )}
                      <span style={{ display: 'block', fontSize: '10px', color: 'var(--color-ink-tertiary)', marginTop: '4px' }}>
                        GitHub links (e.g. <code>github.com/.../blob/...</code>) are automatically converted to raw download links.
                      </span>
                    </div>

                    <div>
                      <label style={{ display: 'block', fontSize: '11px', fontWeight: 600, color: 'var(--color-ink-tertiary)', marginBottom: '4px' }}>
                        Release Note / Description
                      </label>
                      <input
                        type="text"
                        value={fw.versionNote || ''}
                        onChange={(e) => handleFirmwareChange(idx, 'versionNote', e.target.value)}
                        placeholder="Release notes for this build..."
                        style={{
                          width: '100%',
                          padding: '8px 10px',
                          backgroundColor: 'var(--color-surface)',
                          border: '1px solid var(--color-border)',
                          borderRadius: 'var(--radius-md)',
                          fontSize: 'var(--text-xs)',
                          color: 'var(--color-ink-primary)',
                          outline: 'none',
                        }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* ── Section 4: Files & Attachments ───────────────────────────── */}
            <div
              style={{
                backgroundColor: 'var(--color-surface)',
                border: '1px solid var(--color-border)',
                borderRadius: 'var(--radius-xl)',
                padding: 'var(--space-8)',
                boxShadow: 'var(--shadow-sm)',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 'var(--space-3)', marginBottom: 'var(--space-2)' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <span
                    style={{
                      width: 24,
                      height: 24,
                      borderRadius: 'var(--radius-full)',
                      backgroundColor: 'var(--color-accent)',
                      color: '#fff',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      fontSize: '12px',
                      fontWeight: 700,
                    }}
                  >
                    4
                  </span>
                  <h2 style={{ fontSize: 'var(--text-lg)', fontWeight: 700, margin: 0, color: 'var(--color-ink-primary)' }}>
                    Files & Attachments
                  </h2>
                </div>

                <button
                  type="button"
                  onClick={handleAddAttachment}
                  className="btn btn--secondary btn--sm"
                  style={{ display: 'inline-flex', alignItems: 'center', gap: '0.4rem', fontSize: 'var(--text-xs)' }}
                >
                  <Plus size={13} /> Add File
                </button>
              </div>

              <p style={{ fontSize: 'var(--text-xs)', color: 'var(--color-ink-secondary)', margin: '0 0 var(--space-4) 0' }}>
                Attach downloadable resources for makers — such as 3D printing models (.stl, .step), circuit schematics (.pdf), code archives (.zip), or datasets.
              </p>

              {attachments.length === 0 ? (
                <div
                  style={{
                    padding: 'var(--space-6)',
                    backgroundColor: 'var(--color-paper)',
                    borderRadius: 'var(--radius-lg)',
                    border: '1px dashed var(--color-border)',
                    textAlign: 'center',
                  }}
                >
                  <Paperclip size={24} style={{ color: 'var(--color-ink-tertiary)', margin: '0 auto 8px auto', display: 'block' }} />
                  <p style={{ margin: '0 0 8px 0', fontSize: 'var(--text-xs)', color: 'var(--color-ink-secondary)' }}>
                    No files or attachments added yet.
                  </p>
                  <button
                    type="button"
                    onClick={handleAddAttachment}
                    className="btn btn--secondary btn--sm"
                    style={{ fontSize: 'var(--text-xs)' }}
                  >
                    <Plus size={13} /> Add Attachment
                  </button>
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}>
                  {attachments.map((att, idx) => (
                    <div
                      key={idx}
                      style={{
                        padding: 'var(--space-4)',
                        backgroundColor: 'var(--color-paper)',
                        borderRadius: 'var(--radius-lg)',
                        border: '1px solid var(--color-border)',
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 'var(--space-3)' }}>
                        <span style={{ fontSize: 'var(--text-xs)', fontWeight: 700, color: 'var(--color-ink-secondary)', display: 'flex', alignItems: 'center', gap: '6px' }}>
                          <Paperclip size={13} /> Attachment #{idx + 1}
                        </span>
                        <button
                          type="button"
                          onClick={() => handleRemoveAttachment(idx)}
                          className="btn btn--ghost btn--sm"
                          style={{ color: '#dc2626', padding: '2px 6px' }}
                          title="Remove attachment"
                        >
                          <Trash2 size={14} />
                        </button>
                      </div>

                      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 'var(--space-3)' }}>
                        {/* File Name / Label */}
                        <div>
                          <label style={{ display: 'block', fontSize: '11px', fontWeight: 600, color: 'var(--color-ink-tertiary)', marginBottom: '4px' }}>
                            File Label / Name
                          </label>
                          <input
                            type="text"
                            placeholder="e.g. UNIHIKER_K10_Stand.stl or Schematic Diagram PDF"
                            value={att.name}
                            onChange={(e) => {
                              handleAttachmentChange(idx, 'name', e.target.value);
                              if (fieldErrors[`att_${idx}_name`]) {
                                setFieldErrors((prev) => {
                                  const next = { ...prev };
                                  delete next[`att_${idx}_name`];
                                  return next;
                                });
                              }
                            }}
                            style={{
                              width: '100%',
                              padding: '8px 10px',
                              backgroundColor: 'var(--color-surface)',
                              border: fieldErrors[`att_${idx}_name`] ? '1px solid #ef4444' : '1px solid var(--color-border)',
                              borderRadius: 'var(--radius-md)',
                              fontSize: 'var(--text-xs)',
                              color: 'var(--color-ink-primary)',
                              outline: 'none',
                            }}
                          />
                          {fieldErrors[`att_${idx}_name`] && (
                            <span style={{ display: 'block', color: '#ef4444', fontSize: '10px', marginTop: '3px' }}>
                              {fieldErrors[`att_${idx}_name`]}
                            </span>
                          )}
                        </div>

                        {/* File Download URL */}
                        <div>
                          <label style={{ display: 'block', fontSize: '11px', fontWeight: 600, color: 'var(--color-ink-tertiary)', marginBottom: '4px' }}>
                            File URL <span style={{ color: '#ef4444' }}>*</span>
                          </label>
                          <input
                            id={`input-att_${idx}_url`}
                            type="url"
                            placeholder="https://... (GitHub, Google Drive, direct link)"
                            value={att.fileUrl}
                            onChange={(e) => {
                              handleAttachmentChange(idx, 'fileUrl', e.target.value);
                              if (fieldErrors[`att_${idx}_url`]) {
                                setFieldErrors((prev) => {
                                  const next = { ...prev };
                                  delete next[`att_${idx}_url`];
                                  return next;
                                });
                              }
                            }}
                            style={{
                              width: '100%',
                              padding: '8px 10px',
                              backgroundColor: 'var(--color-surface)',
                              border: fieldErrors[`att_${idx}_url`] ? '1px solid #ef4444' : '1px solid var(--color-border)',
                              borderRadius: 'var(--radius-md)',
                              fontSize: 'var(--text-xs)',
                              fontFamily: 'monospace',
                              color: 'var(--color-ink-primary)',
                              outline: 'none',
                            }}
                          />
                          {fieldErrors[`att_${idx}_url`] && (
                            <span style={{ display: 'block', color: '#ef4444', fontSize: '10px', marginTop: '3px' }}>
                              {fieldErrors[`att_${idx}_url`]}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* ── Section 5: External Project URL & GitHub ───────────────── */}
            <div
              style={{
                backgroundColor: 'var(--color-surface)',
                border: '1px solid var(--color-border)',
                borderRadius: 'var(--radius-xl)',
                padding: 'var(--space-8)',
                boxShadow: 'var(--shadow-sm)',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: 'var(--space-4)' }}>
                <span
                  style={{
                    width: 24,
                    height: 24,
                    borderRadius: 'var(--radius-full)',
                    backgroundColor: 'var(--color-accent)',
                    color: '#fff',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: '12px',
                    fontWeight: 700,
                  }}
                >
                  5
                </span>
                <h2 style={{ fontSize: 'var(--text-lg)', fontWeight: 700, margin: 0, color: 'var(--color-ink-primary)' }}>
                  External Project URL & GitHub
                </h2>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 'var(--space-4)' }}>
                <div>
                  <label style={{ display: 'block', fontSize: 'var(--text-xs)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--color-ink-secondary)', marginBottom: '6px' }}>
                    External Project URL
                  </label>
                  <input
                    type="url"
                    value={docLink}
                    onChange={(e) => setDocLink(e.target.value)}
                    placeholder="https://hackster.io/... or project website"
                    style={{
                      width: '100%',
                      padding: '10px 14px',
                      backgroundColor: 'var(--color-paper)',
                      border: '1px solid var(--color-border)',
                      borderRadius: 'var(--radius-md)',
                      fontSize: 'var(--text-sm)',
                      color: 'var(--color-ink-primary)',
                      outline: 'none',
                    }}
                  />
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: 'var(--text-xs)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--color-ink-secondary)', marginBottom: '6px' }}>
                    GitHub Repository URL
                  </label>
                  <input
                    type="url"
                    value={githubLink}
                    onChange={(e) => setGithubLink(e.target.value)}
                    placeholder="https://github.com/..."
                    style={{
                      width: '100%',
                      padding: '10px 14px',
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
            </div>

            {/* ── Section 6: Category, Difficulty & Tags ─────────────────── */}
            <div
              style={{
                backgroundColor: 'var(--color-surface)',
                border: '1px solid var(--color-border)',
                borderRadius: 'var(--radius-xl)',
                padding: 'var(--space-8)',
                boxShadow: 'var(--shadow-sm)',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: 'var(--space-4)' }}>
                <span
                  style={{
                    width: 24,
                    height: 24,
                    borderRadius: 'var(--radius-full)',
                    backgroundColor: 'var(--color-accent)',
                    color: '#fff',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: '12px',
                    fontWeight: 700,
                  }}
                >
                  6
                </span>
                <h2 style={{ fontSize: 'var(--text-lg)', fontWeight: 700, margin: 0, color: 'var(--color-ink-primary)' }}>
                  Category & Classification
                </h2>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: 'var(--space-4)', marginBottom: 'var(--space-4)' }}>
                {/* Category Dropdown */}
                <div>
                  <label style={{ display: 'block', fontSize: 'var(--text-xs)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--color-ink-secondary)', marginBottom: '6px' }}>
                    Category <span style={{ color: '#dc2626' }}>*</span>
                  </label>
                  <select
                    value={type}
                    onChange={(e) => setType(e.target.value as 'Project' | 'Tutorial')}
                    style={{
                      width: '100%',
                      padding: '10px 14px',
                      backgroundColor: 'var(--color-paper)',
                      border: '1px solid var(--color-border)',
                      borderRadius: 'var(--radius-md)',
                      fontSize: 'var(--text-sm)',
                      fontWeight: 600,
                      color: 'var(--color-ink-primary)',
                      outline: 'none',
                      cursor: 'pointer',
                    }}
                  >
                    <option value="Project">Project</option>
                    <option value="Tutorial">Tutorial</option>
                  </select>
                </div>

                {/* Difficulty Level Dropdown */}
                <div>
                  <label style={{ display: 'block', fontSize: 'var(--text-xs)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--color-ink-secondary)', marginBottom: '6px' }}>
                    Difficulty Level
                  </label>
                  <select
                    value={level}
                    onChange={(e) => setLevel(Number(e.target.value))}
                    style={{
                      width: '100%',
                      padding: '10px 14px',
                      backgroundColor: 'var(--color-paper)',
                      border: '1px solid var(--color-border)',
                      borderRadius: 'var(--radius-md)',
                      fontSize: 'var(--text-sm)',
                      fontWeight: 600,
                      color: 'var(--color-ink-primary)',
                      outline: 'none',
                      cursor: 'pointer',
                    }}
                  >
                    <option value={1}>Beginner</option>
                    <option value={2}>Intermediate</option>
                    <option value={3}>Advanced</option>
                    <option value={4}>Expert</option>
                  </select>
                </div>
              </div>

              {/* Multi-Select Topics */}
              <div style={{ marginBottom: 'var(--space-6)' }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
                  <label style={{ display: 'block', fontSize: 'var(--text-xs)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--color-ink-secondary)', margin: 0 }}>
                    Topics (Select all that apply)
                  </label>
                  {selectedTopics.length > 0 && (
                    <span style={{ fontSize: '11.5px', fontWeight: 600, color: 'var(--color-accent)', backgroundColor: 'var(--color-accent-muted)', padding: '2px 10px', borderRadius: 'var(--radius-full)', border: '1px solid var(--color-accent-light)' }}>
                      {selectedTopics.length} selected
                    </span>
                  )}
                </div>
                <p style={{ fontSize: '12px', color: 'var(--color-ink-tertiary)', margin: '0 0 12px 0', lineHeight: 1.4 }}>
                  Select the topics that describe your {type.toLowerCase()}. These topics appear in the gallery filters for quick discovery.
                </p>

                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
                  {AVAILABLE_TOPICS.map((topic) => {
                    const isSelected = selectedTopics.includes(topic);
                    return (
                      <button
                        key={topic}
                        type="button"
                        onClick={() => toggleTopic(topic)}
                        style={{
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '6px',
                          padding: '7px 14px',
                          borderRadius: '8px',
                          fontSize: '13px',
                          fontWeight: isSelected ? 600 : 500,
                          backgroundColor: isSelected ? 'var(--color-accent-muted)' : 'var(--color-paper)',
                          border: isSelected ? '1.5px solid var(--color-accent)' : '1px solid var(--color-border)',
                          color: isSelected ? 'var(--color-accent)' : 'var(--color-ink-primary)',
                          cursor: 'pointer',
                          transition: 'all 0.15s ease',
                          boxShadow: isSelected ? '0 1px 3px rgba(29, 78, 216, 0.12)' : 'none',
                        }}
                      >
                        {isSelected ? (
                          <Check size={14} style={{ color: 'var(--color-accent)', strokeWidth: 2.5 }} />
                        ) : (
                          <Plus size={13} style={{ color: 'var(--color-ink-tertiary)' }} />
                        )}
                        <span>{topic}</span>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Additional Custom Tags */}
              <div>
                <label style={{ display: 'block', fontSize: 'var(--text-xs)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--color-ink-secondary)', marginBottom: '6px' }}>
                  Additional Custom Tags (Optional)
                </label>
                <input
                  type="text"
                  value={customTagsInput}
                  onChange={(e) => setCustomTagsInput(e.target.value)}
                  placeholder="e.g. UNIHIKER K10, GC2145, DVP Camera (comma-separated)"
                  style={{
                    width: '100%',
                    padding: '10px 14px',
                    backgroundColor: 'var(--color-paper)',
                    border: '1px solid var(--color-border)',
                    borderRadius: 'var(--radius-md)',
                    fontSize: 'var(--text-sm)',
                    color: 'var(--color-ink-primary)',
                    outline: 'none',
                  }}
                />
                <div style={{ fontSize: '11px', color: 'var(--color-ink-tertiary)', marginTop: '4px' }}>
                  Add any specific chip models, protocols, or custom keywords separated by commas
                </div>
              </div>
            </div>

            {/* Bottom Error Alert (visible if validation fails) */}
            {formError && (
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 'var(--space-3)',
                  padding: '12px 16px',
                  backgroundColor: 'rgba(239, 68, 68, 0.1)',
                  border: '1px solid rgba(239, 68, 68, 0.25)',
                  borderRadius: 'var(--radius-lg)',
                  color: '#dc2626',
                  fontSize: 'var(--text-sm)',
                  fontWeight: 500,
                }}
              >
                <AlertCircle size={18} style={{ flexShrink: 0 }} />
                <span>{formError}</span>
              </div>
            )}

            {/* Bottom Save / Cancel Action Bar */}
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                flexWrap: 'wrap',
                gap: 'var(--space-4)',
                padding: 'var(--space-6)',
                backgroundColor: 'var(--color-surface)',
                border: '1px solid var(--color-border)',
                borderRadius: 'var(--radius-xl)',
                boxShadow: 'var(--shadow-sm)',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)' }}>
                <span style={{ fontSize: 'var(--text-xs)', color: 'var(--color-ink-tertiary)' }}>
                  {role === 'admin' ? 'Publish directly to public catalog' : 'Submits for Admin verification'}
                </span>
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-3)' }}>
                <button
                  type="button"
                  onClick={() => navigate('/dashboard')}
                  className="btn btn--secondary"
                >
                  Cancel
                </button>

                {!isEditing && (
                  <button
                    type="button"
                    onClick={() => handleSave('draft')}
                    disabled={isSaving}
                    className="btn btn--secondary"
                    style={{ display: 'inline-flex', alignItems: 'center', gap: '0.5rem' }}
                  >
                    <Save size={16} /> Save Draft
                  </button>
                )}

                <button
                  type="button"
                  onClick={() =>
                    handleSave(
                      isEditing
                        ? (existingProject?.status === 'published' || role === 'admin' ? 'published' : 'pending_approval')
                        : role === 'admin'
                        ? 'published'
                        : 'pending_approval'
                    )
                  }
                  disabled={isSaving}
                  className="btn btn--primary"
                  style={{ display: 'inline-flex', alignItems: 'center', gap: '0.5rem' }}
                >
                  {isSaving ? (
                    <Loader2 size={16} className="animate-spin" />
                  ) : isEditing ? (
                    <CheckCircle2 size={16} />
                  ) : role === 'admin' ? (
                    <Sparkles size={16} />
                  ) : (
                    <Send size={16} />
                  )}
                  {isSaving
                    ? 'Saving...'
                    : isEditing
                    ? 'Update'
                    : role === 'admin'
                    ? 'Publish'
                    : 'Submit for Review'}
                </button>
              </div>
            </div>

          </form>

        </div>
      </main>

      <Footer />
    </div>
  );
}
