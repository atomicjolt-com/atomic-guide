/**
 * @fileoverview Main dashboard component that integrates all analytics features
 * @module features/dashboard/client/components/Dashboard
 */

import { ReactElement, useState } from 'react';
import StudentPerformanceOverview from './StudentPerformanceOverview';
import LearningInsights from './LearningInsights';
import BenchmarkComparison from './BenchmarkComparison';
import DataExportInterface from './DataExportInterface';
import SuggestionAnalytics from './SuggestionAnalytics';
import ChatHistory from './ChatHistory';
import SyncStatusIndicator from './SyncStatusIndicator';
import type { LaunchSettings } from '@atomicjolt/lti-client';

/**
 * Dashboard tab configuration
 */
type TabId = 'overview' | 'insights' | 'benchmarks' | 'analytics' | 'history' | 'export';

interface Tab {
  id: TabId;
  label: string;
  component: ReactElement;
}

/**
 * Main dashboard interface integrating all analytics components
 * 
 * @component
 * @param launchSettings - LTI launch settings with JWT for API calls
 * @returns Tabbed dashboard interface with all analytics features
 */
export function Dashboard({ launchSettings }: { launchSettings: LaunchSettings }): ReactElement {
  const [activeTab, setActiveTab] = useState<TabId>('overview');
  
  const tabs: Tab[] = [
    { 
      id: 'overview', 
      label: 'Performance Overview',
      component: <StudentPerformanceOverview jwt={launchSettings.jwt} />
    },
    { 
      id: 'insights', 
      label: 'Learning Insights',
      component: <LearningInsights jwt={launchSettings.jwt} />
    },
    { 
      id: 'benchmarks', 
      label: 'Benchmarks',
      component: <BenchmarkComparison jwt={launchSettings.jwt} />
    },
    { 
      id: 'analytics', 
      label: 'Suggestion Analytics',
      component: <SuggestionAnalytics jwt={launchSettings.jwt} />
    },
    { 
      id: 'history', 
      label: 'Chat History',
      component: <ChatHistory jwt={launchSettings.jwt} />
    },
    { 
      id: 'export', 
      label: 'Export Data',
      component: <DataExportInterface jwt={launchSettings.jwt} />
    }
  ];

  const activeTabContent = tabs.find(tab => tab.id === activeTab)?.component;

  return (
    <div className="dashboard-container">
      <div className="dashboard-header">
        <h1>Learning Analytics Dashboard</h1>
        {/* SyncStatusIndicator requires preferencesSync service - commented out for now */}
        {/* <SyncStatusIndicator preferencesSync={preferencesSync} /> */}
      </div>
      
      <nav className="dashboard-tabs" role="tablist">
        {tabs.map(tab => (
          <button
            key={tab.id}
            className={`tab-button ${activeTab === tab.id ? 'active' : ''}`}
            onClick={() => setActiveTab(tab.id)}
            role="tab"
            aria-selected={activeTab === tab.id}
            aria-current={activeTab === tab.id ? 'page' : undefined}
          >
            {tab.label}
          </button>
        ))}
      </nav>
      
      <main className="dashboard-content" role="tabpanel">
        {activeTabContent}
      </main>
    </div>
  );
}