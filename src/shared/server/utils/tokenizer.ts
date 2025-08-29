/**
 * Token counting utilities for AI model usage tracking
 * Approximates token counts for various AI models
 */

export class Tokenizer {
  // Average characters per token for different models (approximate)
  private static readonly MODEL_CHAR_PER_TOKEN: Record<string, number> = {
    '@cf/meta/llama-3.1-8b-instruct': 4,
    '@cf/meta/llama-3.1-70b-instruct': 4,
    '@cf/mistral/mistral-7b-instruct-v0.2': 3.5,
    '@cf/microsoft/phi-2': 3.5,
    '@cf/qwen/qwen1.5-14b-chat-awq': 3,
    '@cf/deepseek/deepseek-coder-6.7b-instruct-awq': 3.5,
    '@cf/thebloke/codellama-7b-instruct-awq': 3.5,
    'default': 4
  };

  /**
   * Estimate token count for a given text and model
   */
  static estimateTokens(text: string, modelName?: string): number {
    if (!text) return 0;
    
    const charsPerToken = this.MODEL_CHAR_PER_TOKEN[modelName || 'default'] || 4;
    
    // Basic estimation: character count divided by average chars per token
    let baseEstimate = Math.ceil(text.length / charsPerToken);
    
    // Adjust for special tokens and formatting
    baseEstimate += this.countSpecialTokens(text);
    
    // Add overhead for system/role tokens in conversation
    baseEstimate += 4; // Typical overhead for role markers
    
    return baseEstimate;
  }

  /**
   * Count special tokens that might increase token usage
   */
  private static countSpecialTokens(text: string): number {
    let specialTokens = 0;
    
    // Count newlines (often tokenized separately)
    specialTokens += (text.match(/\n/g) || []).length;
    
    // Count code blocks (require additional tokens for formatting)
    specialTokens += (text.match(/```/g) || []).length * 2;
    
    // Count special characters that are often tokenized separately
    specialTokens += (text.match(/[<>{}[\]]/g) || []).length * 0.5;
    
    return Math.ceil(specialTokens);
  }

  /**
   * Estimate tokens for a conversation with history
   */
  static estimateConversationTokens(
    messages: Array<{ role: string; content: string }>,
    modelName?: string
  ): number {
    let totalTokens = 0;
    
    for (const message of messages) {
      // Add tokens for the message content
      totalTokens += this.estimateTokens(message.content, modelName);
      
      // Add tokens for role markers (e.g., "Human:", "Assistant:")
      totalTokens += 3;
    }
    
    // Add tokens for conversation structure
    totalTokens += 10; // System prompt overhead
    
    return totalTokens;
  }

  /**
   * Calculate if a prompt fits within token limit
   */
  static fitsWithinLimit(
    text: string,
    maxTokens: number,
    modelName?: string,
    buffer: number = 100
  ): boolean {
    const estimatedTokens = this.estimateTokens(text, modelName);
    return estimatedTokens + buffer <= maxTokens;
  }

  /**
   * Truncate text to fit within token limit
   */
  static truncateToTokenLimit(
    text: string,
    maxTokens: number,
    modelName?: string,
    preserveEnd: boolean = false
  ): string {
    const estimatedTokens = this.estimateTokens(text, modelName);
    
    if (estimatedTokens <= maxTokens) {
      return text;
    }
    
    const charsPerToken = this.MODEL_CHAR_PER_TOKEN[modelName || 'default'] || 4;
    const targetLength = Math.floor(maxTokens * charsPerToken * 0.9); // 90% to be safe
    
    if (preserveEnd) {
      // Keep the end of the text
      const truncated = '... ' + text.slice(-targetLength);
      return truncated;
    } else {
      // Keep the beginning of the text
      const truncated = text.slice(0, targetLength) + '...';
      return truncated;
    }
  }

  /**
   * Split text into chunks that fit within token limit
   */
  static splitIntoChunks(
    text: string,
    maxTokensPerChunk: number,
    modelName?: string,
    overlap: number = 50
  ): string[] {
    const chunks: string[] = [];
    const charsPerToken = this.MODEL_CHAR_PER_TOKEN[modelName || 'default'] || 4;
    const chunkSize = Math.floor(maxTokensPerChunk * charsPerToken * 0.9);
    const overlapSize = overlap * charsPerToken;
    
    let position = 0;
    while (position < text.length) {
      const chunk = text.slice(position, position + chunkSize);
      chunks.push(chunk);
      
      // Move position with overlap
      position += chunkSize - overlapSize;
      
      // Ensure we don't create tiny final chunks
      if (text.length - position < overlapSize) {
        break;
      }
    }
    
    return chunks;
  }

  /**
   * Calculate cost estimate for token usage
   */
  static calculateCost(
    tokens: number,
    modelName: string,
    costPerMillionTokens: number = 0.25 // Default cost
  ): number {
    // Model-specific pricing (example values)
    const modelPricing: Record<string, number> = {
      '@cf/meta/llama-3.1-8b-instruct': 0.10,
      '@cf/meta/llama-3.1-70b-instruct': 0.50,
      '@cf/mistral/mistral-7b-instruct-v0.2': 0.15,
      'default': costPerMillionTokens
    };
    
    const cost = modelPricing[modelName] || costPerMillionTokens;
    return (tokens / 1_000_000) * cost;
  }

  /**
   * Format token usage for display
   */
  static formatTokenUsage(used: number, limit: number): string {
    const percentage = (used / limit * 100).toFixed(1);
    const remaining = limit - used;
    
    if (remaining <= 0) {
      return `Token limit exceeded (${used.toLocaleString()} / ${limit.toLocaleString()})`;
    }
    
    if (percentage > 80) {
      return `⚠️ ${percentage}% tokens used (${remaining.toLocaleString()} remaining)`;
    }
    
    return `${percentage}% tokens used (${remaining.toLocaleString()} remaining)`;
  }

  /**
   * Optimize prompt by removing unnecessary whitespace and formatting
   */
  static optimizePrompt(text: string): string {
    return text
      .replace(/\s+/g, ' ') // Replace multiple spaces with single space
      .replace(/\n{3,}/g, '\n\n') // Replace multiple newlines with double newline
      .replace(/^\s+|\s+$/g, '') // Trim start and end
      .replace(/\s+([.,!?;:])/g, '$1') // Remove space before punctuation
      .replace(/([.,!?;:])\s*\n/g, '$1\n'); // Preserve newlines after punctuation
  }
}