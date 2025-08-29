# 10. Frontend Architecture

## Two-UI Architecture Overview

Based on the front-end specification, Atomic Guide operates through two distinct but connected user interfaces:

1. **Persistent Overlay UI** - Always-visible indicator icon on LMS pages that expands to reveal:
   - Contextual chat interface with 380px width (desktop), 100% - 32px (mobile)
   - Inline learning activities (flash cards, quizzes, videos)
   - Quick actions and help
   - Minimal footprint (48x48px desktop, 40x40px mobile) with maximum accessibility

2. **LTI Portal UI** - Full-featured application accessed via LTI launch providing:
   - Comprehensive dashboards and analytics
   - Privacy controls and data management
   - Study scheduling and progress tracking
   - Role-specific interfaces (Student/Faculty/Coach)

## Component Architecture

### Component Organization

```
client/
├── components/
│   ├── assessment/
│   │   ├── ChatAssessment/
│   │   │   ├── ChatAssessment.tsx
│   │   │   ├── ChatMessage.tsx
│   │   │   ├── ChatInput.tsx
│   │   │   └── index.ts
│   │   ├── DeepLinkConfig/
│   │   │   ├── DeepLinkConfig.tsx
│   │   │   ├── AssessmentTypeSelector.tsx
│   │   │   ├── GradingSchemaConfig.tsx
│   │   │   └── index.ts
│   │   ├── Dashboard/
│   │   │   ├── AnalyticsDashboard.tsx
│   │   │   ├── ProgressChart.tsx
│   │   │   ├── MisconceptionsList.tsx
│   │   │   └── index.ts
│   │   └── shared/
│   │       ├── LoadingSpinner.tsx
│   │       ├── ErrorBoundary.tsx
│   │       └── Modal.tsx
│   ├── cognitive/
│   │   ├── ProfileView.tsx
│   │   └── InterventionOverlay.tsx
│   ├── chat/
│   │   ├── ChatFAB.tsx
│   │   ├── ChatWindow.tsx
│   │   ├── MessageList.tsx
│   │   ├── MessageInput.tsx
│   │   ├── ContextBadge.tsx
│   │   ├── RichMessage.tsx
│   │   └── ActivityCard.tsx
│   └── legacy/           # Existing vanilla JS components
├── hooks/
│   ├── useWebSocket.ts
│   ├── useCanvasPostMessage.ts
│   ├── useAssessmentConfig.ts
│   ├── useLTIContext.ts
│   ├── useCanvasMonitor.ts
│   ├── useLearnerProfile.ts
│   ├── useChat.ts
│   └── useContentExtractor.ts
├── services/
│   ├── api/
│   │   ├── assessmentApi.ts
│   │   ├── analyticsApi.ts
│   │   └── apiClient.ts
│   └── websocket/
│       └── conversationSocket.ts
├── store/
│   ├── configure_store.ts
│   ├── index.ts
│   ├── slices/
│   │   ├── learnerSlice.ts
│   │   ├── sessionSlice.ts
│   │   └── jwtSlice.ts
│   └── api/
│       ├── cognitiveApi.ts
│       ├── chatApi.ts
│       ├── learnerApi.ts
│       └── baseApi.ts
├── stores/
│   ├── conversationStore.ts
│   ├── configStore.ts
│   └── analyticsStore.ts
└── utils/
    ├── canvasIntegration.ts
    ├── gradeCalculator.ts
    └── contentExtractor.ts
```

### React-Based LTI Launch Entry Point

**Responsibility:** Initialize React application after successful LTI authentication, manage JWT refresh, configure localization and client-side state

**Initialization Flow:**

1. Polyfill loading (ES6 promises, core-js, custom events)
2. Extract initial settings from `window.DEFAULT_SETTINGS`
3. Configure Redux store with settings, JWT, and RTK Query middleware
4. Initialize JWT refresh mechanism for authenticated user
5. Setup localization based on Canvas user language preferences
6. Initialize date picker with locale-specific formatting
7. Configure RTK Query API endpoints with JWT authorization
8. Handle Canvas reauthorization requirements via RTK Query error handler
9. Render React app with `LtiLaunchCheck` validation wrapper
10. Apply responsive sizing with `FixedResizeWrapper`

### Component Template

```typescript
// Example: ChatAssessment component
import React, { useEffect, useState } from 'react';
import { useWebSocket } from '@/hooks/useWebSocket';
import { useConversationStore } from '@/stores/conversationStore';
import { ChatMessage } from './ChatMessage';
import { ChatInput } from './ChatInput';

interface ChatAssessmentProps {
  assessmentConfigId: string;
  pageContent: string;
}

export const ChatAssessment: React.FC<ChatAssessmentProps> = ({
  assessmentConfigId,
  pageContent
}) => {
  const { messages, addMessage, setMastery } = useConversationStore();
  const { sendMessage, isConnected } = useWebSocket();

  const handleSendMessage = async (content: string) => {
    await sendMessage({
      type: 'chat',
      content,
      context: { pageContent }
    });
  };

  return (
    <div className="chat-assessment">
      <div className="chat-messages">
        {messages.map(msg => (
          <ChatMessage key={msg.id} message={msg} />
        ))}
      </div>
      <ChatInput
        onSend={handleSendMessage}
        disabled={!isConnected}
      />
    </div>
  );
};
```

