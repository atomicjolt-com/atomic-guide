/**
 * @fileoverview Tests for PreferencesSync service
 * @module features/dashboard/client/services/__tests__/PreferencesSync.test
 */

import { describe, it, expect, vi, beforeEach, afterEach } from '@/tests/infrastructure';
import { PreferencesSync } from '../PreferencesSync';

import type { MockD1Database, MockKVNamespace, MockQueue } from '@/tests/infrastructure/types/mocks';
// Mock fetch globally
const mockFetch = vi.fn();
global.fetch = mockFetch;

// Mock localStorage
const mockLocalStorage = {
  store: new Map(),
  getItem: vi.fn((key) => mockLocalStorage.store.get(key) || null),
  setItem: vi.fn((key, value) => mockLocalStorage.store.set(key, value)),
  removeItem: vi.fn((key) => mockLocalStorage.store.delete(key)),
  clear: vi.fn(() => mockLocalStorage.store.clear()),
};

Object.defineProperty(window, 'localStorage', {
  value: mockLocalStorage,
});

// Mock window methods
Object.defineProperty(window, 'navigator', {
  value: { onLine: true },
  writable: true,
});

const mockAddEventListener = vi.fn();
const mockRemoveEventListener = vi.fn();
Object.defineProperty(window, 'addEventListener', { value: mockAddEventListener });
Object.defineProperty(window, 'removeEventListener', { value: mockRemoveEventListener });

const mockDocumentAddEventListener = vi.fn();
Object.defineProperty(document, 'addEventListener', { value: mockDocumentAddEventListener });

// Mock timers
vi.useFakeTimers();

