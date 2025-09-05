/**
 * @fileoverview API handlers for user preferences synchronization
 * @module features/dashboard/server/handlers/preferencesApi
 */

import { Hono } from 'hono';
import { z } from 'zod';
import { zValidator } from '@hono/zod-validator';
import type { D1Database } from '@cloudflare/workers-types';

/**
 * Environment bindings
 */
interface PreferencesEnv {
  DB: D1Database;
  ENVIRONMENT: string;
}

/**
 * Preferences schema
 */
const PreferencesSchema = z.object({
  userId: z.string().min(1),
  deviceId: z.string().min(1),
  preferences: z.object({
    suggestionsEnabled: z.boolean().optional(),
    faqSuggestionsEnabled: z.boolean().optional(),
    orientationLock: z.enum(['portrait', 'landscape', 'auto']).optional(),
    theme: z.enum(['light', 'dark', 'auto']).optional(),
    videoQuality: z.enum(['low', 'medium', 'high', 'auto']).optional(),
    autoplay: z.boolean().optional(),
    notifications: z.boolean().optional(),
    soundEnabled: z.boolean().optional(),
  }),
  timestamp: z.string(),
  version: z.number(),
});

/**
 * Create preferences API router
 * 
 * @param tenantId - Tenant identifier for multi-tenancy
 * @returns Hono router with preferences endpoints
 */
export function createPreferencesApi(
  tenantId: string = 'default'
): Hono<{ Bindings: PreferencesEnv }> {
  const api = new Hono<{ Bindings: PreferencesEnv }>();

  /**
   * PUT /preferences/sync
   * Sync preferences from client to server
   */
  api.put('/sync', zValidator('json', PreferencesSchema), async (c) => {
    try {
      const data = c.req.valid('json');
      const { userId, deviceId, preferences, timestamp, version } = data;

      // Store preferences in database
      await c.env.DB.prepare(
        `
        INSERT INTO user_preferences (
          tenant_id, user_id, device_id, preferences, 
          timestamp, version, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, datetime('now'))
        ON CONFLICT(tenant_id, user_id, device_id) DO UPDATE SET
          preferences = excluded.preferences,
          timestamp = excluded.timestamp,
          version = excluded.version,
          updated_at = datetime('now')
        `
      )
        .bind(
          tenantId,
          userId,
          deviceId,
          JSON.stringify(preferences),
          timestamp,
          version
        )
        .run();

      return c.json({
        success: true,
        message: 'Preferences synced successfully',
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      console.error('Preferences sync error:', error);
      return c.json(
        {
          success: false,
          error: 'Failed to sync preferences',
        },
        500
      );
    }
  });

  /**
   * GET /preferences/sync/:userId
   * Get synced preferences for a user
   */
  api.get('/sync/:userId', async (c) => {
    try {
      const userId = c.req.param('userId');
      const deviceId = c.req.query('deviceId');

      if (!deviceId) {
        return c.json(
          {
            success: false,
            error: 'deviceId query parameter is required',
          },
          400
        );
      }

      // Get latest preferences for the user and device
      const result = await c.env.DB.prepare(
        `
        SELECT 
          preferences,
          timestamp,
          version,
          updated_at
        FROM user_preferences
        WHERE tenant_id = ? AND user_id = ? AND device_id = ?
        ORDER BY updated_at DESC
        LIMIT 1
        `
      )
        .bind(tenantId, userId, deviceId)
        .first();

      if (!result) {
        // Return default preferences if none exist
        return c.json({
          success: true,
          data: {
            userId,
            deviceId,
            preferences: {
              suggestionsEnabled: true,
              faqSuggestionsEnabled: true,
              orientationLock: 'auto',
              theme: 'auto',
              videoQuality: 'auto',
              autoplay: true,
              notifications: true,
              soundEnabled: true,
            },
            timestamp: new Date().toISOString(),
            version: 1,
          },
        });
      }

      return c.json({
        success: true,
        data: {
          userId,
          deviceId,
          preferences: JSON.parse(result.preferences as string),
          timestamp: result.timestamp,
          version: result.version,
        },
      });
    } catch (error) {
      console.error('Get preferences error:', error);
      return c.json(
        {
          success: false,
          error: 'Failed to retrieve preferences',
        },
        500
      );
    }
  });

  /**
   * GET /preferences/sync/:userId (with force parameter)
   * Force sync preferences from server
   */
  api.get('/sync/:userId', async (c) => {
    try {
      const userId = c.req.param('userId');
      const force = c.req.query('force') === 'true';

      if (!force) {
        // Regular sync handled above
        return c.next();
      }

      // Get all preferences for the user across all devices
      const results = await c.env.DB.prepare(
        `
        SELECT 
          device_id,
          preferences,
          timestamp,
          version,
          updated_at
        FROM user_preferences
        WHERE tenant_id = ? AND user_id = ?
        ORDER BY updated_at DESC
        `
      )
        .bind(tenantId, userId)
        .all();

      if (!results.results || results.results.length === 0) {
        return c.json({
          success: true,
          data: {
            userId,
            devices: [],
          },
        });
      }

      const devices = results.results.map((row) => ({
        deviceId: row.device_id,
        preferences: JSON.parse(row.preferences as string),
        timestamp: row.timestamp,
        version: row.version,
        updatedAt: row.updated_at,
      }));

      // Return the most recently updated preferences
      const latestDevice = devices[0];

      return c.json({
        success: true,
        data: {
          userId,
          deviceId: latestDevice.deviceId,
          preferences: latestDevice.preferences,
          timestamp: latestDevice.timestamp,
          version: latestDevice.version,
          allDevices: devices,
        },
      });
    } catch (error) {
      console.error('Force sync preferences error:', error);
      return c.json(
        {
          success: false,
          error: 'Failed to force sync preferences',
        },
        500
      );
    }
  });

  /**
   * DELETE /preferences/sync/:userId
   * Delete user preferences
   */
  api.delete('/sync/:userId', async (c) => {
    try {
      const userId = c.req.param('userId');
      const deviceId = c.req.query('deviceId');

      let query: string;
      let params: (string | undefined)[];

      if (deviceId) {
        // Delete preferences for specific device
        query = `
          DELETE FROM user_preferences
          WHERE tenant_id = ? AND user_id = ? AND device_id = ?
        `;
        params = [tenantId, userId, deviceId];
      } else {
        // Delete all preferences for user
        query = `
          DELETE FROM user_preferences
          WHERE tenant_id = ? AND user_id = ?
        `;
        params = [tenantId, userId];
      }

      const result = await c.env.DB.prepare(query)
        .bind(...params)
        .run();

      return c.json({
        success: true,
        message: `Deleted ${result.meta.changes} preference record(s)`,
      });
    } catch (error) {
      console.error('Delete preferences error:', error);
      return c.json(
        {
          success: false,
          error: 'Failed to delete preferences',
        },
        500
      );
    }
  });

  return api;
}