## State Management Architecture

### Redux Toolkit + RTK Query Configuration

```typescript
// store/configure_store.ts
import { configureStore } from '@reduxjs/toolkit';
import { setupListeners } from '@reduxjs/toolkit/query';
import authReducer from './slices/authSlice';
import assessmentReducer from './slices/assessmentSlice';
import chatReducer from './slices/chatSlice';
import uiReducer from './slices/uiSlice';
import { assessmentApi } from './api/assessmentApi';
import { canvasApi } from './api/canvasApi';
import { chatApi } from './api/chatApi';
import { chatWebSocketMiddleware } from './middleware/chatWebSocket';

export function configureStore() {
  const store = configureStore({
    reducer: {
      // Core feature slices
      auth: authReducer,
      assessment: assessmentReducer,
      chat: chatReducer,
      ui: uiReducer,
      // RTK Query API slices
      [assessmentApi.reducerPath]: assessmentApi.reducer,
      [canvasApi.reducerPath]: canvasApi.reducer,
      [chatApi.reducerPath]: chatApi.reducer,
    },
    middleware: (getDefaultMiddleware) =>
      getDefaultMiddleware({
        serializableCheck: {
          ignoredActions: ['chat/messageReceived', 'auth/tokenRefresh'],
          ignoredActionPaths: ['meta.arg', 'payload.timestamp'],
        },
      })
        .concat(assessmentApi.middleware)
        .concat(canvasApi.middleware)
        .concat(chatApi.middleware)
        .concat(chatWebSocketMiddleware),
  });

  setupListeners(store.dispatch);
  return store;
}

// Type exports for TypeScript
export type RootState = ReturnType<typeof store.getState>;
export type AppDispatch = typeof store.dispatch;

// Typed hooks
import { useDispatch, useSelector } from 'react-redux';
export const useAppDispatch = () => useDispatch<AppDispatch>();
export const useAppSelector: TypedUseSelectorHook<RootState> = useSelector;
```

### Feature Slice Example with Redux Toolkit

```typescript
// store/slices/assessmentSlice.ts
import { createSlice, createAsyncThunk, PayloadAction } from '@reduxjs/toolkit';

interface AssessmentState {
  activeConfig: AssessmentConfig | null;
  activeConversation: Conversation | null;
  progress: StudentProgress | null;
  loading: boolean;
  error: string | null;
}

const initialState: AssessmentState = {
  activeConfig: null,
  activeConversation: null,
  progress: null,
  loading: false,
  error: null,
};

// Async thunks for complex operations
export const initializeAssessment = createAsyncThunk('assessment/initialize', async (configId: string, { dispatch, extra }) => {
  // Load config, create conversation, setup WebSocket
  const config = await api.getAssessmentConfig(configId);
  const conversation = await api.createConversation(config.id);
  return { config, conversation };
});

const assessmentSlice = createSlice({
  name: 'assessment',
  initialState,
  reducers: {
    setActiveConfig: (state, action: PayloadAction<AssessmentConfig>) => {
      state.activeConfig = action.payload;
    },
    updateProgress: (state, action: PayloadAction<Partial<StudentProgress>>) => {
      state.progress = { ...state.progress, ...action.payload };
    },
    clearAssessment: (state) => {
      return initialState;
    },
  },
  extraReducers: (builder) => {
    builder
      .addCase(initializeAssessment.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(initializeAssessment.fulfilled, (state, action) => {
        state.loading = false;
        state.activeConfig = action.payload.config;
        state.activeConversation = action.payload.conversation;
      })
      .addCase(initializeAssessment.rejected, (state, action) => {
        state.loading = false;
        state.error = action.error.message || 'Failed to initialize assessment';
      });
  },
});

export const { setActiveConfig, updateProgress, clearAssessment } = assessmentSlice.actions;
export default assessmentSlice.reducer;
```

## Routing Architecture

### Route Organization

```
/lti/launch                    # Existing LTI launch page
/lti/deep_link                 # Deep link configuration
/assessment/chat/:id           # Chat assessment interface
/assessment/dashboard          # Instructor analytics dashboard
/assessment/config/:id/edit    # Edit assessment configuration
```

### Protected Route Pattern

```typescript
import { Navigate } from 'react-router-dom';
import { useLTIContext } from '@/hooks/useLTIContext';

interface ProtectedRouteProps {
  children: React.ReactNode;
  requireRole?: 'instructor' | 'student';
}

export const ProtectedRoute: React.FC<ProtectedRouteProps> = ({
  children,
  requireRole
}) => {
  const { user, isLoading } = useLTIContext();

  if (isLoading) return <LoadingSpinner />;

  if (!user) {
    return <Navigate to="/lti/launch" replace />;
  }

  if (requireRole && user.role !== requireRole) {
    return <Navigate to="/unauthorized" replace />;
  }

  return <>{children}</>;
};
```

## Frontend Services Layer

### API Client Setup

```typescript
// Base API client configuration
import axios from 'axios';

const API_BASE_URL = import.meta.env.VITE_API_URL || '/api';

export const apiClient = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Add LTI JWT token to requests
apiClient.interceptors.request.use((config) => {
  const token = sessionStorage.getItem('lti_token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// Handle errors globally
apiClient.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      window.location.href = '/lti/launch';
    }
    return Promise.reject(error);
  }
);
```
