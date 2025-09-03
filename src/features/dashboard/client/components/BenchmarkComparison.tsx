/**
 * @fileoverview Benchmark comparison component with privacy-preserving peer analytics for Story 3.4
 * @module features/dashboard/client/components/BenchmarkComparison
 */

import React, { useState, useEffect, useMemo } from 'react';
import { z } from 'zod';
import styles from '../../styles/components/benchmark-comparison.module.css';

/**
 * Schema for benchmark comparison data from API
 */
const BenchmarkDataSchema = z.object({
  studentMetrics: z.object({
    overallMastery: z.number().min(0).max(1),
    conceptMasteries: z.record(z.number().min(0).max(1)),
    learningVelocity: z.number().min(0),
    confidenceLevel: z.number().min(0).max(1),
  }),
  benchmarkData: z.object({
    courseAverages: z.record(z.number()),
    percentileRankings: z.record(z.number()),
    confidenceIntervals: z.record(z.tuple([z.number(), z.number()])),
    sampleSizes: z.record(z.number()),
  }),
  privacyMetadata: z.object({
    anonymizationMethod: z.string(),
    epsilon: z.number(),
    participantCount: z.number(),
    dataFreshness: z.string(),
  }),
});

type BenchmarkData = z.infer<typeof BenchmarkDataSchema>;

/**
 * Privacy consent state schema
 */
const PrivacyConsentSchema = z.object({
  benchmarkOptIn: z.boolean(),
  lastUpdated: z.string(),
  consentVersion: z.string(),
});

type PrivacyConsent = z.infer<typeof PrivacyConsentSchema>;

interface BenchmarkComparisonProps {
  userId: string;
  courseId: string;
  jwt: string;
  onPrivacyOptInChange?: (optedIn: boolean) => void;
  showPrivacyExplanation?: boolean;
}

/**
 * Benchmark comparison component displaying privacy-preserving peer performance comparisons
 * 
 * Uses differential privacy techniques to provide meaningful performance context
 * while protecting individual student privacy through mathematical anonymization.
 * 
 * Features:
 * - Anonymous peer comparison with confidence intervals
 * - Granular privacy consent controls
 * - Statistical transparency with sample size indicators
 * - Mobile-optimized responsive design
 * - Touch-friendly chart interactions
 */
