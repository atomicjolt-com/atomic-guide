/**
 * @fileoverview Tests for BenchmarkComparison component
 * @module features/dashboard/client/components/__tests__/BenchmarkComparison.test
 */

import {  describe, it, expect, vi, beforeEach, afterEach , MockFactory, TestDataFactory, ServiceTestHarness } from '@/tests/infrastructure';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import BenchmarkComparison from '../BenchmarkComparison';

import type { MockD1Database, MockKVNamespace, MockQueue } from '@/tests/infrastructure/types/mocks';
// Mock fetch globally
const mockFetch = vi.fn();
global.fetch = mockFetch;

// Mock data
const mockBenchmarkData = {
  studentMetrics: {
    overallMastery: 0.75,
    conceptMasteries: {
      'concept1': 0.8,
      'concept2': 0.7,
    },
    learningVelocity: 1.2,
    confidenceLevel: 0.85,
  },
  benchmarkData: {
    courseAverages: {
      overallMastery: 0.65,
      learningVelocity: 1.0,
      confidenceLevel: 0.7,
    },
    percentileRankings: {
      overallMastery: 0.75,
      learningVelocity: 0.82,
      confidenceLevel: 0.88,
    },
    confidenceIntervals: {
      overallMastery: [0.6, 0.7],
      learningVelocity: [0.8, 1.2],
      confidenceLevel: [0.65, 0.75],
    },
    sampleSizes: {
      overallMastery: 25,
      learningVelocity: 25,
      confidenceLevel: 25,
    },
  },
  privacyMetadata: {
    anonymizationMethod: 'Differential Privacy',
    epsilon: 1.0,
    participantCount: 25,
    dataFreshness: '2024-01-15T10:00:00Z',
  },
};

const mockPrivacyConsent = {
  benchmarkOptIn: true,
  lastUpdated: '2024-01-15T09:00:00Z',
  consentVersion: '1.0',
};

const defaultProps = {
  userId: 'test-user-123',
  courseId: 'test-course-456',
  jwt: 'test-jwt-token',
};

