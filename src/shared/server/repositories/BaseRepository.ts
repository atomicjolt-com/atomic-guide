/**
 * @fileoverview Base repository providing common CRUD operations and database access patterns.
 * @module shared/server/repositories/BaseRepository
 */

import { DatabaseService } from '../services/database';
import { z } from 'zod';

/**
 * Base repository interface defining common operations for all repositories.
 * 
 * @template TEntity - The entity type this repository manages
 * @template TEntityId - The ID type for the entity (defaults to string)
 */
export interface IRepository<TEntity, TEntityId = string> {
  create(entity: Omit<TEntity, 'id'>): Promise<TEntity>;
  findById(id: TEntityId): Promise<TEntity | null>;
  update(id: TEntityId, updates: Partial<TEntity>): Promise<TEntity>;
  delete(id: TEntityId): Promise<void>;
}

/**
 * Abstract base repository providing common CRUD operations and database access patterns.
 * 
 * All feature repositories MUST extend this class and follow the established patterns.
 * This ensures consistent data validation, error handling, and database access patterns
 * across all features in the application.
 * 
 * @template TEntity - The entity type this repository manages
 * @template TEntityId - The ID type for the entity (defaults to string)
 * 
 * @example
 * ```typescript
 * export class UserRepository extends BaseRepository<User> {
 *   constructor(databaseService: DatabaseService) {
 *     super(databaseService, 'users', userSchema);
 *   }
 *
 *   protected async performCreate(user: User): Promise<User> {
 *     // Implement user-specific creation logic
 *   }
 *
 *   protected async performUpdate(id: string, updates: Partial<User>): Promise<User> {
 *     // Implement user-specific update logic
 *   }
 * }
 * ```
 */
