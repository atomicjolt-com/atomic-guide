/**
 * @fileoverview Content Extraction Service for Canvas integration
 * @module features/canvas-integration/server/services/ContentExtractionService
 *
 * Handles real-time Canvas content extraction, analysis, and metadata generation
 * with support for multiple extraction methods, content sanitization, and
 * performance optimization for assessment context generation.
 */

import {
  CanvasPageContent,
  CanvasContentReference,
  ContentExtractionError,
  ContentAnalysisResult
} from '../../shared/types';
import { ContentReferenceRepository } from '../repositories/ContentReferenceRepository';

/**
 * Canvas page type detection configuration
 */
interface PageTypeDetectionRules {
  patterns: Record<string, RegExp[]>;
  selectors: Record<string, string[]>;
  apiEndpoints: Record<string, string>;
}

/**
 * Content extraction configuration
 */
interface ExtractionConfig {
  maxContentLength: number;
  timeoutMs: number;
  retryAttempts: number;
  enableAIAnalysis: boolean;
  sanitization: {
    allowedTags: string[];
    allowedAttributes: string[];
    removeScripts: boolean;
  };
}

/**
 * Content Extraction Service for Canvas Integration
 *
 * Provides comprehensive Canvas content extraction with multiple fallback strategies:
 * - Canvas API extraction (primary)
 * - DOM-based extraction (fallback)
 * - AI-powered content analysis
 * - Metadata generation and enrichment
 * - Performance-optimized caching
 */
export class ContentExtractionService {
  private contentRepository: ContentReferenceRepository;
  private extractionCache: Map<string, { content: CanvasPageContent; timestamp: number }> = new Map();

  // Content extraction configuration
  private readonly CONFIG: ExtractionConfig = {
    maxContentLength: 50000, // 50KB limit
    timeoutMs: 10000, // 10 second timeout
    retryAttempts: 3,
    enableAIAnalysis: true,
    sanitization: {
      allowedTags: ['p', 'div', 'span', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'ul', 'ol', 'li', 'strong', 'em', 'br'],
      allowedAttributes: ['class', 'id'],
      removeScripts: true
    }
  };

  // Canvas page type detection rules
  private readonly PAGE_TYPE_RULES: PageTypeDetectionRules = {
    patterns: {
      assignment: [
        /\/courses\/\d+\/assignments\/\d+/,
        /assignment_id=\d+/
      ],
      quiz: [
        /\/courses\/\d+\/quizzes\/\d+/,
        /quiz_id=\d+/
      ],
      discussion: [
        /\/courses\/\d+\/discussion_topics\/\d+/,
        /discussion_topic_id=\d+/
      ],
      module: [
        /\/courses\/\d+\/modules/,
        /context_module_id=\d+/
      ],
      page: [
        /\/courses\/\d+\/pages\//,
        /wiki_page_id=/
      ],
      course: [
        /\/courses\/\d+$/,
        /course_id=\d+/
      ]
    },
    selectors: {
      assignment: [
        '.assignment-description',
        '#assignment_show',
        '.description'
      ],
      quiz: [
        '.quiz-description',
        '#quiz_description',
        '.question_content'
      ],
      discussion: [
        '.discussion-section',
        '.message_wrapper',
        '.discussion_entry'
      ],
      module: [
        '.context_module_items',
        '.module-sequence-footer-content',
        '.content-details'
      ],
      page: [
        '.show-content',
        '.page-content',
        '.user_content'
      ],
      course: [
        '.course-description',
        '.syllabus_course_summary',
        '.course_summary'
      ]
    },
    apiEndpoints: {
      assignment: '/api/v1/courses/{courseId}/assignments/{assignmentId}',
      quiz: '/api/v1/courses/{courseId}/quizzes/{quizId}',
      discussion: '/api/v1/courses/{courseId}/discussion_topics/{topicId}',
      module: '/api/v1/courses/{courseId}/modules/{moduleId}',
      page: '/api/v1/courses/{courseId}/pages/{pageId}',
      course: '/api/v1/courses/{courseId}'
    }
  };

  // Cache settings
  private readonly CACHE_TTL_MS = 300000; // 5 minutes

  constructor(
    contentRepository: ContentReferenceRepository,
    private aiService?: any // Workers AI service for content analysis
  ) {
    this.contentRepository = contentRepository;

    // Start cache cleanup interval
    setInterval(() => this.cleanupCache(), 60000); // Every minute
  }

