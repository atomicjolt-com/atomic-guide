/**
 * @fileoverview Assessment builder component for creating AI-powered assessments
 * @module features/assessment/client/components/AssessmentBuilder
 */

import { ReactElement } from 'react';
import type { AssessmentConfig } from '../../shared/schemas/assessment.schema';
import styles from './AssessmentBuilder.module.css';

interface AssessmentBuilderProps {
  config: AssessmentConfig;
  onConfigChange: (config: AssessmentConfig) => void;
  onPreview: () => void;
  contentContext?: string;
}

/**
 * Assessment builder interface for configuring AI-guided assessments
 */
export function AssessmentBuilder({ 
  config, 
  onConfigChange, 
  onPreview,
  contentContext 
}: AssessmentBuilderProps): ReactElement {
  const handleTitleChange = (e: React.ChangeEvent<HTMLInputElement>): void => {
    onConfigChange({
      ...config,
      title: e.target.value
    });
  };

  const handleDescriptionChange = (e: React.ChangeEvent<HTMLTextAreaElement>): void => {
    onConfigChange({
      ...config,
      description: e.target.value
    });
  };

  const handleTypeChange = (e: React.ChangeEvent<HTMLSelectElement>): void => {
    onConfigChange({
      ...config,
      assessmentType: e.target.value as 'formative' | 'summative' | 'diagnostic'
    });
  };

  return (
    <div className={styles.builder}>
      <div className={styles.section}>
        <h2>Assessment Details</h2>
        
        <div className={styles.field}>
          <label htmlFor="title">Assessment Title *</label>
          <input
            id="title"
            type="text"
            value={config.title}
            onChange={handleTitleChange}
            placeholder="Enter assessment title"
            required
          />
        </div>

        <div className={styles.field}>
          <label htmlFor="description">Description</label>
          <textarea
            id="description"
            value={config.description || ''}
            onChange={handleDescriptionChange}
            placeholder="Describe the assessment purpose and content"
            rows={3}
          />
        </div>

        <div className={styles.field}>
          <label htmlFor="type">Assessment Type</label>
          <select 
            id="type"
            value={config.assessmentType} 
            onChange={handleTypeChange}
          >
            <option value="formative">Formative (Practice)</option>
            <option value="summative">Summative (Graded)</option>
            <option value="diagnostic">Diagnostic</option>
          </select>
        </div>
      </div>

      {contentContext && (
        <div className={styles.contextInfo}>
          <span className={styles.contextIcon}>📄</span>
          <p>This assessment will be context-aware based on the current LMS page content</p>
        </div>
      )}

      <div className={styles.section}>
        <h2>AI Configuration</h2>
        <p className={styles.placeholder}>
          AI-powered question generation and configuration will be available here.
          The system will analyze LMS content to suggest relevant questions.
        </p>
      </div>

      <div className={styles.actions}>
        <button 
          className={styles.previewButton}
          onClick={onPreview}
          disabled={!config.title}
        >
          Preview Assessment
        </button>
      </div>
    </div>
  );
}