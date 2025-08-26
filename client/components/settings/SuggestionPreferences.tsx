/**
 * SuggestionPreferences Component
 * User interface for managing proactive suggestion settings and preferences
 */

import React, { useState, useEffect } from 'react';

export interface SuggestionPreferencesData {
  frequency: 'high' | 'medium' | 'low' | 'off';
  patternTrackingEnabled: boolean;
  preferredSuggestionTypes: string[];
  interruptionThreshold: number;
  escalationConsent: boolean;
  cooldownMinutes: number;
}

export interface SuggestionPreferencesProps {
  initialPreferences?: SuggestionPreferencesData;
  onSave: (preferences: SuggestionPreferencesData) => Promise<void>;
  onCancel?: () => void;
  className?: string;
}

const DEFAULT_PREFERENCES: SuggestionPreferencesData = {
  frequency: 'medium',
  patternTrackingEnabled: true,
  preferredSuggestionTypes: ['confusion', 'frustration', 'success_opportunity'],
  interruptionThreshold: 0.7,
  escalationConsent: false,
  cooldownMinutes: 2
};

const SUGGESTION_TYPES = [
  {
    id: 'confusion',
    label: 'Confusion Detection',
    description: 'Get help when you seem confused about concepts',
    icon: '🤔'
  },
  {
    id: 'frustration',
    label: 'Frustration Support',
    description: 'Receive encouragement when you\'re struggling',
    icon: '😤'
  },
  {
    id: 'repetition',
    label: 'Repetition Patterns',
    description: 'Get suggestions when asking similar questions',
    icon: '🔁'
  },
  {
    id: 'engagement_decline',
    label: 'Engagement Boost',
    description: 'Suggestions when your focus starts to wane',
    icon: '⚡'
  },
  {
    id: 'success_opportunity',
    label: 'Growth Opportunities',
    description: 'Suggestions for next steps when you\'re doing well',
    icon: '🌟'
  }
];