  /**
   * Extract content from Canvas page with multiple fallback strategies
   */
  async extractCanvasPageContent(
    pageUrl: string,
    tenantId: string,
    sessionId: string,
    canvasApiToken?: string
  ): Promise<CanvasPageContent> {
    const startTime = Date.now();

    try {
      // Validate URL
      const url = new URL(pageUrl);
      const contentHash = this.generateContentHash(pageUrl);

      // Check cache first
      const cached = this.extractionCache.get(contentHash);
      if (cached && Date.now() - cached.timestamp < this.CACHE_TTL_MS) {
        return cached.content;
      }

      // Detect page type
      const pageType = this.detectPageType(pageUrl);

      // Extract course and content IDs
      const { courseId, contentId } = this.extractIdsFromUrl(pageUrl, pageType);

      let content: CanvasPageContent | null = null;

      // Strategy 1: Canvas API extraction (if token available)
      if (canvasApiToken && pageType !== 'unknown') {
        try {
          content = await this.extractViaCanvasAPI(
            url.origin,
            courseId,
            contentId,
            pageType,
            canvasApiToken
          );
        } catch (apiError) {
          console.warn('Canvas API extraction failed:', apiError);
          // Continue to fallback methods
        }
      }

      // Strategy 2: DOM-based extraction (fallback)
      if (!content) {
        content = await this.extractViaDOMAnalysis(pageUrl, pageType);
      }

      // Strategy 3: Minimal fallback content
      if (!content) {
        content = this.createFallbackContent(pageUrl, pageType);
      }

      // Enhance with metadata if content was extracted
      if (content.contentText && content.contentText.length > 100) {
        content = await this.enhanceContentMetadata(content);
      }

      // Cache the result
      this.extractionCache.set(contentHash, {
        content,
        timestamp: Date.now()
      });

      const processingTime = Date.now() - startTime;
      console.log(`Content extraction completed in ${processingTime}ms for ${pageType} page`);

      return content;

    } catch (error) {
      const processingTime = Date.now() - startTime;
      console.error(`Content extraction failed after ${processingTime}ms:`, error);

      throw new ContentExtractionError(
        'Failed to extract Canvas page content',
        {
          url: pageUrl,
          tenantId,
          sessionId,
          processingTime
        }
      );
    }
  }

  /**
   * Store extracted content with privacy compliance
   */
  async storeContentReference(
    content: CanvasPageContent,
    studentId: string,
    sessionId: string,
    consentRequired: boolean = false
  ): Promise<CanvasContentReference> {
    const contentReference: Omit<CanvasContentReference, 'id'> = {
      studentId,
      courseId: content.courseId || 'unknown',
      contentType: this.mapPageTypeToContentType(content.pageType),
      contentId: this.extractContentIdFromMetadata(content),
      contentTitle: content.assignmentTitle || content.moduleName || 'Untitled',
      contentUrl: undefined, // Don't store full URL for privacy
      extractedAt: content.extractedAt,
      metadata: {
        learningObjectives: content.metadata?.learningObjectives || [],
        concepts: content.metadata?.concepts || [],
        difficulty: content.metadata?.difficulty,
        estimatedDuration: content.metadata?.estimatedDuration,
        prerequisites: content.metadata?.prerequisites || []
      },
      privacy: {
        retentionExpires: this.calculateRetentionExpiry(),
        consentRequired,
        anonymized: false
      }
    };

    return await this.contentRepository.create(contentReference);
  }

  /**
   * Detect Canvas page type from URL patterns
   */
  private detectPageType(pageUrl: string): CanvasPageContent['pageType'] {
    for (const [type, patterns] of Object.entries(this.PAGE_TYPE_RULES.patterns)) {
      for (const pattern of patterns) {
        if (pattern.test(pageUrl)) {
          return type as CanvasPageContent['pageType'];
        }
      }
    }
    return 'unknown';
  }

  /**
   * Extract course and content IDs from URL
   */
  private extractIdsFromUrl(pageUrl: string, pageType: string): { courseId: string; contentId: string } {
    const url = new URL(pageUrl);

    // Extract course ID
    const courseMatch = url.pathname.match(/\/courses\/(\d+)/);
    const courseId = courseMatch ? courseMatch[1] : '';

    // Extract content ID based on page type
    let contentId = '';

    switch (pageType) {
      case 'assignment': {
        const assignmentMatch = url.pathname.match(/\/assignments\/(\d+)/) ||
                               url.search.match(/assignment_id=(\d+)/);
        contentId = assignmentMatch ? assignmentMatch[1] : '';
        break;
      }
      case 'quiz': {
        const quizMatch = url.pathname.match(/\/quizzes\/(\d+)/) ||
                         url.search.match(/quiz_id=(\d+)/);
        contentId = quizMatch ? quizMatch[1] : '';
        break;
      }
      case 'discussion': {
        const discussionMatch = url.pathname.match(/\/discussion_topics\/(\d+)/) ||
                               url.search.match(/discussion_topic_id=(\d+)/);
        contentId = discussionMatch ? discussionMatch[1] : '';
        break;
      }
      case 'module': {
        const moduleMatch = url.pathname.match(/\/modules\/(\d+)/) ||
                           url.search.match(/context_module_id=(\d+)/);
        contentId = moduleMatch ? moduleMatch[1] : '';
        break;
      }
      case 'page':
        const pageMatch = url.pathname.match(/\/pages\/([^/?]+)/) ||
                         url.search.match(/wiki_page_id=([^&]+)/);
        contentId = pageMatch ? pageMatch[1] : '';
        break;
      default:
        contentId = courseId; // For course pages, use course ID
    }

    return { courseId, contentId };
  }

