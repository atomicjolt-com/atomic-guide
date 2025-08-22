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

**RTK Query Configuration Pattern:**

```typescript
// store/api/baseApi.ts
import { createApi, fetchBaseQuery } from '@reduxjs/toolkit/query/react';
import type { RootState } from '../index';

export const baseApi = createApi({
  reducerPath: 'api',
  baseQuery: fetchBaseQuery({
    baseUrl: '/api',
    prepareHeaders: (headers, { getState }) => {
      // Add JWT token to all requests
      const token = (getState() as RootState).jwt;
      if (token) {
        headers.set('authorization', `Bearer ${token}`);
      }
      return headers;
    },
  }),
  tagTypes: ['Learner', 'Session', 'Chat', 'Intervention'],
  endpoints: () => ({}),
});

// store/api/cognitiveApi.ts
import { baseApi } from './baseApi';

export const cognitiveApi = baseApi.injectEndpoints({
  endpoints: (builder) => ({
    getLearnerProfile: builder.query<LearnerProfile, string>({
      query: (learnerId) => `learners/${learnerId}/profile`,
      providesTags: ['Learner'],
    }),
    updateLearnerProfile: builder.mutation<LearnerProfile, UpdateProfileRequest>({
      query: ({ learnerId, ...body }) => ({
        url: `learners/${learnerId}/profile`,
        method: 'PUT',
        body,
      }),
      invalidatesTags: ['Learner'],
    }),
    sendBehavioralSignals: builder.mutation<void, BehavioralSignal>({
      query: (signal) => ({
        url: 'cognitive/signals',
        method: 'POST',
        body: signal,
      }),
    }),
  }),
});

export const { useGetLearnerProfileQuery, useUpdateLearnerProfileMutation, useSendBehavioralSignalsMutation } = cognitiveApi;

// store/configure_store.ts
import { configureStore as rtkconfigureStore } from '@reduxjs/toolkit';
import { setupListeners } from '@reduxjs/toolkit/query';
import { baseApi } from './api/baseApi';
import settingsReducer from './slices/settingsSlice';
import jwtReducer from './slices/jwtSlice';

export function configureStore({ settings, jwt, apiBaseUrl }) {
  const store = rtkconfigureStore({
    reducer: {
      settings: settingsReducer,
      jwt: jwtReducer,
      [baseApi.reducerPath]: baseApi.reducer,
    },
    middleware: (getDefaultMiddleware) =>
      getDefaultMiddleware({
        serializableCheck: {
          // Ignore these action types
          ignoredActions: ['jwt/refresh'],
        },
      }).concat(baseApi.middleware),
    preloadedState: {
      settings,
      jwt,
    },
  });

  // Setup listeners for refetch on focus/reconnect
  setupListeners(store.dispatch);

  return store;
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

  // RTK Query hooks for data fetching
  const { data: learnerData, isLoading } = useGetLearnerProfileQuery(learnerId);
  const [updateProfile] = useUpdateLearnerProfileMutation();

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
import { configureStore } from './store/configure_store';
import DefaultRoot from './root';

// Polyfill es6 promises for IE
es6Promise.polyfill();

// Set app element for accessible modals
ReactModal.setAppElement('#main-app');

// Extract LTI settings from window
const settings = getInitialSettings(window.DEFAULT_SETTINGS);

// Configure Redux store with RTK Query middleware
const store = configureStore({
  settings,
  jwt: window.DEFAULT_JWT,
  // RTK Query will be configured within the store setup
  apiBaseUrl: settings.api_url || window.location.origin
});

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

    // RTK Query error handling is configured in the store middleware
    // Canvas reauthorization and 401 errors are handled by the baseApi configuration

    // Render React application with LTI validation
    const mainApp = document.getElementById('main-app');
    createRoot(mainApp).render(
      <FixedResizeWrapper getSize={getSize}>
        <LtiLaunchCheck stateValidation={window.DEFAULT_SETTINGS.state_validation}>
          <DefaultRoot store={store} />
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
