/**
 * Test D1 database connectivity
 * Run with: npm run test:db
 */

import { Hono } from 'hono';
import type { D1Database } from '@cloudflare/workers-types';
import { healthCheck, getOrCreateLearnerProfile, getCourseAnalytics, getLearnerMastery, executeQuery } from './utils';

interface Env {
  DB: D1Database;
}

const app = new Hono<{ Bindings: Env }>();

/**
 * Database health check endpoint
 */
app.get('/db/health', async (c) => {
  const db = c.env.DB;

  try {
    const isHealthy = await healthCheck(db);

    if (!isHealthy) {
      return c.json(
        {
          status: 'unhealthy',
          error: 'Database connection failed',
        },
        503,
      );
    }

    // Get some basic stats
    const stats = await executeQuery(
      db,
      `
      SELECT
        (SELECT COUNT(*) FROM learner_profiles) as learners,
        (SELECT COUNT(*) FROM learning_sessions) as sessions,
        (SELECT COUNT(*) FROM knowledge_graph) as concepts,
        (SELECT tenant_id FROM tenant_config LIMIT 1) as tenant_id
    `,
    );

    return c.json({
      status: 'healthy',
      database: 'D1',
      stats: stats.data?.[0] || {},
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    return c.json(
      {
        status: 'error',
        error: error instanceof Error ? error.message : 'Unknown error',
      },
      500,
    );
  }
});

/**
 * Test learner profile operations
 */
app.get('/db/test/learner', async (c) => {
  const db = c.env.DB;

  try {
    // Get tenant ID
    const tenantResult = await executeQuery(db, 'SELECT tenant_id FROM tenant_config LIMIT 1');

    if (!tenantResult.success || !tenantResult.data?.[0]) {
      return c.json({ error: 'No tenant configured' }, 400);
    }

    const tenantId = tenantResult.data[0].tenant_id;

    // Create or get a test learner
    const profile = await getOrCreateLearnerProfile(
      db,
      tenantId,
      'test_user_' + Date.now(),
      'test_deployment',
      'test@example.com',
      'Test User',
    );

    if (!profile) {
      return c.json({ error: 'Failed to create learner profile' }, 500);
    }

    // Get learner's mastery data
    const mastery = await getLearnerMastery(db, profile.id);

    return c.json({
      success: true,
      profile,
      mastery,
      message: 'Learner profile operations successful',
    });
  } catch (error) {
    return c.json(
      {
        error: error instanceof Error ? error.message : 'Unknown error',
      },
      500,
    );
  }
});

/**
 * Test course analytics
 */
app.get('/db/test/analytics', async (c) => {
  const db = c.env.DB;

  try {
    // Get tenant ID
    const tenantResult = await executeQuery(db, 'SELECT tenant_id FROM tenant_config LIMIT 1');

    if (!tenantResult.success || !tenantResult.data?.[0]) {
      return c.json({ error: 'No tenant configured' }, 400);
    }

    const tenantId = tenantResult.data[0].tenant_id;

    // Get analytics for test course
    const analytics = await getCourseAnalytics(
      db,
      tenantId,
      'context_cs101', // From seed data
    );

    return c.json({
      success: true,
      analytics,
      message: 'Course analytics retrieved successfully',
    });
  } catch (error) {
    return c.json(
      {
        error: error instanceof Error ? error.message : 'Unknown error',
      },
      500,
    );
  }
});

/**
 * Test raw query execution
 */
app.post('/db/test/query', async (c) => {
  const db = c.env.DB;

  try {
    const { query } = await c.req.json<{ query: string }>();

    if (!query) {
      return c.json({ error: 'Query is required' }, 400);
    }

    // Only allow SELECT queries for safety
    if (!query.trim().toUpperCase().startsWith('SELECT')) {
      return c.json({ error: 'Only SELECT queries are allowed in test mode' }, 400);
    }

    const result = await executeQuery(db, query);

    return c.json({
      success: result.success,
      data: result.data,
      meta: result.meta,
      error: result.error,
    });
  } catch (error) {
    return c.json(
      {
        error: error instanceof Error ? error.message : 'Unknown error',
      },
      500,
    );
  }
});

/**
 * Get database schema information
 */
app.get('/db/schema', async (c) => {
  const db = c.env.DB;

  try {
    // Get all tables
    const tables = await executeQuery(
      db,
      `
      SELECT name, sql
      FROM sqlite_master
      WHERE type='table'
      ORDER BY name
    `,
    );

    // Get indexes
    const indexes = await executeQuery(
      db,
      `
      SELECT name, tbl_name, sql
      FROM sqlite_master
      WHERE type='index'
      ORDER BY tbl_name, name
    `,
    );

    return c.json({
      success: true,
      tables: tables.data,
      indexes: indexes.data,
      tableCount: tables.data?.length || 0,
      indexCount: indexes.data?.length || 0,
    });
  } catch (error) {
    return c.json(
      {
        error: error instanceof Error ? error.message : 'Unknown error',
      },
      500,
    );
  }
});

export default app;
