/**
 * @fileoverview Tests for AssessmentAnalytics component
 * @module features/assessment/client/components/AssessmentAnalytics.test
 */

import { describe, it, expect, vi, beforeEach, MockFactory, TestDataFactory, ServiceTestHarness } from '@/tests/infrastructure';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { AssessmentAnalytics } from './AssessmentAnalytics';

import type { MockD1Database, MockKVNamespace, MockQueue } from '@/tests/infrastructure/types/mocks';
// Mock fetch globally
global.fetch = vi.fn();

// Mock URL.createObjectURL and URL.revokeObjectURL
global.URL.createObjectURL = vi.fn(() => 'blob:mock-url');
global.URL.revokeObjectURL = vi.fn();

describe('AssessmentAnalytics', () => {
  const mockPerformanceData = {
    assessmentId: 'test-assessment-123',
    assessmentTitle: 'Test Assessment',
    totalAttempts: 50,
    averageScore: 75.5,
    medianScore: 78,
    completionRate: 0.85,
    averageTimeSpent: 25,
    scoreDistribution: {
      '0-20': 2,
      '21-40': 5,
      '41-60': 8,
      '61-80': 20,
      '81-100': 15,
    },
    commonStrugglePoints: [
      {
        questionId: 'q1',
        questionText: 'What is the derivative of x^2?',
        incorrectAttempts: 25,
        averageAttemptsToCorrect: 2.5,
        commonMisconceptions: ['Confusing with integral', 'Wrong power rule'],
      },
      {
        questionId: 'q2',
        questionText: 'Solve for x: 2x + 5 = 15',
        incorrectAttempts: 18,
        averageAttemptsToCorrect: 1.8,
        commonMisconceptions: ['Order of operations error'],
      },
    ],
  };

  beforeEach(async () => {
    // Setup test infrastructure - removed ServiceTestHarness as this tests React components
  });

  it('should render loading state initially', () => {
    vi.mocked(global.fetch).mockImplementation(() => new Promise(() => {}));

    render(<AssessmentAnalytics courseId="course-123" assessmentId="assessment-123" jwt="test-jwt" />);

    expect(screen.getByText('Loading assessment analytics...')).toBeInTheDocument();
  });

  it('should render error state on fetch failure', async () => {
    vi.mocked(global.fetch).mockRejectedValueOnce(new Error('Network error'));

    render(<AssessmentAnalytics courseId="course-123" assessmentId="assessment-123" jwt="test-jwt" />);

    await waitFor(() => {
      expect(screen.getByText('Error Loading Analytics')).toBeInTheDocument();
      expect(screen.getByText('Network error')).toBeInTheDocument();
    });
  });

  it('should render performance data when loaded', async () => {
    vi.mocked(global.fetch).mockResolvedValueOnce({
      ok: true,
      json: async () => mockPerformanceData,
    } as Response);

    render(<AssessmentAnalytics courseId="course-123" assessmentId="assessment-123" jwt="test-jwt" />);

    await waitFor(() => {
      expect(screen.getByText('Assessment Analytics')).toBeInTheDocument();
      expect(screen.getByText('50')).toBeInTheDocument(); // Total attempts
      expect(screen.getByText('75.5%')).toBeInTheDocument(); // Average score
      expect(screen.getByText('85.0%')).toBeInTheDocument(); // Completion rate
      expect(screen.getByText('25 min')).toBeInTheDocument(); // Average time
    });
  });

  it('should switch between tabs', async () => {
    const user = userEvent.setup();

    vi.mocked(global.fetch).mockResolvedValueOnce({
      ok: true,
      json: async () => mockPerformanceData,
    } as Response);

    render(<AssessmentAnalytics courseId="course-123" assessmentId="assessment-123" jwt="test-jwt" />);

    await waitFor(() => {
      expect(screen.getByRole('heading', { name: 'Score Distribution' })).toBeInTheDocument();
    });

    // Click on Struggle Points tab
    await user.click(screen.getByRole('button', { name: 'Struggle Points' }));
    expect(screen.getByText('Common Struggle Points')).toBeInTheDocument();
    expect(screen.getByText('What is the derivative of x^2?')).toBeInTheDocument();

    // Click on Time Analysis tab
    await user.click(screen.getByRole('button', { name: 'Time Analysis' }));
    expect(screen.getByRole('heading', { name: 'Time Analysis' })).toBeInTheDocument();
    expect(screen.getByText('Average Time:')).toBeInTheDocument();
  });

  it('should export data as CSV', async () => {
    const user = userEvent.setup();
    const mockClick = vi.fn();

    // Mock createElement to capture the download link
    const originalCreateElement = document.createElement.bind(document);
    document.createElement = vi.fn((tagName) => {
      const element = originalCreateElement(tagName);
      if (tagName === 'a') {
        element.click = mockClick;
      }
      return element;
    });

    vi.mocked(global.fetch).mockResolvedValueOnce({
      ok: true,
      json: async () => mockPerformanceData,
    } as Response);

    render(<AssessmentAnalytics courseId="course-123" assessmentId="assessment-123" jwt="test-jwt" />);

    await waitFor(() => {
      expect(screen.getByText('Export Data')).toBeInTheDocument();
    });

    await user.click(screen.getByText('Export Data'));

    expect(mockClick).toHaveBeenCalled();
    expect(global.URL.createObjectURL).toHaveBeenCalled();
    expect(global.URL.revokeObjectURL).toHaveBeenCalled();

    // Restore original createElement
    document.createElement = originalCreateElement;
  });

  it('should retry on error', async () => {
    const user = userEvent.setup();

    // First call fails
    vi.mocked(global.fetch).mockRejectedValueOnce(new Error('Network error'));

    render(<AssessmentAnalytics courseId="course-123" assessmentId="assessment-123" jwt="test-jwt" />);

    await waitFor(() => {
      expect(screen.getByText('Error Loading Analytics')).toBeInTheDocument();
    });

    // Second call succeeds
    vi.mocked(global.fetch).mockResolvedValueOnce({
      ok: true,
      json: async () => mockPerformanceData,
    } as Response);

    await user.click(screen.getByText('Retry'));

    await waitFor(() => {
      expect(screen.getByText('Assessment Analytics')).toBeInTheDocument();
    });
  });

  it('should fetch course-level analytics when no assessmentId provided', async () => {
    vi.mocked(global.fetch).mockResolvedValueOnce({
      ok: true,
      json: async () => mockPerformanceData,
    } as Response);

    render(<AssessmentAnalytics courseId="course-123" jwt="test-jwt" />);

    await waitFor(() => {
      expect(screen.getByText('Assessment Analytics')).toBeInTheDocument();
    });

    expect(vi.mocked(global.fetch)).toHaveBeenCalledWith(
      '/api/courses/course-123/assessment-analytics',
      expect.objectContaining({
        headers: expect.objectContaining({
          Authorization: 'Bearer test-jwt',
        }),
      })
    );
  });

  it('should display empty state when no data', async () => {
    vi.mocked(global.fetch).mockResolvedValueOnce({
      ok: true,
      json: async () => null,
    } as Response);

    render(<AssessmentAnalytics courseId="course-123" jwt="test-jwt" />);

    await waitFor(() => {
      expect(screen.getByText('No assessment data available')).toBeInTheDocument();
    });
  });

  it('should display struggle points with misconceptions', async () => {
    const user = userEvent.setup();

    vi.mocked(global.fetch).mockResolvedValueOnce({
      ok: true,
      json: async () => mockPerformanceData,
    } as Response);

    render(<AssessmentAnalytics courseId="course-123" assessmentId="assessment-123" jwt="test-jwt" />);

    await waitFor(() => {
      expect(screen.getByText('Struggle Points')).toBeInTheDocument();
    });

    await user.click(screen.getByText('Struggle Points'));

    expect(screen.getByText('What is the derivative of x^2?')).toBeInTheDocument();
    expect(screen.getByText('Incorrect attempts: 25')).toBeInTheDocument();
    expect(screen.getByText('Avg. attempts to correct: 2.5')).toBeInTheDocument();
    expect(screen.getByText('Confusing with integral')).toBeInTheDocument();
    expect(screen.getByText('Wrong power rule')).toBeInTheDocument();
  });
});
