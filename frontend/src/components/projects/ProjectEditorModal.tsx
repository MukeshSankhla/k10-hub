import { useState, useEffect, useRef } from 'react';
import {
  X,
  Cpu,
  BookOpen,
  Image as ImageIcon,
  Video,
  Github,
  ExternalLink,
  Plus,
  Trash2,
  Eye,
  Edit3,
  Bold,
  Italic,
  Code,
  List,
  ListOrdered,
  Link2,
  Table as TableIcon,
  AlertCircle,
  CheckCircle2,
  Check,
} from 'lucide-react';
import { ProjectDetail, FirmwareConfig, AVAILABLE_TOPICS } from '../../config/projectsData';
import { saveProject, parseVideoEmbedUrl, formatCurrentPublishDate } from '../../services/projects/projectStorageService';
import { isKnownAdmin } from '../common/UserBadge';

interface ProjectEditorModalProps {
  isOpen: boolean;
  onClose: () => void;
  initialProject?: ProjectDetail | null;
  initialData?: ProjectDetail | null;
  defaultType?: 'Project' | 'Tutorial';
  onSaved?: (savedProject: ProjectDetail) => void;
  onSave?: (savedProject: ProjectDetail) => void;
}

export default function ProjectEditorModal({
  isOpen,
  onClose,
  initialProject,
  initialData,
  defaultType = 'Project',
  onSaved,
  onSave,
}: ProjectEditorModalProps) {
  const activeInitial = initialProject || initialData;
  const [title, setTitle] = useState('');
  const [id, setId] = useState('');
  const [idTouched, setIdTouched] = useState(false);
  const [type, setType] = useState<'Project' | 'Tutorial'>(defaultType);
  const [level, setLevel] = useState<number>(2);
  const [description, setDescription] = useState('');
  const [coverImage, setCoverImage] = useState('');
  const [videoLink, setVideoLink] = useState('');
  const [githubLink, setGithubLink] = useState('');
  const [docLink, setDocLink] = useState('');
  const [author, setAuthor] = useState('Mukesh Sankhla');
  const [authorRole, setAuthorRole] = useState('Hardware Author');
  const [authorAvatar, setAuthorAvatar] = useState('https://avatars.githubusercontent.com/u/10103138?v=4');
  const [license, setLicense] = useState('MIT');
  const [selectedTopics, setSelectedTopics] = useState<string[]>([]);
  const [customTagsInput, setCustomTagsInput] = useState('UNIHIKER K10');
  const [markdownContent, setMarkdownContent] = useState('');
  const [editorTab, setEditorTab] = useState<'write' | 'preview'>('write');
  const [firmwares, setFirmwares] = useState<FirmwareConfig[]>([
    {
      version: 'v1.0.0',
      name: 'Default Release Edition',
      releaseDate: formatCurrentPublishDate(),
      firmwareUrl: '',
      flashAddress: '0x00',
      versionNote: '',
    },
  ]);

  const [errorMessage, setErrorMessage] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const markdownTextareaRef = useRef<HTMLTextAreaElement>(null);

  // Initialize or reset form when modal opens
  useEffect(() => {
    if (isOpen) {
      if (activeInitial) {
        setTitle(activeInitial.title || '');
        setId(activeInitial.id || '');
        setIdTouched(true);
        setType((activeInitial.type as 'Project' | 'Tutorial') || defaultType);
        setLevel(activeInitial.level || 2);
        setDescription(activeInitial.description || '');
        setCoverImage(activeInitial.coverImage || '');
        setVideoLink(activeInitial.videoLink || '');
        setGithubLink(activeInitial.githubLink || '');
        setDocLink(activeInitial.docLink || '');
        setAuthor(activeInitial.author || 'Mukesh Sankhla');
        setAuthorRole(activeInitial.authorRole || 'Hardware Author');
        setAuthorAvatar(activeInitial.authorAvatar || 'https://avatars.githubusercontent.com/u/10103138?v=4');
        setLicense(activeInitial.license || 'MIT');
        if (activeInitial.tags && Array.isArray(activeInitial.tags)) {
          const matched = activeInitial.tags.filter((t) => AVAILABLE_TOPICS.includes(t as any));
          const other = activeInitial.tags.filter((t) => !AVAILABLE_TOPICS.includes(t as any));
          setSelectedTopics(matched);
          setCustomTagsInput(other.join(', '));
        } else {
          setSelectedTopics([]);
          setCustomTagsInput('');
        }
        setMarkdownContent(activeInitial.markdownContent || '');
        setFirmwares(
          activeInitial.firmwares && activeInitial.firmwares.length > 0
            ? activeInitial.firmwares
            : [
                {
                  version: 'v1.0.0',
                  name: 'Initial Release',
                  releaseDate: activeInitial.publishDate || '2026',
                  firmwareUrl: '',
                  flashAddress: '0x00',
                  versionNote: 'Release edition.',
                },
              ]
        );
      } else {
        // New project default values
        setTitle('');
        setId('');
        setIdTouched(false);
        setType(defaultType);
        setLevel(2);
        setDescription('');
        setCoverImage('https://raw.githubusercontent.com/MukeshSankhla/ESP32_P4_DSI/main/images/DIY.gif');
        setVideoLink('');
        setGithubLink('');
        setDocLink('');
        setAuthor('Mukesh Sankhla');
        setAuthorRole('Hardware Author');
        setAuthorAvatar('https://avatars.githubusercontent.com/u/10103138?v=4');
        setLicense('MIT');
        setSelectedTopics([]);
        setCustomTagsInput('UNIHIKER K10');
        setMarkdownContent(`# Project Overview\n\nDetailed walkthrough and technical guide for this hardware project.\n\n## Features\n- Direct 1-click Web Serial flashing\n- Comprehensive pinout and sensor mapping\n\n## Hardware Setup\nConnect your UNIHIKER K10 board via USB-C to begin flashing.`);
        setFirmwares([
          {
            version: 'v1.0.0',
            name: 'Initial Release',
            releaseDate: formatCurrentPublishDate(),
            firmwareUrl: '',
            flashAddress: '0x00',
            versionNote: 'Standard firmware binary.',
          },
        ]);
      }
      setErrorMessage('');
      setEditorTab('write');
    }
  }, [isOpen, initialProject, defaultType]);

  // Auto-slugify ID when title changes (if user hasn't manually edited ID)
  const handleTitleChange = (val: string) => {
    setTitle(val);
    if (!idTouched) {
      const slug = val
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/(^-|-$)/g, '');
      setId(slug);
    }
  };

  // Markdown toolbar action helper
  const insertMarkdownSyntax = (prefix: string, suffix = '', defaultText = '') => {
    const textarea = markdownTextareaRef.current;
    if (!textarea) return;

    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    const selectedText = markdownContent.substring(start, end) || defaultText;
    const replacement = `${prefix}${selectedText}${suffix}`;

    const newContent =
      markdownContent.substring(0, start) + replacement + markdownContent.substring(end);
    setMarkdownContent(newContent);

    setTimeout(() => {
      textarea.focus();
      textarea.setSelectionRange(
        start + prefix.length,
        start + prefix.length + selectedText.length
      );
    }, 10);
  };

  // Firmware handlers
  const handleAddFirmware = () => {
    setFirmwares([
      ...firmwares,
      {
        version: `v1.${firmwares.length}.0`,
        name: `Firmware Edition ${firmwares.length + 1}`,
        releaseDate: formatCurrentPublishDate(),
        firmwareUrl: '',
        flashAddress: '0x00',
        versionNote: 'New release edition.',
      },
    ]);
  };

  const handleUpdateFirmware = (index: number, field: keyof FirmwareConfig, value: string) => {
    const updated = [...firmwares];
    updated[index] = {
      ...updated[index],
      [field]: value,
    };
    setFirmwares(updated);
  };

  const handleRemoveFirmware = (index: number) => {
    if (firmwares.length <= 1) return;
    setFirmwares(firmwares.filter((_, i) => i !== index));
  };

  // Toggle topic selection
  const toggleTopic = (topic: string) => {
    setSelectedTopics((prev) =>
      prev.includes(topic) ? prev.filter((t) => t !== topic) : [...prev, topic]
    );
  };

  // Form submit
  const handleSave = () => {
    if (!title.trim()) {
      setErrorMessage('Please enter a project title.');
      return;
    }

    const cleanId = (id || title)
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/(^-|-$)/g, '');

    if (!cleanId) {
      setErrorMessage('Please provide a valid project ID / slug.');
      return;
    }

    if (!description.trim()) {
      setErrorMessage('Please provide a brief description.');
      return;
    }

    setIsSaving(true);
    setErrorMessage('');

    try {
      const parsedCustomTags = customTagsInput
        .split(',')
        .map((t) => t.trim())
        .filter(Boolean);
      const combinedTags = Array.from(new Set([...selectedTopics, ...parsedCustomTags]));

      const projectToSave: ProjectDetail = {
        id: cleanId,
        title: title.trim(),
        type,
        level,
        author: author.trim() || 'Mukesh Sankhla',
        authorRole: isKnownAdmin({ name: author, role: authorRole }) ? 'admin' : (authorRole.trim() || 'Author'),
        authorAvatar: authorAvatar.trim() || undefined,
        publishDate: activeInitial?.publishDate || formatCurrentPublishDate(),
        flashCount: activeInitial?.flashCount || 0,
        description: description.trim(),
        coverImage: coverImage.trim() || 'https://raw.githubusercontent.com/MukeshSankhla/ESP32_P4_DSI/main/images/DIY.gif',
        videoLink: videoLink.trim() || undefined,
        githubLink: githubLink.trim() || undefined,
        docLink: docLink.trim() || undefined,
        license: license.trim() || 'MIT',
        tags: combinedTags.length > 0 ? combinedTags : ['UNIHIKER K10'],
        projectMdFile: activeInitial?.projectMdFile || null,
        markdownContent: markdownContent.trim() || `# ${title}\n\n${description}`,
        firmwares: firmwares.filter((f) => f.name.trim() || f.version.trim()),
      };

      const saved = saveProject(projectToSave);
      setIsSaving(false);

      if (onSaved) {
        onSaved(saved);
      }
      if (onSave) {
        onSave(saved);
      }
      onClose();
    } catch (err: any) {
      setIsSaving(false);
      setErrorMessage(err.message || 'Failed to save project.');
    }
  };

  if (!isOpen) return null;

  const parsedVideo = parseVideoEmbedUrl(videoLink);

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 9999,
        backgroundColor: 'rgba(15, 23, 42, 0.65)',
        backdropFilter: 'blur(8px)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 'var(--space-4)',
        animation: 'fadeIn 0.2s ease-out',
      }}
    >
      <div
        style={{
          backgroundColor: 'var(--color-surface)',
          border: '1px solid var(--color-border)',
          borderRadius: '16px',
          width: '100%',
          maxWidth: 960,
          maxHeight: '90vh',
          display: 'flex',
          flexDirection: 'column',
          boxShadow: '0 20px 40px -10px rgba(0, 0, 0, 0.25)',
          overflow: 'hidden',
        }}
      >
        {/* Modal Header */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: 'var(--space-5) var(--space-6)',
            borderBottom: '1px solid var(--color-border)',
            backgroundColor: 'var(--color-paper)',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-3)' }}>
            <div
              style={{
                width: 38,
                height: 38,
                borderRadius: '8px',
                backgroundColor: type === 'Tutorial' ? 'rgba(37, 99, 235, 0.1)' : 'rgba(230, 81, 0, 0.1)',
                color: type === 'Tutorial' ? 'rgb(37, 99, 235)' : 'var(--color-accent)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              {type === 'Tutorial' ? <BookOpen size={20} /> : <Cpu size={20} />}
            </div>
            <div>
              <h2 style={{ fontSize: 'var(--text-lg)', fontWeight: 700, margin: 0, color: 'var(--color-ink-primary)' }}>
                {initialProject ? `Edit ${type}` : `Create New ${type}`}
              </h2>
              <p style={{ fontSize: 'var(--text-xs)', color: 'var(--color-ink-secondary)', margin: 0 }}>
                Publish hardware guides, interactive tutorials, and browser-flashable binaries.
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            style={{
              padding: '6px',
              borderRadius: '6px',
              color: 'var(--color-ink-tertiary)',
              border: 'none',
              background: 'transparent',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <X size={20} />
          </button>
        </div>

        {/* Modal Body: Scrollable Form */}
        <div style={{ padding: 'var(--space-6)', overflowY: 'auto', flex: 1, display: 'flex', flexDirection: 'column', gap: 'var(--space-6)' }}>
          {errorMessage && (
            <div
              style={{
                padding: 'var(--space-3) var(--space-4)',
                backgroundColor: 'rgba(239, 68, 68, 0.1)',
                border: '1px solid rgba(239, 68, 68, 0.25)',
                borderRadius: '8px',
                color: '#b91c1c',
                fontSize: 'var(--text-xs)',
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
              }}
            >
              <AlertCircle size={16} />
              <span>{errorMessage}</span>
            </div>
          )}

          {/* Section 1: Classification & Type */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 'var(--space-4)' }}>
            {/* Type Selector Toggle */}
            <div>
              <label style={{ display: 'block', fontSize: 'var(--text-xs)', fontWeight: 700, marginBottom: '6px', color: 'var(--color-ink-primary)' }}>
                Content Type
              </label>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
                <button
                  type="button"
                  onClick={() => setType('Project')}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '6px',
                    padding: '8px 12px',
                    borderRadius: '8px',
                    fontSize: 'var(--text-xs)',
                    fontWeight: 700,
                    border: type === 'Project' ? '1px solid var(--color-accent)' : '1px solid var(--color-border)',
                    backgroundColor: type === 'Project' ? 'rgba(230, 81, 0, 0.1)' : 'var(--color-paper)',
                    color: type === 'Project' ? 'var(--color-accent)' : 'var(--color-ink-secondary)',
                    cursor: 'pointer',
                  }}
                >
                  <Cpu size={14} /> Project
                </button>
                <button
                  type="button"
                  onClick={() => setType('Tutorial')}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '6px',
                    padding: '8px 12px',
                    borderRadius: '8px',
                    fontSize: 'var(--text-xs)',
                    fontWeight: 700,
                    border: type === 'Tutorial' ? '1px solid rgb(37, 99, 235)' : '1px solid var(--color-border)',
                    backgroundColor: type === 'Tutorial' ? 'rgba(37, 99, 235, 0.1)' : 'var(--color-paper)',
                    color: type === 'Tutorial' ? 'rgb(37, 99, 235)' : 'var(--color-ink-secondary)',
                    cursor: 'pointer',
                  }}
                >
                  <BookOpen size={14} /> Tutorial
                </button>
              </div>
            </div>

            {/* Difficulty Level */}
            <div>
              <label style={{ display: 'block', fontSize: 'var(--text-xs)', fontWeight: 700, marginBottom: '6px', color: 'var(--color-ink-primary)' }}>
                Difficulty Level
              </label>
              <select
                value={level}
                onChange={(e) => setLevel(parseInt(e.target.value, 10))}
                style={{
                  width: '100%',
                  padding: '8px 12px',
                  borderRadius: '8px',
                  border: '1px solid var(--color-border)',
                  backgroundColor: 'var(--color-paper)',
                  fontSize: 'var(--text-xs)',
                  color: 'var(--color-ink-primary)',
                  outline: 'none',
                }}
              >
                <option value={1}>Beginner</option>
                <option value={2}>Intermediate</option>
                <option value={3}>Advance</option>
                <option value={4}>Expert</option>
              </select>
            </div>

            {/* License */}
            <div>
              <label style={{ display: 'block', fontSize: 'var(--text-xs)', fontWeight: 700, marginBottom: '6px', color: 'var(--color-ink-primary)' }}>
                Open-Source License
              </label>
              <select
                value={license}
                onChange={(e) => setLicense(e.target.value)}
                style={{
                  width: '100%',
                  padding: '8px 12px',
                  borderRadius: '8px',
                  border: '1px solid var(--color-border)',
                  backgroundColor: 'var(--color-paper)',
                  fontSize: 'var(--text-xs)',
                  color: 'var(--color-ink-primary)',
                  outline: 'none',
                }}
              >
                <option value="MIT">MIT License</option>
                <option value="Apache-2.0">Apache 2.0</option>
                <option value="GPL-3.0">GNU GPL v3</option>
                <option value="CC-BY-4.0">Creative Commons BY 4.0</option>
              </select>
            </div>
          </div>

          {/* Section 2: Title, ID & Description */}
          <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 2fr) minmax(0, 1fr)', gap: 'var(--space-4)' }}>
            <div>
              <label style={{ display: 'block', fontSize: 'var(--text-xs)', fontWeight: 700, marginBottom: '6px', color: 'var(--color-ink-primary)' }}>
                Title *
              </label>
              <input
                type="text"
                value={title}
                onChange={(e) => handleTitleChange(e.target.value)}
                placeholder="e.g. UNIHIKER K10 Sci-Fi HUD Display"
                style={{
                  width: '100%',
                  padding: '8px 12px',
                  borderRadius: '8px',
                  border: '1px solid var(--color-border)',
                  backgroundColor: 'var(--color-paper)',
                  fontSize: 'var(--text-sm)',
                  fontWeight: 600,
                  color: 'var(--color-ink-primary)',
                  outline: 'none',
                }}
              />
            </div>

            <div>
              <label style={{ display: 'block', fontSize: 'var(--text-xs)', fontWeight: 700, marginBottom: '6px', color: 'var(--color-ink-primary)' }}>
                ID / URL Slug *
              </label>
              <input
                type="text"
                value={id}
                onChange={(e) => {
                  setId(e.target.value);
                  setIdTouched(true);
                }}
                placeholder="k10-sci-fi-hud"
                style={{
                  width: '100%',
                  padding: '8px 12px',
                  borderRadius: '8px',
                  border: '1px solid var(--color-border)',
                  backgroundColor: 'var(--color-paper)',
                  fontSize: 'var(--text-xs)',
                  fontFamily: 'monospace',
                  color: 'var(--color-ink-secondary)',
                  outline: 'none',
                }}
              />
            </div>
          </div>

          {/* Short Description */}
          <div>
            <label style={{ display: 'block', fontSize: 'var(--text-xs)', fontWeight: 700, marginBottom: '6px', color: 'var(--color-ink-primary)' }}>
              Short Summary Description *
            </label>
            <textarea
              rows={2}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="A brief 1-2 sentence overview shown in project cards and the hero header..."
              style={{
                width: '100%',
                padding: '8px 12px',
                borderRadius: '8px',
                border: '1px solid var(--color-border)',
                backgroundColor: 'var(--color-paper)',
                fontSize: 'var(--text-xs)',
                lineHeight: 1.5,
                color: 'var(--color-ink-primary)',
                outline: 'none',
                resize: 'vertical',
              }}
            />
          </div>

          {/* Section 3: Media & Video Integration Link */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 'var(--space-4)' }}>
            {/* Cover Image URL */}
            <div>
              <label style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: 'var(--text-xs)', fontWeight: 700, marginBottom: '6px', color: 'var(--color-ink-primary)' }}>
                <ImageIcon size={14} /> Cover Image URL
              </label>
              <input
                type="text"
                value={coverImage}
                onChange={(e) => setCoverImage(e.target.value)}
                placeholder="https://example.com/cover.png or .gif"
                style={{
                  width: '100%',
                  padding: '8px 12px',
                  borderRadius: '8px',
                  border: '1px solid var(--color-border)',
                  backgroundColor: 'var(--color-paper)',
                  fontSize: 'var(--text-xs)',
                  color: 'var(--color-ink-primary)',
                  outline: 'none',
                }}
              />
              {coverImage && (
                <div style={{ marginTop: '8px', width: '100%', height: 100, borderRadius: '8px', overflow: 'hidden', backgroundColor: '#000' }}>
                  <img src={coverImage} alt="Cover preview" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                </div>
              )}
            </div>

            {/* Video Integration Link */}
            <div>
              <label style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: 'var(--text-xs)', fontWeight: 700, marginBottom: '6px', color: 'var(--color-ink-primary)' }}>
                <Video size={14} color="var(--color-accent)" /> Video Integration Link (YouTube / Vimeo / MP4)
              </label>
              <input
                type="text"
                value={videoLink}
                onChange={(e) => setVideoLink(e.target.value)}
                placeholder="e.g. https://www.youtube.com/watch?v=... or https://youtu.be/..."
                style={{
                  width: '100%',
                  padding: '8px 12px',
                  borderRadius: '8px',
                  border: '1px solid var(--color-border)',
                  backgroundColor: 'var(--color-paper)',
                  fontSize: 'var(--text-xs)',
                  color: 'var(--color-ink-primary)',
                  outline: 'none',
                }}
              />
              {parsedVideo && (
                <div style={{ marginTop: '8px', width: '100%', height: 100, borderRadius: '8px', overflow: 'hidden', border: '1px solid var(--color-border)' }}>
                  {parsedVideo.type === 'youtube' || parsedVideo.type === 'vimeo' ? (
                    <iframe
                      src={parsedVideo.embedUrl}
                      title="Video preview"
                      style={{ width: '100%', height: '100%', border: 'none' }}
                      allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                    />
                  ) : (
                    <video src={parsedVideo.embedUrl} controls style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                  )}
                </div>
              )}
            </div>
          </div>

          {/* Section 4: External Links & Tags */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 'var(--space-4)' }}>
            <div>
              <label style={{ display: 'flex', alignItems: 'center', gap: '5px', fontSize: 'var(--text-xs)', fontWeight: 700, marginBottom: '6px', color: 'var(--color-ink-primary)' }}>
                <Github size={13} /> GitHub Repository Link
              </label>
              <input
                type="text"
                value={githubLink}
                onChange={(e) => setGithubLink(e.target.value)}
                placeholder="https://github.com/user/repo"
                style={{
                  width: '100%',
                  padding: '8px 12px',
                  borderRadius: '8px',
                  border: '1px solid var(--color-border)',
                  backgroundColor: 'var(--color-paper)',
                  fontSize: 'var(--text-xs)',
                  color: 'var(--color-ink-primary)',
                  outline: 'none',
                }}
              />
            </div>

            <div>
              <label style={{ display: 'flex', alignItems: 'center', gap: '5px', fontSize: 'var(--text-xs)', fontWeight: 700, marginBottom: '6px', color: 'var(--color-ink-primary)' }}>
                <ExternalLink size={13} /> Project Guide / Wiki Link
              </label>
              <input
                type="text"
                value={docLink}
                onChange={(e) => setDocLink(e.target.value)}
                placeholder="https://hackster.io/... or wiki"
                style={{
                  width: '100%',
                  padding: '8px 12px',
                  borderRadius: '8px',
                  border: '1px solid var(--color-border)',
                  backgroundColor: 'var(--color-paper)',
                  fontSize: 'var(--text-xs)',
                  color: 'var(--color-ink-primary)',
                  outline: 'none',
                }}
              />
            </div>

            {/* Multi-Select Topics */}
            <div style={{ gridColumn: '1 / -1' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '6px' }}>
                <label style={{ display: 'block', fontSize: 'var(--text-xs)', fontWeight: 700, color: 'var(--color-ink-primary)', margin: 0 }}>
                  Topics (Select all that apply)
                </label>
                {selectedTopics.length > 0 && (
                  <span style={{ fontSize: '11px', fontWeight: 600, color: 'var(--color-accent)', backgroundColor: 'var(--color-accent-muted)', padding: '2px 8px', borderRadius: 'var(--radius-full)', border: '1px solid var(--color-accent-light)' }}>
                    {selectedTopics.length} selected
                  </span>
                )}
              </div>
              <p style={{ fontSize: '11.5px', color: 'var(--color-ink-tertiary)', margin: '0 0 8px 0' }}>
                Choose relevant topics for gallery filtering and discovery.
              </p>

              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', marginBottom: '12px' }}>
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
                        gap: '5px',
                        padding: '5px 11px',
                        borderRadius: '6px',
                        fontSize: '12px',
                        fontWeight: isSelected ? 600 : 500,
                        backgroundColor: isSelected ? 'var(--color-accent-muted)' : 'var(--color-paper)',
                        border: isSelected ? '1.5px solid var(--color-accent)' : '1px solid var(--color-border)',
                        color: isSelected ? 'var(--color-accent)' : 'var(--color-ink-primary)',
                        cursor: 'pointer',
                        transition: 'all 0.15s ease',
                      }}
                    >
                      {isSelected ? (
                        <Check size={13} style={{ color: 'var(--color-accent)', strokeWidth: 2.5 }} />
                      ) : (
                        <Plus size={12} style={{ color: 'var(--color-ink-tertiary)' }} />
                      )}
                      <span>{topic}</span>
                    </button>
                  );
                })}
              </div>

              {/* Additional Custom Tags */}
              <div>
                <label style={{ display: 'block', fontSize: 'var(--text-xs)', fontWeight: 700, marginBottom: '6px', color: 'var(--color-ink-secondary)' }}>
                  Additional Custom Tags (Optional)
                </label>
                <input
                  type="text"
                  value={customTagsInput}
                  onChange={(e) => setCustomTagsInput(e.target.value)}
                  placeholder="e.g. UNIHIKER K10, Sensors, AI Voice"
                  style={{
                    width: '100%',
                    padding: '8px 12px',
                    borderRadius: '8px',
                    border: '1px solid var(--color-border)',
                    backgroundColor: 'var(--color-paper)',
                    fontSize: 'var(--text-xs)',
                    color: 'var(--color-ink-primary)',
                    outline: 'none',
                  }}
                />
              </div>
            </div>
          </div>

          {/* Section 5: Firmware Binaries for Web Flashing */}
          <div
            style={{
              padding: 'var(--space-4)',
              backgroundColor: 'var(--color-paper)',
              borderRadius: '12px',
              border: '1px solid var(--color-border)',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 'var(--space-3)' }}>
              <div>
                <h4 style={{ fontSize: 'var(--text-xs)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--color-ink-primary)', margin: 0 }}>
                  1-Click Firmware Binaries (Web Serial)
                </h4>
                <p style={{ fontSize: '11px', color: 'var(--color-ink-secondary)', margin: '2px 0 0 0' }}>
                  Provide pre-compiled .bin URLs for instant browser flashing via Web Serial.
                </p>
              </div>

              <button
                type="button"
                onClick={handleAddFirmware}
                className="btn btn--secondary btn--sm"
                style={{ display: 'flex', alignItems: 'center', gap: '4px', borderRadius: '6px' }}
              >
                <Plus size={13} /> Add Version
              </button>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-3)' }}>
              {firmwares.map((fw, idx) => (
                <div
                  key={idx}
                  style={{
                    padding: 'var(--space-3)',
                    backgroundColor: 'var(--color-surface)',
                    borderRadius: '8px',
                    border: '1px solid var(--color-border)',
                    display: 'grid',
                    gridTemplateColumns: '100px 1fr 100px 1.5fr auto',
                    gap: '8px',
                    alignItems: 'center',
                  }}
                >
                  <input
                    type="text"
                    value={fw.version}
                    onChange={(e) => handleUpdateFirmware(idx, 'version', e.target.value)}
                    placeholder="v1.0.0"
                    style={{ padding: '6px 8px', borderRadius: '6px', border: '1px solid var(--color-border)', fontSize: '11px', fontWeight: 600 }}
                  />
                  <input
                    type="text"
                    value={fw.name}
                    onChange={(e) => handleUpdateFirmware(idx, 'name', e.target.value)}
                    placeholder="Edition Name"
                    style={{ padding: '6px 8px', borderRadius: '6px', border: '1px solid var(--color-border)', fontSize: '11px' }}
                  />
                  <input
                    type="text"
                    value={fw.flashAddress || '0x00'}
                    onChange={(e) => handleUpdateFirmware(idx, 'flashAddress', e.target.value)}
                    placeholder="0x00"
                    style={{ padding: '6px 8px', borderRadius: '6px', border: '1px solid var(--color-border)', fontSize: '11px', fontFamily: 'monospace' }}
                  />
                  <input
                    type="text"
                    value={fw.firmwareUrl}
                    onChange={(e) => handleUpdateFirmware(idx, 'firmwareUrl', e.target.value)}
                    placeholder="https://.../merged.bin URL"
                    style={{ padding: '6px 8px', borderRadius: '6px', border: '1px solid var(--color-border)', fontSize: '11px' }}
                  />
                  {firmwares.length > 1 && (
                    <button
                      type="button"
                      onClick={() => handleRemoveFirmware(idx)}
                      style={{ color: '#ef4444', background: 'none', border: 'none', padding: '6px', cursor: 'pointer' }}
                      title="Remove firmware"
                    >
                      <Trash2 size={15} />
                    </button>
                  )}
                </div>
              ))}
            </div>
          </div>

          {/* Section 6: Rich Text Markdown (.md) Editor */}
          <div
            style={{
              display: 'flex',
              flexDirection: 'column',
              borderRadius: '12px',
              border: '1px solid var(--color-border)',
              overflow: 'hidden',
            }}
          >
            {/* Editor Toolbar & Tab Switcher */}
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                padding: '8px 12px',
                backgroundColor: 'var(--color-paper)',
                borderBottom: '1px solid var(--color-border)',
                flexWrap: 'wrap',
                gap: '8px',
              }}
            >
              {/* Left: Formatting tools (active in 'write' mode) */}
              <div style={{ display: 'flex', alignItems: 'center', gap: '4px', flexWrap: 'wrap' }}>
                <button
                  type="button"
                  onClick={() => insertMarkdownSyntax('## ', '\n', 'Section Title')}
                  title="Heading 2"
                  style={{ padding: '5px 8px', borderRadius: '4px', border: 'none', background: 'transparent', fontWeight: 700, fontSize: '12px', cursor: 'pointer' }}
                >
                  H2
                </button>
                <button
                  type="button"
                  onClick={() => insertMarkdownSyntax('### ', '\n', 'Sub-heading')}
                  title="Heading 3"
                  style={{ padding: '5px 8px', borderRadius: '4px', border: 'none', background: 'transparent', fontWeight: 700, fontSize: '11px', cursor: 'pointer' }}
                >
                  H3
                </button>
                <button
                  type="button"
                  onClick={() => insertMarkdownSyntax('**', '**', 'bold text')}
                  title="Bold"
                  style={{ padding: '5px 8px', borderRadius: '4px', border: 'none', background: 'transparent', cursor: 'pointer' }}
                >
                  <Bold size={14} />
                </button>
                <button
                  type="button"
                  onClick={() => insertMarkdownSyntax('*', '*', 'italic text')}
                  title="Italic"
                  style={{ padding: '5px 8px', borderRadius: '4px', border: 'none', background: 'transparent', cursor: 'pointer' }}
                >
                  <Italic size={14} />
                </button>
                <button
                  type="button"
                  onClick={() => insertMarkdownSyntax('```cpp\n', '\n```', '// Code snippet')}
                  title="Code block"
                  style={{ padding: '5px 8px', borderRadius: '4px', border: 'none', background: 'transparent', cursor: 'pointer' }}
                >
                  <Code size={14} />
                </button>
                <button
                  type="button"
                  onClick={() => insertMarkdownSyntax('- ', '\n', 'List item')}
                  title="Bullet list"
                  style={{ padding: '5px 8px', borderRadius: '4px', border: 'none', background: 'transparent', cursor: 'pointer' }}
                >
                  <List size={14} />
                </button>
                <button
                  type="button"
                  onClick={() => insertMarkdownSyntax('1. ', '\n', 'First item')}
                  title="Numbered list"
                  style={{ padding: '5px 8px', borderRadius: '4px', border: 'none', background: 'transparent', cursor: 'pointer' }}
                >
                  <ListOrdered size={14} />
                </button>
                <button
                  type="button"
                  onClick={() => insertMarkdownSyntax('[', '](https://example.com)', 'Link Title')}
                  title="Hyperlink"
                  style={{ padding: '5px 8px', borderRadius: '4px', border: 'none', background: 'transparent', cursor: 'pointer' }}
                >
                  <Link2 size={14} />
                </button>
                <button
                  type="button"
                  onClick={() => insertMarkdownSyntax('![', '](https://images.unsplash.com/...)', 'Image caption')}
                  title="Image embed"
                  style={{ padding: '5px 8px', borderRadius: '4px', border: 'none', background: 'transparent', cursor: 'pointer' }}
                >
                  <ImageIcon size={14} />
                </button>
                <button
                  type="button"
                  onClick={() =>
                    insertMarkdownSyntax(
                      '\n| Parameter | Description |\n| :--- | :--- |\n| Hardware | UNIHIKER K10 |\n| Sensor | I2C SHT40 |\n'
                    )
                  }
                  title="Table template"
                  style={{ padding: '5px 8px', borderRadius: '4px', border: 'none', background: 'transparent', cursor: 'pointer' }}
                >
                  <TableIcon size={14} />
                </button>
              </div>

              {/* Right: Write vs Live Preview Tabs */}
              <div style={{ display: 'flex', alignItems: 'center', gap: '4px', backgroundColor: 'var(--color-surface)', padding: '2px', borderRadius: '6px', border: '1px solid var(--color-border)' }}>
                <button
                  type="button"
                  onClick={() => setEditorTab('write')}
                  style={{
                    padding: '4px 10px',
                    borderRadius: '4px',
                    border: 'none',
                    fontSize: '11px',
                    fontWeight: 600,
                    cursor: 'pointer',
                    backgroundColor: editorTab === 'write' ? 'var(--color-accent)' : 'transparent',
                    color: editorTab === 'write' ? '#fff' : 'var(--color-ink-secondary)',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '4px',
                  }}
                >
                  <Edit3 size={12} /> Write .md
                </button>
                <button
                  type="button"
                  onClick={() => setEditorTab('preview')}
                  style={{
                    padding: '4px 10px',
                    borderRadius: '4px',
                    border: 'none',
                    fontSize: '11px',
                    fontWeight: 600,
                    cursor: 'pointer',
                    backgroundColor: editorTab === 'preview' ? 'var(--color-accent)' : 'transparent',
                    color: editorTab === 'preview' ? '#fff' : 'var(--color-ink-secondary)',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '4px',
                  }}
                >
                  <Eye size={12} /> Live Preview
                </button>
              </div>
            </div>

            {/* Editor Workspace */}
            {editorTab === 'write' ? (
              <textarea
                ref={markdownTextareaRef}
                rows={12}
                value={markdownContent}
                onChange={(e) => setMarkdownContent(e.target.value)}
                placeholder="Write your rich markdown documentation, setup guide, and code tutorials here..."
                style={{
                  width: '100%',
                  padding: 'var(--space-4)',
                  fontSize: '13px',
                  fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace',
                  lineHeight: 1.6,
                  border: 'none',
                  outline: 'none',
                  backgroundColor: 'var(--color-surface)',
                  color: 'var(--color-ink-primary)',
                  resize: 'vertical',
                }}
              />
            ) : (
              <div
                style={{
                  padding: 'var(--space-6)',
                  minHeight: 280,
                  maxHeight: 400,
                  overflowY: 'auto',
                  backgroundColor: 'var(--color-surface)',
                  fontSize: 'var(--text-sm)',
                  lineHeight: 1.7,
                }}
              >
                {markdownContent ? (
                  <div>
                    {markdownContent.split('\n').map((line, idx) => {
                      if (line.startsWith('# ')) {
                        return <h1 key={idx} style={{ fontSize: '1.5rem', fontWeight: 800, margin: '16px 0 8px 0' }}>{line.slice(2)}</h1>;
                      }
                      if (line.startsWith('## ')) {
                        return <h2 key={idx} style={{ fontSize: '1.25rem', fontWeight: 700, margin: '14px 0 6px 0', borderBottom: '1px solid var(--color-border)', paddingBottom: '4px' }}>{line.slice(3)}</h2>;
                      }
                      if (line.startsWith('### ')) {
                        return <h3 key={idx} style={{ fontSize: '1.1rem', fontWeight: 600, margin: '10px 0 4px 0' }}>{line.slice(4)}</h3>;
                      }
                      if (line.startsWith('- ') || line.startsWith('* ')) {
                        return <li key={idx} style={{ marginLeft: 20, marginBottom: 4 }}>{line.slice(2)}</li>;
                      }
                      if (line.trim().length > 0) {
                        return <p key={idx} style={{ margin: '0 0 10px 0', color: 'var(--color-ink-secondary)' }}>{line}</p>;
                      }
                      return null;
                    })}
                  </div>
                ) : (
                  <p style={{ color: 'var(--color-ink-tertiary)', textAlign: 'center', padding: 'var(--space-8) 0' }}>
                    No markdown written yet. Switch to "Write" tab to begin.
                  </p>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Modal Footer */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'flex-end',
            gap: 'var(--space-3)',
            padding: 'var(--space-4) var(--space-6)',
            borderTop: '1px solid var(--color-border)',
            backgroundColor: 'var(--color-paper)',
          }}
        >
          <button
            type="button"
            onClick={onClose}
            className="btn btn--ghost btn--sm"
            style={{ borderRadius: '8px' }}
            disabled={isSaving}
          >
            Cancel
          </button>

          <button
            type="button"
            onClick={handleSave}
            className="btn btn--primary btn--sm"
            style={{ display: 'flex', alignItems: 'center', gap: '6px', borderRadius: '8px', minWidth: 120, justifyContent: 'center' }}
            disabled={isSaving}
          >
            {isSaving ? (
              <span>Saving...</span>
            ) : (
              <>
                <CheckCircle2 size={15} />
                <span>{initialProject ? 'Update' : 'Publish'}</span>
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
