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
  return (
    <StudentPerformanceOverview 
      userId={mockUserId}
      tenantId={mockTenantId}
      courseId={mockCourseId}
    />
  );
}

export function BenchmarkComparisonWrapper({ jwt }: WrapperProps): ReactElement {
  return (
    <BenchmarkComparison
      userId={mockUserId}
      courseId={mockCourseId}
      courseName="Sample Course"
      studentData={{
        averageScore: 0,
        completionRate: 0,
        timeSpent: 0,
        strugglingTopics: [],
        strongTopics: []
      }}
      classData={{
        averageScore: 0,
        completionRate: 0,
        timeSpent: 0
      }}
      isLoading={false}
    />
  );
}

export function DataExportInterfaceWrapper({ jwt }: WrapperProps): ReactElement {
  return (
    <DataExportInterface
      userId={mockUserId}
      courseId={mockCourseId}
      courseName="Sample Course"
      availableData={{
        conversations: [],
        assessments: [],
        progress: [],
        insights: []
      }}
      isLoading={false}
    />
  );
}

export function ChatHistoryWrapper({ jwt }: WrapperProps): ReactElement {
  return (
    <ChatHistory
      conversations={[]}
      isLoading={false}
      onConversationSelect={() => {}}
    />
  );
}

export function SuggestionAnalyticsWrapper({ jwt }: WrapperProps): ReactElement {
  // SuggestionAnalytics already accepts jwt prop
  return <SuggestionAnalytics jwt={jwt} />;
}

export function LearningInsightsWrapper({ jwt }: WrapperProps): ReactElement {
  // LearningInsights already accepts jwt prop
  return <LearningInsights jwt={jwt} />;
}