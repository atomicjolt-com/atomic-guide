/**
 * @fileoverview Deep Linking interface component for LTI 1.3 Deep Linking 2.0
 * Provides UI for instructors to create and embed AI-powered assessments into Canvas
 * @module features/assessment/client/components/DeepLinkingInterface
 */

import { ReactElement, useState, useEffect } from 'react';
import type { LaunchSettings } from '@atomicjolt/lti-client';
import { AssessmentBuilder } from './AssessmentBuilder';
import { AssessmentPreview } from './AssessmentPreview';
import { DeepLinkingHeader } from './DeepLinkingHeader';
import { submitAssessmentDeepLink, canCreateAssessmentLink } from '../services/assessmentDeepLink';
// TODO: Move deepLinkingService to features/assessment when migrating from legacy client
import { setupDeepLinkingButton } from '../../../../../client/services/deepLinkingService';
import type { AssessmentConfig } from '../../shared/schemas/assessment.schema';
import { defaultAssessmentConfig } from '../../shared/schemas/assessment.schema';
import styles from './DeepLinkingInterface.module.css';

/**
 * Props for the Deep Linking Interface component
 */
interface DeepLinkingInterfaceProps {
  /** LTI launch settings containing JWT and deep linking configuration */
  launchSettings: LaunchSettings;
}

/**
 * Main deep linking interface for creating and embedding assessments.
 * Provides a multi-step workflow for instructors to configure AI-powered
 * assessments and embed them into Canvas assignments.
 * 
 * @component
 * @param props - Component props including launch settings
 * @returns Deep linking interface UI
 */
export function DeepLinkingInterface({ 
  launchSettings 
}: DeepLinkingInterfaceProps): ReactElement {
  const [currentStep, setCurrentStep] = useState<'build' | 'preview' | 'submitting'>('build');
  const [assessmentConfig, setAssessmentConfig] = useState<AssessmentConfig>(defaultAssessmentConfig);
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Check if the LMS accepts assessment deep links
  const canCreateAssessment = launchSettings.deepLinking?.accept_types 
    ? canCreateAssessmentLink(launchSettings.deepLinking.accept_types)
    : false;

  // Setup fallback deep linking button if needed
  useEffect(() => {
    if (!canCreateAssessment) {
      const cleanup = setupDeepLinkingButton(launchSettings);
      return cleanup || undefined;
    }
  }, [launchSettings, canCreateAssessment]);

  /**
   * Handles assessment configuration updates
   */
  const handleConfigUpdate = (config: AssessmentConfig): void => {
    setAssessmentConfig(config);
    setError(null);
  };

  /**
   * Handles preview navigation
   */
  const handlePreview = (): void => {
    if (!assessmentConfig.title || assessmentConfig.questions.length === 0) {
      setError('Please add a title and at least one question before previewing');
      return;
    }
    setCurrentStep('preview');
  };

  /**
   * Handles returning to builder from preview
   */
  const handleBackToBuilder = (): void => {
    setCurrentStep('build');
  };

  /**
   * Submits the assessment deep link to Canvas
   */
  const handleSubmit = async (): Promise<void> => {
    if (!launchSettings.jwt || !launchSettings.deepLinking?.deep_link_return_url) {
      setError('Missing required deep linking configuration');
      return;
    }

    setIsSubmitting(true);
    setCurrentStep('submitting');
    setError(null);

    try {
      // Use the current domain as the launch URL
      const launchUrl = `${window.location.origin}/lti/launch/assessment`;
      
      await submitAssessmentDeepLink(
        assessmentConfig,
        launchSettings.jwt,
        launchUrl,
        launchSettings.deepLinking.deep_link_return_url
      );
      
      // Note: submitAssessmentDeepLink will automatically submit the form
      // and redirect back to Canvas
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create assessment link');
      setCurrentStep('preview');
      setIsSubmitting(false);
    }
  };

  // Show fallback interface if LMS doesn't support assessment links
  if (!canCreateAssessment) {
    return (
      <div className={styles.container}>
        <div className={styles.fallbackMessage}>
          <h2>Deep Linking</h2>
          <p>
            Your LMS configuration doesn't support assessment deep links. 
            You can still use the standard deep linking options below.
          </p>
          <button id="deep-linking-button" className={styles.fallbackButton}>
            Create Standard Link
          </button>
        </div>
        <form id="deep-linking-form" method="POST">
          <input type="hidden" id="deep-link-jwt" name="JWT" />
        </form>
      </div>
    );
  }

  return (
    <div className={styles.container}>
      <DeepLinkingHeader 
        currentStep={currentStep}
        onStepChange={(step) => setCurrentStep(step as 'build' | 'preview')}
      />

      {error && (
        <div className={styles.errorMessage} role="alert">
          <span className={styles.errorIcon}>⚠️</span>
          {error}
        </div>
      )}

      {currentStep === 'build' && (
        <AssessmentBuilder
          config={assessmentConfig}
          onConfigChange={handleConfigUpdate}
          onPreview={handlePreview}
          contentContext={launchSettings.customParameters?.content_context}
        />
      )}

      {currentStep === 'preview' && (
        <AssessmentPreview
          config={assessmentConfig}
          onBack={handleBackToBuilder}
          onSubmit={handleSubmit}
          isSubmitting={isSubmitting}
        />
      )}

      {currentStep === 'submitting' && (
        <div className={styles.submittingMessage}>
          <div className={styles.spinner} />
          <p>Creating assessment link and returning to Canvas...</p>
        </div>
      )}

      {/* Hidden form for deep link submission */}
      <form 
        id="deep-linking-form" 
        method="POST" 
        style={{ display: 'none' }}
      >
        <input type="hidden" id="deep-link-jwt" name="JWT" />
      </form>
    </div>
  );
}