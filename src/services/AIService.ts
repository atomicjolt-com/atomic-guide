import { Ai } from '@cloudflare/ai';

export interface AIServiceConfig {
  modelName?: string;
  maxTokens?: number;
  temperature?: number;
  stream?: boolean;
}

export interface AIResponse {
  response: string;
  tokensUsed?: number;
  model?: string;
  cached?: boolean;
}

export interface StreamChunk {
  text: string;
  done: boolean;
}

export class AIService {
  private ai: Ai;
  private defaultModel: string;
  private retryAttempts: number = 3;
  private retryDelay: number = 1000;

  constructor(aiBinding: any, defaultModel: string = '@cf/meta/llama-3.1-8b-instruct') {
    this.ai = new Ai(aiBinding);
    this.defaultModel = defaultModel;
  }

  async generateResponse(prompt: string, systemPrompt: string, config: AIServiceConfig = {}): Promise<AIResponse> {
    const model = config.modelName || this.defaultModel;
    const maxTokens = config.maxTokens || 2048;
    const temperature = config.temperature || 0.7;

    let lastError: Error | null = null;

    for (let attempt = 0; attempt < this.retryAttempts; attempt++) {
      try {
        const messages = [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: prompt },
        ];

        const response = await this.ai.run(model, {
          messages,
          max_tokens: maxTokens,
          temperature,
          stream: false,
        });

        if (response && response.response) {
          return {
            response: response.response,
            tokensUsed: this.estimateTokens(prompt + response.response),
            model,
            cached: false,
          };
        }

        throw new Error('Invalid AI response format');
      } catch (error) {
        lastError = error as Error;
        console.error(`AI generation attempt ${attempt + 1} failed:`, error);

        if (attempt < this.retryAttempts - 1) {
          await this.delay(this.retryDelay * Math.pow(2, attempt));
        }
      }
    }

    throw new Error(`AI generation failed after ${this.retryAttempts} attempts: ${lastError?.message}`);
  }

  async *generateStreamingResponse(prompt: string, systemPrompt: string, config: AIServiceConfig = {}): AsyncGenerator<StreamChunk> {
    const model = config.modelName || this.defaultModel;
    const maxTokens = config.maxTokens || 2048;
    const temperature = config.temperature || 0.7;

    try {
      const messages = [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: prompt },
      ];

      const stream = await this.ai.run(model, {
        messages,
        max_tokens: maxTokens,
        temperature,
        stream: true,
      });

      if (typeof stream[Symbol.asyncIterator] === 'function') {
        for await (const chunk of stream) {
          if (chunk.response) {
            yield {
              text: chunk.response,
              done: false,
            };
          }
        }
      } else if (stream.response) {
        yield {
          text: stream.response,
          done: false,
        };
      }

      yield {
        text: '',
        done: true,
      };
    } catch (error) {
      console.error('Streaming generation failed:', error);
      throw new Error(`Streaming generation failed: ${(error as Error).message}`);
    }
  }

  async generateEmbedding(text: string): Promise<number[]> {
    const embeddingModel = '@cf/baai/bge-base-en-v1.5';

    try {
      const response = await this.ai.run(embeddingModel, {
        text: [text],
      });

      if (response && response.data && response.data[0]) {
        return response.data[0];
      }

      throw new Error('Invalid embedding response format');
    } catch (error) {
      console.error('Embedding generation failed:', error);
      throw new Error(`Embedding generation failed: ${(error as Error).message}`);
    }
  }

  async isModelAvailable(modelName: string): Promise<boolean> {
    try {
      const testResponse = await this.ai.run(modelName, {
        messages: [{ role: 'user', content: 'test' }],
        max_tokens: 1,
      });
      return !!testResponse;
    } catch {
      return false;
    }
  }

  private estimateTokens(text: string): number {
    return Math.ceil(text.length / 4);
  }

  private delay(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}
