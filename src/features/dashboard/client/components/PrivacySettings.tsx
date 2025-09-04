import React, { useState, useCallback } from 'react';
import styles from '../../styles/components/privacy-settings.module.css';

interface PrivacySettingsProps {
  settings: {
    conversationRetention: boolean;
    dataSharing: boolean;
    analyticsTracking: boolean;
    personalizedLearning: boolean;
  };
  onSettingsChange: (settings: any) => void;
  onDeleteAllData: () => void;
  onExportData: (format: 'json' | 'csv') => void;
  onDeleteConversations: (conversationIds: string[]) => void;
  conversations?: Array<{
    id: string;
    title: string;
    date: string;
    messageCount: number;
  }>;
  isLoading?: boolean;
}

export default function PrivacySettings({
  settings,
  onSettingsChange,
  onDeleteAllData,
  onExportData,
  onDeleteConversations,
  conversations = [],
  isLoading = false,
}: PrivacySettingsProps) {
  const [selectedConversations, setSelectedConversations] = useState<Set<string>>(new Set());
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [showDeleteAllConfirm, setShowDeleteAllConfirm] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<'selected' | 'all' | null>(null);

  const handleSettingToggle = useCallback(
    (key: string) => {
      onSettingsChange({
        ...settings,
        [key]: !settings[key as keyof typeof settings],
      });
    },
    [settings, onSettingsChange]
  );

  const handleConversationSelect = useCallback(
    (conversationId: string) => {
      const newSelected = new Set(selectedConversations);
      if (newSelected.has(conversationId)) {
        newSelected.delete(conversationId);
      } else {
        newSelected.add(conversationId);
      }
      setSelectedConversations(newSelected);
    },
    [selectedConversations]
  );

  const handleSelectAll = useCallback(() => {
    if (selectedConversations.size === conversations.length) {
      setSelectedConversations(new Set());
    } else {
      setSelectedConversations(new Set(conversations.map((c) => c.id)));
    }
  }, [selectedConversations, conversations]);

  const handleDeleteSelected = useCallback(() => {
    if (selectedConversations.size === 0) return;
    setDeleteTarget('selected');
    setShowDeleteConfirm(true);
  }, [selectedConversations]);

  const handleDeleteAll = useCallback(() => {
    setDeleteTarget('all');
    setShowDeleteAllConfirm(true);
  }, []);

  const confirmDelete = useCallback(() => {
    if (deleteTarget === 'selected') {
      onDeleteConversations(Array.from(selectedConversations));
      setSelectedConversations(new Set());
    } else if (deleteTarget === 'all') {
      onDeleteAllData();
    }
    setShowDeleteConfirm(false);
    setShowDeleteAllConfirm(false);
    setDeleteTarget(null);
  }, [deleteTarget, selectedConversations, onDeleteConversations, onDeleteAllData]);

  const cancelDelete = useCallback(() => {
    setShowDeleteConfirm(false);
    setShowDeleteAllConfirm(false);
    setDeleteTarget(null);
  }, []);

  const renderPrivacyToggle = (key: string, label: string, description: string, icon: string) => {
    const isEnabled = settings[key as keyof typeof settings];

    return (
      <div className={styles.settingItem}>
        <div className={styles.settingIcon}>{icon}</div>
        <div className={styles.settingContent}>
          <div className={styles.settingHeader}>
            <h3>{label}</h3>
            <button
              className={`${styles.toggle} ${isEnabled ? styles.active : ''}`}
              onClick={() => handleSettingToggle(key)}
              aria-label={`${label}: ${isEnabled ? 'Enabled' : 'Disabled'}`}
              role="switch"
              aria-checked={isEnabled}
            >
              <span className={styles.toggleSlider} />
            </button>
          </div>
          <p className={styles.settingDescription}>{description}</p>
        </div>
      </div>
    );
  };

  if (isLoading) {
    return (
      <div className={styles.privacySettings}>
        <div className={styles.loading}>
          <div className={styles.spinner}></div>
          <p>Loading privacy settings...</p>
        </div>
      </div>
    );
  }

  return (
    <div className={styles.privacySettings}>
      <div className={styles.header}>
        <h2>Privacy & Data Management</h2>
        <p className={styles.subtitle}>Control how your data is stored and used for learning personalization</p>
      </div>

      <div className={styles.section}>
        <h3 className={styles.sectionTitle}>Privacy Preferences</h3>
        <div className={styles.settingsList}>
          {renderPrivacyToggle(
            'conversationRetention',
            'Conversation History',
            'Save your chat conversations for future reference and continued learning',
            '💬'
          )}
          {renderPrivacyToggle(
            'dataSharing',
            'Learning Analytics',
            'Share anonymized learning patterns to improve the AI tutor for all students',
            '📊'
          )}
          {renderPrivacyToggle(
            'analyticsTracking',
            'Usage Analytics',
            'Track your learning progress and provide insights on your study patterns',
            '📈'
          )}
          {renderPrivacyToggle(
            'personalizedLearning',
            'Personalized Learning',
            'Use your learning history to provide tailored explanations and recommendations',
            '🎯'
          )}
        </div>
      </div>

      <div className={styles.section}>
        <h3 className={styles.sectionTitle}>Data Management</h3>

        <div className={styles.dataActions}>
          <div className={styles.actionCard}>
            <div className={styles.actionIcon}>📥</div>
            <div className={styles.actionContent}>
              <h4>Export Your Data</h4>
              <p>Download all your conversation history and learning analytics</p>
              <div className={styles.exportButtons}>
                <button className={styles.exportButton} onClick={() => onExportData('json')}>
                  Export as JSON
                </button>
                <button className={styles.exportButton} onClick={() => onExportData('csv')}>
                  Export as CSV
                </button>
              </div>
            </div>
          </div>

          <div className={styles.actionCard}>
            <div className={styles.actionIcon}>🗑️</div>
            <div className={styles.actionContent}>
              <h4>Delete All Data</h4>
              <p>Permanently remove all your conversations and learning history</p>
              <button className={styles.deleteAllButton} onClick={handleDeleteAll}>
                Delete Everything
              </button>
            </div>
          </div>
        </div>
      </div>

      {conversations.length > 0 && (
        <div className={styles.section}>
          <div className={styles.conversationsHeader}>
            <h3 className={styles.sectionTitle}>Manage Conversations</h3>
            <div className={styles.bulkActions}>
              <button className={styles.selectAllButton} onClick={handleSelectAll}>
                {selectedConversations.size === conversations.length ? 'Deselect All' : 'Select All'}
              </button>
              {selectedConversations.size > 0 && (
                <button className={styles.deleteSelectedButton} onClick={handleDeleteSelected}>
                  Delete Selected ({selectedConversations.size})
                </button>
              )}
            </div>
          </div>

          <div className={styles.conversationsList}>
            {conversations.map((conversation) => (
              <div
                key={conversation.id}
                className={`${styles.conversationItem} ${selectedConversations.has(conversation.id) ? styles.selected : ''}`}
              >
                <input
                  type="checkbox"
                  className={styles.checkbox}
                  checked={selectedConversations.has(conversation.id)}
                  onChange={() => handleConversationSelect(conversation.id)}
                  aria-label={`Select ${conversation.title}`}
                />
                <div className={styles.conversationInfo}>
                  <h4>{conversation.title}</h4>
                  <div className={styles.conversationMeta}>
                    <span>{conversation.date}</span>
                    <span>{conversation.messageCount} messages</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className={styles.section}>
        <h3 className={styles.sectionTitle}>Data Retention Policy</h3>
        <div className={styles.policyInfo}>
          <div className={styles.policyItem}>
            <span className={styles.policyIcon}>⏰</span>
            <div>
              <h4>Automatic Deletion</h4>
              <p>Conversations older than 90 days are automatically deleted</p>
            </div>
          </div>
          <div className={styles.policyItem}>
            <span className={styles.policyIcon}>🔒</span>
            <div>
              <h4>Encryption</h4>
              <p>All data is encrypted at rest and in transit</p>
            </div>
          </div>
          <div className={styles.policyItem}>
            <span className={styles.policyIcon}>🏫</span>
            <div>
              <h4>Tenant Isolation</h4>
              <p>Your data is isolated by institution and never shared across organizations</p>
            </div>
          </div>
          <div className={styles.policyItem}>
            <span className={styles.policyIcon}>📋</span>
            <div>
              <h4>GDPR Compliance</h4>
              <p>Full compliance with data protection regulations including right to deletion</p>
            </div>
          </div>
        </div>
      </div>

      {/* Delete Confirmation Modal */}
      {showDeleteConfirm && (
        <div className={styles.modal}>
          <div className={styles.modalContent}>
            <h3>Confirm Deletion</h3>
            <p>
              Are you sure you want to delete {selectedConversations.size} selected conversation
              {selectedConversations.size !== 1 ? 's' : ''}? This action cannot be undone.
            </p>
            <div className={styles.modalActions}>
              <button className={styles.cancelButton} onClick={cancelDelete}>
                Cancel
              </button>
              <button className={styles.confirmDeleteButton} onClick={confirmDelete}>
                Delete
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete All Confirmation Modal */}
      {showDeleteAllConfirm && (
        <div className={styles.modal}>
          <div className={styles.modalContent}>
            <h3>⚠️ Delete All Data</h3>
            <p className={styles.warningText}>
              This will permanently delete ALL your conversations, learning history, and personalization settings. This action cannot be
              undone.
            </p>
            <p>Type "DELETE" to confirm:</p>
            <input
              type="text"
              className={styles.confirmInput}
              placeholder="Type DELETE to confirm"
              onChange={(e) => {
                if (e.target.value === 'DELETE') {
                  e.target.classList.add(styles.valid);
                } else {
                  e.target.classList.remove(styles.valid);
                }
              }}
            />
            <div className={styles.modalActions}>
              <button className={styles.cancelButton} onClick={cancelDelete}>
                Cancel
              </button>
              <button
                className={styles.confirmDeleteButton}
                onClick={(e) => {
                  const input = (e.target as HTMLElement).parentElement?.parentElement?.querySelector('input');
                  if (input?.value === 'DELETE') {
                    confirmDelete();
                  }
                }}
              >
                Delete Everything
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
