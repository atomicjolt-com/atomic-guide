/**
 * @fileoverview Data export interface component with comprehensive filtering and security for Story 3.4
 * @module features/dashboard/client/components/DataExportInterface
 */

import React, { useState, useMemo } from 'react';
import { z } from 'zod';
import styles from '../../styles/components/data-export-interface.module.css';

/**
 * Schema for export configuration
 */
const _ExportConfigSchema = z.object({
  dateRange: z.object({
    start: z.string().datetime(),
    end: z.string().datetime(),
  }),
  dataTypes: z.object({
    assessments: z.boolean(),
    analytics: z.boolean(),
    benchmarks: z.boolean(),
    interactions: z.boolean(),
  }),
  formats: z.array(z.enum(['csv', 'json', 'xapi'])),
  includeMetadata: z.boolean(),
  purpose: z.string().min(1),
});

type ExportConfig = z.infer<typeof _ExportConfigSchema>;

/**
 * Schema for export status from API
 */
const ExportStatusSchema = z.object({
  exportId: z.string(),
  status: z.enum(['preparing', 'processing', 'ready', 'failed', 'expired']),
  progress: z.number().min(0).max(100),
  estimatedCompletion: z.string().datetime().optional(),
  downloadUrl: z.string().url().optional(),
  fileSize: z.number().optional(),
  recordCount: z.number().int(),
  createdAt: z.string().datetime(),
  expiresAt: z.string().datetime(),
  errorMessage: z.string().optional(),
});

type ExportStatus = z.infer<typeof ExportStatusSchema>;

/**
 * Schema for data preview
 */
const DataPreviewSchema = z.object({
  sampleData: z.array(z.record(z.unknown())),
  totalRecords: z.number().int(),
  estimatedSize: z.string(),
  dataTypes: z.array(z.string()),
  dateRange: z.object({
    earliest: z.string().datetime(),
    latest: z.string().datetime(),
  }),
});

type DataPreview = z.infer<typeof DataPreviewSchema>;

interface DataExportInterfaceProps {
  userId: string;
  courseId: string;
  jwt: string;
  onExportComplete?: (exportId: string) => void;
}

/**
 * Data export interface component providing comprehensive data export capabilities
 * 
 * Features:
 * - Granular data type selection with preview
 * - Multiple export formats (CSV, JSON, xAPI)
 * - Date range filtering with presets
 * - Real-time export progress tracking
 * - Security compliance with audit trail
 * - Mobile-optimized responsive design
 * - FERPA-compliant data handling
 */
