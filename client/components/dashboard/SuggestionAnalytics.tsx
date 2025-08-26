/**
 * SuggestionAnalytics Component
 * Dashboard component showing suggestion effectiveness, patterns, and learning progress
 */

import React, { useState, useEffect } from 'react';

export interface SuggestionStats {
  total_shown: number;
  acceptance_rate: number;
  helpful_rate: number;
  top_patterns: Array<{
    pattern: string;
    frequency: number;
    acceptance_rate: number;
  }>;
  avg_effectiveness_score: number;
}

export interface LearningProgress {
  pattern_improvements: Array<{
    pattern: string;
    trend: 'improving' | 'declining' | 'stable';
    change: number;
  }>;
  suggestion_effectiveness: number;
  optimal_timing_learned: boolean;
  total_patterns_analyzed: number;
}

export interface SuggestionAnalyticsData {
  suggestion_stats: SuggestionStats;
  learning_progress: LearningProgress;
  timeframe: string;
  generated_at: string;
}

export interface SuggestionAnalyticsProps {
  role?: 'student' | 'instructor';
  timeframe?: 'day' | 'week' | 'month' | 'semester';
  className?: string;
}

const PATTERN_LABELS = {
  confusion: { label: 'Confusion Detection', icon: '🤔', color: 'blue' },
  frustration: { label: 'Frustration Support', icon: '😤', color: 'red' },
  repetition: { label: 'Repetition Patterns', icon: '🔁', color: 'orange' },
  engagement_decline: { label: 'Engagement Boost', icon: '⚡', color: 'purple' },
  success_opportunity: { label: 'Growth Opportunities', icon: '🌟', color: 'green' }
};

const TIMEFRAME_LABELS = {
  day: 'Last 24 Hours',
  week: 'Last 7 Days',
  month: 'Last 30 Days',
  semester: 'Current Semester'
};