export abstract class BaseRepository<TEntity, TEntityId = string> 
  implements IRepository<TEntity, TEntityId> {
  
  protected readonly tableName: string;
  protected readonly entitySchema: z.ZodSchema<TEntity>;
  
  /**
   * Creates a new base repository instance.
   * 
   * @param databaseService - Database service for connection management
   * @param tableName - Name of the database table this repository manages
   * @param entitySchema - Zod schema for validating entity data
   */
  constructor(
    protected readonly databaseService: DatabaseService,
    tableName: string,
    entitySchema: z.ZodSchema<TEntity>
  ) {
    this.tableName = tableName;
    this.entitySchema = entitySchema;
  }

  /**
   * Get database connection - centralized access point.
   * 
   * All repository database access MUST go through this method to maintain
   * consistent connection management and potential future enhancements.
   * 
   * @returns D1Database instance
   */
  protected getDb(): D1Database {
    return this.databaseService.getDb();
  }

  /**
   * Validate entity data before database operations.
   * 
   * Uses the repository's schema to ensure data integrity and type safety.
   * All data entering the database MUST be validated through this method.
   * 
   * @param data - Raw data to validate
   * @returns Validated entity matching the schema
   * @throws {z.ZodError} If validation fails
   */
  protected validateEntity(data: unknown): TEntity {
    return this.entitySchema.parse(data);
  }

  /**
   * Generate a new unique identifier for entities.
   * 
   * Override this method if your entity uses a different ID generation strategy.
   * 
   * @returns A new unique identifier
   */
  protected generateId(): string {
    return crypto.randomUUID();
  }

  /**
   * Create a new entity in the database.
   * 
   * Validates the entity data and delegates to the concrete implementation
   * for database-specific creation logic.
   * 
   * @param entity - Entity data without ID
   * @returns Promise resolving to the created entity with ID
   * @throws {z.ZodError} If entity validation fails
   */
  async create(entity: Omit<TEntity, 'id'>): Promise<TEntity> {
    const id = this.generateId();
    const validated = this.validateEntity({ ...entity, id } as TEntity);
    
    return await this.performCreate(validated);
  }

  /**
   * Find an entity by its ID.
   * 
   * @param id - The entity ID to search for
   * @returns Promise resolving to the entity or null if not found
   */
  async findById(id: TEntityId): Promise<TEntity | null> {
    const result = await this.getDb()
      .prepare(`SELECT * FROM ${this.tableName} WHERE id = ?`)
      .bind(id)
      .first();

    if (!result) return null;
    
    try {
      return this.validateEntity(result);
    } catch (error) {
      console.error(`Data validation failed for ${this.tableName} with ID ${id}:`, error);
      throw new Error(`Invalid data format in database for ${this.tableName} ID: ${id}`);
    }
  }

  /**
   * Update an existing entity.
   * 
   * @param id - The entity ID to update
   * @param updates - Partial entity data for updates
   * @returns Promise resolving to the updated entity
   * @throws {Error} If entity not found
   */
  async update(id: TEntityId, updates: Partial<TEntity>): Promise<TEntity> {
    // Verify entity exists
    const existing = await this.findById(id);
    if (!existing) {
      throw new Error(`${this.tableName} with ID ${id} not found`);
    }

    return await this.performUpdate(id, updates);
  }

  /**
   * Delete an entity by ID.
   * 
   * @param id - The entity ID to delete
   * @returns Promise resolving when deletion is complete
   */
  async delete(id: TEntityId): Promise<void> {
    const result = await this.getDb()
      .prepare(`DELETE FROM ${this.tableName} WHERE id = ?`)
      .bind(id)
      .run();

    if (result.changes === 0) {
      throw new Error(`${this.tableName} with ID ${id} not found`);
    }
  }

  /**
   * Check if an entity exists by ID.
   * 
   * @param id - The entity ID to check
   * @returns Promise resolving to true if entity exists, false otherwise
   */
  async exists(id: TEntityId): Promise<boolean> {
    const result = await this.getDb()
      .prepare(`SELECT 1 FROM ${this.tableName} WHERE id = ? LIMIT 1`)
      .bind(id)
      .first();

    return result !== null;
  }

  /**
   * Count total entities in the table.
   * 
   * @returns Promise resolving to the total count
   */
  async count(): Promise<number> {
    const result = await this.getDb()
      .prepare(`SELECT COUNT(*) as count FROM ${this.tableName}`)
      .first() as { count: number } | null;

    return result?.count ?? 0;
  }

  /**
   * Find entities with pagination support.
   * 
   * @param limit - Maximum number of entities to return
   * @param offset - Number of entities to skip
   * @returns Promise resolving to array of entities
   */
  async findMany(limit: number = 50, offset: number = 0): Promise<TEntity[]> {
    if (limit <= 0 || limit > 1000) {
      throw new Error('Limit must be between 1 and 1000');
    }

    if (offset < 0) {
      throw new Error('Offset must be non-negative');
    }

    const results = await this.getDb()
      .prepare(`SELECT * FROM ${this.tableName} ORDER BY id LIMIT ? OFFSET ?`)
      .bind(limit, offset)
      .all();

    return results.results.map(result => this.validateEntity(result));
  }

  /**
   * Execute a transaction with multiple operations.
   * 
   * @param operations - Array of operations to execute in transaction
   * @returns Promise resolving to array of results
   */
  protected async executeTransaction<T>(
    operations: Array<() => Promise<T>>
  ): Promise<T[]> {
    const results: T[] = [];
    
    // Note: D1 doesn't support explicit transactions yet
    // This is a placeholder for when transaction support is added
    for (const operation of operations) {
      results.push(await operation());
    }
    
    return results;
  }

  // Abstract methods that concrete repositories must implement

  /**
   * Perform the actual entity creation in the database.
   * 
   * Concrete repositories must implement this method with their specific
   * SQL INSERT logic and field mappings.
   * 
   * @param entity - Validated entity to create
   * @returns Promise resolving to the created entity
   */
  protected abstract performCreate(entity: TEntity): Promise<TEntity>;

  /**
   * Perform the actual entity update in the database.
   * 
   * Concrete repositories must implement this method with their specific
   * SQL UPDATE logic and field mappings.
   * 
   * @param id - Entity ID to update
   * @param updates - Partial entity data for updates
   * @returns Promise resolving to the updated entity
   */
  protected abstract performUpdate(id: TEntityId, updates: Partial<TEntity>): Promise<TEntity>;
}

/**
 * Repository error types for consistent error handling.
 */
export class RepositoryError extends Error {
  constructor(
    message: string,
    public readonly operation: string,
    public readonly tableName: string,
    public readonly entityId?: string | number
  ) {
    super(message);
    this.name = 'RepositoryError';
  }
}

export class EntityNotFoundError extends RepositoryError {
  constructor(tableName: string, entityId: string | number) {
    super(`${tableName} with ID ${entityId} not found`, 'find', tableName, entityId);
    this.name = 'EntityNotFoundError';
  }
}

export class ValidationError extends RepositoryError {
  constructor(tableName: string, validationErrors: string, entityId?: string | number) {
    super(`Validation failed for ${tableName}: ${validationErrors}`, 'validate', tableName, entityId);
    this.name = 'ValidationError';
  }
}

export class DuplicateEntityError extends RepositoryError {
  constructor(tableName: string, field: string, value: string) {
    super(`${tableName} with ${field} '${value}' already exists`, 'create', tableName);
    this.name = 'DuplicateEntityError';
  }
}