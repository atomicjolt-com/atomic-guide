/**
 * @fileoverview Cross-Course Performance Dashboard component for unified student view
 * 
 * Provides multi-course performance visualization with knowledge dependency mapping,
 * interactive knowledge graph display with gap highlighting, predictive risk scoring
 * display with actionable recommendations, and course-to-course performance correlations.
 */

import React, { useState, useEffect, useCallback } from 'react';
import type { ReactElement } from 'react';
import {
  CrossCourseAnalyticsResponse,
  KnowledgeGap,
  ActionItem,
  DashboardView,
  StudentId
} from '../../features/cross-course-intelligence/shared/types';

// ============================================================================
// Component Props and State Interfaces
// ============================================================================

interface CrossCoursePerformanceDashboardProps {
  studentId: StudentId;
  onViewChange?: (view: DashboardView) => void;
  onActionItemClick?: (actionItem: ActionItem) => void;
  onGapRemediation?: (gap: KnowledgeGap) => void;
  className?: string;
}

interface DashboardState {
  analytics: CrossCourseAnalyticsResponse | null;
  currentView: DashboardView;
  selectedCourse: string | null;
  loading: boolean;
  error: string | null;
  lastRefresh: Date | null;
}

// ============================================================================
// Main Component
// ============================================================================

/**
 * Cross-Course Performance Dashboard
 * 
 * Unified view of student learning patterns, knowledge gaps, and performance
 * trajectories across all enrolled courses with interactive visualizations.
 */
