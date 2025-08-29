/**
 * DatabaseService for multi-tenant D1 database operations
 * Implements Story 1.1 requirements for tenant isolation
 */

import type { D1Database, D1PreparedStatement } from '@cloudflare/workers-types';
import { v4 as uuidv4 } from 'uuid';

export interface Tenant {
  id: string;
  iss: string;
  client_id: string;
  deployment_ids: string[];
  institution_name: string;
  lms_type: string;
  lms_url: string;
  settings: Record<string, any>;
  features: Record<string, boolean>;
  created_at: string;
  updated_at: string;
}

export interface LearnerProfile {
  id: string;
  tenant_id: string;
  lti_user_id: string;
  lti_deployment_id: string;
  email?: string;
  name?: string;
  cognitive_profile: {
    forgetting_curve_s: number;
    learning_velocity: number;
    optimal_difficulty: number;
    preferred_modality: string;
  };
  privacy_settings: {
    data_sharing_consent: boolean;
    ai_interaction_consent: boolean;
    anonymous_analytics: boolean;
  };
  created_at: string;
  updated_at: string;
}

export class DatabaseService {
  private db: D1Database;
  private preparedStatements: Map<string, D1PreparedStatement> = new Map();

  constructor(db: D1Database) {
    this.db = db;
    this.initializePreparedStatements();
  }

  /**
   * Initialize prepared statements for performance
   */
  private initializePreparedStatements(): void {
    // Tenant queries
    this.preparedStatements.set('findTenantByIssAndClient', this.db.prepare('SELECT * FROM tenants WHERE iss = ? AND client_id = ?'));

    this.preparedStatements.set('getTenantById', this.db.prepare('SELECT * FROM tenants WHERE id = ?'));

    this.preparedStatements.set(
      'createTenant',
      this.db.prepare(`
        INSERT INTO tenants (id, iss, client_id, deployment_ids, institution_name, lms_type, lms_url, settings, features)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
        RETURNING *
      `)
    );

    // Learner profile queries with tenant isolation
    this.preparedStatements.set(
      'findLearnerProfile',
      this.db.prepare('SELECT * FROM learner_profiles WHERE tenant_id = ? AND lti_user_id = ?')
    );

    this.preparedStatements.set(
      'createLearnerProfile',
      this.db.prepare(`
        INSERT INTO learner_profiles (
          id, tenant_id, lti_user_id, lti_deployment_id, email, name,
          forgetting_curve_s, learning_velocity, optimal_difficulty, preferred_modality,
          data_sharing_consent, ai_interaction_consent, anonymous_analytics
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        RETURNING *
      `)
    );
  }

  /**
   * Create a new tenant
   */
  async createTenant(
    iss: string,
    clientId: string,
    institutionName: string,
    lmsType: string,
    lmsUrl: string,
    deploymentIds: string[] = []
  ): Promise<Tenant> {
    const id = uuidv4();
    const stmt = this.preparedStatements.get('createTenant')!;

    try {
      const result = await stmt
        .bind(
          id,
          iss,
          clientId,
          JSON.stringify(deploymentIds),
          institutionName,
          lmsType,
          lmsUrl,
          JSON.stringify({}),
          JSON.stringify({
            chat: true,
            cognitive_profiling: true,
            struggle_detection: true,
          })
        )
        .first<Tenant>();

      if (!result) {
        throw new Error('Failed to create tenant');
      }

      return this.parseTenant(result);
    } catch (error) {
      // Handle unique constraint violation
      if (error instanceof Error && error.message.includes('UNIQUE')) {
        const existing = await this.findTenantByIssAndClientId(iss, clientId);
        if (existing) {
          return existing;
        }
      }
      throw error;
    }
  }

  /**
   * Find tenant by ISS and Client ID
   */
  async findTenantByIssAndClientId(iss: string, clientId: string): Promise<Tenant | null> {
    const stmt = this.preparedStatements.get('findTenantByIssAndClient')!;
    const result = await stmt.bind(iss, clientId).first<Tenant>();

    return result ? this.parseTenant(result) : null;
  }

  /**
   * Get tenant by ID
   */
  async getTenantById(tenantId: string): Promise<Tenant | null> {
    const stmt = this.preparedStatements.get('getTenantById')!;
    const result = await stmt.bind(tenantId).first<Tenant>();

    return result ? this.parseTenant(result) : null;
  }

