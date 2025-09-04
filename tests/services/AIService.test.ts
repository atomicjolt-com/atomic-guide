// TODO: Consider using ServiceTestHarness for AIService
import {  describe, it, expect, vi, beforeEach , MockFactory, TestDataFactory, ServiceTestHarness } from '@/tests/infrastructure';
import { AIService } from '../../src/services/AIService';

import type { MockD1Database, MockKVNamespace, MockQueue } from '@/tests/infrastructure/types/mocks';
describe('AIService', () => {
  let mockAIBinding: any;
  let aiService: AIService;

  beforeEach(() => {
    mockAIBinding = {
      run: vi.fn(),
    };
    aiService = new AIService(mockAIBinding);
  });

  describe('generateResponse', () => {
    it('should generate a response successfully', async () => {
      const mockResponse = {
        response: 'This is a test response from the AI model.',
      };
      mockAIBinding.run.mockResolvedValue(mockResponse);

      const result = await aiService.generateResponse('What is the capital of France?', 'You are a helpful assistant.', {
        modelName: '@cf/meta/llama-3.1-8b-instruct',
      });

      expect(result.response).toBe('This is a test response from the AI model.');
      expect(result.model).toBe('@cf/meta/llama-3.1-8b-instruct');
      expect(result.cached).toBe(false);
      expect(result.tokensUsed).toBeGreaterThan(0);

      expect(mockAIBinding.run).toHaveBeenCalledWith(
        '@cf/meta/llama-3.1-8b-instruct',
        expect.objectContaining({
          messages: expect.arrayContaining([
            { role: 'system', content: 'You are a helpful assistant.' },
            { role: 'user', content: 'What is the capital of France?' },
          ]),
          max_tokens: 2048,
          temperature: 0.7,
          stream: false,
        }),
        expect.any(Object),
      );
    });

    it('should retry on failure with exponential backoff', async () => {
      mockAIBinding.run
        .mockRejectedValueOnce(new Error('Network error'))
        .mockRejectedValueOnce(new Error('Network error'))
        .mockResolvedValueOnce({ response: 'Success after retries' });

      const result = await aiService.generateResponse('Test prompt', 'System prompt');

      expect(result.response).toBe('Success after retries');
      expect(mockAIBinding.run).toHaveBeenCalledTimes(3);
    });

    it('should throw error after max retries', async () => {
      mockAIBinding.run.mockRejectedValue(new Error('Persistent error'));

      await expect(aiService.generateResponse('Test prompt', 'System prompt')).rejects.toThrow('AI generation failed after 3 attempts');

      expect(mockAIBinding.run).toHaveBeenCalledTimes(3);
    });

    it('should use default model when not specified', async () => {
      mockAIBinding.run.mockResolvedValue({ response: 'Default model response' });

      await aiService.generateResponse('Test prompt', 'System prompt');

      expect(mockAIBinding.run).toHaveBeenCalledWith('@cf/meta/llama-3.1-8b-instruct', expect.any(Object), expect.any(Object));
    });
  });

  describe('generateStreamingResponse', () => {
    it('should stream responses correctly', async () => {
      const mockStream = {
        [Symbol.asyncIterator]: function* () {
          yield { response: 'Hello ' };
          yield { response: 'world' };
          yield { response: '!' };
        },
      };
      mockAIBinding.run.mockResolvedValue(mockStream);

      const chunks: any[] = [];
      const stream = aiService.generateStreamingResponse('Test prompt', 'System prompt');

      for await (const chunk of stream) {
        chunks.push(chunk);
      }

      expect(chunks).toHaveLength(4);
      expect(chunks[0]).toEqual({ text: 'Hello ', done: false });
      expect(chunks[1]).toEqual({ text: 'world', done: false });
      expect(chunks[2]).toEqual({ text: '!', done: false });
      expect(chunks[3]).toEqual({ text: '', done: true });
    });

    it('should handle non-streaming response fallback', async () => {
      mockAIBinding.run.mockResolvedValue({ response: 'Non-streaming response' });

      const chunks: any[] = [];
      const stream = aiService.generateStreamingResponse('Test prompt', 'System prompt');

      for await (const chunk of stream) {
        chunks.push(chunk);
      }

      expect(chunks).toHaveLength(2);
      expect(chunks[0]).toEqual({ text: 'Non-streaming response', done: false });
      expect(chunks[1]).toEqual({ text: '', done: true });
    });

    it('should handle streaming errors', async () => {
      mockAIBinding.run.mockRejectedValue(new Error('Stream error'));

      const stream = aiService.generateStreamingResponse('Test prompt', 'System prompt');

      await expect(async () => {
        for await (const _chunk of stream) {
          // Should throw before yielding any chunks
        }
      }).rejects.toThrow('Streaming generation failed: Stream error');
    });
  });

  describe('generateEmbedding', () => {
    it('should generate embeddings successfully', async () => {
      const mockEmbedding = {
        data: [[0.1, 0.2, 0.3, 0.4, 0.5]],
      };
      mockAIBinding.run.mockResolvedValue(mockEmbedding);

      const result = await aiService.generateEmbedding('Test text');

      expect(result).toEqual([0.1, 0.2, 0.3, 0.4, 0.5]);
      expect(mockAIBinding.run).toHaveBeenCalledWith('@cf/baai/bge-base-en-v1.5', { text: ['Test text'] }, expect.any(Object));
    });

    it('should handle embedding generation errors', async () => {
      mockAIBinding.run.mockRejectedValue(new Error('Embedding error'));

      await expect(aiService.generateEmbedding('Test text')).rejects.toThrow('Embedding generation failed: Embedding error');
    });

    it('should handle invalid embedding response format', async () => {
      mockAIBinding.run.mockResolvedValue({ invalid: 'response' });

      await expect(aiService.generateEmbedding('Test text')).rejects.toThrow('Invalid embedding response format');
    });
  });

  describe('isModelAvailable', () => {
    it('should return true for available models', async () => {
      mockAIBinding.run.mockResolvedValue({ response: 'test' });

      const result = await aiService.isModelAvailable('@cf/meta/llama-3.1-8b-instruct');

      expect(result).toBe(true);
      expect(mockAIBinding.run).toHaveBeenCalledWith(
        '@cf/meta/llama-3.1-8b-instruct',
        expect.objectContaining({
          messages: [{ role: 'user', content: 'test' }],
          max_tokens: 1,
        }),
        expect.any(Object),
      );
    });

    it('should return false for unavailable models', async () => {
      mockAIBinding.run.mockRejectedValue(new Error('Model not found'));

      const result = await aiService.isModelAvailable('invalid-model');

      expect(result).toBe(false);
    });
  });

  describe('token estimation', () => {
    it('should estimate tokens correctly', () => {
      const _service = new AIService(mockAIBinding);

      // Test internal token estimation (would need to expose for testing)
      // For now, we test it indirectly through generateResponse
      mockAIBinding.run.mockResolvedValue({ response: 'Short response' });

      aiService.generateResponse('This is a test prompt', 'System prompt').then((result) => {
        expect(result.tokensUsed).toBeGreaterThan(0);
        expect(result.tokensUsed).toBeLessThan(50); // Reasonable for short text
      });
    });
  });
});
