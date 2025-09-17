/**
 * @fileoverview Canvas Content Sanitization Service
 * Provides comprehensive sanitization for Canvas content items and integration data
 * @module features/deep-linking/server/services/CanvasContentSanitizationService
 */

import { z } from 'zod';

/**
 * Sanitization configuration schema
 */
const SanitizationConfigSchema = z.object({
  allowedHtmlTags: z.array(z.string()).default(['p', 'br', 'strong', 'em', 'ul', 'ol', 'li']),
  allowedAttributes: z.array(z.string()).default(['class', 'id']),
  allowedUrlSchemes: z.array(z.string()).default(['https', 'http']),
  maxContentLength: z.number().min(100).max(100000).default(10000),
  maxUrlLength: z.number().min(100).max(2000).default(1000),
  enableDomPurification: z.boolean().default(true),
  enableCspValidation: z.boolean().default(true),
  blockJavaScript: z.boolean().default(true),
  blockExternalResources: z.boolean().default(true),
});

type SanitizationConfig = z.infer<typeof SanitizationConfigSchema>;

/**
 * Content item sanitization result schema
 */
const SanitizationResultSchema = z.object({
  sanitized: z.boolean(),
  content: z.unknown(),
  warnings: z.array(z.object({
    type: z.enum(['malicious_content', 'suspicious_url', 'oversized_content', 'blocked_tag', 'blocked_attribute']),
    message: z.string(),
    originalValue: z.string().optional(),
    sanitizedValue: z.string().optional(),
  })),
  securityFlags: z.array(z.string()),
  contentMetrics: z.object({
    originalSize: z.number(),
    sanitizedSize: z.number(),
    removedElements: z.number(),
    modifiedAttributes: z.number(),
  }),
});

type SanitizationResult = z.infer<typeof SanitizationResultSchema>;

/**
 * Canvas content item schemas for validation
 */
const CanvasContentItemSchema = z.object({
  '@context': z.string().url().optional(),
  '@graph': z.array(z.object({
    '@type': z.enum(['LtiLinkItem', 'ContentItem', 'FileItem']),
    '@id': z.string().optional(),
    mediaType: z.string(),
    title: z.string().max(200),
    text: z.string().max(1000).optional(),
    url: z.string().url(),
    icon: z.object({
      '@id': z.string().url(),
      width: z.number().min(1).max(1000),
      height: z.number().min(1).max(1000),
    }).optional(),
    lineItem: z.object({
      scoreMaximum: z.number().min(0).max(10000),
      label: z.string().max(200),
      resourceId: z.string().max(200),
      tag: z.string().max(100).optional(),
    }).optional(),
    custom: z.record(z.string(), z.string()).optional(),
    iframe: z.object({
      width: z.number().min(100).max(2000),
      height: z.number().min(100).max(2000),
    }).optional(),
  })),
});

type CanvasContentItem = z.infer<typeof CanvasContentItemSchema>;

/**
 * Security threat patterns for detection
 */
