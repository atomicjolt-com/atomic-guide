/**
 * @fileoverview Tests for DataExportInterface component
 * @module features/dashboard/client/components/__tests__/DataExportInterface.test
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import DataExportInterface from '../DataExportInterface';

// Mock fetch globally
const mockFetch = vi.fn();
global.fetch = mockFetch;

// Mock data
const mockPreviewData = {
  sampleData: [
    {
      'Assessment ID': 'quiz_001',
      'Score': 85,
      'Date': '2024-01-15',
      'Duration': '00:15:30',
    },
    {
      'Assessment ID': 'quiz_002',
      'Score': 92,
      'Date': '2024-01-16',
      'Duration': '00:12:45',
    },
  ],
  totalRecords: 25,
  estimatedSize: '2.5 MB',
  dataTypes: ['assessments', 'analytics'],
  dateRange: {
    earliest: '2024-01-01T00:00:00Z',
    latest: '2024-01-15T23:59:59Z',
  },
};

const mockExportStatus = {
  exportId: 'export_123',
  status: 'ready' as const,
  progress: 100,
  downloadUrl: 'https://example.com/download/export_123',
  fileSize: 2621440, // 2.5 MB in bytes
  recordCount: 25,
  createdAt: '2024-01-15T10:00:00Z',
  expiresAt: '2024-01-22T10:00:00Z',
};

const defaultProps = {
  userId: 'test-user-123',
  courseId: 'test-course-456',
  jwt: 'test-jwt-token',
};

describe('DataExportInterface', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('Configuration Step', () => {
    it('should render configuration form initially', () => {
      render(<DataExportInterface {...defaultProps} />);

      expect(screen.getByText('Export Your Data')).toBeInTheDocument();
      expect(screen.getByText('Select Time Period')).toBeInTheDocument();
      expect(screen.getByText('Choose Data Types')).toBeInTheDocument();
      expect(screen.getByText('Export Format')).toBeInTheDocument();
      expect(screen.getByText('Purpose of Export')).toBeInTheDocument();
    });

    it('should have date range presets', () => {
      render(<DataExportInterface {...defaultProps} />);

      expect(screen.getByRole('button', { name: /last 7 days/i })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /last 30 days/i })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /this semester/i })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /all time/i })).toBeInTheDocument();
    });

    it('should update date range when preset is clicked', async () => {
      const user = userEvent.setup();

      render(<DataExportInterface {...defaultProps} />);

      const weekPreset = screen.getByRole('button', { name: /last 7 days/i });
      await user.click(weekPreset);

      // Check that the date inputs are updated (approximately - within a day)
      const startDateInput = screen.getByLabelText(/start date/i) as HTMLInputElement;
      const endDateInput = screen.getByLabelText(/end date/i) as HTMLInputElement;
      
      const weekAgo = new Date();
      weekAgo.setDate(weekAgo.getDate() - 7);
      
      expect(startDateInput.value).toBe(weekAgo.toISOString().split('T')[0]);
      expect(endDateInput.value).toBe(new Date().toISOString().split('T')[0]);
    });

    it('should toggle data type selections', async () => {
      const user = userEvent.setup();

      render(<DataExportInterface {...defaultProps} />);

      const assessmentCheckbox = screen.getByRole('checkbox', { name: /assessment results/i });
      expect(assessmentCheckbox).toBeChecked();

      await user.click(assessmentCheckbox);
      expect(assessmentCheckbox).not.toBeChecked();
    });

    it('should select export formats', async () => {
      const user = userEvent.setup();

      render(<DataExportInterface {...defaultProps} />);

      const jsonCheckbox = screen.getByRole('checkbox', { name: /json \(structured\)/i });
      expect(jsonCheckbox).not.toBeChecked();

      await user.click(jsonCheckbox);
      expect(jsonCheckbox).toBeChecked();
    });

    it('should require purpose selection', async () => {
      const user = userEvent.setup();

      render(<DataExportInterface {...defaultProps} />);

      const previewButton = screen.getByRole('button', { name: /preview data/i });
      expect(previewButton).toBeDisabled();

      const purposeSelect = screen.getByDisplayValue('Select purpose...');
      await user.selectOptions(purposeSelect, 'Academic portfolio development');

      expect(previewButton).toBeEnabled();
    });

    it('should disable preview button when no formats selected', async () => {
      const user = userEvent.setup();

      render(<DataExportInterface {...defaultProps} />);

      // Uncheck default CSV format
      const csvCheckbox = screen.getByRole('checkbox', { name: /csv \(spreadsheet\)/i });
      await user.click(csvCheckbox);

      const previewButton = screen.getByRole('button', { name: /preview data/i });
      expect(previewButton).toBeDisabled();
    });
  });

  describe('Preview Generation', () => {
    beforeEach(() => {
      mockFetch.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({
          success: true,
          data: mockPreviewData,
        }),
      });
    });

    it('should generate preview when preview button is clicked', async () => {
      const user = userEvent.setup();

      render(<DataExportInterface {...defaultProps} />);

      // Configure export
      const purposeSelect = screen.getByDisplayValue('Select purpose...');
      await user.selectOptions(purposeSelect, 'Academic portfolio development');

      const previewButton = screen.getByRole('button', { name: /preview data/i });
      await user.click(previewButton);

      await waitFor(() => {
        expect(mockFetch).toHaveBeenCalledWith(
          '/api/analytics/export/preview',
          expect.objectContaining({
            method: 'POST',
            headers: expect.objectContaining({
              'Authorization': `Bearer ${defaultProps.jwt}`,
              'Content-Type': 'application/json',
            }),
          })
        );
      });
    });

    it('should show loading state during preview generation', async () => {
      const user = userEvent.setup();

      mockFetch.mockImplementation(() => new Promise(() => {})); // Never resolves

      render(<DataExportInterface {...defaultProps} />);

      const purposeSelect = screen.getByDisplayValue('Select purpose...');
      await user.selectOptions(purposeSelect, 'Academic portfolio development');

      const previewButton = screen.getByRole('button', { name: /preview data/i });
      await user.click(previewButton);

      expect(screen.getByText('Generating Preview...')).toBeInTheDocument();
    });
  });

  describe('Preview Step', () => {
    beforeEach(async () => {
      const user = userEvent.setup();

      mockFetch.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({
          success: true,
          data: mockPreviewData,
        }),
      });

      render(<DataExportInterface {...defaultProps} />);

      // Navigate to preview step
      const purposeSelect = screen.getByDisplayValue('Select purpose...');
      await user.selectOptions(purposeSelect, 'Academic portfolio development');

      const previewButton = screen.getByRole('button', { name: /preview data/i });
      await user.click(previewButton);

      await waitFor(() => {
        expect(screen.getByText('Export Preview')).toBeInTheDocument();
      });
    });

    it('should display preview data table', () => {
      expect(screen.getByText('Sample Data (first 5 records)')).toBeInTheDocument();
      expect(screen.getByText('Assessment ID')).toBeInTheDocument();
      expect(screen.getByText('quiz_001')).toBeInTheDocument();
      expect(screen.getByText('85')).toBeInTheDocument();
    });

    it('should show export statistics', () => {
      expect(screen.getByText('25 records')).toBeInTheDocument();
      expect(screen.getByText('~2.5 MB')).toBeInTheDocument();
    });

    it('should show privacy notice', () => {
      expect(screen.getByText('Privacy Notice')).toBeInTheDocument();
      expect(screen.getByText(/only your personal learning data/i)).toBeInTheDocument();
    });

    it('should require terms agreement', async () => {
      const user = userEvent.setup();

      const generateButton = screen.getByRole('button', { name: /generate export/i });
      expect(generateButton).toBeDisabled();

      const termsCheckbox = screen.getByRole('checkbox', { name: /i understand that/i });
      await user.click(termsCheckbox);

      expect(generateButton).toBeEnabled();
    });

    it('should allow going back to configuration', async () => {
      const user = userEvent.setup();

      const backButton = screen.getByRole('button', { name: /back to configuration/i });
      await user.click(backButton);

      expect(screen.getByText('Select Time Period')).toBeInTheDocument();
    });
  });

  describe('Export Generation', () => {
    let user: any;

    beforeEach(async () => {
      user = userEvent.setup();

      // Mock preview generation
      mockFetch
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve({
            success: true,
            data: mockPreviewData,
          }),
        })
        // Mock export generation
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve({
            success: true,
            data: { ...mockExportStatus, status: 'preparing' },
          }),
        })
        // Mock status polling
        .mockResolvedValue({
          ok: true,
          json: () => Promise.resolve({
            success: true,
            data: mockExportStatus,
          }),
        });

      render(<DataExportInterface {...defaultProps} />);

      // Navigate through steps
      const purposeSelect = screen.getByDisplayValue('Select purpose...');
      await user.selectOptions(purposeSelect, 'Academic portfolio development');

      const previewButton = screen.getByRole('button', { name: /preview data/i });
      await user.click(previewButton);

      await waitFor(() => {
        expect(screen.getByText('Export Preview')).toBeInTheDocument();
      });

      const termsCheckbox = screen.getByRole('checkbox', { name: /i understand that/i });
      await user.click(termsCheckbox);
    });

    it('should start export generation', async () => {
      const generateButton = screen.getByRole('button', { name: /generate export/i });
      await user.click(generateButton);

      await waitFor(() => {
        expect(mockFetch).toHaveBeenCalledWith(
          '/api/analytics/export/generate',
          expect.objectContaining({
            method: 'POST',
            body: expect.stringContaining('"termsAccepted":true'),
          })
        );
      });
    });

    it('should show generation progress', async () => {
      const generateButton = screen.getByRole('button', { name: /generate export/i });
      await user.click(generateButton);

      await waitFor(() => {
        expect(screen.getByText('Generating Export')).toBeInTheDocument();
        expect(screen.getByText('Collecting data records')).toBeInTheDocument();
      });
    });

    it('should display download link when ready', async () => {
      // Mock status update
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({
          success: true,
          data: mockExportStatus,
        }),
      });

      const generateButton = screen.getByRole('button', { name: /generate export/i });
      await user.click(generateButton);

      // Simulate status update
      await waitFor(() => {
        expect(screen.getByText('Export Ready!')).toBeInTheDocument();
      });

      const downloadLink = screen.getByRole('link', { name: /download export/i });
      expect(downloadLink).toHaveAttribute('href', mockExportStatus.downloadUrl);
    });
  });

  describe('Error Handling', () => {
    it('should handle preview generation errors', async () => {
      const user = userEvent.setup();

      mockFetch.mockRejectedValue(new Error('Preview failed'));

      render(<DataExportInterface {...defaultProps} />);

      const purposeSelect = screen.getByDisplayValue('Select purpose...');
      await user.selectOptions(purposeSelect, 'Academic portfolio development');

      const previewButton = screen.getByRole('button', { name: /preview data/i });
      await user.click(previewButton);

      await waitFor(() => {
        expect(screen.getByText('Export Error')).toBeInTheDocument();
        expect(screen.getByText(/preview failed/i)).toBeInTheDocument();
      });
    });

    it('should handle export generation errors', async () => {
      const user = userEvent.setup();

      mockFetch
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve({
            success: true,
            data: mockPreviewData,
          }),
        })
        .mockRejectedValueOnce(new Error('Export generation failed'));

      render(<DataExportInterface {...defaultProps} />);

      // Navigate to preview step
      const purposeSelect = screen.getByDisplayValue('Select purpose...');
      await user.selectOptions(purposeSelect, 'Academic portfolio development');

      const previewButton = screen.getByRole('button', { name: /preview data/i });
      await user.click(previewButton);

      const termsCheckbox = await screen.findByRole('checkbox', { name: /i understand that/i });
      await user.click(termsCheckbox);

      const generateButton = screen.getByRole('button', { name: /generate export/i });
      await user.click(generateButton);

      await waitFor(() => {
        expect(screen.getByText(/export generation failed/i)).toBeInTheDocument();
      });
    });

    it('should handle API error responses', async () => {
      const user = userEvent.setup();

      mockFetch.mockResolvedValue({
        ok: false,
        statusText: 'Unauthorized',
      });

      render(<DataExportInterface {...defaultProps} />);

      const purposeSelect = screen.getByDisplayValue('Select purpose...');
      await user.selectOptions(purposeSelect, 'Academic portfolio development');

      const previewButton = screen.getByRole('button', { name: /preview data/i });
      await user.click(previewButton);

      await waitFor(() => {
        expect(screen.getByText(/failed to generate preview: unauthorized/i)).toBeInTheDocument();
      });
    });

    it('should show no data message when preview is empty', async () => {
      const user = userEvent.setup();

      mockFetch.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({
          success: true,
          data: { ...mockPreviewData, sampleData: [] },
        }),
      });

      render(<DataExportInterface {...defaultProps} />);

      const purposeSelect = screen.getByDisplayValue('Select purpose...');
      await user.selectOptions(purposeSelect, 'Academic portfolio development');

      const previewButton = screen.getByRole('button', { name: /preview data/i });
      await user.click(previewButton);

      await waitFor(() => {
        expect(screen.getByText(/no data found for the selected criteria/i)).toBeInTheDocument();
      });
    });
  });

  describe('Progress Indicator', () => {
    it('should show current step in progress indicator', () => {
      render(<DataExportInterface {...defaultProps} />);

      // Look for the step labels specifically, not any text containing these words
      const configureStep = screen.getByText('Configure');
      const previewStep = screen.getByText('Preview');
      const downloadStep = screen.getByText('Download');
      
      expect(configureStep).toBeInTheDocument();
      expect(previewStep).toBeInTheDocument();
      expect(downloadStep).toBeInTheDocument();

      // Check that configure step is active - with CSS modules, the class name is transformed
      const configureStepContainer = configureStep.closest('div');
      expect(configureStepContainer).toHaveClass(expect.stringContaining('active'));
    });

    it('should update progress indicator on step change', async () => {
      const user = userEvent.setup();

      mockFetch.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({
          success: true,
          data: mockPreviewData,
        }),
      });

      render(<DataExportInterface {...defaultProps} />);

      const purposeSelect = screen.getByDisplayValue('Select purpose...');
      await user.selectOptions(purposeSelect, 'Academic portfolio development');

      const previewButton = screen.getByRole('button', { name: /preview data/i });
      await user.click(previewButton);

      await waitFor(() => {
        const previewStep = screen.getByText('Preview').closest('div');
        expect(previewStep).toHaveClass('active');
      });
    });
  });

  describe('Callback Functions', () => {
    it('should call onExportComplete when export is ready', async () => {
      const user = userEvent.setup();
      const mockOnComplete = vi.fn();

      mockFetch
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve({
            success: true,
            data: mockPreviewData,
          }),
        })
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve({
            success: true,
            data: mockExportStatus,
          }),
        });

      render(<DataExportInterface {...defaultProps} onExportComplete={mockOnComplete} />);

      // Navigate through steps
      const purposeSelect = screen.getByDisplayValue('Select purpose...');
      await user.selectOptions(purposeSelect, 'Academic portfolio development');

      const previewButton = screen.getByRole('button', { name: /preview data/i });
      await user.click(previewButton);

      const termsCheckbox = await screen.findByRole('checkbox', { name: /i understand that/i });
      await user.click(termsCheckbox);

      const generateButton = screen.getByRole('button', { name: /generate export/i });
      await user.click(generateButton);

      await waitFor(() => {
        expect(mockOnComplete).toHaveBeenCalledWith(mockExportStatus.exportId);
      });
    });
  });

  describe('Accessibility', () => {
    it('should have proper form labels', () => {
      render(<DataExportInterface {...defaultProps} />);

      expect(screen.getByLabelText(/start date/i)).toBeInTheDocument();
      expect(screen.getByLabelText(/end date/i)).toBeInTheDocument();
    });

    it('should have proper checkbox labels', () => {
      render(<DataExportInterface {...defaultProps} />);

      expect(screen.getByLabelText(/assessment results/i)).toBeInTheDocument();
      expect(screen.getByLabelText(/performance analytics/i)).toBeInTheDocument();
    });

    it('should have proper button states', async () => {
      render(<DataExportInterface {...defaultProps} />);

      const previewButton = screen.getByRole('button', { name: /preview data/i });
      expect(previewButton).toBeDisabled();
      expect(previewButton).toHaveAttribute('disabled');
    });
  });
});