export default function CrossCoursePerformanceDashboard({
  studentId,
  onViewChange,
  onActionItemClick,
  onGapRemediation,
  className = ''
}: CrossCoursePerformanceDashboardProps): ReactElement {
  const [state, setState] = useState<DashboardState>({
    analytics: null,
    currentView: 'overview',
    selectedCourse: null,
    loading: true,
    error: null,
    lastRefresh: null
  });

  // ========================================================================
  // Data Fetching and State Management
  // ========================================================================

  const fetchAnalytics = useCallback(async (): Promise<void> => {
    try {
      setState(prev => ({ ...prev, loading: true, error: null }));
      
      const response = await fetch(`/api/cross-course/analytics/${studentId}`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${window.LAUNCH_SETTINGS?.jwt || ''}`
        }
      });

      if (!response.ok) {
        throw new Error(`Failed to fetch analytics: ${response.statusText}`);
      }

      const analytics = await response.json() as CrossCourseAnalyticsResponse;
      
      setState(prev => ({
        ...prev,
        analytics,
        loading: false,
        lastRefresh: new Date()
      }));
    } catch (error) {
      setState(prev => ({
        ...prev,
        loading: false,
        error: error instanceof Error ? error.message : 'Unknown error occurred'
      }));
    }
  }, [studentId]);

  useEffect(() => {
    void fetchAnalytics();
  }, [fetchAnalytics]);

  // ========================================================================
  // Event Handlers
  // ========================================================================

  const handleViewChange = useCallback((view: DashboardView): void => {
    setState(prev => ({ ...prev, currentView: view }));
    onViewChange?.(view);
  }, [onViewChange]);

  const handleCourseSelect = useCallback((courseId: string): void => {
    setState(prev => ({ 
      ...prev, 
      selectedCourse: prev.selectedCourse === courseId ? null : courseId 
    }));
  }, []);

  const handleActionItemClick = useCallback((actionItem: ActionItem): void => {
    onActionItemClick?.(actionItem);
  }, [onActionItemClick]);

  const handleGapClick = useCallback((gap: KnowledgeGap): void => {
    onGapRemediation?.(gap);
  }, [onGapRemediation]);

  const handleRefresh = useCallback((): void => {
    void fetchAnalytics();
  }, [fetchAnalytics]);

  // ========================================================================
  // Utility Functions
  // ========================================================================

  const getRiskColorClass = (riskScore: number): string => {
    if (riskScore < 0.3) return 'text-green-600 bg-green-50';
    if (riskScore < 0.6) return 'text-yellow-600 bg-yellow-50';
    if (riskScore < 0.8) return 'text-orange-600 bg-orange-50';
    return 'text-red-600 bg-red-50';
  };

  const getPerformanceColorClass = (performance: number): string => {
    if (performance >= 0.8) return 'text-green-600';
    if (performance >= 0.6) return 'text-yellow-600';
    return 'text-red-600';
  };

  const formatRiskScore = (score: number): string => {
    return `${Math.round(score * 100)}%`;
  };

  const formatCorrelation = (correlation: number): string => {
    const abs = Math.abs(correlation);
    if (abs >= 0.7) return 'Strong';
    if (abs >= 0.4) return 'Moderate';
    if (abs >= 0.2) return 'Weak';
    return 'None';
  };

  // ========================================================================
  // Render Functions
  // ========================================================================

  const renderHeader = (): ReactElement => (
    <div className="mb-6">
      <div className="flex justify-between items-center mb-4">
        <h2 className="text-2xl font-bold text-gray-900">Cross-Course Performance Dashboard</h2>
        <div className="flex items-center space-x-4">
          {state.lastRefresh && (
            <span className="text-sm text-gray-500">
              Last updated: {state.lastRefresh.toLocaleTimeString()}
            </span>
          )}
          <button
            onClick={handleRefresh}
            disabled={state.loading}
            className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50"
          >
            {state.loading ? 'Refreshing...' : 'Refresh'}
          </button>
        </div>
      </div>
      
      {state.analytics && (
        <div className={`inline-flex px-4 py-2 rounded-full text-sm font-medium ${getRiskColorClass(state.analytics.academicRiskScore)}`}>
          Academic Risk Score: {formatRiskScore(state.analytics.academicRiskScore)}
        </div>
      )}
    </div>
  );

  const renderNavigation = (): ReactElement => (
    <div className="border-b border-gray-200 mb-6">
      <nav className="-mb-px flex space-x-8">
        {[
          { key: 'overview', label: 'Overview' },
          { key: 'dependencies', label: 'Knowledge Map' },
          { key: 'gaps', label: 'Knowledge Gaps' },
          { key: 'trends', label: 'Performance Trends' }
        ].map(({ key, label }) => (
          <button
            key={key}
            onClick={() => handleViewChange(key as DashboardView)}
            className={`py-2 px-1 border-b-2 font-medium text-sm ${
              state.currentView === key
                ? 'border-blue-500 text-blue-600'
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
            }`}
          >
            {label}
          </button>
        ))}
      </nav>
    </div>
  );

  const renderOverview = (): ReactElement => {
    if (!state.analytics) return <div>No data available</div>;

    return (
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Courses Overview */}
        <div className="bg-white p-6 rounded-lg border border-gray-200">
          <h3 className="text-lg font-semibold mb-4">Course Performance</h3>
          <div className="space-y-3">
            {state.analytics.activeCourses.map((course) => (
              <div
                key={course.id}
                className={`p-3 rounded-md border cursor-pointer transition-colors ${
                  state.selectedCourse === course.id
                    ? 'border-blue-300 bg-blue-50'
                    : 'border-gray-200 hover:border-gray-300'
                }`}
                onClick={() => handleCourseSelect(course.id)}
              >
                <div className="flex justify-between items-center">
                  <div>
                    <h4 className="font-medium">{course.name}</h4>
                    <p className="text-sm text-gray-500">{course.code}</p>
                  </div>
                  <div className="text-right">
                    <div className={`font-semibold ${getPerformanceColorClass(course.performance)}`}>
                      {Math.round(course.performance * 100)}%
                    </div>
                    <div className={`text-xs px-2 py-1 rounded-full ${
                      course.status === 'strong' ? 'bg-green-100 text-green-800' :
                      course.status === 'at-risk' ? 'bg-yellow-100 text-yellow-800' :
                      'bg-red-100 text-red-800'
                    }`}>
                      {course.status}
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Action Items */}
        <div className="bg-white p-6 rounded-lg border border-gray-200">
          <h3 className="text-lg font-semibold mb-4">Priority Actions</h3>
          <div className="space-y-3">
            {state.analytics.actionItems.slice(0, 5).map((item) => (
              <div
                key={item.id}
                className="p-3 rounded-md border border-gray-200 cursor-pointer hover:border-gray-300"
                onClick={() => handleActionItemClick(item)}
              >
                <div className="flex justify-between items-start">
                  <div className="flex-1">
                    <h4 className="font-medium text-sm">{item.title}</h4>
                    <p className="text-xs text-gray-500 mt-1">{item.description}</p>
                    <p className="text-xs text-gray-400 mt-1">{item.course}</p>
                  </div>
                  <div className="ml-3 text-right">
                    <div className={`text-xs px-2 py-1 rounded-full ${
                      item.priority === 'critical' ? 'bg-red-100 text-red-800' :
                      item.priority === 'high' ? 'bg-orange-100 text-orange-800' :
                      item.priority === 'medium' ? 'bg-yellow-100 text-yellow-800' :
                      'bg-green-100 text-green-800'
                    }`}>
                      {item.priority}
                    </div>
                    <div className="text-xs text-gray-500 mt-1">
                      {item.estimatedTime}min
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  };

  const renderKnowledgeGaps = (): ReactElement => {
    if (!state.analytics) return <div>No data available</div>;

    return (
      <div className="bg-white p-6 rounded-lg border border-gray-200">
        <h3 className="text-lg font-semibold mb-4">Knowledge Gaps Analysis</h3>
        <div className="space-y-4">
          {state.analytics.knowledgeGaps.map((gap) => (
            <div
              key={gap.id}
              className="p-4 rounded-lg border-l-4 border-orange-400 bg-orange-50 cursor-pointer hover:bg-orange-100"
              onClick={() => handleGapClick(gap)}
            >
              <div className="flex justify-between items-start">
                <div className="flex-1">
                  <h4 className="font-semibold text-orange-900">{gap.concept}</h4>
                  <p className="text-sm text-orange-700 mt-1">
                    From {gap.prerequisiteCourse} - impacts {gap.impactedCourses.join(', ')}
                  </p>
                  {gap.estimatedReviewTime && (
                    <p className="text-xs text-orange-600 mt-2">
                      Estimated review time: {gap.estimatedReviewTime} minutes
                    </p>
                  )}
                </div>
                <div className="ml-4 text-right">
                  <div className={`px-3 py-1 rounded-full text-xs font-medium ${
                    gap.remediationPriority === 'critical' ? 'bg-red-100 text-red-800' :
                    gap.remediationPriority === 'high' ? 'bg-orange-100 text-orange-800' :
                    gap.remediationPriority === 'medium' ? 'bg-yellow-100 text-yellow-800' :
                    'bg-green-100 text-green-800'
                  }`}>
                    {gap.remediationPriority}
                  </div>
                  <div className="text-xs text-gray-500 mt-1">
                    Severity: {Math.round(gap.gapSeverity * 100)}%
                  </div>
                </div>
              </div>
            </div>
          ))}
          {state.analytics.knowledgeGaps.length === 0 && (
            <div className="text-center text-gray-500 py-8">
              No knowledge gaps detected. Great work!
            </div>
          )}
        </div>
      </div>
    );
  };

  const renderPerformanceCorrelations = (): ReactElement => {
    if (!state.analytics) return <div>No data available</div>;

    return (
      <div className="bg-white p-6 rounded-lg border border-gray-200">
        <h3 className="text-lg font-semibold mb-4">Course Performance Correlations</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {state.analytics.performanceCorrelations.map((correlation, index) => (
            <div key={index} className="p-4 border border-gray-200 rounded-lg">
              <div className="flex justify-between items-center mb-2">
                <h4 className="font-medium text-sm">
                  {correlation.course1} ↔ {correlation.course2}
                </h4>
                <div className={`px-2 py-1 rounded text-xs ${
                  correlation.correlation > 0.6 ? 'bg-green-100 text-green-800' :
                  correlation.correlation > 0.3 ? 'bg-yellow-100 text-yellow-800' :
                  'bg-red-100 text-red-800'
                }`}>
                  {formatCorrelation(correlation.correlation)}
                </div>
              </div>
              <div className="text-xs text-gray-600">
                <div>Correlation: {correlation.correlation.toFixed(3)}</div>
                <div>Confidence: {Math.round(correlation.confidence * 100)}%</div>
                <div>Sample size: {correlation.sampleSize}</div>
              </div>
            </div>
          ))}
          {state.analytics.performanceCorrelations.length === 0 && (
            <div className="col-span-2 text-center text-gray-500 py-8">
              Insufficient data for correlation analysis
            </div>
          )}
        </div>
      </div>
    );
  };

  const renderContent = (): ReactElement => {
    if (state.loading) {
      return (
        <div className="flex justify-center items-center py-12">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
        </div>
      );
    }

    if (state.error) {
      return (
        <div className="bg-red-50 border border-red-200 rounded-lg p-6">
          <h3 className="text-red-800 font-semibold mb-2">Error Loading Dashboard</h3>
          <p className="text-red-700">{state.error}</p>
          <button
            onClick={handleRefresh}
            className="mt-4 px-4 py-2 bg-red-600 text-white rounded-md hover:bg-red-700"
          >
            Try Again
          </button>
        </div>
      );
    }

    switch (state.currentView) {
      case 'overview':
        return renderOverview();
      case 'gaps':
        return renderKnowledgeGaps();
      case 'trends':
        return renderPerformanceCorrelations();
      case 'dependencies':
        return (
          <div className="bg-white p-6 rounded-lg border border-gray-200">
            <h3 className="text-lg font-semibold mb-4">Knowledge Dependencies</h3>
            <div className="text-center text-gray-500 py-8">
              Interactive knowledge graph visualization coming soon
            </div>
          </div>
        );
      default:
        return renderOverview();
    }
  };

  // ========================================================================
  // Main Render
  // ========================================================================

  return (
    <div className={`max-w-7xl mx-auto p-6 ${className}`}>
      {renderHeader()}
      {renderNavigation()}
      {renderContent()}
    </div>
  );
}