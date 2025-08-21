# Coding Standards and Conventions

**Existing Standards Compliance:**

- **Code Style:** TypeScript with strict mode, Prettier formatting
- **Linting Rules:** ESLint with @typescript-eslint rules
- **Testing Patterns:** Vitest for unit tests, test files colocated
- **Documentation Style:** JSDoc comments for public APIs

**Enhancement-Specific Standards:**

**TypeScript Conventions:**

```typescript
// Use interfaces for data shapes
interface LearnerProfile {
  id: string;
  tenantId: string;
  cognitiveProfile: CognitiveData;
}

// Use type for unions/aliases
type SignalType = 'hover' | 'scroll' | 'idle' | 'click';

// Explicit return types for public functions
export async function processSignal(signal: BehavioralSignal): Promise<void> {
  // Implementation
}
```

**React Component Patterns:**

```typescript
// Functional components with typed props
interface DashboardProps {
  learnerId: string;
  profile: LearnerProfile;
}

export default function LearnerDashboard({ learnerId, profile }: DashboardProps) {
  // Use hooks at top level
  const dispatch = useAppDispatch();
  const session = useAppSelector(selectCurrentSession);

  return <div className={styles.dashboard}>...</div>;
}
```

**React Application Initialization Pattern (app.tsx):**

```typescript
import 'core-js';
import 'regenerator-runtime/runtime';
import 'custom-event-polyfill';
import React from 'react';
import { createRoot } from 'react-dom/client';
import ReactModal from 'react-modal';
import es6Promise from 'es6-promise';
import i18n from 'i18next';

import { getInitialSettings } from '@atomicjolt/atomic-fuel/libs/reducers/settings';
import jwt from '@atomicjolt/atomic-fuel/libs/loaders/jwt';
import { LtiLaunchCheck } from '@atomicjolt/lti-components';
import DefaultRoot from './root';

// Polyfill es6 promises for IE
es6Promise.polyfill();

// Set app element for accessible modals
ReactModal.setAppElement('#main-app');

// Extract LTI settings from window
const settings = getInitialSettings(window.DEFAULT_SETTINGS);
const store = configureStore({ settings, jwt: window.DEFAULT_JWT });

// Setup JWT refresh for authenticated sessions
if (window.DEFAULT_JWT) {
  jwt(store.dispatch, settings.user_id);
}

// Initialize localization and render app
const language = settings.language || 'en';
const defaultLanguage = settings.default_language || 'en';

initMomentJS([language, defaultLanguage], settings.custom_canvas_user_timezone);
initLocalization(['connector', 'player'], language, defaultLanguage, settings.theme)
  .then(() => {
    // Configure date picker with locale
    const dateFnsLocale = i18n.t('dateFnsLocale', { ns: 'locale', defaultValue: '' })
                        || language.split('-')[0];
    initReactDatePicker(dateFnsLocale);

    // Setup Apollo GraphQL client
    const cache = getCache();
    const graphQLNetworkErrorHandler = (networkError) => {
      if (networkError?.result?.canvas_authorization_required) {
        // Handle Canvas reauth requirement
        store.dispatch({
          type: 'GRAPHQL_ERROR_DONE',
          error: { response: { text: 'canvas_authorization_required' }}
        });
        return true;
      }
      if (networkError?.statusCode === 401) {
        setSessionExpired(true);
        return true;
      }
      return false;
    };

    const client = getClient(settings, () => store.getState().jwt,
                            [], cache, graphQLNetworkErrorHandler);

    // Render React application with LTI validation
    const mainApp = document.getElementById('main-app');
    createRoot(mainApp).render(
      <FixedResizeWrapper getSize={getSize}>
        <LtiLaunchCheck stateValidation={window.DEFAULT_SETTINGS.state_validation}>
          <DefaultRoot store={store} client={client} />
        </LtiLaunchCheck>
      </FixedResizeWrapper>
    );
  });
```

**Critical Integration Rules:**

- **Existing API Compatibility:** Never modify existing LTI endpoints, only extend
- **Database Integration:** Always use tenant_id in D1 queries for isolation
- **Error Handling:** Graceful degradation - LTI must work even if enhancements fail
- **Logging Consistency:** Use structured logging with request IDs
