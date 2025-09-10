/**
 * @fileoverview Cross-Course Context Provider for enhanced chat context
 * 
 * Builds cross-course knowledge integration for chat responses, implements
 * prerequisite concept explanation with course connections, adds multi-course
 * learning strategy suggestions, and creates knowledge gap identification
 * and remediation workflows.
 */

import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';
import type { ReactElement, ReactNode } from 'react';
import {
  CrossCourseContext,
  PrerequisiteConcept,
  KnowledgeTransferOpportunity,
  KnowledgeGap,
  StudentId
} from '../../features/cross-course-intelligence/shared/types';

// ============================================================================
// Context Types and Interfaces
// ============================================================================

interface CrossCourseContextData {
  crossCourseContexts: CrossCourseContext[];
  prerequisiteLinks: PrerequisiteConcept[];
  transferOpportunities: KnowledgeTransferOpportunity[];
  knowledgeGaps: KnowledgeGap[];
  loading: boolean;
  error: string | null;
  lastUpdated: Date | null;
}

interface CrossCourseContextActions {
  refreshContext: (studentId: StudentId, currentCourseId: string, topics: string[]) => Promise<void>;
  getRelevantContext: (query: string) => CrossCourseContext[];
  getPrerequisiteExplanations: (concepts: string[]) => PrerequisiteConcept[];
  getTransferSuggestions: (currentCourse: string) => KnowledgeTransferOpportunity[];
  identifyGapsForQuery: (query: string) => KnowledgeGap[];
  markGapAddressed: (gapId: string) => Promise<void>;
}

interface CrossCourseContextProviderProps {
  children: ReactNode;
  studentId: StudentId;
  currentCourseId: string;
  autoRefresh?: boolean;
  refreshInterval?: number; // milliseconds
}

// ============================================================================
// Context Creation
// ============================================================================

const CrossCourseContextContext = createContext<
  (CrossCourseContextData & CrossCourseContextActions) | null
>(null);

// ============================================================================
// Custom Hook
// ============================================================================

export function useCrossCourseContext(): CrossCourseContextData & CrossCourseContextActions {
  const context = useContext(CrossCourseContextContext);
  if (!context) {
    throw new Error('useCrossCourseContext must be used within a CrossCourseContextProvider');
  }
  return context;
}

// ============================================================================
// Main Provider Component
// ============================================================================

/**
 * Cross-Course Context Provider
 * 
 * Provides cross-course intelligence context for chat interactions,
 * including prerequisite concepts, knowledge gaps, and transfer opportunities.
 */
