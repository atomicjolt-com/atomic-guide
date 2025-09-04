/**
 * @fileoverview Instructor analytics dashboard for assessment performance
 * @module features/assessment/client/components/AssessmentAnalytics
 */

import { ReactElement, useState, useEffect, useCallback } from 'react';
import styles from './AssessmentAnalytics.module.css';

/**
 * Assessment performance data structure
 */
interface AssessmentPerformance {
  assessmentId: string;
  assessmentTitle: string;
  totalAttempts: number;
  averageScore: number;
  medianScore: number;
  completionRate: number;
  averageTimeSpent: number;
  scoreDistribution: Record<string, number>;
  commonStrugglePoints: StrugglePoint[];
}

/**
 * Struggle point data structure
 */
interface StrugglePoint {
  questionId: string;
  questionText: string;
  incorrectAttempts: number;
  averageAttemptsToCorrect: number;
  commonMisconceptions: string[];
}

/**
 * Props for Assessment Analytics component
 */
interface AssessmentAnalyticsProps {
  courseId: string;
  assessmentId?: string;
  jwt: string;
}

/**
 * Instructor analytics dashboard for viewing assessment performance data
 *
 * @component
 * @param props - Component props
 * @returns Assessment analytics dashboard
 */
export function AssessmentAnalytics({ courseId, assessmentId, jwt }: AssessmentAnalyticsProps): ReactElement {
  const [performance, setPerformance] = useState<AssessmentPerformance | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedMetric, setSelectedMetric] = useState<'scores' | 'struggles' | 'time'>('scores');

  /**
   * Fetch assessment performance data from API
   */
  const fetchAssessmentPerformance = useCallback(async (): Promise<void> => {
    try {
      setLoading(true);
      setError(null);

      const url = assessmentId ? `/api/assessments/${assessmentId}/analytics` : `/api/courses/${courseId}/assessment-analytics`;

      const response = await fetch(url, {
        headers: {
          Authorization: `Bearer ${jwt}`,
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        throw new Error('Failed to fetch assessment analytics');
      }

      const data = await response.json();
      setPerformance(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error occurred');
    } finally {
      setLoading(false);
    }
  }, [courseId, assessmentId, jwt]);

  useEffect(() => {
    fetchAssessmentPerformance();
  }, [fetchAssessmentPerformance]);

  /**
   * Export analytics data as CSV
   */
  const exportData = (): void => {
    if (!performance) return;

    const csvData = [
      ['Assessment Analytics Report'],
      ['Assessment:', performance.assessmentTitle],
      ['Total Attempts:', performance.totalAttempts.toString()],
      ['Average Score:', performance.averageScore.toFixed(2)],
      ['Median Score:', performance.medianScore.toFixed(2)],
      ['Completion Rate:', `${(performance.completionRate * 100).toFixed(1)}%`],
      ['Average Time Spent:', `${performance.averageTimeSpent} minutes`],
      [],
      ['Score Distribution:'],
      ...Object.entries(performance.scoreDistribution).map(([range, count]) => [range, count.toString()]),
      [],
      ['Common Struggle Points:'],
      ...performance.commonStrugglePoints.map((point) => [
        point.questionText,
        point.incorrectAttempts.toString(),
        point.averageAttemptsToCorrect.toFixed(1),
      ]),
    ];

    const csv = csvData.map((row) => row.join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `assessment-analytics-${performance.assessmentId}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  };

  if (loading) {
    return (
      <div className={styles.loading}>
        <div className={styles.spinner} />
        <p>Loading assessment analytics...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className={styles.error}>
        <h3>Error Loading Analytics</h3>
        <p>{error}</p>
        <button onClick={fetchAssessmentPerformance} className={styles.retryButton}>
          Retry
        </button>
      </div>
    );
  }

  if (!performance) {
    return (
      <div className={styles.empty}>
        <p>No assessment data available</p>
      </div>
    );
  }

  return (
    <div className={styles.analytics}>
      <header className={styles.header}>
        <h2>Assessment Analytics</h2>
        <button onClick={exportData} className={styles.exportButton}>
          Export Data
        </button>
      </header>

      <div className={styles.summary}>
        <div className={styles.metric}>
          <span className={styles.metricLabel}>Total Attempts</span>
          <span className={styles.metricValue}>{performance.totalAttempts}</span>
        </div>
        <div className={styles.metric}>
          <span className={styles.metricLabel}>Average Score</span>
          <span className={styles.metricValue}>{performance.averageScore.toFixed(1)}%</span>
        </div>
        <div className={styles.metric}>
          <span className={styles.metricLabel}>Completion Rate</span>
          <span className={styles.metricValue}>{(performance.completionRate * 100).toFixed(1)}%</span>
        </div>
        <div className={styles.metric}>
          <span className={styles.metricLabel}>Avg. Time</span>
          <span className={styles.metricValue}>{performance.averageTimeSpent} min</span>
        </div>
      </div>

      <div className={styles.tabs}>
        <button className={`${styles.tab} ${selectedMetric === 'scores' ? styles.active : ''}`} onClick={() => setSelectedMetric('scores')}>
          Score Distribution
        </button>
        <button
          className={`${styles.tab} ${selectedMetric === 'struggles' ? styles.active : ''}`}
          onClick={() => setSelectedMetric('struggles')}
        >
          Struggle Points
        </button>
        <button className={`${styles.tab} ${selectedMetric === 'time' ? styles.active : ''}`} onClick={() => setSelectedMetric('time')}>
          Time Analysis
        </button>
      </div>

      <div className={styles.content}>
        {selectedMetric === 'scores' && (
          <div className={styles.scoreDistribution}>
            <h3>Score Distribution</h3>
            <div className={styles.chart}>
              {Object.entries(performance.scoreDistribution).map(([range, count]) => (
                <div key={range} className={styles.bar}>
                  <div
                    className={styles.barFill}
                    style={{
                      height: `${(count / Math.max(...Object.values(performance.scoreDistribution))) * 100}%`,
                    }}
                  />
                  <span className={styles.barLabel}>{range}</span>
                  <span className={styles.barValue}>{count}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {selectedMetric === 'struggles' && (
          <div className={styles.strugglePoints}>
            <h3>Common Struggle Points</h3>
            {performance.commonStrugglePoints.length > 0 ? (
              <ul className={styles.struggleList}>
                {performance.commonStrugglePoints.map((point, index) => (
                  <li key={point.questionId} className={styles.struggleItem}>
                    <div className={styles.struggleHeader}>
                      <span className={styles.struggleNumber}>#{index + 1}</span>
                      <span className={styles.struggleQuestion}>{point.questionText}</span>
                    </div>
                    <div className={styles.struggleStats}>
                      <span>Incorrect attempts: {point.incorrectAttempts}</span>
                      <span>Avg. attempts to correct: {point.averageAttemptsToCorrect.toFixed(1)}</span>
                    </div>
                    {point.commonMisconceptions.length > 0 && (
                      <div className={styles.misconceptions}>
                        <strong>Common misconceptions:</strong>
                        <ul>
                          {point.commonMisconceptions.map((misconception, i) => (
                            <li key={i}>{misconception}</li>
                          ))}
                        </ul>
                      </div>
                    )}
                  </li>
                ))}
              </ul>
            ) : (
              <p className={styles.noData}>No struggle points identified</p>
            )}
          </div>
        )}

        {selectedMetric === 'time' && (
          <div className={styles.timeAnalysis}>
            <h3>Time Analysis</h3>
            <div className={styles.timeMetrics}>
              <div className={styles.timeMetric}>
                <span>Average Time:</span>
                <strong>{performance.averageTimeSpent} minutes</strong>
              </div>
              <div className={styles.timeMetric}>
                <span>Median Score:</span>
                <strong>{performance.medianScore.toFixed(1)}%</strong>
              </div>
            </div>
            <p className={styles.timeInsight}>
              Students who spent more than {performance.averageTimeSpent} minutes typically scored{' '}
              {(performance.averageScore + 10).toFixed(1)}% or higher.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}

export default AssessmentAnalytics;
