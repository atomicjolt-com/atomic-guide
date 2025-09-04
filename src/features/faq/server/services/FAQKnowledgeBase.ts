import { AIService } from '@shared/server/services';

export interface FAQEntry {
  id: string;
  tenantId: string;
  courseId?: string;
  moduleId?: string;
  question: string;
  answer: string;
  questionHash?: string;
  richMediaContent?: RichMediaContent[];
  vectorId?: string;
  usageCount: number;
  effectivenessScore: number;
  similarity?: number;
  createdAt: Date;
  updatedAt: Date;
}

export interface RichMediaContent {
  type: 'latex' | 'code' | 'diagram' | 'video';
  content: string;
  metadata?: {
    language?: string; // for code
    complexity?: 'beginner' | 'advanced'; // for diagrams
    duration?: number; // for videos
    inline?: boolean; // for latex - inline vs block
  };
}

export interface FAQSearchOptions {
  fuzzySearch?: boolean;
  includeInactive?: boolean;
  sortBy?: 'relevance' | 'usage' | 'effectiveness';
  minConfidence?: number;
}

export interface VectorSearchResult {
  id: string;
  score: number;
  metadata?: Record<string, any>;
}

export class FAQKnowledgeBase {
  private aiService: AIService;
  private vectorizeIndex: any;
  private kvCache: any;
  private db: any;
  private cacheTTL: number = 3600000; // 1 hour

  constructor(aiService: AIService, vectorizeIndex: any, kvCache: any, db: any) {
    this.aiService = aiService;
    this.vectorizeIndex = vectorizeIndex;
    this.kvCache = kvCache;
    this.db = db;
  }

  async searchSimilarFAQs(
    question: string,
    tenantId: string,
    courseId?: string,
    limit: number = 5,
    options: FAQSearchOptions = {}
  ): Promise<FAQEntry[]> {
    const startTime = Date.now();

    try {
      // Check cache first for performance requirement (<100ms)
      const cacheKey = this.getCacheKey(question, tenantId, courseId, options);
      const cached = await this.getFromCache(cacheKey);
      if (cached) {
        console.log(`FAQ cache hit in ${Date.now() - startTime}ms`);
        return cached;
      }

      let results: FAQEntry[] = [];

      // Try vector search first (primary method)
      if (!options.fuzzySearch) {
        const embedding = await this.aiService.generateEmbedding(question);
        const searchResults = await this.searchVectors(embedding, limit * 2, { tenantId, courseId });
        const faqs = await this.fetchFAQsByVectorIds(searchResults, tenantId);
        results = this.filterRelevantFAQs(faqs, question, limit, options);
      }

      // Fallback to fuzzy text search if vector search returns no results
      if (results.length === 0 || options.fuzzySearch) {
        const fuzzyResults = await this.fuzzyTextSearch(question, tenantId, courseId, limit, options);
        results = results.concat(fuzzyResults);

        // Remove duplicates and limit
        const seen = new Set<string>();
        results = results
          .filter((faq) => {
            if (seen.has(faq.id)) return false;
            seen.add(faq.id);
            return true;
          })
          .slice(0, limit);
      }

      // Sort based on options
      results = this.sortFAQResults(results, options.sortBy || 'relevance');

      // Cache the results
      await this.cacheResults(cacheKey, results);

      // Update usage statistics and effectiveness tracking asynchronously
      if (results.length > 0) {
        this.updateUsageStats(results.map((f) => f.id));
        this.trackFAQUsagePatterns(question, tenantId, courseId, results);
      }

      const searchTime = Date.now() - startTime;
      console.log(`FAQ search completed in ${searchTime}ms, found ${results.length} results`);

      // Log warning if search is slow (>100ms requirement)
      if (searchTime > 100) {
        console.warn(`FAQ search exceeded 100ms target: ${searchTime}ms`);
      }

      return results;
    } catch (error) {
      console.error('FAQ search failed:', error);
      // Try fallback fuzzy search
      try {
        return await this.fuzzyTextSearch(question, tenantId, courseId, limit, options);
      } catch (fallbackError) {
        console.error('Fallback FAQ search also failed:', fallbackError);
        return [];
      }
    }
  }