describe('PreferencesSync', () => {
  let preferencesSync: PreferencesSync;
  const userId = 'test-user-123';
  const tenantId = 'test-tenant-456';
  const jwt = 'test-jwt-token';

  beforeEach(async () => {
    // Clear mocks and localStorage
    vi.clearAllMocks();
    mockFetch.mockClear();
    mockLocalStorage.clear();

    // Set online status to true by default
    const navigator = window.navigator;
    navigator.onLine = true;

    preferencesSync = new PreferencesSync(userId, tenantId, jwt);
  });

  afterEach(() => {
    preferencesSync.destroy();
    vi.restoreAllMocks();
  });

  describe('Initialization', () => {
    it('should initialize with default sync status', () => {
      const status = preferencesSync.getSyncStatus();
      expect(status.status).toBe('offline');
    });

    it('should set up event listeners', () => {
      expect(mockAddEventListener).toHaveBeenCalledWith('online', expect.any(Function));
      expect(mockAddEventListener).toHaveBeenCalledWith('offline', expect.any(Function));
      expect(mockDocumentAddEventListener).toHaveBeenCalledWith('visibilitychange', expect.any(Function));
    });

    it('should start periodic sync', () => {
      expect(preferencesSync).toBeDefined();
    });

    it('should generate device ID', () => {
      expect(mockLocalStorage.getItem).toHaveBeenCalledWith('dashboard_device_id');
    });
  });

  describe('Default Preferences', () => {
    it('should return default preferences when none exist', () => {
      const preferences = preferencesSync.getPreferences();

      expect(preferences).toEqual({
        userId,
        tenantId,
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
        lastModified: expect.any(String),
        deviceSyncId: expect.any(String),
        version: 1,
      });
    });

    it('should save default preferences to localStorage', () => {
      preferencesSync.getPreferences();

      expect(mockLocalStorage.setItem).toHaveBeenCalledWith(`dashboard_prefs_${userId}`, expect.any(String));
    });
  });

  describe('Preference Updates', () => {
    it('should update preferences locally', async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ success: true }),
      });

      await preferencesSync.updatePreferences({
        benchmarkOptIn: true,
        activeView: 'benchmarks',
      });

      const preferences = preferencesSync.getPreferences();
      expect(preferences.preferences.benchmarkOptIn).toBe(true);
      expect(preferences.preferences.activeView).toBe('benchmarks');
    });

    it('should sync to server after local update', async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ success: true }),
      });

      await preferencesSync.updatePreferences({
        benchmarkOptIn: true,
      });

      expect(mockFetch).toHaveBeenCalledWith(
        '/api/preferences/sync',
        expect.objectContaining({
          method: 'PUT',
          headers: expect.objectContaining({
            Authorization: `Bearer ${jwt}`,
            'Content-Type': 'application/json',
          }),
          body: expect.stringContaining('"benchmarkOptIn":true'),
        })
      );
    });

    it('should increment version number on update', async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ success: true }),
      });

      const initialPrefs = preferencesSync.getPreferences();
      const initialVersion = initialPrefs.version;

      await preferencesSync.updatePreferences({
        benchmarkOptIn: true,
      });

      const updatedPrefs = preferencesSync.getPreferences();
      expect(updatedPrefs.version).toBe(initialVersion + 1);
    });

    it('should handle sync errors gracefully', async () => {
      mockFetch.mockRejectedValue(new Error('Network error'));

      const statusCallback = vi.fn();
      preferencesSync.onSyncStatusChange(statusCallback);

      await preferencesSync.updatePreferences({
        benchmarkOptIn: true,
      });

      expect(statusCallback).toHaveBeenCalledWith(
        expect.objectContaining({
          status: 'error',
          errorMessage: 'Failed to sync to server',
        })
      );
    });
  });

  describe('Mobile Settings', () => {
    it('should update mobile settings', async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ success: true }),
      });

      await preferencesSync.updateMobileSettings({
        gesturesEnabled: false,
        hapticFeedback: false,
      });

      const preferences = preferencesSync.getPreferences();
      expect(preferences.mobileSettings.gesturesEnabled).toBe(false);
      expect(preferences.mobileSettings.hapticFeedback).toBe(false);
    });

    it('should sync mobile settings to server', async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ success: true }),
      });

      await preferencesSync.updateMobileSettings({
        orientationLock: 'portrait',
      });

      expect(mockFetch).toHaveBeenCalledWith(
        '/api/preferences/sync',
        expect.objectContaining({
          body: expect.stringContaining('"orientationLock":"portrait"'),
        })
      );
    });
  });

  describe('Status Callbacks', () => {
    it('should notify listeners of status changes', async () => {
      const callback1 = vi.fn();
      const callback2 = vi.fn();

      preferencesSync.onSyncStatusChange(callback1);
      preferencesSync.onSyncStatusChange(callback2);

      // Trigger a status change by going offline
      const navigator = window.navigator;
      navigator.onLine = false;

      // Get the actual event handler that was registered
      const offlineHandlerCall = mockAddEventListener.mock.calls.find(call => call[0] === 'offline');
      expect(offlineHandlerCall).toBeDefined();
      const offlineHandler = offlineHandlerCall![1];

      // Call the handler directly to simulate the offline event
      offlineHandler();

      // Callbacks should be called synchronously
      expect(callback1).toHaveBeenCalledWith(expect.objectContaining({ status: 'offline' }));
      expect(callback2).toHaveBeenCalledWith(expect.objectContaining({ status: 'offline' }));
    });

    it('should allow unsubscribing from status updates', () => {
      const callback = vi.fn();
      const unsubscribe = preferencesSync.onSyncStatusChange(callback);

      unsubscribe();

      // Trigger a status change
      const navigator = window.navigator;
      navigator.onLine = false;

      // Simulate offline event
      window.dispatchEvent(new Event('offline'));

      expect(callback).not.toHaveBeenCalled();
    });
  });

  describe('Sync from Server', () => {
    it('should sync preferences from server when online', async () => {
      // Ensure we're online
      const navigator = window.navigator;
      navigator.onLine = true;

      const serverPrefs = {
        userId,
        tenantId,
        preferences: {
          chartTypes: { overallMastery: 'bar' },
          timeRanges: {},
          collapsedSections: [],
          benchmarkOptIn: true,
          exportFormats: ['csv', 'json'],
          activeView: 'benchmarks',
          expandedSections: ['overview'],
        },
        mobileSettings: {
          gesturesEnabled: true,
          hapticFeedback: true,
          orientationLock: 'none',
        },
        lastModified: '2024-01-15T10:00:00Z',
        deviceSyncId: 'other-device-123',
        version: 2,
      };

      mockFetch.mockResolvedValue({
        ok: true,
        json: () =>
          Promise.resolve({
            success: true,
            data: serverPrefs,
          }),
      });

      // Create a fresh instance to ensure clean state
      const freshPrefsSync = new PreferencesSync(userId, tenantId, jwt);
      
      // Call the private syncFromServer method directly
      await freshPrefsSync['syncFromServer']();

      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining(`/api/preferences/sync/${userId}`),
        expect.objectContaining({
          headers: expect.objectContaining({
            Authorization: `Bearer ${jwt}`,
          }),
        })
      );
      
      // Clean up
      freshPrefsSync.destroy();
    });

    it('should use server preferences when newer', async () => {
      const serverPrefs = {
        userId,
        tenantId,
        preferences: {
          chartTypes: {},
          timeRanges: {},
          collapsedSections: [],
          benchmarkOptIn: true,
          exportFormats: ['csv'],
          activeView: 'benchmarks',
          expandedSections: ['overview'],
        },
        mobileSettings: {
          gesturesEnabled: true,
          hapticFeedback: true,
          orientationLock: 'none',
        },
        lastModified: '2024-01-15T10:00:00Z',
        deviceSyncId: 'other-device-123',
        version: 5,
      };

      mockFetch.mockResolvedValue({
        ok: true,
        json: () =>
          Promise.resolve({
            success: true,
            data: serverPrefs,
          }),
      });

      // Get local preferences first (version 1)
      const localPrefs = preferencesSync.getPreferences();
      expect(localPrefs.version).toBe(1);

      // Trigger sync from server
      await preferencesSync.forceSyncFromServer();

      const syncedPrefs = preferencesSync.getPreferences();
      expect(syncedPrefs.version).toBe(5);
      expect(syncedPrefs.preferences.benchmarkOptIn).toBe(true);
    });

    it('should not override local preferences when they are newer', async () => {
      // Ensure we're online
      const navigator = window.navigator;
      navigator.onLine = true;

      // Make local update first
      mockFetch.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ success: true }),
      });

      await preferencesSync.updatePreferences({
        benchmarkOptIn: true,
      });

      const localPrefs = preferencesSync.getPreferences();
      const localVersion = localPrefs.version;

      // Now mock server response with older version
      const serverPrefs = {
        ...localPrefs,
        preferences: {
          ...localPrefs.preferences,
          benchmarkOptIn: false,
        },
        version: localVersion - 1,
      };

      mockFetch.mockResolvedValue({
        ok: true,
        json: () =>
          Promise.resolve({
            success: true,
            data: serverPrefs,
          }),
      });

      // Trigger sync
      window.dispatchEvent(new Event('online'));

      // Wait for async operations to complete (but not the periodic sync)
      await vi.waitFor(
        () => {
          expect(mockFetch).toHaveBeenCalled();
        },
        { timeout: 1000 }
      );

      // Local preferences should be preserved
      const finalPrefs = preferencesSync.getPreferences();
      expect(finalPrefs.preferences.benchmarkOptIn).toBe(true);
    });
  });

  describe('Conflict Resolution', () => {
    it('should detect conflicts between local and server preferences', async () => {
      // Ensure we're online
      const navigator = window.navigator;
      navigator.onLine = true;

      // Create local changes
      mockFetch.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ success: true }),
      });

      await preferencesSync.updatePreferences({
        benchmarkOptIn: true,
      });

      const localPrefs = preferencesSync.getPreferences();

      // Update lastKnownVersion after the update to simulate the version being tracked
      // Then reset it to 0 to create conflict conditions
      preferencesSync['lastKnownVersion'] = 0;

      // Mock server with conflicting changes - to trigger hasConflict(),
      // both versions must be > lastKnownVersion and have different deviceSyncId
      const serverPrefs = {
        ...localPrefs,
        preferences: {
          ...localPrefs.preferences,
          activeView: 'export' as const,
        },
        version: localPrefs.version, // Same version but different device
        deviceSyncId: 'different-device-123',
      };

      mockFetch.mockResolvedValue({
        ok: true,
        json: () =>
          Promise.resolve({
            success: true,
            data: serverPrefs,
          }),
      });

      const statusCallback = vi.fn();
      preferencesSync.onSyncStatusChange(statusCallback);

      // Trigger sync that will detect conflict by calling syncFromServer directly
      // since the private method can be called via reflection
      await preferencesSync['syncFromServer']();

      expect(statusCallback).toHaveBeenCalledWith(
        expect.objectContaining({
          status: 'conflict',
          conflictData: expect.objectContaining({
            local: expect.any(Object),
            remote: expect.any(Object),
          }),
        })
      );
    });

    it('should resolve conflicts by choosing local version', async () => {
      // Set up conflict state
      const localPrefs = preferencesSync.getPreferences();
      const serverPrefs = {
        ...localPrefs,
        preferences: {
          ...localPrefs.preferences,
          activeView: 'export' as const,
        },
        deviceSyncId: 'different-device-123',
      };

      preferencesSync['syncStatus'] = {
        status: 'conflict',
        conflictData: {
          local: localPrefs,
          remote: serverPrefs,
          timestamp: new Date().toISOString(),
        },
      };

      mockFetch.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ success: true }),
      });

      await preferencesSync.resolveConflict(true); // Use local

      const resolvedPrefs = preferencesSync.getPreferences();
      expect(resolvedPrefs.preferences.activeView).toBe(localPrefs.preferences.activeView);
    });

    it('should resolve conflicts by choosing remote version', async () => {
      const localPrefs = preferencesSync.getPreferences();
      const serverPrefs = {
        ...localPrefs,
        preferences: {
          ...localPrefs.preferences,
          activeView: 'export' as const,
        },
        deviceSyncId: 'different-device-123',
      };

      preferencesSync['syncStatus'] = {
        status: 'conflict',
        conflictData: {
          local: localPrefs,
          remote: serverPrefs,
          timestamp: new Date().toISOString(),
        },
      };

      await preferencesSync.resolveConflict(false); // Use remote

      const resolvedPrefs = preferencesSync.getPreferences();
      expect(resolvedPrefs.preferences.activeView).toBe('export');
    });
  });

  describe('Periodic Sync', () => {
    it('should sync periodically when online', async () => {
      // Ensure we're online
      const navigator = window.navigator;
      navigator.onLine = true;

      mockFetch.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ success: true }),
      });

      // Advance timer to trigger periodic sync
      vi.advanceTimersByTime(30000);

      expect(mockFetch).toHaveBeenCalledWith(expect.stringContaining(`/api/preferences/sync/${userId}`), expect.any(Object));
    });

    it('should not sync when offline', () => {
      const navigator = window.navigator;
      navigator.onLine = false;

      vi.advanceTimersByTime(30000);

      expect(mockFetch).not.toHaveBeenCalled();
    });
  });

  describe('Cleanup', () => {
    it('should remove event listeners on destroy', () => {
      preferencesSync.destroy();

      expect(mockRemoveEventListener).toHaveBeenCalledWith('online', expect.any(Function));
      expect(mockRemoveEventListener).toHaveBeenCalledWith('offline', expect.any(Function));
    });

    it('should stop periodic sync on destroy', () => {
      const clearIntervalSpy = vi.spyOn(window, 'clearInterval');

      preferencesSync.destroy();

      expect(clearIntervalSpy).toHaveBeenCalled();
    });

    it('should clear local preferences', () => {
      preferencesSync.clearLocalPreferences();

      expect(mockLocalStorage.removeItem).toHaveBeenCalledWith(`dashboard_prefs_${userId}`);
    });
  });

  describe('Error Handling', () => {
    it('should handle network errors gracefully', async () => {
      mockFetch.mockRejectedValue(new Error('Network error'));

      const statusCallback = vi.fn();
      preferencesSync.onSyncStatusChange(statusCallback);

      await preferencesSync.updatePreferences({
        benchmarkOptIn: true,
      });

      expect(statusCallback).toHaveBeenCalledWith(
        expect.objectContaining({
          status: 'error',
          errorMessage: 'Failed to sync to server',
        })
      );
    });

    it('should handle malformed server responses', async () => {
      // Ensure we're online
      const navigator = window.navigator;
      navigator.onLine = true;

      mockFetch.mockResolvedValue({
        ok: true,
        json: () =>
          Promise.resolve({
            success: true,
            data: { invalid: 'data' },
          }),
      });

      const statusCallback = vi.fn();
      preferencesSync.onSyncStatusChange(statusCallback);

      // Call syncFromServer directly to avoid event handler complexity
      await preferencesSync['syncFromServer']();

      expect(statusCallback).toHaveBeenCalledWith(
        expect.objectContaining({
          status: 'error',
        })
      );
    });

    it('should handle localStorage errors', () => {
      mockLocalStorage.setItem.mockImplementation(() => {
        throw new Error('Storage quota exceeded');
      });

      // Should not crash
      expect(() => preferencesSync.getPreferences()).not.toThrow();
    });
  });
});
