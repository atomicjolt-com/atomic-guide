/**
 * @fileoverview Assessment-specific deep linking service for LTI
 * @module client/services/assessmentDeepLink
 */

import type { AssessmentConfig } from '../../shared/schemas/assessment.schema';
import { safeValidateAssessmentConfig } from '../../shared/schemas/assessment.schema';
import { submitDeepLink } from '@shared/client/services/deepLinkingService';
import { LTI_SIGN_DEEP_LINK_PATH } from '../../../../../definitions';

/**
 * LTI Resource Link structure for assessments
 */
export interface LtiResourceLink {
  type: 'ltiResourceLink';
  title: string;
  text?: string;
  url: string;
  lineItem?: {
    scoreMaximum: number;
    label: string;
    resourceId: string;
    tag?: string;
  };
  custom?: Record<string, string>;
  iframe?: {
    width?: number;
    height?: number;
  };
  icon?: {
    url: string;
    width?: number;
    height?: number;
  };
  thumbnail?: {
    url: string;
    width?: number;
    height?: number;
  };
  presentationDocumentTarget?: 'iframe' | 'window' | 'embed';
}

/**
 * Creates an assessment deep link resource
 * @param config - Assessment configuration
 * @param launchUrl - URL where the assessment will be launched
 * @returns LTI Resource Link for the assessment
 */
export function createAssessmentDeepLink(config: AssessmentConfig, launchUrl: string): LtiResourceLink {
  const resourceId = `assessment-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

  return {
    type: 'ltiResourceLink',
    title: config.title || `${config.assessmentType} Assessment`,
    text: config.description || `AI-Guided ${config.assessmentType} assessment with ${config.questions.length} questions`,
    url: launchUrl,
    lineItem: {
      scoreMaximum: config.gradingSchema.maxScore,
      label: config.title || 'AI-Guided Assessment',
      resourceId,
      tag: 'assessment',
    },
    custom: {
      assessment_config: JSON.stringify(config),
      assessment_type: config.assessmentType,
      mastery_threshold: config.masteryThreshold.toString(),
      max_attempts: config.aiGuidance.allowedAttempts.toString(),
      question_count: config.questions.length.toString(),
    },
    iframe: {
      width: 900,
      height: 700,
    },
    presentationDocumentTarget: 'iframe',
  };
}

/**
 * Submits an assessment deep link to the LMS
 * @param config - Assessment configuration
 * @param jwt - Authentication JWT token
 * @param launchUrl - URL where the assessment will be launched
 * @param returnUrl - LMS return URL after submission
 * @returns Promise resolving to the signed JWT
 */
export async function submitAssessmentDeepLink(
  config: AssessmentConfig,
  jwt: string,
  launchUrl: string,
  returnUrl: string
): Promise<string> {
  try {
    // Create the assessment deep link
    const deepLink = createAssessmentDeepLink(config, launchUrl);

    // Sign the deep link with JWT
    const response = await fetch(LTI_SIGN_DEEP_LINK_PATH, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${jwt}`,
      },
      body: JSON.stringify({
        content_items: [deepLink],
      }),
    });

    if (!response.ok) {
      throw new Error(`Failed to sign deep link: ${response.statusText}`);
    }

    const data = await response.json();
    const signedJWT = data.jwt;

    if (!signedJWT) {
      throw new Error('No JWT received from signing endpoint');
    }

    // Submit the signed deep link to the LMS
    submitDeepLink(signedJWT, returnUrl);

    return signedJWT;
  } catch (error) {
    console.error('Error submitting assessment deep link:', error);
    throw error;
  }
}

/**
 * Validates that the LMS accepts ltiResourceLink type
 * @param acceptTypes - Array of accepted content types from LMS
 * @returns True if ltiResourceLink is accepted
 */
export function canCreateAssessmentLink(acceptTypes: string[]): boolean {
  return acceptTypes.includes('ltiResourceLink') || acceptTypes.includes('lti-link') || acceptTypes.includes('LtiDeepLinkingRequest');
}

/**
 * Generates a unique assessment ID
 * @returns Unique assessment identifier
 */
export function generateAssessmentId(): string {
  return `asmt-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
}

/**
 * Extracts assessment configuration from custom parameters
 * @param customParams - Custom parameters from LTI launch
 * @returns Parsed assessment configuration or null
 * @throws {Error} If JSON parsing fails or validation fails
 */
export function extractAssessmentConfig(customParams: Record<string, string>): AssessmentConfig | null {
  try {
    const configString = customParams.assessment_config;
    if (!configString) {
      return null;
    }

    // Parse JSON safely with try-catch specifically for JSON.parse
    let parsedData: unknown;
    try {
      parsedData = JSON.parse(configString);
    } catch (jsonError) {
      console.error('Invalid JSON in assessment configuration:', jsonError);
      return null;
    }

    // Validate with Zod schema
    const validationResult = safeValidateAssessmentConfig(parsedData);

    if (!validationResult.success) {
      console.error('Assessment configuration validation failed:', validationResult.errors);
      return null;
    }

    return validationResult.data;
  } catch (error) {
    console.error('Failed to extract assessment configuration:', error);
    return null;
  }
}

/**
 * Creates a grade passback payload for the assessment
 * @param score - Student's score
 * @param config - Assessment configuration
 * @returns Grade passback payload
 */
export function createGradePassback(
  score: number,
  config: AssessmentConfig
): {
  scoreGiven: number;
  scoreMaximum: number;
  activityProgress: 'Initialized' | 'Started' | 'InProgress' | 'Submitted' | 'Completed';
  gradingProgress: 'NotReady' | 'Failed' | 'Pending' | 'PendingManual' | 'FullyGraded';
  comment?: string;
} {
  const passed = score >= config.gradingSchema.passingScore;
  const masteryAchieved = (score / config.gradingSchema.maxScore) * 100 >= config.masteryThreshold;

  return {
    scoreGiven: score,
    scoreMaximum: config.gradingSchema.maxScore,
    activityProgress: 'Completed',
    gradingProgress: 'FullyGraded',
    comment: `Assessment completed. ${passed ? 'Passed' : 'Did not pass'}. ${masteryAchieved ? 'Mastery achieved.' : 'Mastery not yet achieved.'}`,
  };
}
