/**
 * @fileoverview Content Placement Selector Component
 * Interactive interface for selecting assessment checkpoint locations within Canvas content
 * @module features/deep-linking/client/components/ContentPlacementSelector
 */

import { useState, useEffect, useCallback, useRef, type ReactElement } from 'react';
import { ContentStructure, getPlacementSuitableSections } from '../hooks/useCanvasAssignmentContext';
import { AssessmentPlacement, AssessmentType } from '../hooks/useAssessmentConfiguration';

/**
 * Component props interface
 */
interface ContentPlacementSelectorProps {
  canvasContent: ContentStructure | null;
  existingPlacements: AssessmentPlacement[];
  onPlacementAdd: (placement: Omit<AssessmentPlacement, 'id' | 'order'>) => void;
  onPlacementUpdate: (id: string, updates: Partial<AssessmentPlacement>) => void;
  onPlacementRemove: (id: string) => void;
  maxPlacements?: number;
}

/**
 * Placement draft interface for the creation flow
 */
interface PlacementDraft {
  contentSelector: string;
  position: 'before' | 'after' | 'inline';
  coordinates: { x: number; y: number };
  assessmentType: AssessmentType;
  title: string;
  description?: string;
  estimatedTime: number;
  sectionId: string;
  sectionTitle: string;
}

/**
 * Placement marker interface for visual representation
 */
interface PlacementMarker {
  id: string;
  sectionId: string;
  position: 'before' | 'after' | 'inline';
  coordinates: { x: number; y: number };
  assessmentType: AssessmentType;
  title: string;
  isActive: boolean;
  isDraft: boolean;
}

/**
 * Content Placement Selector Component
 *
 * Provides an interactive interface for instructors to select specific locations
 * within Canvas assignment content where assessment checkpoints should be placed.
 *
 * Features:
 * - Visual content structure display
 * - Drag-and-drop placement markers
 * - Multiple placement types (before, after, inline)
 * - Assessment type selection per placement
 * - Real-time validation and conflict detection
 */
