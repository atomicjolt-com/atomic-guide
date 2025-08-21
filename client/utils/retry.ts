export interface RetryConfig {
  maxAttempts?: number;
  initialDelay?: number;
  maxDelay?: number;
  backoffMultiplier?: number;
  shouldRetry?: (error: any) => boolean;
}

const defaultConfig: Required<RetryConfig> = {
  maxAttempts: 3,
  initialDelay: 1000,
  maxDelay: 10000,
  backoffMultiplier: 2,
  shouldRetry: (error: any) => {
    if (error?.status === 429) return true;
    if (error?.status >= 500) return true;
    if (error?.message?.includes('network')) return true;
    if (error?.message?.includes('timeout')) return true;
    return false;
  },
};

export async function withRetry<T>(
  fn: () => Promise<T>,
  config?: RetryConfig
): Promise<T> {
  const finalConfig = { ...defaultConfig, ...config };
  let lastError: any;
  let delay = finalConfig.initialDelay;

  for (let attempt = 1; attempt <= finalConfig.maxAttempts; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error;

      if (attempt === finalConfig.maxAttempts || !finalConfig.shouldRetry(error)) {
        throw error;
      }

      if ((error as any)?.retry_after) {
        delay = (error as any).retry_after * 1000;
      }

      await new Promise(resolve => setTimeout(resolve, delay));

      delay = Math.min(delay * finalConfig.backoffMultiplier, finalConfig.maxDelay);
    }
  }

  throw lastError;
}

export class NetworkError extends Error {
  constructor(message: string, public readonly isRetryable: boolean = true) {
    super(message);
    this.name = 'NetworkError';
  }
}

export class RateLimitError extends Error {
  constructor(message: string, public readonly retryAfter: number) {
    super(message);
    this.name = 'RateLimitError';
  }
}