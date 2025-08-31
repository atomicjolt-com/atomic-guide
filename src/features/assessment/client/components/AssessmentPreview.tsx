/**
 * @fileoverview Assessment preview component for reviewing before submission
 * @module features/assessment/client/components/AssessmentPreview
 */

import { ReactElement, useState } from 'react';
import type { AssessmentConfig } from '../../shared/schemas/assessment.schema';
import styles from './AssessmentPreview.module.css';

interface AssessmentPreviewProps {
  config: AssessmentConfig;
  onBack: () => void;
  onSubmit: () => void;
  isSubmitting: boolean;
  isInstructor?: boolean;
}

/**
 * Assessment preview interface for reviewing configuration before embedding
 */
export function AssessmentPreview({ config, onBack, onSubmit, isSubmitting, isInstructor = true }: AssessmentPreviewProps): ReactElement {
  const [previewMode, setPreviewMode] = useState<'instructor' | 'student'>('instructor');
  return (
    <div className={styles.preview}>
      <div className={styles.card}>
        <div className={styles.header}>
          <h2>Assessment Preview</h2>
          {isInstructor && (
            <div className={styles.viewToggle}>
              <button
                className={`${styles.toggleButton} ${previewMode === 'instructor' ? styles.active : ''}`}
                onClick={() => setPreviewMode('instructor')}
                type="button"
              >
                👨‍🏫 Instructor View
              </button>
              <button
                className={`${styles.toggleButton} ${previewMode === 'student' ? styles.active : ''}`}
                onClick={() => setPreviewMode('student')}
                type="button"
              >
                👨‍🎓 Student View
              </button>
            </div>
          )}
        </div>

        {previewMode === 'instructor' ? (
          <div className={styles.instructorView}>
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
        ) : (
          <div className={styles.studentView}>
            <div className={styles.studentAssessment}>
              <div className={styles.studentHeader}>
                <h3>{config.title}</h3>
                {config.description && (
                  <p className={styles.studentDescription}>{config.description}</p>
                )}
                <div className={styles.studentInfo}>
                  <div className={styles.infoItem}>
                    <span className={styles.infoLabel}>Questions:</span>
                    <span>{config.questions.length}</span>
                  </div>
                  <div className={styles.infoItem}>
                    <span className={styles.infoLabel}>Points:</span>
                    <span>{config.gradingSchema.maxScore}</span>
                  </div>
                  {config.timeLimit && (
                    <div className={styles.infoItem}>
                      <span className={styles.infoLabel}>Time Limit:</span>
                      <span>{config.timeLimit} min</span>
                    </div>
                  )}
                  <div className={styles.infoItem}>
                    <span className={styles.infoLabel}>Attempts:</span>
                    <span>{config.aiGuidance.allowedAttempts}</span>
                  </div>
                </div>
              </div>

              <div className={styles.studentQuestions}>
                {config.questions.map((question, index) => (
                  <div key={question.id} className={styles.studentQuestion}>
                    <div className={styles.studentQuestionHeader}>
                      <span className={styles.questionNum}>Question {index + 1}</span>
                      <span className={styles.questionScore}>{question.points} pts</span>
                    </div>
                    <div className={styles.studentQuestionText}>
                      {question.text}
                    </div>
                    {question.type === 'multiple_choice' && question.options && (
                      <div className={styles.studentOptions}>
                        {question.options.map((option, i) => (
                          <label key={i} className={styles.studentOption}>
                            <input type="radio" name={`question-${question.id}`} disabled />
                            <span>{option}</span>
                          </label>
                        ))}
                      </div>
                    )}
                    {question.type === 'true_false' && (
                      <div className={styles.studentOptions}>
                        <label className={styles.studentOption}>
                          <input type="radio" name={`question-${question.id}`} disabled />
                          <span>True</span>
                        </label>
                        <label className={styles.studentOption}>
                          <input type="radio" name={`question-${question.id}`} disabled />
                          <span>False</span>
                        </label>
                      </div>
                    )}
                    {(question.type === 'short_answer' || question.type === 'essay') && (
                      <div className={styles.studentTextAnswer}>
                        <textarea 
                          placeholder="Enter your answer here..."
                          disabled
                          className={styles.studentTextarea}
                          rows={question.type === 'essay' ? 6 : 3}
                        />
                      </div>
                    )}
                  </div>
                ))}
              </div>

              <div className={styles.studentActions}>
                <button className={styles.studentSubmit} disabled>
                  Submit Assessment
                </button>
                <p className={styles.previewNote}>
                  <em>Preview mode - This is how students will see the assessment</em>
                </p>
              </div>
            </div>
          </div>
        )}
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
