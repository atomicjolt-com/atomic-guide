/**
 * @fileoverview Assessment preview component for reviewing before submission
 * @module features/assessment/client/components/AssessmentPreview
 */

import { ReactElement } from 'react';
import type { AssessmentConfig } from '../../shared/schemas/assessment.schema';
import styles from './AssessmentPreview.module.css';

interface AssessmentPreviewProps {
  config: AssessmentConfig;
  onBack: () => void;
  onSubmit: () => void;
  isSubmitting: boolean;
}

/**
 * Assessment preview interface for reviewing configuration before embedding
 */
export function AssessmentPreview({ config, onBack, onSubmit, isSubmitting }: AssessmentPreviewProps): ReactElement {
  return (
    <div className={styles.preview}>
      <div className={styles.card}>
        <h2>Assessment Preview</h2>

        <div className={styles.details}>
          <div className={styles.detailRow}>
            <span className={styles.label}>Title:</span>
            <span className={styles.value}>{config.title}</span>
          </div>

          {config.description && (
            <div className={styles.detailRow}>
              <span className={styles.label}>Description:</span>
              <span className={styles.value}>{config.description}</span>
            </div>
          )}

          <div className={styles.detailRow}>
            <span className={styles.label}>Type:</span>
            <span className={styles.value}>{config.assessmentType.charAt(0).toUpperCase() + config.assessmentType.slice(1)}</span>
          </div>

          <div className={styles.detailRow}>
            <span className={styles.label}>Mastery Threshold:</span>
            <span className={styles.value}>{config.masteryThreshold}%</span>
          </div>

          <div className={styles.detailRow}>
            <span className={styles.label}>Max Score:</span>
            <span className={styles.value}>{config.gradingSchema.maxScore} points</span>
          </div>

          <div className={styles.detailRow}>
            <span className={styles.label}>Passing Score:</span>
            <span className={styles.value}>{config.gradingSchema.passingScore} points</span>
          </div>

          <div className={styles.detailRow}>
            <span className={styles.label}>Allowed Attempts:</span>
            <span className={styles.value}>
              {config.aiGuidance.allowedAttempts} attempt{config.aiGuidance.allowedAttempts !== 1 ? 's' : ''}
            </span>
          </div>

          {config.timeLimit && (
            <div className={styles.detailRow}>
              <span className={styles.label}>Time Limit:</span>
              <span className={styles.value}>
                {config.timeLimit} minute{config.timeLimit !== 1 ? 's' : ''}
              </span>
            </div>
          )}

          {config.shuffleQuestions && (
            <div className={styles.detailRow}>
              <span className={styles.label}>Shuffle Questions:</span>
              <span className={styles.value}>Enabled</span>
            </div>
          )}

          {config.showFeedback && (
            <div className={styles.detailRow}>
              <span className={styles.label}>Show Feedback:</span>
              <span className={styles.value}>Enabled</span>
            </div>
          )}
        </div>

        {/* Questions Section - Always show */}
        {config.questions && (
          <div className={styles.questions}>
            <h3>
              Questions ({config.questions.length} question{config.questions.length !== 1 ? 's' : ''})
            </h3>
            <div className={styles.questionList}>
              {config.questions.map((question, index) => (
                <div key={question.id} className={styles.questionItem}>
                  <div className={styles.questionHeader}>
                    <span className={styles.questionNumber}>Q{index + 1}</span>
                    <span className={styles.questionType}>{question.type.replace('_', ' ')}</span>
                    {question.points && (
                      <span className={styles.questionPoints}>
                        {question.points} point{question.points !== 1 ? 's' : ''}
                      </span>
                    )}
                  </div>
                  <div className={styles.questionText}>{question.text}</div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* AI Guidance Details */}
        {config.aiGuidance && (
          <div className={styles.aiGuidance}>
            <h3>AI Guidance</h3>
            {config.aiGuidance.assessmentFocus && (
              <div className={styles.detailRow}>
                <span className={styles.label}>Assessment Focus:</span>
                <span className={styles.value}>{config.aiGuidance.assessmentFocus}</span>
              </div>
            )}
            {config.aiGuidance.keyConceptsToTest && config.aiGuidance.keyConceptsToTest.length > 0 && (
              <div className={styles.detailRow}>
                <span className={styles.label}>Key Concepts:</span>
                <span className={styles.value}>{config.aiGuidance.keyConceptsToTest.join(', ')}</span>
              </div>
            )}
          </div>
        )}

        <div className={styles.aiInfo}>
          <h3>AI-Powered Features</h3>
          <ul>
            <li>✓ Contextual feedback based on LMS content</li>
            <li>✓ Real-time comprehension support</li>
            <li>✓ Personalized learning guidance</li>
            <li>✓ Automatic grade passback to Canvas</li>
          </ul>
        </div>

        <div className={styles.embedInfo}>
          <div className={styles.infoIcon}>ℹ️</div>
          <p>
            This assessment will be embedded as a graded assignment in your Canvas course. Students will access it directly from their
            assignment list.
          </p>
        </div>
      </div>

      <div className={styles.actions}>
        <button className={styles.backButton} onClick={onBack} disabled={isSubmitting}>
          Back to Edit
        </button>
        <button className={styles.submitButton} onClick={onSubmit} disabled={isSubmitting}>
          {isSubmitting ? 'Creating...' : 'Create Link'}
        </button>
      </div>
    </div>
  );
}
