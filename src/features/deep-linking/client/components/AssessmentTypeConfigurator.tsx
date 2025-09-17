/**
 * @fileoverview Assessment Type Configurator Component
 * Interface for selecting and configuring assessment types and AI generation settings
 * @module features/deep-linking/client/components/AssessmentTypeConfigurator
 */

import { useState, useCallback, useEffect, type ReactElement } from 'react';
import { AssessmentConfiguration, AssessmentSettings, AssessmentType, DifficultyLevel } from '../hooks/useAssessmentConfiguration';

/**
 * Component props interface
 */
interface AssessmentTypeConfiguratorProps {
  configuration: AssessmentConfiguration;
  onConfigurationChange: (updates: Partial<AssessmentConfiguration>) => void;
  canvasContentContext: {
    assignmentTitle?: string;
    courseLevel?: string;
    subject?: string;
    learningObjectives?: string[];
  };
  placementCount: number;
}

/**
 * Assessment type definition for UI display
 */
interface AssessmentTypeDefinition {
  id: AssessmentType;
  title: string;
  description: string;
  icon: string;
  examples: string[];
  defaultSettings: Partial<AssessmentSettings>;
  bloomsLevels: string[];
  timeRange: { min: number; max: number };
  difficulty: {
    beginner: string;
    intermediate: string;
    advanced: string;
  };
}

/**
 * Assessment type definitions
 */
const ASSESSMENT_TYPES: AssessmentTypeDefinition[] = [
  {
    id: 'comprehension',
    title: 'Comprehension Check',
    description: 'Test understanding of key concepts and vocabulary',
    icon: '🧠',
    examples: [
      'What is the main idea of this section?',
      'Define the term "photosynthesis"',
      'Identify the key components mentioned'
    ],
    defaultSettings: {
      masteryThreshold: 0.7,
      maxAttempts: 3,
      showHints: true,
      timeLimit: 10,
    },
    bloomsLevels: ['remember', 'understand'],
    timeRange: { min: 2, max: 10 },
    difficulty: {
      beginner: 'Basic recall and recognition questions',
      intermediate: 'Understanding and simple explanation',
      advanced: 'Complex comprehension with context'
    }
  },
  {
    id: 'application',
    title: 'Application Exercise',
    description: 'Apply learned concepts to new situations and problems',
    icon: '📝',
    examples: [
      'Calculate the area using the given formula',
      'Apply this principle to solve the problem',
      'Use the concept to analyze this scenario'
    ],
    defaultSettings: {
      masteryThreshold: 0.75,
      maxAttempts: 2,
      showHints: false,
      timeLimit: 15,
    },
    bloomsLevels: ['apply'],
    timeRange: { min: 5, max: 20 },
    difficulty: {
      beginner: 'Direct application with guidance',
      intermediate: 'Multi-step application problems',
      advanced: 'Complex scenarios requiring adaptation'
    }
  },
  {
    id: 'analysis',
    title: 'Analysis Task',
    description: 'Break down information and examine relationships',
    icon: '🔍',
    examples: [
      'Compare and contrast these two theories',
      'Analyze the cause and effect relationships',
      'Identify patterns in the data'
    ],
    defaultSettings: {
      masteryThreshold: 0.8,
      maxAttempts: 2,
      showHints: false,
      timeLimit: 20,
    },
    bloomsLevels: ['analyze'],
    timeRange: { min: 10, max: 30 },
    difficulty: {
      beginner: 'Simple categorization and sorting',
      intermediate: 'Multi-factor analysis',
      advanced: 'Complex system analysis'
    }
  },
  {
    id: 'reflection',
    title: 'Reflection Prompt',
    description: 'Encourage deeper thinking and personal connections',
    icon: '💭',
    examples: [
      'How does this relate to your experience?',
      'What questions does this raise for you?',
      'Reflect on the implications of this concept'
    ],
    defaultSettings: {
      masteryThreshold: 0.6,
      maxAttempts: 1,
      showHints: false,
      timeLimit: 0, // No time limit for reflection
    },
    bloomsLevels: ['understand', 'analyze', 'evaluate'],
    timeRange: { min: 5, max: 30 },
    difficulty: {
      beginner: 'Personal connection questions',
      intermediate: 'Structured reflection with prompts',
      advanced: 'Critical reflection and evaluation'
    }
  },
  {
    id: 'knowledge_check',
    title: 'Knowledge Check',
    description: 'Quick verification of key facts and details',
    icon: '✅',
    examples: [
      'True or false: Mitochondria produce ATP',
      'Which of these is NOT a primary color?',
      'Fill in the blank: Water boils at ___ degrees'
    ],
    defaultSettings: {
      masteryThreshold: 0.85,
      maxAttempts: 2,
      showHints: true,
      timeLimit: 5,
    },
    bloomsLevels: ['remember'],
    timeRange: { min: 1, max: 5 },
    difficulty: {
      beginner: 'Simple fact recall',
      intermediate: 'Multiple concepts integration',
      advanced: 'Detailed knowledge with nuances'
    }
  }
];