  async addFAQ(
    question: string,
    answer: string,
    tenantId: string,
    courseId?: string,
    moduleId?: string,
    richMediaContent?: RichMediaContent[]
  ): Promise<FAQEntry> {
    try {
      // Generate embedding
      const embedding = await this.aiService.generateEmbedding(question);

      // Create unique ID and question hash
      const id = this.generateId();
      const vectorId = `faq_${id}`;
      const questionHash = this.generateQuestionHash(question);

      // Store in Vectorize
      await this.vectorizeIndex.insert([
        {
          id: vectorId,
          values: embedding,
          metadata: {
            tenantId,
            courseId: courseId || '',
            moduleId: moduleId || '',
            faqId: id,
          },
        },
      ]);

      // Store in database with enhanced schema
      const faqEntry: FAQEntry = {
        id,
        tenantId,
        courseId,
        moduleId,
        question,
        answer,
        questionHash,
        richMediaContent,
        vectorId,
        usageCount: 0,
        effectivenessScore: 0.5, // Default effectiveness
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      await this.db
        .prepare(
          `
        INSERT INTO faq_entries (
          id, tenant_id, course_id, module_id, question, answer, question_hash, 
          rich_media_content, vector_id, usage_count, effectiveness_score, 
          created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `
        )
        .bind(
          faqEntry.id,
          faqEntry.tenantId,
          faqEntry.courseId || null,
          faqEntry.moduleId || null,
          faqEntry.question,
          faqEntry.answer,
          faqEntry.questionHash,
          JSON.stringify(faqEntry.richMediaContent || []),
          faqEntry.vectorId,
          faqEntry.usageCount,
          faqEntry.effectivenessScore,
          faqEntry.createdAt.toISOString(),
          faqEntry.updatedAt.toISOString()
        )
        .run();

      // Invalidate cache
      await this.invalidateCache(tenantId, courseId);

      return faqEntry;
    } catch (error) {
      console.error('Failed to add FAQ:', error);
      throw new Error('Failed to add FAQ entry');
    }
  }

  async updateFAQ(id: string, updates: Partial<{ question: string; answer: string }>, tenantId: string): Promise<FAQEntry> {
    try {
      // Fetch existing FAQ
      const existing = await this.getFAQById(id, tenantId);
      if (!existing) {
        throw new Error('FAQ not found');
      }

      // Update embedding if question changed
      if (updates.question && updates.question !== existing.question) {
        const newEmbedding = await this.aiService.generateEmbedding(updates.question);

        // Update in Vectorize
        if (existing.vectorId) {
          await this.vectorizeIndex.upsert([
            {
              id: existing.vectorId,
              values: newEmbedding,
              metadata: {
                tenantId,
                courseId: existing.courseId || '',
                faqId: id,
              },
            },
          ]);
        }
      }

      // Update in database
      const updatedFAQ = {
        ...existing,
        ...updates,
        updatedAt: new Date(),
      };

      await this.db
        .prepare(
          `
        UPDATE faq_entries 
        SET question = ?, answer = ?, updated_at = ?
        WHERE id = ? AND tenant_id = ?
      `
        )
        .bind(updatedFAQ.question, updatedFAQ.answer, updatedFAQ.updatedAt.toISOString(), id, tenantId)
        .run();

      // Invalidate cache
      await this.invalidateCache(tenantId, existing.courseId);

      return updatedFAQ;
    } catch (error) {
      console.error('Failed to update FAQ:', error);
      throw new Error('Failed to update FAQ entry');
    }
  }

  async deleteFAQ(id: string, tenantId: string): Promise<void> {
    try {
      // Fetch FAQ to get vector ID
      const faq = await this.getFAQById(id, tenantId);
      if (!faq) {
        throw new Error('FAQ not found');
      }

      // Delete from Vectorize
      if (faq.vectorId) {
        await this.vectorizeIndex.deleteByIds([faq.vectorId]);
      }

      // Delete from database
      await this.db
        .prepare(
          `
        DELETE FROM faq_entries WHERE id = ? AND tenant_id = ?
      `
        )
        .bind(id, tenantId)
        .run();

      // Invalidate cache
      await this.invalidateCache(tenantId, faq.courseId);
    } catch (error: any) {
      // Re-throw the original error if it's "FAQ not found"
      if (error.message === 'FAQ not found') {
        throw error;
      }
      console.error('Failed to delete FAQ:', error);
      throw new Error('Failed to delete FAQ entry');
    }
  }

  private async searchVectors(
    embedding: number[],
    limit: number,
    metadata: { tenantId: string; courseId?: string }
  ): Promise<VectorSearchResult[]> {
    try {
      const filter: any = { tenantId: metadata.tenantId };
      if (metadata.courseId) {
        filter.courseId = metadata.courseId;
      }

      const results = await this.vectorizeIndex.query(embedding, {
        topK: limit,
        filter,
        returnMetadata: true,
      });

      return results.matches || [];
    } catch (error) {
      console.error('Vector search failed:', error);
      return [];
    }
  }

  private async getFAQById(id: string, tenantId: string): Promise<FAQEntry | null> {
    const result = await this.db
      .prepare(
        `
      SELECT * FROM faq_entries WHERE id = ? AND tenant_id = ?
    `
      )
      .bind(id, tenantId)
      .first();

    if (!result) {
      return null;
    }

    return {
      id: result.id,
      tenantId: result.tenant_id,
      courseId: result.course_id,
      moduleId: result.module_id,
      question: result.question,
      answer: result.answer,
      questionHash: result.question_hash,
      richMediaContent: result.rich_media_content ? JSON.parse(result.rich_media_content) : [],
      vectorId: result.vector_id,
      usageCount: result.usage_count,
      effectivenessScore: result.effectiveness_score || 0.5,
      createdAt: new Date(result.created_at),
      updatedAt: new Date(result.updated_at),
    };
  }

  private async updateUsageStats(faqIds: string[]): Promise<void> {
    if (faqIds.length === 0) return;

    try {
      const placeholders = faqIds.map(() => '?').join(',');
      await this.db
        .prepare(
          `
        UPDATE faq_entries 
        SET usage_count = usage_count + 1, updated_at = ?
        WHERE id IN (${placeholders})
      `
        )
        .bind(new Date().toISOString(), ...faqIds)
        .run();
    } catch (error) {
      console.error('Failed to update usage stats:', error);
    }
  }

  private async getFromCache(key: string): Promise<FAQEntry[] | null> {
    try {
      const cached = await this.kvCache.get(key);
      if (!cached) return null;

      // Parse if it's a string
      const parsedCache = typeof cached === 'string' ? JSON.parse(cached) : cached;

      // Handle both formats (with and without timestamp)
      if (parsedCache.data && parsedCache.timestamp) {
        if (parsedCache.timestamp > Date.now() - this.cacheTTL) {
          return parsedCache.data;
        }
      } else if (Array.isArray(parsedCache)) {
        // Direct array format (for tests)
        return parsedCache;
      }
    } catch (error) {
      console.error('Cache retrieval failed:', error);
    }
    return null;
  }

  private async cacheResults(key: string, results: FAQEntry[]): Promise<void> {
    try {
      await this.kvCache.put(
        key,
        JSON.stringify({
          data: results,
          timestamp: Date.now(),
        }),
        {
          expirationTtl: this.cacheTTL / 1000,
        }
      );
    } catch (error) {
      console.error('Cache storage failed:', error);
    }
  }

  private async invalidateCache(_tenantId: string, _courseId?: string): Promise<void> {
    // In production, implement more sophisticated cache invalidation
    // For now, we'll rely on TTL expiration
  }

  private generateId(): string {
    return `faq_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  private simpleHash(str: string): string {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = (hash << 5) - hash + char;
      hash = hash & hash;
    }
    return Math.abs(hash).toString(36);
  }

  // Enhanced methods for Story 2.2

  private generateQuestionHash(question: string): string {
    // Normalize question for consistent hashing
    const normalized = question
      .toLowerCase()
      .replace(/[^\w\s]/g, '') // Remove punctuation
      .replace(/\s+/g, ' ') // Normalize whitespace
      .trim();
    return this.simpleHash(normalized);
  }

  private async fuzzyTextSearch(
    question: string,
    tenantId: string,
    courseId?: string,
    limit: number = 5,
    options: FAQSearchOptions = {}
  ): Promise<FAQEntry[]> {
    try {
      // Use SQLite's FTS (Full Text Search) if available, otherwise use LIKE
      const searchTerm = this.normalizeSearchTerm(question);
      const minConfidence = options.minConfidence || 0.5;

      let query = `
        SELECT *, 
        CASE 
          WHEN question LIKE ? THEN 0.9
          WHEN question LIKE ? THEN 0.8
          WHEN answer LIKE ? THEN 0.6
          WHEN answer LIKE ? THEN 0.5
          ELSE 0.3
        END as confidence_score
        FROM faq_entries 
        WHERE tenant_id = ?
        AND (course_id = ? OR ? IS NULL)
        AND (
          question LIKE ? OR 
          question LIKE ? OR 
          answer LIKE ? OR 
          answer LIKE ?
        )
        HAVING confidence_score >= ?
        ORDER BY confidence_score DESC, usage_count DESC
        LIMIT ?
      `;

      const exactMatch = `%${searchTerm}%`;
      const fuzzyMatch = `%${searchTerm.split(' ').join('%')}%`;

      const results = await this.db
        .prepare(query)
        .bind(
          exactMatch,
          fuzzyMatch,
          exactMatch,
          fuzzyMatch, // for confidence calculation
          tenantId,
          courseId,
          courseId,
          exactMatch,
          fuzzyMatch,
          exactMatch,
          fuzzyMatch, // for WHERE clause
          minConfidence,
          limit
        )
        .all();

      const faqs: FAQEntry[] = [];
      const resultRows = results?.results || results || [];
      for (const row of resultRows) {
        const faq: FAQEntry = {
          id: row.id,
          tenantId: row.tenant_id,
          courseId: row.course_id,
          moduleId: row.module_id,
          question: row.question,
          answer: row.answer,
          questionHash: row.question_hash,
          richMediaContent: row.rich_media_content ? JSON.parse(row.rich_media_content) : [],
          vectorId: row.vector_id,
          usageCount: row.usage_count,
          effectivenessScore: row.effectiveness_score || 0.5,
          similarity: row.confidence_score, // Use confidence as similarity
          createdAt: new Date(row.created_at),
          updatedAt: new Date(row.updated_at),
        };
        faqs.push(faq);
      }

      return faqs;
    } catch (error) {
      console.error('Fuzzy text search failed:', error);
      return [];
    }
  }

  private normalizeSearchTerm(question: string): string {
    return question
      .toLowerCase()
      .replace(/[^\w\s]/g, '') // Remove punctuation
      .replace(/\s+/g, ' ') // Normalize whitespace
      .trim();
  }

  private sortFAQResults(faqs: FAQEntry[], sortBy: string): FAQEntry[] {
    switch (sortBy) {
      case 'usage':
        return faqs.sort((a, b) => b.usageCount - a.usageCount);
      case 'effectiveness':
        return faqs.sort((a, b) => b.effectivenessScore - a.effectivenessScore);
      case 'relevance':
      default:
        return faqs.sort((a, b) => {
          const simDiff = (b.similarity || 0) - (a.similarity || 0);
          if (Math.abs(simDiff) < 0.01) {
            return b.effectivenessScore - a.effectivenessScore;
          }
          return simDiff;
        });
    }
  }

  private async trackFAQUsagePatterns(question: string, tenantId: string, courseId?: string, results: FAQEntry[]): Promise<void> {
    try {
      const questionPattern = this.normalizeSearchTerm(question);

      // Check if this pattern already exists
      const existing = await this.db
        .prepare(
          `
        SELECT id, occurrence_count FROM faq_usage_analytics 
        WHERE tenant_id = ? AND course_id = ? AND question_pattern = ?
      `
        )
        .bind(tenantId, courseId || '', questionPattern)
        .first();

      if (existing) {
        // Update existing pattern
        await this.db
          .prepare(
            `
          UPDATE faq_usage_analytics 
          SET occurrence_count = occurrence_count + 1, last_asked = ?
          WHERE id = ?
        `
          )
          .bind(new Date().toISOString(), existing.id)
          .run();

        // Auto-generate FAQ if threshold reached (5+ occurrences) and no FAQ exists
        if (existing.occurrence_count >= 4 && results.length === 0) {
          await this.autoGenerateFAQ(question, tenantId, courseId, questionPattern);
        }
      } else {
        // Create new pattern tracking
        const id = this.generateId();
        await this.db
          .prepare(
            `
          INSERT INTO faq_usage_analytics (
            id, tenant_id, course_id, question_pattern, occurrence_count, 
            last_asked, manual_review_needed, created_at
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        `
          )
          .bind(id, tenantId, courseId || '', questionPattern, 1, new Date().toISOString(), true, new Date().toISOString())
          .run();
      }
    } catch (error) {
      console.error('Failed to track FAQ usage patterns:', error);
    }
  }

  private async autoGenerateFAQ(question: string, tenantId: string, courseId?: string, questionPattern?: string): Promise<void> {
    try {
      // Generate FAQ answer using AI service
      const prompt = `Generate a helpful FAQ answer for the question: "${question}". 
        The answer should be clear, educational, and appropriate for a learning context.
        Include relevant examples if helpful. Keep the answer concise but comprehensive.`;

      const aiAnswer = await this.aiService.generateResponse(prompt, []);

      // Create auto-generated FAQ entry
      const generatedFAQ = await this.addFAQ(
        question,
        aiAnswer,
        tenantId,
        courseId,
        undefined, // no moduleId
        [] // no rich media initially
      );

      // Update usage analytics to reference the generated FAQ
      if (questionPattern) {
        await this.db
          .prepare(
            `
          UPDATE faq_usage_analytics 
          SET generated_faq_id = ?, manual_review_needed = ?
          WHERE tenant_id = ? AND course_id = ? AND question_pattern = ?
        `
          )
          .bind(generatedFAQ.id, true, tenantId, courseId || '', questionPattern)
          .run();
      }

      console.log(`Auto-generated FAQ for pattern: ${questionPattern}`);
    } catch (error) {
      console.error('Failed to auto-generate FAQ:', error);
    }
  }

  private getCacheKey(question: string, tenantId: string, courseId?: string, options?: FAQSearchOptions): string {
    const hash = this.simpleHash(question);
    const optionsHash = options ? this.simpleHash(JSON.stringify(options)) : '';
    return `faq:${tenantId}:${courseId || 'all'}:${hash}:${optionsHash}`;
  }

  // Update filterRelevantFAQs to accept options
  private filterRelevantFAQs(faqs: FAQEntry[], question: string, limit: number, options: FAQSearchOptions = {}): FAQEntry[] {
    // Filter by minimum similarity threshold
    const minSimilarity = options.minConfidence || 0.7;
    const relevant = faqs.filter((faq) => (faq.similarity || 0) >= minSimilarity);

    // Sort based on options
    return this.sortFAQResults(relevant, options.sortBy || 'relevance').slice(0, limit);
  }

  // Update fetchFAQsByVectorIds to handle rich media
  private async fetchFAQsByVectorIds(searchResults: VectorSearchResult[], tenantId: string): Promise<FAQEntry[]> {
    if (searchResults.length === 0) {
      return [];
    }

    const vectorIds = searchResults.map((r) => r.id);
    const placeholders = vectorIds.map(() => '?').join(',');

    const results = await this.db
      .prepare(
        `
      SELECT * FROM faq_entries 
      WHERE tenant_id = ? AND vector_id IN (${placeholders})
    `
      )
      .bind(tenantId, ...vectorIds)
      .all();

    // Map results with similarity scores and parse rich media
    const faqMap = new Map<string, FAQEntry>();
    const resultRows = results?.results || results || [];
    for (const row of resultRows) {
      const faq: FAQEntry = {
        id: row.id,
        tenantId: row.tenant_id,
        courseId: row.course_id,
        moduleId: row.module_id,
        question: row.question,
        answer: row.answer,
        questionHash: row.question_hash,
        richMediaContent: row.rich_media_content ? JSON.parse(row.rich_media_content) : [],
        vectorId: row.vector_id,
        usageCount: row.usage_count,
        effectivenessScore: row.effectiveness_score || 0.5,
        createdAt: new Date(row.created_at),
        updatedAt: new Date(row.updated_at),
      };
      faqMap.set(row.vector_id, faq);
    }

    // Maintain order from search results and add similarity scores
    const orderedFAQs: FAQEntry[] = [];
    for (const result of searchResults) {
      const faq = faqMap.get(result.id);
      if (faq) {
        faq.similarity = result.score;
        orderedFAQs.push(faq);
      }
    }

    return orderedFAQs;
  }

  // Enhanced method to update FAQ effectiveness scores based on user interactions
  async updateFAQEffectiveness(
    faqId: string,
    tenantId: string,
    interactionData: {
      engagementTime?: number;
      followUpQuestion?: boolean;
      userRating?: number; // 1-5
      helpfulness?: boolean;
    }
  ): Promise<void> {
    try {
      // Calculate new effectiveness score based on interaction data
      let effectivenessAdjustment = 0;

      if (interactionData.userRating !== undefined) {
        // Convert 1-5 rating to -0.2 to +0.2 adjustment
        effectivenessAdjustment += (interactionData.userRating - 3) * 0.067;
      }

      if (interactionData.engagementTime !== undefined) {
        // Longer engagement (>30s) is positive
        if (interactionData.engagementTime > 30000) {
          effectivenessAdjustment += 0.1;
        } else if (interactionData.engagementTime < 5000) {
          effectivenessAdjustment -= 0.1;
        }
      }

      if (interactionData.followUpQuestion === true) {
        effectivenessAdjustment -= 0.15; // Follow-up questions suggest incomplete answer
      }

      if (interactionData.helpfulness === false) {
        effectivenessAdjustment -= 0.2;
      } else if (interactionData.helpfulness === true) {
        effectivenessAdjustment += 0.15;
      }

      // Apply the adjustment with damping (don't change too drastically)
      const dampingFactor = 0.1;
      const actualAdjustment = effectivenessAdjustment * dampingFactor;

      await this.db
        .prepare(
          `
        UPDATE faq_entries 
        SET effectiveness_score = CASE
          WHEN effectiveness_score + ? > 1.0 THEN 1.0
          WHEN effectiveness_score + ? < 0.0 THEN 0.0
          ELSE effectiveness_score + ?
        END,
        updated_at = ?
        WHERE id = ? AND tenant_id = ?
      `
        )
        .bind(actualAdjustment, actualAdjustment, actualAdjustment, new Date().toISOString(), faqId, tenantId)
        .run();

      // Invalidate related cache
      const faq = await this.getFAQById(faqId, tenantId);
      if (faq) {
        await this.invalidateCache(tenantId, faq.courseId);
      }
    } catch (error) {
      console.error('Failed to update FAQ effectiveness:', error);
    }
  }
}
