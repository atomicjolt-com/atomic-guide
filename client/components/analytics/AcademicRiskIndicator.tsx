/**
 * @fileoverview Academic Risk Indicator component for risk assessment display
 * 
 * Implements real-time academic risk scoring visualization, risk factor breakdown
 * with cross-course gap analysis, trend analysis for risk score changes over time,
 * and intervention recommendation display with priority scoring.
 */

import React, { useState, useEffect, useCallback } from 'react';
import type { ReactElement } from 'react';
import {
  RiskFactor,
  InterventionRecommendation,
  TimeSeriesDataPoint,
  StudentId
} from '../../features/cross-course-intelligence/shared/types';

// ============================================================================
// Component Props and State Interfaces
// ============================================================================

interface AcademicRiskIndicatorProps {
  studentId: StudentId;
  currentRiskScore: number;
  riskFactors?: RiskFactor[];
  interventionRecommendations?: InterventionRecommendation[];
  onInterventionClick?: (recommendation: InterventionRecommendation) => void;
  onFactorExpand?: (factor: RiskFactor) => void;
  showTrends?: boolean;
  showInterventions?: boolean;
  compact?: boolean;
  className?: string;
}

interface RiskTrendData {
  timeSeries: TimeSeriesDataPoint[];
  trend: 'improving' | 'declining' | 'stable';
  changeRate: number; // Change per week
}

interface ComponentState {
  trendData: RiskTrendData | null;
  expandedFactors: Set<string>;
  loading: boolean;
  error: string | null;
  refreshInterval: NodeJS.Timeout | null;
}

// ============================================================================
// Utility Functions
// ============================================================================

const getRiskLevel = (score: number): 'low' | 'medium' | 'high' | 'critical' => {
  if (score < 0.25) return 'low';
  if (score < 0.5) return 'medium';
  if (score < 0.75) return 'high';
  return 'critical';
};

const getRiskColorClasses = (level: 'low' | 'medium' | 'high' | 'critical'): {
  bg: string;
  text: string;
  border: string;
  progress: string;
} => {
  switch (level) {
    case 'low':
      return {
        bg: 'bg-green-50',
        text: 'text-green-800',
        border: 'border-green-200',
        progress: 'bg-green-500'
      };
    case 'medium':
      return {
        bg: 'bg-yellow-50',
        text: 'text-yellow-800',
        border: 'border-yellow-200',
        progress: 'bg-yellow-500'
      };
    case 'high':
      return {
        bg: 'bg-orange-50',
        text: 'text-orange-800',
        border: 'border-orange-200',
        progress: 'bg-orange-500'
      };
    case 'critical':
      return {
        bg: 'bg-red-50',
        text: 'text-red-800',
        border: 'border-red-200',
        progress: 'bg-red-500'
      };
  }
};

const getTrendIcon = (trend: 'improving' | 'declining' | 'stable'): ReactElement => {
  switch (trend) {
    case 'improving':
      return <span className="text-green-500">↗</span>;
    case 'declining':
      return <span className="text-red-500">↘</span>;
    case 'stable':
      return <span className="text-gray-500">→</span>;
  }
};

const formatTimeframe = (timeframe: RiskFactor['timeframe']): string => {
  switch (timeframe) {
    case 'immediate': return 'Next 1-3 days';
    case 'short_term': return 'Next 1-2 weeks';
    case 'medium_term': return 'Next 1-2 months';
    case 'long_term': return 'Next semester';
  }
};

// ============================================================================
// Main Component
// ============================================================================

/**
 * Academic Risk Indicator Component
 * 
 * Displays real-time academic risk assessment with detailed breakdowns,
 * trend analysis, and actionable intervention recommendations.
 */
