import { AIService } from './AIService';

export interface FAQEntry {
  id: string;
  tenantId: string;
  courseId?: string;
  question: string;
  answer: string;
  vectorId?: string;
  usageCount: number;
  similarity?: number;
  createdAt: Date;
  updatedAt: Date;
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
    limit: number = 5
  ): Promise<FAQEntry[]> {
    try {
      // Check cache first
      const cacheKey = this.getCacheKey(question, tenantId, courseId);
      const cached = await this.getFromCache(cacheKey);
      if (cached) {
        return cached;
      }

      // Generate embedding for the question
      const embedding = await this.aiService.generateEmbedding(question);

      // Search in Vectorize
      const searchResults = await this.searchVectors(embedding, limit * 2, { tenantId, courseId });

      // Fetch FAQ entries from database
      const faqs = await this.fetchFAQsByVectorIds(searchResults, tenantId);

      // Filter and sort by relevance
      const relevantFAQs = this.filterRelevantFAQs(faqs, question, limit);

      // Cache the results
      await this.cacheResults(cacheKey, relevantFAQs);

      // Update usage statistics asynchronously
      this.updateUsageStats(relevantFAQs.map(f => f.id));

      return relevantFAQs;
    } catch (error) {
      console.error('FAQ search failed:', error);
      return [];
    }
  }

  async addFAQ(
    question: string,
    answer: string,
    tenantId: string,
    courseId?: string
  ): Promise<FAQEntry> {
    try {
      // Generate embedding
      const embedding = await this.aiService.generateEmbedding(question);

      // Create unique ID
      const id = this.generateId();
      const vectorId = `faq_${id}`;

      // Store in Vectorize
      await this.vectorizeIndex.insert([{
        id: vectorId,
        values: embedding,
        metadata: {
          tenantId,
          courseId: courseId || '',
          faqId: id
        }
      }]);

      // Store in database
      const faqEntry: FAQEntry = {
        id,
        tenantId,
        courseId,
        question,
        answer,
        vectorId,
        usageCount: 0,
        createdAt: new Date(),
        updatedAt: new Date()
      };

      await this.db.prepare(`
        INSERT INTO faq_entries (id, tenant_id, course_id, question, answer, vector_id, usage_count, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).bind(
        faqEntry.id,
        faqEntry.tenantId,
        faqEntry.courseId || null,
        faqEntry.question,
        faqEntry.answer,
        faqEntry.vectorId,
        faqEntry.usageCount,
        faqEntry.createdAt.toISOString(),
        faqEntry.updatedAt.toISOString()
      ).run();

      // Invalidate cache
      await this.invalidateCache(tenantId, courseId);

      return faqEntry;
    } catch (error) {
      console.error('Failed to add FAQ:', error);
      throw new Error('Failed to add FAQ entry');
    }
  }

  async updateFAQ(
    id: string,
    updates: Partial<{ question: string; answer: string }>,
    tenantId: string
  ): Promise<FAQEntry> {
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
          await this.vectorizeIndex.upsert([{
            id: existing.vectorId,
            values: newEmbedding,
            metadata: {
              tenantId,
              courseId: existing.courseId || '',
              faqId: id
            }
          }]);
        }
      }

      // Update in database
      const updatedFAQ = {
        ...existing,
        ...updates,
        updatedAt: new Date()
      };

      await this.db.prepare(`
        UPDATE faq_entries 
        SET question = ?, answer = ?, updated_at = ?
        WHERE id = ? AND tenant_id = ?
      `).bind(
        updatedFAQ.question,
        updatedFAQ.answer,
        updatedFAQ.updatedAt.toISOString(),
        id,
        tenantId
      ).run();

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
      await this.db.prepare(`
        DELETE FROM faq_entries WHERE id = ? AND tenant_id = ?
      `).bind(id, tenantId).run();

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
        returnMetadata: true
      });

      return results.matches || [];
    } catch (error) {
      console.error('Vector search failed:', error);
      return [];
    }
  }

  private async fetchFAQsByVectorIds(
    searchResults: VectorSearchResult[],
    tenantId: string
  ): Promise<FAQEntry[]> {
    if (searchResults.length === 0) {
      return [];
    }

    const vectorIds = searchResults.map(r => r.id);
    const placeholders = vectorIds.map(() => '?').join(',');

    const results = await this.db.prepare(`
      SELECT * FROM faq_entries 
      WHERE tenant_id = ? AND vector_id IN (${placeholders})
    `).bind(tenantId, ...vectorIds).all();

    // Map results with similarity scores
    const faqMap = new Map<string, FAQEntry>();
    for (const row of results.results || []) {
      const faq: FAQEntry = {
        id: row.id,
        tenantId: row.tenant_id,
        courseId: row.course_id,
        question: row.question,
        answer: row.answer,
        vectorId: row.vector_id,
        usageCount: row.usage_count,
        createdAt: new Date(row.created_at),
        updatedAt: new Date(row.updated_at)
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

  private filterRelevantFAQs(faqs: FAQEntry[], question: string, limit: number): FAQEntry[] {
    // Filter by minimum similarity threshold
    const minSimilarity = 0.7;
    const relevant = faqs.filter(faq => (faq.similarity || 0) >= minSimilarity);

    // FAQs are already sorted by similarity from the vector search
    // We only re-sort if we need to consider usage count for ties
    relevant.sort((a, b) => {
      const simDiff = (b.similarity || 0) - (a.similarity || 0);
      // Only consider usage count if similarity is very close (within 0.01)
      if (Math.abs(simDiff) < 0.01) {
        return b.usageCount - a.usageCount;
      }
      return simDiff;
    });

    return relevant.slice(0, limit);
  }

  private async getFAQById(id: string, tenantId: string): Promise<FAQEntry | null> {
    const result = await this.db.prepare(`
      SELECT * FROM faq_entries WHERE id = ? AND tenant_id = ?
    `).bind(id, tenantId).first();

    if (!result) {
      return null;
    }

    return {
      id: result.id,
      tenantId: result.tenant_id,
      courseId: result.course_id,
      question: result.question,
      answer: result.answer,
      vectorId: result.vector_id,
      usageCount: result.usage_count,
      createdAt: new Date(result.created_at),
      updatedAt: new Date(result.updated_at)
    };
  }

  private async updateUsageStats(faqIds: string[]): Promise<void> {
    if (faqIds.length === 0) return;

    try {
      const placeholders = faqIds.map(() => '?').join(',');
      await this.db.prepare(`
        UPDATE faq_entries 
        SET usage_count = usage_count + 1, updated_at = ?
        WHERE id IN (${placeholders})
      `).bind(new Date().toISOString(), ...faqIds).run();
    } catch (error) {
      console.error('Failed to update usage stats:', error);
    }
  }

  private getCacheKey(question: string, tenantId: string, courseId?: string): string {
    const hash = this.simpleHash(question);
    return `faq:${tenantId}:${courseId || 'all'}:${hash}`;
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
      await this.kvCache.put(key, JSON.stringify({
        data: results,
        timestamp: Date.now()
      }), {
        expirationTtl: this.cacheTTL / 1000
      });
    } catch (error) {
      console.error('Cache storage failed:', error);
    }
  }

  private async invalidateCache(tenantId: string, courseId?: string): Promise<void> {
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
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash;
    }
    return Math.abs(hash).toString(36);
  }
}