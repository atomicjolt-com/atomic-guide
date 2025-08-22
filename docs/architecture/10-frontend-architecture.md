# 10. Frontend Architecture

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
│   └── legacy/           # Existing vanilla JS components
├── hooks/
│   ├── useWebSocket.ts
│   ├── useCanvasPostMessage.ts
│   ├── useAssessmentConfig.ts
│   └── useLTIContext.ts
├── services/
│   ├── api/
│   │   ├── assessmentApi.ts
│   │   ├── analyticsApi.ts
│   │   └── apiClient.ts
│   └── websocket/
│       └── conversationSocket.ts
├── stores/
│   ├── conversationStore.ts
│   ├── configStore.ts
│   └── analyticsStore.ts
└── utils/
    ├── canvasIntegration.ts
    ├── gradeCalculator.ts
    └── contentExtractor.ts
```

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

### State Structure

```typescript
// Zustand store for conversation state
interface ConversationState {
  conversationId: string | null;
  messages: Message[];
  masteryScore: number;
  status: 'idle' | 'active' | 'completed';

  // Actions
  initConversation: (configId: string) => Promise<void>;
  addMessage: (message: Message) => void;
  updateMastery: (score: number) => void;
  completeConversation: () => void;
}

// Zustand store definition
import { create } from 'zustand';

export const useConversationStore = create<ConversationState>((set, get) => ({
  conversationId: null,
  messages: [],
  masteryScore: 0,
  status: 'idle',

  initConversation: async (configId) => {
    const response = await assessmentApi.startConversation(configId);
    set({
      conversationId: response.conversationId,
      status: 'active',
    });
  },

  addMessage: (message) => {
    set((state) => ({
      messages: [...state.messages, message],
    }));
  },

  updateMastery: (score) => {
    set({ masteryScore: score });
  },

  completeConversation: () => {
    set({ status: 'completed' });
  },
}));
```

### State Management Patterns

- Use Zustand for global state (conversation, config, analytics)
- Local component state for UI-only concerns
- Derive computed values using selectors
- Implement optimistic updates for chat messages
- Persist critical state to sessionStorage for recovery

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
// Protected route wrapper for instructor-only pages
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
  },
);
```

### Service Example

```typescript
// Assessment API service
export const assessmentApi = {
  async createConfig(config: AssessmentConfig) {
    const { data } = await apiClient.post('/assessment/config', config);
    return data;
  },

  async startConversation(configId: string, pageContent: string) {
    const { data } = await apiClient.post('/assessment/conversation', {
      assessment_config_id: configId,
      page_content: pageContent,
    });
    return data;
  },

  async submitGrade(conversationId: string, score: number) {
    const { data } = await apiClient.post('/assessment/grade', {
      conversation_id: conversationId,
      score,
    });
    return data;
  },

  async getAnalytics(courseId: string, assignmentId?: string) {
    const { data } = await apiClient.get('/assessment/analytics', {
      params: { course_id: courseId, assignment_id: assignmentId },
    });
    return data;
  },
};
```
