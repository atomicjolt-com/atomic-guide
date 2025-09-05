/**
 * @fileoverview Shared repository exports for consistent database access patterns.
 * @module shared/server/repositories
 */

export {
  BaseRepository,
  IRepository,
  RepositoryError,
  EntityNotFoundError,
  ValidationError,
  DuplicateEntityError,
} from './BaseRepository';

// Export repository interfaces for dependency injection
export type { IRepository as Repository } from './BaseRepository';