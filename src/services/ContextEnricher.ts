export interface PageContext {
  courseId: string;
  courseName?: string;
  moduleId?: string;
  moduleName?: string;
  assignmentId?: string;
  assignmentTitle?: string;
  pageType?: string;
  pageContent?: string;
  currentElement?: string;
  timestamp: number;
}

export interface LTIContext {
  contextId: string;
  contextTitle?: string;
  contextLabel?: string;
  resourceLinkId?: string;
  resourceLinkTitle?: string;
  roles: string[];
  userId: string;
  userEmail?: string;
  userName?: string;
}

export interface EnrichedContext {
  page: PageContext;
  lti: LTIContext;
  learnerProfile?: any;
  sessionData?: any;
  extractedContent: string;
  keywords: string[];
  topics: string[];
}

export class ContextEnricher {
  private contentCache: Map<string, { content: string; timestamp: number }> = new Map();
  private cacheTimeout: number = 300000; // 5 minutes

  constructor() {}

  async enrichContext(pageContext: PageContext, ltiClaims: any, learnerProfile?: any, sessionData?: any): Promise<EnrichedContext> {
    const ltiContext = this.extractLTIContext(ltiClaims);
    const extractedContent = this.extractRelevantContent(pageContext);
    const keywords = this.extractKeywords(extractedContent);
    const topics = this.identifyTopics(extractedContent, pageContext);

    // Merge course info from LTI if not in page context
    if (!pageContext.courseName && ltiContext.contextTitle) {
      pageContext.courseName = ltiContext.contextTitle;
    }

    return {
      page: pageContext,
      lti: ltiContext,
      learnerProfile,
      sessionData,
      extractedContent,
      keywords,
      topics,
    };
  }

  private extractLTIContext(claims: any): LTIContext {
    return {
      contextId: claims['https://purl.imsglobal.org/spec/lti/claim/context']?.id || '',
      contextTitle: claims['https://purl.imsglobal.org/spec/lti/claim/context']?.title,
      contextLabel: claims['https://purl.imsglobal.org/spec/lti/claim/context']?.label,
      resourceLinkId: claims['https://purl.imsglobal.org/spec/lti/claim/resource_link']?.id,
      resourceLinkTitle: claims['https://purl.imsglobal.org/spec/lti/claim/resource_link']?.title,
      roles: claims['https://purl.imsglobal.org/spec/lti/claim/roles'] || [],
      userId: claims.sub || '',
      userEmail: claims.email,
      userName: claims.name,
    };
  }

  extractRelevantContent(pageContext: PageContext): string {
    const cacheKey = `${pageContext.courseId}-${pageContext.moduleId}-${pageContext.assignmentId}`;
    const cached = this.contentCache.get(cacheKey);

    if (cached && Date.now() - cached.timestamp < this.cacheTimeout) {
      return cached.content;
    }

    let content = '';

    // Extract main content
    if (pageContext.pageContent) {
      content = this.cleanContent(pageContext.pageContent);
    }

    // Add current element context if available
    if (pageContext.currentElement) {
      content += `\n\nCurrent focus: ${pageContext.currentElement}`;
    }

    // Add metadata
    const metadata: string[] = [];
    if (pageContext.assignmentTitle) metadata.push(`Assignment: ${pageContext.assignmentTitle}`);
    if (pageContext.moduleName) metadata.push(`Module: ${pageContext.moduleName}`);
    if (pageContext.pageType) metadata.push(`Page Type: ${pageContext.pageType}`);

    if (metadata.length > 0) {
      content = metadata.join('\n') + '\n\n' + content;
    }

    // Cache the extracted content
    this.contentCache.set(cacheKey, { content, timestamp: Date.now() });

    return content;
  }

  private cleanContent(rawContent: string): string {
    // Remove HTML tags but preserve structure
    let cleaned = rawContent
      .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
      .replace(/<style\b[^<]*(?:(?!<\/style>)<[^<]*)*<\/style>/gi, '')
      .replace(/<[^>]+>/g, ' ')
      .replace(/&nbsp;/g, ' ')
      .replace(/&[a-z]+;/gi, ' ');

    // Normalize whitespace
    cleaned = cleaned
      .split('\n')
      .map((line) => line.trim())
      .filter((line) => line.length > 0)
      .join('\n');

    // Limit length to prevent token overflow
    const maxLength = 2000;
    if (cleaned.length > maxLength) {
      cleaned = this.summarizeContent(cleaned, maxLength);
    }

    return cleaned;
  }

