/**
 * @fileoverview Cross-device preference synchronization service for Story 3.4
 * @module features/dashboard/client/services/PreferencesSync
 */

import { z } from 'zod';

/**
 * Schema for dashboard preferences that sync across devices
 */
const DashboardPreferencesSchema = z.object({
  userId: z.string(),
  tenantId: z.string(),
  preferences: z.object({
    chartTypes: z.record(z.enum(['line', 'bar', 'radar'])).default({}),
    timeRanges: z.record(z.enum(['week', 'month', 'semester'])).default({}),
    collapsedSections: z.array(z.string()).default([]),
    benchmarkOptIn: z.boolean().default(false),
    exportFormats: z.array(z.enum(['csv', 'json', 'xapi'])).default(['csv']),
    activeView: z.enum(['overview', 'benchmarks', 'export']).default('overview'),
    expandedSections: z.array(z.string()).default(['overview']),
  }),
  mobileSettings: z.object({
    gesturesEnabled: z.boolean().default(true),
    hapticFeedback: z.boolean().default(true),
    orientationLock: z.enum(['none', 'portrait', 'landscape']).default('none'),
  }),
  lastModified: z.string().datetime(),
  deviceSyncId: z.string(),
  version: z.number().int().min(1).default(1),
});

export type DashboardPreferences = z.infer<typeof DashboardPreferencesSchema>;

/**
 * Schema for sync status
 */
const _SyncStatusSchema = z.object({
  status: z.enum(['synced', 'syncing', 'offline', 'conflict', 'error']),
  lastSync: z.string().datetime().optional(),
  conflictData: z.object({
    local: z.unknown(),
    remote: z.unknown(),
    timestamp: z.string().datetime(),
  }).optional(),
  errorMessage: z.string().optional(),
});

export type SyncStatus = z.infer<typeof _SyncStatusSchema>;

/**
 * Cross-device preference synchronization service
 * 
 * Manages dashboard preferences across devices using Cloudflare KV storage
 * with conflict resolution and offline support.
 */
export class PreferencesSync {
  private userId: string;
  private tenantId: string;
  private jwt: string;
  private deviceId: string;
  private syncStatus: SyncStatus = { status: 'offline' };
  private syncCallbacks: Array<(status: SyncStatus) => void> = [];
  private syncInterval?: number;
  private lastKnownVersion: number = 0;

  constructor(userId: string, tenantId: string, jwt: string) {
    this.userId = userId;
    this.tenantId = tenantId;
    this.jwt = jwt;
    this.deviceId = this.generateDeviceId();
    
    // Start periodic sync
    this.startPeriodicSync();

    // Handle online/offline events
    window.addEventListener('online', () => this.handleOnline());
    window.addEventListener('offline', () => this.handleOffline());
    
    // Handle visibility change for sync on focus
    document.addEventListener('visibilitychange', () => {
      if (!document.hidden) {
        this.syncFromServer();
      }
    });
  }