  /**
   * Update tenant information
   */
  async updateTenant(
    tenantId: string,
    updates: Partial<Pick<Tenant, 'deployment_ids' | 'institution_name' | 'lms_type' | 'lms_url' | 'settings' | 'features'>>
  ): Promise<void> {
    const setClauses: string[] = [];
    const values: any[] = [];

    if (updates.deployment_ids !== undefined) {
      setClauses.push('deployment_ids = ?');
      values.push(JSON.stringify(updates.deployment_ids));
    }
    if (updates.institution_name !== undefined) {
      setClauses.push('institution_name = ?');
      values.push(updates.institution_name);
    }
    if (updates.lms_type !== undefined) {
      setClauses.push('lms_type = ?');
      values.push(updates.lms_type);
    }
    if (updates.lms_url !== undefined) {
      setClauses.push('lms_url = ?');
      values.push(updates.lms_url);
    }
    if (updates.settings !== undefined) {
      setClauses.push('settings = ?');
      values.push(JSON.stringify(updates.settings));
    }
    if (updates.features !== undefined) {
      setClauses.push('features = ?');
      values.push(JSON.stringify(updates.features));
    }

    if (setClauses.length === 0) {
      return; // Nothing to update
    }

    setClauses.push('updated_at = CURRENT_TIMESTAMP');
    values.push(tenantId);

    const query = `UPDATE tenants SET ${setClauses.join(', ')} WHERE id = ?`;
    await this.db
      .prepare(query)
      .bind(...values)
      .run();
  }

  /**
   * Create or update learner profile with tenant isolation
   */
  async createOrUpdateLearnerProfile(
    tenantId: string,
    ltiUserId: string,
    ltiDeploymentId: string,
    email?: string,
    name?: string
  ): Promise<LearnerProfile> {
    // First check for existing profile
    const existing = await this.findLearnerProfile(tenantId, ltiUserId);

    if (existing) {
      // Update existing profile
      await this.db
        .prepare(
          `
        UPDATE learner_profiles
        SET lti_deployment_id = ?,
            email = COALESCE(?, email),
            name = COALESCE(?, name),
            last_active_at = CURRENT_TIMESTAMP,
            updated_at = CURRENT_TIMESTAMP
        WHERE tenant_id = ? AND lti_user_id = ?
      `
        )
        .bind(ltiDeploymentId, email, name, tenantId, ltiUserId)
        .run();

      const updated = await this.findLearnerProfile(tenantId, ltiUserId);
      if (!updated) {
        throw new Error('Failed to update learner profile');
      }
      return updated;
    }

    // Create new profile
    const id = uuidv4();
    const stmt = this.preparedStatements.get('createLearnerProfile')!;

    const result = await stmt
      .bind(
        id,
        tenantId,
        ltiUserId,
        ltiDeploymentId,
        email || null,
        name || null,
        1.0, // forgetting_curve_s default
        1.0, // learning_velocity default
        0.7, // optimal_difficulty default
        'mixed', // preferred_modality default
        false, // data_sharing_consent default
        true, // ai_interaction_consent default
        true // anonymous_analytics default
      )
      .first<LearnerProfile>();

    if (!result) {
      throw new Error('Failed to create learner profile');
    }

    return this.parseLearnerProfile(result);
  }

  /**
   * Find learner profile with tenant isolation
   */
  async findLearnerProfile(tenantId: string, ltiUserId: string): Promise<LearnerProfile | null> {
    const stmt = this.preparedStatements.get('findLearnerProfile')!;
    const result = await stmt.bind(tenantId, ltiUserId).first<any>();

    return result ? this.parseLearnerProfile(result) : null;
  }

  /**
   * Get all learner profiles for a tenant (with pagination)
   */
  async getLearnerProfilesByTenant(tenantId: string, limit: number = 100, offset: number = 0): Promise<LearnerProfile[]> {
    const results = await this.db
      .prepare(
        `
      SELECT * FROM learner_profiles
      WHERE tenant_id = ?
      ORDER BY created_at DESC
      LIMIT ? OFFSET ?
    `
      )
      .bind(tenantId, limit, offset)
      .all();

    return results.results.map((r) => this.parseLearnerProfile(r));
  }

