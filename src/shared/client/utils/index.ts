/**
 * @fileoverview Barrel export for shared client utilities
 * @module shared/client/utils
 */

export { withRetry, NetworkError, RateLimitError } from './retry';
export type { RetryConfig } from './retry';
