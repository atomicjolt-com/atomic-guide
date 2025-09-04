import React, { useState, useEffect } from 'react';
import styles from './PrivacyControls.module.css';

export interface PrivacySettings {
  extractionEnabled: boolean;
  autoExtract: boolean;
  contentTypesAllowed: string[];
  retentionDays: number;
  anonymizeEngagement: boolean;
  requireStudentConsent: boolean;
}

export interface PrivacyControlsProps {
  courseId: string;
  onSettingsChange?: (settings: PrivacySettings) => void;
  isInstructor?: boolean;
  isStudent?: boolean;
}

export const PrivacyControls: React.FC<PrivacyControlsProps> = ({
  courseId,
  onSettingsChange,
  isInstructor = false,
  isStudent = false,
}) => {
  const [settings, setSettings] = useState<PrivacySettings>({
    extractionEnabled: false,
    autoExtract: false,
    contentTypesAllowed: ['assignment', 'page', 'module'],
    retentionDays: 90,
    anonymizeEngagement: true,
    requireStudentConsent: false,
  });

  const [studentConsent, setStudentConsent] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  useEffect(() => {
    fetchSettings();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [courseId]);

  const fetchSettings = async () => {
    try {
      const response = await fetch(`/api/content/settings?courseId=${courseId}`);
      if (response.ok) {
        const data = await response.json();
        setSettings(data);
      }
    } catch (error) {
      console.error('Failed to fetch privacy settings:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleSettingChange = (key: keyof PrivacySettings, value: any) => {
    const newSettings = { ...settings, [key]: value };
    setSettings(newSettings);
  };

  const handleContentTypeToggle = (type: string) => {
    const newTypes = settings.contentTypesAllowed.includes(type)
      ? settings.contentTypesAllowed.filter((t) => t !== type)
      : [...settings.contentTypesAllowed, type];

    handleSettingChange('contentTypesAllowed', newTypes);
  };

  const handleSave = async () => {
    setIsSaving(true);
    setMessage(null);

    try {
      const response = await fetch('/api/content/settings', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          ...settings,
          courseId,
        }),
      });

      if (response.ok) {
        setMessage({ type: 'success', text: 'Privacy settings saved successfully' });
        if (onSettingsChange) {
          onSettingsChange(settings);
        }
      } else {
        throw new Error('Failed to save settings');
      }
    } catch (error) {
      setMessage({ type: 'error', text: 'Failed to save privacy settings' });
      console.error('Save error:', error);
    } finally {
      setIsSaving(false);
      setTimeout(() => setMessage(null), 5000);
    }
  };

  const handleStudentConsent = async () => {
    try {
      const response = await fetch('/api/learner/content-consent', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          courseId,
          consent: studentConsent,
        }),
      });

      if (response.ok) {
        setMessage({ type: 'success', text: 'Your consent preference has been saved' });
      }
    } catch {
      setMessage({ type: 'error', text: 'Failed to save consent preference' });
    }
  };

  if (isLoading) {
    return (
      <div className={styles.container}>
        <div className={styles.loading}>Loading privacy settings...</div>
      </div>
    );
  }

  if (isStudent) {
    return (
      <div className={styles.container}>
        <div className={styles.header}>
          <h3 className={styles.title}>Content Analysis Privacy</h3>
          <p className={styles.subtitle}>Control how your learning content is analyzed to provide personalized assistance</p>
        </div>

        <div className={styles.studentConsent}>
          <div className={styles.consentInfo}>
            <h4>What data is collected?</h4>
            <ul className={styles.infoList}>
              <li>Content you're reading (assignments, pages, modules)</li>
              <li>Time spent on different sections</li>
              <li>Areas where you might need help (based on reading patterns)</li>
              <li>Questions you ask about the content</li>
            </ul>

            <h4>How is it used?</h4>
            <ul className={styles.infoList}>
              <li>To provide contextual help based on what you're reading</li>
              <li>To identify concepts you might be struggling with</li>
              <li>To suggest relevant resources and explanations</li>
              <li>To improve the learning assistance system</li>
            </ul>

            {settings.anonymizeEngagement && (
              <div className={styles.privacyNote}>
                <span className={styles.icon}>🔒</span>
                Your engagement data is anonymized before analysis
              </div>
            )}

            {settings.retentionDays && (
              <div className={styles.privacyNote}>
                <span className={styles.icon}>⏱️</span>
                Data is automatically deleted after {settings.retentionDays} days
              </div>
            )}
          </div>

          <div className={styles.consentControl}>
            <label className={styles.checkboxLabel}>
              <input type="checkbox" checked={studentConsent} onChange={(e) => setStudentConsent(e.target.checked)} />
              <span>I consent to content analysis for personalized learning assistance</span>
            </label>

            <button className={styles.saveButton} onClick={handleStudentConsent} disabled={isSaving}>
              {isSaving ? 'Saving...' : 'Save Preference'}
            </button>
          </div>
        </div>

        {message && <div className={`${styles.message} ${styles[message.type]}`}>{message.text}</div>}
      </div>
    );
  }

  if (isInstructor) {
    return (
      <div className={styles.container}>
        <div className={styles.header}>
          <h3 className={styles.title}>Content Extraction Privacy Settings</h3>
          <p className={styles.subtitle}>Configure how course content is extracted and analyzed for AI-powered assistance</p>
        </div>

        <div className={styles.settings}>
          <div className={styles.settingGroup}>
            <h4 className={styles.groupTitle}>Content Extraction</h4>

            <div className={styles.setting}>
              <label className={styles.toggleLabel}>
                <input
                  type="checkbox"
                  checked={settings.extractionEnabled}
                  onChange={(e) => handleSettingChange('extractionEnabled', e.target.checked)}
                />
                <span>Enable content extraction for this course</span>
              </label>
              <p className={styles.settingDescription}>
                Allow the system to extract and analyze course content for contextual AI assistance
              </p>
            </div>

            <div className={styles.setting}>
              <label className={styles.toggleLabel}>
                <input
                  type="checkbox"
                  checked={settings.autoExtract}
                  onChange={(e) => handleSettingChange('autoExtract', e.target.checked)}
                  disabled={!settings.extractionEnabled}
                />
                <span>Automatic extraction</span>
              </label>
              <p className={styles.settingDescription}>Automatically extract content when students access pages</p>
            </div>
          </div>

          <div className={styles.settingGroup}>
            <h4 className={styles.groupTitle}>Content Types</h4>
            <p className={styles.settingDescription}>Select which types of content can be extracted</p>

            <div className={styles.contentTypes}>
              {['assignment', 'page', 'module', 'discussion', 'quiz'].map((type) => (
                <label key={type} className={styles.checkboxLabel}>
                  <input
                    type="checkbox"
                    checked={settings.contentTypesAllowed.includes(type)}
                    onChange={() => handleContentTypeToggle(type)}
                    disabled={!settings.extractionEnabled}
                  />
                  <span>{type.charAt(0).toUpperCase() + type.slice(1)}s</span>
                </label>
              ))}
            </div>
          </div>

          <div className={styles.settingGroup}>
            <h4 className={styles.groupTitle}>Privacy & Retention</h4>

            <div className={styles.setting}>
              <label className={styles.fieldLabel}>
                Data retention period
                <input
                  type="number"
                  className={styles.numberInput}
                  value={settings.retentionDays}
                  onChange={(e) => handleSettingChange('retentionDays', parseInt(e.target.value))}
                  min="1"
                  max="365"
                />
                <span className={styles.unit}>days</span>
              </label>
              <p className={styles.settingDescription}>How long extracted content is stored before automatic deletion</p>
            </div>

            <div className={styles.setting}>
              <label className={styles.toggleLabel}>
                <input
                  type="checkbox"
                  checked={settings.anonymizeEngagement}
                  onChange={(e) => handleSettingChange('anonymizeEngagement', e.target.checked)}
                />
                <span>Anonymize student engagement data</span>
              </label>
              <p className={styles.settingDescription}>Remove personally identifiable information from engagement analytics</p>
            </div>

            <div className={styles.setting}>
              <label className={styles.toggleLabel}>
                <input
                  type="checkbox"
                  checked={settings.requireStudentConsent}
                  onChange={(e) => handleSettingChange('requireStudentConsent', e.target.checked)}
                />
                <span>Require explicit student consent</span>
              </label>
              <p className={styles.settingDescription}>Students must opt-in before their content interactions are analyzed</p>
            </div>
          </div>

          <div className={styles.actions}>
            <button className={styles.cancelButton} onClick={fetchSettings} disabled={isSaving}>
              Reset
            </button>

            <button className={styles.saveButton} onClick={handleSave} disabled={isSaving}>
              {isSaving ? (
                <>
                  <span className={styles.spinner} />
                  Saving...
                </>
              ) : (
                'Save Settings'
              )}
            </button>
          </div>
        </div>

        {message && <div className={`${styles.message} ${styles[message.type]}`}>{message.text}</div>}

        <div className={styles.privacyInfo}>
          <h4>Privacy Compliance</h4>
          <ul className={styles.infoList}>
            <li>All content extraction requires explicit instructor consent</li>
            <li>Student data is protected under FERPA guidelines</li>
            <li>Content is never shared outside your institution</li>
            <li>Students can opt-out at any time</li>
            <li>Audit logs track all content access and processing</li>
          </ul>
        </div>
      </div>
    );
  }

  return null;
};

export default PrivacyControls;
