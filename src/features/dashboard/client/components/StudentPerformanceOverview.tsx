/**
 * @fileoverview Enhanced student performance overview component for Story 3.3
 * @module features/dashboard/client/components/StudentPerformanceOverview
 */

import React, { useState, useEffect, useRef, Suspense, lazy } from 'react';
import { z } from 'zod';
import styles from '../../styles/components/performance-overview.module.css';
import { PreferencesSync } from '../services/PreferencesSync';

// Lazy load new components for mobile optimization
const BenchmarkComparison = lazy(() => import('./BenchmarkComparison'));
const DataExportInterface = lazy(() => import('./DataExportInterface'));
const SyncStatusIndicator = lazy(() => import('./SyncStatusIndicator'));

/**
 * Schema for student performance data from API
 */
const StudentAnalyticsSchema = z.object({
  profile: z.object({
    id: z.string(),
    tenantId: z.string(),
    studentId: z.string(),
    courseId: z.string(),
    overallMastery: z.number().min(0).max(1),
    learningVelocity: z.number().min(0),
    confidenceLevel: z.number().min(0).max(1),
    performanceData: z.record(z.unknown()),
    lastCalculated: z.string(),
  }).nullable(),
  conceptMasteries: z.array(z.object({
    id: z.string(),
    conceptId: z.string(),
    conceptName: z.string(),
    masteryLevel: z.number().min(0).max(1),
    confidenceScore: z.number().min(0).max(1),
    assessmentCount: z.number().int().min(0),
    improvementTrend: z.enum(['improving', 'stable', 'declining']),
    lastAssessed: z.string(),
  })),
  recommendations: z.array(z.object({
    id: z.string(),
    recommendationType: z.enum(['review', 'practice', 'advance', 'seek_help']),
    priority: z.enum(['high', 'medium', 'low']),
    conceptsInvolved: z.array(z.string()),
    suggestedActions: z.array(z.string()),
    estimatedTimeMinutes: z.number().int().optional(),
    reasoning: z.string(),
    status: z.enum(['active', 'completed', 'dismissed']),
    createdAt: z.string(),
    expiresAt: z.string().optional(),
  })),
  strugglesIdentified: z.array(z.object({
    id: z.string(),
    patternType: z.enum(['misconception', 'knowledge_gap', 'skill_deficit', 'confidence_issue']),
    conceptsInvolved: z.array(z.string()),
    severity: z.number().min(0).max(1),
    detectedAt: z.string(),
    confidenceScore: z.number().min(0).max(1),
  })),
  progressHistory: z.array(z.object({
    date: z.string(),
    overallMastery: z.number().min(0).max(1),
    conceptScores: z.record(z.number()),
  })),
});

type StudentAnalytics = z.infer<typeof StudentAnalyticsSchema>;

interface StudentPerformanceOverviewProps {
  userId: string;
  tenantId: string;
  courseId: string;
  jwt: string;
}

/**
 * Student performance overview component with analytics integration
 * 
 * Displays personalized performance metrics, learning recommendations,
 * concept mastery levels, and progress tracking with visual charts.
 */