  /**
   * Extract content via Canvas API
   */
  private async extractViaCanvasAPI(
    canvasOrigin: string,
    courseId: string,
    contentId: string,
    pageType: string,
    apiToken: string
  ): Promise<CanvasPageContent | null> {
    const apiEndpoint = this.PAGE_TYPE_RULES.apiEndpoints[pageType];
    if (!apiEndpoint) return null;

    const url = `${canvasOrigin}${apiEndpoint
      .replace('{courseId}', courseId)
      .replace('{assignmentId}', contentId)
      .replace('{quizId}', contentId)
      .replace('{topicId}', contentId)
      .replace('{moduleId}', contentId)
      .replace('{pageId}', contentId)}`;

    const response = await fetch(url, {
      headers: {
        'Authorization': `Bearer ${apiToken}`,
        'Accept': 'application/json'
      },
      signal: AbortSignal.timeout(this.CONFIG.timeoutMs)
    });

    if (!response.ok) {
      throw new Error(`Canvas API error: ${response.status} ${response.statusText}`);
    }

    const data = await response.json();
    return this.parseAPIResponse(data, pageType);
  }

  /**
   * Parse Canvas API response to CanvasPageContent
   */
  private parseAPIResponse(data: any, pageType: string): CanvasPageContent {
    let contentText = '';
    let assignmentTitle = '';
    let moduleName = '';

    switch (pageType) {
      case 'assignment':
        contentText = this.sanitizeContent(data.description || '');
        assignmentTitle = data.name || '';
        break;
      case 'quiz':
        contentText = this.sanitizeContent(data.description || '');
        assignmentTitle = data.title || '';
        break;
      case 'discussion':
        contentText = this.sanitizeContent(data.message || '');
        assignmentTitle = data.title || '';
        break;
      case 'page':
        contentText = this.sanitizeContent(data.body || '');
        assignmentTitle = data.title || '';
        break;
      case 'course':
        contentText = this.sanitizeContent(data.public_description || data.syllabus_body || '');
        assignmentTitle = data.name || '';
        break;
      default:
        contentText = this.sanitizeContent(JSON.stringify(data));
    }

    return {
      pageType: pageType as CanvasPageContent['pageType'],
      courseId: data.course_id?.toString(),
      moduleName,
      assignmentTitle,
      contentText: contentText.substring(0, this.CONFIG.maxContentLength),
      contentHash: this.generateContentHash(contentText),
      extractedAt: new Date(),
      extractionMethod: 'canvas_api',
      metadata: {
        difficulty: data.difficulty,
        points: data.points_possible,
        dueDate: data.due_at ? new Date(data.due_at) : undefined
      }
    };
  }

  /**
   * Extract content via DOM analysis (fallback method)
   */
  private async extractViaDOMAnalysis(
    pageUrl: string,
    pageType: string
  ): Promise<CanvasPageContent | null> {
    // Note: In a real implementation, this would require a headless browser
    // or be handled by client-side JavaScript that sends the DOM content
    // For now, we'll return null to indicate DOM extraction is not available
    console.warn('DOM extraction not implemented - requires client-side processing');
    return null;
  }

  /**
   * Create fallback content when extraction fails
   */
  private createFallbackContent(
    pageUrl: string,
    pageType: CanvasPageContent['pageType']
  ): CanvasPageContent {
    return {
      pageType,
      contentText: `Content extraction unavailable for ${pageType} page`,
      contentHash: this.generateContentHash(pageUrl),
      extractedAt: new Date(),
      extractionMethod: 'dom_fallback',
      metadata: {}
    };
  }

  /**
   * Enhance content with AI-powered metadata
   */
  private async enhanceContentMetadata(content: CanvasPageContent): Promise<CanvasPageContent> {
    if (!this.CONFIG.enableAIAnalysis || !this.aiService || !content.contentText) {
      return content;
    }

    try {
      const analysis = await this.analyzeContentWithAI(content.contentText);

      return {
        ...content,
        difficulty: analysis.difficulty,
        metadata: {
          ...content.metadata,
          learningObjectives: analysis.learningObjectives,
          concepts: analysis.concepts,
          estimatedDuration: analysis.estimatedDuration,
          prerequisites: analysis.prerequisites
        }
      };
    } catch (error) {
      console.warn('AI content analysis failed:', error);
      return content;
    }
  }

