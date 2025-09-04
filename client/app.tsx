/**
 * @fileoverview Main LTI launch application entry point for the Atomic Guide client.
 * Handles LTI 1.3 launch validation, store initialization, and deep linking setup.
 * @module client/app
 */

import { ReactElement, StrictMode, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { Provider } from 'react-redux';
import type { LaunchSettings } from '@atomicjolt/lti-client';
import { configureStore } from './store';
import { ChatFAB, ChatWindow } from '@features/chat/client/components';
import { Dashboard } from '@features/dashboard/client/components';
import { DeepLinkingInterface } from '@features/assessment/client/components';
import { LtiLaunchCheck } from '@atomicjolt/lti-components';
import '@features/dashboard/styles/atomic-jolt-dashboard.css';

/**
 * Main application component for LTI 1.3 tool.
 *
 * Conditionally renders based on launch context:
 * - Deep linking: Shows deep linking interface
 * - Standard launch: Renders main application with chat and dashboard views
 *
 * @component
 * @param launchSettings - LTI launch configuration including JWT and deep linking flag
 * @returns The appropriate UI based on launch context
 * @example
 * ```tsx
 * <App launchSettings={{ jwt: "...", deepLinking: false }} />
 * ```
 */
function App({ launchSettings }: { launchSettings: LaunchSettings }): ReactElement {
  const [activeView, setActiveView] = useState<'chat' | 'dashboard'>('chat');

  if (launchSettings.deepLinking) {
    // Deep linking mode - show assessment builder interface
    return <DeepLinkingInterface launchSettings={launchSettings} />;
  }

  return (
    <div className="app-container">
      <nav className="app-navigation">
        <button
          className={`nav-button ${activeView === 'chat' ? 'active' : ''}`}
          onClick={() => setActiveView('chat')}
          aria-current={activeView === 'chat' ? 'page' : undefined}
        >
          Chat Assistant
        </button>
        <button
          className={`nav-button ${activeView === 'dashboard' ? 'active' : ''}`}
          onClick={() => setActiveView('dashboard')}
          aria-current={activeView === 'dashboard' ? 'page' : undefined}
        >
          Analytics Dashboard
        </button>
      </nav>

      <main className="app-content">
        {activeView === 'chat' ? (
          <div className="chat-container">
            <h1>Learning Assistant</h1>
            <ChatFAB />
            <ChatWindow />
          </div>
        ) : (
          <Dashboard launchSettings={launchSettings} />
        )}
      </main>
    </div>
  );
}

// Get the root element for React rendering
const mainContent = document.getElementById('main-content');
if (!mainContent) {
  throw new Error('Main content element not found');
}

// Extract launch settings from window object (injected by server)
const launchSettings: LaunchSettings = window.LAUNCH_SETTINGS;
const jwt = launchSettings.jwt;

// Initialize Redux store with JWT for API authentication
const store = configureStore({ jwt });

// Create React 18+ root and render the application
const root = createRoot(mainContent);
root.render(
  <StrictMode>
    <LtiLaunchCheck stateValidation={launchSettings}>
      <Provider store={store}>
        <App launchSettings={launchSettings} />
      </Provider>
    </LtiLaunchCheck>
  </StrictMode>
);