export default function CrossCourseContextProvider({
  children,
  studentId,
  currentCourseId,
  autoRefresh = true,
  refreshInterval = 300000 // 5 minutes
}: CrossCourseContextProviderProps): ReactElement {
  // ========================================================================
  // State Management
  // ========================================================================

  const [state, setState] = useState<CrossCourseContextData>({
    crossCourseContexts: [],
    prerequisiteLinks: [],
    transferOpportunities: [],
    knowledgeGaps: [],
    loading: false,
    error: null,
    lastUpdated: null
  });

  // ========================================================================
  // Data Fetching Functions
  // ========================================================================

  const refreshContext = useCallback(async (
    studentId: StudentId, 
    currentCourseId: string, 
    topics: string[] = []
  ): Promise<void> => {
    try {
      setState(prev => ({ ...prev, loading: true, error: null }));

      // Fetch all cross-course data in parallel
      const [
        crossCourseResponse,
        prerequisitesResponse,
        transfersResponse,
        gapsResponse
      ] = await Promise.all([
        fetch(`/api/cross-course/context/${studentId}?courseId=${currentCourseId}&topics=${topics.join(',')}`, {
          headers: { 'Authorization': `Bearer ${window.LAUNCH_SETTINGS?.jwt || ''}` }
        }),
        fetch(`/api/cross-course/prerequisites/${studentId}?topics=${topics.join(',')}`, {
          headers: { 'Authorization': `Bearer ${window.LAUNCH_SETTINGS?.jwt || ''}` }
        }),
        fetch(`/api/cross-course/transfers/${studentId}?courseId=${currentCourseId}`, {
          headers: { 'Authorization': `Bearer ${window.LAUNCH_SETTINGS?.jwt || ''}` }
        }),
        fetch(`/api/cross-course/gaps/${studentId}?courseId=${currentCourseId}`, {
          headers: { 'Authorization': `Bearer ${window.LAUNCH_SETTINGS?.jwt || ''}` }
        })
      ]);

      if (!crossCourseResponse.ok || !prerequisitesResponse.ok || 
          !transfersResponse.ok || !gapsResponse.ok) {
        throw new Error('Failed to fetch cross-course context data');
      }

      const [
        crossCourseContexts,
        prerequisiteLinks,
        transferOpportunities,
        knowledgeGaps
      ] = await Promise.all([
        crossCourseResponse.json() as Promise<CrossCourseContext[]>,
        prerequisitesResponse.json() as Promise<PrerequisiteConcept[]>,
        transfersResponse.json() as Promise<KnowledgeTransferOpportunity[]>,
        gapsResponse.json() as Promise<KnowledgeGap[]>
      ]);

      setState(prev => ({
        ...prev,
        crossCourseContexts,
        prerequisiteLinks,
        transferOpportunities,
        knowledgeGaps,
        loading: false,
        lastUpdated: new Date()
      }));
    } catch (error) {
      setState(prev => ({
        ...prev,
        loading: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      }));
    }
  }, []);

  const markGapAddressed = useCallback(async (gapId: string): Promise<void> => {
    try {
      const response = await fetch(`/api/cross-course/gaps/${gapId}/addressed`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${window.LAUNCH_SETTINGS?.jwt || ''}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ studentId, addressedAt: new Date() })
      });

      if (!response.ok) {
        throw new Error('Failed to mark gap as addressed');
      }

      // Update local state
      setState(prev => ({
        ...prev,
        knowledgeGaps: prev.knowledgeGaps.filter(gap => gap.id !== gapId)
      }));
    } catch (error) {
      console.error('Failed to mark gap as addressed:', error);
    }
  }, [studentId]);

  // ========================================================================
  // Context Analysis Functions
  // ========================================================================

  const getRelevantContext = useCallback((query: string): CrossCourseContext[] => {
    const queryWords = query.toLowerCase().split(/\s+/);
    
    return state.crossCourseContexts
      .map(context => {
        // Calculate relevance based on query content
        const descriptionWords = context.description.toLowerCase().split(/\s+/);
        const matchCount = queryWords.filter(word => 
          word.length > 3 && descriptionWords.some(desc => desc.includes(word))
        ).length;
        
        const queryRelevance = matchCount / Math.max(queryWords.length, 1);
        const combinedRelevance = (context.relevanceScore + queryRelevance) / 2;
        
        return { ...context, relevanceScore: combinedRelevance };
      })
      .filter(context => context.relevanceScore > 0.3)
      .sort((a, b) => b.relevanceScore - a.relevanceScore)
      .slice(0, 3); // Return top 3 most relevant contexts
  }, [state.crossCourseContexts]);

  const getPrerequisiteExplanations = useCallback((concepts: string[]): PrerequisiteConcept[] => {
    if (concepts.length === 0) return [];
    
    const conceptsLower = concepts.map(c => c.toLowerCase());
    
    return state.prerequisiteLinks
      .filter(link => 
        conceptsLower.some(concept => 
          link.concept.toLowerCase().includes(concept) ||
          concept.includes(link.concept.toLowerCase())
        )
      )
      .sort((a, b) => a.masteryLevel - b.masteryLevel) // Show weakest prerequisites first
      .slice(0, 5); // Limit to top 5 prerequisites
  }, [state.prerequisiteLinks]);

  const getTransferSuggestions = useCallback((currentCourse: string): KnowledgeTransferOpportunity[] => {
    return state.transferOpportunities
      .filter(opportunity => 
        opportunity.targetCourse === currentCourse ||
        opportunity.sourceCourse === currentCourse
      )
      .filter(opportunity => opportunity.status === 'identified')
      .sort((a, b) => b.opportunityStrength - a.opportunityStrength)
      .slice(0, 3); // Return top 3 transfer opportunities
  }, [state.transferOpportunities]);

  const identifyGapsForQuery = useCallback((query: string): KnowledgeGap[] => {
    const queryWords = query.toLowerCase().split(/\s+/);
    
    return state.knowledgeGaps
      .filter(gap => {
        // Check if query relates to concepts with gaps
        const conceptWords = gap.concept.toLowerCase().split(/\s+/);
        return queryWords.some(word => 
          word.length > 3 && conceptWords.some(concept => concept.includes(word))
        );
      })
      .sort((a, b) => {
        // Sort by severity and remediation priority
        const priorityOrder = { critical: 4, high: 3, medium: 2, low: 1 };
        const aPriority = priorityOrder[a.remediationPriority];
        const bPriority = priorityOrder[b.remediationPriority];
        
        if (aPriority !== bPriority) return bPriority - aPriority;
        return b.gapSeverity - a.gapSeverity;
      })
      .slice(0, 2); // Return top 2 most relevant gaps
  }, [state.knowledgeGaps]);

  // ========================================================================
  // Effects
  // ========================================================================

  // Initial data load
  useEffect(() => {
    void refreshContext(studentId, currentCourseId);
  }, [studentId, currentCourseId, refreshContext]);

  // Auto-refresh setup
  useEffect(() => {
    if (!autoRefresh) return;

    const interval = setInterval(() => {
      void refreshContext(studentId, currentCourseId);
    }, refreshInterval);

    return () => clearInterval(interval);
  }, [autoRefresh, refreshInterval, studentId, currentCourseId, refreshContext]);

  // ========================================================================
  // Context Value
  // ========================================================================

  const contextValue: CrossCourseContextData & CrossCourseContextActions = {
    // Data
    ...state,
    
    // Actions
    refreshContext,
    getRelevantContext,
    getPrerequisiteExplanations,
    getTransferSuggestions,
    identifyGapsForQuery,
    markGapAddressed
  };

  // ========================================================================
  // Render
  // ========================================================================

  return (
    <CrossCourseContextContext.Provider value={contextValue}>
      {children}
    </CrossCourseContextContext.Provider>
  );
}

