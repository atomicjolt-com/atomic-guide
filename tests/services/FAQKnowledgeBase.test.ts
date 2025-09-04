import {  describe, it, expect, vi, beforeEach , MockFactory, TestDataFactory, ServiceTestHarness } from '@/tests/infrastructure';
import { FAQKnowledgeBase } from '../../src/services/FAQKnowledgeBase';
import { AIService } from '../../src/services/AIService';

import type { MockD1Database, MockKVNamespace, MockQueue } from '@/tests/infrastructure/types/mocks';
describe('FAQKnowledgeBase', () => {
  let faqService: FAQKnowledgeBase;
  let mockAIService: AIService;
  let mockVectorizeIndex: any;
  let mockKvCache: any;
  let mockDB: any;

  beforeEach(() => {
    mockAIService = {
      generateEmbedding: vi.fn().mockResolvedValue([0.1, 0.2, 0.3]),
    } as any;

    mockVectorizeIndex = {
      query: vi.fn(),
      insert: vi.fn(),
      upsert: vi.fn(),
      deleteByIds: vi.fn(),
    };

    mockKvCache = {
      get: vi.fn(),
      put: vi.fn(),
      delete: vi.fn(),
    };

    mockDB = {
      prepare: vi.fn().mockReturnValue({
        bind: vi.fn().mockReturnValue({
          all: vi.fn(),
          first: vi.fn(),
          run: vi.fn(),
        }),
      }),
    };

    faqService = new FAQKnowledgeBase(mockAIService, mockVectorizeIndex, mockKvCache, mockDB);
  });

  describe('searchSimilarFAQs', () => {
    it('should find similar FAQs from vector search', async () => {
      const mockMatches = [
        {
          id: 'faq_123',
          score: 0.95,
          metadata: { tenantId: 'tenant-1', faqId: 'faq-1' },
        },
      ];

      // Mock vectorize query
      mockVectorizeIndex.query.mockResolvedValue({
        matches: mockMatches,
      });

      // Mock database FAQ lookup
      mockDB
        .prepare()
        .bind()
        .all.mockResolvedValue({
          results: [
            {
              id: 'faq-1',
              question: 'What is photosynthesis?',
              answer: 'Photosynthesis is the process...',
              tenant_id: 'tenant-1',
              course_id: 'bio-101',
              vector_id: 'faq_123',
              usage_count: 5,
              created_at: '2025-08-22T00:00:00Z',
              updated_at: '2025-08-22T00:00:00Z',
            },
          ],
        });

      // Mock cache miss
      mockKvCache.get.mockResolvedValue(null);

      const results = await faqService.searchSimilarFAQs('How does photosynthesis work?', 'tenant-1', 'bio-101');

      expect(results).toHaveLength(1);
      expect(results[0].question).toBe('What is photosynthesis?');
      expect(results[0].answer).toBe('Photosynthesis is the process...');
      expect(results[0].similarity).toBe(0.95);
      expect(mockAIService.generateEmbedding).toHaveBeenCalledWith('How does photosynthesis work?');
    });

    it('should return empty array when no similar FAQs found', async () => {
      mockVectorizeIndex.query.mockResolvedValue({
        matches: [],
      });

      mockKvCache.get.mockResolvedValue(null);

      const results = await faqService.searchSimilarFAQs('Random question', 'tenant-1');

      expect(results).toEqual([]);
    });

    it('should return cached results when available', async () => {
      const now = new Date();
      const cachedResults = [
        {
          id: 'faq-1',
          question: 'Cached question',
          answer: 'Cached answer',
          tenantId: 'tenant-1',
          usageCount: 10,
          createdAt: now.toISOString(),
          updatedAt: now.toISOString(),
        },
      ];

      mockKvCache.get.mockResolvedValue(
        JSON.stringify({
          data: cachedResults,
          timestamp: Date.now(),
        }),
      );

      const results = await faqService.searchSimilarFAQs('Test question', 'tenant-1');

      expect(results).toEqual(cachedResults);
      expect(mockAIService.generateEmbedding).not.toHaveBeenCalled();
    });

    it('should handle AI service errors gracefully', async () => {
      mockAIService.generateEmbedding = vi.fn().mockRejectedValue(new Error('AI service error'));
      mockKvCache.get.mockResolvedValue(null);

      const results = await faqService.searchSimilarFAQs('Test question', 'tenant-1');

      expect(results).toEqual([]);
    });
  });

  describe('addFAQ', () => {
    it('should add new FAQ with vector embedding', async () => {
      mockVectorizeIndex.insert.mockResolvedValue({ count: 1 });
      mockDB.prepare().bind().run.mockResolvedValue({ success: true });

      const result = await faqService.addFAQ('What is mitosis?', 'Mitosis is cell division...', 'tenant-1', 'bio-101');

      expect(result.question).toBe('What is mitosis?');
      expect(result.answer).toBe('Mitosis is cell division...');
      expect(result.tenantId).toBe('tenant-1');
      expect(result.courseId).toBe('bio-101');
      expect(mockAIService.generateEmbedding).toHaveBeenCalledWith('What is mitosis?');
      expect(mockVectorizeIndex.insert).toHaveBeenCalled();
      expect(mockDB.prepare).toHaveBeenCalled();
    });

    it('should handle database errors during FAQ creation', async () => {
      mockVectorizeIndex.insert.mockResolvedValue({ count: 1 });
      mockDB.prepare().bind().run.mockRejectedValue(new Error('Database error'));

      await expect(faqService.addFAQ('Test question', 'Test answer', 'tenant-1')).rejects.toThrow('Failed to add FAQ entry');
    });
  });

  describe('updateFAQ', () => {
    it('should update existing FAQ', async () => {
      // Mock getting existing FAQ
      mockDB.prepare().bind().first.mockResolvedValueOnce({
        id: 'faq-1',
        tenant_id: 'tenant-1',
        course_id: 'bio-101',
        question: 'Old question',
        answer: 'Old answer',
        vector_id: 'vec-123',
        usage_count: 5,
        created_at: '2025-08-22T00:00:00Z',
        updated_at: '2025-08-22T00:00:00Z',
      });

      // Mock update query
      mockDB.prepare().bind().run.mockResolvedValueOnce({ success: true });
      mockVectorizeIndex.upsert.mockResolvedValue({ count: 1 });

      const result = await faqService.updateFAQ('faq-1', { question: 'Updated question', answer: 'Updated answer' }, 'tenant-1');

      expect(result.question).toBe('Updated question');
      expect(result.answer).toBe('Updated answer');
      expect(mockVectorizeIndex.upsert).toHaveBeenCalled();
    });
  });

  describe('deleteFAQ', () => {
    it('should delete FAQ from both vector and database', async () => {
      // Mock getting existing FAQ
      mockDB.prepare().bind().first.mockResolvedValueOnce({
        id: 'faq-1',
        tenant_id: 'tenant-1',
        vector_id: 'vec-123',
        course_id: 'bio-101',
      });

      // Mock delete operations
      mockVectorizeIndex.deleteByIds.mockResolvedValue({ count: 1 });
      mockDB.prepare().bind().run.mockResolvedValueOnce({ success: true });

      await faqService.deleteFAQ('faq-1', 'tenant-1');

      expect(mockVectorizeIndex.deleteByIds).toHaveBeenCalledWith(['vec-123']);
      expect(mockDB.prepare).toHaveBeenCalledWith(expect.stringContaining('DELETE FROM faq_entries'));
    });

    it('should handle missing FAQ during deletion', async () => {
      mockDB.prepare().bind().first.mockResolvedValueOnce(null);

      await expect(faqService.deleteFAQ('nonexistent', 'tenant-1')).rejects.toThrow('FAQ not found');
    });
  });

  describe('filtering and relevance', () => {
    it('should filter FAQs by similarity threshold', async () => {
      const mockMatches = [
        { id: 'faq_1', score: 0.95 }, // Above threshold
        { id: 'faq_2', score: 0.6 }, // Below threshold
        { id: 'faq_3', score: 0.85 }, // Above threshold
      ];

      mockVectorizeIndex.query.mockResolvedValue({
        matches: mockMatches,
      });

      mockDB
        .prepare()
        .bind()
        .all.mockResolvedValue({
          results: [
            {
              id: 'faq-1',
              vector_id: 'faq_1',
              question: 'High similarity',
              answer: 'Answer 1',
              tenant_id: 'tenant-1',
              usage_count: 0,
              created_at: '2025-08-22T00:00:00Z',
              updated_at: '2025-08-22T00:00:00Z',
            },
            {
              id: 'faq-3',
              vector_id: 'faq_3',
              question: 'Medium similarity',
              answer: 'Answer 3',
              tenant_id: 'tenant-1',
              usage_count: 0,
              created_at: '2025-08-22T00:00:00Z',
              updated_at: '2025-08-22T00:00:00Z',
            },
          ],
        });

      mockKvCache.get.mockResolvedValue(null);

      const results = await faqService.searchSimilarFAQs('Test question', 'tenant-1');

      // Should only return FAQs with similarity >= 0.7 (default threshold)
      expect(results).toHaveLength(2);
      expect(results[0].similarity).toBe(0.95);
      expect(results[1].similarity).toBe(0.85);
    });

    it('should sort by similarity and usage count', async () => {
      const mockMatches = [
        { id: 'faq_1', score: 0.85 },
        { id: 'faq_2', score: 0.87 },
      ];

      mockVectorizeIndex.query.mockResolvedValue({
        matches: mockMatches,
      });

      mockDB
        .prepare()
        .bind()
        .all.mockResolvedValue({
          results: [
            {
              id: 'faq-1',
              vector_id: 'faq_1',
              question: 'Lower similarity, high usage',
              tenant_id: 'tenant-1',
              usage_count: 100,
              created_at: '2025-08-22T00:00:00Z',
              updated_at: '2025-08-22T00:00:00Z',
            },
            {
              id: 'faq-2',
              vector_id: 'faq_2',
              question: 'Higher similarity, low usage',
              tenant_id: 'tenant-1',
              usage_count: 1,
              created_at: '2025-08-22T00:00:00Z',
              updated_at: '2025-08-22T00:00:00Z',
            },
          ],
        });

      mockKvCache.get.mockResolvedValue(null);

      const results = await faqService.searchSimilarFAQs('Test question', 'tenant-1');

      // Should sort by similarity first (higher is better)
      expect(results[0].similarity).toBe(0.87);
      expect(results[1].similarity).toBe(0.85);
    });
  });
});