describe('BenchmarkComparison', () => {
  beforeEach(async () => {
    // Setup test infrastructure - removed ServiceTestHarness as this tests React components
    
    
    ;
  
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('Loading State', () => {
    it('should show loading indicator initially', () => {
      mockFetch.mockImplementation(() => new Promise(() => {})); // Never resolves

      render(<BenchmarkComparison {...defaultProps} />);

      expect(screen.getByText('Loading benchmark data...')).toBeInTheDocument();
      expect(screen.getByRole('status')).toBeInTheDocument();
    });
  });

  describe('Privacy Consent', () => {
    it('should fetch privacy consent on mount', async () => {
      mockFetch
        .mockImplementationOnce(() => Promise.resolve({
          ok: true,
          json: () => Promise.resolve({
            success: true,
            data: mockPrivacyConsent,
          }),
        }))
        .mockImplementationOnce(() => Promise.resolve({
          ok: true,
          json: () => Promise.resolve({
            success: true,
            data: mockBenchmarkData,
          }),
        }));

      render(<BenchmarkComparison {...defaultProps} />);

      await waitFor(() => {
        expect(mockFetch).toHaveBeenCalledWith(
          `/api/analytics/privacy/consent/${defaultProps.userId}?courseId=${defaultProps.courseId}`,
          expect.objectContaining({
            headers: expect.objectContaining({
              'Authorization': `Bearer ${defaultProps.jwt}`,
            }),
          })
        );
      });
    });

    it('should show opt-in interface when consent is false', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({
          success: true,
          data: { ...mockPrivacyConsent, benchmarkOptIn: false },
        }),
      });

      render(<BenchmarkComparison {...defaultProps} />);

      await waitFor(() => {
        expect(screen.getByText('Peer Comparisons Available')).toBeInTheDocument();
        expect(screen.getByRole('button', { name: /enable peer comparisons/i })).toBeInTheDocument();
      });
    });

    it('should enable benchmark comparisons when opt-in button is clicked', async () => {
      const user = userEvent.setup();

      mockFetch
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve({
            success: true,
            data: { ...mockPrivacyConsent, benchmarkOptIn: false },
          }),
        })
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve({ success: true }),
        })
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve({
            success: true,
            data: mockBenchmarkData,
          }),
        });

      render(<BenchmarkComparison {...defaultProps} />);

      await waitFor(() => {
        expect(screen.getByRole('button', { name: /enable peer comparisons/i })).toBeInTheDocument();
      });

      const enableButton = screen.getByRole('button', { name: /enable peer comparisons/i });
      await user.click(enableButton);

      await waitFor(() => {
        expect(mockFetch).toHaveBeenCalledWith(
          `/api/analytics/privacy/consent/${defaultProps.userId}`,
          expect.objectContaining({
            method: 'PUT',
            headers: expect.objectContaining({
              'Authorization': `Bearer ${defaultProps.jwt}`,
              'Content-Type': 'application/json',
            }),
            body: JSON.stringify({
              courseId: defaultProps.courseId,
              benchmarkOptIn: true,
              consentVersion: '1.0',
            }),
          })
        );
      });
    });
  });

  describe('Benchmark Data Display', () => {
    beforeEach(() => {
      mockFetch
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve({
            success: true,
            data: mockPrivacyConsent,
          }),
        })
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve({
            success: true,
            data: mockBenchmarkData,
          }),
        });
    });

    it('should display benchmark comparison when data is loaded', async () => {
      render(<BenchmarkComparison {...defaultProps} />);

      await waitFor(() => {
        expect(screen.getByText('Peer Performance Comparison')).toBeInTheDocument();
        expect(screen.getAllByText('Overall Mastery').length).toBeGreaterThan(0);
      });
    });

    it('should show student performance vs course average', async () => {
      render(<BenchmarkComparison {...defaultProps} />);

      await waitFor(() => {
        expect(screen.getByText('75%')).toBeInTheDocument(); // Student performance
        expect(screen.getByText('65%')).toBeInTheDocument(); // Course average
      });
    });

    it('should display percentile ranking', async () => {
      render(<BenchmarkComparison {...defaultProps} />);

      await waitFor(() => {
        expect(screen.getByText(/75th percentile/i)).toBeInTheDocument();
      });
    });

    it('should show privacy metadata', async () => {
      render(<BenchmarkComparison {...defaultProps} />);

      await waitFor(() => {
        expect(screen.getByText(/Privacy Method: Differential Privacy/i)).toBeInTheDocument();
        expect(screen.getByText(/Privacy Strength: ε=1.0/i)).toBeInTheDocument();
      });
    });

    it('should display sample size information', async () => {
      render(<BenchmarkComparison {...defaultProps} />);

      await waitFor(() => {
        expect(screen.getByText(/\(25 students\)/i)).toBeInTheDocument();
      });
    });
  });

  describe('Metric Selection', () => {
    beforeEach(() => {
      mockFetch
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve({
            success: true,
            data: mockPrivacyConsent,
          }),
        })
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve({
            success: true,
            data: mockBenchmarkData,
          }),
        });
    });

    it('should allow switching between metrics', async () => {
      const user = userEvent.setup();

      render(<BenchmarkComparison {...defaultProps} />);

      await waitFor(() => {
        expect(screen.getByDisplayValue('Overall Mastery')).toBeInTheDocument();
      });

      const select = screen.getByLabelText(/select metric for comparison/i);
      await user.selectOptions(select, 'learningVelocity');

      await waitFor(() => {
        expect(screen.getAllByText('Learning Velocity').length).toBeGreaterThan(0);
        // Look for the student velocity value specifically
        const velocityValues = screen.getAllByText('1.2');
        expect(velocityValues.length).toBeGreaterThan(0); // Should have at least one 1.2 value
        expect(screen.getByText('1.0')).toBeInTheDocument(); // Course average velocity
      });
    });
  });

  describe('Privacy Controls', () => {
    beforeEach(() => {
      mockFetch
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve({
            success: true,
            data: mockPrivacyConsent,
          }),
        })
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve({
            success: true,
            data: mockBenchmarkData,
          }),
        });
    });

    it('should show privacy status indicator', async () => {
      render(<BenchmarkComparison {...defaultProps} />);

      await waitFor(() => {
        expect(screen.getByText('Privacy Protected')).toBeInTheDocument();
      });
    });

    it('should allow toggling privacy explanation', async () => {
      const user = userEvent.setup();

      render(<BenchmarkComparison {...defaultProps} />);

      await waitFor(() => {
        expect(screen.getByRole('button', { name: /learn about privacy protection/i })).toBeInTheDocument();
      });

      const explainButton = screen.getByRole('button', { name: /learn about privacy protection/i });
      await user.click(explainButton);

      expect(screen.getByText('How Your Privacy is Protected')).toBeInTheDocument();
      expect(screen.getByText('Differential Privacy')).toBeInTheDocument();

      await user.click(explainButton);

      expect(screen.queryByText('How Your Privacy is Protected')).not.toBeInTheDocument();
    });

    it('should toggle opt-in checkbox', async () => {
      const user = userEvent.setup();
      const mockOnChange = vi.fn();

      // Mock privacy consent fetch
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({
          success: true,
          data: mockPrivacyConsent,
        }),
      });

      // Mock consent update
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ success: true }),
      });

      render(<BenchmarkComparison {...defaultProps} onPrivacyOptInChange={mockOnChange} />);

      await waitFor(() => {
        expect(screen.getByLabelText(/include my data in anonymous peer comparisons/i)).toBeInTheDocument();
      });

      const checkbox = screen.getByLabelText(/include my data in anonymous peer comparisons/i);
      await user.click(checkbox);

      // Wait for the async operation to complete
      await waitFor(() => {
        expect(mockOnChange).toHaveBeenCalledWith(false);
      });
    });
  });

  describe('Error Handling', () => {
    it('should display error when privacy consent fetch fails', async () => {
      mockFetch.mockRejectedValueOnce(new Error('Network error'));

      render(<BenchmarkComparison {...defaultProps} />);

      await waitFor(() => {
        expect(screen.getByText('Error Loading Benchmarks')).toBeInTheDocument();
        expect(screen.getByRole('button', { name: /try again/i })).toBeInTheDocument();
      });
    });

    it('should display error when benchmark data fetch fails', async () => {
      mockFetch
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve({
            success: true,
            data: mockPrivacyConsent,
          }),
        })
        .mockRejectedValueOnce(new Error('Benchmark fetch failed'));

      render(<BenchmarkComparison {...defaultProps} />);

      await waitFor(() => {
        expect(screen.getByText('Error Loading Benchmarks')).toBeInTheDocument();
      });
    });

    it('should handle API error responses', async () => {
      mockFetch
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve({
            success: true,
            data: mockPrivacyConsent,
          }),
        })
        .mockResolvedValueOnce({
          ok: false,
          statusText: 'Unauthorized',
        });

      render(<BenchmarkComparison {...defaultProps} />);

      await waitFor(() => {
        expect(screen.getByText(/Failed to fetch benchmark data: Unauthorized/i)).toBeInTheDocument();
      });
    });
  });

  describe('Performance Context', () => {
    beforeEach(() => {
      mockFetch
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve({
            success: true,
            data: mockPrivacyConsent,
          }),
        });
    });

    it('should show positive context for high performance', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({
          success: true,
          data: {
            ...mockBenchmarkData,
            benchmarkData: {
              ...mockBenchmarkData.benchmarkData,
              percentileRankings: {
                ...mockBenchmarkData.benchmarkData.percentileRankings,
                overallMastery: 0.85, // 85th percentile
              },
            },
          },
        }),
      });

      render(<BenchmarkComparison {...defaultProps} />);

      await waitFor(() => {
        expect(screen.getByText(/performing above most of your peers/i)).toBeInTheDocument();
      });
    });

    it('should show encouraging context for low performance', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({
          success: true,
          data: {
            ...mockBenchmarkData,
            benchmarkData: {
              ...mockBenchmarkData.benchmarkData,
              percentileRankings: {
                ...mockBenchmarkData.benchmarkData.percentileRankings,
                overallMastery: 0.25, // 25th percentile
              },
            },
          },
        }),
      });

      render(<BenchmarkComparison {...defaultProps} />);

      await waitFor(() => {
        expect(screen.getByText(/opportunity to improve with focused practice/i)).toBeInTheDocument();
      });
    });
  });

  describe('Accessibility', () => {
    beforeEach(() => {
      mockFetch
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve({
            success: true,
            data: mockPrivacyConsent,
          }),
        })
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve({
            success: true,
            data: mockBenchmarkData,
          }),
        });
    });

    it('should have proper ARIA labels', async () => {
      render(<BenchmarkComparison {...defaultProps} />);

      await waitFor(() => {
        expect(screen.getByLabelText(/select metric for comparison/i)).toBeInTheDocument();
        expect(screen.getByLabelText(/include my data in anonymous peer comparisons/i)).toBeInTheDocument();
      });
    });

    it('should have proper button roles and states', async () => {
      render(<BenchmarkComparison {...defaultProps} />);

      await waitFor(() => {
        const explainButton = screen.getByRole('button', { name: /learn about privacy protection/i });
        expect(explainButton).toHaveAttribute('aria-expanded', 'false');
      });
    });
  });
});