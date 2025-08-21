import { createSlice, PayloadAction } from '@reduxjs/toolkit';

export interface ChatMessage {
  id: string;
  content: string;
  sender: 'user' | 'ai';
  timestamp: string;
}

export interface ChatState {
  isOpen: boolean;
  isMinimized: boolean;
  messages: ChatMessage[];
  conversationId: string | null;
  isLoading: boolean;
  error: string | null;
}

const initialState: ChatState = {
  isOpen: false,
  isMinimized: false,
  messages: [],
  conversationId: null,
  isLoading: false,
  error: null,
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
} = chatSlice.actions;

export default chatSlice.reducer;