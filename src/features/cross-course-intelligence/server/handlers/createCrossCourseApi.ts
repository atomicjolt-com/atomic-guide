/**
 * @fileoverview Factory function for Cross-Course Intelligence API
 * Creates properly configured cross-course API handlers with all dependencies
 */

import { Hono } from 'hono';
import { DatabaseService } from '../../../../shared/server/services/database.js';
import { KnowledgeGraphRepository } from '../repositories/KnowledgeGraphRepository.js';
import { KnowledgeDependencyMapper } from '../services/KnowledgeDependencyMapper.js';
import { PrerequisiteGapAnalyzer } from '../services/PrerequisiteGapAnalyzer.js';
import { CrossCourseAnalyticsEngine } from '../services/CrossCourseAnalyticsEngine.js';
import { CrossCourseApiHandlers } from './crossCourseApi.js';

/**
 * Creates a configured Cross-Course Intelligence API router
 * @param tenantId - The tenant identifier for multi-tenancy support
 * @returns Configured Hono router with all cross-course endpoints
 */
export function createCrossCourseApi(tenantId: string) {
  const app = new Hono<{ Bindings: Env }>();

  // Initialize handler on first request to ensure proper binding context
  app.use('*', async (c, next) => {
    // Initialize dependencies
    const db = new DatabaseService(c.env.DB);
    const knowledgeGraphRepo = new KnowledgeGraphRepository(db);
    const dependencyMapper = new KnowledgeDependencyMapper(db);
    const gapAnalyzer = new PrerequisiteGapAnalyzer(db, dependencyMapper);
    const analyticsEngine = new CrossCourseAnalyticsEngine(
      db,
      knowledgeGraphRepo,
      dependencyMapper,
      gapAnalyzer
    );

    // Create handlers
    const handlers = new CrossCourseApiHandlers(
      db,
      knowledgeGraphRepo,
      dependencyMapper,
      gapAnalyzer,
      analyticsEngine
    );

    // Store handlers in context for use by routes
    c.set('crossCourseHandlers', handlers);
    await next();
  });

  // Student-facing endpoints
  app.get('/analytics/:studentId', async (c) => {
    const handlers = c.get('crossCourseHandlers') as CrossCourseApiHandlers;
    return handlers.getCrossCourseAnalytics(c);
  });

  app.get('/knowledge-graph/:studentId', async (c) => {
    const handlers = c.get('crossCourseHandlers') as CrossCourseApiHandlers;
    return handlers.getKnowledgeGraph(c);
  });

  app.post('/analyze-gaps', async (c) => {
    const handlers = c.get('crossCourseHandlers') as CrossCourseApiHandlers;
    return handlers.analyzeGaps(c);
  });

  app.get('/academic-risk/:studentId', async (c) => {
    const handlers = c.get('crossCourseHandlers') as CrossCourseApiHandlers;
    return handlers.getAcademicRisk(c);
  });

  // Consent management endpoints
  app.post('/consent', async (c) => {
    const handlers = c.get('crossCourseHandlers') as CrossCourseApiHandlers;
    return handlers.manageConsent(c);
  });

  app.get('/consent/:studentId', async (c) => {
    const handlers = c.get('crossCourseHandlers') as CrossCourseApiHandlers;
    return handlers.getConsentSettings(c);
  });

  return app;
}

/**
 * Creates instructor-facing Cross-Course Intelligence API router
 * @param tenantId - The tenant identifier for multi-tenancy support
 * @returns Configured Hono router with instructor endpoints
 */
export function createInstructorCrossCourseApi(tenantId: string) {
  const app = new Hono<{ Bindings: Env }>();

  // Initialize handler on first request
  app.use('*', async (c, next) => {
    // Initialize dependencies
    const db = new DatabaseService(c.env.DB);
    const knowledgeGraphRepo = new KnowledgeGraphRepository(db);
    const dependencyMapper = new KnowledgeDependencyMapper(db);
    const gapAnalyzer = new PrerequisiteGapAnalyzer(db, dependencyMapper);
    const analyticsEngine = new CrossCourseAnalyticsEngine(
      db,
      knowledgeGraphRepo,
      dependencyMapper,
      gapAnalyzer
    );

    // Create handlers
    const handlers = new CrossCourseApiHandlers(
      db,
      knowledgeGraphRepo,
      dependencyMapper,
      gapAnalyzer,
      analyticsEngine
    );

    c.set('crossCourseHandlers', handlers);
    await next();
  });

  // Instructor endpoints
  app.get('/alerts', async (c) => {
    const handlers = c.get('crossCourseHandlers') as CrossCourseApiHandlers;
    return handlers.getInstructorAlerts(c);
  });

  app.put('/alerts/:id/acknowledge', async (c) => {
    const handlers = c.get('crossCourseHandlers') as CrossCourseApiHandlers;
    return handlers.acknowledgeAlert(c);
  });

  return app;
}