import { describe, it, expect } from 'vitest';
import chatReducer, {
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
} from '@features/chat/client/store/chatSlice';

describe('chatSlice', () => {
  const initialState = {
    isOpen: false,
    isMinimized: false,
    messages: [],
    conversationId: null,
    isLoading: false,
    error: null,
  };

  const mockMessage = {
    id: 'msg-1',
    content: 'Test message',
    sender: 'user' as const,
    timestamp: '2025-01-20T10:00:00Z',
  };

  it('should handle toggleChat', () => {
    const state = chatReducer(initialState, toggleChat());
    expect(state.isOpen).toBe(true);
    
    const nextState = chatReducer(state, toggleChat());
    expect(nextState.isOpen).toBe(false);
  });

  it('should handle openChat', () => {
    const state = chatReducer(initialState, openChat());
    expect(state.isOpen).toBe(true);
    expect(state.isMinimized).toBe(false);
  });

  it('should handle closeChat', () => {
    const openState = { ...initialState, isOpen: true, isMinimized: true };
    const state = chatReducer(openState, closeChat());
    expect(state.isOpen).toBe(false);
    expect(state.isMinimized).toBe(false);
  });

  it('should handle minimizeChat', () => {
    const state = chatReducer(initialState, minimizeChat());
    expect(state.isMinimized).toBe(true);
  });

  it('should handle maximizeChat', () => {
    const minimizedState = { ...initialState, isMinimized: true };
    const state = chatReducer(minimizedState, maximizeChat());
    expect(state.isMinimized).toBe(false);
  });

  it('should handle addMessage', () => {
    const state = chatReducer(initialState, addMessage(mockMessage));
    expect(state.messages).toHaveLength(1);
    expect(state.messages[0]).toEqual(mockMessage);
  });

  it('should handle setConversationId', () => {
    const state = chatReducer(initialState, setConversationId('conv-123'));
    expect(state.conversationId).toBe('conv-123');
  });

  it('should handle setLoading', () => {
    const state = chatReducer(initialState, setLoading(true));
    expect(state.isLoading).toBe(true);
    
    const nextState = chatReducer(state, setLoading(false));
    expect(nextState.isLoading).toBe(false);
  });

  it('should handle setError', () => {
    const state = chatReducer(initialState, setError('Test error'));
    expect(state.error).toBe('Test error');
    
    const nextState = chatReducer(state, setError(null));
    expect(nextState.error).toBeNull();
  });

  it('should handle clearMessages', () => {
    const stateWithMessages = {
      ...initialState,
      messages: [mockMessage],
      conversationId: 'conv-123',
    };
    const state = chatReducer(stateWithMessages, clearMessages());
    expect(state.messages).toHaveLength(0);
    expect(state.conversationId).toBeNull();
  });

  it('should reset isMinimized when opening chat', () => {
    const minimizedState = { ...initialState, isMinimized: true };
    const state = chatReducer(minimizedState, toggleChat());
    expect(state.isOpen).toBe(true);
    expect(state.isMinimized).toBe(false);
  });
});