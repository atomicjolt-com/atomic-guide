/**
 * @fileoverview AI Question Reviewer Component
 * Interface for reviewing, editing, and approving AI-generated assessment questions
 * @module features/deep-linking/client/components/AIQuestionReviewer
 */

import { useState, useCallback, useEffect, useRef, type ReactElement } from 'react';
import { GeneratedQuestion, QuestionType, BloomsLevel, ReviewStatus, AssessmentPlacement, AssessmentConfiguration } from '../hooks/useAssessmentConfiguration';

/**
 * Component props interface
 */
interface AIQuestionReviewerProps {
  generatedQuestions: GeneratedQuestion[];
  isGenerating: boolean;
  onQuestionApprove: (questionId: string) => void;
  onQuestionReject: (questionId: string) => void;
  onQuestionEdit: (questionId: string, updates: Partial<GeneratedQuestion>) => void;
  onGenerateQuestions: () => Promise<void>;
  showQualityMetrics?: boolean;
}

/**
 * Question editor state interface
 */
interface QuestionEditorState {
  questionId: string | null;
  isEditing: boolean;
  editedQuestion: Partial<GeneratedQuestion>;
  hasChanges: boolean;
}

/**
 * Quality metrics interface
 */
interface QualityMetrics {
  averageAiConfidence: number;
  averagePedagogicalScore: number;
  bloomsDistribution: Record<BloomsLevel, number>;
  difficultyDistribution: Record<string, number>;
  approvalRate: number;
}

/**
 * Bulk action interface
 */
interface BulkAction {
  type: 'approve' | 'reject' | 'reset';
  questionIds: string[];
}

/**
 * AI Question Reviewer Component
 *
 * Provides comprehensive interface for instructors to review AI-generated questions:
 * - Individual question review and editing
 * - Bulk approval/rejection operations
 * - Quality metrics and insights
 * - Rich text editing capabilities
 * - Question regeneration controls
 */