export default function BenchmarkComparison({
  userId,
  courseId,
  jwt,
  onPrivacyOptInChange,
  showPrivacyExplanation = false
}: BenchmarkComparisonProps): React.ReactElement {
  const [benchmarkData, setBenchmarkData] = useState<BenchmarkData | null>(null);
  const [privacyConsent, setPrivacyConsent] = useState<PrivacyConsent | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showDetailedPrivacy, setShowDetailedPrivacy] = useState(showPrivacyExplanation);
  const [selectedMetric, setSelectedMetric] = useState<string>('overallMastery');

  // Available metrics for comparison
  const metrics = useMemo(() => ([
    { 
      key: 'overallMastery', 
      label: 'Overall Mastery', 
      icon: '🎯',
      description: 'Overall course concept mastery'
    },
    { 
      key: 'learningVelocity', 
      label: 'Learning Velocity', 
      icon: '⚡',
      description: 'Concepts mastered per day'
    },
    { 
      key: 'confidenceLevel', 
      label: 'Confidence Level', 
      icon: '💪',
      description: 'Self-reported learning confidence'
    },
  ]), []);

  // Fetch privacy consent status
  useEffect(() => {
    const fetchPrivacyConsent = async (): Promise<void> => {
      try {
        const response = await fetch(`/api/analytics/privacy/consent/${userId}?courseId=${courseId}`, {
          headers: {
            'Authorization': `Bearer ${jwt}`,
            'Content-Type': 'application/json',
          },
        });

        if (!response.ok) {
          throw new Error(`Failed to fetch privacy consent: ${response.statusText}`);
        }

        const data = await response.json();
        if (data.success && data.data) {
          const consent = PrivacyConsentSchema.parse(data.data);
          setPrivacyConsent(consent);
        }
      } catch (err) {
        console.error('Privacy consent fetch error:', err);
        // Default to no consent for safety
        setPrivacyConsent({
          benchmarkOptIn: false,
          lastUpdated: new Date().toISOString(),
          consentVersion: '1.0',
        });
      }
    };

    if (userId && courseId && jwt) {
      fetchPrivacyConsent();
    }
  }, [userId, courseId, jwt]);

  // Fetch benchmark data when consent is available
  useEffect(() => {
    const fetchBenchmarkData = async (): Promise<void> => {
      if (!privacyConsent?.benchmarkOptIn) {
        setLoading(false);
        return;
      }

      try {
        setLoading(true);
        setError(null);

        const response = await fetch(
          `/api/analytics/benchmark/${userId}/${courseId}`,
          {
            headers: {
              'Authorization': `Bearer ${jwt}`,
              'Content-Type': 'application/json',
            },
          }
        );

        if (!response.ok) {
          throw new Error(`Failed to fetch benchmark data: ${response.statusText}`);
        }

        const data = await response.json();
        
        if (!data.success) {
          throw new Error(data.error || 'Failed to load benchmark data');
        }

        const validatedData = BenchmarkDataSchema.parse(data.data);
        setBenchmarkData(validatedData);

      } catch (err) {
        console.error('Benchmark data fetch error:', err);
        setError(err instanceof Error ? err.message : 'Failed to load benchmark data');
      } finally {
        setLoading(false);
      }
    };

    if (privacyConsent) {
      fetchBenchmarkData();
    }
  }, [privacyConsent, userId, courseId, jwt]);

  // Handle privacy consent changes
  const handlePrivacyOptInChange = async (optedIn: boolean): Promise<void> => {
    try {
      const response = await fetch(`/api/analytics/privacy/consent/${userId}`, {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${jwt}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          courseId,
          benchmarkOptIn: optedIn,
          consentVersion: '1.0',
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to update privacy consent');
      }

      const updatedConsent: PrivacyConsent = {
        benchmarkOptIn: optedIn,
        lastUpdated: new Date().toISOString(),
        consentVersion: '1.0',
      };

      setPrivacyConsent(updatedConsent);
      onPrivacyOptInChange?.(optedIn);

      if (!optedIn) {
        setBenchmarkData(null);
      }

    } catch (err) {
      console.error('Privacy consent update error:', err);
      setError('Failed to update privacy preferences');
    }
  };

  // Render privacy consent controls
  const renderPrivacyControls = (): React.ReactElement => (
    <div className={styles.privacyControls}>
      <div className={styles.privacyHeader}>
        <div className={styles.privacyIndicator}>
          <span className={styles.privacyIcon}>🛡️</span>
          <span className={styles.privacyStatus}>Privacy Protected</span>
        </div>
      </div>

      <div className={styles.consentSection}>
        <label className={styles.consentToggle}>
          <input
            type="checkbox"
            checked={privacyConsent?.benchmarkOptIn || false}
            onChange={(e) => handlePrivacyOptInChange(e.target.checked)}
            className={styles.privacyCheckbox}
            aria-label="Include my data in anonymous peer comparisons"
          />
          <span className={styles.checkboxCustom} />
          <span className={styles.consentLabel}>
            Include my data in anonymous peer comparisons
          </span>
        </label>

        <button
          type="button"
          className={styles.privacyExplanationBtn}
          onClick={() => setShowDetailedPrivacy(!showDetailedPrivacy)}
          aria-expanded={showDetailedPrivacy}
        >
          {showDetailedPrivacy ? 'Hide' : 'Learn about'} privacy protection
        </button>
      </div>

      {showDetailedPrivacy && (
        <div className={styles.privacyExplanation}>
          <h4>How Your Privacy is Protected</h4>
          <div className={styles.protectionMethods}>
            <div className={styles.protectionMethod}>
              <span className={styles.methodIcon}>🔢</span>
              <div className={styles.methodContent}>
                <strong>Differential Privacy</strong>
                <p>Mathematical noise prevents individual identification while maintaining statistical accuracy</p>
              </div>
            </div>
            <div className={styles.protectionMethod}>
              <span className={styles.methodIcon}>👥</span>
              <div className={styles.methodContent}>
                <strong>Minimum Sample Sizes</strong>
                <p>Comparisons only appear when at least 10 students participate</p>
              </div>
            </div>
            <div className={styles.protectionMethod}>
              <span className={styles.methodIcon}>📊</span>
              <div className={styles.methodContent}>
                <strong>Statistical Transparency</strong>
                <p>Confidence intervals show the reliability of comparisons</p>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );

  // Render metric comparison chart
  const renderMetricComparison = (): React.ReactElement => {
    if (!benchmarkData || !privacyConsent?.benchmarkOptIn) {
      return <div className={styles.noData}>Enable peer comparisons to see benchmark data</div>;
    }

    const metric = metrics.find(m => m.key === selectedMetric);
    if (!metric) return <div className={styles.noData}>Metric not found</div>;

    const studentValue = benchmarkData.studentMetrics[selectedMetric as keyof typeof benchmarkData.studentMetrics] as number;
    const courseAverage = benchmarkData.benchmarkData.courseAverages[selectedMetric] || 0;
    const percentileRank = benchmarkData.benchmarkData.percentileRankings[selectedMetric] || 0;
    const [confidenceLow, confidenceHigh] = benchmarkData.benchmarkData.confidenceIntervals[selectedMetric] || [0, 1];
    const sampleSize = benchmarkData.benchmarkData.sampleSizes[selectedMetric] || 0;

    return (
      <div className={styles.metricComparison}>
        <div className={styles.metricHeader}>
          <div className={styles.metricTitle}>
            <span className={styles.metricIcon}>{metric.icon}</span>
            <h3>{metric.label}</h3>
          </div>
          <div className={styles.metricSelector}>
            <select
              value={selectedMetric}
              onChange={(e) => setSelectedMetric(e.target.value)}
              className={styles.metricSelect}
              aria-label="Select metric for comparison"
            >
              {metrics.map(m => (
                <option key={m.key} value={m.key}>{m.label}</option>
              ))}
            </select>
          </div>
        </div>

        <div className={styles.comparisonChart}>
          <div className={styles.chartContainer}>
            {/* Your Performance Bar */}
            <div className={styles.performanceBar}>
              <div className={styles.barLabel}>Your Performance</div>
              <div className={styles.barWrapper}>
                <div 
                  className={`${styles.performanceLevel} ${styles.student}`}
                  style={{ width: `${Math.max(studentValue * 100, 5)}%` }}
                >
                  <span className={styles.performanceValue}>
                    {selectedMetric === 'learningVelocity' 
                      ? studentValue.toFixed(1) 
                      : `${Math.round(studentValue * 100)}%`}
                  </span>
                </div>
              </div>
            </div>

            {/* Course Average Bar */}
            <div className={styles.performanceBar}>
              <div className={styles.barLabel}>
                Course Average
                <span className={styles.sampleSize}>({sampleSize} students)</span>
              </div>
              <div className={styles.barWrapper}>
                <div 
                  className={`${styles.performanceLevel} ${styles.average}`}
                  style={{ width: `${Math.max(courseAverage * 100, 5)}%` }}
                >
                  <span className={styles.performanceValue}>
                    {selectedMetric === 'learningVelocity' 
                      ? courseAverage.toFixed(1) 
                      : `${Math.round(courseAverage * 100)}%`}
                  </span>
                </div>
              </div>
            </div>

            {/* Confidence Interval Indicator */}
            <div className={styles.confidenceInterval}>
              <div className={styles.intervalLabel}>95% Confidence Range</div>
              <div className={styles.intervalBar}>
                <div 
                  className={styles.intervalRange}
                  style={{
                    left: `${confidenceLow * 100}%`,
                    width: `${(confidenceHigh - confidenceLow) * 100}%`
                  }}
                />
                <div className={styles.intervalLabels}>
                  <span className={styles.intervalLow}>
                    {selectedMetric === 'learningVelocity' 
                      ? confidenceLow.toFixed(1) 
                      : `${Math.round(confidenceLow * 100)}%`}
                  </span>
                  <span className={styles.intervalHigh}>
                    {selectedMetric === 'learningVelocity' 
                      ? confidenceHigh.toFixed(1) 
                      : `${Math.round(confidenceHigh * 100)}%`}
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* Performance Context */}
          <div className={styles.performanceContext}>
            <div className={styles.percentileInfo}>
              <span className={styles.percentileLabel}>Your Percentile Rank:</span>
              <span className={styles.percentileValue}>
                {Math.round(percentileRank * 100)}th percentile
              </span>
            </div>
            <div className={styles.contextDescription}>
              {percentileRank >= 0.75 ? (
                <span className={styles.contextPositive}>
                  You're performing above most of your peers! 🌟
                </span>
              ) : percentileRank >= 0.50 ? (
                <span className={styles.contextNeutral}>
                  You're performing around the class average 📊
                </span>
              ) : (
                <span className={styles.contextEncouraging}>
                  There's opportunity to improve with focused practice 💪
                </span>
              )}
            </div>
          </div>
        </div>

        {/* Privacy Information */}
        <div className={styles.privacyInfo}>
          <div className={styles.privacyMetadata}>
            <span className={styles.privacyMethod}>
              Privacy Method: {benchmarkData.privacyMetadata.anonymizationMethod}
            </span>
            <span className={styles.privacyStrength}>
              Privacy Strength: ε={benchmarkData.privacyMetadata.epsilon.toFixed(1)}
            </span>
            <span className={styles.dataFreshness}>
              Updated: {new Date(benchmarkData.privacyMetadata.dataFreshness).toLocaleDateString()}
            </span>
          </div>
        </div>
      </div>
    );
  };

  if (loading) {
    return (
      <div className={styles.benchmarkComparison}>
        <div className={styles.loading} role="status" aria-live="polite">
          <div className={styles.spinner} />
          <p>Loading benchmark data...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className={styles.benchmarkComparison}>
        <div className={styles.error}>
          <h3>Error Loading Benchmarks</h3>
          <p>{error}</p>
          <button 
            onClick={() => window.location.reload()} 
            className={styles.retryBtn}
          >
            Try Again
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className={styles.benchmarkComparison}>
      <div className={styles.header}>
        <h2>Peer Performance Comparison</h2>
        <p className={styles.subtitle}>
          See how your progress compares to peers while protecting everyone's privacy
        </p>
      </div>

      {renderPrivacyControls()}

      {privacyConsent?.benchmarkOptIn ? (
        renderMetricComparison()
      ) : (
        <div className={styles.noConsentState}>
          <div className={styles.noConsentIcon}>📊</div>
          <h3>Peer Comparisons Available</h3>
          <p>
            Enable anonymous peer comparisons to see how your performance 
            relates to other students in your course. Your individual data 
            remains completely private.
          </p>
          <button
            type="button"
            className={styles.enableBtn}
            onClick={() => handlePrivacyOptInChange(true)}
          >
            Enable Peer Comparisons
          </button>
        </div>
      )}
    </div>
  );
}