  private summarizeContent(content: string, maxLength: number): string {
    // Smart truncation - try to keep complete sentences
    const sentences = content.match(/[^.!?]+[.!?]+/g) || [];
    let summary = '';

    for (const sentence of sentences) {
      if (summary.length + sentence.length > maxLength) {
        break;
      }
      summary += sentence + ' ';
    }

    if (summary.length === 0) {
      // Fallback to simple truncation
      summary = content.substring(0, maxLength - 20) + '... [content truncated]';
    }

    return summary.trim();
  }

  private extractKeywords(content: string): string[] {
    // Simple keyword extraction - can be enhanced with NLP
    const words = content
      .toLowerCase()
      .split(/\W+/)
      .filter((word) => word.length > 4);

    const wordFreq = new Map<string, number>();
    for (const word of words) {
      wordFreq.set(word, (wordFreq.get(word) || 0) + 1);
    }

    // Get top keywords by frequency
    const keywords = Array.from(wordFreq.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10)
      .map(([word]) => word);

    // Add common educational keywords if present
    const educationalKeywords = ['assignment', 'quiz', 'exam', 'homework', 'project', 'discussion', 'module', 'lesson', 'chapter', 'test'];

    for (const keyword of educationalKeywords) {
      if (content.toLowerCase().includes(keyword) && !keywords.includes(keyword)) {
        keywords.push(keyword);
      }
    }

    return keywords;
  }

  private identifyTopics(content: string, pageContext: PageContext): string[] {
    const topics: string[] = [];

    // Identify topics from page type
    if (pageContext.pageType) {
      topics.push(pageContext.pageType);
    }

    // Common educational patterns
    const patterns = [
      { pattern: /mathematics|algebra|calculus|geometry/i, topic: 'Mathematics' },
      { pattern: /programming|code|javascript|python|java/i, topic: 'Programming' },
      { pattern: /history|historical/i, topic: 'History' },
      { pattern: /science|physics|chemistry|biology/i, topic: 'Science' },
      { pattern: /literature|writing|essay/i, topic: 'Literature' },
      { pattern: /quiz|test|exam/i, topic: 'Assessment' },
      { pattern: /discussion|forum/i, topic: 'Discussion' },
      { pattern: /video|lecture/i, topic: 'Lecture' },
    ];

    for (const { pattern, topic } of patterns) {
      if (pattern.test(content) && !topics.includes(topic)) {
        topics.push(topic);
      }
    }

    return topics;
  }

  generateContextSummary(enrichedContext: EnrichedContext): string {
    const parts: string[] = [];

    // Course and module info
    if (enrichedContext.page.courseName) {
      parts.push(`Course: ${enrichedContext.page.courseName}`);
    }
    if (enrichedContext.page.moduleName) {
      parts.push(`Module: ${enrichedContext.page.moduleName}`);
    }
    if (enrichedContext.page.assignmentTitle) {
      parts.push(`Assignment: ${enrichedContext.page.assignmentTitle}`);
    }

    // User role
    if (enrichedContext.lti.roles.length > 0) {
      const role = enrichedContext.lti.roles[0].includes('Instructor') ? 'Instructor' : 'Student';
      parts.push(`Role: ${role}`);
    }

    // Topics
    if (enrichedContext.topics.length > 0) {
      parts.push(`Topics: ${enrichedContext.topics.join(', ')}`);
    }

    // Learning profile
    if (enrichedContext.learnerProfile) {
      if (enrichedContext.learnerProfile.learningStyle) {
        parts.push(`Learning Style: ${enrichedContext.learnerProfile.learningStyle}`);
      }
      if (enrichedContext.learnerProfile.performanceLevel) {
        parts.push(`Performance: ${enrichedContext.learnerProfile.performanceLevel}`);
      }
    }

    return parts.join(' | ');
  }

  shouldIncludeFullContent(question: string, content: string): boolean {
    // Determine if full page content should be included in prompt
    const questionLower = question.toLowerCase();

    // Include full content for specific question types
    const contentNeededPatterns = [
      /what does (this|the) (page|text|content|article) say/i,
      /explain (this|the) (content|material|text)/i,
      /summarize/i,
      /main (idea|point|concept)/i,
      /according to (this|the)/i,
    ];

    for (const pattern of contentNeededPatterns) {
      if (pattern.test(question)) {
        return true;
      }
    }

    // Check if question references specific content
    const contentWords = content.toLowerCase().split(/\W+/).slice(0, 100);
    const questionWords = questionLower.split(/\W+/);

    let matches = 0;
    for (const qWord of questionWords) {
      if (qWord.length > 4 && contentWords.includes(qWord)) {
        matches++;
      }
    }

    // Include if significant overlap
    return matches >= 3;
  }
}
