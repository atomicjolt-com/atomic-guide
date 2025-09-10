/**
 * @fileoverview Cross-Course Consent Manager component for privacy controls
 * 
 * Provides granular course-level data sharing controls, consent visualization
 * showing data flow between courses, bulk consent management for related
 * course sequences, and consent audit trail and history display.
 */

import React, { useState, useEffect, useCallback } from 'react';
import type { ReactElement } from 'react';
import {
  CrossCourseConsent,
  ConsentUpdateRequest,
  CourseId,
  StudentId
} from '../../features/cross-course-intelligence/shared/types';

// ============================================================================
// Component Props and State Interfaces
// ============================================================================

interface CrossCourseConsentManagerProps {
  studentId: StudentId;
  availableCourses: CourseInfo[];
  onConsentChange?: (consents: CrossCourseConsent[]) => void;
  onAuditView?: (consent: CrossCourseConsent) => void;
  className?: string;
}

interface CourseInfo {
  id: CourseId;
  name: string;
  code: string;
  instructor: string;
  semester: string;
  isActive: boolean;
}

interface ConsentMatrix {
  [sourceCourse: string]: {
    [targetCourse: string]: CrossCourseConsent | null;
  };
}

interface ComponentState {
  consents: CrossCourseConsent[];
  consentMatrix: ConsentMatrix;
  loading: boolean;
  saving: boolean;
  error: string | null;
  selectedConsentType: CrossCourseConsent['consentType'];
  bulkOperation: {
    active: boolean;
    selectedCourses: Set<string>;
    operation: 'grant' | 'revoke' | null;
  };
  showHistory: boolean;
  auditTrail: CrossCourseConsent[];
}

// ============================================================================
// Utility Functions
// ============================================================================

const consentTypeLabels: Record<CrossCourseConsent['consentType'], string> = {
  'performance_data': 'Performance Data',
  'behavioral_patterns': 'Behavioral Patterns',
  'learning_analytics': 'Learning Analytics',
  'all': 'All Data'
};

const consentTypeDescriptions: Record<CrossCourseConsent['consentType'], string> = {
  'performance_data': 'Grades, assignment scores, and quiz results',
  'behavioral_patterns': 'Study habits, engagement patterns, and learning behaviors',
  'learning_analytics': 'Progress tracking, learning velocity, and struggle detection',
  'all': 'All available learning and performance data'
};

const getConsentStatus = (consent: CrossCourseConsent | null): 'granted' | 'denied' | 'expired' | 'withdrawn' => {
  if (!consent) return 'denied';
  if (consent.withdrawnAt) return 'withdrawn';
  if (consent.expirationDate && new Date(consent.expirationDate) < new Date()) return 'expired';
  return consent.consentGranted ? 'granted' : 'denied';
};

const getStatusColor = (status: 'granted' | 'denied' | 'expired' | 'withdrawn'): string => {
  switch (status) {
    case 'granted': return 'text-green-600 bg-green-50';
    case 'denied': return 'text-red-600 bg-red-50';
    case 'expired': return 'text-orange-600 bg-orange-50';
    case 'withdrawn': return 'text-gray-600 bg-gray-50';
  }
};

// ============================================================================
// Main Component
// ============================================================================

/**
 * Cross-Course Consent Manager
 * 
 * Manages student privacy preferences for cross-course data sharing
 * with granular controls and audit capabilities.
 */
