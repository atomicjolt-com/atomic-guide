/**
 * @fileoverview Sync status indicator component for cross-device preference synchronization
 * @module features/dashboard/client/components/SyncStatusIndicator
 */

import React, { useState, useEffect } from 'react';
import { PreferencesSync, type SyncStatus } from '../services/PreferencesSync';
import styles from '../../styles/components/sync-status-indicator.module.css';

interface SyncStatusIndicatorProps {
  preferencesSync: PreferencesSync;
  onConflictResolve?: (useLocal: boolean) => void;
  compact?: boolean;
}

/**
 * Sync status indicator component showing cross-device synchronization status
 * 
 * Displays current sync status with appropriate icons and colors,
 * provides conflict resolution interface when needed.
 */
export default function SyncStatusIndicator({
  preferencesSync,
  onConflictResolve,
  compact = false
}: SyncStatusIndicatorProps): React.ReactElement | null {
  const [syncStatus, setSyncStatus] = useState<SyncStatus>(preferencesSync.getSyncStatus());
  const [showConflictModal, setShowConflictModal] = useState(false);

  useEffect(() => {
    const unsubscribe = preferencesSync.onSyncStatusChange((status) => {
      setSyncStatus(status);
      if (status.status === 'conflict') {
        setShowConflictModal(true);
      }
    });

    return unsubscribe;
  }, [preferencesSync]);

  // Handle conflict resolution
  const handleConflictResolution = async (useLocal: boolean): Promise<void> => {
    try {
      await preferencesSync.resolveConflict(useLocal);
      setShowConflictModal(false);
      onConflictResolve?.(useLocal);
    } catch (error) {
      console.error('Failed to resolve conflict:', error);
    }
  };

  // Get status display info
  const getStatusInfo = () => {
    switch (syncStatus.status) {
      case 'synced':
        return {
          icon: '✅',
          text: compact ? 'Synced' : 'Preferences synced',
          className: styles.synced,
          description: syncStatus.lastSync 
            ? `Last synced: ${new Date(syncStatus.lastSync).toLocaleTimeString()}`
            : 'Your preferences are synced across devices'
        };
      
      case 'syncing':
        return {
          icon: '🔄',
          text: compact ? 'Syncing' : 'Syncing...',
          className: `${styles.syncing} ${styles.spinning}`,
          description: 'Synchronizing preferences across devices'
        };
      
      case 'offline':
        return {
          icon: '📱',
          text: compact ? 'Offline' : 'Offline mode',
          className: styles.offline,
          description: 'Preferences will sync when you come back online'
        };
      
      case 'conflict':
        return {
          icon: '⚠️',
          text: compact ? 'Conflict' : 'Sync conflict',
          className: styles.conflict,
          description: 'Your preferences were changed on multiple devices'
        };
      
      case 'error':
        return {
          icon: '❌',
          text: compact ? 'Error' : 'Sync error',
          className: styles.error,
          description: syncStatus.errorMessage || 'Failed to sync preferences'
        };
      
      default:
        return {
          icon: '❓',
          text: 'Unknown',
          className: styles.unknown,
          description: 'Unknown sync status'
        };
    }
  };

  const statusInfo = getStatusInfo();

  // Render conflict resolution modal
  const renderConflictModal = (): React.ReactElement | null => {
    if (!showConflictModal || !syncStatus.conflictData) return null;

    const { local, remote } = syncStatus.conflictData;

    return (
      <div className={styles.conflictModalOverlay}>
        <div className={styles.conflictModal}>
          <div className={styles.conflictHeader}>
            <h3>Sync Conflict Detected</h3>
            <button
              type="button"
              className={styles.closeBtn}
              onClick={() => setShowConflictModal(false)}
              aria-label="Close conflict resolution"
            >
              ×
            </button>
          </div>

          <div className={styles.conflictContent}>
            <p>Your dashboard preferences were changed on multiple devices. Choose which version to keep:</p>

            <div className={styles.conflictOptions}>
              <div className={styles.conflictOption}>
                <div className={styles.optionHeader}>
                  <h4>This Device</h4>
                  <span className={styles.deviceInfo}>
                    Modified {new Date((local as any).lastModified).toLocaleString()}
                  </span>
                </div>
                <div className={styles.optionPreview}>
                  <div className={styles.preferencePreview}>
                    <span>Active View: {(local as any).preferences?.activeView || 'overview'}</span>
                    <span>Benchmark Opt-in: {(local as any).preferences?.benchmarkOptIn ? 'Yes' : 'No'}</span>
                    <span>Export Formats: {(local as any).preferences?.exportFormats?.join(', ') || 'CSV'}</span>
                  </div>
                </div>
                <button
                  type="button"
                  className={`${styles.chooseOptionBtn} ${styles.primary}`}
                  onClick={() => handleConflictResolution(true)}
                >
                  Keep This Version
                </button>
              </div>

              <div className={styles.conflictOption}>
                <div className={styles.optionHeader}>
                  <h4>Other Device</h4>
                  <span className={styles.deviceInfo}>
                    Modified {new Date((remote as any).lastModified).toLocaleString()}
                  </span>
                </div>
                <div className={styles.optionPreview}>
                  <div className={styles.preferencePreview}>
                    <span>Active View: {(remote as any).preferences?.activeView || 'overview'}</span>
                    <span>Benchmark Opt-in: {(remote as any).preferences?.benchmarkOptIn ? 'Yes' : 'No'}</span>
                    <span>Export Formats: {(remote as any).preferences?.exportFormats?.join(', ') || 'CSV'}</span>
                  </div>
                </div>
                <button
                  type="button"
                  className={`${styles.chooseOptionBtn} ${styles.secondary}`}
                  onClick={() => handleConflictResolution(false)}
                >
                  Use Other Version
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  };

  // Don't render if status is synced in compact mode
  if (compact && syncStatus.status === 'synced') {
    return null;
  }

  return (
    <>
      <div 
        className={`${styles.syncStatusIndicator} ${compact ? styles.compact : ''} ${statusInfo.className}`}
        title={statusInfo.description}
      >
        <span className={`${styles.statusIcon} ${syncStatus.status === 'syncing' ? styles.spinning : ''}`}>
          {statusInfo.icon}
        </span>
        
        {!compact && (
          <span className={styles.statusText}>
            {statusInfo.text}
          </span>
        )}

        {syncStatus.status === 'conflict' && (
          <button
            type="button"
            className={styles.resolveBtn}
            onClick={() => setShowConflictModal(true)}
          >
            Resolve
          </button>
        )}

        {syncStatus.status === 'error' && (
          <button
            type="button"
            className={styles.retryBtn}
            onClick={() => preferencesSync.forceSyncFromServer()}
          >
            Retry
          </button>
        )}
      </div>

      {renderConflictModal()}
    </>
  );
}