/**
 * StorageFallback Service - KV fallback for D1 database operations
 * Implements read-through cache and circuit breaker patterns
 * Story 1.1 Requirement: Fallback to KV storage for learner data if D1 fails
 */

import type { KVNamespace, D1Database } from '@cloudflare/workers-types';
import type { LearnerProfile } from './database';

export interface StorageMetrics {
  fallbackActivations: number;
  d1Failures: number;
  kvHits: number;
  kvMisses: number;
  lastFailure?: string;
  circuitState: 'closed' | 'open' | 'half-open';
}

export class StorageFallbackService {
  private kvNamespace: KVNamespace;
  private db: D1Database;

  // Circuit breaker configuration
  private failureThreshold = 5;
  private resetTimeout = 60000; // 60 seconds
  private halfOpenRequests = 3;

  // Circuit breaker state
  private failures = 0;
  private lastFailureTime = 0;
  private circuitState: 'closed' | 'open' | 'half-open' = 'closed';
  private halfOpenAttempts = 0;

  // Metrics
  private metrics: StorageMetrics = {
    fallbackActivations: 0,
    d1Failures: 0,
    kvHits: 0,
    kvMisses: 0,
    circuitState: 'closed',
  };

  constructor(kvNamespace: KVNamespace, db: D1Database) {
    this.kvNamespace = kvNamespace;
    this.db = db;
  }

  /**
   * Get learner profile with fallback to KV
   */
  async getLearnerProfile(tenantId: string, ltiUserId: string): Promise<LearnerProfile | null> {
    const kvKey = this.getKVKey('learner', tenantId, ltiUserId);

    // Check circuit breaker state
    if (this.isCircuitOpen()) {
      return this.getFromKV(kvKey);
    }

    try {
      // Try D1 first
      const profile = await this.getFromD1WithTimeout(tenantId, ltiUserId);

      if (profile) {
        // Update KV cache with fresh data
        await this.saveToKV(kvKey, profile);
        this.onD1Success();
      }

      return profile;
    } catch (error) {
      this.onD1Failure(error);

      // Fallback to KV
      console.warn('D1 failed, falling back to KV:', error);
      return this.getFromKV(kvKey);
    }
  }

  /**
   * Save learner profile to both D1 and KV
   */
  async saveLearnerProfile(profile: LearnerProfile): Promise<void> {
    const kvKey = this.getKVKey('learner', profile.tenant_id, profile.lti_user_id);

    // Always save to KV for fallback
    await this.saveToKV(kvKey, profile);

    // Try to save to D1 if circuit is not open
    if (!this.isCircuitOpen()) {
      try {
        await this.saveToD1WithTimeout(profile);
        this.onD1Success();
      } catch (error) {
        this.onD1Failure(error);
        // KV save already succeeded, so operation is successful
      }
    }
  }

  /**
   * Get from D1 with timeout
   */
  private async getFromD1WithTimeout(
    tenantId: string,
    ltiUserId: string,
    timeout = 100 // Reasonable timeout for D1 operations with proper indexing
  ): Promise<LearnerProfile | null> {
    const timeoutPromise = new Promise<never>((_, reject) => {
      setTimeout(() => reject(new Error('D1 timeout')), timeout);
    });

    const queryPromise = this.db
      .prepare(
        `
      SELECT * FROM learner_profiles
      WHERE tenant_id = ? AND lti_user_id = ?
    `
      )
      .bind(tenantId, ltiUserId)
      .first<any>();

    const result = await Promise.race([queryPromise, timeoutPromise]);

    if (result) {
      return this.parseD1Profile(result);
    }

    return null;
  }

  /**
   * Save to D1 with timeout
   */
  private async saveToD1WithTimeout(profile: LearnerProfile, timeout = 100): Promise<void> {
    const timeoutPromise = new Promise<never>((_, reject) => {
      setTimeout(() => reject(new Error('D1 timeout')), timeout);
    });

    const queryPromise = this.db
      .prepare(
        `
      INSERT OR REPLACE INTO learner_profiles (
        id, tenant_id, lti_user_id, lti_deployment_id,
        email, name, forgetting_curve_s, learning_velocity,
        optimal_difficulty, preferred_modality,
        data_sharing_consent, ai_interaction_consent, anonymous_analytics,
        created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
    `
      )
      .bind(
        profile.id,
        profile.tenant_id,
        profile.lti_user_id,
        profile.lti_deployment_id,
        profile.email,
        profile.name,
        profile.cognitive_profile.forgetting_curve_s,
        profile.cognitive_profile.learning_velocity,
        profile.cognitive_profile.optimal_difficulty,
        profile.cognitive_profile.preferred_modality,
        profile.privacy_settings.data_sharing_consent,
        profile.privacy_settings.ai_interaction_consent,
        profile.privacy_settings.anonymous_analytics,
        profile.created_at
      )
      .run();

    await Promise.race([queryPromise, timeoutPromise]);
  }