export function ContentPlacementSelector({
  canvasContent,
  existingPlacements,
  onPlacementAdd,
  onPlacementUpdate,
  onPlacementRemove,
  maxPlacements = 10,
}: ContentPlacementSelectorProps): ReactElement {
  // State management
  const [selectedSectionId, setSelectedSectionId] = useState<string | null>(null);
  const [placementDraft, setPlacementDraft] = useState<PlacementDraft | null>(null);
  const [isPlacementMode, setIsPlacementMode] = useState(false);
  const [zoomLevel, setZoomLevel] = useState(1.0);
  const [showAllSections, setShowAllSections] = useState(false);
  const [highlightConflicts, setHighlightConflicts] = useState(true);

  // Refs
  const contentViewRef = useRef<HTMLDivElement>(null);
  const placementFormRef = useRef<HTMLDivElement>(null);

  // Get suitable sections for placement
  const suitableSections = canvasContent ? getPlacementSuitableSections(canvasContent) : [];

  // Create placement markers for visualization
  const placementMarkers: PlacementMarker[] = existingPlacements.map(placement => ({
    id: placement.id,
    sectionId: placement.contentSelector,
    position: placement.position,
    coordinates: placement.coordinates,
    assessmentType: placement.assessmentType,
    title: placement.title,
    isActive: placement.id === selectedSectionId,
    isDraft: false,
  }));

  // Add draft marker if creating new placement
  if (placementDraft) {
    placementMarkers.push({
      id: 'draft',
      sectionId: placementDraft.sectionId,
      position: placementDraft.position,
      coordinates: placementDraft.coordinates,
      assessmentType: placementDraft.assessmentType,
      title: placementDraft.title,
      isActive: true,
      isDraft: true,
    });
  }

  /**
   * Handle section click for placement creation
   */
  const handleSectionClick = useCallback((
    sectionId: string,
    sectionTitle: string,
    event: React.MouseEvent
  ) => {
    if (!isPlacementMode) {
      setSelectedSectionId(sectionId);
      return;
    }

    // Calculate relative coordinates within the section
    const rect = (event.currentTarget as HTMLElement).getBoundingClientRect();
    const x = event.clientX - rect.left;
    const y = event.clientY - rect.top;

    // Create new placement draft
    setPlacementDraft({
      contentSelector: sectionId,
      position: 'after',
      coordinates: { x, y },
      assessmentType: 'comprehension',
      title: `Assessment for ${sectionTitle}`,
      description: '',
      estimatedTime: 5,
      sectionId,
      sectionTitle,
    });

    setSelectedSectionId(sectionId);
    setIsPlacementMode(false);

    // Scroll to placement form
    setTimeout(() => {
      placementFormRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }, 100);
  }, [isPlacementMode]);

  /**
   * Handle placement marker drag
   */
  const handleMarkerDrag = useCallback((
    markerId: string,
    newCoordinates: { x: number; y: number }
  ) => {
    if (markerId === 'draft' && placementDraft) {
      setPlacementDraft({
        ...placementDraft,
        coordinates: newCoordinates,
      });
    } else {
      onPlacementUpdate(markerId, { coordinates: newCoordinates });
    }
  }, [placementDraft, onPlacementUpdate]);

  /**
   * Handle placement form submission
   */
  const handlePlacementSubmit = useCallback(() => {
    if (!placementDraft) return;

    onPlacementAdd({
      contentSelector: placementDraft.contentSelector,
      position: placementDraft.position,
      coordinates: placementDraft.coordinates,
      assessmentType: placementDraft.assessmentType,
      title: placementDraft.title,
      description: placementDraft.description || '',
      estimatedTime: placementDraft.estimatedTime,
    });

    setPlacementDraft(null);
    setSelectedSectionId(null);
  }, [placementDraft, onPlacementAdd]);

  /**
   * Handle placement cancellation
   */
  const handlePlacementCancel = useCallback(() => {
    setPlacementDraft(null);
    setSelectedSectionId(null);
    setIsPlacementMode(false);
  }, []);

  /**
   * Check for placement conflicts
   */
  const getPlacementConflicts = useCallback((sectionId: string, position: 'before' | 'after' | 'inline') => {
    return existingPlacements.filter(
      placement => placement.contentSelector === sectionId && placement.position === position
    );
  }, [existingPlacements]);

  /**
   * Get assessment type icon
   */
  const getAssessmentTypeIcon = (type: AssessmentType): string => {
    switch (type) {
      case 'comprehension': return '🧠';
      case 'application': return '📝';
      case 'analysis': return '🔍';
      case 'reflection': return '💭';
      case 'knowledge_check': return '✅';
      default: return '📋';
    }
  };

  /**
   * Format section text for display
   */
  const formatSectionText = (text: string, maxLength: number = 100): string => {
    if (text.length <= maxLength) return text;
    return text.substring(0, maxLength) + '...';
  };

  /**
   * Handle zoom controls
   */
  const handleZoom = (delta: number) => {
    const newZoom = Math.max(0.5, Math.min(2.0, zoomLevel + delta));
    setZoomLevel(newZoom);
  };

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        handlePlacementCancel();
      }
      if (event.key === '+' && event.ctrlKey) {
        event.preventDefault();
        handleZoom(0.1);
      }
      if (event.key === '-' && event.ctrlKey) {
        event.preventDefault();
        handleZoom(-0.1);
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [handlePlacementCancel]);

  // No content state
  if (!canvasContent) {
    return (
      <div className="content-placement-selector no-content">
        <div className="empty-state">
          <h3>📄 No Canvas Content Available</h3>
          <p>Canvas assignment content must be loaded before selecting assessment placements.</p>
          <p>Please ensure the Canvas assignment has content and try refreshing.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="content-placement-selector">
      {/* Controls Header */}
      <div className="controls-header">
        <div className="header-info">
          <h3>📍 Assessment Placement Selection</h3>
          <p>
            Click on content sections below to place assessment checkpoints.
            You can place up to {maxPlacements} assessments per assignment.
          </p>
          <div className="placement-stats">
            <span className="stat">
              📊 Placements: {existingPlacements.length}/{maxPlacements}
            </span>
            <span className="stat">
              📝 Sections Available: {suitableSections.length}
            </span>
          </div>
        </div>

        <div className="controls-actions">
          <div className="zoom-controls">
            <button
              onClick={() => handleZoom(-0.1)}
              className="btn btn-outline btn-sm"
              disabled={zoomLevel <= 0.5}
            >
              🔍−
            </button>
            <span className="zoom-level">{Math.round(zoomLevel * 100)}%</span>
            <button
              onClick={() => handleZoom(0.1)}
              className="btn btn-outline btn-sm"
              disabled={zoomLevel >= 2.0}
            >
              🔍+
            </button>
          </div>

          <button
            onClick={() => setIsPlacementMode(!isPlacementMode)}
            className={`btn ${isPlacementMode ? 'btn-secondary' : 'btn-primary'}`}
            disabled={existingPlacements.length >= maxPlacements}
          >
            {isPlacementMode ? '❌ Cancel Placement' : '➕ Add Assessment'}
          </button>
        </div>
      </div>

      {/* Content Structure View */}
      <div
        ref={contentViewRef}
        className="content-structure-view"
        style={{ transform: `scale(${zoomLevel})`, transformOrigin: 'top left' }}
      >
        <div className="content-header">
          <h4>📚 {canvasContent.title}</h4>
          <div className="content-meta">
            <span>📊 {canvasContent.sections.length} sections</span>
            <span>⏱️ {canvasContent.metadata.estimatedReadingTime} min read</span>
            <span>📈 {canvasContent.metadata.complexity || 'Unknown'} level</span>
          </div>
        </div>

        <div className="content-sections">
          {canvasContent.sections.map((section, index) => {
            const isSuitable = suitableSections.some(s => s.id === section.id);
            const isSelected = selectedSectionId === section.id;
            const conflicts = getPlacementConflicts(section.id, 'after');
            const hasConflicts = conflicts.length > 0 && highlightConflicts;
            const sectionMarkers = placementMarkers.filter(m => m.sectionId === section.id);

            if (!showAllSections && !isSuitable) {
              return null;
            }

            return (
              <div
                key={section.id}
                className={`content-section ${section.type} ${
                  isSuitable ? 'suitable' : 'not-suitable'
                } ${
                  isSelected ? 'selected' : ''
                } ${
                  hasConflicts ? 'has-conflicts' : ''
                } ${
                  isPlacementMode ? 'placement-mode' : ''
                }`}
                onClick={(e) => isSuitable && handleSectionClick(
                  section.id,
                  section.title || `${section.type} ${index + 1}`,
                  e
                )}
                role={isSuitable ? 'button' : undefined}
                tabIndex={isSuitable ? 0 : undefined}
                aria-label={
                  isSuitable
                    ? `Click to place assessment after ${section.title || section.type}`
                    : undefined
                }
              >
                {/* Section Content */}
                <div className="section-content">
                  {section.type === 'heading' && (
                    <div className={`heading level-${section.level || 1}`}>
                      <span className="heading-icon">📌</span>
                      <h5>{section.title}</h5>
                    </div>
                  )}

                  {section.type === 'text' && (
                    <div className="text-content">
                      <span className="text-icon">📄</span>
                      <p>{formatSectionText(section.text || '')}</p>
                    </div>
                  )}

                  {section.type === 'image' && (
                    <div className="image-content">
                      <span className="media-icon">🖼️</span>
                      <p>Image: {section.title || 'Untitled image'}</p>
                    </div>
                  )}

                  {section.type === 'video' && (
                    <div className="video-content">
                      <span className="media-icon">🎥</span>
                      <p>Video: {section.title || 'Untitled video'}</p>
                    </div>
                  )}

                  {section.type === 'link' && (
                    <div className="link-content">
                      <span className="link-icon">🔗</span>
                      <p>Link: {section.title || section.href}</p>
                    </div>
                  )}

                  {section.type === 'list' && (
                    <div className="list-content">
                      <span className="list-icon">📋</span>
                      <p>List with {section.items?.length || 0} items</p>
                    </div>
                  )}

                  {section.type === 'code' && (
                    <div className="code-content">
                      <span className="code-icon">💻</span>
                      <p>Code block</p>
                    </div>
                  )}

                  {section.type === 'quote' && (
                    <div className="quote-content">
                      <span className="quote-icon">💬</span>
                      <p>{formatSectionText(section.text || 'Quote')}</p>
                    </div>
                  )}
                </div>

                {/* Placement Markers */}
                {sectionMarkers.map(marker => (
                  <div
                    key={marker.id}
                    className={`placement-marker ${marker.position} ${
                      marker.isDraft ? 'draft' : 'existing'
                    } ${marker.isActive ? 'active' : ''}`}
                    style={{
                      left: marker.coordinates.x,
                      top: marker.coordinates.y,
                    }}
                    title={`${getAssessmentTypeIcon(marker.assessmentType)} ${marker.title}`}
                  >
                    <div className="marker-icon">
                      {getAssessmentTypeIcon(marker.assessmentType)}
                    </div>
                    <div className="marker-label">
                      {marker.title}
                    </div>
                    {!marker.isDraft && (
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          onPlacementRemove(marker.id);
                        }}
                        className="marker-remove"
                        aria-label="Remove placement"
                      >
                        ✕
                      </button>
                    )}
                  </div>
                ))}

                {/* Placement Guidelines */}
                {isSuitable && isPlacementMode && (
                  <div className="placement-guidelines">
                    <div className="guideline before">Before</div>
                    <div className="guideline after">After</div>
                  </div>
                )}

                {/* Conflict Warning */}
                {hasConflicts && (
                  <div className="conflict-warning">
                    ⚠️ {conflicts.length} existing placement(s)
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Placement Configuration Form */}
      {placementDraft && (
        <div ref={placementFormRef} className="placement-form">
          <div className="form-header">
            <h4>⚙️ Configure Assessment Placement</h4>
            <p>Customize the assessment that will appear at this location.</p>
          </div>

          <div className="form-content">
            <div className="form-group">
              <label htmlFor="placement-title">Assessment Title</label>
              <input
                id="placement-title"
                type="text"
                value={placementDraft.title}
                onChange={(e) => setPlacementDraft({
                  ...placementDraft,
                  title: e.target.value,
                })}
                placeholder="Enter assessment title..."
                className="form-input"
              />
            </div>

            <div className="form-row">
              <div className="form-group">
                <label htmlFor="placement-type">Assessment Type</label>
                <select
                  id="placement-type"
                  value={placementDraft.assessmentType}
                  onChange={(e) => setPlacementDraft({
                    ...placementDraft,
                    assessmentType: e.target.value as AssessmentType,
                  })}
                  className="form-select"
                >
                  <option value="comprehension">🧠 Comprehension Check</option>
                  <option value="application">📝 Application Exercise</option>
                  <option value="analysis">🔍 Analysis Task</option>
                  <option value="reflection">💭 Reflection Prompt</option>
                  <option value="knowledge_check">✅ Knowledge Check</option>
                </select>
              </div>

              <div className="form-group">
                <label htmlFor="placement-position">Position</label>
                <select
                  id="placement-position"
                  value={placementDraft.position}
                  onChange={(e) => setPlacementDraft({
                    ...placementDraft,
                    position: e.target.value as 'before' | 'after' | 'inline',
                  })}
                  className="form-select"
                >
                  <option value="before">Before Section</option>
                  <option value="after">After Section</option>
                  <option value="inline">Inline with Section</option>
                </select>
              </div>

              <div className="form-group">
                <label htmlFor="placement-time">Est. Time (min)</label>
                <input
                  id="placement-time"
                  type="number"
                  min="1"
                  max="60"
                  value={placementDraft.estimatedTime}
                  onChange={(e) => setPlacementDraft({
                    ...placementDraft,
                    estimatedTime: parseInt(e.target.value) || 5,
                  })}
                  className="form-input"
                />
              </div>
            </div>

            <div className="form-group">
              <label htmlFor="placement-description">Description (Optional)</label>
              <textarea
                id="placement-description"
                value={placementDraft.description || ''}
                onChange={(e) => setPlacementDraft({
                  ...placementDraft,
                  description: e.target.value,
                })}
                placeholder="Provide additional context for this assessment..."
                rows={3}
                className="form-textarea"
              />
            </div>
          </div>

          <div className="form-actions">
            <button
              onClick={handlePlacementCancel}
              className="btn btn-outline"
            >
              Cancel
            </button>
            <button
              onClick={handlePlacementSubmit}
              className="btn btn-primary"
              disabled={!placementDraft.title.trim()}
            >
              ➕ Add Assessment
            </button>
          </div>
        </div>
      )}

      {/* Existing Placements List */}
      {existingPlacements.length > 0 && (
        <div className="existing-placements">
          <h4>📋 Current Assessment Placements</h4>
          <div className="placements-list">
            {existingPlacements.map((placement, index) => (
              <div key={placement.id} className="placement-item">
                <div className="placement-info">
                  <div className="placement-header">
                    <span className="placement-number">{index + 1}</span>
                    <span className="placement-icon">
                      {getAssessmentTypeIcon(placement.assessmentType)}
                    </span>
                    <span className="placement-title">{placement.title}</span>
                    <span className="placement-position">{placement.position}</span>
                  </div>
                  {placement.description && (
                    <p className="placement-description">{placement.description}</p>
                  )}
                  <div className="placement-meta">
                    <span>⏱️ {placement.estimatedTime} min</span>
                    <span>📍 Section: {placement.contentSelector}</span>
                  </div>
                </div>
                <div className="placement-actions">
                  <button
                    onClick={() => setSelectedSectionId(placement.contentSelector)}
                    className="btn btn-outline btn-sm"
                    title="Jump to placement"
                  >
                    🎯
                  </button>
                  <button
                    onClick={() => onPlacementRemove(placement.id)}
                    className="btn btn-outline btn-sm btn-danger"
                    title="Remove placement"
                  >
                    🗑️
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* View Options */}
      <div className="view-options">
        <label className="checkbox-label">
          <input
            type="checkbox"
            checked={showAllSections}
            onChange={(e) => setShowAllSections(e.target.checked)}
          />
          Show all content sections
        </label>
        <label className="checkbox-label">
          <input
            type="checkbox"
            checked={highlightConflicts}
            onChange={(e) => setHighlightConflicts(e.target.checked)}
          />
          Highlight placement conflicts
        </label>
      </div>
    </div>
  );
}

/**
 * CSS styles for content placement selector
 */
const styles = `
  .content-placement-selector {
    display: flex;
    flex-direction: column;
    gap: 20px;
    padding: 20px;
    background: #F9FAFB;
    border-radius: 8px;
    border: 1px solid #E5E7EB;
  }

  .controls-header {
    display: flex;
    justify-content: space-between;
    align-items: flex-start;
    gap: 20px;
    padding: 16px;
    background: white;
    border-radius: 6px;
    border: 1px solid #E5E7EB;
  }

  .header-info h3 {
    margin: 0 0 8px 0;
    color: #333;
    font-size: 1.25rem;
  }

  .header-info p {
    margin: 0 0 12px 0;
    color: #666;
    font-size: 0.9rem;
  }

  .placement-stats {
    display: flex;
    gap: 16px;
    font-size: 0.85rem;
  }

  .placement-stats .stat {
    background: #F3F4F6;
    padding: 4px 8px;
    border-radius: 4px;
    color: #666;
  }

  .controls-actions {
    display: flex;
    align-items: center;
    gap: 12px;
    flex-shrink: 0;
  }

  .zoom-controls {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 4px 8px;
    background: #F3F4F6;
    border-radius: 4px;
  }

  .zoom-level {
    font-size: 0.85rem;
    color: #666;
    min-width: 35px;
    text-align: center;
  }

  .content-structure-view {
    background: white;
    border-radius: 6px;
    border: 1px solid #E5E7EB;
    padding: 20px;
    overflow: auto;
    max-height: 60vh;
    transform-origin: top left;
  }

  .content-header {
    margin-bottom: 20px;
    padding-bottom: 12px;
    border-bottom: 1px solid #E5E7EB;
  }

  .content-header h4 {
    margin: 0 0 8px 0;
    color: #333;
    font-size: 1.1rem;
  }

  .content-meta {
    display: flex;
    gap: 12px;
    font-size: 0.85rem;
  }

  .content-meta span {
    background: #F3F4F6;
    padding: 2px 6px;
    border-radius: 3px;
    color: #666;
  }

  .content-sections {
    display: flex;
    flex-direction: column;
    gap: 12px;
  }

  .content-section {
    position: relative;
    padding: 12px;
    border-radius: 6px;
    border: 1px solid #E5E7EB;
    background: #FAFBFC;
    transition: all 0.2s;
  }

  .content-section.suitable {
    background: white;
    border-color: #D1D5DB;
  }

  .content-section.suitable:hover {
    border-color: #FFDD00;
    background: #FFFEF7;
    cursor: pointer;
  }

  .content-section.placement-mode.suitable {
    border-color: #FFDD00;
    background: #FFFEF7;
    cursor: crosshair;
  }

  .content-section.selected {
    border-color: #FFDD00;
    background: #FFFEF7;
    box-shadow: 0 0 0 2px rgba(255, 221, 0, 0.2);
  }

  .content-section.has-conflicts {
    border-color: #F59E0B;
    background: #FEF3C7;
  }

  .content-section.not-suitable {
    opacity: 0.6;
  }

  .section-content {
    display: flex;
    align-items: flex-start;
    gap: 8px;
    position: relative;
    z-index: 1;
  }

  .heading {
    display: flex;
    align-items: center;
    gap: 8px;
    width: 100%;
  }

  .heading h5 {
    margin: 0;
    color: #333;
    font-weight: 600;
  }

  .heading.level-1 h5 { font-size: 1.2rem; }
  .heading.level-2 h5 { font-size: 1.1rem; }
  .heading.level-3 h5 { font-size: 1rem; }

  .text-content,
  .image-content,
  .video-content,
  .link-content,
  .list-content,
  .code-content,
  .quote-content {
    display: flex;
    align-items: flex-start;
    gap: 8px;
    width: 100%;
  }

  .text-content p,
  .image-content p,
  .video-content p,
  .link-content p,
  .list-content p,
  .code-content p,
  .quote-content p {
    margin: 0;
    color: #666;
    font-size: 0.9rem;
    line-height: 1.4;
  }

  .placement-marker {
    position: absolute;
    z-index: 10;
    background: #FFDD00;
    border: 2px solid #EBCB00;
    border-radius: 8px;
    padding: 4px 8px;
    display: flex;
    align-items: center;
    gap: 4px;
    font-size: 0.8rem;
    box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
    cursor: move;
    transition: all 0.2s;
  }

  .placement-marker.draft {
    background: #E5E7EB;
    border-color: #9CA3AF;
    opacity: 0.8;
  }

  .placement-marker.active {
    transform: scale(1.1);
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.2);
  }

  .placement-marker:hover {
    transform: scale(1.05);
  }

  .marker-icon {
    font-size: 0.9rem;
  }

  .marker-label {
    max-width: 120px;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    font-weight: 500;
    color: #333;
  }

  .marker-remove {
    background: #EF4444;
    color: white;
    border: none;
    border-radius: 50%;
    width: 16px;
    height: 16px;
    font-size: 0.7rem;
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;
    margin-left: 4px;
  }

  .marker-remove:hover {
    background: #DC2626;
  }

  .placement-guidelines {
    position: absolute;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    pointer-events: none;
    opacity: 0.3;
  }

  .guideline {
    position: absolute;
    background: #FFDD00;
    color: #333;
    padding: 2px 6px;
    border-radius: 3px;
    font-size: 0.7rem;
    font-weight: 500;
  }

  .guideline.before {
    top: -10px;
    left: 50%;
    transform: translateX(-50%);
  }

  .guideline.after {
    bottom: -10px;
    left: 50%;
    transform: translateX(-50%);
  }

  .conflict-warning {
    position: absolute;
    top: -8px;
    right: -8px;
    background: #F59E0B;
    color: white;
    padding: 2px 6px;
    border-radius: 3px;
    font-size: 0.7rem;
    font-weight: 500;
  }

  .placement-form {
    background: white;
    border-radius: 6px;
    border: 1px solid #E5E7EB;
    padding: 20px;
    box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
  }

  .form-header {
    margin-bottom: 20px;
    padding-bottom: 12px;
    border-bottom: 1px solid #E5E7EB;
  }

  .form-header h4 {
    margin: 0 0 4px 0;
    color: #333;
    font-size: 1.1rem;
  }

  .form-header p {
    margin: 0;
    color: #666;
    font-size: 0.9rem;
  }

  .form-content {
    display: flex;
    flex-direction: column;
    gap: 16px;
  }

  .form-row {
    display: grid;
    grid-template-columns: 1fr 1fr 1fr;
    gap: 16px;
  }

  .form-group {
    display: flex;
    flex-direction: column;
    gap: 4px;
  }

  .form-group label {
    font-weight: 500;
    color: #333;
    font-size: 0.9rem;
  }

  .form-input,
  .form-select,
  .form-textarea {
    padding: 8px 12px;
    border: 1px solid #D1D5DB;
    border-radius: 4px;
    font-size: 0.9rem;
    transition: border-color 0.2s;
  }

  .form-input:focus,
  .form-select:focus,
  .form-textarea:focus {
    outline: none;
    border-color: #FFDD00;
    box-shadow: 0 0 0 2px rgba(255, 221, 0, 0.2);
  }

  .form-textarea {
    resize: vertical;
    min-height: 80px;
  }

  .form-actions {
    display: flex;
    justify-content: flex-end;
    gap: 12px;
    margin-top: 20px;
    padding-top: 16px;
    border-top: 1px solid #E5E7EB;
  }

  .existing-placements {
    background: white;
    border-radius: 6px;
    border: 1px solid #E5E7EB;
    padding: 20px;
  }

  .existing-placements h4 {
    margin: 0 0 16px 0;
    color: #333;
    font-size: 1.1rem;
  }

  .placements-list {
    display: flex;
    flex-direction: column;
    gap: 12px;
  }

  .placement-item {
    display: flex;
    justify-content: space-between;
    align-items: flex-start;
    padding: 12px;
    background: #F9FAFB;
    border-radius: 6px;
    border: 1px solid #E5E7EB;
  }

  .placement-info {
    flex: 1;
  }

  .placement-header {
    display: flex;
    align-items: center;
    gap: 8px;
    margin-bottom: 4px;
  }

  .placement-number {
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
  }

  .placement-icon {
    font-size: 1rem;
  }

  .placement-title {
    font-weight: 500;
    color: #333;
  }

  .placement-position {
    background: #F3F4F6;
    padding: 2px 6px;
    border-radius: 3px;
    font-size: 0.8rem;
    color: #666;
  }

  .placement-description {
    margin: 4px 0 8px 0;
    color: #666;
    font-size: 0.85rem;
    line-height: 1.3;
  }

  .placement-meta {
    display: flex;
    gap: 12px;
    font-size: 0.8rem;
    color: #666;
  }

  .placement-actions {
    display: flex;
    gap: 4px;
    flex-shrink: 0;
  }

  .view-options {
    display: flex;
    gap: 20px;
    padding: 16px;
    background: white;
    border-radius: 6px;
    border: 1px solid #E5E7EB;
  }

  .checkbox-label {
    display: flex;
    align-items: center;
    gap: 6px;
    font-size: 0.9rem;
    color: #666;
    cursor: pointer;
  }

  .checkbox-label input[type="checkbox"] {
    margin: 0;
  }

  .no-content {
    padding: 40px;
    text-align: center;
  }

  .empty-state h3 {
    margin: 0 0 12px 0;
    color: #333;
    font-size: 1.25rem;
  }

  .empty-state p {
    margin: 0 0 8px 0;
    color: #666;
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

  .btn-primary {
    background: #FFDD00;
    color: #333;
    border-color: #EBCB00;
  }

  .btn-primary:hover:not(:disabled) {
    background: #EBCB00;
  }

  .btn-secondary {
    background: #6B7280;
    color: white;
    border-color: #4B5563;
  }

  .btn-secondary:hover:not(:disabled) {
    background: #4B5563;
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

  .btn-danger {
    color: #EF4444;
    border-color: #EF4444;
  }

  .btn-danger:hover:not(:disabled) {
    background: #EF4444;
    color: white;
  }

  .btn-sm {
    padding: 4px 8px;
    font-size: 0.8rem;
  }

  @media (max-width: 768px) {
    .controls-header {
      flex-direction: column;
      gap: 16px;
    }

    .controls-actions {
      width: 100%;
      justify-content: space-between;
    }

    .form-row {
      grid-template-columns: 1fr;
    }

    .placement-item {
      flex-direction: column;
      gap: 12px;
    }

    .placement-actions {
      align-self: flex-end;
    }

    .view-options {
      flex-direction: column;
      gap: 12px;
    }

    .content-structure-view {
      max-height: 50vh;
    }
  }
`;

// Inject styles
if (typeof document !== 'undefined') {
  const styleElement = document.createElement('style');
  styleElement.textContent = styles;
  document.head.appendChild(styleElement);
}