export default function AcademicRiskIndicator({
  studentId,
  currentRiskScore,
  riskFactors = [],
  interventionRecommendations = [],
  onInterventionClick,
  onFactorExpand,
  showTrends = true,
  showInterventions = true,
  compact = false,
  className = ''
}: AcademicRiskIndicatorProps): ReactElement {
  const [state, setState] = useState<ComponentState>({
    trendData: null,
    expandedFactors: new Set(),
    loading: false,
    error: null,
    refreshInterval: null
  });

  const riskLevel = getRiskLevel(currentRiskScore);
  const colorClasses = getRiskColorClasses(riskLevel);

  // ========================================================================
  // Data Fetching and State Management
  // ========================================================================

  const fetchTrendData = useCallback(async (): Promise<void> => {
    if (!showTrends) return;
    
    try {
      setState(prev => ({ ...prev, loading: true, error: null }));
      
      const response = await fetch(`/api/cross-course/risk-trends/${studentId}?days=30`, {
        headers: {
          'Authorization': `Bearer ${window.LAUNCH_SETTINGS?.jwt || ''}`
        }
      });

      if (!response.ok) {
        throw new Error('Failed to fetch trend data');
      }

      const trendData = await response.json() as RiskTrendData;
      
      setState(prev => ({
        ...prev,
        trendData,
        loading: false
      }));
    } catch (error) {
      setState(prev => ({
        ...prev,
        loading: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      }));
    }
  }, [studentId, showTrends]);

  useEffect(() => {
    void fetchTrendData();
    
    // Set up auto-refresh for real-time updates
    const interval = setInterval(() => {
      void fetchTrendData();
    }, 300000); // 5 minutes

    setState(prev => ({ ...prev, refreshInterval: interval }));

    return () => {
      if (interval) clearInterval(interval);
    };
  }, [fetchTrendData]);

  // ========================================================================
  // Event Handlers
  // ========================================================================

  const handleFactorToggle = useCallback((factorId: string): void => {
    setState(prev => {
      const newExpanded = new Set(prev.expandedFactors);
      if (newExpanded.has(factorId)) {
        newExpanded.delete(factorId);
      } else {
        newExpanded.add(factorId);
      }
      return { ...prev, expandedFactors: newExpanded };
    });

    const factor = riskFactors.find(f => f.id === factorId);
    if (factor) {
      onFactorExpand?.(factor);
    }
  }, [riskFactors, onFactorExpand]);

  const handleInterventionClick = useCallback((recommendation: InterventionRecommendation): void => {
    onInterventionClick?.(recommendation);
  }, [onInterventionClick]);

  // ========================================================================
  // Render Functions
  // ========================================================================

  const renderRiskScore = (): ReactElement => (
    <div className={`p-4 rounded-lg border ${colorClasses.bg} ${colorClasses.border}`}>
      <div className="flex items-center justify-between mb-3">
        <h3 className={`font-semibold ${colorClasses.text} ${compact ? 'text-sm' : 'text-lg'}`}>
          Academic Risk Score
        </h3>
        {state.trendData && !compact && (
          <div className="flex items-center text-sm">
            {getTrendIcon(state.trendData.trend)}
            <span className="ml-1 text-gray-600">
              {state.trendData.trend} ({state.trendData.changeRate > 0 ? '+' : ''}{Math.round(state.trendData.changeRate * 100)}%/week)
            </span>
          </div>
        )}
      </div>

      <div className="flex items-center mb-3">
        <div className={`text-3xl font-bold ${colorClasses.text} ${compact ? 'text-xl' : ''}`}>
          {Math.round(currentRiskScore * 100)}%
        </div>
        <div className="ml-3 flex-1">
          <div className="text-xs text-gray-600 mb-1 capitalize">
            {riskLevel} Risk
          </div>
          <div className="w-full bg-gray-200 rounded-full h-2">
            <div
              className={`h-2 rounded-full transition-all duration-300 ${colorClasses.progress}`}
              style={{ width: `${currentRiskScore * 100}%` }}
            />
          </div>
        </div>
      </div>

      {!compact && (
        <div className="text-xs text-gray-600">
          Last updated: {new Date().toLocaleTimeString()}
        </div>
      )}
    </div>
  );

  const renderRiskFactors = (): ReactElement => {
    if (riskFactors.length === 0) {
      return (
        <div className="text-center text-gray-500 py-4">
          No specific risk factors identified
        </div>
      );
    }

    return (
      <div className="space-y-3">
        {riskFactors
          .sort((a, b) => b.impact - a.impact) // Sort by impact (highest first)
          .map((factor) => {
            const isExpanded = state.expandedFactors.has(factor.id);
            const impactPercentage = Math.round(factor.impact * 100);
            
            return (
              <div
                key={factor.id}
                className="border border-gray-200 rounded-lg overflow-hidden"
              >
                <div
                  className="p-3 cursor-pointer hover:bg-gray-50 transition-colors"
                  onClick={() => handleFactorToggle(factor.id)}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex-1">
                      <div className="flex items-center">
                        <span className="text-sm font-medium">{factor.description}</span>
                        <div className={`ml-2 px-2 py-1 rounded text-xs ${
                          factor.category === 'prerequisite_gap' ? 'bg-orange-100 text-orange-800' :
                          factor.category === 'performance_trend' ? 'bg-yellow-100 text-yellow-800' :
                          factor.category === 'correlation_issue' ? 'bg-blue-100 text-blue-800' :
                          'bg-purple-100 text-purple-800'
                        }`}>
                          {factor.category.replace('_', ' ')}
                        </div>
                      </div>
                      <div className="text-xs text-gray-500 mt-1">
                        Impact: {impactPercentage}% • Timeframe: {formatTimeframe(factor.timeframe)}
                      </div>
                    </div>
                    <div className="flex items-center ml-3">
                      <div className="text-xs text-gray-500 mr-2">
                        {Math.round(factor.confidence * 100)}% confidence
                      </div>
                      <span className={`transform transition-transform ${isExpanded ? 'rotate-180' : ''}`}>
                        ▼
                      </span>
                    </div>
                  </div>
                </div>

                {isExpanded && (
                  <div className="px-3 pb-3 bg-gray-50 border-t border-gray-200">
                    <div className="text-sm text-gray-700 mb-2">
                      <strong>Affected Courses:</strong> {factor.courses.join(', ')}
                    </div>
                    <div className="w-full bg-gray-200 rounded-full h-1.5 mb-1">
                      <div
                        className="bg-orange-500 h-1.5 rounded-full transition-all duration-300"
                        style={{ width: `${impactPercentage}%` }}
                      />
                    </div>
                    <div className="text-xs text-gray-500">
                      Impact level: {impactPercentage}%
                    </div>
                  </div>
                )}
              </div>
            );
          })}
      </div>
    );
  };

  const renderInterventions = (): ReactElement => {
    if (!showInterventions || interventionRecommendations.length === 0) {
      return (
        <div className="text-center text-gray-500 py-4">
          No intervention recommendations available
        </div>
      );
    }

    const sortedRecommendations = interventionRecommendations
      .sort((a, b) => b.priority - a.priority)
      .slice(0, compact ? 2 : 5);

    return (
      <div className="space-y-3">
        {sortedRecommendations.map((recommendation) => (
          <div
            key={recommendation.id}
            className="p-3 border border-gray-200 rounded-lg cursor-pointer hover:border-blue-300 hover:bg-blue-50 transition-colors"
            onClick={() => handleInterventionClick(recommendation)}
          >
            <div className="flex justify-between items-start mb-2">
              <h4 className="font-medium text-sm">{recommendation.description}</h4>
              <div className="flex items-center ml-3">
                <div className={`px-2 py-1 rounded text-xs ${
                  recommendation.difficulty === 'easy' ? 'bg-green-100 text-green-800' :
                  recommendation.difficulty === 'moderate' ? 'bg-yellow-100 text-yellow-800' :
                  'bg-red-100 text-red-800'
                }`}>
                  {recommendation.difficulty}
                </div>
              </div>
            </div>
            
            <div className="flex items-center justify-between text-xs text-gray-600">
              <span>Priority: {recommendation.priority}/5</span>
              <span>{recommendation.timeCommitment} min</span>
              <span>Effectiveness: {Math.round(recommendation.estimatedEffectiveness * 100)}%</span>
            </div>

            {recommendation.resources && recommendation.resources.length > 0 && (
              <div className="mt-2 text-xs text-blue-600">
                {recommendation.resources.length} resource{recommendation.resources.length > 1 ? 's' : ''} available
              </div>
            )}
          </div>
        ))}
      </div>
    );
  };

  const renderTrends = (): ReactElement => {
    if (!showTrends || !state.trendData || compact) {
      return <div />;
    }

    const recentData = state.trendData.timeSeries.slice(-7); // Last 7 data points

    return (
      <div className="mt-4 p-3 bg-gray-50 rounded-lg">
        <h4 className="text-sm font-medium mb-2">7-Day Risk Trend</h4>
        <div className="flex items-end space-x-1 h-16">
          {recentData.map((point, index) => (
            <div
              key={index}
              className="flex-1 bg-blue-200 rounded-t"
              style={{
                height: `${point.value * 100}%`,
                minHeight: '2px'
              }}
              title={`${point.timestamp.toLocaleDateString()}: ${Math.round(point.value * 100)}%`}
            />
          ))}
        </div>
        <div className="flex justify-between text-xs text-gray-500 mt-1">
          <span>{recentData[0]?.timestamp.toLocaleDateString()}</span>
          <span>{recentData[recentData.length - 1]?.timestamp.toLocaleDateString()}</span>
        </div>
      </div>
    );
  };

  // ========================================================================
  // Main Render
  // ========================================================================

  if (compact) {
    return (
      <div className={`${className}`}>
        {renderRiskScore()}
        {showInterventions && (
          <div className="mt-3">
            <h4 className="text-sm font-medium mb-2">Top Recommendations</h4>
            {renderInterventions()}
          </div>
        )}
      </div>
    );
  }

  return (
    <div className={`space-y-6 ${className}`}>
      {renderRiskScore()}
      {renderTrends()}
      
      {riskFactors.length > 0 && (
        <div>
          <h3 className="text-lg font-semibold mb-3">Risk Factor Analysis</h3>
          {renderRiskFactors()}
        </div>
      )}

      {showInterventions && (
        <div>
          <h3 className="text-lg font-semibold mb-3">Recommended Interventions</h3>
          {renderInterventions()}
        </div>
      )}

      {state.error && (
        <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">
          Error loading additional data: {state.error}
        </div>
      )}
    </div>
  );
}