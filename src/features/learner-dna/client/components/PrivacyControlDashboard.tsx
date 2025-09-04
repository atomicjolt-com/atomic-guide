/**
 * @fileoverview Privacy Control Dashboard for Student Privacy Management
 * @module features/learner-dna/client/components/PrivacyControlDashboard
 * 
 * Implements comprehensive student privacy management interface with granular controls,
 * real-time data collection indicators, learning insights display, and transparent
 * privacy impact explanations for FERPA/COPPA/GDPR compliance.
 */

import React, { useState, useEffect, useCallback } from 'react';
import type { ReactElement } from 'react';
import styles from './PrivacyControlDashboard.module.css';
import type {
  LearnerDNAPrivacyConsent,
  PrivacyConsentUpdate,
  LearnerDNAProfile,
  PrivacyImpactScore
} from '../../shared/types';

/**
 * Props for Privacy Control Dashboard component.
 */
interface PrivacyControlDashboardProps {
  /** Current user identifier */
  userId: string;
  /** Tenant identifier */
  tenantId: string;
  /** Callback fired when privacy preferences are updated */
  onPreferencesUpdated?: (preferences: PrivacyConsentUpdate) => void;
  /** Callback fired when data withdrawal is requested */
  onDataWithdrawal?: (reason: string) => void;
  /** Initial privacy consent data */
  initialConsent?: LearnerDNAPrivacyConsent;
  /** Current learner DNA profile for insights display */
  learnerProfile?: LearnerDNAProfile;
  /** Whether user is under 13 (COPPA compliance) */
  requiresParentalConsent?: boolean;
}

/**
 * Comprehensive Privacy Control Dashboard for learner DNA data management.
 * 
 * Provides students with complete transparency and control over their cognitive
 * data collection with clear explanations of privacy impacts and educational benefits.
 * 
 * Features:
 * - Granular privacy preference controls (minimal, standard, comprehensive)
 * - Real-time data collection activity indicators
 * - Learning insights dashboard with privacy context
 * - Data sharing controls for course-level analytics
 * - Privacy impact explanations with risk/benefit analysis
 * - One-click data withdrawal with impact explanations
 * - COPPA-compliant parental consent workflows
 * 
 * @component
 * @example
 * ```tsx
 * <PrivacyControlDashboard
 *   userId="user-123"
 *   tenantId="tenant-456"
 *   onPreferencesUpdated={(prefs) => console.log('Updated:', prefs)}
 *   requiresParentalConsent={false}
 * />
 * ```
 */