  /**
   * Analyze content using Workers AI
   */
  private async analyzeContentWithAI(contentText: string): Promise<ContentAnalysisResult> {
    const prompt = `Analyze this educational content and extract:
1. Learning objectives (3-5 key objectives)
2. Main concepts (5-10 key concepts)
3. Difficulty level (beginner/intermediate/advanced)
4. Estimated study duration in minutes
5. Prerequisites (3-5 prerequisite topics)

Content: ${contentText.substring(0, 2000)}`;

    const response = await this.aiService.run('@cf/meta/llama-2-7b-chat-int8', {
      messages: [{ role: 'user', content: prompt }]
    });

    // Parse AI response and extract structured data
    return this.parseAIAnalysis(response.response);
  }

  /**
   * Parse AI analysis response
   */
  private parseAIAnalysis(aiResponse: string): ContentAnalysisResult {
    // Basic parsing - in production, this would be more sophisticated
    const lines = aiResponse.split('\n');

    return {
      concepts: this.extractListFromAI(aiResponse, 'concepts'),
      learningObjectives: this.extractListFromAI(aiResponse, 'objectives'),
      difficulty: this.extractDifficultyFromAI(aiResponse),
      estimatedDuration: this.extractDurationFromAI(aiResponse),
      prerequisites: this.extractListFromAI(aiResponse, 'prerequisites'),
      confidence: 0.7, // Basic confidence score
      analysisTimestamp: new Date()
    };
  }

  /**
   * Extract list items from AI response
   */
  private extractListFromAI(text: string, type: string): string[] {
    const regex = new RegExp(`${type}:?\\s*([^\\n]+(?:\\n-[^\\n]+)*)`, 'i');
    const match = text.match(regex);

    if (!match) return [];

    return match[1]
      .split(/\n-|\n\d+\./)
      .map(item => item.trim())
      .filter(item => item.length > 0)
      .slice(0, 10); // Limit results
  }

  /**
   * Extract difficulty from AI response
   */
  private extractDifficultyFromAI(text: string): 'beginner' | 'intermediate' | 'advanced' {
    const difficulty = text.toLowerCase();
    if (difficulty.includes('advanced')) return 'advanced';
    if (difficulty.includes('intermediate')) return 'intermediate';
    return 'beginner';
  }

  /**
   * Extract duration from AI response
   */
  private extractDurationFromAI(text: string): number {
    const match = text.match(/(\d+)\s*minutes?/i);
    return match ? parseInt(match[1]) : 30; // Default 30 minutes
  }

  /**
   * Sanitize HTML content for security
   */
  private sanitizeContent(content: string): string {
    // Remove script tags and dangerous attributes
    let sanitized = content.replace(/<script[^>]*>.*?<\/script>/gi, '');
    sanitized = sanitized.replace(/on\w+\s*=\s*["'][^"']*["']/gi, '');
    sanitized = sanitized.replace(/javascript:/gi, '');

    // Strip HTML tags except allowed ones
    const allowedTagsRegex = new RegExp(
      `<(?!\/?(${this.CONFIG.sanitization.allowedTags.join('|')})\b)[^>]+>`,
      'gi'
    );
    sanitized = sanitized.replace(allowedTagsRegex, '');

    return sanitized.trim();
  }

  /**
   * Generate content hash for change detection
   */
  private generateContentHash(content: string): string {
    let hash = 0;
    for (let i = 0; i < content.length; i++) {
      const char = content.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // Convert to 32-bit integer
    }
    return Math.abs(hash).toString(16);
  }

  /**
   * Map page type to content type
   */
  private mapPageTypeToContentType(pageType: CanvasPageContent['pageType']): CanvasContentReference['contentType'] {
    const mapping: Record<CanvasPageContent['pageType'], CanvasContentReference['contentType']> = {
      assignment: 'assignment',
      quiz: 'quiz',
      discussion: 'discussion',
      module: 'module',
      page: 'page',
      course: 'page',
      unknown: 'file'
    };

    return mapping[pageType];
  }

  /**
   * Extract content ID from metadata
   */
  private extractContentIdFromMetadata(content: CanvasPageContent): string {
    return content.metadata?.id ||
           content.metadata?.contentId ||
           content.contentHash.substring(0, 8);
  }

  /**
   * Calculate retention expiry date
   */
  private calculateRetentionExpiry(): Date {
    const expiry = new Date();
    expiry.setFullYear(expiry.getFullYear() + 1); // 1 year retention
    return expiry;
  }

  /**
   * Clean up expired cache entries
   */
  private cleanupCache(): void {
    const now = Date.now();
    for (const [key, value] of this.extractionCache.entries()) {
      if (now - value.timestamp > this.CACHE_TTL_MS) {
        this.extractionCache.delete(key);
      }
    }
  }
}