export const SuggestionPreferences: React.FC<SuggestionPreferencesProps> = ({
  initialPreferences,
  onSave,
  onCancel,
  className = ''
}) => {
  const [preferences, setPreferences] = useState<SuggestionPreferencesData>(
    initialPreferences || DEFAULT_PREFERENCES
  );
  const [isSaving, setIsSaving] = useState(false);
  const [hasChanges, setHasChanges] = useState(false);
  const [expandedSection, setExpandedSection] = useState<string | null>(null);

  useEffect(() => {
    if (initialPreferences) {
      setPreferences(initialPreferences);
    }
  }, [initialPreferences]);

  useEffect(() => {
    const isChanged = JSON.stringify(preferences) !== JSON.stringify(initialPreferences || DEFAULT_PREFERENCES);
    setHasChanges(isChanged);
  }, [preferences, initialPreferences]);

  const handleFrequencyChange = (frequency: SuggestionPreferences['frequency']) => {
    setPreferences(prev => ({ ...prev, frequency }));
  };

  const handlePatternTrackingToggle = (enabled: boolean) => {
    setPreferences(prev => ({ 
      ...prev, 
      patternTrackingEnabled: enabled,
      // If disabling pattern tracking, also disable escalation
      escalationConsent: enabled ? prev.escalationConsent : false
    }));
  };

  const handleSuggestionTypeToggle = (type: string, enabled: boolean) => {
    setPreferences(prev => ({
      ...prev,
      preferredSuggestionTypes: enabled
        ? [...prev.preferredSuggestionTypes, type]
        : prev.preferredSuggestionTypes.filter(t => t !== type)
    }));
  };

  const handleInterruptionThresholdChange = (threshold: number) => {
    setPreferences(prev => ({ ...prev, interruptionThreshold: threshold }));
  };

  const handleEscalationConsentChange = (consent: boolean) => {
    setPreferences(prev => ({ ...prev, escalationConsent: consent }));
  };

  const handleCooldownChange = (minutes: number) => {
    setPreferences(prev => ({ ...prev, cooldownMinutes: minutes }));
  };

  const handleSave = async() => {
    setIsSaving(true);
    try {
      await onSave(preferences);
      setHasChanges(false);
    } catch (error) {
      console.error('Error saving preferences:', error);
      // You might want to show an error message to the user
    } finally {
      setIsSaving(false);
    }
  };

  const handleReset = () => {
    setPreferences(DEFAULT_PREFERENCES);
  };

  const toggleSection = (section: string) => {
    setExpandedSection(expandedSection === section ? null : section);
  };

  const getFrequencyDescription = (frequency: string) => {
    const descriptions = {
      high: 'Suggestions appear frequently to maximize learning support',
      medium: 'Balanced approach with helpful suggestions at key moments',
      low: 'Minimal suggestions, only for significant learning difficulties',
      off: 'No proactive suggestions (you can still ask for help manually)'
    };
    return descriptions[frequency as keyof typeof descriptions];
  };

  const getInterruptionLabel = (threshold: number) => {
    if (threshold <= 0.3) return 'Always suggest (may interrupt)';
    if (threshold <= 0.5) return 'Moderate interruption tolerance';
    if (threshold <= 0.7) return 'Respect focus time';
    return 'Minimal interruptions only';
  };

  return (
    <div className={`suggestion-preferences ${className} max-w-2xl mx-auto p-6 bg-white dark:bg-gray-900 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700`}>
      <div className="mb-6">
        <h2 className="text-2xl font-semibold text-gray-900 dark:text-white mb-2">
          Learning Suggestions
        </h2>
        <p className="text-gray-600 dark:text-gray-300 text-sm">
          Customize how the AI provides proactive learning support based on your preferences and patterns.
        </p>
      </div>

      {/* Master Enable/Disable */}
      <div className="mb-8 p-4 bg-yellow-50 dark:bg-yellow-900/20 rounded-lg border border-yellow-200 dark:border-yellow-800">
        <div className="flex items-center justify-between mb-3">
          <div>
            <h3 className="font-semibold text-gray-900 dark:text-white">
              Enable Proactive Suggestions
            </h3>
            <p className="text-sm text-gray-600 dark:text-gray-300">
              Allow the AI to analyze your learning patterns and offer helpful suggestions
            </p>
          </div>
          <label className="relative inline-flex items-center cursor-pointer">
            <input
              type="checkbox"
              className="sr-only peer"
              checked={preferences.patternTrackingEnabled}
              onChange={(e) => handlePatternTrackingToggle(e.target.checked)}
            />
            <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-yellow-300 dark:peer-focus:ring-yellow-800 rounded-full peer dark:bg-gray-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all dark:border-gray-600 peer-checked:bg-yellow-600"></div>
          </label>
        </div>
      </div>

      {/* Frequency Settings */}
      <div className="mb-6">
        <button
          onClick={() => toggleSection('frequency')}
          className="w-full flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-800 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
          disabled={!preferences.patternTrackingEnabled}
        >
          <div className="flex items-center space-x-3">
            <span className="text-lg">📊</span>
            <div className="text-left">
              <h3 className="font-medium text-gray-900 dark:text-white">Suggestion Frequency</h3>
              <p className="text-sm text-gray-500 dark:text-gray-400 capitalize">
                Currently: {preferences.frequency}
              </p>
            </div>
          </div>
          <span className="text-gray-400">
            {expandedSection === 'frequency' ? '▼' : '▶'}
          </span>
        </button>

        {expandedSection === 'frequency' && preferences.patternTrackingEnabled && (
          <div className="mt-3 p-4 border border-gray-200 dark:border-gray-700 rounded-lg">
            <div className="space-y-3">
              {(['high', 'medium', 'low', 'off'] as const).map(frequency => (
                <label key={frequency} className="flex items-start space-x-3 cursor-pointer">
                  <input
                    type="radio"
                    name="frequency"
                    value={frequency}
                    checked={preferences.frequency === frequency}
                    onChange={() => handleFrequencyChange(frequency)}
                    className="mt-1 w-4 h-4 text-yellow-600 bg-gray-100 border-gray-300 focus:ring-yellow-500 dark:focus:ring-yellow-600 dark:ring-offset-gray-800 focus:ring-2 dark:bg-gray-700 dark:border-gray-600"
                  />
                  <div className="flex-1">
                    <span className="font-medium text-gray-900 dark:text-white capitalize">
                      {frequency}
                    </span>
                    <p className="text-sm text-gray-600 dark:text-gray-300 mt-1">
                      {getFrequencyDescription(frequency)}
                    </p>
                  </div>
                </label>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Suggestion Types */}
      <div className="mb-6">
        <button
          onClick={() => toggleSection('types')}
          className="w-full flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-800 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
          disabled={!preferences.patternTrackingEnabled}
        >
          <div className="flex items-center space-x-3">
            <span className="text-lg">🎯</span>
            <div className="text-left">
              <h3 className="font-medium text-gray-900 dark:text-white">Suggestion Types</h3>
              <p className="text-sm text-gray-500 dark:text-gray-400">
                {preferences.preferredSuggestionTypes.length} of {SUGGESTION_TYPES.length} enabled
              </p>
            </div>
          </div>
          <span className="text-gray-400">
            {expandedSection === 'types' ? '▼' : '▶'}
          </span>
        </button>

        {expandedSection === 'types' && preferences.patternTrackingEnabled && (
          <div className="mt-3 p-4 border border-gray-200 dark:border-gray-700 rounded-lg">
            <div className="space-y-4">
              {SUGGESTION_TYPES.map(type => (
                <label key={type.id} className="flex items-start space-x-3 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={preferences.preferredSuggestionTypes.includes(type.id)}
                    onChange={(e) => handleSuggestionTypeToggle(type.id, e.target.checked)}
                    className="mt-1 w-4 h-4 text-yellow-600 bg-gray-100 border-gray-300 rounded focus:ring-yellow-500 dark:focus:ring-yellow-600 dark:ring-offset-gray-800 focus:ring-2 dark:bg-gray-700 dark:border-gray-600"
                  />
                  <div className="flex-1">
                    <div className="flex items-center space-x-2">
                      <span className="text-lg" role="img" aria-hidden="true">{type.icon}</span>
                      <span className="font-medium text-gray-900 dark:text-white">
                        {type.label}
                      </span>
                    </div>
                    <p className="text-sm text-gray-600 dark:text-gray-300 mt-1">
                      {type.description}
                    </p>
                  </div>
                </label>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Advanced Settings */}
      <div className="mb-6">
        <button
          onClick={() => toggleSection('advanced')}
          className="w-full flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-800 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
          disabled={!preferences.patternTrackingEnabled}
        >
          <div className="flex items-center space-x-3">
            <span className="text-lg">⚙️</span>
            <div className="text-left">
              <h3 className="font-medium text-gray-900 dark:text-white">Advanced Settings</h3>
              <p className="text-sm text-gray-500 dark:text-gray-400">
                Timing and interruption preferences
              </p>
            </div>
          </div>
          <span className="text-gray-400">
            {expandedSection === 'advanced' ? '▼' : '▶'}
          </span>
        </button>

        {expandedSection === 'advanced' && preferences.patternTrackingEnabled && (
          <div className="mt-3 p-4 border border-gray-200 dark:border-gray-700 rounded-lg space-y-6">
            {/* Interruption Threshold */}
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Focus Respect Level
              </label>
              <input
                type="range"
                min="0"
                max="1"
                step="0.1"
                value={preferences.interruptionThreshold}
                onChange={(e) => handleInterruptionThresholdChange(parseFloat(e.target.value))}
                className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer dark:bg-gray-700 slider"
              />
              <div className="flex justify-between text-xs text-gray-500 dark:text-gray-400 mt-1">
                <span>Always suggest</span>
                <span>Respect focus</span>
              </div>
              <p className="text-sm text-gray-600 dark:text-gray-300 mt-1">
                {getInterruptionLabel(preferences.interruptionThreshold)}
              </p>
            </div>

            {/* Cooldown Period */}
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Minimum Time Between Suggestions
              </label>
              <select
                value={preferences.cooldownMinutes}
                onChange={(e) => handleCooldownChange(parseInt(e.target.value))}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:ring-2 focus:ring-yellow-500 dark:focus:ring-yellow-600"
              >
                <option value={1}>1 minute</option>
                <option value={2}>2 minutes</option>
                <option value={3}>3 minutes</option>
                <option value={5}>5 minutes</option>
                <option value={10}>10 minutes</option>
              </select>
            </div>

            {/* Escalation Consent */}
            <div className="flex items-start space-x-3">
              <input
                type="checkbox"
                id="escalation-consent"
                checked={preferences.escalationConsent}
                onChange={(e) => handleEscalationConsentChange(e.target.checked)}
                className="mt-1 w-4 h-4 text-yellow-600 bg-gray-100 border-gray-300 rounded focus:ring-yellow-500 dark:focus:ring-yellow-600 dark:ring-offset-gray-800 focus:ring-2 dark:bg-gray-700 dark:border-gray-600"
              />
              <div className="flex-1">
                <label htmlFor="escalation-consent" className="cursor-pointer font-medium text-gray-900 dark:text-white">
                  Allow Academic Support Notifications
                </label>
                <p className="text-sm text-gray-600 dark:text-gray-300 mt-1">
                  If you're struggling significantly, allow the system to notify your instructor so they can offer additional support. Your privacy is protected.
                </p>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Action Buttons */}
      <div className="flex items-center justify-between pt-4 border-t border-gray-200 dark:border-gray-700">
        <button
          onClick={handleReset}
          className="px-4 py-2 text-sm text-gray-600 dark:text-gray-400 hover:text-gray-800 dark:hover:text-gray-200 transition-colors"
          disabled={isSaving}
        >
          Reset to Defaults
        </button>
        
        <div className="flex space-x-3">
          {onCancel && (
            <button
              onClick={onCancel}
              className="px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 rounded-lg transition-colors"
              disabled={isSaving}
            >
              Cancel
            </button>
          )}
          <button
            onClick={handleSave}
            disabled={!hasChanges || isSaving || !preferences.patternTrackingEnabled}
            className={`
              px-6 py-2 text-sm font-medium rounded-lg transition-colors
              ${hasChanges && !isSaving && preferences.patternTrackingEnabled
                ? 'bg-yellow-600 hover:bg-yellow-700 text-white' 
                : 'bg-gray-300 dark:bg-gray-600 text-gray-500 dark:text-gray-400 cursor-not-allowed'
              }
            `}
          >
            {isSaving ? 'Saving...' : 'Save Preferences'}
          </button>
        </div>
      </div>

      {/* Status Message */}
      {!preferences.patternTrackingEnabled && (
        <div className="mt-4 p-3 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg">
          <p className="text-sm text-blue-700 dark:text-blue-300">
            💡 Proactive suggestions are disabled. You can still ask for help manually in the chat.
          </p>
        </div>
      )}
    </div>
  );
};

export default SuggestionPreferences;