const SECURITY_PATTERNS = {
  JAVASCRIPT_INJECTION: [
    /javascript:/gi,
    /on\w+\s*=/gi,
    /<script\b/gi,
    /eval\s*\(/gi,
    /setTimeout\s*\(/gi,
    /setInterval\s*\(/gi,
  ],
  XSS_PATTERNS: [
    /<iframe\b[^>]*src\s*=\s*["']?(?!https?:\/\/[\w-]+\.instructure\.com)/gi,
    /<object\b/gi,
    /<embed\b/gi,
    /<applet\b/gi,
    /<meta\b[^>]*http-equiv/gi,
  ],
  URL_INJECTION: [
    /data:/gi,
    /vbscript:/gi,
    /file:/gi,
    /ftp:/gi,
  ],
  SUSPICIOUS_ATTRIBUTES: [
    /srcdoc\s*=/gi,
    /formaction\s*=/gi,
    /background\s*=/gi,
  ],
};

/**
 * Canvas Content Sanitization Service
 *
 * Provides comprehensive sanitization and security validation for Canvas content items:
 * - XSS and injection attack prevention
 * - Malicious URL detection and blocking
 * - Content size and format validation
 * - Canvas-specific security compliance
 * - LTI Deep Linking content item validation
 */
export class CanvasContentSanitizationService {
  private readonly config: SanitizationConfig;

  constructor(config: Partial<SanitizationConfig> = {}) {
    this.config = SanitizationConfigSchema.parse(config);
  }

  /**
   * Sanitizes Canvas content items for security and compliance
   *
   * @param contentItems - Raw content items from deep linking request
   * @param context - Additional context for validation
   * @returns Sanitized content items with security report
   */
  async sanitizeContentItems(
    contentItems: unknown,
    context: {
      instructorId: string;
      courseId: string;
      platformOrigin: string;
      sessionId?: string;
    }
  ): Promise<SanitizationResult> {
    try {
      // Validate basic structure
      const validatedItems = CanvasContentItemSchema.parse(contentItems);

      const warnings: any[] = [];
      const securityFlags: string[] = [];
      let removedElements = 0;
      let modifiedAttributes = 0;

      const originalSize = JSON.stringify(contentItems).length;

      // Sanitize each content item
      const sanitizedGraph = await Promise.all(
        validatedItems['@graph'].map(async (item) => {
          const sanitizedItem = await this.sanitizeContentItem(item, context);

          warnings.push(...sanitizedItem.warnings);
          securityFlags.push(...sanitizedItem.securityFlags);
          removedElements += sanitizedItem.contentMetrics.removedElements;
          modifiedAttributes += sanitizedItem.contentMetrics.modifiedAttributes;

          return sanitizedItem.content;
        })
      );

      const sanitizedContent = {
        ...validatedItems,
        '@graph': sanitizedGraph,
      };

      const sanitizedSize = JSON.stringify(sanitizedContent).length;

      // Validate final content structure
      await this.validateFinalContentStructure(sanitizedContent, context);

      return {
        sanitized: true,
        content: sanitizedContent,
        warnings,
        securityFlags: [...new Set(securityFlags)], // Remove duplicates
        contentMetrics: {
          originalSize,
          sanitizedSize,
          removedElements,
          modifiedAttributes,
        },
      };

    } catch (error) {
      console.error('Content sanitization failed:', error);

      return {
        sanitized: false,
        content: null,
        warnings: [{
          type: 'malicious_content',
          message: 'Content sanitization failed due to security violations or malformed data',
        }],
        securityFlags: ['sanitization_failed'],
        contentMetrics: {
          originalSize: JSON.stringify(contentItems).length,
          sanitizedSize: 0,
          removedElements: 0,
          modifiedAttributes: 0,
        },
      };
    }
  }

  /**
   * Sanitizes individual Canvas content item
   *
   * @param item - Single content item to sanitize
   * @param context - Sanitization context
   * @returns Sanitized item with warnings
   */
  private async sanitizeContentItem(
    item: any,
    context: any
  ): Promise<SanitizationResult> {
    const warnings: any[] = [];
    const securityFlags: string[] = [];
    let removedElements = 0;
    let modifiedAttributes = 0;

    const sanitizedItem = { ...item };

    // Sanitize title
    const titleResult = this.sanitizeText(sanitizedItem.title, { maxLength: 200 });
    sanitizedItem.title = titleResult.sanitized;
    warnings.push(...titleResult.warnings);
    securityFlags.push(...titleResult.securityFlags);

    // Sanitize text content
    if (sanitizedItem.text) {
      const textResult = this.sanitizeText(sanitizedItem.text, { maxLength: 1000 });
      sanitizedItem.text = textResult.sanitized;
      warnings.push(...textResult.warnings);
      securityFlags.push(...textResult.securityFlags);
    }

    // Sanitize and validate URLs
    const urlResult = await this.sanitizeUrl(sanitizedItem.url, context);
    sanitizedItem.url = urlResult.sanitized;
    warnings.push(...urlResult.warnings);
    securityFlags.push(...urlResult.securityFlags);

    // Sanitize icon URL if present
    if (sanitizedItem.icon?.['@id']) {
      const iconResult = await this.sanitizeUrl(sanitizedItem.icon['@id'], context);
      sanitizedItem.icon['@id'] = iconResult.sanitized;
      warnings.push(...iconResult.warnings);
      securityFlags.push(...iconResult.securityFlags);
    }

    // Sanitize custom properties
    if (sanitizedItem.custom) {
      const customResult = this.sanitizeCustomProperties(sanitizedItem.custom);
      sanitizedItem.custom = customResult.sanitized;
      warnings.push(...customResult.warnings);
      securityFlags.push(...customResult.securityFlags);
      modifiedAttributes += customResult.modifiedCount;
    }

    // Validate line item configuration
    if (sanitizedItem.lineItem) {
      const lineItemResult = this.sanitizeLineItem(sanitizedItem.lineItem);
      sanitizedItem.lineItem = lineItemResult.sanitized;
      warnings.push(...lineItemResult.warnings);
    }

    // Validate iframe configuration
    if (sanitizedItem.iframe) {
      const iframeResult = this.sanitizeIframeConfig(sanitizedItem.iframe);
      sanitizedItem.iframe = iframeResult.sanitized;
      warnings.push(...iframeResult.warnings);
    }

    return {
      sanitized: true,
      content: sanitizedItem,
      warnings,
      securityFlags,
      contentMetrics: {
        originalSize: JSON.stringify(item).length,
        sanitizedSize: JSON.stringify(sanitizedItem).length,
        removedElements,
        modifiedAttributes,
      },
    };
  }

  /**
   * Sanitizes text content for XSS and injection prevention
   *
   * @param text - Text to sanitize
   * @param options - Sanitization options
   * @returns Sanitized text with warnings
   */
  private sanitizeText(
    text: string,
    options: { maxLength?: number } = {}
  ): {
    sanitized: string;
    warnings: any[];
    securityFlags: string[];
  } {
    const warnings: any[] = [];
    const securityFlags: string[] = [];
    let sanitized = text;

    // Check for length limits
    if (options.maxLength && sanitized.length > options.maxLength) {
      sanitized = sanitized.substring(0, options.maxLength);
      warnings.push({
        type: 'oversized_content',
        message: `Content truncated to ${options.maxLength} characters`,
        originalValue: text.substring(0, 50) + '...',
      });
    }

    // Remove JavaScript and dangerous patterns
    for (const pattern of SECURITY_PATTERNS.JAVASCRIPT_INJECTION) {
      if (pattern.test(sanitized)) {
        sanitized = sanitized.replace(pattern, '');
        securityFlags.push('javascript_injection_attempt');
        warnings.push({
          type: 'malicious_content',
          message: 'JavaScript injection attempt blocked',
        });
      }
    }

    // Remove XSS patterns
    for (const pattern of SECURITY_PATTERNS.XSS_PATTERNS) {
      if (pattern.test(sanitized)) {
        sanitized = sanitized.replace(pattern, '');
        securityFlags.push('xss_attempt');
        warnings.push({
          type: 'malicious_content',
          message: 'XSS pattern blocked',
        });
      }
    }

    // Remove suspicious attributes
    for (const pattern of SECURITY_PATTERNS.SUSPICIOUS_ATTRIBUTES) {
      if (pattern.test(sanitized)) {
        sanitized = sanitized.replace(pattern, '');
        securityFlags.push('suspicious_attributes');
        warnings.push({
          type: 'blocked_attribute',
          message: 'Suspicious attribute removed',
        });
      }
    }

    // Basic HTML sanitization if enabled
    if (this.config.enableDomPurification) {
      sanitized = this.sanitizeHtml(sanitized);
    }

    return {
      sanitized: sanitized.trim(),
      warnings,
      securityFlags,
    };
  }

  /**
   * Sanitizes and validates URLs
   *
   * @param url - URL to sanitize
   * @param context - Validation context
   * @returns Sanitized URL with warnings
   */
  private async sanitizeUrl(
    url: string,
    context: any
  ): Promise<{
    sanitized: string;
    warnings: any[];
    securityFlags: string[];
  }> {
    const warnings: any[] = [];
    const securityFlags: string[] = [];

    try {
      const urlObj = new URL(url);

      // Check for allowed schemes
      if (!this.config.allowedUrlSchemes.includes(urlObj.protocol.slice(0, -1))) {
        securityFlags.push('invalid_url_scheme');
        warnings.push({
          type: 'suspicious_url',
          message: `Invalid URL scheme: ${urlObj.protocol}`,
          originalValue: url,
        });

        // Return a safe default URL
        return {
          sanitized: `https://guide.atomicjolt.xyz/assessment/${context.sessionId || 'default'}`,
          warnings,
          securityFlags,
        };
      }

      // Check for suspicious URL patterns
      for (const pattern of SECURITY_PATTERNS.URL_INJECTION) {
        if (pattern.test(url)) {
          securityFlags.push('url_injection_attempt');
          warnings.push({
            type: 'suspicious_url',
            message: 'Suspicious URL pattern detected',
            originalValue: url,
          });

          return {
            sanitized: `https://guide.atomicjolt.xyz/assessment/${context.sessionId || 'default'}`,
            warnings,
            securityFlags,
          };
        }
      }

      // Check URL length
      if (url.length > this.config.maxUrlLength) {
        warnings.push({
          type: 'oversized_content',
          message: 'URL too long, may indicate injection attempt',
          originalValue: url.substring(0, 50) + '...',
        });

        return {
          sanitized: `https://guide.atomicjolt.xyz/assessment/${context.sessionId || 'default'}`,
          warnings,
          securityFlags: ['oversized_url'],
        };
      }

      // Validate that URLs point to allowed domains
      const allowedDomains = [
        'guide.atomicjolt.xyz',
        'atomic-guide.atomicjolt.xyz',
        context.platformOrigin?.replace(/^https?:\/\//, ''),
      ].filter(Boolean);

      if (!allowedDomains.some(domain => urlObj.hostname === domain || urlObj.hostname.endsWith('.' + domain))) {
        securityFlags.push('external_domain');
        warnings.push({
          type: 'suspicious_url',
          message: 'External domain not allowed',
          originalValue: url,
        });

        return {
          sanitized: `https://guide.atomicjolt.xyz/assessment/${context.sessionId || 'default'}`,
          warnings,
          securityFlags,
        };
      }

      return {
        sanitized: url,
        warnings,
        securityFlags,
      };

    } catch (error) {
      securityFlags.push('malformed_url');
      warnings.push({
        type: 'malicious_content',
        message: 'Malformed URL detected',
        originalValue: url,
      });

      return {
        sanitized: `https://guide.atomicjolt.xyz/assessment/${context.sessionId || 'default'}`,
        warnings,
        securityFlags,
      };
    }
  }

  /**
   * Sanitizes custom properties in content items
   *
   * @param custom - Custom properties object
   * @returns Sanitized custom properties
   */
  private sanitizeCustomProperties(custom: Record<string, string>): {
    sanitized: Record<string, string>;
    warnings: any[];
    securityFlags: string[];
    modifiedCount: number;
  } {
    const warnings: any[] = [];
    const securityFlags: string[] = [];
    let modifiedCount = 0;

    const sanitized: Record<string, string> = {};

    for (const [key, value] of Object.entries(custom)) {
      // Sanitize key
      const sanitizedKey = key.replace(/[^a-zA-Z0-9_-]/g, '');
      if (sanitizedKey !== key) {
        modifiedCount++;
        warnings.push({
          type: 'blocked_attribute',
          message: 'Custom property key sanitized',
          originalValue: key,
          sanitizedValue: sanitizedKey,
        });
      }

      // Sanitize value
      const textResult = this.sanitizeText(value, { maxLength: 1000 });
      sanitized[sanitizedKey] = textResult.sanitized;

      if (textResult.warnings.length > 0) {
        modifiedCount++;
        warnings.push(...textResult.warnings);
      }

      securityFlags.push(...textResult.securityFlags);

      // Check for potential prototype pollution
      if (sanitizedKey === '__proto__' || sanitizedKey === 'constructor' || sanitizedKey === 'prototype') {
        delete sanitized[sanitizedKey];
        modifiedCount++;
        securityFlags.push('prototype_pollution_attempt');
        warnings.push({
          type: 'malicious_content',
          message: 'Potential prototype pollution attempt blocked',
          originalValue: key,
        });
      }
    }

    return {
      sanitized,
      warnings,
      securityFlags,
      modifiedCount,
    };
  }

  /**
   * Sanitizes line item configuration
   *
   * @param lineItem - Line item configuration
   * @returns Sanitized line item
   */
  private sanitizeLineItem(lineItem: any): {
    sanitized: any;
    warnings: any[];
  } {
    const warnings: any[] = [];
    const sanitized = { ...lineItem };

    // Validate score maximum
    if (sanitized.scoreMaximum < 0 || sanitized.scoreMaximum > 10000) {
      sanitized.scoreMaximum = Math.min(Math.max(sanitized.scoreMaximum, 0), 10000);
      warnings.push({
        type: 'oversized_content',
        message: 'Score maximum adjusted to valid range (0-10000)',
      });
    }

    // Sanitize text fields
    const labelResult = this.sanitizeText(sanitized.label, { maxLength: 200 });
    sanitized.label = labelResult.sanitized;
    warnings.push(...labelResult.warnings);

    const resourceIdResult = this.sanitizeText(sanitized.resourceId, { maxLength: 200 });
    sanitized.resourceId = resourceIdResult.sanitized;
    warnings.push(...resourceIdResult.warnings);

    if (sanitized.tag) {
      const tagResult = this.sanitizeText(sanitized.tag, { maxLength: 100 });
      sanitized.tag = tagResult.sanitized;
      warnings.push(...tagResult.warnings);
    }

    return {
      sanitized,
      warnings,
    };
  }

  /**
   * Sanitizes iframe configuration
   *
   * @param iframe - Iframe configuration
   * @returns Sanitized iframe config
   */
  private sanitizeIframeConfig(iframe: any): {
    sanitized: any;
    warnings: any[];
  } {
    const warnings: any[] = [];
    const sanitized = { ...iframe };

    // Validate dimensions
    if (sanitized.width < 100 || sanitized.width > 2000) {
      sanitized.width = Math.min(Math.max(sanitized.width, 100), 2000);
      warnings.push({
        type: 'oversized_content',
        message: 'Iframe width adjusted to valid range (100-2000)',
      });
    }

    if (sanitized.height < 100 || sanitized.height > 2000) {
      sanitized.height = Math.min(Math.max(sanitized.height, 100), 2000);
      warnings.push({
        type: 'oversized_content',
        message: 'Iframe height adjusted to valid range (100-2000)',
      });
    }

    return {
      sanitized,
      warnings,
    };
  }

  /**
   * Basic HTML sanitization
   *
   * @param html - HTML content to sanitize
   * @returns Sanitized HTML
   */
  private sanitizeHtml(html: string): string {
    // Remove script tags
    let sanitized = html.replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '');

    // Remove dangerous tags
    const dangerousTags = ['script', 'iframe', 'object', 'embed', 'applet', 'meta', 'link'];
    for (const tag of dangerousTags) {
      const regex = new RegExp(`<${tag}\\b[^>]*>.*?<\\/${tag}>`, 'gi');
      sanitized = sanitized.replace(regex, '');
    }

    // Remove dangerous attributes
    const dangerousAttrs = ['onload', 'onerror', 'onclick', 'onmouseover', 'onfocus', 'onblur'];
    for (const attr of dangerousAttrs) {
      const regex = new RegExp(`${attr}\\s*=\\s*["'][^"']*["']`, 'gi');
      sanitized = sanitized.replace(regex, '');
    }

    return sanitized;
  }

  /**
   * Validates final content structure after sanitization
   *
   * @param content - Sanitized content
   * @param context - Validation context
   */
  private async validateFinalContentStructure(content: any, context: any): Promise<void> {
    // Ensure all URLs are still valid after sanitization
    for (const item of content['@graph']) {
      try {
        new URL(item.url);
      } catch {
        throw new Error('Invalid URL in sanitized content');
      }

      // Ensure required fields are present
      if (!item.title || !item.url || !item.mediaType) {
        throw new Error('Missing required fields in content item');
      }

      // Validate assessment configuration if present
      if (item.custom?.assessment_configuration_id) {
        const configId = item.custom.assessment_configuration_id;
        if (!/^[a-f0-9-]{36}$/i.test(configId)) {
          throw new Error('Invalid assessment configuration ID format');
        }
      }
    }

    // Validate overall content size
    const contentSize = JSON.stringify(content).length;
    if (contentSize > this.config.maxContentLength) {
      throw new Error('Sanitized content exceeds maximum size limit');
    }
  }

  /**
   * Creates a secure assessment content item
   *
   * @param config - Assessment configuration
   * @param context - Creation context
   * @returns Secure content item
   */
  async createSecureAssessmentContentItem(
    config: {
      assessmentId: string;
      title: string;
      description?: string;
      points: number;
      sessionId: string;
    },
    context: {
      instructorId: string;
      courseId: string;
      platformOrigin: string;
    }
  ): Promise<any> {
    const sanitizedTitle = this.sanitizeText(config.title, { maxLength: 200 }).sanitized;
    const sanitizedDescription = config.description
      ? this.sanitizeText(config.description, { maxLength: 1000 }).sanitized
      : undefined;

    const assessmentUrl = `https://guide.atomicjolt.xyz/assessment/${config.assessmentId}`;

    return {
      '@context': 'http://purl.imsglobal.org/ctx/lti/v1/ContentItem',
      '@graph': [{
        '@type': 'LtiLinkItem',
        mediaType: 'application/vnd.ims.lti.v1.ltilink',
        title: sanitizedTitle,
        text: sanitizedDescription,
        url: assessmentUrl,
        icon: {
          '@id': 'https://guide.atomicjolt.xyz/icons/assessment.png',
          width: 32,
          height: 32,
        },
        lineItem: {
          scoreMaximum: Math.min(Math.max(config.points, 0), 10000),
          label: sanitizedTitle,
          resourceId: config.assessmentId,
          tag: 'assessment',
        },
        custom: {
          assessment_configuration_id: config.assessmentId,
          assignment_id: context.courseId,
          course_id: context.courseId,
          session_id: config.sessionId,
        },
        iframe: {
          width: 800,
          height: 600,
        },
      }],
    };
  }
}

/**
 * Factory function for creating Canvas content sanitization service
 */
export function createCanvasContentSanitizationService(
  config?: Partial<SanitizationConfig>
): CanvasContentSanitizationService {
  return new CanvasContentSanitizationService(config);
}

/**
 * Type exports
 */
export type {
  SanitizationConfig,
  SanitizationResult,
  CanvasContentItem,
};