  /**
   * Update learner cognitive profile
   */
  async updateLearnerCognitiveProfile(
    tenantId: string,
    ltiUserId: string,
    cognitiveProfile: Partial<LearnerProfile['cognitive_profile']>
  ): Promise<void> {
    // Get existing profile
    const existing = await this.findLearnerProfile(tenantId, ltiUserId);
    if (!existing) {
      throw new Error('Learner profile not found');
    }

    // Merge cognitive profile
    const updated = { ...existing.cognitive_profile, ...cognitiveProfile };

    await this.db
      .prepare(
        `
      UPDATE learner_profiles
      SET forgetting_curve_s = ?,
          learning_velocity = ?,
          optimal_difficulty = ?,
          preferred_modality = ?,
          updated_at = CURRENT_TIMESTAMP
      WHERE tenant_id = ? AND lti_user_id = ?
    `
      )
      .bind(
        updated.forgetting_curve_s,
        updated.learning_velocity,
        updated.optimal_difficulty,
        updated.preferred_modality,
        tenantId,
        ltiUserId
      )
      .run();
  }

  /**
   * Update learner privacy settings
   */
  async updateLearnerPrivacySettings(
    tenantId: string,
    ltiUserId: string,
    privacySettings: Partial<LearnerProfile['privacy_settings']>
  ): Promise<void> {
    // Get existing profile
    const existing = await this.findLearnerProfile(tenantId, ltiUserId);
    if (!existing) {
      throw new Error('Learner profile not found');
    }

    // Merge privacy settings
    const updated = { ...existing.privacy_settings, ...privacySettings };

    await this.db
      .prepare(
        `
      UPDATE learner_profiles
      SET data_sharing_consent = ?,
          ai_interaction_consent = ?,
          anonymous_analytics = ?,
          updated_at = CURRENT_TIMESTAMP
      WHERE tenant_id = ? AND lti_user_id = ?
    `
      )
      .bind(updated.data_sharing_consent, updated.ai_interaction_consent, updated.anonymous_analytics, tenantId, ltiUserId)
      .run();
  }

  /**
   * Transaction helper for atomic operations
   */
  async transaction<T>(fn: () => Promise<T>): Promise<T> {
    // D1 doesn't support explicit transactions yet, but batch operations are atomic
    // This is a placeholder for when D1 adds transaction support
    return await fn();
  }

  /**
   * Parse tenant from database row
   */
  private parseTenant(row: any): Tenant {
    return {
      ...row,
      deployment_ids: typeof row.deployment_ids === 'string' ? JSON.parse(row.deployment_ids) : row.deployment_ids,
      settings: typeof row.settings === 'string' ? JSON.parse(row.settings) : row.settings,
      features: typeof row.features === 'string' ? JSON.parse(row.features) : row.features,
    };
  }

  /**
   * Parse learner profile from database row
   */
  private parseLearnerProfile(row: any): LearnerProfile {
    return {
      id: row.id,
      tenant_id: row.tenant_id,
      lti_user_id: row.lti_user_id,
      lti_deployment_id: row.lti_deployment_id,
      email: row.email,
      name: row.name,
      cognitive_profile: {
        forgetting_curve_s: row.forgetting_curve_s,
        learning_velocity: row.learning_velocity,
        optimal_difficulty: row.optimal_difficulty,
        preferred_modality: row.preferred_modality,
      },
      privacy_settings: {
        data_sharing_consent: row.data_sharing_consent,
        ai_interaction_consent: row.ai_interaction_consent,
        anonymous_analytics: row.anonymous_analytics,
      },
      created_at: row.created_at,
      updated_at: row.updated_at,
    };
  }

  /**
   * Health check for database connectivity
   */
  async healthCheck(): Promise<boolean> {
    try {
      const result = await this.db.prepare('SELECT 1 as healthy').first<{ healthy: number }>();
      return result?.healthy === 1;
    } catch (error) {
      console.error('Database health check failed:', error);
      return false;
    }
  }

  /**
   * Get database statistics for monitoring
   */
  async getStats(tenantId?: string): Promise<any> {
    if (tenantId) {
      return await this.db
        .prepare(
          `
        SELECT
          (SELECT COUNT(*) FROM learner_profiles WHERE tenant_id = ?) as learner_count,
          (SELECT COUNT(*) FROM learning_sessions WHERE tenant_id = ?) as session_count,
          (SELECT COUNT(*) FROM chat_conversations WHERE tenant_id = ?) as chat_count
      `
        )
        .bind(tenantId, tenantId, tenantId)
        .first();
    }

    return await this.db
      .prepare(
        `
      SELECT
        (SELECT COUNT(*) FROM tenants) as tenant_count,
        (SELECT COUNT(*) FROM learner_profiles) as total_learners,
        (SELECT COUNT(*) FROM learning_sessions) as total_sessions
    `
      )
      .first();
  }
}