export default function CrossCourseConsentManager({
  studentId,
  availableCourses,
  onConsentChange,
  onAuditView,
  className = ''
}: CrossCourseConsentManagerProps): ReactElement {
  const [state, setState] = useState<ComponentState>({
    consents: [],
    consentMatrix: {},
    loading: true,
    saving: false,
    error: null,
    selectedConsentType: 'all',
    bulkOperation: {
      active: false,
      selectedCourses: new Set(),
      operation: null
    },
    showHistory: false,
    auditTrail: []
  });

  // ========================================================================
  // Data Fetching and State Management
  // ========================================================================

  const fetchConsents = useCallback(async (): Promise<void> => {
    try {
      setState(prev => ({ ...prev, loading: true, error: null }));

      const response = await fetch(`/api/cross-course/consent/${studentId}`, {
        headers: {
          'Authorization': `Bearer ${window.LAUNCH_SETTINGS?.jwt || ''}`
        }
      });

      if (!response.ok) {
        throw new Error('Failed to fetch consent data');
      }

      const consents = await response.json() as CrossCourseConsent[];
      const consentMatrix = buildConsentMatrix(consents, availableCourses);

      setState(prev => ({
        ...prev,
        consents,
        consentMatrix,
        loading: false
      }));

      onConsentChange?.(consents);
    } catch (error) {
      setState(prev => ({
        ...prev,
        loading: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      }));
    }
  }, [studentId, availableCourses, onConsentChange]);

  const fetchAuditTrail = useCallback(async (): Promise<void> => {
    try {
      const response = await fetch(`/api/cross-course/consent/${studentId}/audit`, {
        headers: {
          'Authorization': `Bearer ${window.LAUNCH_SETTINGS?.jwt || ''}`
        }
      });

      if (!response.ok) {
        throw new Error('Failed to fetch audit trail');
      }

      const auditTrail = await response.json() as CrossCourseConsent[];
      setState(prev => ({ ...prev, auditTrail }));
    } catch (error) {
      console.error('Failed to fetch audit trail:', error);
    }
  }, [studentId]);

  useEffect(() => {
    void fetchConsents();
  }, [fetchConsents]);

  useEffect(() => {
    if (state.showHistory) {
      void fetchAuditTrail();
    }
  }, [state.showHistory, fetchAuditTrail]);

  // ========================================================================
  // Utility Functions
  // ========================================================================

  const buildConsentMatrix = (consents: CrossCourseConsent[], courses: CourseInfo[]): ConsentMatrix => {
    const matrix: ConsentMatrix = {};

    // Initialize matrix
    courses.forEach(sourceCourse => {
      matrix[sourceCourse.id] = {};
      courses.forEach(targetCourse => {
        if (sourceCourse.id !== targetCourse.id) {
          matrix[sourceCourse.id][targetCourse.id] = null;
        }
      });
    });

    // Populate with existing consents
    consents.forEach(consent => {
      if (matrix[consent.sourceCourse] && matrix[consent.sourceCourse][consent.targetCourse] !== undefined) {
        matrix[consent.sourceCourse][consent.targetCourse] = consent;
      }
    });

    return matrix;
  };

  // ========================================================================
  // Event Handlers
  // ========================================================================

  const handleConsentToggle = useCallback(async (
    sourceCourse: string,
    targetCourse: string,
    consentType: CrossCourseConsent['consentType'],
    granted: boolean
  ): Promise<void> => {
    try {
      setState(prev => ({ ...prev, saving: true, error: null }));

      const request: ConsentUpdateRequest = {
        studentId,
        sourceCourse,
        targetCourse,
        consentType,
        consentGranted: granted
      };

      const response = await fetch('/api/cross-course/consent', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${window.LAUNCH_SETTINGS?.jwt || ''}`
        },
        body: JSON.stringify(request)
      });

      if (!response.ok) {
        throw new Error('Failed to update consent');
      }

      await fetchConsents(); // Refresh data
      setState(prev => ({ ...prev, saving: false }));
    } catch (error) {
      setState(prev => ({
        ...prev,
        saving: false,
        error: error instanceof Error ? error.message : 'Failed to update consent'
      }));
    }
  }, [studentId, fetchConsents]);

  const handleBulkOperationToggle = useCallback((): void => {
    setState(prev => ({
      ...prev,
      bulkOperation: {
        ...prev.bulkOperation,
        active: !prev.bulkOperation.active,
        selectedCourses: new Set(),
        operation: null
      }
    }));
  }, []);

  const handleCourseSelection = useCallback((courseId: string): void => {
    setState(prev => {
      const newSelected = new Set(prev.bulkOperation.selectedCourses);
      if (newSelected.has(courseId)) {
        newSelected.delete(courseId);
      } else {
        newSelected.add(courseId);
      }
      return {
        ...prev,
        bulkOperation: {
          ...prev.bulkOperation,
          selectedCourses: newSelected
        }
      };
    });
  }, []);

  const handleBulkOperation = useCallback(async (operation: 'grant' | 'revoke'): Promise<void> => {
    try {
      setState(prev => ({ ...prev, saving: true, error: null }));

      const promises: Promise<Response>[] = [];
      const selectedCourses = Array.from(state.bulkOperation.selectedCourses);

      // Create all combinations of selected courses
      for (let i = 0; i < selectedCourses.length; i++) {
        for (let j = 0; j < selectedCourses.length; j++) {
          if (i !== j) {
            const request: ConsentUpdateRequest = {
              studentId,
              sourceCourse: selectedCourses[i],
              targetCourse: selectedCourses[j],
              consentType: state.selectedConsentType,
              consentGranted: operation === 'grant'
            };

            promises.push(
              fetch('/api/cross-course/consent', {
                method: 'POST',
                headers: {
                  'Content-Type': 'application/json',
                  'Authorization': `Bearer ${window.LAUNCH_SETTINGS?.jwt || ''}`
                },
                body: JSON.stringify(request)
              })
            );
          }
        }
      }

      await Promise.all(promises);
      await fetchConsents();
      
      setState(prev => ({
        ...prev,
        saving: false,
        bulkOperation: {
          active: false,
          selectedCourses: new Set(),
          operation: null
        }
      }));
    } catch (error) {
      setState(prev => ({
        ...prev,
        saving: false,
        error: error instanceof Error ? error.message : 'Bulk operation failed'
      }));
    }
  }, [studentId, state.bulkOperation.selectedCourses, state.selectedConsentType, fetchConsents]);

  const handleAuditView = useCallback((consent: CrossCourseConsent): void => {
    onAuditView?.(consent);
  }, [onAuditView]);

  // ========================================================================
  // Render Functions
  // ========================================================================

  const renderHeader = (): ReactElement => (
    <div className="mb-6">
      <h2 className="text-2xl font-bold text-gray-900 mb-2">Cross-Course Data Sharing</h2>
      <p className="text-gray-600 mb-4">
        Control how your learning data is shared between courses to enable personalized insights.
      </p>
      
      <div className="flex items-center space-x-4">
        <select
          value={state.selectedConsentType}
          onChange={(e) => setState(prev => ({ 
            ...prev, 
            selectedConsentType: e.target.value as CrossCourseConsent['consentType'] 
          }))}
          className="px-3 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
        >
          {Object.entries(consentTypeLabels).map(([value, label]) => (
            <option key={value} value={value}>{label}</option>
          ))}
        </select>
        
        <button
          onClick={handleBulkOperationToggle}
          className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"
        >
          {state.bulkOperation.active ? 'Cancel Bulk' : 'Bulk Manage'}
        </button>
        
        <button
          onClick={() => setState(prev => ({ ...prev, showHistory: !prev.showHistory }))}
          className="px-4 py-2 bg-gray-600 text-white rounded-md hover:bg-gray-700"
        >
          {state.showHistory ? 'Hide History' : 'View History'}
        </button>
      </div>

      <div className="mt-3 text-sm text-gray-600">
        <strong>Current Data Type:</strong> {consentTypeDescriptions[state.selectedConsentType]}
      </div>
    </div>
  );

  const renderBulkOperations = (): ReactElement => {
    if (!state.bulkOperation.active) return <div />;

    return (
      <div className="mb-6 p-4 bg-blue-50 border border-blue-200 rounded-lg">
        <h3 className="font-semibold mb-3">Bulk Operations</h3>
        <p className="text-sm text-gray-600 mb-3">
          Select courses to apply bulk consent changes for {consentTypeLabels[state.selectedConsentType]}.
        </p>
        
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3 mb-4">
          {availableCourses.filter(c => c.isActive).map(course => (
            <label key={course.id} className="flex items-center space-x-2 cursor-pointer">
              <input
                type="checkbox"
                checked={state.bulkOperation.selectedCourses.has(course.id)}
                onChange={() => handleCourseSelection(course.id)}
                className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
              />
              <span className="text-sm">
                {course.code}
              </span>
            </label>
          ))}
        </div>

        {state.bulkOperation.selectedCourses.size > 1 && (
          <div className="flex space-x-3">
            <button
              onClick={() => handleBulkOperation('grant')}
              disabled={state.saving}
              className="px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 disabled:opacity-50"
            >
              Grant All
            </button>
            <button
              onClick={() => handleBulkOperation('revoke')}
              disabled={state.saving}
              className="px-4 py-2 bg-red-600 text-white rounded-md hover:bg-red-700 disabled:opacity-50"
            >
              Revoke All
            </button>
          </div>
        )}
      </div>
    );
  };

  const renderConsentMatrix = (): ReactElement => {
    const activeCourses = availableCourses.filter(c => c.isActive);

    return (
      <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
        <div className="p-4 bg-gray-50 border-b border-gray-200">
          <h3 className="font-semibold">Course Data Sharing Matrix</h3>
          <p className="text-sm text-gray-600 mt-1">
            Each cell shows if data from the row course can be used to enhance the column course.
          </p>
        </div>
        
        <div className="overflow-x-auto">
          <table className="min-w-full">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">
                  From → To
                </th>
                {activeCourses.map(course => (
                  <th key={course.id} className="px-2 py-2 text-center text-xs font-medium text-gray-500 uppercase">
                    {course.code}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {activeCourses.map(sourceCourse => (
                <tr key={sourceCourse.id}>
                  <td className="px-4 py-3 text-sm font-medium text-gray-900">
                    {sourceCourse.code}
                  </td>
                  {activeCourses.map(targetCourse => {
                    if (sourceCourse.id === targetCourse.id) {
                      return (
                        <td key={targetCourse.id} className="px-2 py-3 text-center">
                          <div className="w-8 h-8 bg-gray-100 rounded border-2 border-gray-300"></div>
                        </td>
                      );
                    }

                    const consent = state.consentMatrix[sourceCourse.id]?.[targetCourse.id];
                    const status = getConsentStatus(consent);
                    const isRelevantType = !consent || consent.consentType === state.selectedConsentType || consent.consentType === 'all';

                    return (
                      <td key={targetCourse.id} className="px-2 py-3 text-center">
                        <button
                          onClick={() => handleConsentToggle(
                            sourceCourse.id,
                            targetCourse.id,
                            state.selectedConsentType,
                            status !== 'granted'
                          )}
                          disabled={state.saving}
                          className={`w-8 h-8 rounded border-2 transition-colors ${
                            status === 'granted' && isRelevantType
                              ? 'bg-green-100 border-green-300 hover:bg-green-200'
                              : 'bg-gray-100 border-gray-300 hover:bg-gray-200'
                          } ${state.saving ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}`}
                          title={`${sourceCourse.code} → ${targetCourse.code}: ${status}`}
                        >
                          {status === 'granted' && isRelevantType && (
                            <span className="text-green-600 font-bold">✓</span>
                          )}
                        </button>
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    );
  };

  const renderHistory = (): ReactElement => {
    if (!state.showHistory) return <div />;

    return (
      <div className="mt-6 bg-white border border-gray-200 rounded-lg">
        <div className="p-4 bg-gray-50 border-b border-gray-200">
          <h3 className="font-semibold">Consent History & Audit Trail</h3>
        </div>
        
        <div className="max-h-96 overflow-y-auto">
          {state.auditTrail.length === 0 ? (
            <div className="p-4 text-center text-gray-500">
              No consent history available
            </div>
          ) : (
            <div className="divide-y divide-gray-200">
              {state.auditTrail.map((consent, index) => (
                <div
                  key={index}
                  className="p-4 hover:bg-gray-50 cursor-pointer"
                  onClick={() => handleAuditView(consent)}
                >
                  <div className="flex justify-between items-start">
                    <div>
                      <div className="text-sm font-medium">
                        {consent.sourceCourse} → {consent.targetCourse}
                      </div>
                      <div className="text-sm text-gray-600">
                        {consentTypeLabels[consent.consentType]}
                      </div>
                    </div>
                    <div className="text-right">
                      <div className={`inline-flex px-2 py-1 rounded-full text-xs ${getStatusColor(getConsentStatus(consent))}`}>
                        {getConsentStatus(consent)}
                      </div>
                      <div className="text-xs text-gray-500 mt-1">
                        {new Date(consent.consentDate).toLocaleDateString()}
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    );
  };

  // ========================================================================
  // Main Render
  // ========================================================================

  if (state.loading) {
    return (
      <div className={`flex justify-center items-center py-12 ${className}`}>
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div className={`max-w-6xl mx-auto p-6 ${className}`}>
      {renderHeader()}
      {renderBulkOperations()}
      {renderConsentMatrix()}
      {renderHistory()}
      
      {state.error && (
        <div className="mt-4 p-4 bg-red-50 border border-red-200 rounded-lg">
          <h4 className="text-red-800 font-semibold">Error</h4>
          <p className="text-red-700">{state.error}</p>
          <button
            onClick={() => setState(prev => ({ ...prev, error: null }))}
            className="mt-2 text-red-600 hover:text-red-800 underline"
          >
            Dismiss
          </button>
        </div>
      )}
    </div>
  );
}