export function PrivacyControlDashboard({
  userId,
  tenantId,
  onPreferencesUpdated,
  onDataWithdrawal,
  initialConsent,
  learnerProfile,
  requiresParentalConsent = false
}: PrivacyControlDashboardProps): ReactElement {
  const [consent, setConsent] = useState<LearnerDNAPrivacyConsent | null>(initialConsent || null);
  const [activeTab, setActiveTab] = useState<'preferences' | 'insights' | 'activity' | 'data'>('preferences');
  const [isLoading, setIsLoading] = useState(false);
  const [showWithdrawalModal, setShowWithdrawalModal] = useState(false);
  const [withdrawalReason, setWithdrawalReason] = useState('');
  const [screenReaderMessage, setScreenReaderMessage] = useState('');
  const [dataCollectionActivity, setDataCollectionActivity] = useState<Array<{
    type: string;
    timestamp: Date;
    purpose: string;
  }>>([]);

  // Privacy impact scoring for different data collection levels
  const privacyImpactScores: Record<string, PrivacyImpactScore> = {
    minimal: {
      dataType: 'Basic Learning Analytics',
      sensitivityLevel: 'low',
      reidentificationRisk: 0.2,
      educationalBenefit: 0.6,
      mitigationMeasures: [
        'Automatic anonymization after 30 days',
        'No cross-course correlation',
        'Aggregated insights only'
      ]
    },
    standard: {
      dataType: 'Enhanced Cognitive Profiling',
      sensitivityLevel: 'medium',
      reidentificationRisk: 0.4,
      educationalBenefit: 0.8,
      mitigationMeasures: [
        'Differential privacy protection',
        'Encrypted storage of behavioral data',
        'Limited cross-course analysis',
        'User-controlled data sharing'
      ]
    },
    comprehensive: {
      dataType: 'Advanced Learning DNA Analysis',
      sensitivityLevel: 'high',
      reidentificationRisk: 0.6,
      educationalBenefit: 0.95,
      mitigationMeasures: [
        'Multi-layer anonymization',
        'Zero-knowledge cross-course analysis',
        'Advanced statistical privacy protection',
        'Complete user control over data use'
      ]
    }
  };

  /**
   * Loads current privacy consent and profile data.
   */
  const loadPrivacyData = useCallback(async (): Promise<void> => {
    setIsLoading(true);
    try {
      // In real implementation, this would fetch from API
      const response = await fetch(`/api/learner-dna/privacy-consent/${userId}?tenantId=${tenantId}`);
      if (response.ok) {
        const consentData = await response.json();
        setConsent(consentData);
      }
      
      // Load recent data collection activity
      const activityResponse = await fetch(`/api/learner-dna/activity/${userId}?tenantId=${tenantId}`);
      if (activityResponse.ok) {
        const activity = await activityResponse.json();
        setDataCollectionActivity(activity.map((item: any) => ({
          ...item,
          timestamp: new Date(item.timestamp)
        })));
      }
    } catch (error) {
      console.error('Failed to load privacy data:', error);
    } finally {
      setIsLoading(false);
    }
  }, [userId, tenantId]);

  useEffect(() => {
    loadPrivacyData();
  }, [loadPrivacyData]);

  /**
   * Announces messages to screen readers.
   */
  const announceToScreenReader = (message: string): void => {
    setScreenReaderMessage(message);
    // Clear the message after a brief delay to allow screen readers to announce it
    setTimeout(() => setScreenReaderMessage(''), 1000);
  };

  /**
   * Updates privacy preferences with validation and consent flow.
   */
  const updatePrivacyPreferences = async (updates: Partial<PrivacyConsentUpdate>): Promise<void> => {
    if (!consent) return;
    
    setIsLoading(true);
    try {
      const response = await fetch(`/api/learner-dna/privacy-consent/${userId}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'X-Tenant-ID': tenantId
        },
        body: JSON.stringify(updates)
      });
      
      if (response.ok) {
        const updatedConsent = await response.json();
        setConsent(updatedConsent);
        onPreferencesUpdated?.(updates);
        
        // Announce privacy changes to screen readers
        if (updates.dataCollectionLevel) {
          announceToScreenReader(`Data collection level updated to ${updates.dataCollectionLevel}`);
        }
        if (updates.behavioralTimingConsent !== undefined) {
          announceToScreenReader(`Behavioral timing consent ${updates.behavioralTimingConsent ? 'enabled' : 'disabled'}`);
        }
        if (updates.assessmentPatternsConsent !== undefined) {
          announceToScreenReader(`Assessment patterns consent ${updates.assessmentPatternsConsent ? 'enabled' : 'disabled'}`);
        }
        if (updates.chatInteractionsConsent !== undefined) {
          announceToScreenReader(`Chat interactions consent ${updates.chatInteractionsConsent ? 'enabled' : 'disabled'}`);
        }
        if (updates.crossCourseCorrelationConsent !== undefined) {
          announceToScreenReader(`Cross-course correlation consent ${updates.crossCourseCorrelationConsent ? 'enabled' : 'disabled'}`);
        }
      }
    } catch (error) {
      console.error('Failed to update privacy preferences:', error);
      announceToScreenReader('Failed to update privacy preferences. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  /**
   * Handles complete data withdrawal request.
   */
  const handleDataWithdrawal = async (): Promise<void> => {
    if (!withdrawalReason.trim()) return;
    
    setIsLoading(true);
    try {
      const response = await fetch(`/api/learner-dna/withdraw/${userId}`, {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json',
          'X-Tenant-ID': tenantId
        },
        body: JSON.stringify({ reason: withdrawalReason })
      });
      
      if (response.ok) {
        onDataWithdrawal?.(withdrawalReason);
        setShowWithdrawalModal(false);
        await loadPrivacyData(); // Refresh data
      }
    } catch (error) {
      console.error('Failed to process data withdrawal:', error);
    } finally {
      setIsLoading(false);
    }
  };

  /**
   * Renders granular privacy preference controls.
   */
  const renderPrivacyPreferences = (): ReactElement => (
    <div className={styles.privacyPreferences}>
      <div className={styles.sectionHeader}>
        <h2>Data Collection Preferences</h2>
        <p className={styles.description}>
          Control what data we collect to personalize your learning experience. 
          You can change these settings at any time.
        </p>
      </div>

      {/* Data Collection Level Selector */}
      <fieldset className={styles.collectionLevelSelector}>
        <legend>
          <h3>Data Collection Level</h3>
        </legend>
        <div className={styles.levelOptions} role="radiogroup" aria-labelledby="collection-level-heading">
          {Object.entries(privacyImpactScores).map(([level, impact]) => (
            <div key={level} className={`${styles.levelOption} ${consent?.dataCollectionLevel === level ? styles.selected : ''}`}>
              <label>
                <input
                  type="radio"
                  name="collectionLevel"
                  value={level}
                  checked={consent?.dataCollectionLevel === level}
                  onChange={(e) => updatePrivacyPreferences({ dataCollectionLevel: e.target.value as any })}
                  disabled={isLoading}
                  aria-describedby={`${level}-details`}
                />
                <div className={styles.levelDetails} id={`${level}-details`}>
                  <div className={styles.levelName}>{level.charAt(0).toUpperCase() + level.slice(1)}</div>
                  <div className={styles.levelDescription}>{impact.dataType}</div>
                  <div className={styles.benefitScore}>
                    Educational Benefit: {Math.round(impact.educationalBenefit * 100)}%
                  </div>
                  <div className={styles.privacyRisk}>
                    Privacy Risk: {impact.sensitivityLevel}
                  </div>
                </div>
              </label>
            </div>
          ))}
        </div>
      </fieldset>

      {/* Granular Data Type Controls */}
      <fieldset className={styles.granularControls}>
        <legend>
          <h3>Specific Data Types</h3>
        </legend>
        <div className={styles.dataTypeControls} role="group" aria-labelledby="granular-controls-heading">
          <div className={styles.controlGroup}>
            <label className={styles.controlLabel}>
              <input
                type="checkbox"
                checked={consent?.behavioralTimingConsent || false}
                onChange={(e) => updatePrivacyPreferences({ behavioralTimingConsent: e.target.checked })}
                disabled={isLoading}
                aria-describedby="behavioral-timing-desc"
              />
              <div className={styles.controlInfo}>
                <span className={styles.controlName}>Behavioral Timing Patterns</span>
                <span className={styles.controlDescription} id="behavioral-timing-desc">
                  Response times, session durations, and engagement rhythms
                </span>
                <span className={styles.educationalBenefit}>
                  Helps identify optimal learning pace and engagement patterns
                </span>
              </div>
            </label>
          </div>

          <div className={styles.controlGroup}>
            <label className={styles.controlLabel}>
              <input
                type="checkbox"
                checked={consent?.assessmentPatternsConsent || false}
                onChange={(e) => updatePrivacyPreferences({ assessmentPatternsConsent: e.target.checked })}
                disabled={isLoading}
                aria-describedby="assessment-patterns-desc"
              />
              <div className={styles.controlInfo}>
                <span className={styles.controlName}>Assessment Performance Patterns</span>
                <span className={styles.controlDescription} id="assessment-patterns-desc">
                  Learning velocity, memory retention, and mastery progression
                </span>
                <span className={styles.educationalBenefit}>
                  Enables personalized difficulty adjustment and review timing
                </span>
              </div>
            </label>
          </div>

          <div className={styles.controlGroup}>
            <label className={styles.controlLabel}>
              <input
                type="checkbox"
                checked={consent?.chatInteractionsConsent || false}
                onChange={(e) => updatePrivacyPreferences({ chatInteractionsConsent: e.target.checked })}
                disabled={isLoading}
                aria-describedby="chat-interactions-desc"
              />
              <div className={styles.controlInfo}>
                <span className={styles.controlName}>Chat Interaction Analysis</span>
                <span className={styles.controlDescription} id="chat-interactions-desc">
                  Question types, explanation preferences, and help-seeking patterns
                </span>
                <span className={styles.educationalBenefit}>
                  Improves AI tutoring and identifies comprehension styles
                </span>
              </div>
            </label>
          </div>

          <div className={styles.controlGroup}>
            <label className={styles.controlLabel}>
              <input
                type="checkbox"
                checked={consent?.crossCourseCorrelationConsent || false}
                onChange={(e) => updatePrivacyPreferences({ crossCourseCorrelationConsent: e.target.checked })}
                disabled={isLoading}
                aria-describedby="cross-course-desc"
              />
              <div className={styles.controlInfo}>
                <span className={styles.controlName}>Cross-Course Learning Intelligence</span>
                <span className={styles.controlDescription} id="cross-course-desc">
                  Pattern correlation across different subjects and contexts
                </span>
                <span className={styles.educationalBenefit}>
                  Enables transfer learning insights and holistic academic support
                </span>
              </div>
            </label>
          </div>
        </div>
      </fieldset>

      {/* Parental Consent Section (COPPA Compliance) */}
      {requiresParentalConsent && (
        <fieldset className={styles.parentalConsentSection}>
          <legend>
            <h3>Parental Consent Required</h3>
          </legend>
          <p className={styles.coppaNotice}>
            Since you are under 13, we need parental consent for data collection beyond basic functionality.
          </p>
          
          <div className={styles.parentalEmail}>
            <label htmlFor="parental-email">
              Parent/Guardian Email:
            </label>
            <input
              id="parental-email"
              type="email"
              value={consent?.parentalEmail || ''}
              onChange={(e) => updatePrivacyPreferences({ parentalEmail: e.target.value })}
              placeholder="parent@example.com"
              disabled={isLoading}
              aria-describedby="parental-email-help"
              required
            />
            <div id="parental-email-help" className={styles.helpText}>
              We will send a consent request to this email address
            </div>
          </div>
          
          <div className={styles.consentStatus} aria-live="polite">
            {consent?.parentalConsentGiven ? (
              <div className={styles.consentGiven} role="status">
                <span aria-hidden="true">✅</span> Parental consent received on {consent.consentGivenAt?.toLocaleDateString()}
              </div>
            ) : (
              <div className={styles.consentPending} role="status">
                <span aria-hidden="true">⏳</span> Parental consent email will be sent when you save preferences
              </div>
            )}
          </div>
        </fieldset>
      )}
    </div>
  );

  /**
   * Renders learning insights with privacy context.
   */
  const renderLearningInsights = (): ReactElement => (
    <div className={styles.learningInsights}>
      <div className={styles.sectionHeader}>
        <h2>Your Learning Insights</h2>
        <p className={styles.description}>
          Based on your privacy preferences, here's what we've learned about your learning patterns.
        </p>
      </div>

      {!learnerProfile ? (
        <div className={styles.noInsights} role="status" aria-live="polite">
          <div className={styles.icon} aria-hidden="true">📊</div>
          <h3>Insights Coming Soon</h3>
          <p>
            Once you have enough learning activity, we'll show personalized insights here.
            More data collection permissions will provide richer insights.
          </p>
        </div>
      ) : (
        <div className={styles.insightsGrid} role="group" aria-label="Learning analytics metrics">
          <article className={styles.insightCard}>
            <h3>Learning Velocity</h3>
            <div className={styles.metricValue} aria-label={`Learning velocity: ${learnerProfile.learningVelocityValue.toFixed(1)} times average`}>
              {learnerProfile.learningVelocityValue.toFixed(1)}x
            </div>
            <div className={styles.metricDescription}>
              Your learning speed compared to average
            </div>
            <div className={styles.confidenceIndicator}>
              Confidence: {Math.round(learnerProfile.learningVelocityConfidence * 100)}%
            </div>
          </article>

          <article className={styles.insightCard}>
            <h3>Memory Retention</h3>
            <div className={styles.metricValue} aria-label={`Memory retention: ${Math.round(learnerProfile.memoryRetentionValue * 100)} percent`}>
              {Math.round(learnerProfile.memoryRetentionValue * 100)}%
            </div>
            <div className={styles.metricDescription}>
              Average retention after one week
            </div>
            <div className={styles.confidenceIndicator}>
              Confidence: {Math.round(learnerProfile.memoryRetentionConfidence * 100)}%
            </div>
          </article>

          <article className={styles.insightCard}>
            <h3>Comprehension Styles</h3>
            <div className={styles.stylesList} role="list" aria-label="Learning style preferences">
              {learnerProfile.comprehensionStyles.map((style, index) => (
                <span key={index} className={styles.styleTag} role="listitem">
                  {style}
                </span>
              ))}
            </div>
            <div className={styles.metricDescription}>
              Your preferred learning approaches
            </div>
          </article>

          <article className={styles.insightCard}>
            <h3>Profile Confidence</h3>
            <div className={styles.metricValue} aria-label={`Profile confidence: ${Math.round(learnerProfile.profileConfidence * 100)} percent`}>
              {Math.round(learnerProfile.profileConfidence * 100)}%
            </div>
            <div className={styles.metricDescription}>
              Based on {learnerProfile.totalDataPoints} data points
            </div>
          </article>
        </div>
      )}

      <aside className={styles.insightsPrivacyNotice} role="note">
        <h3>Privacy Notice</h3>
        <p>
          Your insights are generated from {consent?.dataCollectionLevel || 'minimal'} data collection.
          Enable more data types in Privacy Preferences to get richer, more accurate insights.
        </p>
      </aside>
    </div>
  );

  /**
   * Renders real-time data collection activity indicators.
   */
  const renderActivityMonitor = (): ReactElement => (
    <div className={styles.activityMonitor}>
      <div className={styles.sectionHeader}>
        <h2>Data Collection Activity</h2>
        <p className={styles.description}>
          Real-time view of when and why we collect your learning data.
        </p>
      </div>

      <section className={styles.currentActivity}>
        <h3>Currently Active</h3>
        {dataCollectionActivity.filter(activity => 
          Date.now() - activity.timestamp.getTime() < 30000 // Last 30 seconds
        ).length > 0 ? (
          <div className={styles.activeIndicators} role="status" aria-live="polite">
            <div className={styles.activeIndicator}>
              <span className={`${styles.indicatorDot} ${styles.active}`} aria-hidden="true"></span>
              <span>Learning pattern analysis in progress</span>
            </div>
          </div>
        ) : (
          <div className={styles.noActivity} role="status" aria-live="polite">
            <span className={`${styles.indicatorDot} ${styles.inactive}`} aria-hidden="true"></span>
            <span>No current data collection</span>
          </div>
        )}
      </section>

      <section className={styles.recentActivity}>
        <h3>Recent Activity</h3>
        <div className={styles.activityTimeline} role="log" aria-label="Data collection activity history">
          {dataCollectionActivity.slice(0, 10).map((activity, index) => (
            <article key={index} className={styles.activityItem}>
              <time className={styles.activityTime} dateTime={activity.timestamp.toISOString()}>
                {activity.timestamp.toLocaleTimeString()}
              </time>
              <div className={styles.activityDetails}>
                <div className={styles.activityType}>{activity.type}</div>
                <div className={styles.activityPurpose}>{activity.purpose}</div>
              </div>
            </article>
          ))}
          
          {dataCollectionActivity.length === 0 && (
            <div className={styles.noRecentActivity} role="status">
              No recent data collection activity
            </div>
          )}
        </div>
      </section>

      <div className={styles.activityControls}>
        <button
          className={styles.pauseCollectionBtn}
          onClick={() => updatePrivacyPreferences({ dataCollectionLevel: 'minimal' })}
          disabled={isLoading}
          aria-describedby="pause-collection-help"
        >
          Pause Advanced Collection
        </button>
        <div id="pause-collection-help" className={styles.helpText}>
          This will reduce data collection to the minimal level
        </div>
      </div>
    </div>
  );

  /**
   * Renders data management and withdrawal options.
   */
  const renderDataManagement = (): ReactElement => (
    <div className={styles.dataManagement}>
      <div className={styles.sectionHeader}>
        <h2>Data Management</h2>
        <p className={styles.description}>
          Manage your stored data and exercise your privacy rights.
        </p>
      </div>

      <section className={styles.dataSummary}>
        <h3>Your Data Summary</h3>
        <dl className={styles.dataStats} aria-label="Data collection statistics">
          <div className={styles.stat}>
            <dt className={styles.statLabel}>Data Points Collected:</dt>
            <dd className={styles.statValue}>{learnerProfile?.totalDataPoints || 0}</dd>
          </div>
          <div className={styles.stat}>
            <dt className={styles.statLabel}>Profile Created:</dt>
            <dd className={styles.statValue}>
              {learnerProfile?.createdAt?.toLocaleDateString() || 'Not created'}
            </dd>
          </div>
          <div className={styles.stat}>
            <dt className={styles.statLabel}>Last Updated:</dt>
            <dd className={styles.statValue}>
              {learnerProfile?.updatedAt?.toLocaleDateString() || 'Never'}
            </dd>
          </div>
        </dl>
      </section>

      <section className={styles.dataActions}>
        <h3>Data Actions</h3>
        
        <button 
          className={`${styles.actionBtn} ${styles.exportBtn}`} 
          disabled={isLoading}
          aria-describedby="export-help"
        >
          <span aria-hidden="true">📥</span> Export My Data
        </button>
        <div id="export-help" className={styles.helpText}>
          Download a copy of all your collected data
        </div>
        
        <button 
          className={`${styles.actionBtn} ${styles.withdrawalBtn}`}
          onClick={() => setShowWithdrawalModal(true)}
          disabled={isLoading}
          aria-describedby="delete-help"
        >
          <span aria-hidden="true">🗑️</span> Delete All My Data
        </button>
        <div id="delete-help" className={styles.helpText}>
          Permanently remove all your learning data from our systems
        </div>
      </section>

      <aside className={styles.retentionInfo} role="note">
        <h3>Data Retention</h3>
        <p>
          Your data is automatically purged based on your collection level:
        </p>
        <ul>
          <li><strong>Minimal:</strong> 1 year retention</li>
          <li><strong>Standard:</strong> 2 year retention</li>
          <li><strong>Comprehensive:</strong> 3 year retention</li>
        </ul>
        <p>
          You can request immediate deletion at any time using the "Delete All My Data" button above.
        </p>
      </aside>

      {/* Data Withdrawal Modal */}
      {showWithdrawalModal && (
        <div className={styles.modalOverlay} onClick={() => setShowWithdrawalModal(false)}>
          <div className={styles.modal} onClick={(e) => e.stopPropagation()} role="dialog" aria-labelledby="modal-title" aria-describedby="modal-description">
            <div className={styles.modalHeader}>
              <h2 id="modal-title">Delete All Learning Data</h2>
              <button 
                className={styles.modalClose}
                onClick={() => setShowWithdrawalModal(false)}
                aria-label="Close dialog"
              >
                ×
              </button>
            </div>
            
            <div className={styles.modalBody}>
              <div className={styles.withdrawalWarning} role="alert">
                <div className={styles.warningIcon} aria-hidden="true">⚠️</div>
                <div className={styles.warningText} id="modal-description">
                  <strong>This action cannot be undone.</strong>
                  <br />
                  Deleting your data will:
                </div>
              </div>
              
              <ul className={styles.impactList} aria-label="Consequences of data deletion">
                <li>Remove all personalized learning insights</li>
                <li>Reset your cognitive learning profile</li>
                <li>Disable adaptive learning features</li>
                <li>Remove cross-course learning connections</li>
              </ul>
              
              <div className={styles.withdrawalForm}>
                <label htmlFor="withdrawal-reason">
                  Please tell us why you're deleting your data (optional):
                </label>
                <textarea
                  id="withdrawal-reason"
                  value={withdrawalReason}
                  onChange={(e) => setWithdrawalReason(e.target.value)}
                  placeholder="Privacy concerns, switching schools, etc."
                  rows={3}
                  aria-describedby="withdrawal-reason-help"
                />
                <div id="withdrawal-reason-help" className={styles.helpText}>
                  This feedback helps us improve our privacy practices
                </div>
              </div>
            </div>
            
            <div className={styles.modalFooter}>
              <button 
                className={styles.btnSecondary}
                onClick={() => setShowWithdrawalModal(false)}
                disabled={isLoading}
              >
                Cancel
              </button>
              <button 
                className={styles.btnDanger}
                onClick={handleDataWithdrawal}
                disabled={isLoading}
                aria-describedby="delete-button-help"
              >
                {isLoading ? 'Deleting...' : 'Delete My Data'}
              </button>
              <div id="delete-button-help" className={`${styles.helpText} ${styles.screenReaderOnly}`}>
                {isLoading ? 'Data deletion in progress' : 'Permanently delete all your data'}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );

  return (
    <div className={styles.privacyControlDashboard}>
      {/* Screen Reader Announcements */}
      <div aria-live="polite" aria-atomic="true" className={styles.screenReaderOnly}>
        {screenReaderMessage}
      </div>
      
      <div className={styles.dashboardHeader}>
        <h1>Privacy & Learning Data Control</h1>
        <p className={styles.headerDescription}>
          Manage how we collect and use your learning data to personalize your educational experience.
          You have complete control over your privacy.
        </p>
      </div>

      {/* Tab Navigation */}
      <div className={styles.tabNavigation} role="tablist" aria-label="Privacy control sections">
        <button 
          className={`${styles.tab} ${activeTab === 'preferences' ? styles.active : ''}`}
          onClick={() => setActiveTab('preferences')}
          role="tab"
          aria-selected={activeTab === 'preferences'}
          aria-controls="tab-panel-preferences"
          id="tab-preferences"
          tabIndex={activeTab === 'preferences' ? 0 : -1}
        >
          Privacy Preferences
        </button>
        <button 
          className={`${styles.tab} ${activeTab === 'insights' ? styles.active : ''}`}
          onClick={() => setActiveTab('insights')}
          role="tab"
          aria-selected={activeTab === 'insights'}
          aria-controls="tab-panel-insights"
          id="tab-insights"
          tabIndex={activeTab === 'insights' ? 0 : -1}
        >
          Learning Insights
        </button>
        <button 
          className={`${styles.tab} ${activeTab === 'activity' ? styles.active : ''}`}
          onClick={() => setActiveTab('activity')}
          role="tab"
          aria-selected={activeTab === 'activity'}
          aria-controls="tab-panel-activity"
          id="tab-activity"
          tabIndex={activeTab === 'activity' ? 0 : -1}
        >
          Activity Monitor
        </button>
        <button 
          className={`${styles.tab} ${activeTab === 'data' ? styles.active : ''}`}
          onClick={() => setActiveTab('data')}
          role="tab"
          aria-selected={activeTab === 'data'}
          aria-controls="tab-panel-data"
          id="tab-data"
          tabIndex={activeTab === 'data' ? 0 : -1}
        >
          Data Management
        </button>
      </div>

      {/* Tab Content */}
      <div className={styles.tabContent}>
        {isLoading && (
          <div className={styles.loadingOverlay} aria-live="polite" aria-label="Loading privacy data">
            <div className={styles.loadingSpinner} aria-hidden="true"></div>
            <span>Loading...</span>
          </div>
        )}
        
        <div id="tab-panel-preferences" role="tabpanel" aria-labelledby="tab-preferences" hidden={activeTab !== 'preferences'}>
          {activeTab === 'preferences' && renderPrivacyPreferences()}
        </div>
        <div id="tab-panel-insights" role="tabpanel" aria-labelledby="tab-insights" hidden={activeTab !== 'insights'}>
          {activeTab === 'insights' && renderLearningInsights()}
        </div>
        <div id="tab-panel-activity" role="tabpanel" aria-labelledby="tab-activity" hidden={activeTab !== 'activity'}>
          {activeTab === 'activity' && renderActivityMonitor()}
        </div>
        <div id="tab-panel-data" role="tabpanel" aria-labelledby="tab-data" hidden={activeTab !== 'data'}>
          {activeTab === 'data' && renderDataManagement()}
        </div>
      </div>

      {/* Privacy Policy Link */}
      <div className={styles.dashboardFooter}>
        <p>
          Questions about privacy? Read our{' '}
          <a href="/privacy-policy" target="_blank" rel="noopener noreferrer">
            Privacy Policy
          </a>{' '}
          or{' '}
          <a href="/contact" target="_blank" rel="noopener noreferrer">
            contact support
          </a>.
        </p>
      </div>
    </div>
  );
}