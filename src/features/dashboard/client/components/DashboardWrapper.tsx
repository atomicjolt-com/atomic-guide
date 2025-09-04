/**
 * @fileoverview Wrapper components for dashboard views with proper prop handling
 * @module features/dashboard/client/components/DashboardWrapper
 */

import { ReactElement } from 'react';
import StudentPerformanceOverview from './StudentPerformanceOverview';
import LearningInsights from './LearningInsights';
import BenchmarkComparison from './BenchmarkComparison';
import DataExportInterface from './DataExportInterface';
import SuggestionAnalytics from './SuggestionAnalytics';
import ChatHistory from './ChatHistory';

interface WrapperProps {
  jwt: string;
}

// Mock data for development - replace with actual API calls
const mockUserId = 'user-123';
const mockCourseId = 'course-456';
const mockTenantId = 'tenant-789';

export function StudentPerformanceOverviewWrapper({ jwt }: WrapperProps): ReactElement {
  // TODO: Extract userId and tenantId from JWT or make API call
  return <StudentPerformanceOverview userId={mockUserId} tenantId={mockTenantId} courseId={mockCourseId} jwt={jwt} />;
}

export function BenchmarkComparisonWrapper({ jwt }: WrapperProps): ReactElement {
  return <BenchmarkComparison userId={mockUserId} courseId={mockCourseId} jwt={jwt} />;
}

export function DataExportInterfaceWrapper({ jwt }: WrapperProps): ReactElement {
  return <DataExportInterface userId={mockUserId} courseId={mockCourseId} jwt={jwt} />;
}

export function ChatHistoryWrapper({ jwt: _jwt }: WrapperProps): ReactElement {
  return <ChatHistory conversations={[]} isLoading={false} onConversationSelect={() => {}} />;
}

export function SuggestionAnalyticsWrapper({ jwt }: WrapperProps): ReactElement {
  // SuggestionAnalytics already accepts jwt prop
  return <SuggestionAnalytics jwt={jwt} />;
}

export function LearningInsightsWrapper({ jwt }: WrapperProps): ReactElement {
  // LearningInsights already accepts jwt prop
  return <LearningInsights jwt={jwt} />;
}