export default function StudentPerformanceOverview({
  userId,
  tenantId: _tenantId,
  courseId,
  jwt
}: StudentPerformanceOverviewProps): React.ReactElement {
  const [analytics, setAnalytics] = useState<StudentAnalytics | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedTimeframe, setSelectedTimeframe] = useState<'week' | 'month' | 'semester'>('week');
  const [activeView, setActiveView] = useState<'overview' | 'benchmarks' | 'export'>('overview');
  const [isMobile, setIsMobile] = useState(false);
  const [expandedSections, setExpandedSections] = useState<string[]>(['overview']);
  const [preferencesSync] = useState(() => new PreferencesSync(userId, _tenantId, jwt));
  const containerRef = useRef<HTMLDivElement>(null);

  // Fetch student analytics data
  useEffect(() => {
    const fetchAnalytics = async (): Promise<void> => {
      try {
        setLoading(true);
        setError(null);

        const response = await fetch(
          `/api/analytics/student/${userId}/performance?courseId=${courseId}`,
          {
            headers: {
              'Authorization': `Bearer ${jwt}`,
              'Content-Type': 'application/json',
            },
          }
        );

        if (!response.ok) {
          throw new Error(`Failed to fetch analytics: ${response.statusText}`);
        }

        const data = await response.json();
        
        if (!data.success) {
          throw new Error(data.error || 'Failed to load analytics');
        }

        const validatedData = StudentAnalyticsSchema.parse(data.data);
        setAnalytics(validatedData);

      } catch (err) {
        console.error('Analytics fetch error:', err);
        setError(err instanceof Error ? err.message : 'Failed to load analytics');
      } finally {
        setLoading(false);
      }
    };

    if (userId && courseId && jwt) {
      fetchAnalytics();
    }
  }, [userId, courseId, jwt]);

  // Mobile detection and responsive handling
  useEffect(() => {
    const checkMobile = (): void => {
      setIsMobile(window.innerWidth < 768);
    };

    const handleResize = (): void => {
      checkMobile();
    };

    checkMobile();
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  // Handle section expansion for mobile progressive disclosure
  const toggleSection = (sectionId: string): void => {
    setExpandedSections(prev => 
      prev.includes(sectionId) 
        ? prev.filter(id => id !== sectionId)
        : [...prev, sectionId]
    );
  };

  // Handle view navigation for mobile
  const handleViewChange = (view: 'overview' | 'benchmarks' | 'export'): void => {
    setActiveView(view);
    // Scroll to top on mobile when changing views
    if (isMobile && containerRef.current) {
      containerRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  };

  // Render mobile navigation tabs
  const renderMobileNavigation = (): React.ReactElement => (
    <div className={styles.mobileNavigation}>
      <button
        type="button"
        className={`${styles.navTab} ${activeView === 'overview' ? styles.active : ''}`}
        onClick={() => handleViewChange('overview')}
        aria-pressed={activeView === 'overview'}
      >
        <span className={styles.navIcon}>📊</span>
        <span className={styles.navLabel}>Overview</span>
      </button>
      <button
        type="button"
        className={`${styles.navTab} ${activeView === 'benchmarks' ? styles.active : ''}`}
        onClick={() => handleViewChange('benchmarks')}
        aria-pressed={activeView === 'benchmarks'}
      >
        <span className={styles.navIcon}>📈</span>
        <span className={styles.navLabel}>Compare</span>
      </button>
      <button
        type="button"
        className={`${styles.navTab} ${activeView === 'export' ? styles.active : ''}`}
        onClick={() => handleViewChange('export')}
        aria-pressed={activeView === 'export'}
      >
        <span className={styles.navIcon}>⬇️</span>
        <span className={styles.navLabel}>Export</span>
      </button>
    </div>
  );

  // Render collapsible section header for mobile
  const renderSectionHeader = (
    sectionId: string, 
    title: string, 
    icon?: string
  ): React.ReactElement => (
    <button
      type="button"
      className={`${styles.sectionHeader} ${isMobile ? styles.collapsible : ''}`}
      onClick={() => isMobile && toggleSection(sectionId)}
      aria-expanded={!isMobile || expandedSections.includes(sectionId)}
    >
      {icon && <span className={styles.sectionIcon}>{icon}</span>}
      <h3>{title}</h3>
      {isMobile && (
        <span className={`${styles.expandIcon} ${expandedSections.includes(sectionId) ? styles.expanded : ''}`}>
          ▼
        </span>
      )}
    </button>
  );

  // Handle recommendation actions
  const handleRecommendationAction = async (
    recommendationId: string,
    action: 'completed' | 'dismissed',
    feedback?: string
  ): Promise<void> => {
    try {
      const response = await fetch(`/api/analytics/recommendations/${userId}/action`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${jwt}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          recommendationId,
          action,
          feedback,
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to update recommendation');
      }

      // Refresh analytics data
      window.location.reload();

    } catch (err) {
      console.error('Recommendation action error:', err);
      // Show error notification
    }
  };

  // Render performance metrics cards
  const renderPerformanceMetrics = (): React.ReactElement => {
    if (!analytics?.profile) return <div>No performance data available</div>;

    const { profile } = analytics;

    return (
      <div className={styles.metricsGrid}>
        <div className={styles.metricCard}>
          <div className={styles.metricHeader}>
            <span className={styles.metricIcon}>🎯</span>
            <h3>Overall Mastery</h3>
          </div>
          <div className={styles.metricValue}>
            {Math.round(profile.overallMastery * 100)}%
          </div>
          <div className={styles.metricDescription}>
            Course concepts mastered
          </div>
          <div className={styles.progressBar}>
            <div 
              className={styles.progressFill}
              style={{ width: `${profile.overallMastery * 100}%` }}
            />
          </div>
        </div>

        <div className={styles.metricCard}>
          <div className={styles.metricHeader}>
            <span className={styles.metricIcon}>⚡</span>
            <h3>Learning Velocity</h3>
          </div>
          <div className={styles.metricValue}>
            {profile.learningVelocity.toFixed(1)}
          </div>
          <div className={styles.metricDescription}>
            Concepts per day
          </div>
        </div>

        <div className={styles.metricCard}>
          <div className={styles.metricHeader}>
            <span className={styles.metricIcon}>💪</span>
            <h3>Confidence Level</h3>
          </div>
          <div className={styles.metricValue}>
            {Math.round(profile.confidenceLevel * 100)}%
          </div>
          <div className={styles.metricDescription}>
            Learning confidence
          </div>
          <div className={styles.progressBar}>
            <div 
              className={styles.progressFill}
              style={{ width: `${profile.confidenceLevel * 100}%` }}
            />
          </div>
        </div>

        <div className={styles.metricCard}>
          <div className={styles.metricHeader}>
            <span className={styles.metricIcon}>📚</span>
            <h3>Concepts Tracked</h3>
          </div>
          <div className={styles.metricValue}>
            {analytics.conceptMasteries.length}
          </div>
          <div className={styles.metricDescription}>
            Active learning concepts
          </div>
        </div>
      </div>
    );
  };

  // Render concept mastery chart
  const renderConceptMasteries = (): React.ReactElement => {
    if (!analytics?.conceptMasteries.length) {
      return <div className={styles.emptyState}>No concept data available</div>;
    }

    const sortedConcepts = [...analytics.conceptMasteries]
      .sort((a, b) => a.masteryLevel - b.masteryLevel);

    return (
      <div className={styles.conceptMasteries}>
        <h3>Concept Mastery Levels</h3>
        <div className={styles.conceptsList}>
          {sortedConcepts.map((concept) => (
            <div key={concept.id} className={styles.conceptItem}>
              <div className={styles.conceptHeader}>
                <span className={styles.conceptName}>{concept.conceptName}</span>
                <div className={styles.conceptMeta}>
                  <span className={`${styles.trend} ${styles[concept.improvementTrend]}`}>
                    {concept.improvementTrend === 'improving' ? '↗️' : 
                     concept.improvementTrend === 'declining' ? '↘️' : '→'}
                  </span>
                  <span className={styles.masteryScore}>
                    {Math.round(concept.masteryLevel * 100)}%
                  </span>
                </div>
              </div>
              <div className={styles.conceptProgress}>
                <div 
                  className={`${styles.conceptBar} ${
                    concept.masteryLevel < 0.5 ? styles.low :
                    concept.masteryLevel < 0.8 ? styles.medium : styles.high
                  }`}
                  style={{ width: `${concept.masteryLevel * 100}%` }}
                />
              </div>
              <div className={styles.conceptDetails}>
                <span>{concept.assessmentCount} assessments</span>
                <span>Confidence: {Math.round(concept.confidenceScore * 100)}%</span>
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  };

  // Render learning recommendations
  const renderRecommendations = (): React.ReactElement => {
    if (!analytics?.recommendations.length) {
      return <div className={styles.emptyState}>No recommendations available</div>;
    }

    const activeRecommendations = analytics.recommendations
      .filter(rec => rec.status === 'active')
      .sort((a, b) => {
        const priorityOrder = { high: 3, medium: 2, low: 1 };
        return priorityOrder[b.priority] - priorityOrder[a.priority];
      });

    return (
      <div className={styles.recommendations}>
        <h3>Personalized Learning Recommendations</h3>
        <div className={styles.recommendationsList}>
          {activeRecommendations.map((recommendation) => (
            <div key={recommendation.id} className={styles.recommendationCard}>
              <div className={styles.recommendationHeader}>
                <div className={styles.recommendationType}>
                  <span className={styles.typeIcon}>
                    {recommendation.recommendationType === 'review' ? '📖' :
                     recommendation.recommendationType === 'practice' ? '✏️' :
                     recommendation.recommendationType === 'advance' ? '🚀' : '🆘'}
                  </span>
                  <span className={styles.typeName}>
                    {recommendation.recommendationType.charAt(0).toUpperCase() + 
                     recommendation.recommendationType.slice(1)}
                  </span>
                </div>
                <span className={`${styles.priority} ${styles[recommendation.priority]}`}>
                  {recommendation.priority}
                </span>
              </div>

              <div className={styles.recommendationContent}>
                <p className={styles.reasoning}>{recommendation.reasoning}</p>
                
                <div className={styles.suggestedActions}>
                  <h4>Suggested Actions:</h4>
                  <ul>
                    {recommendation.suggestedActions.map((action, index) => (
                      <li key={index}>{action}</li>
                    ))}
                  </ul>
                </div>

                {recommendation.estimatedTimeMinutes && (
                  <div className={styles.timeEstimate}>
                    ⏱️ Estimated time: {recommendation.estimatedTimeMinutes} minutes
                  </div>
                )}
              </div>

              <div className={styles.recommendationActions}>
                <button
                  className={`${styles.actionBtn} ${styles.complete}`}
                  onClick={() => handleRecommendationAction(recommendation.id, 'completed')}
                >
                  ✅ Mark Complete
                </button>
                <button
                  className={`${styles.actionBtn} ${styles.dismiss}`}
                  onClick={() => handleRecommendationAction(recommendation.id, 'dismissed')}
                >
                  ❌ Dismiss
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  };

  // Render struggle patterns
  const renderStrugglePatterns = (): React.ReactElement => {
    if (!analytics?.strugglesIdentified.length) {
      return <div className={styles.emptyState}>No patterns identified</div>;
    }

    return (
      <div className={styles.strugglePatterns}>
        <h3>Learning Challenges Identified</h3>
        <div className={styles.patternsList}>
          {analytics.strugglesIdentified.map((pattern) => (
            <div key={pattern.id} className={styles.patternCard}>
              <div className={styles.patternHeader}>
                <span className={styles.patternIcon}>
                  {pattern.patternType === 'knowledge_gap' ? '❓' :
                   pattern.patternType === 'skill_deficit' ? '🔧' :
                   pattern.patternType === 'confidence_issue' ? '😟' : '❌'}
                </span>
                <h4>{pattern.patternType.replace('_', ' ').toUpperCase()}</h4>
                <span className={`${styles.severity} ${
                  pattern.severity > 0.7 ? styles.high :
                  pattern.severity > 0.4 ? styles.medium : styles.low
                }`}>
                  {Math.round(pattern.severity * 100)}% severity
                </span>
              </div>
              
              <div className={styles.patternDetails}>
                <p><strong>Concepts involved:</strong> {pattern.conceptsInvolved.join(', ')}</p>
                <p><strong>Detected:</strong> {new Date(pattern.detectedAt).toLocaleDateString()}</p>
                <p><strong>Confidence:</strong> {Math.round(pattern.confidenceScore * 100)}%</p>
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  };

  // Render progress timeline
  const renderProgressTimeline = (): React.ReactElement => {
    if (!analytics?.progressHistory.length) {
      return <div className={styles.emptyState}>No progress history available</div>;
    }

    const timeframeData = analytics.progressHistory
      .slice(selectedTimeframe === 'week' ? -7 : selectedTimeframe === 'month' ? -30 : -90);

    return (
      <div className={styles.progressTimeline}>
        <div className={styles.timelineHeader}>
          <h3>Progress Over Time</h3>
          <div className={styles.timeframeSelector}>
            {(['week', 'month', 'semester'] as const).map(tf => (
              <button
                key={tf}
                className={`${styles.timeframeBtn} ${selectedTimeframe === tf ? styles.active : ''}`}
                onClick={() => setSelectedTimeframe(tf)}
              >
                {tf}
              </button>
            ))}
          </div>
        </div>

        <div className={styles.timeline}>
          {timeframeData.map((point, index) => (
            <div key={index} className={styles.timelinePoint}>
              <div className={styles.pointDate}>
                {new Date(point.date).toLocaleDateString()}
              </div>
              <div 
                className={styles.pointBar}
                style={{ height: `${point.overallMastery * 100}px` }}
              />
              <div className={styles.pointValue}>
                {Math.round(point.overallMastery * 100)}%
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  };

  if (loading) {
    return (
      <div className={styles.performanceOverview}>
        <div className={styles.loading}>
          <div className={styles.spinner}></div>
          <p>Loading your performance analytics...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className={styles.performanceOverview}>
        <div className={styles.error}>
          <h2>Error Loading Analytics</h2>
          <p>{error}</p>
          <button onClick={() => window.location.reload()} className={styles.retryBtn}>
            Try Again
          </button>
        </div>
      </div>
    );
  }

  if (!analytics?.profile) {
    return (
      <div className={styles.performanceOverview}>
        <div className={styles.emptyState}>
          <h2>No Performance Data</h2>
          <p>Complete some assessments to see your analytics!</p>
        </div>
      </div>
    );
  }

  return (
    <div className={styles.performanceOverview} ref={containerRef}>
      <div className={styles.header}>
        <div className={styles.headerTop}>
          <div className={styles.headerContent}>
            <h1>Your Learning Analytics</h1>
            <p className={styles.subtitle}>
              Track your progress and get personalized recommendations
            </p>
            <div className={styles.lastUpdated}>
              Last updated: {new Date(analytics.profile.lastCalculated).toLocaleString()}
            </div>
          </div>
          <div className={styles.headerActions}>
            <Suspense fallback={<div className={styles.syncPlaceholder}>⏳</div>}>
              <SyncStatusIndicator
                preferencesSync={preferencesSync}
                compact={isMobile}
              />
            </Suspense>
          </div>
        </div>
      </div>

      {/* Mobile Navigation */}
      {isMobile && renderMobileNavigation()}

      {/* Content based on active view */}
      {!isMobile || activeView === 'overview' ? (
        <>
          {/* Performance Metrics - Always visible */}
          {renderPerformanceMetrics()}

          {/* Collapsible Sections for Mobile */}
          <div className={styles.sectionsContainer}>
            <section className={`${styles.section} ${styles.collapsibleSection}`}>
              {renderSectionHeader('concepts', 'Concept Mastery', '🎯')}
              {(!isMobile || expandedSections.includes('concepts')) && (
                <div className={styles.sectionContent}>
                  {renderConceptMasteries()}
                </div>
              )}
            </section>

            <section className={`${styles.section} ${styles.collapsibleSection}`}>
              {renderSectionHeader('progress', 'Progress Timeline', '📈')}
              {(!isMobile || expandedSections.includes('progress')) && (
                <div className={styles.sectionContent}>
                  {renderProgressTimeline()}
                </div>
              )}
            </section>

            <section className={`${styles.section} ${styles.collapsibleSection}`}>
              {renderSectionHeader('recommendations', 'Learning Recommendations', '💡')}
              {(!isMobile || expandedSections.includes('recommendations')) && (
                <div className={styles.sectionContent}>
                  {renderRecommendations()}
                </div>
              )}
            </section>

            <section className={`${styles.section} ${styles.collapsibleSection}`}>
              {renderSectionHeader('struggles', 'Learning Challenges', '🎯')}
              {(!isMobile || expandedSections.includes('struggles')) && (
                <div className={styles.sectionContent}>
                  {renderStrugglePatterns()}
                </div>
              )}
            </section>
          </div>
        </>
      ) : null}

      {/* Benchmark Comparison View */}
      {(!isMobile || activeView === 'benchmarks') && (
        <section className={styles.section}>
          <Suspense fallback={
            <div className={styles.loadingSection}>
              <div className={styles.spinner} />
              <p>Loading benchmark comparison...</p>
            </div>
          }>
            <BenchmarkComparison
              userId={userId}
              courseId={courseId}
              jwt={jwt}
            />
          </Suspense>
        </section>
      )}

      {/* Data Export View */}
      {(!isMobile || activeView === 'export') && (
        <section className={styles.section}>
          <Suspense fallback={
            <div className={styles.loadingSection}>
              <div className={styles.spinner} />
              <p>Loading data export interface...</p>
            </div>
          }>
            <DataExportInterface
              userId={userId}
              courseId={courseId}
              jwt={jwt}
            />
          </Suspense>
        </section>
      )}
    </div>
  );
}