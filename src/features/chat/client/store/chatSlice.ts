import { createSlice, PayloadAction } from '@reduxjs/toolkit';
import type { RichMediaContent, MediaPreferences } from '../../../../client/types';

export interface ChatMessage {
  id: string;
  content: string;
  sender: 'user' | 'ai';
  timestamp: string;
  rich_media?: RichMediaContent[];
  from_faq?: {
    faq_id: string;
    confidence: number;
  };
  media_load_time_ms?: number;
}

export interface ChatState {
  isOpen: boolean;
  isMinimized: boolean;
  messages: ChatMessage[];
  conversationId: string | null;
  isLoading: boolean;
  error: string | null;
  mediaPreferences: MediaPreferences;
}

const initialState: ChatState = {
  isOpen: false,
  isMinimized: false,
  messages: [],
  conversationId: null,
  isLoading: false,
  error: null,
  mediaPreferences: {
    prefers_visual: true,
    math_notation_style: 'latex',
    code_highlight_theme: 'light',
    diagram_complexity: 'detailed',
    bandwidth_preference: 'high',
  },
};

const chatSlice = createSlice({
  name: 'chat',
  initialState,
  reducers: {
    toggleChat: (state) => {
      state.isOpen = !state.isOpen;
      if (state.isOpen) {
        state.isMinimized = false;
      }
    },
    openChat: (state) => {
      state.isOpen = true;
      state.isMinimized = false;
    },
    closeChat: (state) => {
      state.isOpen = false;
      state.isMinimized = false;
    },
    minimizeChat: (state) => {
      state.isMinimized = true;
    },
    maximizeChat: (state) => {
      state.isMinimized = false;
    },
    addMessage: (state, action: PayloadAction<ChatMessage>) => {
      state.messages.push(action.payload);
    },
    setConversationId: (state, action: PayloadAction<string>) => {
      state.conversationId = action.payload;
    },
    setLoading: (state, action: PayloadAction<boolean>) => {
      state.isLoading = action.payload;
    },
    setError: (state, action: PayloadAction<string | null>) => {
      state.error = action.payload;
    },
    clearMessages: (state) => {
      state.messages = [];
      state.conversationId = null;
    },
    setMediaPreferences: (state, action: PayloadAction<MediaPreferences>) => {
      state.mediaPreferences = action.payload;
    },
  },
});

export const {
  toggleChat,
  openChat,
  closeChat,
  minimizeChat,
  maximizeChat,
  addMessage,
  setConversationId,
  setLoading,
  setError,
  clearMessages,
  setMediaPreferences,
} = chatSlice.actions;

export default chatSlice.reducer;
