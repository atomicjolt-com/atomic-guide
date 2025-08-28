/**
 * @fileoverview Main LTI launch application entry point for the Atomic Guide client.
 * Handles LTI 1.3 launch validation, store initialization, and deep linking setup.
 * @module client/app
 */

import { ReactElement, StrictMode, useEffect } from 'react';
import { createRoot } from 'react-dom/client';
import { Provider } from 'react-redux';
import { ltiLaunch } from '@atomicjolt/lti-client';
import type { LaunchSettings } from '@atomicjolt/lti-client';
import { configureStore, setJwt } from './store';
import { ChatFAB } from './components/chat/ChatFAB';
import { ChatWindow } from './components/chat/ChatWindow';
import { LTI_NAMES_AND_ROLES_PATH } from '../definitions';
import { setupDeepLinkingButton } from './services/deepLinkingService';
import { namesAndRolesResponseSchema } from './schemas/deepLink.schema';

/**
 * Global type augmentation for window launch settings.
 */
declare global {
  interface Window {
    LAUNCH_SETTINGS: LaunchSettings;
  }
}

/**
 * Main application component props.
 */
interface AppProps {
  /** JWT token for API authentication */
  jwt?: string;
}

/**
 * Main application component.
 * 
 * Renders the chat interface after successful LTI launch.
 * 
 * @component
 * @example
 * ```tsx
 * <App jwt="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..." />
 * ```
 */
function App({ jwt }: AppProps): ReactElement {
  useEffect(() => {
    if (!jwt) {
      return;
    }

    // Fetch names and roles if JWT is available
    const fetchNamesAndRoles = async (): Promise<void> => {
      try {
        const response = await fetch(`/${LTI_NAMES_AND_ROLES_PATH}`, {
          method: 'GET',
          headers: {
            Authorization: `Bearer ${jwt}`,
            'Content-Type': 'application/json',
          },
        });

        if (!response.ok) {
          throw new Error(`Failed to fetch names and roles: ${response.status}`);
        }

        const data = await response.json();
        const validatedData = namesAndRolesResponseSchema.parse(data);
        console.log('Names and roles:', validatedData);
      } catch (error) {
        console.error('Names and roles error:', error instanceof Error ? error.message : 'Unknown error');
      }
    };

    fetchNamesAndRoles();
  }, [jwt]);

  return (
    <>
      <h1>Chat</h1>
      <ChatFAB />
      <ChatWindow />
    </>
  );
}

/**
 * Renders error message when LTI launch fails.
 * 
 * @returns Error message element
 */
function renderLaunchError(): void {
  const mainContent = document.getElementById('main-content');
  if (mainContent) {
    mainContent.innerHTML = '<div role="alert">Failed to launch LTI application</div>';
  } else {
    document.body.innerHTML = '<div role="alert">Failed to launch LTI application</div>';
  }
}

/**
 * Gets the main content container element.
 * 
 * @returns Main content element or null if not found
 * @throws {Error} If main content element is not found
 */
function getMainContentElement(): HTMLElement {
  const mainContent = document.getElementById('main-content');
  
  if (!mainContent) {
    throw new Error('Main content element not found');
  }
  
  return mainContent;
}

/**
 * Initializes the application after successful LTI launch.
 * 
 * @param launchSettings - Settings from LTI launch
 * @param mainContent - DOM element to render app into
 */
function initializeApp(launchSettings: LaunchSettings, mainContent: HTMLElement): void {
  const jwt = launchSettings.jwt;
  
  // Configure Redux store with launch settings
  const store = configureStore({
    jwt,
    settings: launchSettings,
  });
  
  // Dispatch JWT to store if available
  if (jwt) {
    store.dispatch(setJwt({ token: jwt }));
  }
  
  // Create React root and render app
  const root = createRoot(mainContent);
  root.render(
    <StrictMode>
      <Provider store={store}>
        <App jwt={jwt} />
      </Provider>
    </StrictMode>
  );
  
  // Setup deep linking if enabled
  if (launchSettings.deepLinking) {
    // Use setTimeout to ensure DOM is ready
    setTimeout(() => {
      const cleanup = setupDeepLinkingButton(launchSettings);
      
      // Store cleanup function if needed for later
      if (cleanup && typeof window !== 'undefined') {
        (window as any).__deepLinkingCleanup = cleanup;
      }
    }, 100);
  }
}

/**
 * Application bootstrap function.
 * 
 * Validates LTI launch and initializes the application.
 */
async function bootstrap(): Promise<void> {
  try {
    const launchSettings: LaunchSettings = window.LAUNCH_SETTINGS;
    
    // Validate LTI launch
    const isValid = await ltiLaunch(launchSettings);
    
    if (!isValid) {
      renderLaunchError();
      return;
    }
    
    // Get main content element
    const mainContent = getMainContentElement();
    
    // Initialize application
    initializeApp(launchSettings, mainContent);
    
  } catch (error) {
    console.error('Bootstrap error:', error instanceof Error ? error.message : 'Unknown error');
    renderLaunchError();
  }
}

// Start application
bootstrap();