export const SuggestionAnalytics: React.FC<SuggestionAnalyticsProps> = ({
  role = 'student',
  timeframe = 'week',
  className = ''
}) => {
  const [data, setData] = useState<SuggestionAnalyticsData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedTimeframe, setSelectedTimeframe] = useState(timeframe);

  useEffect(() => {
    fetchAnalytics();
  }, [selectedTimeframe, role]);

  const fetchAnalytics = async () => {
    setIsLoading(true);
    setError(null);
    
    try {
      const response = await fetch(`/api/dashboard/suggestions/analytics?timeframe=${selectedTimeframe}&role=${role}`, {
        headers: {
          'X-Tenant-ID': getTenantId(),
          'X-Learner-ID': getLearnerId(),
        },
      });

      if (!response.ok) {
        throw new Error('Failed to fetch analytics');
      }

      const analyticsData = await response.json();
      setData(analyticsData);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
      console.error('Error fetching suggestion analytics:', err);
    } finally {
      setIsLoading(false);
    }
  };

  const getTenantId = (): string => {
    return localStorage.getItem('tenantId') || '';
  };

  const getLearnerId = (): string => {
    return localStorage.getItem('learnerId') || '';
  };

  const formatPercentage = (value: number): string => {
    return `${Math.round(value * 100)}%`;
  };

  const getProgressColor = (trend: string): string => {
    switch (trend) {
      case 'improving': return 'text-green-600 dark:text-green-400';
      case 'declining': return 'text-red-600 dark:text-red-400';
      default: return 'text-gray-600 dark:text-gray-400';
    }
  };

  const getProgressIcon = (trend: string): string => {
    switch (trend) {
      case 'improving': return '↗️';
      case 'declining': return '↘️';
      default: return '➡️';
    }
  };

  const PatternCard: React.FC<{ pattern: any; index: number }> = ({ pattern, index }) => {
    const patternInfo = PATTERN_LABELS[pattern.pattern as keyof typeof PATTERN_LABELS];
    if (!patternInfo) return null;

    return (
      <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-4">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center space-x-2">
            <span className="text-lg" role="img" aria-hidden="true">
              {patternInfo.icon}
            </span>
            <h4 className="font-medium text-gray-900 dark:text-white">
              {patternInfo.label}
            </h4>
          </div>
          <span className="text-sm text-gray-500 dark:text-gray-400">
            #{index + 1}
          </span>
        </div>
        
        <div className="space-y-2">
          <div className="flex justify-between items-center">
            <span className="text-sm text-gray-600 dark:text-gray-300">Frequency</span>
            <span className="font-semibold text-gray-900 dark:text-white">
              {pattern.frequency}
            </span>
          </div>
          <div className="flex justify-between items-center">
            <span className="text-sm text-gray-600 dark:text-gray-300">Acceptance Rate</span>
            <span className="font-semibold text-gray-900 dark:text-white">
              {formatPercentage(pattern.acceptance_rate)}
            </span>
          </div>
        </div>

        {/* Visual progress bar */}
        <div className="mt-3">
          <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2">
            <div 
              className={`h-2 rounded-full bg-${patternInfo.color}-500`}
              style={{ width: formatPercentage(pattern.acceptance_rate) }}
            />
          </div>
        </div>
      </div>
    );
  };

  const MetricCard: React.FC<{ 
    title: string; 
    value: string | number; 
    subtitle?: string; 
    icon: string;
    trend?: 'up' | 'down' | 'stable';
  }> = ({ title, value, subtitle, icon, trend }) => {
    return (
      <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-6">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm font-medium text-gray-600 dark:text-gray-300">
              {title}
            </p>
            <p className="text-2xl font-bold text-gray-900 dark:text-white">
              {typeof value === 'number' ? formatPercentage(value) : value}
            </p>
            {subtitle && (
              <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                {subtitle}
              </p>
            )}
          </div>
          <div className="text-3xl">
            {icon}
          </div>
        </div>
        {trend && (
          <div className={`mt-2 flex items-center space-x-1 ${
            trend === 'up' ? 'text-green-600 dark:text-green-400' :
            trend === 'down' ? 'text-red-600 dark:text-red-400' :
            'text-gray-500 dark:text-gray-400'
          }`}>
            <span className="text-sm">
              {trend === 'up' ? '↗️' : trend === 'down' ? '↘️' : '➡️'}
            </span>
            <span className="text-sm font-medium">
              {trend === 'up' ? 'Improving' : trend === 'down' ? 'Needs attention' : 'Stable'}
            </span>
          </div>
        )}
      </div>
    );
  };

  if (isLoading) {
    return (
      <div className={`suggestion-analytics ${className} flex items-center justify-center p-8`}>
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-yellow-600 mx-auto mb-2"></div>
          <p className="text-gray-600 dark:text-gray-300">Loading analytics...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className={`suggestion-analytics ${className} p-6`}>
        <div className="text-center text-red-600 dark:text-red-400">
          <p className="mb-2">❌ Error loading analytics</p>
          <p className="text-sm">{error}</p>
          <button 
            onClick={fetchAnalytics}
            className="mt-4 px-4 py-2 bg-red-100 dark:bg-red-900/20 text-red-700 dark:text-red-300 rounded-lg hover:bg-red-200 dark:hover:bg-red-900/40 transition-colors"
          >
            Try Again
          </button>
        </div>
      </div>
    );
  }

  if (!data || data.suggestion_stats.total_shown === 0) {
    return (
      <div className={`suggestion-analytics ${className} p-6`}>
        <div className="text-center text-gray-600 dark:text-gray-300">
          <p className="text-4xl mb-4">📊</p>
          <p className="mb-2">No suggestion data available</p>
          <p className="text-sm">Start using the AI chat to see your learning analytics!</p>
        </div>
      </div>
    );
  }

  return (
    <div className={`suggestion-analytics ${className} space-y-6`}>
      {/* Header with timeframe selector */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-gray-900 dark:text-white">
            {role === 'instructor' ? 'Course' : 'Learning'} Suggestion Analytics
          </h2>
          <p className="text-gray-600 dark:text-gray-300 text-sm">
            {TIMEFRAME_LABELS[selectedTimeframe as keyof typeof TIMEFRAME_LABELS]}
          </p>
        </div>
        
        <select
          value={selectedTimeframe}
          onChange={(e) => setSelectedTimeframe(e.target.value)}
          className="px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:ring-2 focus:ring-yellow-500 dark:focus:ring-yellow-600"
        >
          {Object.entries(TIMEFRAME_LABELS).map(([value, label]) => (
            <option key={value} value={value}>{label}</option>
          ))}
        </select>
      </div>

      {/* Key Metrics */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <MetricCard
          title="Total Suggestions"
          value={data.suggestion_stats.total_shown}
          icon="💡"
          subtitle="Shown during timeframe"
        />
        
        <MetricCard
          title="Acceptance Rate"
          value={data.suggestion_stats.acceptance_rate}
          icon="✅"
          trend={data.suggestion_stats.acceptance_rate > 0.4 ? 'up' : 
                data.suggestion_stats.acceptance_rate > 0.2 ? 'stable' : 'down'}
        />
        
        <MetricCard
          title="Helpfulness"
          value={data.suggestion_stats.helpful_rate}
          icon="👍"
          trend={data.suggestion_stats.helpful_rate > 0.6 ? 'up' : 
                data.suggestion_stats.helpful_rate > 0.4 ? 'stable' : 'down'}
        />
        
        <MetricCard
          title="Learning Progress"
          value={data.learning_progress.suggestion_effectiveness}
          icon="📈"
          subtitle="Overall effectiveness"
          trend={data.learning_progress.suggestion_effectiveness > 0.7 ? 'up' : 
                data.learning_progress.suggestion_effectiveness > 0.5 ? 'stable' : 'down'}
        />
      </div>

      {/* Pattern Analysis */}
      <div className="space-y-4">
        <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
          Most Common Patterns
        </h3>
        
        {data.suggestion_stats.top_patterns.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {data.suggestion_stats.top_patterns.map((pattern, index) => (
              <PatternCard key={pattern.pattern} pattern={pattern} index={index} />
            ))}
          </div>
        ) : (
          <div className="text-center text-gray-600 dark:text-gray-300 py-8">
            <p>No patterns detected yet</p>
            <p className="text-sm mt-1">Continue using the chat to build your learning profile</p>
          </div>
        )}
      </div>

      {/* Learning Improvements */}
      <div className="space-y-4">
        <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
          Learning Improvements
        </h3>
        
        <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-6">
          {data.learning_progress.pattern_improvements.length > 0 ? (
            <div className="space-y-4">
              {data.learning_progress.pattern_improvements.map((improvement) => (
                <div key={improvement.pattern} className="flex items-center justify-between">
                  <div className="flex items-center space-x-3">
                    <span className="text-lg" role="img" aria-hidden="true">
                      {PATTERN_LABELS[improvement.pattern as keyof typeof PATTERN_LABELS]?.icon || '📊'}
                    </span>
                    <span className="font-medium text-gray-900 dark:text-white">
                      {PATTERN_LABELS[improvement.pattern as keyof typeof PATTERN_LABELS]?.label || improvement.pattern}
                    </span>
                  </div>
                  <div className="flex items-center space-x-2">
                    <span className={getProgressColor(improvement.trend)}>
                      {getProgressIcon(improvement.trend)}
                    </span>
                    <span className={`text-sm font-medium ${getProgressColor(improvement.trend)}`}>
                      {improvement.trend}
                    </span>
                  </div>
                </div>
              ))}
              
              {data.learning_progress.optimal_timing_learned && (
                <div className="mt-4 p-3 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg">
                  <div className="flex items-center space-x-2">
                    <span className="text-green-600 dark:text-green-400">🎯</span>
                    <span className="text-sm font-medium text-green-800 dark:text-green-200">
                      Optimal suggestion timing learned!
                    </span>
                  </div>
                  <p className="text-sm text-green-700 dark:text-green-300 mt-1">
                    The system has learned your preferences and will show suggestions at the most helpful times.
                  </p>
                </div>
              )}
            </div>
          ) : (
            <div className="text-center text-gray-600 dark:text-gray-300 py-4">
              <p>Building your learning profile...</p>
              <p className="text-sm mt-1">More data needed to show improvement trends</p>
            </div>
          )}
        </div>
      </div>

      {/* Footer */}
      <div className="text-center text-xs text-gray-500 dark:text-gray-400 pt-4 border-t border-gray-200 dark:border-gray-700">
        <p>Analytics generated on {new Date(data.generated_at).toLocaleString()}</p>
        <p className="mt-1">
          Based on {data.learning_progress.total_patterns_analyzed} conversation{data.learning_progress.total_patterns_analyzed !== 1 ? 's' : ''} analyzed
        </p>
      </div>
    </div>
  );
};

export default SuggestionAnalytics;