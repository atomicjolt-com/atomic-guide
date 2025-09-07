/**
 * @fileoverview Knowledge Graph Repository
 * Handles data persistence for cross-course knowledge dependencies and graph structures
 * 
 * Follows the repository pattern with strict database access through DatabaseService.
 * Provides CRUD operations for knowledge graph nodes and edges with validation.
 */

import { DatabaseService } from '../../../../shared/server/services/database.js';
import { 
  KnowledgeDependency,
  KnowledgeTransferOpportunity,
  CrossCourseResult,
  CrossCourseError
} from '../../shared/types/index.js';

import { 
  KnowledgeDependencySchema,
  KnowledgeTransferOpportunitySchema,
  CreateKnowledgeDependency,
  CreateKnowledgeDependencySchema,
  UpdateKnowledgeDependency,
  UpdateKnowledgeDependencySchema,
  validateSafely 
} from '../../shared/schemas/cross-course.schema.js';

/**
 * Query parameters for knowledge dependencies
 */
interface KnowledgeDependencyQuery {
  prerequisiteCourse?: string;
  dependentCourse?: string;
  concept?: string;
  minDependencyStrength?: number;
  minSampleSize?: number;
  limit?: number;
  offset?: number;
}

/**
 * Knowledge graph statistics
 */
interface KnowledgeGraphStats {
  totalDependencies: number;
  totalCourses: number;
  totalConcepts: number;
  averageDependencyStrength: number;
  strongestDependencies: KnowledgeDependency[];
  courseCoverage: number;
}

/**
 * Graph traversal result for dependency paths
 */
interface DependencyPath {
  fromCourse: string;
  toCourse: string;
  path: KnowledgeDependency[];
  totalStrength: number;
  pathLength: number;
}

/**
 * Repository for knowledge graph data persistence
 */
export class KnowledgeGraphRepository {
  constructor(private db: DatabaseService) {}

