/**
 * @fileoverview Header component for deep linking workflow
 * @module features/assessment/client/components/DeepLinkingHeader
 */

import { ReactElement } from 'react';
import styles from './DeepLinkingHeader.module.css';

interface DeepLinkingHeaderProps {
  currentStep: 'build' | 'preview' | 'submitting';
  onStepChange: (step: string) => void;
}

/**
 * Header component showing deep linking workflow steps
 */
export function DeepLinkingHeader({ currentStep, onStepChange }: DeepLinkingHeaderProps): ReactElement {
  return (
    <div className={styles.header}>
      <h1>Create AI-Powered Assessment</h1>
      <div className={styles.steps}>
        <button
          className={`${styles.step} ${currentStep === 'build' ? styles.active : ''}`}
          onClick={() => onStepChange('build')}
          disabled={currentStep === 'submitting'}
        >
          <span className={styles.stepNumber}>1</span>
          <span>Build Assessment</span>
        </button>
        <div className={styles.stepDivider} />
        <button
          className={`${styles.step} ${currentStep === 'preview' ? styles.active : ''}`}
          onClick={() => onStepChange('preview')}
          disabled={currentStep === 'submitting'}
        >
          <span className={styles.stepNumber}>2</span>
          <span>Preview & Submit</span>
        </button>
      </div>
    </div>
  );
}