  /**
   * Get from KV storage
   */
  private async getFromKV(key: string): Promise<LearnerProfile | null> {
    try {
      const data = await this.kvNamespace.get(key, 'json');

      if (data) {
        this.metrics.kvHits++;
        this.metrics.fallbackActivations++;
        return data as LearnerProfile;
      }

      this.metrics.kvMisses++;
      return null;
    } catch (error) {
      console.error('KV read failed:', error);
      return null;
    }
  }

  /**
   * Save to KV storage
   */
  private async saveToKV(key: string, data: LearnerProfile): Promise<void> {
    try {
      await this.kvNamespace.put(key, JSON.stringify(data), {
        expirationTtl: 86400, // 24 hour TTL
      });
    } catch (error) {
      console.error('KV write failed:', error);
    }
  }

  /**
   * Generate KV key for data
   */
  private getKVKey(type: string, tenantId: string, userId: string): string {
    return `fallback:${type}:${tenantId}:${userId}`;
  }

  /**
   * Parse D1 profile result
   */
  private parseD1Profile(row: any): LearnerProfile {
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
   * Circuit breaker: Check if circuit is open
   */
  private isCircuitOpen(): boolean {
    const now = Date.now();

    if (this.circuitState === 'open') {
      // Check if enough time has passed to try half-open
      if (now - this.lastFailureTime > this.resetTimeout) {
        this.circuitState = 'half-open';
        this.halfOpenAttempts = 0;
        this.metrics.circuitState = 'half-open';
      } else {
        return true;
      }
    }

    if (this.circuitState === 'half-open') {
      // Allow limited requests in half-open state
      return this.halfOpenAttempts >= this.halfOpenRequests;
    }

    return false;
  }

  /**
   * Circuit breaker: Handle D1 success
   */
  private onD1Success(): void {
    if (this.circuitState === 'half-open') {
      this.halfOpenAttempts++;

      // If enough successful requests, close the circuit
      if (this.halfOpenAttempts >= this.halfOpenRequests) {
        this.circuitState = 'closed';
        this.failures = 0;
        this.metrics.circuitState = 'closed';
        console.log('Circuit breaker closed - D1 recovered');
      }
    } else if (this.circuitState === 'closed') {
      // Reset failure count on success
      this.failures = 0;
    }
  }

  /**
   * Circuit breaker: Handle D1 failure
   */
  private onD1Failure(error: unknown): void {
    this.failures++;
    this.lastFailureTime = Date.now();
    this.metrics.d1Failures++;
    this.metrics.lastFailure = new Date().toISOString();

    if (this.circuitState === 'half-open') {
      // Any failure in half-open state reopens the circuit
      this.circuitState = 'open';
      this.metrics.circuitState = 'open';
      console.log('Circuit breaker reopened - D1 still failing');
    } else if (this.failures >= this.failureThreshold) {
      // Too many failures, open the circuit
      this.circuitState = 'open';
      this.metrics.circuitState = 'open';
      console.log('Circuit breaker opened - too many D1 failures');
    }

    // Log to metrics table (would be implemented in production)
    this.logFallbackUsage(error);
  }

  /**
   * Log fallback usage to metrics
   */
  private async logFallbackUsage(error: unknown): Promise<void> {
    // In production, this would write to a metrics table or external service
    console.log('Fallback activated:', {
      timestamp: new Date().toISOString(),
      error: error instanceof Error ? error.message : 'Unknown error',
      circuitState: this.circuitState,
      failures: this.failures,
    });
  }

  /**
   * Get current metrics
   */
  getMetrics(): StorageMetrics {
    return { ...this.metrics };
  }

  /**
   * Reset circuit breaker (for testing)
   */
  resetCircuit(): void {
    this.circuitState = 'closed';
    this.failures = 0;
    this.halfOpenAttempts = 0;
    this.metrics.circuitState = 'closed';
  }

  /**
   * Set circuit state for testing
   */
  setCircuitStateForTesting(state: 'closed' | 'open' | 'half-open', failures = 0, lastFailureTimestamp?: number): void {
    this.circuitState = state;
    this.failures = failures;
    this.metrics.circuitState = state;
    this.metrics.d1Failures = failures;

    if (lastFailureTimestamp !== undefined) {
      this.lastFailureTime = lastFailureTimestamp;
      this.metrics.lastFailure = new Date(lastFailureTimestamp).toISOString();
    }
  }
}
