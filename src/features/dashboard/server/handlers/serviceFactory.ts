/**
 * @fileoverview Service factory for dependency injection in analytics API
 * @module features/dashboard/server/handlers/serviceFactory
 */

import type { D1Database, Queue, Ai } from '@cloudflare/workers-types';
import { PerformanceAnalyticsService } from '../services/PerformanceAnalyticsService';
import { PrivacyPreservingAnalytics } from '../services/PrivacyPreservingAnalytics';
import { AdaptiveLearningService } from '../services/AdaptiveLearningService';

/**
 * Environment interface for analytics API
 */
export interface AnalyticsEnv {
  DB: D1Database;
  ANALYTICS_QUEUE: Queue;
  AI: Ai;
}

/**
 * Container interface for all services used by analytics API
 */
export interface ServiceContainer {
  analytics: PerformanceAnalyticsService;
  privacy: PrivacyPreservingAnalytics;
  adaptive: AdaptiveLearningService;
}

/**
 * Factory function to create service instances
 * 
 * @param env - Environment bindings
 * @param tenantId - Tenant identifier
 * @returns Container with all service instances
 */
export function createServices(env: AnalyticsEnv, tenantId: string): ServiceContainer {
  return {
    analytics: new PerformanceAnalyticsService(env.DB, env.ANALYTICS_QUEUE, tenantId),
    privacy: new PrivacyPreservingAnalytics(env.DB, tenantId),
    adaptive: new AdaptiveLearningService(env.DB, env.AI, tenantId, true)
  };
}

/**
 * Type for the service factory function
 */
export type ServiceFactory = typeof createServices;