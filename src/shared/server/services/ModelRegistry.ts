export interface AIModel {
  id: string;
  name: string;
  description: string;
  category: 'text-generation' | 'code-generation' | 'embeddings' | 'image-generation';
  maxTokens: number;
  defaultTokens: number;
  costPerToken?: number;
}

export class ModelRegistry {
  private static models: AIModel[] = [
    {
      id: '@cf/meta/llama-3.1-8b-instruct',
      name: 'Llama 3.1 8B Instruct',
      description: 'Fast, efficient instruction-following model',
      category: 'text-generation',
      maxTokens: 4096,
      defaultTokens: 2048,
    },
    {
      id: '@cf/meta/llama-3.1-70b-instruct',
      name: 'Llama 3.1 70B Instruct',
      description: 'Large, powerful instruction-following model',
      category: 'text-generation',
      maxTokens: 8192,
      defaultTokens: 2048,
    },
    {
      id: '@cf/mistral/mistral-7b-instruct-v0.2',
      name: 'Mistral 7B Instruct v0.2',
      description: 'Efficient open-source instruction model',
      category: 'text-generation',
      maxTokens: 4096,
      defaultTokens: 2048,
    },
    {
      id: '@cf/microsoft/phi-2',
      name: 'Phi-2',
      description: 'Small, efficient model for basic tasks',
      category: 'text-generation',
      maxTokens: 2048,
      defaultTokens: 1024,
    },
    {
      id: '@cf/qwen/qwen1.5-14b-chat-awq',
      name: 'Qwen 1.5 14B Chat',
      description: 'Multilingual chat model',
      category: 'text-generation',
      maxTokens: 4096,
      defaultTokens: 2048,
    },
    {
      id: '@cf/deepseek/deepseek-coder-6.7b-instruct-awq',
      name: 'DeepSeek Coder 6.7B',
      description: 'Specialized code generation model',
      category: 'code-generation',
      maxTokens: 4096,
      defaultTokens: 2048,
    },
    {
      id: '@cf/thebloke/codellama-7b-instruct-awq',
      name: 'CodeLlama 7B Instruct',
      description: 'Code-focused instruction model',
      category: 'code-generation',
      maxTokens: 4096,
      defaultTokens: 2048,
    },
    {
      id: '@cf/baai/bge-base-en-v1.5',
      name: 'BGE Base English v1.5',
      description: 'Text embedding model for semantic search',
      category: 'embeddings',
      maxTokens: 512,
      defaultTokens: 512,
    },
    {
      id: '@cf/baai/bge-large-en-v1.5',
      name: 'BGE Large English v1.5',
      description: 'Large text embedding model',
      category: 'embeddings',
      maxTokens: 512,
      defaultTokens: 512,
    },
    {
      id: '@cf/baai/bge-small-en-v1.5',
      name: 'BGE Small English v1.5',
      description: 'Compact text embedding model',
      category: 'embeddings',
      maxTokens: 512,
      defaultTokens: 512,
    },
  ];

  private cachedModels: Map<string, AIModel> = new Map();
  private lastFetch: number = 0;
  private cacheTTL: number = 3600000; // 1 hour

  constructor() {
    this.initializeCache();
  }

  private initializeCache(): void {
    ModelRegistry.models.forEach((model) => {
      this.cachedModels.set(model.id, model);
    });
    this.lastFetch = Date.now();
  }

  async getAvailableModels(category?: string): Promise<AIModel[]> {
    if (Date.now() - this.lastFetch > this.cacheTTL) {
      await this.refreshModels();
    }

    const models = Array.from(this.cachedModels.values());

    if (category) {
      return models.filter((m) => m.category === category);
    }

    return models;
  }

  async getModel(modelId: string): Promise<AIModel | null> {
    if (Date.now() - this.lastFetch > this.cacheTTL) {
      await this.refreshModels();
    }

    return this.cachedModels.get(modelId) || null;
  }

  async getTextGenerationModels(): Promise<AIModel[]> {
    return this.getAvailableModels('text-generation');
  }

  async getCodeGenerationModels(): Promise<AIModel[]> {
    return this.getAvailableModels('code-generation');
  }

  async getEmbeddingModels(): Promise<AIModel[]> {
    return this.getAvailableModels('embeddings');
  }

  async validateModel(modelId: string, aiService: any): Promise<boolean> {
    const model = await this.getModel(modelId);
    if (!model) {
      return false;
    }

    try {
      return await aiService.isModelAvailable(modelId);
    } catch {
      return false;
    }
  }

  getDefaultModel(category: string = 'text-generation'): string {
    const models = ModelRegistry.models.filter((m) => m.category === category);
    return models[0]?.id || '@cf/meta/llama-3.1-8b-instruct';
  }

  private async refreshModels(): Promise<void> {
    try {
      // In future, this could fetch from Cloudflare API
      // For now, use static list
      this.initializeCache();
    } catch (error) {
      console.error('Failed to refresh model list:', error);
    }
  }
}