  /**
   * Generate a unique device ID for sync tracking
   */
  private generateDeviceId(): string {
    // Check for existing device ID in localStorage
    let deviceId = localStorage.getItem('dashboard_device_id');
    if (!deviceId) {
      deviceId = `device_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      localStorage.setItem('dashboard_device_id', deviceId);
    }
    return deviceId;
  }

  /**
   * Start periodic synchronization
   */
  private startPeriodicSync(): void {
    this.syncInterval = window.setInterval(() => {
      this.syncFromServer();
    }, 30000); // Sync every 30 seconds
  }

  /**
   * Stop periodic synchronization
   */
  public stopSync(): void {
    if (this.syncInterval) {
      clearInterval(this.syncInterval);
      this.syncInterval = undefined;
    }
  }

  /**
   * Handle online event
   */
  private handleOnline(): void {
    this.updateSyncStatus({ status: 'syncing' });
    this.syncFromServer();
  }

  /**
   * Handle offline event
   */
  private handleOffline(): void {
    this.updateSyncStatus({ status: 'offline' });
  }

  /**
   * Update sync status and notify listeners
   */
  private updateSyncStatus(status: Partial<SyncStatus>): void {
    this.syncStatus = { ...this.syncStatus, ...status };
    this.syncCallbacks.forEach(callback => callback(this.syncStatus));
  }

  /**
   * Subscribe to sync status updates
   */
  public onSyncStatusChange(callback: (status: SyncStatus) => void): () => void {
    this.syncCallbacks.push(callback);
    
    // Return unsubscribe function
    return () => {
      const index = this.syncCallbacks.indexOf(callback);
      if (index > -1) {
        this.syncCallbacks.splice(index, 1);
      }
    };
  }

  /**
   * Get current sync status
   */
  public getSyncStatus(): SyncStatus {
    return this.syncStatus;
  }

  /**
   * Load preferences from local storage
   */
  private loadLocalPreferences(): DashboardPreferences | null {
    try {
      const stored = localStorage.getItem(`dashboard_prefs_${this.userId}`);
      if (!stored) return null;

      const data = JSON.parse(stored);
      return DashboardPreferencesSchema.parse(data);
    } catch (error) {
      console.error('Failed to load local preferences:', error);
      return null;
    }
  }

  /**
   * Save preferences to local storage
   */
  private saveLocalPreferences(preferences: DashboardPreferences): void {
    try {
      localStorage.setItem(
        `dashboard_prefs_${this.userId}`, 
        JSON.stringify(preferences)
      );
    } catch (error) {
      console.error('Failed to save local preferences:', error);
    }
  }

  /**
   * Get preferences with fallback to defaults
   */
  public getPreferences(): DashboardPreferences {
    const local = this.loadLocalPreferences();
    
    if (local) {
      return local;
    }

    // Return default preferences
    const defaultPrefs: DashboardPreferences = {
      userId: this.userId,
      tenantId: this.tenantId,
      preferences: {
        chartTypes: {},
        timeRanges: {},
        collapsedSections: [],
        benchmarkOptIn: false,
        exportFormats: ['csv'],
        activeView: 'overview',
        expandedSections: ['overview'],
      },
      mobileSettings: {
        gesturesEnabled: true,
        hapticFeedback: true,
        orientationLock: 'none',
      },
      lastModified: new Date().toISOString(),
      deviceSyncId: this.deviceId,
      version: 1,
    };

    this.saveLocalPreferences(defaultPrefs);
    return defaultPrefs;
  }

  /**
   * Update preferences and sync to server
   */
  public async updatePreferences(
    updates: Partial<DashboardPreferences['preferences']>
  ): Promise<void> {
    try {
      const current = this.getPreferences();
      const updated: DashboardPreferences = {
        ...current,
        preferences: {
          ...current.preferences,
          ...updates,
        },
        lastModified: new Date().toISOString(),
        deviceSyncId: this.deviceId,
        version: current.version + 1,
      };

      // Save locally first
      this.saveLocalPreferences(updated);
      this.lastKnownVersion = updated.version;

      // Sync to server
      await this.syncToServer(updated);

    } catch (error) {
      console.error('Failed to update preferences:', error);
      this.updateSyncStatus({ 
        status: 'error', 
        errorMessage: 'Failed to update preferences' 
      });
    }
  }

  /**
   * Update mobile settings
   */
  public async updateMobileSettings(
    updates: Partial<DashboardPreferences['mobileSettings']>
  ): Promise<void> {
    try {
      const current = this.getPreferences();
      const updated: DashboardPreferences = {
        ...current,
        mobileSettings: {
          ...current.mobileSettings,
          ...updates,
        },
        lastModified: new Date().toISOString(),
        deviceSyncId: this.deviceId,
        version: current.version + 1,
      };

      this.saveLocalPreferences(updated);
      this.lastKnownVersion = updated.version;
      await this.syncToServer(updated);

    } catch (error) {
      console.error('Failed to update mobile settings:', error);
      this.updateSyncStatus({ 
        status: 'error', 
        errorMessage: 'Failed to update mobile settings' 
      });
    }
  }

  /**
   * Sync preferences to server
   */
  private async syncToServer(preferences: DashboardPreferences): Promise<void> {
    try {
      this.updateSyncStatus({ status: 'syncing' });

      const response = await fetch('/api/preferences/sync', {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${this.jwt}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          preferences,
          deviceId: this.deviceId,
        }),
      });

      if (!response.ok) {
        throw new Error(`Sync failed: ${response.statusText}`);
      }

      this.updateSyncStatus({ 
        status: 'synced', 
        lastSync: new Date().toISOString() 
      });

    } catch (error) {
      console.error('Failed to sync to server:', error);
      this.updateSyncStatus({ 
        status: 'error', 
        errorMessage: 'Failed to sync to server' 
      });
    }
  }

  /**
   * Sync preferences from server
   */
  private async syncFromServer(): Promise<void> {
    if (!navigator.onLine) {
      this.updateSyncStatus({ status: 'offline' });
      return;
    }

    try {
      this.updateSyncStatus({ status: 'syncing' });

      const response = await fetch(
        `/api/preferences/sync/${this.userId}?deviceId=${this.deviceId}`,
        {
          headers: {
            'Authorization': `Bearer ${this.jwt}`,
          },
        }
      );

      if (!response.ok) {
        throw new Error(`Sync failed: ${response.statusText}`);
      }

      const data = await response.json();
      
      if (data.success && data.data) {
        const serverPrefs = DashboardPreferencesSchema.parse(data.data);
        const localPrefs = this.loadLocalPreferences();

        // Check for conflicts
        if (localPrefs && this.hasConflict(localPrefs, serverPrefs)) {
          this.handleConflict(localPrefs, serverPrefs);
        } else {
          // No conflict, use server version if newer
          if (!localPrefs || serverPrefs.version > localPrefs.version) {
            this.saveLocalPreferences(serverPrefs);
            this.lastKnownVersion = serverPrefs.version;
          }

          this.updateSyncStatus({ 
            status: 'synced', 
            lastSync: new Date().toISOString() 
          });
        }
      } else {
        this.updateSyncStatus({ 
          status: 'synced', 
          lastSync: new Date().toISOString() 
        });
      }

    } catch (error) {
      console.error('Failed to sync from server:', error);
      this.updateSyncStatus({ 
        status: 'error', 
        errorMessage: 'Failed to sync from server' 
      });
    }
  }

  /**
   * Check if there's a conflict between local and server preferences
   */
  private hasConflict(local: DashboardPreferences, server: DashboardPreferences): boolean {
    // Conflict exists if both have been modified since last known version
    // and they have different device sync IDs
    return (
      local.version > this.lastKnownVersion &&
      server.version > this.lastKnownVersion &&
      local.deviceSyncId !== server.deviceSyncId
    );
  }

  /**
   * Handle sync conflict
   */
  private handleConflict(local: DashboardPreferences, server: DashboardPreferences): void {
    this.updateSyncStatus({
      status: 'conflict',
      conflictData: {
        local,
        remote: server,
        timestamp: new Date().toISOString(),
      },
    });
  }

  /**
   * Resolve conflict by choosing local or remote version
   */
  public async resolveConflict(useLocal: boolean): Promise<void> {
    try {
      const conflictData = this.syncStatus.conflictData;
      if (!conflictData) {
        throw new Error('No conflict to resolve');
      }

      let resolvedPrefs: DashboardPreferences;

      if (useLocal) {
        resolvedPrefs = conflictData.local as DashboardPreferences;
        resolvedPrefs.version += 1;
        resolvedPrefs.lastModified = new Date().toISOString();
        resolvedPrefs.deviceSyncId = this.deviceId;
      } else {
        resolvedPrefs = conflictData.remote as DashboardPreferences;
      }

      // Save resolved preferences
      this.saveLocalPreferences(resolvedPrefs);
      this.lastKnownVersion = resolvedPrefs.version;

      // Sync resolved version to server
      if (useLocal) {
        await this.syncToServer(resolvedPrefs);
      } else {
        this.updateSyncStatus({ 
          status: 'synced', 
          lastSync: new Date().toISOString() 
        });
      }

    } catch (error) {
      console.error('Failed to resolve conflict:', error);
      this.updateSyncStatus({ 
        status: 'error', 
        errorMessage: 'Failed to resolve conflict' 
      });
    }
  }

  /**
   * Force a complete sync from server (overwrites local)
   */
  public async forceSyncFromServer(): Promise<void> {
    try {
      this.updateSyncStatus({ status: 'syncing' });

      const response = await fetch(
        `/api/preferences/sync/${this.userId}?force=true`,
        {
          headers: {
            'Authorization': `Bearer ${this.jwt}`,
          },
        }
      );

      if (!response.ok) {
        throw new Error(`Force sync failed: ${response.statusText}`);
      }

      const data = await response.json();
      
      if (data.success && data.data) {
        const serverPrefs = DashboardPreferencesSchema.parse(data.data);
        this.saveLocalPreferences(serverPrefs);
        this.lastKnownVersion = serverPrefs.version;
      }

      this.updateSyncStatus({ 
        status: 'synced', 
        lastSync: new Date().toISOString() 
      });

    } catch (error) {
      console.error('Failed to force sync from server:', error);
      this.updateSyncStatus({ 
        status: 'error', 
        errorMessage: 'Failed to force sync from server' 
      });
    }
  }

  /**
   * Clear all local preferences (useful for logout)
   */
  public clearLocalPreferences(): void {
    try {
      localStorage.removeItem(`dashboard_prefs_${this.userId}`);
      this.updateSyncStatus({ status: 'offline' });
    } catch (error) {
      console.error('Failed to clear local preferences:', error);
    }
  }

  /**
   * Cleanup resources
   */
  public destroy(): void {
    this.stopSync();
    window.removeEventListener('online', this.handleOnline);
    window.removeEventListener('offline', this.handleOffline);
    this.syncCallbacks = [];
  }
}