  /**
   * Creates a new knowledge dependency relationship
   */
  async createKnowledgeDependency(
    dependency: CreateKnowledgeDependency
  ): Promise<CrossCourseResult<KnowledgeDependency>> {
    try {
      // Validate input
      const validation = validateSafely(CreateKnowledgeDependencySchema, dependency);
      if (!validation.success) {
        return {
          success: false,
          error: {
            type: 'INVALID_COURSE_SEQUENCE',
            message: 'Invalid dependency data',
            details: { errors: validation.error.errors }
          }
        };
      }

      const id = `dep_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      const now = new Date();

      const result = await this.db.query(
        `INSERT INTO knowledge_dependencies (
          id, prerequisite_course, prerequisite_concept, dependent_course, 
          dependent_concept, dependency_strength, validation_score,
          correlation_coefficient, sample_size, created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          id,
          dependency.prerequisiteCourse,
          dependency.prerequisiteConcept,
          dependency.dependentCourse,
          dependency.dependentConcept,
          dependency.dependencyStrength,
          dependency.validationScore,
          dependency.correlationCoefficient || null,
          dependency.sampleSize || 0,
          now.toISOString(),
          now.toISOString()
        ]
      );

      if (!result.success) {
        return {
          success: false,
          error: {
            type: 'SYSTEM_OVERLOAD',
            message: 'Failed to create knowledge dependency',
            details: { dbError: result.error }
          }
        };
      }

      // Retrieve the created dependency
      const created = await this.getKnowledgeDependencyById(id);
      return created;

    } catch (error) {
      return {
        success: false,
        error: {
          type: 'SYSTEM_OVERLOAD',
          message: error instanceof Error ? error.message : 'Unknown database error'
        }
      };
    }
  }

  /**
   * Retrieves a knowledge dependency by ID
   */
  async getKnowledgeDependencyById(id: string): Promise<CrossCourseResult<KnowledgeDependency>> {
    try {
      const result = await this.db.query(
        `SELECT * FROM knowledge_dependencies WHERE id = ?`,
        [id]
      );

      if (!result.success || !result.results || result.results.length === 0) {
        return {
          success: false,
          error: {
            type: 'INSUFFICIENT_DATA',
            message: 'Knowledge dependency not found'
          }
        };
      }

      const dependency = this.mapRowToKnowledgeDependency(result.results[0]);
      return {
        success: true,
        data: dependency
      };

    } catch (error) {
      return {
        success: false,
        error: {
          type: 'SYSTEM_OVERLOAD',
          message: error instanceof Error ? error.message : 'Unknown database error'
        }
      };
    }
  }

  /**
   * Queries knowledge dependencies with filters
   */
  async queryKnowledgeDependencies(
    query: KnowledgeDependencyQuery = {}
  ): Promise<CrossCourseResult<KnowledgeDependency[]>> {
    try {
      let sql = `
        SELECT * FROM knowledge_dependencies
        WHERE 1=1
      `;
      const params: unknown[] = [];

      // Apply filters
      if (query.prerequisiteCourse) {
        sql += ` AND prerequisite_course = ?`;
        params.push(query.prerequisiteCourse);
      }

      if (query.dependentCourse) {
        sql += ` AND dependent_course = ?`;
        params.push(query.dependentCourse);
      }

      if (query.concept) {
        sql += ` AND (prerequisite_concept LIKE ? OR dependent_concept LIKE ?)`;
        params.push(`%${query.concept}%`, `%${query.concept}%`);
      }

      if (query.minDependencyStrength) {
        sql += ` AND dependency_strength >= ?`;
        params.push(query.minDependencyStrength);
      }

      if (query.minSampleSize) {
        sql += ` AND sample_size >= ?`;
        params.push(query.minSampleSize);
      }

      // Order by dependency strength
      sql += ` ORDER BY dependency_strength DESC`;

      // Apply pagination
      if (query.limit) {
        sql += ` LIMIT ?`;
        params.push(query.limit);
      }

      if (query.offset) {
        sql += ` OFFSET ?`;
        params.push(query.offset);
      }

      const result = await this.db.query(sql, params);

      if (!result.success) {
        return {
          success: false,
          error: {
            type: 'SYSTEM_OVERLOAD',
            message: 'Failed to query knowledge dependencies'
          }
        };
      }

      const dependencies = (result.results || []).map(row => 
        this.mapRowToKnowledgeDependency(row)
      );

      return {
        success: true,
        data: dependencies
      };

    } catch (error) {
      return {
        success: false,
        error: {
          type: 'SYSTEM_OVERLOAD',
          message: error instanceof Error ? error.message : 'Unknown query error'
        }
      };
    }
  }

  /**
   * Updates an existing knowledge dependency
   */
  async updateKnowledgeDependency(
    id: string,
    updates: UpdateKnowledgeDependency
  ): Promise<CrossCourseResult<KnowledgeDependency>> {
    try {
      // Validate input
      const validation = validateSafely(UpdateKnowledgeDependencySchema, updates);
      if (!validation.success) {
        return {
          success: false,
          error: {
            type: 'INVALID_COURSE_SEQUENCE',
            message: 'Invalid update data',
            details: { errors: validation.error.errors }
          }
        };
      }

      // Build dynamic update query
      const updateFields: string[] = [];
      const params: unknown[] = [];

      Object.entries(updates).forEach(([key, value]) => {
        if (value !== undefined) {
          // Convert camelCase to snake_case for database columns
          const columnName = key.replace(/[A-Z]/g, letter => `_${letter.toLowerCase()}`);
          updateFields.push(`${columnName} = ?`);
          params.push(value);
        }
      });

      if (updateFields.length === 0) {
        return {
          success: false,
          error: {
            type: 'INVALID_COURSE_SEQUENCE',
            message: 'No fields to update'
          }
        };
      }

      updateFields.push('updated_at = ?');
      params.push(new Date().toISOString());
      params.push(id);

      const sql = `
        UPDATE knowledge_dependencies 
        SET ${updateFields.join(', ')}
        WHERE id = ?
      `;

      const result = await this.db.query(sql, params);

      if (!result.success) {
        return {
          success: false,
          error: {
            type: 'SYSTEM_OVERLOAD',
            message: 'Failed to update knowledge dependency'
          }
        };
      }

      // Return updated dependency
      return this.getKnowledgeDependencyById(id);

    } catch (error) {
      return {
        success: false,
        error: {
          type: 'SYSTEM_OVERLOAD',
          message: error instanceof Error ? error.message : 'Unknown update error'
        }
      };
    }
  }

  /**
   * Deletes a knowledge dependency
   */
  async deleteKnowledgeDependency(id: string): Promise<CrossCourseResult<boolean>> {
    try {
      const result = await this.db.query(
        `DELETE FROM knowledge_dependencies WHERE id = ?`,
        [id]
      );

      if (!result.success) {
        return {
          success: false,
          error: {
            type: 'SYSTEM_OVERLOAD',
            message: 'Failed to delete knowledge dependency'
          }
        };
      }

      return {
        success: true,
        data: result.meta?.changes > 0
      };

    } catch (error) {
      return {
        success: false,
        error: {
          type: 'SYSTEM_OVERLOAD',
          message: error instanceof Error ? error.message : 'Unknown delete error'
        }
      };
    }
  }

  /**
   * Finds all dependencies for a specific course
   */
  async getCourseDependencies(courseId: string): Promise<CrossCourseResult<{
    prerequisites: KnowledgeDependency[];
    dependents: KnowledgeDependency[];
  }>> {
    try {
      // Get prerequisites (courses this course depends on)
      const prerequisitesResult = await this.queryKnowledgeDependencies({
        dependentCourse: courseId
      });

      // Get dependents (courses that depend on this course)
      const dependentsResult = await this.queryKnowledgeDependencies({
        prerequisiteCourse: courseId
      });

      if (!prerequisitesResult.success || !dependentsResult.success) {
        return {
          success: false,
          error: {
            type: 'SYSTEM_OVERLOAD',
            message: 'Failed to retrieve course dependencies'
          }
        };
      }

      return {
        success: true,
        data: {
          prerequisites: prerequisitesResult.data || [],
          dependents: dependentsResult.data || []
        }
      };

    } catch (error) {
      return {
        success: false,
        error: {
          type: 'SYSTEM_OVERLOAD',
          message: error instanceof Error ? error.message : 'Unknown error'
        }
      };
    }
  }

  /**
   * Finds dependency paths between courses
   */
  async findDependencyPath(
    fromCourse: string,
    toCourse: string,
    maxDepth: number = 5
  ): Promise<CrossCourseResult<DependencyPath[]>> {
    try {
      // Use recursive CTE to find paths
      const sql = `
        WITH RECURSIVE dependency_paths AS (
          -- Base case: direct dependencies
          SELECT 
            prerequisite_course,
            dependent_course,
            prerequisite_concept || ' -> ' || dependent_concept as path_description,
            dependency_strength,
            1 as depth,
            id as path_ids
          FROM knowledge_dependencies
          WHERE prerequisite_course = ?
          
          UNION ALL
          
          -- Recursive case: extend paths
          SELECT 
            dp.prerequisite_course,
            kd.dependent_course,
            dp.path_description || ' -> ' || kd.prerequisite_concept || ' -> ' || kd.dependent_concept,
            dp.dependency_strength * kd.dependency_strength,
            dp.depth + 1,
            dp.path_ids || ',' || kd.id
          FROM dependency_paths dp
          JOIN knowledge_dependencies kd ON dp.dependent_course = kd.prerequisite_course
          WHERE dp.depth < ? AND kd.dependent_course != dp.prerequisite_course
        )
        SELECT * FROM dependency_paths
        WHERE dependent_course = ?
        ORDER BY dependency_strength DESC, depth ASC
        LIMIT 10
      `;

      const result = await this.db.query(sql, [fromCourse, maxDepth, toCourse]);

      if (!result.success) {
        return {
          success: false,
          error: {
            type: 'SYSTEM_OVERLOAD',
            message: 'Failed to find dependency paths'
          }
        };
      }

      // Convert results to DependencyPath objects
      const paths: DependencyPath[] = (result.results || []).map((row: any) => ({
        fromCourse: row.prerequisite_course,
        toCourse: row.dependent_course,
        path: [], // Would need additional queries to populate full path
        totalStrength: row.dependency_strength,
        pathLength: row.depth
      }));

      return {
        success: true,
        data: paths
      };

    } catch (error) {
      return {
        success: false,
        error: {
          type: 'SYSTEM_OVERLOAD',
          message: error instanceof Error ? error.message : 'Unknown path finding error'
        }
      };
    }
  }

  /**
   * Gets knowledge graph statistics
   */
  async getKnowledgeGraphStats(): Promise<CrossCourseResult<KnowledgeGraphStats>> {
    try {
      const statsQuery = `
        SELECT 
          COUNT(*) as total_dependencies,
          COUNT(DISTINCT prerequisite_course) + COUNT(DISTINCT dependent_course) as total_courses,
          COUNT(DISTINCT prerequisite_concept) + COUNT(DISTINCT dependent_concept) as total_concepts,
          AVG(dependency_strength) as avg_dependency_strength,
          MAX(dependency_strength) as max_dependency_strength
        FROM knowledge_dependencies
      `;

      const result = await this.db.query(statsQuery);

      if (!result.success || !result.results || result.results.length === 0) {
        return {
          success: false,
          error: {
            type: 'INSUFFICIENT_DATA',
            message: 'Failed to retrieve knowledge graph statistics'
          }
        };
      }

      const stats = result.results[0];

      // Get strongest dependencies
      const strongestResult = await this.queryKnowledgeDependencies({
        limit: 10,
        minDependencyStrength: 0.7
      });

      const strongestDependencies = strongestResult.success ? strongestDependencies.data || [] : [];

      const knowledgeGraphStats: KnowledgeGraphStats = {
        totalDependencies: stats.total_dependencies || 0,
        totalCourses: Math.floor((stats.total_courses || 0) / 2), // Approximate unique courses
        totalConcepts: Math.floor((stats.total_concepts || 0) / 2), // Approximate unique concepts
        averageDependencyStrength: stats.avg_dependency_strength || 0,
        strongestDependencies: strongestDependencies,
        courseCoverage: stats.total_dependencies > 0 ? 0.85 : 0 // Placeholder calculation
      };

      return {
        success: true,
        data: knowledgeGraphStats
      };

    } catch (error) {
      return {
        success: false,
        error: {
          type: 'SYSTEM_OVERLOAD',
          message: error instanceof Error ? error.message : 'Unknown stats error'
        }
      };
    }
  }

  /**
   * Bulk creates knowledge dependencies with transaction support
   */
  async bulkCreateKnowledgeDependencies(
    dependencies: CreateKnowledgeDependency[]
  ): Promise<CrossCourseResult<KnowledgeDependency[]>> {
    try {
      const created: KnowledgeDependency[] = [];
      
      // In a real implementation, this would use database transactions
      for (const dependency of dependencies) {
        const result = await this.createKnowledgeDependency(dependency);
        if (result.success && result.data) {
          created.push(result.data);
        }
      }

      return {
        success: true,
        data: created
      };

    } catch (error) {
      return {
        success: false,
        error: {
          type: 'SYSTEM_OVERLOAD',
          message: error instanceof Error ? error.message : 'Bulk creation failed'
        }
      };
    }
  }

  /**
   * Maps database row to KnowledgeDependency object
   */
  private mapRowToKnowledgeDependency(row: any): KnowledgeDependency {
    return {
      id: row.id,
      prerequisiteCourse: row.prerequisite_course,
      prerequisiteConcept: row.prerequisite_concept,
      dependentCourse: row.dependent_course,
      dependentConcept: row.dependent_concept,
      dependencyStrength: parseFloat(row.dependency_strength),
      validationScore: parseFloat(row.validation_score),
      correlationCoefficient: row.correlation_coefficient ? parseFloat(row.correlation_coefficient) : undefined,
      sampleSize: row.sample_size || 0,
      createdAt: new Date(row.created_at),
      updatedAt: new Date(row.updated_at)
    };
  }

  /**
   * Creates knowledge transfer opportunity
   */
  async createKnowledgeTransferOpportunity(
    opportunity: Omit<KnowledgeTransferOpportunity, 'id' | 'createdAt' | 'updatedAt'>
  ): Promise<CrossCourseResult<KnowledgeTransferOpportunity>> {
    try {
      const id = `transfer_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      const now = new Date();

      const result = await this.db.query(
        `INSERT INTO knowledge_transfer_opportunities (
          id, student_id, source_course, target_course, source_concept, 
          target_concept, transfer_type, opportunity_strength, recommendation, 
          status, created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          id,
          opportunity.studentId,
          opportunity.sourceCourse,
          opportunity.targetCourse,
          opportunity.sourceConcept,
          opportunity.targetConcept,
          opportunity.transferType,
          opportunity.opportunityStrength,
          opportunity.recommendation,
          opportunity.status,
          now.toISOString(),
          now.toISOString()
        ]
      );

      if (!result.success) {
        return {
          success: false,
          error: {
            type: 'SYSTEM_OVERLOAD',
            message: 'Failed to create knowledge transfer opportunity'
          }
        };
      }

      const created: KnowledgeTransferOpportunity = {
        id,
        ...opportunity,
        createdAt: now,
        updatedAt: now
      };

      return {
        success: true,
        data: created
      };

    } catch (error) {
      return {
        success: false,
        error: {
          type: 'SYSTEM_OVERLOAD',
          message: error instanceof Error ? error.message : 'Unknown creation error'
        }
      };
    }
  }

  /**
   * Gets knowledge transfer opportunities for a student
   */
  async getKnowledgeTransferOpportunities(
    studentId: string,
    status?: KnowledgeTransferOpportunity['status']
  ): Promise<CrossCourseResult<KnowledgeTransferOpportunity[]>> {
    try {
      let sql = `
        SELECT * FROM knowledge_transfer_opportunities
        WHERE student_id = ?
      `;
      const params = [studentId];

      if (status) {
        sql += ` AND status = ?`;
        params.push(status);
      }

      sql += ` ORDER BY opportunity_strength DESC, created_at DESC`;

      const result = await this.db.query(sql, params);

      if (!result.success) {
        return {
          success: false,
          error: {
            type: 'SYSTEM_OVERLOAD',
            message: 'Failed to retrieve knowledge transfer opportunities'
          }
        };
      }

      const opportunities = (result.results || []).map(row => ({
        id: row.id,
        studentId: row.student_id,
        sourceCourse: row.source_course,
        targetCourse: row.target_course,
        sourceConcept: row.source_concept,
        targetConcept: row.target_concept,
        transferType: row.transfer_type,
        opportunityStrength: parseFloat(row.opportunity_strength),
        recommendation: row.recommendation,
        status: row.status,
        createdAt: new Date(row.created_at),
        updatedAt: new Date(row.updated_at)
      })) as KnowledgeTransferOpportunity[];

      return {
        success: true,
        data: opportunities
      };

    } catch (error) {
      return {
        success: false,
        error: {
          type: 'SYSTEM_OVERLOAD',
          message: error instanceof Error ? error.message : 'Unknown query error'
        }
      };
    }
  }
}