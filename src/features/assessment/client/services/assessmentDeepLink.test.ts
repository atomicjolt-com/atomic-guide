/**
 * @fileoverview Tests for assessment deep link service
 * @module features/assessment/client/services/assessmentDeepLink.test
 */

// Mock modules BEFORE other imports
import { vi } from 'vitest';
vi.mock('@shared/client/services/deepLinkingService', () => ({
  submitDeepLink: vi.fn(),
  signDeepLink: vi.fn(),
}));

import { describe, it, expect, beforeEach, afterEach, MockFactory, TestDataFactory, ServiceTestHarness } from '@/tests/infrastructure';
import {
  createAssessmentDeepLink,
  submitAssessmentDeepLink,
  canCreateAssessmentLink,
  generateAssessmentId,
  extractAssessmentConfig,
  createGradePassback,
} from './assessmentDeepLink';
import type { AssessmentConfig } from '../../shared/schemas/assessment.schema';

import type { MockD1Database, MockKVNamespace, MockQueue } from '@/tests/infrastructure/types/mocks';
// Mock fetch globally
global.fetch = vi.fn();

describe('assessmentDeepLink service', () => {
  const mockAssessmentConfig: AssessmentConfig = {
    assessmentType: 'formative',
    masteryThreshold: 75,
    gradingSchema: {
      type: 'points',
      maxScore: 100,
      passingScore: 70,
    },
    rubric: {
      criteria: [],
    },
    questions: [
      {
        id: '123e4567-e89b-12d3-a456-426614174000',
        text: 'What is React?',
        type: 'short_answer',
        points: 10,
      },
    ],
    aiGuidance: {
      assessmentFocus: 'React fundamentals',
      keyConceptsToTest: ['components', 'props', 'state'],
      allowedAttempts: 2,
    },
    title: 'React Basics Assessment',
    description: 'Test your knowledge of React fundamentals',
    timeLimit: 3600,
    shuffleQuestions: false,
    showFeedback: true,
  };

  beforeEach(async () => {
    // Setup test infrastructure - removed ServiceTestHarness as this tests client-side service functions
    
    
    ;
  
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('createAssessmentDeepLink', () => {
    it('should create a valid LTI resource link', () => {
      const launchUrl = 'https://test.com/launch';
      const result = createAssessmentDeepLink(mockAssessmentConfig, launchUrl);

      expect(result).toMatchObject({
        type: 'ltiResourceLink',
        title: 'React Basics Assessment',
        text: 'Test your knowledge of React fundamentals',
        url: launchUrl,
        lineItem: {
          scoreMaximum: 100,
          label: 'React Basics Assessment',
          resourceId: expect.stringMatching(/^assessment-\d+-[a-z0-9]+$/),
          tag: 'assessment',
        },
        custom: {
          assessment_config: JSON.stringify(mockAssessmentConfig),
          assessment_type: 'formative',
          mastery_threshold: '75',
          max_attempts: '2',
          question_count: '1',
        },
        iframe: {
          width: 900,
          height: 700,
        },
        presentationDocumentTarget: 'iframe',
      });
    });

    it('should use default title when not provided', () => {
      const configWithoutTitle = {
        ...mockAssessmentConfig,
        title: undefined,
      };
      
      const result = createAssessmentDeepLink(configWithoutTitle as AssessmentConfig, 'https://test.com');
      
      expect(result.title).toBe('formative Assessment');
      expect(result.lineItem?.label).toBe('AI-Guided Assessment');
    });

    it('should generate unique resource IDs', () => {
      const link1 = createAssessmentDeepLink(mockAssessmentConfig, 'https://test.com');
      const link2 = createAssessmentDeepLink(mockAssessmentConfig, 'https://test.com');
      
      expect(link1.lineItem?.resourceId).not.toBe(link2.lineItem?.resourceId);
    });
  });

  describe('submitAssessmentDeepLink', () => {
    it('should successfully submit and sign deep link', async () => {
      const mockSignedJWT = 'signed.jwt.token';
      const mockJWT = 'auth.jwt.token';
      const launchUrl = 'https://test.com/launch';
      const returnUrl = 'https://canvas.test/return';

      vi.mocked(global.fetch).mockResolvedValueOnce({
        ok: true,
        json: async () => ({ jwt: mockSignedJWT }),
      } as Response);

      const { submitDeepLink } = await import('@shared/client/services/deepLinkingService');
      
      const result = await submitAssessmentDeepLink(
        mockAssessmentConfig,
        mockJWT,
        launchUrl,
        returnUrl
      );

      expect(result).toBe(mockSignedJWT);
      expect(global.fetch).toHaveBeenCalledWith(
        '/lti/sign_deep_link',
        expect.objectContaining({
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${mockJWT}`,
          },
          body: expect.stringContaining('content_items'),
        })
      );
      expect(submitDeepLink).toHaveBeenCalledWith(mockSignedJWT, returnUrl);
    });

    it('should handle signing endpoint errors', async () => {
      vi.mocked(global.fetch).mockResolvedValueOnce({
        ok: false,
        statusText: 'Unauthorized',
      } as Response);

      await expect(
        submitAssessmentDeepLink(
          mockAssessmentConfig,
          'invalid.jwt',
          'https://test.com',
          'https://canvas.test'
        )
      ).rejects.toThrow('Failed to sign deep link: Unauthorized');
    });

    it('should handle missing JWT in response', async () => {
      vi.mocked(global.fetch).mockResolvedValueOnce({
        ok: true,
        json: async () => ({}),
      } as Response);

      await expect(
        submitAssessmentDeepLink(
          mockAssessmentConfig,
          'auth.jwt',
          'https://test.com',
          'https://canvas.test'
        )
      ).rejects.toThrow('No JWT received from signing endpoint');
    });
  });

  describe('canCreateAssessmentLink', () => {
    it('should return true for ltiResourceLink', () => {
      expect(canCreateAssessmentLink(['ltiResourceLink'])).toBe(true);
    });

    it('should return true for lti-link', () => {
      expect(canCreateAssessmentLink(['lti-link'])).toBe(true);
    });

    it('should return true for LtiDeepLinkingRequest', () => {
      expect(canCreateAssessmentLink(['LtiDeepLinkingRequest'])).toBe(true);
    });

    it('should return false for unsupported types', () => {
      expect(canCreateAssessmentLink(['html', 'image'])).toBe(false);
    });

    it('should return false for empty array', () => {
      expect(canCreateAssessmentLink([])).toBe(false);
    });
  });

  describe('generateAssessmentId', () => {
    it('should generate unique IDs', () => {
      const id1 = generateAssessmentId();
      const id2 = generateAssessmentId();
      
      expect(id1).toMatch(/^asmt-\d+-[a-z0-9]+$/);
      expect(id2).toMatch(/^asmt-\d+-[a-z0-9]+$/);
      expect(id1).not.toBe(id2);
    });
  });

  describe('extractAssessmentConfig', () => {
    it('should extract and validate config from custom params', () => {
      const customParams = {
        assessment_config: JSON.stringify(mockAssessmentConfig),
        other_param: 'value',
      };

      const result = extractAssessmentConfig(customParams);
      
      expect(result).toEqual(mockAssessmentConfig);
    });

    it('should return null for missing config', () => {
      const customParams = {
        other_param: 'value',
      };

      const result = extractAssessmentConfig(customParams);
      
      expect(result).toBeNull();
    });

    it('should handle invalid JSON safely', () => {
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
      
      const customParams = {
        assessment_config: 'not valid json{',
      };

      const result = extractAssessmentConfig(customParams);
      
      expect(result).toBeNull();
      expect(consoleSpy).toHaveBeenCalledWith(
        'Invalid JSON in assessment configuration:',
        expect.any(Error)
      );
      
      consoleSpy.mockRestore();
    });

    it('should handle validation errors', () => {
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
      
      const customParams = {
        assessment_config: JSON.stringify({
          // Invalid config - missing required fields
          assessmentType: 'invalid',
        }),
      };

      const result = extractAssessmentConfig(customParams);
      
      expect(result).toBeNull();
      expect(consoleSpy).toHaveBeenCalledWith(
        'Assessment configuration validation failed:',
        expect.any(Object)
      );
      
      consoleSpy.mockRestore();
    });

    it('should handle JSON injection attempts', () => {
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
      
      // Attempt to inject malicious JSON
      const customParams = {
        assessment_config: '{"__proto__": {"isAdmin": true}, "assessmentType": "formative"}',
      };

      const result = extractAssessmentConfig(customParams);
      
      // Should fail validation due to missing required fields
      expect(result).toBeNull();
      
      consoleSpy.mockRestore();
    });
  });

  describe('createGradePassback', () => {
    it('should create passing grade passback', () => {
      const result = createGradePassback(85, mockAssessmentConfig);
      
      expect(result).toEqual({
        scoreGiven: 85,
        scoreMaximum: 100,
        activityProgress: 'Completed',
        gradingProgress: 'FullyGraded',
        comment: 'Assessment completed. Passed. Mastery achieved.',
      });
    });

    it('should create failing grade passback', () => {
      const result = createGradePassback(50, mockAssessmentConfig);
      
      expect(result).toEqual({
        scoreGiven: 50,
        scoreMaximum: 100,
        activityProgress: 'Completed',
        gradingProgress: 'FullyGraded',
        comment: 'Assessment completed. Did not pass. Mastery not yet achieved.',
      });
    });

    it('should handle passing but not mastery', () => {
      const config = {
        ...mockAssessmentConfig,
        masteryThreshold: 90,
      };
      
      const result = createGradePassback(75, config);
      
      expect(result.comment).toBe('Assessment completed. Passed. Mastery not yet achieved.');
    });

    it('should handle edge case scores', () => {
      const result1 = createGradePassback(0, mockAssessmentConfig);
      expect(result1.scoreGiven).toBe(0);
      expect(result1.comment).toContain('Did not pass');
      
      const result2 = createGradePassback(100, mockAssessmentConfig);
      expect(result2.scoreGiven).toBe(100);
      expect(result2.comment).toContain('Passed');
      expect(result2.comment).toContain('Mastery achieved');
    });
  });
});