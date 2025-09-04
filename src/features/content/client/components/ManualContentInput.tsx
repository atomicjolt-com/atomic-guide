import React, { useState, useCallback, useRef } from 'react';
import styles from './ManualContentInput.module.css';

export interface ManualContentInputProps {
  onContentSubmit: (content: string, metadata?: ContentMetadata) => void;
  placeholder?: string;
  maxLength?: number;
  isLoading?: boolean;
  error?: string | null;
  pageUrl?: string;
  pageType?: 'assignment' | 'discussion' | 'module' | 'page' | 'quiz';
}

export interface ContentMetadata {
  title?: string;
  type?: string;
  url?: string;
  extractionMethod: 'manual' | 'paste' | 'upload';
  fileType?: string;
  instructorConsent: boolean;
}

export const ManualContentInput: React.FC<ManualContentInputProps> = ({
  onContentSubmit,
  placeholder = 'Paste or type the content you want to analyze. You can also upload a file.',
  maxLength = 50000,
  isLoading = false,
  error = null,
  pageUrl = '',
  pageType,
}) => {
  const [content, setContent] = useState('');
  const [title, setTitle] = useState('');
  const [contentType, setContentType] = useState<string>(pageType || 'page');
  const [url, setUrl] = useState(pageUrl);
  const [consent, setConsent] = useState(false);
  const [charCount, setCharCount] = useState(0);
  const [isDragging, setIsDragging] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleContentChange = useCallback(
    (e: React.ChangeEvent<HTMLTextAreaElement>) => {
      const newContent = e.target.value;
      if (newContent.length <= maxLength) {
        setContent(newContent);
        setCharCount(newContent.length);
      }
    },
    [maxLength]
  );

  const handleFileUpload = useCallback(
    (file: File) => {
      if (!file) return;

      const reader = new FileReader();
      reader.onload = (e) => {
        const fileContent = e.target?.result as string;
        if (fileContent.length <= maxLength) {
          setContent(fileContent);
          setCharCount(fileContent.length);
          if (!title) {
            setTitle(file.name.replace(/\.[^/.]+$/, ''));
          }
        } else {
          alert(`File content exceeds maximum length of ${maxLength} characters`);
        }
      };

      if (file.type === 'text/html' || file.type === 'text/plain' || file.type === 'text/markdown') {
        reader.readAsText(file);
      } else {
        alert('Please upload a text, HTML, or Markdown file');
      }
    },
    [maxLength, title]
  );

  const handleDrop = useCallback(
    (e: React.DragEvent<HTMLDivElement>) => {
      e.preventDefault();
      setIsDragging(false);

      const files = e.dataTransfer.files;
      if (files.length > 0) {
        handleFileUpload(files[0]);
      }
    },
    [handleFileUpload]
  );

  const handleDragOver = useCallback((e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragging(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragging(false);
  }, []);

  const handleFileInputChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const files = e.target.files;
      if (files && files.length > 0) {
        handleFileUpload(files[0]);
      }
    },
    [handleFileUpload]
  );

  const handleSubmit = useCallback(() => {
    if (!content.trim()) {
      alert('Please provide content to analyze');
      return;
    }

    if (!consent) {
      alert('Please confirm you have permission to analyze this content');
      return;
    }

    const metadata: ContentMetadata = {
      title: title || 'Untitled Content',
      type: contentType,
      url: url || undefined,
      extractionMethod: 'manual',
      instructorConsent: consent,
    };

    onContentSubmit(content, metadata);
  }, [content, title, contentType, url, consent, onContentSubmit]);

  const handleClear = useCallback(() => {
    setContent('');
    setTitle('');
    setUrl(pageUrl);
    setCharCount(0);
    setConsent(false);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  }, [pageUrl]);

  const isValid = content.trim().length > 0 && consent;

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <h3 className={styles.title}>Manual Content Input</h3>
        <p className={styles.subtitle}>The automatic content extraction is unavailable. Please provide the content manually.</p>
      </div>

      {error && (
        <div className={styles.error} role="alert">
          <span className={styles.errorIcon}>⚠️</span>
          <span>{error}</span>
        </div>
      )}

      <div className={styles.form}>
        <div className={styles.field}>
          <label htmlFor="content-title" className={styles.label}>
            Content Title
          </label>
          <input
            id="content-title"
            type="text"
            className={styles.input}
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Enter a title for this content"
            disabled={isLoading}
          />
        </div>

        <div className={styles.row}>
          <div className={styles.field}>
            <label htmlFor="content-type" className={styles.label}>
              Content Type
            </label>
            <select
              id="content-type"
              className={styles.select}
              value={contentType}
              onChange={(e) => setContentType(e.target.value)}
              disabled={isLoading}
            >
              <option value="page">Page</option>
              <option value="assignment">Assignment</option>
              <option value="discussion">Discussion</option>
              <option value="module">Module</option>
              <option value="quiz">Quiz</option>
            </select>
          </div>

          <div className={styles.field}>
            <label htmlFor="content-url" className={styles.label}>
              Page URL (Optional)
            </label>
            <input
              id="content-url"
              type="url"
              className={styles.input}
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              placeholder="https://..."
              disabled={isLoading}
            />
          </div>
        </div>

        <div className={styles.field}>
          <label htmlFor="content-text" className={styles.label}>
            Content
            <span className={styles.charCount}>
              {charCount} / {maxLength}
            </span>
          </label>

          <div
            className={`${styles.dropZone} ${isDragging ? styles.dragging : ''}`}
            onDrop={handleDrop}
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
          >
            <textarea
              id="content-text"
              className={styles.textarea}
              value={content}
              onChange={handleContentChange}
              placeholder={placeholder}
              disabled={isLoading}
              rows={12}
            />

            {!content && (
              <div className={styles.dropOverlay}>
                <p>Drop a file here or</p>
                <button type="button" className={styles.uploadButton} onClick={() => fileInputRef.current?.click()} disabled={isLoading}>
                  Choose File
                </button>
              </div>
            )}
          </div>

          <input
            ref={fileInputRef}
            type="file"
            className={styles.hiddenInput}
            accept=".txt,.html,.md,.markdown"
            onChange={handleFileInputChange}
            disabled={isLoading}
          />
        </div>

        <div className={styles.consent}>
          <label className={styles.checkboxLabel}>
            <input type="checkbox" checked={consent} onChange={(e) => setConsent(e.target.checked)} disabled={isLoading} />
            <span>
              I confirm that I have permission to analyze this content and that it does not contain sensitive or personally identifiable
              information that should not be processed.
            </span>
          </label>
        </div>

        <div className={styles.actions}>
          <button type="button" className={styles.clearButton} onClick={handleClear} disabled={isLoading}>
            Clear
          </button>

          <button type="button" className={styles.submitButton} onClick={handleSubmit} disabled={!isValid || isLoading}>
            {isLoading ? (
              <>
                <span className={styles.spinner} />
                Analyzing...
              </>
            ) : (
              'Analyze Content'
            )}
          </button>
        </div>
      </div>

      <div className={styles.info}>
        <h4 className={styles.infoTitle}>Tips for Manual Content Input</h4>
        <ul className={styles.infoList}>
          <li>Copy and paste content directly from your LMS page</li>
          <li>Upload text, HTML, or Markdown files by clicking or dragging</li>
          <li>Include headings and structure to improve analysis accuracy</li>
          <li>Remove any personal information before submitting</li>
          <li>Maximum content length is {maxLength.toLocaleString()} characters</li>
        </ul>
      </div>
    </div>
  );
};

export default ManualContentInput;