// ============================================================================
// Utility Components
// ============================================================================

/**
 * Cross-Course Context Display Component
 * 
 * Helper component to display cross-course context information in chat
 */
export function CrossCourseContextDisplay({ 
  contexts, 
  maxItems = 3 
}: { 
  contexts: CrossCourseContext[]; 
  maxItems?: number; 
}): ReactElement {
  const displayContexts = contexts.slice(0, maxItems);

  if (displayContexts.length === 0) {
    return <div />;
  }

  return (
    <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 mt-2">
      <h4 className="text-sm font-semibold text-blue-800 mb-2">Related Course Context</h4>
      <div className="space-y-2">
        {displayContexts.map((context, index) => (
          <div key={index} className="text-sm">
            <div className="flex items-center justify-between">
              <span className="font-medium text-blue-700">
                {context.courseName} ({context.courseCode})
              </span>
              <span className={`px-2 py-1 rounded text-xs ${
                context.connectionType === 'prerequisite' ? 'bg-orange-100 text-orange-700' :
                context.connectionType === 'dependent' ? 'bg-green-100 text-green-700' :
                context.connectionType === 'parallel' ? 'bg-blue-100 text-blue-700' :
                'bg-purple-100 text-purple-700'
              }`}>
                {context.connectionType}
              </span>
            </div>
            <p className="text-blue-600 text-xs mt-1">{context.description}</p>
            {context.knowledgeGaps && context.knowledgeGaps.length > 0 && (
              <div className="mt-1">
                <span className="text-xs text-orange-600">
                  Gaps: {context.knowledgeGaps.map(gap => gap.concept).join(', ')}
                </span>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

/**
 * Knowledge Gap Alert Component
 * 
 * Helper component to display knowledge gaps in chat
 */
export function KnowledgeGapAlert({ 
  gaps, 
  onGapClick 
}: { 
  gaps: KnowledgeGap[]; 
  onGapClick?: (gap: KnowledgeGap) => void; 
}): ReactElement {
  if (gaps.length === 0) {
    return <div />;
  }

  return (
    <div className="bg-orange-50 border border-orange-200 rounded-lg p-3 mt-2">
      <h4 className="text-sm font-semibold text-orange-800 mb-2">📚 Knowledge Gaps Identified</h4>
      <div className="space-y-2">
        {gaps.map((gap) => (
          <div 
            key={gap.id} 
            className={`text-sm p-2 rounded border border-orange-300 ${onGapClick ? 'cursor-pointer hover:bg-orange-100' : ''}`}
            onClick={() => onGapClick?.(gap)}
          >
            <div className="flex items-center justify-between">
              <span className="font-medium text-orange-700">{gap.concept}</span>
              <span className={`px-2 py-1 rounded text-xs ${
                gap.remediationPriority === 'critical' ? 'bg-red-100 text-red-700' :
                gap.remediationPriority === 'high' ? 'bg-orange-100 text-orange-700' :
                gap.remediationPriority === 'medium' ? 'bg-yellow-100 text-yellow-700' :
                'bg-green-100 text-green-700'
              }`}>
                {gap.remediationPriority}
              </span>
            </div>
            <p className="text-orange-600 text-xs mt-1">
              From {gap.prerequisiteCourse} • Impacts: {gap.impactedCourses.join(', ')}
            </p>
            {gap.estimatedReviewTime && (
              <p className="text-xs text-gray-600 mt-1">
                Review time: {gap.estimatedReviewTime} minutes
              </p>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

/**
 * Transfer Opportunities Display Component
 * 
 * Helper component to display knowledge transfer suggestions
 */
export function TransferOpportunitiesDisplay({ 
  opportunities 
}: { 
  opportunities: KnowledgeTransferOpportunity[]; 
}): ReactElement {
  if (opportunities.length === 0) {
    return <div />;
  }

  return (
    <div className="bg-green-50 border border-green-200 rounded-lg p-3 mt-2">
      <h4 className="text-sm font-semibold text-green-800 mb-2">🔄 Knowledge Transfer Opportunities</h4>
      <div className="space-y-2">
        {opportunities.map((opportunity) => (
          <div key={opportunity.id} className="text-sm">
            <div className="flex items-center justify-between">
              <span className="font-medium text-green-700">
                {opportunity.sourceCourse} → {opportunity.targetCourse}
              </span>
              <span className={`px-2 py-1 rounded text-xs ${
                opportunity.transferType === 'positive' ? 'bg-green-100 text-green-700' :
                opportunity.transferType === 'negative' ? 'bg-red-100 text-red-700' :
                'bg-gray-100 text-gray-700'
              }`}>
                {opportunity.transferType}
              </span>
            </div>
            <p className="text-green-600 text-xs mt-1">{opportunity.recommendation}</p>
          </div>
        ))}
      </div>
    </div>
  );
}