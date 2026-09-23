import { useState } from 'react';
import {
  Download,
  Paperclip,
  FileText,
  Box,
  Archive,
  Code,
  File,
  Cpu,
  Check,
  Copy,
  FolderDown,
  Loader2,
} from 'lucide-react';
import { ProjectAttachment } from '../../config/projectsData';
import { convertGithubBlobToRaw } from '../../utils/githubUrl';

interface ProjectAttachmentsProps {
  attachments?: ProjectAttachment[];
  projectTitle?: string;
}

// Helper to determine file type and styling from URL or explicit type
function getFileInfo(att: ProjectAttachment) {
  const url = att.fileUrl || '';
  const explicitType = (att.fileType || '').toUpperCase().trim();
  
  // Extract extension from URL
  let ext = '';
  try {
    const urlObj = new URL(url.startsWith('http') ? url : `https://${url}`);
    const pathname = urlObj.pathname;
    const lastDot = pathname.lastIndexOf('.');
    if (lastDot !== -1) {
      ext = pathname.substring(lastDot + 1).toLowerCase();
    }
  } catch {
    const lastDot = url.lastIndexOf('.');
    if (lastDot !== -1) {
      ext = url.substring(lastDot + 1).split(/[?#]/)[0].toLowerCase();
    }
  }

  const type = explicitType || ext.toUpperCase() || 'FILE';

  // Categories & Colors
  if (['STL', 'STEP', 'STP', 'OBJ', '3MF', 'CAD', 'DXF'].includes(type)) {
    return {
      type,
      Icon: Box,
      badgeBg: 'rgba(245, 158, 11, 0.12)',
      badgeColor: '#f59e0b',
      badgeBorder: 'rgba(245, 158, 11, 0.3)',
      category: '3D / CAD Model',
    };
  }
  if (['PDF', 'DOC', 'DOCX', 'TXT', 'MD', 'RTF'].includes(type)) {
    return {
      type,
      Icon: FileText,
      badgeBg: 'rgba(239, 68, 68, 0.12)',
      badgeColor: '#ef4444',
      badgeBorder: 'rgba(239, 68, 68, 0.3)',
      category: 'Document',
    };
  }
  if (['ZIP', 'RAR', '7Z', 'TAR', 'GZ'].includes(type)) {
    return {
      type,
      Icon: Archive,
      badgeBg: 'rgba(168, 85, 247, 0.12)',
      badgeColor: '#a855f7',
      badgeBorder: 'rgba(168, 85, 247, 0.3)',
      category: 'Archive',
    };
  }
  if (['PY', 'INO', 'CPP', 'C', 'H', 'JSON', 'JS', 'TS', 'SH'].includes(type)) {
    return {
      type,
      Icon: Code,
      badgeBg: 'rgba(16, 185, 129, 0.12)',
      badgeColor: '#10b981',
      badgeBorder: 'rgba(16, 185, 129, 0.3)',
      category: 'Source Code',
    };
  }
  if (['BIN', 'HEX', 'ELF', 'UF2'].includes(type)) {
    return {
      type,
      Icon: Cpu,
      badgeBg: 'rgba(59, 130, 246, 0.12)',
      badgeColor: '#3b82f6',
      badgeBorder: 'rgba(59, 130, 246, 0.3)',
      category: 'Binary',
    };
  }

  return {
    type,
    Icon: File,
    badgeBg: 'rgba(100, 116, 139, 0.12)',
    badgeColor: '#64748b',
    badgeBorder: 'rgba(100, 116, 139, 0.3)',
    category: 'Attachment',
  };
}

// Helper to determine clean download filename
function getDownloadFilename(att: ProjectAttachment, fallbackIndex: number): string {
  if (att.name && att.name.trim()) {
    let name = att.name.trim();
    // Check if name has an extension, if not append extension from URL
    if (!name.includes('.')) {
      try {
        const urlObj = new URL(att.fileUrl.startsWith('http') ? att.fileUrl : `https://${att.fileUrl}`);
        const lastDot = urlObj.pathname.lastIndexOf('.');
        if (lastDot !== -1) {
          name += urlObj.pathname.substring(lastDot);
        }
      } catch {
        // Keep name as is
      }
    }
    return name;
  }

  try {
    const urlObj = new URL(att.fileUrl.startsWith('http') ? att.fileUrl : `https://${att.fileUrl}`);
    const segment = urlObj.pathname.split('/').filter(Boolean).pop();
    if (segment) return decodeURIComponent(segment);
  } catch {
    // Fallback
  }

  return `attachment-${fallbackIndex + 1}`;
}

export default function ProjectAttachments({ attachments = [] }: ProjectAttachmentsProps) {
  const [downloadingIndices, setDownloadingIndices] = useState<Record<number, boolean>>({});
  const [copiedIndices, setCopiedIndices] = useState<Record<number, boolean>>({});
  const [isDownloadingAll, setIsDownloadingAll] = useState(false);

  // Filter out any completely empty entries
  const validFiles = attachments.filter((att) => att && (att.fileUrl?.trim() || att.name?.trim()));

  if (validFiles.length === 0) {
    return null;
  }

  const handleDownloadFile = async (att: ProjectAttachment, index: number) => {
    const targetUrl = convertGithubBlobToRaw(att.fileUrl);
    const filename = getDownloadFilename(att, index);

    setDownloadingIndices((prev) => ({ ...prev, [index]: true }));

    try {
      // Try direct blob fetch for cleanest browser download experience
      const response = await fetch(targetUrl);
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const blob = await response.blob();
      const blobUrl = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = blobUrl;
      link.download = filename;
      document.body.appendChild(link);
      link.click();
      window.URL.revokeObjectURL(blobUrl);
      document.body.removeChild(link);
    } catch {
      // Fallback: If CORS blocks fetch, open/download directly
      const link = document.createElement('a');
      link.href = targetUrl;
      link.download = filename;
      link.target = '_blank';
      link.rel = 'noopener noreferrer';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    } finally {
      setTimeout(() => {
        setDownloadingIndices((prev) => ({ ...prev, [index]: false }));
      }, 500);
    }
  };

  const handleCopyLink = (att: ProjectAttachment, index: number) => {
    const targetUrl = convertGithubBlobToRaw(att.fileUrl);
    navigator.clipboard.writeText(targetUrl).then(() => {
      setCopiedIndices((prev) => ({ ...prev, [index]: true }));
      setTimeout(() => {
        setCopiedIndices((prev) => ({ ...prev, [index]: false }));
      }, 2000);
    });
  };

  const handleDownloadAll = async () => {
    if (isDownloadingAll) return;
    setIsDownloadingAll(true);

    for (let i = 0; i < validFiles.length; i++) {
      await handleDownloadFile(validFiles[i], i);
      // Brief pause between sequential downloads to allow browser dispatch
      await new Promise((r) => setTimeout(r, 400));
    }

    setIsDownloadingAll(false);
  };

  return (
    <div
      id="project-attachments"
      style={{
        backgroundColor: 'var(--color-surface)',
        borderRadius: '16px',
        border: '1px solid var(--color-border)',
        overflow: 'hidden',
        boxShadow: 'var(--shadow-sm)',
        marginTop: 'var(--space-6)',
      }}
    >
      {/* Station Header */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '12px 16px',
          backgroundColor: 'var(--color-paper)',
          borderBottom: '1px solid var(--color-border)',
          flexWrap: 'wrap',
          gap: '8px',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <div
            style={{
              width: 28,
              height: 28,
              borderRadius: '8px',
              backgroundColor: 'rgba(230, 81, 0, 0.1)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: 'var(--color-accent)',
            }}
          >
            <Paperclip size={16} />
          </div>
          <div>
            <span
              style={{
                fontSize: '12px',
                fontWeight: 700,
                color: 'var(--color-ink-primary)',
                textTransform: 'uppercase',
                letterSpacing: '0.05em',
                display: 'block',
              }}
            >
              Files & Attachments
            </span>
            <span style={{ fontSize: '11px', color: 'var(--color-ink-tertiary)' }}>
              {validFiles.length} downloadable {validFiles.length === 1 ? 'file' : 'files'}
            </span>
          </div>
        </div>

        {validFiles.length > 1 && (
          <button
            type="button"
            onClick={handleDownloadAll}
            disabled={isDownloadingAll}
            className="btn btn--secondary btn--sm"
            style={{
              fontSize: '11px',
              padding: '4px 10px',
              display: 'inline-flex',
              alignItems: 'center',
              gap: '5px',
            }}
          >
            {isDownloadingAll ? (
              <>
                <Loader2 size={12} className="animate-spin" />
                <span>Downloading...</span>
              </>
            ) : (
              <>
                <FolderDown size={13} />
                <span>Download All</span>
              </>
            )}
          </button>
        )}
      </div>

      {/* Files List */}
      <div style={{ padding: '12px 14px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
        {validFiles.map((att, idx) => {
          const info = getFileInfo(att);
          const IconComponent = info.Icon;
          const isDownloading = !!downloadingIndices[idx];
          const isCopied = !!copiedIndices[idx];
          const displayName = att.name && att.name.trim() ? att.name.trim() : getDownloadFilename(att, idx);

          return (
            <div
              key={idx}
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                padding: '10px 12px',
                backgroundColor: 'var(--color-bg)',
                borderRadius: '10px',
                border: '1px solid var(--color-border)',
                gap: '10px',
                transition: 'border-color 0.15s ease, transform 0.15s ease',
              }}
            >
              {/* Left: Icon & Meta */}
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px', minWidth: 0, flex: 1 }}>
                <div
                  style={{
                    width: 34,
                    height: 34,
                    borderRadius: '8px',
                    backgroundColor: info.badgeBg,
                    border: `1px solid ${info.badgeBorder}`,
                    color: info.badgeColor,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    flexShrink: 0,
                  }}
                  title={info.category}
                >
                  <IconComponent size={18} />
                </div>

                <div style={{ minWidth: 0, flex: 1 }}>
                  <div
                    style={{
                      fontSize: '13px',
                      fontWeight: 600,
                      color: 'var(--color-ink-primary)',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      whiteSpace: 'nowrap',
                    }}
                    title={displayName}
                  >
                    {displayName}
                  </div>

                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginTop: '2px', flexWrap: 'wrap' }}>
                    <span
                      style={{
                        fontSize: '10px',
                        fontWeight: 700,
                        padding: '1px 6px',
                        borderRadius: '4px',
                        backgroundColor: info.badgeBg,
                        color: info.badgeColor,
                        border: `1px solid ${info.badgeBorder}`,
                        letterSpacing: '0.04em',
                      }}
                    >
                      {info.type}
                    </span>

                    {att.fileSize && att.fileSize.trim() && (
                      <span style={{ fontSize: '11px', color: 'var(--color-ink-tertiary)' }}>
                        {att.fileSize.trim()}
                      </span>
                    )}
                  </div>
                </div>
              </div>

              {/* Right: Actions */}
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexShrink: 0 }}>
                {/* Copy Link button */}
                <button
                  type="button"
                  onClick={() => handleCopyLink(att, idx)}
                  className="btn btn--ghost btn--sm"
                  title={isCopied ? 'Link Copied!' : 'Copy direct link'}
                  style={{
                    padding: '6px',
                    color: isCopied ? 'var(--color-accent)' : 'var(--color-ink-tertiary)',
                  }}
                >
                  {isCopied ? <Check size={14} /> : <Copy size={14} />}
                </button>

                {/* Direct Download button */}
                <button
                  type="button"
                  onClick={() => handleDownloadFile(att, idx)}
                  disabled={isDownloading}
                  className="btn btn--primary btn--sm"
                  title={`Download ${displayName}`}
                  style={{
                    fontSize: '12px',
                    padding: '6px 12px',
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '5px',
                  }}
                >
                  {isDownloading ? (
                    <>
                      <Loader2 size={13} className="animate-spin" />
                      <span>Saving...</span>
                    </>
                  ) : (
                    <>
                      <Download size={13} />
                      <span>Download</span>
                    </>
                  )}
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