/**
 * Difficulty level definitions
 */
const DIFFICULTY_LEVELS: Record<DifficultyLevel, { label: string; description: string; color: string }> = {
  beginner: {
    label: 'Beginner',
    description: 'Introductory level, focusing on basic concepts',
    color: '#22C55E'
  },
  intermediate: {
    label: 'Intermediate',
    description: 'Moderate difficulty, building on fundamentals',
    color: '#F59E0B'
  },
  advanced: {
    label: 'Advanced',
    description: 'Complex scenarios requiring deep understanding',
    color: '#EF4444'
  }
};

/**
 * Assessment Type Configurator Component
 *
 * Provides interface for selecting assessment types and configuring AI generation settings.
 * Includes difficulty adjustment, mastery criteria, and context-aware recommendations.
 */
export function AssessmentTypeConfigurator({
  configuration,
  onConfigurationChange,
  canvasContentContext,
  placementCount,
}: AssessmentTypeConfiguratorProps): ReactElement {
  // State
  const [selectedType, setSelectedType] = useState<AssessmentType | null>(
    configuration.settings.assessmentType || null
  );
  const [previewQuestions, setPreviewQuestions] = useState<string[]>([]);
  const [isGeneratingPreview, setIsGeneratingPreview] = useState(false);
  const [showAdvancedSettings, setShowAdvancedSettings] = useState(false);

  // Get current type definition
  const currentTypeDefinition = selectedType
    ? ASSESSMENT_TYPES.find(type => type.id === selectedType)
    : null;

  /**
   * Handle assessment type selection
   */
  const handleTypeSelect = useCallback((typeId: AssessmentType) => {
    const typeDefinition = ASSESSMENT_TYPES.find(type => type.id === typeId);
    if (!typeDefinition) return;

    setSelectedType(typeId);

    // Update configuration with type and recommended settings
    const updatedSettings: Partial<AssessmentSettings> = {
      ...configuration.settings,
      assessmentType: typeId,
      ...typeDefinition.defaultSettings,
    };

    onConfigurationChange({
      settings: updatedSettings as AssessmentSettings,
    });

    // Clear preview when changing types
    setPreviewQuestions([]);
  }, [configuration.settings, onConfigurationChange]);

  /**
   * Handle settings update
   */
  const handleSettingsUpdate = useCallback((updates: Partial<AssessmentSettings>) => {
    onConfigurationChange({
      settings: {
        ...configuration.settings,
        ...updates,
      },
    });
  }, [configuration.settings, onConfigurationChange]);

  /**
   * Generate preview questions
   */
  const generatePreview = useCallback(async () => {
    if (!selectedType || !currentTypeDefinition) return;

    setIsGeneratingPreview(true);
    try {
      // Simulate AI question generation for preview
      const examples = currentTypeDefinition.examples;
      const contextualExamples = [
        ...examples,
        ...(canvasContentContext.assignmentTitle
          ? [`How does this apply to "${canvasContentContext.assignmentTitle}"?`]
          : []
        ),
        ...(canvasContentContext.learningObjectives?.length
          ? [`Explain how this relates to: ${canvasContentContext.learningObjectives[0]}`]
          : []
        )
      ];

      // Simulate delay for realistic preview
      await new Promise(resolve => setTimeout(resolve, 1500));

      setPreviewQuestions(contextualExamples.slice(0, 3));
    } catch (error) {
      console.error('Preview generation failed:', error);
    } finally {
      setIsGeneratingPreview(false);
    }
  }, [selectedType, currentTypeDefinition, canvasContentContext]);

  /**
   * Get recommendation message based on context
   */
  const getRecommendationMessage = useCallback((): string | null => {
    if (!canvasContentContext.courseLevel && !canvasContentContext.subject) {
      return null;
    }

    const level = canvasContentContext.courseLevel?.toLowerCase();
    const subject = canvasContentContext.subject?.toLowerCase();

    if (level === 'introductory' || level === 'beginner') {
      return 'For introductory courses, Comprehension Checks and Knowledge Checks work well to build foundational understanding.';
    }

    if (level === 'advanced' || level === 'graduate') {
      return 'Advanced courses benefit from Analysis Tasks and Reflection Prompts that encourage critical thinking.';
    }

    if (subject?.includes('math') || subject?.includes('science')) {
      return 'STEM subjects often benefit from Application Exercises that let students practice problem-solving.';
    }

    if (subject?.includes('literature') || subject?.includes('history') || subject?.includes('philosophy')) {
      return 'Humanities subjects work well with Analysis Tasks and Reflection Prompts for deeper exploration.';
    }

    return null;
  }, [canvasContentContext]);

  /**
   * Calculate estimated total time
   */
  const calculateTotalTime = useCallback((): number => {
    if (!currentTypeDefinition || !configuration.settings.assessmentType) {
      return 0;
    }

    const baseTime = currentTypeDefinition.timeRange.min;
    const difficultyMultiplier = configuration.settings.difficulty === 'advanced' ? 1.5
      : configuration.settings.difficulty === 'intermediate' ? 1.2 : 1.0;

    return Math.ceil(baseTime * difficultyMultiplier * placementCount);
  }, [currentTypeDefinition, configuration.settings, placementCount]);

  // Auto-generate preview when type or settings change
  useEffect(() => {
    if (selectedType && !isGeneratingPreview) {
      const timeoutId = setTimeout(generatePreview, 500);
      return () => clearTimeout(timeoutId);
    }
  }, [selectedType, configuration.settings.difficulty, generatePreview, isGeneratingPreview]);

  return (
    <div className="assessment-type-configurator">
      {/* Header */}
      <div className="configurator-header">
        <h3>🎯 Assessment Type Configuration</h3>
        <p>Select assessment types and configure AI generation settings for your checkpoints.</p>

        {/* Context Info */}
        {canvasContentContext.assignmentTitle && (
          <div className="context-info">
            <h4>📚 Canvas Assignment: {canvasContentContext.assignmentTitle}</h4>
            <div className="context-details">
              {canvasContentContext.courseLevel && (
                <span className="context-tag">📈 {canvasContentContext.courseLevel}</span>
              )}
              {canvasContentContext.subject && (
                <span className="context-tag">📖 {canvasContentContext.subject}</span>
              )}
              <span className="context-tag">📍 {placementCount} placements</span>
            </div>
          </div>
        )}

        {/* Recommendation */}
        {getRecommendationMessage() && (
          <div className="recommendation-banner">
            <span className="recommendation-icon">💡</span>
            <span className="recommendation-text">{getRecommendationMessage()}</span>
          </div>
        )}
      </div>

      {/* Assessment Type Selection */}
      <div className="type-selection">
        <h4>Choose Assessment Type</h4>
        <div className="type-cards">
          {ASSESSMENT_TYPES.map(type => (
            <div
              key={type.id}
              className={`type-card ${selectedType === type.id ? 'selected' : ''}`}
              onClick={() => handleTypeSelect(type.id)}
              role="button"
              tabIndex={0}
              aria-pressed={selectedType === type.id}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault();
                  handleTypeSelect(type.id);
                }
              }}
            >
              <div className="type-header">
                <span className="type-icon">{type.icon}</span>
                <h5 className="type-title">{type.title}</h5>
                {selectedType === type.id && (
                  <span className="selected-indicator">✓</span>
                )}
              </div>

              <p className="type-description">{type.description}</p>

              <div className="type-meta">
                <span className="time-range">
                  ⏱️ {type.timeRange.min}-{type.timeRange.max} min
                </span>
                <span className="blooms-levels">
                  🎯 {type.bloomsLevels.join(', ')}
                </span>
              </div>

              {selectedType === type.id && (
                <div className="type-examples">
                  <strong>Example Questions:</strong>
                  <ul>
                    {type.examples.slice(0, 2).map((example, index) => (
                      <li key={index}>{example}</li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* Configuration Settings */}
      {selectedType && currentTypeDefinition && (
        <div className="configuration-settings">
          <h4>⚙️ Assessment Configuration</h4>

          {/* Difficulty Level */}
          <div className="setting-group">
            <label className="setting-label">
              Difficulty Level
              <span className="setting-description">
                Adjusts question complexity and cognitive load
              </span>
            </label>

            <div className="difficulty-selector">
              {Object.entries(DIFFICULTY_LEVELS).map(([level, info]) => (
                <div
                  key={level}
                  className={`difficulty-option ${
                    configuration.settings.difficulty === level ? 'selected' : ''
                  }`}
                  onClick={() => handleSettingsUpdate({ difficulty: level as DifficultyLevel })}
                  role="button"
                  tabIndex={0}
                  aria-pressed={configuration.settings.difficulty === level}
                >
                  <div className="difficulty-header">
                    <span
                      className="difficulty-indicator"
                      style={{ backgroundColor: info.color }}
                    />
                    <span className="difficulty-label">{info.label}</span>
                  </div>
                  <p className="difficulty-description">{info.description}</p>
                  {configuration.settings.difficulty === level && (
                    <p className="difficulty-context">
                      {currentTypeDefinition.difficulty[level as DifficultyLevel]}
                    </p>
                  )}
                </div>
              ))}
            </div>
          </div>

          {/* Mastery Threshold */}
          <div className="setting-group">
            <label className="setting-label">
              Mastery Threshold
              <span className="setting-description">
                Minimum score required to pass the assessment
              </span>
            </label>

            <div className="threshold-slider">
              <input
                type="range"
                min="50"
                max="95"
                step="5"
                value={(configuration.settings.masteryThreshold || 0.75) * 100}
                onChange={(e) => handleSettingsUpdate({
                  masteryThreshold: parseInt(e.target.value) / 100
                })}
                className="slider"
              />
              <div className="threshold-display">
                <span className="threshold-value">
                  {Math.round((configuration.settings.masteryThreshold || 0.75) * 100)}%
                </span>
                <span className="threshold-label">
                  {(configuration.settings.masteryThreshold || 0.75) >= 0.85 ? 'High' :
                   (configuration.settings.masteryThreshold || 0.75) >= 0.70 ? 'Medium' : 'Low'}
                </span>
              </div>
            </div>
          </div>

          {/* Basic Settings Row */}
          <div className="settings-row">
            <div className="setting-group">
              <label className="setting-label">Max Attempts</label>
              <select
                value={configuration.settings.maxAttempts || 3}
                onChange={(e) => handleSettingsUpdate({
                  maxAttempts: parseInt(e.target.value)
                })}
                className="setting-select"
              >
                <option value={1}>1 attempt</option>
                <option value={2}>2 attempts</option>
                <option value={3}>3 attempts</option>
                <option value={5}>5 attempts</option>
                <option value={0}>Unlimited</option>
              </select>
            </div>

            <div className="setting-group">
              <label className="setting-label">Time Limit</label>
              <select
                value={configuration.settings.timeLimit || 0}
                onChange={(e) => handleSettingsUpdate({
                  timeLimit: parseInt(e.target.value)
                })}
                className="setting-select"
              >
                <option value={0}>No limit</option>
                <option value={5}>5 minutes</option>
                <option value={10}>10 minutes</option>
                <option value={15}>15 minutes</option>
                <option value={20}>20 minutes</option>
                <option value={30}>30 minutes</option>
              </select>
            </div>

            <div className="setting-group">
              <label className="checkbox-label">
                <input
                  type="checkbox"
                  checked={configuration.settings.showHints || false}
                  onChange={(e) => handleSettingsUpdate({
                    showHints: e.target.checked
                  })}
                />
                Show hints
              </label>
            </div>
          </div>

          {/* Advanced Settings Toggle */}
          <div className="advanced-toggle">
            <button
              onClick={() => setShowAdvancedSettings(!showAdvancedSettings)}
              className="btn btn-outline"
            >
              {showAdvancedSettings ? '△' : '▽'} Advanced Settings
            </button>
          </div>

          {/* Advanced Settings */}
          {showAdvancedSettings && (
            <div className="advanced-settings">
              <div className="settings-row">
                <div className="setting-group">
                  <label className="checkbox-label">
                    <input
                      type="checkbox"
                      checked={configuration.settings.showFeedback !== false}
                      onChange={(e) => handleSettingsUpdate({
                        showFeedback: e.target.checked
                      })}
                    />
                    Show immediate feedback
                  </label>
                </div>

                <div className="setting-group">
                  <label className="checkbox-label">
                    <input
                      type="checkbox"
                      checked={configuration.settings.shuffleQuestions || false}
                      onChange={(e) => handleSettingsUpdate({
                        shuffleQuestions: e.target.checked
                      })}
                    />
                    Shuffle question order
                  </label>
                </div>

                <div className="setting-group">
                  <label className="checkbox-label">
                    <input
                      type="checkbox"
                      checked={configuration.settings.passbackGrades !== false}
                      onChange={(e) => handleSettingsUpdate({
                        passbackGrades: e.target.checked
                      })}
                    />
                    Pass grades back to Canvas
                  </label>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Preview Section */}
      {selectedType && currentTypeDefinition && (
        <div className="preview-section">
          <div className="preview-header">
            <h4>👀 Assessment Preview</h4>
            <button
              onClick={generatePreview}
              disabled={isGeneratingPreview}
              className="btn btn-outline btn-sm"
            >
              {isGeneratingPreview ? '⟳ Generating...' : '🔄 Refresh Preview'}
            </button>
          </div>

          {isGeneratingPreview ? (
            <div className="preview-loading">
              <div className="loading-spinner"></div>
              <p>Generating preview questions based on your Canvas content...</p>
            </div>
          ) : previewQuestions.length > 0 ? (
            <div className="preview-questions">
              <p className="preview-description">
                Sample questions that might be generated for this assessment type:
              </p>
              <ul className="question-list">
                {previewQuestions.map((question, index) => (
                  <li key={index} className="preview-question">
                    <span className="question-number">{index + 1}</span>
                    <span className="question-text">{question}</span>
                  </li>
                ))}
              </ul>
              <p className="preview-note">
                ℹ️ Actual questions will be tailored to your specific Canvas content.
              </p>
            </div>
          ) : (
            <div className="preview-empty">
              <p>Click "Refresh Preview" to see sample questions for this assessment type.</p>
            </div>
          )}
        </div>
      )}

      {/* Summary */}
      {selectedType && (
        <div className="configuration-summary">
          <h4>📊 Configuration Summary</h4>
          <div className="summary-grid">
            <div className="summary-item">
              <span className="summary-label">Assessment Type:</span>
              <span className="summary-value">
                {currentTypeDefinition?.icon} {currentTypeDefinition?.title}
              </span>
            </div>

            <div className="summary-item">
              <span className="summary-label">Difficulty:</span>
              <span className="summary-value">
                {DIFFICULTY_LEVELS[configuration.settings.difficulty || 'intermediate'].label}
              </span>
            </div>

            <div className="summary-item">
              <span className="summary-label">Mastery Threshold:</span>
              <span className="summary-value">
                {Math.round((configuration.settings.masteryThreshold || 0.75) * 100)}%
              </span>
            </div>

            <div className="summary-item">
              <span className="summary-label">Max Attempts:</span>
              <span className="summary-value">
                {configuration.settings.maxAttempts === 0 ? 'Unlimited' : configuration.settings.maxAttempts}
              </span>
            </div>

            <div className="summary-item">
              <span className="summary-label">Time Limit:</span>
              <span className="summary-value">
                {configuration.settings.timeLimit === 0 ? 'No limit' : `${configuration.settings.timeLimit} min`}
              </span>
            </div>

            <div className="summary-item">
              <span className="summary-label">Estimated Total Time:</span>
              <span className="summary-value">
                ~{calculateTotalTime()} minutes
              </span>
            </div>
          </div>
        </div>
      )}

      {/* Learning Objectives Alignment */}
      {canvasContentContext.learningObjectives && canvasContentContext.learningObjectives.length > 0 && (
        <div className="objectives-alignment">
          <h4>🎯 Learning Objectives Alignment</h4>
          <p>This assessment type will help evaluate these learning objectives:</p>
          <ul className="objectives-list">
            {canvasContentContext.learningObjectives.map((objective, index) => (
              <li key={index} className="objective-item">
                <span className="objective-icon">
                  {selectedType === 'comprehension' ? '🧠' :
                   selectedType === 'application' ? '📝' :
                   selectedType === 'analysis' ? '🔍' :
                   selectedType === 'reflection' ? '💭' : '✅'}
                </span>
                <span className="objective-text">{objective}</span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

/**
 * CSS styles for assessment type configurator
 */
const styles = `
  .assessment-type-configurator {
    display: flex;
    flex-direction: column;
    gap: 24px;
    padding: 20px;
  }

  .configurator-header {
    margin-bottom: 4px;
  }

  .configurator-header h3 {
    margin: 0 0 8px 0;
    color: #333;
    font-size: 1.25rem;
  }

  .configurator-header > p {
    margin: 0 0 16px 0;
    color: #666;
    font-size: 0.9rem;
  }

  .context-info {
    background: #EFF6FF;
    border: 1px solid #BFDBFE;
    border-radius: 6px;
    padding: 12px;
    margin-bottom: 16px;
  }

  .context-info h4 {
    margin: 0 0 8px 0;
    color: #1E40AF;
    font-size: 1rem;
  }

  .context-details {
    display: flex;
    gap: 8px;
    flex-wrap: wrap;
  }

  .context-tag {
    background: #DBEAFE;
    color: #1E40AF;
    padding: 2px 6px;
    border-radius: 3px;
    font-size: 0.8rem;
  }

  .recommendation-banner {
    background: #FEF3C7;
    border: 1px solid #F59E0B;
    border-radius: 6px;
    padding: 12px;
    display: flex;
    align-items: flex-start;
    gap: 8px;
  }

  .recommendation-icon {
    font-size: 1.2rem;
    flex-shrink: 0;
  }

  .recommendation-text {
    color: #92400E;
    font-size: 0.9rem;
    line-height: 1.4;
  }

  .type-selection h4 {
    margin: 0 0 16px 0;
    color: #333;
    font-size: 1.1rem;
  }

  .type-cards {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(280px, 1fr));
    gap: 16px;
  }

  .type-card {
    background: white;
    border: 2px solid #E5E7EB;
    border-radius: 8px;
    padding: 16px;
    cursor: pointer;
    transition: all 0.2s;
    position: relative;
  }

  .type-card:hover {
    border-color: #FFDD00;
    box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
  }

  .type-card.selected {
    border-color: #FFDD00;
    background: #FFFEF7;
    box-shadow: 0 4px 12px rgba(255, 221, 0, 0.2);
  }

  .type-header {
    display: flex;
    align-items: center;
    gap: 8px;
    margin-bottom: 8px;
  }

  .type-icon {
    font-size: 1.5rem;
  }

  .type-title {
    margin: 0;
    color: #333;
    font-size: 1rem;
    font-weight: 600;
    flex: 1;
  }

  .selected-indicator {
    background: #FFDD00;
    color: #333;
    font-weight: bold;
    width: 20px;
    height: 20px;
    border-radius: 50%;
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 0.8rem;
  }

  .type-description {
    margin: 0 0 12px 0;
    color: #666;
    font-size: 0.9rem;
    line-height: 1.4;
  }

  .type-meta {
    display: flex;
    gap: 12px;
    margin-bottom: 12px;
    font-size: 0.8rem;
    color: #666;
  }

  .type-examples {
    background: #F9FAFB;
    border-radius: 4px;
    padding: 8px;
    margin-top: 12px;
  }

  .type-examples strong {
    color: #333;
    font-size: 0.85rem;
    display: block;
    margin-bottom: 4px;
  }

  .type-examples ul {
    margin: 0;
    padding-left: 16px;
  }

  .type-examples li {
    font-size: 0.8rem;
    color: #666;
    margin-bottom: 2px;
    line-height: 1.3;
  }

  .configuration-settings {
    background: white;
    border: 1px solid #E5E7EB;
    border-radius: 8px;
    padding: 20px;
  }

  .configuration-settings h4 {
    margin: 0 0 20px 0;
    color: #333;
    font-size: 1.1rem;
  }

  .setting-group {
    margin-bottom: 20px;
  }

  .setting-label {
    display: block;
    font-weight: 600;
    color: #333;
    margin-bottom: 8px;
    font-size: 0.9rem;
  }

  .setting-description {
    display: block;
    font-weight: 400;
    color: #666;
    font-size: 0.8rem;
    margin-top: 2px;
  }

  .difficulty-selector {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
    gap: 12px;
  }

  .difficulty-option {
    border: 2px solid #E5E7EB;
    border-radius: 6px;
    padding: 12px;
    cursor: pointer;
    transition: all 0.2s;
  }

  .difficulty-option:hover {
    border-color: #D1D5DB;
  }

  .difficulty-option.selected {
    border-color: #FFDD00;
    background: #FFFEF7;
  }

  .difficulty-header {
    display: flex;
    align-items: center;
    gap: 8px;
    margin-bottom: 4px;
  }

  .difficulty-indicator {
    width: 12px;
    height: 12px;
    border-radius: 50%;
  }

  .difficulty-label {
    font-weight: 600;
    color: #333;
    font-size: 0.9rem;
  }

  .difficulty-description {
    margin: 0 0 8px 0;
    color: #666;
    font-size: 0.8rem;
    line-height: 1.3;
  }

  .difficulty-context {
    margin: 0;
    color: #333;
    font-size: 0.8rem;
    font-style: italic;
    background: #F9FAFB;
    padding: 4px 6px;
    border-radius: 3px;
  }

  .threshold-slider {
    display: flex;
    align-items: center;
    gap: 16px;
  }

  .slider {
    flex: 1;
    height: 6px;
    border-radius: 3px;
    background: #E5E7EB;
    outline: none;
    -webkit-appearance: none;
  }

  .slider::-webkit-slider-thumb {
    -webkit-appearance: none;
    appearance: none;
    width: 20px;
    height: 20px;
    border-radius: 50%;
    background: #FFDD00;
    border: 2px solid #EBCB00;
    cursor: pointer;
  }

  .slider::-moz-range-thumb {
    width: 20px;
    height: 20px;
    border-radius: 50%;
    background: #FFDD00;
    border: 2px solid #EBCB00;
    cursor: pointer;
  }

  .threshold-display {
    display: flex;
    flex-direction: column;
    align-items: center;
    min-width: 60px;
  }

  .threshold-value {
    font-weight: 600;
    color: #333;
    font-size: 1rem;
  }

  .threshold-label {
    font-size: 0.8rem;
    color: #666;
  }

  .settings-row {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
    gap: 16px;
    margin-bottom: 16px;
  }

  .setting-select {
    padding: 8px 12px;
    border: 1px solid #D1D5DB;
    border-radius: 4px;
    font-size: 0.9rem;
    background: white;
  }

  .setting-select:focus {
    outline: none;
    border-color: #FFDD00;
    box-shadow: 0 0 0 2px rgba(255, 221, 0, 0.2);
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

  .advanced-toggle {
    text-align: center;
    margin: 16px 0;
  }

  .advanced-settings {
    background: #F9FAFB;
    border-radius: 6px;
    padding: 16px;
    border: 1px solid #E5E7EB;
  }

  .preview-section {
    background: white;
    border: 1px solid #E5E7EB;
    border-radius: 8px;
    padding: 20px;
  }

  .preview-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 16px;
  }

  .preview-header h4 {
    margin: 0;
    color: #333;
    font-size: 1.1rem;
  }

  .preview-loading {
    text-align: center;
    padding: 40px;
    color: #666;
  }

  .loading-spinner {
    width: 32px;
    height: 32px;
    border: 3px solid #E5E7EB;
    border-top: 3px solid #FFDD00;
    border-radius: 50%;
    animation: spin 1s linear infinite;
    margin: 0 auto 16px;
  }

  @keyframes spin {
    0% { transform: rotate(0deg); }
    100% { transform: rotate(360deg); }
  }

  .preview-questions {
    background: #F9FAFB;
    border-radius: 6px;
    padding: 16px;
  }

  .preview-description {
    margin: 0 0 12px 0;
    color: #666;
    font-size: 0.9rem;
  }

  .question-list {
    list-style: none;
    margin: 0 0 12px 0;
    padding: 0;
  }

  .preview-question {
    display: flex;
    align-items: flex-start;
    gap: 8px;
    margin-bottom: 8px;
    padding: 8px;
    background: white;
    border-radius: 4px;
    border: 1px solid #E5E7EB;
  }

  .question-number {
    background: #FFDD00;
    color: #333;
    font-weight: 600;
    width: 20px;
    height: 20px;
    border-radius: 50%;
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 0.8rem;
    flex-shrink: 0;
  }

  .question-text {
    color: #333;
    font-size: 0.9rem;
    line-height: 1.4;
  }

  .preview-note {
    margin: 0;
    color: #666;
    font-size: 0.8rem;
    font-style: italic;
  }

  .preview-empty {
    text-align: center;
    padding: 40px;
    color: #666;
  }

  .configuration-summary {
    background: #F3F4F6;
    border-radius: 8px;
    padding: 20px;
  }

  .configuration-summary h4 {
    margin: 0 0 16px 0;
    color: #333;
    font-size: 1.1rem;
  }

  .summary-grid {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
    gap: 12px;
  }

  .summary-item {
    background: white;
    border-radius: 4px;
    padding: 8px 12px;
    border: 1px solid #E5E7EB;
  }

  .summary-label {
    display: block;
    font-size: 0.8rem;
    color: #666;
    margin-bottom: 2px;
  }

  .summary-value {
    display: block;
    font-weight: 600;
    color: #333;
    font-size: 0.9rem;
  }

  .objectives-alignment {
    background: #ECFDF3;
    border: 1px solid #BBF7D0;
    border-radius: 8px;
    padding: 20px;
  }

  .objectives-alignment h4 {
    margin: 0 0 8px 0;
    color: #065F46;
    font-size: 1.1rem;
  }

  .objectives-alignment > p {
    margin: 0 0 12px 0;
    color: #047857;
    font-size: 0.9rem;
  }

  .objectives-list {
    list-style: none;
    margin: 0;
    padding: 0;
  }

  .objective-item {
    display: flex;
    align-items: flex-start;
    gap: 8px;
    margin-bottom: 8px;
    padding: 6px;
    background: white;
    border-radius: 4px;
    border: 1px solid #BBF7D0;
  }

  .objective-icon {
    font-size: 1rem;
    flex-shrink: 0;
  }

  .objective-text {
    color: #065F46;
    font-size: 0.9rem;
    line-height: 1.4;
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

  @media (max-width: 768px) {
    .type-cards {
      grid-template-columns: 1fr;
    }

    .difficulty-selector {
      grid-template-columns: 1fr;
    }

    .settings-row {
      grid-template-columns: 1fr;
    }

    .summary-grid {
      grid-template-columns: 1fr;
    }

    .preview-header {
      flex-direction: column;
      gap: 12px;
      align-items: flex-start;
    }

    .threshold-slider {
      flex-direction: column;
      gap: 8px;
    }
  }
`;

// Inject styles
if (typeof document !== 'undefined') {
  const styleElement = document.createElement('style');
  styleElement.textContent = styles;
  document.head.appendChild(styleElement);
}