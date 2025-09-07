/**
 * @fileoverview Cross-Course Analytics Dashboard Component
 * Displays cross-course knowledge dependencies, gaps, and performance correlations
 * for students to understand their learning journey across multiple courses.
 */

import { ReactElement, useState, useEffect } from 'react';
import type { LaunchSettings } from '@atomicjolt/lti-client';

/**
 * Props for the CrossCourseAnalyticsDashboard component
 */
interface CrossCourseAnalyticsDashboardProps {
  launchSettings: LaunchSettings;
}

/**
 * Types for cross-course analytics data
 */
interface KnowledgeGap {
  id: string;
  concept: string;
  prerequisiteCourse: string;
  impactedCourses: string[];
  gapSeverity: 'low' | 'medium' | 'high' | 'critical';
  remediationPriority: 'low' | 'medium' | 'high' | 'critical';
}

interface CrossCourseAnalytics {
  studentId: string;
  academicRiskScore: number;
  knowledgeGaps: KnowledgeGap[];
  actionItems: Array<{
    id: string;
    type: string;
    description: string;
    priority: string;
    dueDate?: string;
  }>;
  lastUpdated: string;
}

/**
 * Cross-Course Analytics Dashboard Component
 * 
 * Provides students with insights into their cross-course learning performance,
 * knowledge gaps, and recommendations for improvement.
 * 
 * @component
 * @param props - Component properties including launch settings
 * @returns React element for the cross-course analytics dashboard
 */
export function CrossCourseAnalyticsDashboard({ 
  launchSettings 
}: CrossCourseAnalyticsDashboardProps): ReactElement {
  const [analytics, setAnalytics] = useState<CrossCourseAnalytics | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Extract student ID from LTI launch settings
  const studentId = launchSettings.userId || 'current-user';

  /**
   * Fetches cross-course analytics data for the current student
   */
  const fetchAnalytics = async (): Promise<void> => {
    try {
      setLoading(true);
      setError(null);

      const response = await fetch(`/api/cross-course/analytics/${studentId}`, {
        headers: {
          'Authorization': `Bearer ${launchSettings.jwt}`,
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        throw new Error(`Failed to fetch analytics: ${response.statusText}`);
      }

      const data = await response.json() as CrossCourseAnalytics;
      setAnalytics(data);
    } catch (err) {
      console.error('Failed to fetch cross-course analytics:', err);
      setError(err instanceof Error ? err.message : 'Unknown error occurred');
    } finally {
      setLoading(false);
    }
  };

  // Load analytics data on component mount
  useEffect(() => {
    void fetchAnalytics();
  }, [studentId]);

  /**
   * Renders the academic risk score with appropriate styling
   */
  const renderRiskScore = (score: number): ReactElement => {
    const riskLevel = score >= 0.8 ? 'critical' : 
                     score >= 0.6 ? 'high' : 
                     score >= 0.4 ? 'medium' : 'low';
    
    const riskColor = {
      critical: '#dc3545',
      high: '#fd7e14', 
      medium: '#ffc107',
      low: '#28a745'
    }[riskLevel];

    return (
      <div className="risk-score-container">
        <div className="risk-score-label">Academic Risk Score</div>
        <div 
          className={`risk-score-value risk-${riskLevel}`}
          style={{ color: riskColor }}
        >
          {Math.round(score * 100)}%
        </div>
        <div className="risk-score-description">
          {riskLevel === 'critical' && 'Immediate intervention recommended'}
          {riskLevel === 'high' && 'Close monitoring required'}
          {riskLevel === 'medium' && 'Some areas need attention'}
          {riskLevel === 'low' && 'Good progress across courses'}
        </div>
      </div>
    );
  };

  /**
   * Renders a knowledge gap card with impact details
   */
  const renderKnowledgeGap = (gap: KnowledgeGap): ReactElement => {
    const severityColor = {
      critical: '#dc3545',
      high: '#fd7e14',
      medium: '#ffc107', 
      low: '#6c757d'
    }[gap.gapSeverity];

    return (
      <div key={gap.id} className="knowledge-gap-card">
        <div className="gap-header">
          <h4 className="gap-concept">{gap.concept}</h4>
          <span 
            className={`gap-severity severity-${gap.gapSeverity}`}
            style={{ backgroundColor: severityColor }}
          >
            {gap.gapSeverity.toUpperCase()}
          </span>
        </div>
        
        <div className="gap-details">
          <p><strong>Prerequisite Course:</strong> {gap.prerequisiteCourse}</p>
          <p><strong>Impacted Courses:</strong> {gap.impactedCourses.join(', ')}</p>
          <p><strong>Priority:</strong> {gap.remediationPriority}</p>
        </div>
      </div>
    );
  };

  /**
   * Renders an action item with priority styling
   */
  const renderActionItem = (item: typeof analytics.actionItems[0]): ReactElement => {
    return (
      <div key={item.id} className={`action-item priority-${item.priority}`}>
        <div className="action-type">{item.type}</div>
        <div className="action-description">{item.description}</div>
        {item.dueDate && (
          <div className="action-due-date">Due: {new Date(item.dueDate).toLocaleDateString()}</div>
        )}
      </div>
    );
  };

  if (loading) {
    return (
      <div className="cross-course-dashboard loading">
        <div className="loading-spinner"></div>
        <p>Loading cross-course analytics...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="cross-course-dashboard error">
        <h2>Unable to Load Analytics</h2>
        <p>{error}</p>
        <button onClick={fetchAnalytics} className="retry-button">
          Try Again
        </button>
      </div>
    );
  }

  if (!analytics) {
    return (
      <div className="cross-course-dashboard no-data">
        <h2>Cross-Course Analytics</h2>
        <p>No analytics data available at this time.</p>
        <p>Continue engaging with your courses to generate insights.</p>
      </div>
    );
  }

  return (
    <div className="cross-course-dashboard">
      <header className="dashboard-header">
        <h1>Cross-Course Intelligence</h1>
        <p>Understanding your learning journey across multiple courses</p>
        <p className="last-updated">
          Last updated: {new Date(analytics.lastUpdated).toLocaleString()}
        </p>
      </header>

      <div className="dashboard-content">
        {/* Academic Risk Score Section */}
        <section className="risk-score-section">
          {renderRiskScore(analytics.academicRiskScore)}
        </section>

        {/* Knowledge Gaps Section */}
        <section className="knowledge-gaps-section">
          <h2>Knowledge Gaps ({analytics.knowledgeGaps.length})</h2>
          {analytics.knowledgeGaps.length === 0 ? (
            <p className="no-gaps">Great work! No significant knowledge gaps detected.</p>
          ) : (
            <div className="gaps-grid">
              {analytics.knowledgeGaps.map(renderKnowledgeGap)}
            </div>
          )}
        </section>

        {/* Action Items Section */}
        <section className="action-items-section">
          <h2>Recommended Actions ({analytics.actionItems.length})</h2>
          {analytics.actionItems.length === 0 ? (
            <p className="no-actions">No immediate actions required. Keep up the good work!</p>
          ) : (
            <div className="actions-list">
              {analytics.actionItems.map(renderActionItem)}
            </div>
          )}
        </section>
      </div>
    </div>
  );
}