export function AIQuestionReviewer({
  generatedQuestions,
  isGenerating,
  onQuestionApprove,
  onQuestionReject,
  onQuestionEdit,
  onGenerateQuestions,
  showQualityMetrics = true,
}: AIQuestionReviewerProps): ReactElement {
  // State management
  const [selectedQuestions, setSelectedQuestions] = useState<Set<string>>(new Set());
  const [filterStatus, setFilterStatus] = useState<ReviewStatus | 'all'>('all');
  const [sortBy, setSortBy] = useState<'confidence' | 'difficulty' | 'created' | 'type'>('confidence');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');
  const [editorState, setEditorState] = useState<QuestionEditorState>({
    questionId: null,
    isEditing: false,
    editedQuestion: {},
    hasChanges: false,
  });

  // Refs
  const questionListRef = useRef<HTMLDivElement>(null);

  /**
   * Calculate quality metrics
   */
  const calculateQualityMetrics = useCallback((): QualityMetrics => {
    if (generatedQuestions.length === 0) {
      return {
        averageAiConfidence: 0,
        averagePedagogicalScore: 0,
        bloomsDistribution: {} as Record<BloomsLevel, number>,
        difficultyDistribution: {},
        approvalRate: 0,
      };
    }

    const aiConfidenceSum = generatedQuestions.reduce((sum, q) => sum + q.aiConfidence, 0);
    const pedagogicalSum = generatedQuestions.reduce((sum, q) => sum + q.pedagogicalScore, 0);

    const bloomsDistribution = generatedQuestions.reduce((dist, q) => {
      dist[q.bloomsLevel] = (dist[q.bloomsLevel] || 0) + 1;
      return dist;
    }, {} as Record<BloomsLevel, number>);

    const difficultyDistribution = generatedQuestions.reduce((dist, q) => {
      const difficulty = q.difficulty <= 2 ? 'Easy' : q.difficulty <= 4 ? 'Medium' : 'Hard';
      dist[difficulty] = (dist[difficulty] || 0) + 1;
      return dist;
    }, {} as Record<string, number>);

    const approvedCount = generatedQuestions.filter(q => q.reviewStatus === 'approved').length;

    return {
      averageAiConfidence: aiConfidenceSum / generatedQuestions.length,
      averagePedagogicalScore: pedagogicalSum / generatedQuestions.length,
      bloomsDistribution,
      difficultyDistribution,
      approvalRate: approvedCount / generatedQuestions.length,
    };
  }, [generatedQuestions]);

  /**
   * Filter and sort questions
   */
  const getFilteredQuestions = useCallback((): GeneratedQuestion[] => {
    let filtered = generatedQuestions;

    // Apply status filter
    if (filterStatus !== 'all') {
      filtered = filtered.filter(q => q.reviewStatus === filterStatus);
    }

    // Apply sorting
    filtered.sort((a, b) => {
      let aValue: any, bValue: any;

      switch (sortBy) {
        case 'confidence':
          aValue = a.aiConfidence;
          bValue = b.aiConfidence;
          break;
        case 'difficulty':
          aValue = a.difficulty;
          bValue = b.difficulty;
          break;
        case 'created':
          aValue = new Date(a.createdAt).getTime();
          bValue = new Date(b.createdAt).getTime();
          break;
        case 'type':
          aValue = a.type;
          bValue = b.type;
          break;
        default:
          return 0;
      }

      if (aValue < bValue) return sortOrder === 'asc' ? -1 : 1;
      if (aValue > bValue) return sortOrder === 'asc' ? 1 : -1;
      return 0;
    });

    return filtered;
  }, [generatedQuestions, filterStatus, sortBy, sortOrder]);

  /**
   * Handle question selection
   */
  const handleQuestionSelect = useCallback((questionId: string, selected: boolean) => {
    setSelectedQuestions(prev => {
      const updated = new Set(prev);
      if (selected) {
        updated.add(questionId);
      } else {
        updated.delete(questionId);
      }
      return updated;
    });
  }, []);

  /**
   * Handle select all toggle
   */
  const handleSelectAll = useCallback((selected: boolean) => {
    if (selected) {
      const filteredIds = getFilteredQuestions().map(q => q.id);
      setSelectedQuestions(new Set(filteredIds));
    } else {
      setSelectedQuestions(new Set());
    }
  }, [getFilteredQuestions]);

  /**
   * Handle bulk actions
   */
  const handleBulkAction = useCallback((action: BulkAction) => {
    action.questionIds.forEach(questionId => {
      switch (action.type) {
        case 'approve':
          onQuestionApprove(questionId);
          break;
        case 'reject':
          onQuestionReject(questionId);
          break;
        case 'reset':
          onQuestionEdit(questionId, { reviewStatus: 'pending' });
          break;
      }
    });

    // Clear selection after bulk action
    setSelectedQuestions(new Set());
  }, [onQuestionApprove, onQuestionReject, onQuestionEdit]);

  /**
   * Start editing a question
   */
  const startEditing = useCallback((question: GeneratedQuestion) => {
    setEditorState({
      questionId: question.id,
      isEditing: true,
      editedQuestion: { ...question },
      hasChanges: false,
    });
  }, []);

  /**
   * Cancel editing
   */
  const cancelEditing = useCallback(() => {
    setEditorState({
      questionId: null,
      isEditing: false,
      editedQuestion: {},
      hasChanges: false,
    });
  }, []);

  /**
   * Save question edits
   */
  const saveEdits = useCallback(() => {
    if (editorState.questionId && editorState.hasChanges) {
      onQuestionEdit(editorState.questionId, editorState.editedQuestion);
    }
    cancelEditing();
  }, [editorState, onQuestionEdit, cancelEditing]);

  /**
   * Update edited question
   */
  const updateEditedQuestion = useCallback((updates: Partial<GeneratedQuestion>) => {
    setEditorState(prev => ({
      ...prev,
      editedQuestion: { ...prev.editedQuestion, ...updates },
      hasChanges: true,
    }));
  }, []);

  /**
   * Get question type icon
   */
  const getQuestionTypeIcon = (type: QuestionType): string => {
    switch (type) {
      case 'multiple_choice': return '🔘';
      case 'short_answer': return '📝';
      case 'essay': return '📄';
      case 'true_false': return '✅';
      case 'fill_blank': return '📋';
      default: return '❓';
    }
  };

  /**
   * Get Bloom's level color
   */
  const getBloomsLevelColor = (level: BloomsLevel): string => {
    switch (level) {
      case 'remember': return '#10B981';
      case 'understand': return '#3B82F6';
      case 'apply': return '#F59E0B';
      case 'analyze': return '#EF4444';
      case 'evaluate': return '#8B5CF6';
      case 'create': return '#EC4899';
      default: return '#6B7280';
    }
  };

  /**
   * Get confidence level description
   */
  const getConfidenceDescription = (confidence: number): string => {
    if (confidence >= 0.8) return 'High';
    if (confidence >= 0.6) return 'Medium';
    return 'Low';
  };

  /**
   * Format question options for display
   */
  const formatQuestionOptions = (question: GeneratedQuestion): string => {
    if (question.type === 'multiple_choice' && question.options) {
      return question.options.map((option, index) =>
        `${String.fromCharCode(65 + index)}. ${option}`
      ).join('\n');
    }
    return '';
  };

  // Calculate metrics
  const qualityMetrics = calculateQualityMetrics();
  const filteredQuestions = getFilteredQuestions();
  const allSelected = filteredQuestions.length > 0 &&
    filteredQuestions.every(q => selectedQuestions.has(q.id));
  const someSelected = selectedQuestions.size > 0;

  // No questions state
  if (generatedQuestions.length === 0 && !isGenerating) {
    return (
      <div className="ai-question-reviewer no-questions">
        <div className="empty-state">
          <h3>🤖 AI Question Generation</h3>
          <p>No questions have been generated yet. Click the button below to generate AI-powered questions based on your Canvas content and assessment configuration.</p>
          <button
            onClick={onGenerateQuestions}
            className="btn btn-primary btn-lg"
          >
            ✨ Generate Questions
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="ai-question-reviewer">
      {/* Header */}
      <div className="reviewer-header">
        <div className="header-info">
          <h3>🤖 AI Question Review</h3>
          <p>Review and approve AI-generated questions before deploying to students.</p>
        </div>

        <div className="header-actions">
          {isGenerating ? (
            <div className="generating-indicator">
              <div className="loading-spinner"></div>
              <span>Generating questions...</span>
            </div>
          ) : (
            <button
              onClick={onGenerateQuestions}
              className="btn btn-outline"
            >
              🔄 Regenerate Questions
            </button>
          )}
        </div>
      </div>

      {/* Quality Metrics */}
      {showQualityMetrics && generatedQuestions.length > 0 && (
        <div className="quality-metrics">
          <h4>📊 Quality Overview</h4>
          <div className="metrics-grid">
            <div className="metric-card">
              <span className="metric-label">AI Confidence</span>
              <span className="metric-value">
                {(qualityMetrics.averageAiConfidence * 100).toFixed(0)}%
              </span>
              <span className="metric-description">
                {getConfidenceDescription(qualityMetrics.averageAiConfidence)}
              </span>
            </div>

            <div className="metric-card">
              <span className="metric-label">Pedagogical Score</span>
              <span className="metric-value">
                {(qualityMetrics.averagePedagogicalScore * 100).toFixed(0)}%
              </span>
              <span className="metric-description">Educational Quality</span>
            </div>

            <div className="metric-card">
              <span className="metric-label">Approval Rate</span>
              <span className="metric-value">
                {(qualityMetrics.approvalRate * 100).toFixed(0)}%
              </span>
              <span className="metric-description">
                {generatedQuestions.filter(q => q.reviewStatus === 'approved').length} of {generatedQuestions.length}
              </span>
            </div>

            <div className="metric-card">
              <span className="metric-label">Question Types</span>
              <span className="metric-value">
                {Object.keys(qualityMetrics.difficultyDistribution).length}
              </span>
              <span className="metric-description">Different Types</span>
            </div>
          </div>
        </div>
      )}

      {/* Controls */}
      <div className="review-controls">
        <div className="controls-left">
          <div className="select-controls">
            <label className="checkbox-label">
              <input
                type="checkbox"
                checked={allSelected}
                ref={checkbox => {
                  if (checkbox) {
                    checkbox.indeterminate = someSelected && !allSelected;
                  }
                }}
                onChange={(e) => handleSelectAll(e.target.checked)}
              />
              Select All ({selectedQuestions.size})
            </label>
          </div>

          {someSelected && (
            <div className="bulk-actions">
              <button
                onClick={() => handleBulkAction({
                  type: 'approve',
                  questionIds: Array.from(selectedQuestions),
                })}
                className="btn btn-success btn-sm"
              >
                ✓ Approve Selected
              </button>
              <button
                onClick={() => handleBulkAction({
                  type: 'reject',
                  questionIds: Array.from(selectedQuestions),
                })}
                className="btn btn-danger btn-sm"
              >
                ✗ Reject Selected
              </button>
              <button
                onClick={() => handleBulkAction({
                  type: 'reset',
                  questionIds: Array.from(selectedQuestions),
                })}
                className="btn btn-outline btn-sm"
              >
                ↻ Reset Selected
              </button>
            </div>
          )}
        </div>

        <div className="controls-right">
          <div className="filter-controls">
            <select
              value={filterStatus}
              onChange={(e) => setFilterStatus(e.target.value as ReviewStatus | 'all')}
              className="filter-select"
            >
              <option value="all">All Questions</option>
              <option value="pending">Pending Review</option>
              <option value="approved">Approved</option>
              <option value="rejected">Rejected</option>
              <option value="modified">Modified</option>
            </select>

            <select
              value={`${sortBy}-${sortOrder}`}
              onChange={(e) => {
                const [by, order] = e.target.value.split('-');
                setSortBy(by as typeof sortBy);
                setSortOrder(order as typeof sortOrder);
              }}
              className="sort-select"
            >
              <option value="confidence-desc">Confidence (High to Low)</option>
              <option value="confidence-asc">Confidence (Low to High)</option>
              <option value="difficulty-desc">Difficulty (Hard to Easy)</option>
              <option value="difficulty-asc">Difficulty (Easy to Hard)</option>
              <option value="created-desc">Newest First</option>
              <option value="created-asc">Oldest First</option>
              <option value="type-asc">Type (A-Z)</option>
            </select>
          </div>
        </div>
      </div>

      {/* Question List */}
      <div ref={questionListRef} className="question-list">
        {filteredQuestions.map((question) => (
          <div
            key={question.id}
            className={`question-card ${question.reviewStatus} ${
              selectedQuestions.has(question.id) ? 'selected' : ''
            } ${editorState.questionId === question.id ? 'editing' : ''}`}
          >
            {/* Question Header */}
            <div className="question-header">
              <div className="header-left">
                <label className="checkbox-label">
                  <input
                    type="checkbox"
                    checked={selectedQuestions.has(question.id)}
                    onChange={(e) => handleQuestionSelect(question.id, e.target.checked)}
                  />
                </label>

                <div className="question-meta">
                  <span className="question-type">
                    {getQuestionTypeIcon(question.type)} {question.type.replace('_', ' ')}
                  </span>
                  <span
                    className="blooms-level"
                    style={{ backgroundColor: getBloomsLevelColor(question.bloomsLevel) }}
                  >
                    {question.bloomsLevel}
                  </span>
                  <span className="difficulty-level">
                    Difficulty: {question.difficulty}/5
                  </span>
                </div>
              </div>

              <div className="header-right">
                <div className="confidence-indicator">
                  <span className="confidence-label">AI Confidence:</span>
                  <div className="confidence-bar">
                    <div
                      className="confidence-fill"
                      style={{ width: `${question.aiConfidence * 100}%` }}
                    />
                  </div>
                  <span className="confidence-value">
                    {(question.aiConfidence * 100).toFixed(0)}%
                  </span>
                </div>

                <div className="status-indicator">
                  {question.reviewStatus === 'pending' && <span className="status pending">⏳ Pending</span>}
                  {question.reviewStatus === 'approved' && <span className="status approved">✅ Approved</span>}
                  {question.reviewStatus === 'rejected' && <span className="status rejected">❌ Rejected</span>}
                  {question.reviewStatus === 'modified' && <span className="status modified">✏️ Modified</span>}
                </div>
              </div>
            </div>

            {/* Question Content */}
            <div className="question-content">
              {editorState.questionId === question.id ? (
                // Edit Mode
                <div className="question-editor">
                  <div className="editor-field">
                    <label>Question Text:</label>
                    <textarea
                      value={editorState.editedQuestion.question || ''}
                      onChange={(e) => updateEditedQuestion({ question: e.target.value })}
                      rows={3}
                      className="editor-textarea"
                    />
                  </div>

                  {question.type === 'multiple_choice' && (
                    <div className="editor-field">
                      <label>Options (one per line):</label>
                      <textarea
                        value={editorState.editedQuestion.options?.join('\n') || ''}
                        onChange={(e) => updateEditedQuestion({
                          options: e.target.value.split('\n').filter(opt => opt.trim())
                        })}
                        rows={4}
                        className="editor-textarea"
                        placeholder="Option A&#10;Option B&#10;Option C&#10;Option D"
                      />
                    </div>
                  )}

                  <div className="editor-field">
                    <label>Correct Answer:</label>
                    <input
                      type="text"
                      value={Array.isArray(editorState.editedQuestion.correctAnswer)
                        ? editorState.editedQuestion.correctAnswer.join(', ')
                        : editorState.editedQuestion.correctAnswer || ''
                      }
                      onChange={(e) => updateEditedQuestion({ correctAnswer: e.target.value })}
                      className="editor-input"
                    />
                  </div>

                  <div className="editor-field">
                    <label>Explanation:</label>
                    <textarea
                      value={editorState.editedQuestion.explanation || ''}
                      onChange={(e) => updateEditedQuestion({ explanation: e.target.value })}
                      rows={2}
                      className="editor-textarea"
                    />
                  </div>

                  <div className="editor-actions">
                    <button onClick={cancelEditing} className="btn btn-outline btn-sm">
                      Cancel
                    </button>
                    <button
                      onClick={saveEdits}
                      className="btn btn-primary btn-sm"
                      disabled={!editorState.hasChanges}
                    >
                      Save Changes
                    </button>
                  </div>
                </div>
              ) : (
                // View Mode
                <div className="question-display">
                  <div className="question-text">
                    <strong>Question:</strong>
                    <p>{question.question}</p>
                  </div>

                  {question.options && question.options.length > 0 && (
                    <div className="question-options">
                      <strong>Options:</strong>
                      <div className="options-list">
                        {question.options.map((option, index) => (
                          <div key={index} className="option-item">
                            <span className="option-letter">
                              {String.fromCharCode(65 + index)}.
                            </span>
                            <span className="option-text">{option}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  <div className="question-answer">
                    <strong>Correct Answer:</strong>
                    <span className="answer-text">
                      {Array.isArray(question.correctAnswer)
                        ? question.correctAnswer.join(', ')
                        : question.correctAnswer
                      }
                    </span>
                  </div>

                  {question.explanation && (
                    <div className="question-explanation">
                      <strong>Explanation:</strong>
                      <p>{question.explanation}</p>
                    </div>
                  )}

                  <div className="question-metadata">
                    <span>📊 Pedagogical Score: {(question.pedagogicalScore * 100).toFixed(0)}%</span>
                    <span>⏱️ Est. Time: {question.estimatedTime} min</span>
                    <span>🎯 Points: {question.points}</span>
                    {question.tags.length > 0 && (
                      <span>🏷️ Tags: {question.tags.join(', ')}</span>
                    )}
                  </div>
                </div>
              )}
            </div>

            {/* Question Actions */}
            {editorState.questionId !== question.id && (
              <div className="question-actions">
                <button
                  onClick={() => startEditing(question)}
                  className="btn btn-outline btn-sm"
                >
                  ✏️ Edit
                </button>

                {question.reviewStatus !== 'approved' && (
                  <button
                    onClick={() => onQuestionApprove(question.id)}
                    className="btn btn-success btn-sm"
                  >
                    ✓ Approve
                  </button>
                )}

                {question.reviewStatus !== 'rejected' && (
                  <button
                    onClick={() => onQuestionReject(question.id)}
                    className="btn btn-danger btn-sm"
                  >
                    ✗ Reject
                  </button>
                )}

                {question.reviewStatus !== 'pending' && (
                  <button
                    onClick={() => onQuestionEdit(question.id, { reviewStatus: 'pending' })}
                    className="btn btn-outline btn-sm"
                  >
                    ↻ Reset
                  </button>
                )}
              </div>
            )}
          </div>
        ))}
      </div>

      {/* Review Summary */}
      {generatedQuestions.length > 0 && (
        <div className="review-summary">
          <h4>📋 Review Summary</h4>
          <div className="summary-stats">
            <div className="stat-group">
              <span className="stat-label">Total Questions:</span>
              <span className="stat-value">{generatedQuestions.length}</span>
            </div>
            <div className="stat-group">
              <span className="stat-label">Approved:</span>
              <span className="stat-value approved">
                {generatedQuestions.filter(q => q.reviewStatus === 'approved').length}
              </span>
            </div>
            <div className="stat-group">
              <span className="stat-label">Pending:</span>
              <span className="stat-value pending">
                {generatedQuestions.filter(q => q.reviewStatus === 'pending').length}
              </span>
            </div>
            <div className="stat-group">
              <span className="stat-label">Rejected:</span>
              <span className="stat-value rejected">
                {generatedQuestions.filter(q => q.reviewStatus === 'rejected').length}
              </span>
            </div>
          </div>

          {qualityMetrics.approvalRate > 0 && (
            <div className="approval-progress">
              <div className="progress-bar">
                <div
                  className="progress-fill"
                  style={{ width: `${qualityMetrics.approvalRate * 100}%` }}
                />
              </div>
              <span className="progress-label">
                {(qualityMetrics.approvalRate * 100).toFixed(0)}% questions approved
              </span>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

/**
 * CSS styles for AI question reviewer
 */
const styles = `
  .ai-question-reviewer {
    display: flex;
    flex-direction: column;
    gap: 20px;
    padding: 20px;
  }

  .reviewer-header {
    display: flex;
    justify-content: space-between;
    align-items: flex-start;
    gap: 20px;
  }

  .header-info h3 {
    margin: 0 0 8px 0;
    color: #333;
    font-size: 1.25rem;
  }

  .header-info p {
    margin: 0;
    color: #666;
    font-size: 0.9rem;
  }

  .header-actions {
    flex-shrink: 0;
  }

  .generating-indicator {
    display: flex;
    align-items: center;
    gap: 8px;
    color: #666;
    font-size: 0.9rem;
  }

  .loading-spinner {
    width: 16px;
    height: 16px;
    border: 2px solid #E5E7EB;
    border-top: 2px solid #FFDD00;
    border-radius: 50%;
    animation: spin 1s linear infinite;
  }

  @keyframes spin {
    0% { transform: rotate(0deg); }
    100% { transform: rotate(360deg); }
  }

  .quality-metrics {
    background: white;
    border: 1px solid #E5E7EB;
    border-radius: 8px;
    padding: 20px;
  }

  .quality-metrics h4 {
    margin: 0 0 16px 0;
    color: #333;
    font-size: 1.1rem;
  }

  .metrics-grid {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
    gap: 16px;
  }

  .metric-card {
    background: #F9FAFB;
    border-radius: 6px;
    padding: 16px;
    text-align: center;
    border: 1px solid #E5E7EB;
  }

  .metric-label {
    display: block;
    font-size: 0.8rem;
    color: #666;
    margin-bottom: 4px;
  }

  .metric-value {
    display: block;
    font-size: 1.5rem;
    font-weight: 600;
    color: #333;
    margin-bottom: 4px;
  }

  .metric-description {
    display: block;
    font-size: 0.8rem;
    color: #666;
  }

  .review-controls {
    display: flex;
    justify-content: space-between;
    align-items: center;
    gap: 20px;
    padding: 16px;
    background: white;
    border: 1px solid #E5E7EB;
    border-radius: 6px;
  }

  .controls-left {
    display: flex;
    align-items: center;
    gap: 16px;
  }

  .select-controls {
    display: flex;
    align-items: center;
    gap: 8px;
  }

  .checkbox-label {
    display: flex;
    align-items: center;
    gap: 6px;
    font-size: 0.9rem;
    color: #333;
    cursor: pointer;
  }

  .checkbox-label input[type="checkbox"] {
    margin: 0;
  }

  .bulk-actions {
    display: flex;
    gap: 8px;
  }

  .controls-right {
    display: flex;
    align-items: center;
    gap: 12px;
  }

  .filter-controls {
    display: flex;
    gap: 8px;
  }

  .filter-select,
  .sort-select {
    padding: 6px 10px;
    border: 1px solid #D1D5DB;
    border-radius: 4px;
    font-size: 0.85rem;
    background: white;
  }

  .filter-select:focus,
  .sort-select:focus {
    outline: none;
    border-color: #FFDD00;
    box-shadow: 0 0 0 2px rgba(255, 221, 0, 0.2);
  }

  .question-list {
    display: flex;
    flex-direction: column;
    gap: 16px;
    max-height: 60vh;
    overflow-y: auto;
  }

  .question-card {
    background: white;
    border: 2px solid #E5E7EB;
    border-radius: 8px;
    padding: 20px;
    transition: all 0.2s;
    position: relative;
  }

  .question-card.selected {
    border-color: #FFDD00;
    background: #FFFEF7;
  }

  .question-card.editing {
    border-color: #3B82F6;
    background: #EFF6FF;
  }

  .question-card.approved {
    border-left-color: #10B981;
    border-left-width: 4px;
  }

  .question-card.rejected {
    border-left-color: #EF4444;
    border-left-width: 4px;
  }

  .question-card.modified {
    border-left-color: #F59E0B;
    border-left-width: 4px;
  }

  .question-header {
    display: flex;
    justify-content: space-between;
    align-items: flex-start;
    margin-bottom: 16px;
    gap: 16px;
  }

  .header-left {
    display: flex;
    align-items: flex-start;
    gap: 12px;
  }

  .question-meta {
    display: flex;
    flex-wrap: wrap;
    gap: 8px;
    align-items: center;
  }

  .question-type {
    background: #F3F4F6;
    color: #333;
    padding: 2px 6px;
    border-radius: 3px;
    font-size: 0.8rem;
    font-weight: 500;
  }

  .blooms-level {
    color: white;
    padding: 2px 6px;
    border-radius: 3px;
    font-size: 0.8rem;
    font-weight: 500;
    text-transform: capitalize;
  }

  .difficulty-level {
    background: #E5E7EB;
    color: #333;
    padding: 2px 6px;
    border-radius: 3px;
    font-size: 0.8rem;
  }

  .header-right {
    display: flex;
    flex-direction: column;
    gap: 8px;
    align-items: flex-end;
  }

  .confidence-indicator {
    display: flex;
    align-items: center;
    gap: 6px;
    font-size: 0.8rem;
  }

  .confidence-label {
    color: #666;
  }

  .confidence-bar {
    width: 60px;
    height: 8px;
    background: #E5E7EB;
    border-radius: 4px;
    overflow: hidden;
  }

  .confidence-fill {
    height: 100%;
    background: linear-gradient(90deg, #EF4444 0%, #F59E0B 50%, #10B981 100%);
    transition: width 0.3s;
  }

  .confidence-value {
    font-weight: 500;
    color: #333;
  }

  .status-indicator {
    display: flex;
    align-items: center;
  }

  .status {
    padding: 2px 6px;
    border-radius: 3px;
    font-size: 0.8rem;
    font-weight: 500;
  }

  .status.pending {
    background: #FEF3C7;
    color: #92400E;
  }

  .status.approved {
    background: #ECFDF3;
    color: #065F46;
  }

  .status.rejected {
    background: #FEF2F2;
    color: #991B1B;
  }

  .status.modified {
    background: #EFF6FF;
    color: #1E40AF;
  }

  .question-content {
    margin-bottom: 16px;
  }

  .question-editor {
    background: #F9FAFB;
    border-radius: 6px;
    padding: 16px;
    border: 1px solid #E5E7EB;
  }

  .editor-field {
    margin-bottom: 12px;
  }

  .editor-field:last-of-type {
    margin-bottom: 16px;
  }

  .editor-field label {
    display: block;
    font-weight: 500;
    color: #333;
    margin-bottom: 4px;
    font-size: 0.9rem;
  }

  .editor-textarea,
  .editor-input {
    width: 100%;
    padding: 8px 12px;
    border: 1px solid #D1D5DB;
    border-radius: 4px;
    font-size: 0.9rem;
    font-family: inherit;
    resize: vertical;
  }

  .editor-textarea:focus,
  .editor-input:focus {
    outline: none;
    border-color: #3B82F6;
    box-shadow: 0 0 0 2px rgba(59, 130, 246, 0.2);
  }

  .editor-actions {
    display: flex;
    justify-content: flex-end;
    gap: 8px;
  }

  .question-display {
    display: flex;
    flex-direction: column;
    gap: 12px;
  }

  .question-text strong,
  .question-options strong,
  .question-answer strong,
  .question-explanation strong {
    color: #333;
    font-size: 0.9rem;
    display: block;
    margin-bottom: 4px;
  }

  .question-text p,
  .question-explanation p {
    margin: 0;
    color: #666;
    line-height: 1.4;
  }

  .options-list {
    display: flex;
    flex-direction: column;
    gap: 4px;
  }

  .option-item {
    display: flex;
    gap: 8px;
    align-items: flex-start;
  }

  .option-letter {
    font-weight: 500;
    color: #333;
    min-width: 20px;
  }

  .option-text {
    color: #666;
    line-height: 1.3;
  }

  .answer-text {
    color: #333;
    font-weight: 500;
  }

  .question-metadata {
    display: flex;
    flex-wrap: wrap;
    gap: 12px;
    font-size: 0.8rem;
    color: #666;
    padding: 8px;
    background: #F9FAFB;
    border-radius: 4px;
    border: 1px solid #E5E7EB;
  }

  .question-actions {
    display: flex;
    justify-content: flex-end;
    gap: 8px;
  }

  .review-summary {
    background: white;
    border: 1px solid #E5E7EB;
    border-radius: 8px;
    padding: 20px;
  }

  .review-summary h4 {
    margin: 0 0 16px 0;
    color: #333;
    font-size: 1.1rem;
  }

  .summary-stats {
    display: flex;
    justify-content: space-around;
    margin-bottom: 16px;
  }

  .stat-group {
    text-align: center;
  }

  .stat-label {
    display: block;
    font-size: 0.8rem;
    color: #666;
    margin-bottom: 4px;
  }

  .stat-value {
    display: block;
    font-size: 1.2rem;
    font-weight: 600;
    color: #333;
  }

  .stat-value.approved {
    color: #10B981;
  }

  .stat-value.pending {
    color: #F59E0B;
  }

  .stat-value.rejected {
    color: #EF4444;
  }

  .approval-progress {
    text-align: center;
  }

  .progress-bar {
    width: 100%;
    height: 8px;
    background: #E5E7EB;
    border-radius: 4px;
    overflow: hidden;
    margin-bottom: 8px;
  }

  .progress-fill {
    height: 100%;
    background: #10B981;
    transition: width 0.3s;
  }

  .progress-label {
    font-size: 0.9rem;
    color: #666;
  }

  .no-questions {
    padding: 60px 20px;
    text-align: center;
  }

  .empty-state h3 {
    margin: 0 0 16px 0;
    color: #333;
    font-size: 1.5rem;
  }

  .empty-state p {
    margin: 0 0 24px 0;
    color: #666;
    line-height: 1.5;
    max-width: 500px;
    margin-left: auto;
    margin-right: auto;
  }

  .btn {
    padding: 8px 16px;
    border-radius: 4px;
    font-weight: 500;
    cursor: pointer;
    transition: all 0.2s;
    border: 1px solid transparent;
    font-size: 0.9rem;
    text-decoration: none;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    gap: 4px;
  }

  .btn:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }

  .btn-primary {
    background: #FFDD00;
    color: #333;
    border-color: #EBCB00;
  }

  .btn-primary:hover:not(:disabled) {
    background: #EBCB00;
  }

  .btn-success {
    background: #10B981;
    color: white;
    border-color: #059669;
  }

  .btn-success:hover:not(:disabled) {
    background: #059669;
  }

  .btn-danger {
    background: #EF4444;
    color: white;
    border-color: #DC2626;
  }

  .btn-danger:hover:not(:disabled) {
    background: #DC2626;
  }

  .btn-outline {
    background: white;
    color: #666;
    border-color: #D1D5DB;
  }

  .btn-outline:hover:not(:disabled) {
    background: #F9FAFB;
    border-color: #9CA3AF;
  }

  .btn-sm {
    padding: 4px 8px;
    font-size: 0.8rem;
  }

  .btn-lg {
    padding: 12px 24px;
    font-size: 1rem;
  }

  @media (max-width: 768px) {
    .reviewer-header {
      flex-direction: column;
      gap: 16px;
    }

    .metrics-grid {
      grid-template-columns: repeat(2, 1fr);
    }

    .review-controls {
      flex-direction: column;
      gap: 16px;
    }

    .controls-left {
      width: 100%;
      justify-content: space-between;
    }

    .bulk-actions {
      flex-wrap: wrap;
    }

    .question-header {
      flex-direction: column;
      gap: 12px;
    }

    .header-left {
      width: 100%;
    }

    .question-meta {
      flex-direction: column;
      align-items: flex-start;
    }

    .confidence-indicator {
      flex-direction: column;
      align-items: flex-start;
      gap: 4px;
    }

    .question-actions {
      flex-wrap: wrap;
      justify-content: flex-start;
    }

    .summary-stats {
      flex-direction: column;
      gap: 16px;
    }
  }
`;

// Inject styles
if (typeof document !== 'undefined') {
  const styleElement = document.createElement('style');
  styleElement.textContent = styles;
  document.head.appendChild(styleElement);
}