export default function DataExportInterface({
  userId,
  courseId,
  jwt,
  onExportComplete
}: DataExportInterfaceProps): React.ReactElement {
  const [currentStep, setCurrentStep] = useState<'configure' | 'preview' | 'generate'>('configure');
  const [exportConfig, setExportConfig] = useState<ExportConfig>({
    dateRange: {
      start: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString(), // 30 days ago
      end: new Date().toISOString(),
    },
    dataTypes: {
      assessments: true,
      analytics: true,
      benchmarks: false,
      interactions: false,
    },
    formats: ['csv'],
    includeMetadata: true,
    purpose: '',
  });
  
  const [dataPreview, setDataPreview] = useState<DataPreview | null>(null);
  const [exportStatus, setExportStatus] = useState<ExportStatus | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [agreedToTerms, setAgreedToTerms] = useState(false);

  // Date range presets
  const datePresets = useMemo(() => [
    {
      label: 'Last 7 days',
      value: 'week',
      start: () => new Date(Date.now() - 7 * 24 * 60 * 60 * 1000),
      end: () => new Date(),
    },
    {
      label: 'Last 30 days',
      value: 'month',
      start: () => new Date(Date.now() - 30 * 24 * 60 * 60 * 1000),
      end: () => new Date(),
    },
    {
      label: 'This semester',
      value: 'semester',
      start: () => new Date(Date.now() - 120 * 24 * 60 * 60 * 1000),
      end: () => new Date(),
    },
    {
      label: 'All time',
      value: 'all',
      start: () => new Date(Date.now() - 365 * 24 * 60 * 60 * 1000),
      end: () => new Date(),
    },
  ], []);

  // Data type options
  const dataTypeOptions = useMemo(() => [
    {
      key: 'assessments' as const,
      label: 'Assessment Results',
      description: 'Quiz scores, attempts, and response data',
      icon: '📝',
    },
    {
      key: 'analytics' as const,
      label: 'Performance Analytics',
      description: 'Mastery levels, learning progress, and insights',
      icon: '📊',
    },
    {
      key: 'benchmarks' as const,
      label: 'Peer Comparisons',
      description: 'Anonymous performance benchmarks (if opted in)',
      icon: '📈',
    },
    {
      key: 'interactions' as const,
      label: 'Learning Interactions',
      description: 'Chat conversations, help requests, and engagement data',
      icon: '💬',
    },
  ], []);

  // Export format options
  const formatOptions = useMemo(() => [
    {
      value: 'csv',
      label: 'CSV (Spreadsheet)',
      description: 'Comma-separated values for Excel/Google Sheets',
      recommended: true,
    },
    {
      value: 'json',
      label: 'JSON (Structured)',
      description: 'Machine-readable format for developers',
      recommended: false,
    },
    {
      value: 'xapi',
      label: 'xAPI (Learning Records)',
      description: 'Educational standard for portfolio integration',
      recommended: false,
    },
  ], []);

  // Purpose options for audit trail
  const purposeOptions = useMemo(() => [
    'Academic portfolio development',
    'Transferring to another institution',
    'Personal record keeping',
    'Sharing with academic advisor',
    'Educational research (with permission)',
    'Other (please specify)',
  ], []);

  // Handle date preset selection
  const handleDatePreset = (presetValue: string): void => {
    const preset = datePresets.find(p => p.value === presetValue);
    if (preset) {
      setExportConfig(prev => ({
        ...prev,
        dateRange: {
          start: preset.start().toISOString(),
          end: preset.end().toISOString(),
        },
      }));
    }
  };

  // Handle data type toggle
  const handleDataTypeToggle = (dataType: keyof ExportConfig['dataTypes']): void => {
    setExportConfig(prev => ({
      ...prev,
      dataTypes: {
        ...prev.dataTypes,
        [dataType]: !prev.dataTypes[dataType],
      },
    }));
  };

  // Handle format toggle
  const handleFormatToggle = (format: 'csv' | 'json' | 'xapi'): void => {
    setExportConfig(prev => ({
      ...prev,
      formats: prev.formats.includes(format)
        ? prev.formats.filter(f => f !== format)
        : [...prev.formats, format],
    }));
  };

  // Generate data preview
  const generatePreview = async (): Promise<void> => {
    try {
      setLoading(true);
      setError(null);

      const response = await fetch('/api/analytics/export/preview', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${jwt}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          userId,
          courseId,
          exportConfig,
        }),
      });

      if (!response.ok) {
        throw new Error(`Failed to generate preview: ${response.statusText}`);
      }

      const data = await response.json();
      if (!data.success) {
        throw new Error(data.error || 'Failed to generate preview');
      }

      const preview = DataPreviewSchema.parse(data.data);
      setDataPreview(preview);
      setCurrentStep('preview');

    } catch (err) {
      console.error('Preview generation error:', err);
      setError(err instanceof Error ? err.message : 'Failed to generate preview');
    } finally {
      setLoading(false);
    }
  };

  // Start export generation
  const startExport = async (): Promise<void> => {
    try {
      setLoading(true);
      setError(null);

      const response = await fetch('/api/analytics/export/generate', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${jwt}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          userId,
          courseId,
          exportConfig,
          termsAccepted: agreedToTerms,
        }),
      });

      if (!response.ok) {
        throw new Error(`Failed to start export: ${response.statusText}`);
      }

      const data = await response.json();
      if (!data.success) {
        throw new Error(data.error || 'Failed to start export');
      }

      const status = ExportStatusSchema.parse(data.data);
      setExportStatus(status);
      setCurrentStep('generate');

      // Start polling for status updates
      pollExportStatus(status.exportId);

    } catch (err) {
      console.error('Export generation error:', err);
      setError(err instanceof Error ? err.message : 'Failed to start export');
    } finally {
      setLoading(false);
    }
  };

  // Poll export status
  const pollExportStatus = async (exportId: string): Promise<void> => {
    try {
      const response = await fetch(`/api/analytics/export/status/${exportId}`, {
        headers: {
          'Authorization': `Bearer ${jwt}`,
        },
      });

      if (response.ok) {
        const data = await response.json();
        if (data.success) {
          const status = ExportStatusSchema.parse(data.data);
          setExportStatus(status);

          if (status.status === 'ready') {
            onExportComplete?.(exportId);
          } else if (status.status === 'processing' || status.status === 'preparing') {
            // Continue polling
            setTimeout(() => pollExportStatus(exportId), 2000);
          }
        }
      }
    } catch (err) {
      console.error('Status polling error:', err);
    }
  };

  // Render configuration step
  const renderConfigurationStep = (): React.ReactElement => (
    <div className={styles.configurationStep}>
      {/* Date Range Selection */}
      <section className={styles.configSection}>
        <h3>Select Time Period</h3>
        <div className={styles.presetButtons}>
          {datePresets.map(preset => (
            <button
              key={preset.value}
              type="button"
              className={styles.presetBtn}
              onClick={() => handleDatePreset(preset.value)}
            >
              {preset.label}
            </button>
          ))}
        </div>
        
        <div className={styles.customDateInputs}>
          <div className={styles.dateInput}>
            <label htmlFor="startDate">Start Date</label>
            <input
              id="startDate"
              type="date"
              value={exportConfig.dateRange.start.split('T')[0]}
              onChange={(e) => setExportConfig(prev => ({
                ...prev,
                dateRange: {
                  ...prev.dateRange,
                  start: new Date(e.target.value).toISOString(),
                },
              }))}
              className={styles.dateField}
            />
          </div>
          <div className={styles.dateInput}>
            <label htmlFor="endDate">End Date</label>
            <input
              id="endDate"
              type="date"
              value={exportConfig.dateRange.end.split('T')[0]}
              onChange={(e) => setExportConfig(prev => ({
                ...prev,
                dateRange: {
                  ...prev.dateRange,
                  end: new Date(e.target.value).toISOString(),
                },
              }))}
              className={styles.dateField}
            />
          </div>
        </div>
      </section>

      {/* Data Type Selection */}
      <section className={styles.configSection}>
        <h3>Choose Data Types</h3>
        <div className={styles.dataTypeGrid}>
          {dataTypeOptions.map(option => (
            <label key={option.key} className={styles.dataTypeOption}>
              <input
                type="checkbox"
                checked={exportConfig.dataTypes[option.key]}
                onChange={() => handleDataTypeToggle(option.key)}
                className={styles.dataTypeCheckbox}
              />
              <div className={styles.optionContent}>
                <div className={styles.optionHeader}>
                  <span className={styles.optionIcon}>{option.icon}</span>
                  <strong>{option.label}</strong>
                </div>
                <p className={styles.optionDescription}>{option.description}</p>
              </div>
            </label>
          ))}
        </div>
      </section>

      {/* Format Selection */}
      <section className={styles.configSection}>
        <h3>Export Format</h3>
        <div className={styles.formatOptions}>
          {formatOptions.map(format => (
            <label key={format.value} className={styles.formatOption}>
              <input
                type="checkbox"
                checked={exportConfig.formats.includes(format.value as any)}
                onChange={() => handleFormatToggle(format.value as any)}
                className={styles.formatCheckbox}
              />
              <div className={styles.optionContent}>
                <div className={styles.optionHeader}>
                  <strong>{format.label}</strong>
                  {format.recommended && (
                    <span className={styles.recommendedBadge}>Recommended</span>
                  )}
                </div>
                <p className={styles.optionDescription}>{format.description}</p>
              </div>
            </label>
          ))}
        </div>
      </section>

      {/* Purpose Selection */}
      <section className={styles.configSection}>
        <h3>Purpose of Export</h3>
        <select
          value={exportConfig.purpose}
          onChange={(e) => setExportConfig(prev => ({
            ...prev,
            purpose: e.target.value,
          }))}
          className={styles.purposeSelect}
          required
        >
          <option value="">Select purpose...</option>
          {purposeOptions.map(purpose => (
            <option key={purpose} value={purpose}>{purpose}</option>
          ))}
        </select>
      </section>

      {/* Additional Options */}
      <section className={styles.configSection}>
        <label className={styles.metadataOption}>
          <input
            type="checkbox"
            checked={exportConfig.includeMetadata}
            onChange={(e) => setExportConfig(prev => ({
              ...prev,
              includeMetadata: e.target.checked,
            }))}
            className={styles.metadataCheckbox}
          />
          <span>Include technical metadata (timestamps, IDs, etc.)</span>
        </label>
      </section>

      {/* Action Buttons */}
      <div className={styles.stepActions}>
        <button
          type="button"
          className={styles.previewBtn}
          onClick={generatePreview}
          disabled={loading || exportConfig.formats.length === 0 || !exportConfig.purpose}
        >
          {loading ? 'Generating Preview...' : 'Preview Data'}
        </button>
      </div>
    </div>
  );

  // Render preview step
  const renderPreviewStep = (): React.ReactElement => (
    <div className={styles.previewStep}>
      {dataPreview && (
        <>
          <div className={styles.previewHeader}>
            <h3>Export Preview</h3>
            <div className={styles.previewStats}>
              <span className={styles.recordCount}>
                {dataPreview.totalRecords.toLocaleString()} records
              </span>
              <span className={styles.estimatedSize}>
                ~{dataPreview.estimatedSize}
              </span>
            </div>
          </div>

          <div className={styles.previewContent}>
            <div className={styles.sampleHeader}>
              <h4>Sample Data (first 5 records)</h4>
              <div className={styles.dateRangeInfo}>
                <span>From: {new Date(dataPreview.dateRange.earliest).toLocaleDateString()}</span>
                <span>To: {new Date(dataPreview.dateRange.latest).toLocaleDateString()}</span>
              </div>
            </div>

            {dataPreview.sampleData.length > 0 ? (
              <div className={styles.sampleTable}>
                <table>
                  <thead>
                    <tr>
                      {Object.keys(dataPreview.sampleData[0] || {}).map(key => (
                        <th key={key}>{key}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {dataPreview.sampleData.slice(0, 5).map((row, index) => (
                      <tr key={index}>
                        {Object.values(row).map((value, cellIndex) => (
                          <td key={cellIndex}>
                            {typeof value === 'string' && value.length > 50
                              ? `${value.substring(0, 50)}...`
                              : String(value)}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <div className={styles.noDataMessage}>
                No data found for the selected criteria. Try adjusting your filters.
              </div>
            )}
          </div>

          {/* Privacy Notice */}
          <div className={styles.privacyNotice}>
            <div className={styles.privacyIcon}>🛡️</div>
            <div className={styles.privacyContent}>
              <strong>Privacy Notice</strong>
              <p>
                This export contains only your personal learning data. 
                No peer comparison data will be included to protect privacy.
              </p>
            </div>
          </div>

          {/* Terms Agreement */}
          <div className={styles.termsAgreement}>
            <label className={styles.termsLabel}>
              <input
                type="checkbox"
                checked={agreedToTerms}
                onChange={(e) => setAgreedToTerms(e.target.checked)}
                className={styles.termsCheckbox}
                required
              />
              <div className={styles.termsText}>
                I understand that:
                <ul>
                  <li>This export contains my personal educational data</li>
                  <li>I am responsible for securing this data after download</li>
                  <li>The export file will expire and be deleted after 7 days</li>
                  <li>This activity will be logged for security purposes</li>
                </ul>
              </div>
            </label>
          </div>

          {/* Step Actions */}
          <div className={styles.stepActions}>
            <button
              type="button"
              className={styles.backBtn}
              onClick={() => setCurrentStep('configure')}
            >
              Back to Configuration
            </button>
            <button
              type="button"
              className={styles.generateBtn}
              onClick={startExport}
              disabled={!agreedToTerms || loading}
            >
              {loading ? 'Starting Export...' : 'Generate Export'}
            </button>
          </div>
        </>
      )}
    </div>
  );

  // Render generation step
  const renderGenerationStep = (): React.ReactElement => (
    <div className={styles.generationStep}>
      {exportStatus && (
        <>
          <div className={styles.generationHeader}>
            <h3>Generating Export</h3>
            <div className={styles.progressContainer}>
              <div className={styles.progressBar}>
                <div 
                  className={styles.progressFill}
                  style={{ width: `${exportStatus.progress}%` }}
                />
              </div>
              <span className={styles.progressText}>{exportStatus.progress}%</span>
            </div>
          </div>

          <div className={styles.generationStatus}>
            <div className={`${styles.statusItem} ${exportStatus.progress >= 25 ? styles.complete : styles.pending}`}>
              <span className={styles.statusIcon}>
                {exportStatus.progress >= 25 ? '✅' : '⏳'}
              </span>
              <span>Collecting data records</span>
            </div>
            <div className={`${styles.statusItem} ${exportStatus.progress >= 50 ? styles.complete : styles.pending}`}>
              <span className={styles.statusIcon}>
                {exportStatus.progress >= 50 ? '✅' : '⏳'}
              </span>
              <span>Applying privacy filters</span>
            </div>
            <div className={`${styles.statusItem} ${exportStatus.progress >= 75 ? styles.complete : styles.pending}`}>
              <span className={styles.statusIcon}>
                {exportStatus.progress >= 75 ? '✅' : '⏳'}
              </span>
              <span>Formatting export file</span>
            </div>
            <div className={`${styles.statusItem} ${exportStatus.progress >= 100 ? styles.complete : styles.pending}`}>
              <span className={styles.statusIcon}>
                {exportStatus.progress >= 100 ? '✅' : '⏳'}
              </span>
              <span>Preparing download</span>
            </div>
          </div>

          {exportStatus.status === 'ready' && exportStatus.downloadUrl && (
            <div className={styles.downloadReady}>
              <div className={styles.successAlert}>
                <span className={styles.successIcon}>✅</span>
                <div>
                  <strong>Export Ready!</strong>
                  <p>Your data export has been generated successfully.</p>
                </div>
              </div>

              <div className={styles.downloadActions}>
                <a
                  href={exportStatus.downloadUrl}
                  download
                  className={styles.downloadBtn}
                >
                  <span className={styles.downloadIcon}>⬇️</span>
                  Download Export
                </a>

                <div className={styles.downloadInfo}>
                  <p><strong>Records:</strong> {exportStatus.recordCount.toLocaleString()}</p>
                  {exportStatus.fileSize && (
                    <p><strong>Size:</strong> {(exportStatus.fileSize / 1024 / 1024).toFixed(2)} MB</p>
                  )}
                  <p><strong>Expires:</strong> {new Date(exportStatus.expiresAt).toLocaleDateString()}</p>
                </div>
              </div>
            </div>
          )}

          {exportStatus.status === 'failed' && (
            <div className={styles.errorAlert}>
              <span className={styles.errorIcon}>❌</span>
              <div>
                <strong>Export Failed</strong>
                <p>{exportStatus.errorMessage || 'An error occurred during export generation'}</p>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );

  if (error) {
    return (
      <div className={styles.dataExportInterface}>
        <div className={styles.error}>
          <h3>Export Error</h3>
          <p>{error}</p>
          <button 
            onClick={() => {
              setError(null);
              setCurrentStep('configure');
            }}
            className={styles.retryBtn}
          >
            Try Again
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className={styles.dataExportInterface}>
      <div className={styles.header}>
        <h2>Export Your Data</h2>
        <p className={styles.subtitle}>
          Download your personal learning data for portfolios, transfers, or record keeping
        </p>
      </div>

      {/* Progress Indicator */}
      <div className={styles.progressIndicator}>
        <div className={`${styles.step} ${currentStep === 'configure' ? styles.active : styles.completed}`}>
          <span className={styles.stepNumber}>1</span>
          <span className={styles.stepLabel}>Configure</span>
        </div>
        <div className={`${styles.step} ${currentStep === 'preview' ? styles.active : currentStep === 'generate' ? styles.completed : ''}`}>
          <span className={styles.stepNumber}>2</span>
          <span className={styles.stepLabel}>Preview</span>
        </div>
        <div className={`${styles.step} ${currentStep === 'generate' ? styles.active : ''}`}>
          <span className={styles.stepNumber}>3</span>
          <span className={styles.stepLabel}>Download</span>
        </div>
      </div>

      {/* Step Content */}
      {currentStep === 'configure' && renderConfigurationStep()}
      {currentStep === 'preview' && renderPreviewStep()}
      {currentStep === 'generate' && renderGenerationStep()}
    </div>
  );
}