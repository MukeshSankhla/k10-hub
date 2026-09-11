import { useState, useEffect, useMemo } from 'react';
import { marked } from 'marked';
import { ProjectDetail } from '../../config/projectsData';
import { Loader2, AlertCircle } from 'lucide-react';
import { normalizeMarkdownUrl } from '../../services/projects/projectStorageService';

interface ProjectDocumentationProps {
  project: ProjectDetail;
}

export default function ProjectDocumentation({ project }: ProjectDocumentationProps) {
  const [content, setContent] = useState<string>(project.markdownContent || '');
  const [loading, setLoading] = useState(false);
  const [fetchError, setFetchError] = useState<string | null>(null);

  // Configure marked once
  useEffect(() => {
    marked.setOptions({
      gfm: true,
      breaks: true,
    });
  }, []);

  // If a remote projectMdFile is specified, fetch it
  useEffect(() => {
    if (project.projectMdFile) {
      setLoading(true);
      setFetchError(null);
      const url = normalizeMarkdownUrl(project.projectMdFile);
      fetch(url)
        .then((res) => {
          if (!res.ok) throw new Error(`HTTP ${res.status}: Failed to load documentation file`);
          return res.text();
        })
        .then((text) => {
          setContent(text);
          setLoading(false);
        })
        .catch((err) => {
          console.warn('Error fetching remote markdown:', err);
          setFetchError(`Could not fetch remote markdown from ${project.projectMdFile}`);
          setContent(project.markdownContent || '');
          setLoading(false);
        });
    } else if (project.markdownContent) {
      setContent(project.markdownContent);
      setFetchError(null);
    } else {
      setContent(`# ${project.title}\n\n${project.description}`);
      setFetchError(null);
    }
  }, [project]);

  // Parse markdown into HTML using marked
  const renderedHtml = useMemo(() => {
    if (!content) return '';
    try {
      return marked.parse(content) as string;
    } catch (err) {
      console.error('Failed to parse markdown with marked:', err);
      return `<p>${content}</p>`;
    }
  }, [content]);

  return (
    <div
      style={{
        backgroundColor: 'var(--color-surface)',
        border: '1px solid var(--color-border)',
        borderRadius: 'var(--radius-xl)',
        padding: 'clamp(var(--space-6), 4vw, var(--space-10))',
        boxShadow: 'var(--shadow-sm)',
      }}
    >
      {loading ? (
        <div
          style={{
            padding: 'var(--space-16) 0',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 'var(--space-3)',
            color: 'var(--color-ink-secondary)',
          }}
        >
          <Loader2 size={24} className="animate-spin" style={{ color: 'var(--color-accent)' }} />
          <span style={{ fontSize: 'var(--text-sm)', fontWeight: 500 }}>
            Fetching project documentation...
          </span>
        </div>
      ) : (
        <>
          {fetchError && (
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                padding: '10px 14px',
                backgroundColor: 'rgba(239, 68, 68, 0.1)',
                border: '1px solid rgba(239, 68, 68, 0.25)',
                borderRadius: 'var(--radius-md)',
                color: '#dc2626',
                fontSize: 'var(--text-xs)',
                marginBottom: 'var(--space-6)',
              }}
            >
              <AlertCircle size={15} />
              <span>{fetchError}. Falling back to default project overview.</span>
            </div>
          )}

          <div
            className="k10-markdown-body"
            dangerouslySetInnerHTML={{ __html: renderedHtml }}
          />
        </>
      )}
    </div>
  );
}
