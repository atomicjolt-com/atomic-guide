import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { Provider } from 'react-redux';
import { configureStore } from '../../../client/store';
import { MessageList } from '../../../client/components/chat/MessageList';
import { addMessage } from '../../../client/store/slices/chatSlice';
import styles from '../../../client/styles/components/chat.module.css';

describe('MessageList', () => {
  const createMockStore = () => {
    return configureStore({ jwt: 'test-jwt', settings: {} });
  };

  const mockUserMessage = {
    id: 'msg-1',
    content: 'Hello, I need help',
    sender: 'user' as const,
    timestamp: new Date().toISOString(),
  };

  const mockAIMessage = {
    id: 'msg-2',
    content: 'Hello! How can I assist you today?',
    sender: 'ai' as const,
    timestamp: new Date().toISOString(),
  };

  it('renders empty list when no messages', () => {
    const store = createMockStore();
    render(
      <Provider store={store}>
        <MessageList />
      </Provider>
    );
    
    const messageList = screen.getByRole('log');
    expect(messageList).toBeInTheDocument();
    expect(messageList.children).toHaveLength(1);
  });

  it('renders user messages with correct styling', () => {
    const store = createMockStore();
    store.dispatch(addMessage(mockUserMessage));
    
    render(
      <Provider store={store}>
        <MessageList />
      </Provider>
    );
    
    const message = screen.getByText('Hello, I need help');
    expect(message).toBeInTheDocument();
    
    const messageElement = screen.getByRole('article', { 
      name: /You: Hello, I need help/i 
    });
    expect(messageElement).toHaveClass(styles.message, styles.user);
  });

  it('renders AI messages with correct styling', () => {
    const store = createMockStore();
    store.dispatch(addMessage(mockAIMessage));
    
    render(
      <Provider store={store}>
        <MessageList />
      </Provider>
    );
    
    const message = screen.getByText('Hello! How can I assist you today?');
    expect(message).toBeInTheDocument();
    
    const messageElement = screen.getByRole('article', { 
      name: /Atomic Guide: Hello! How can I assist you today?/i 
    });
    expect(messageElement).toHaveClass(styles.message, styles.ai);
  });

  it('renders multiple messages in order', () => {
    const store = createMockStore();
    store.dispatch(addMessage(mockUserMessage));
    store.dispatch(addMessage(mockAIMessage));
    
    render(
      <Provider store={store}>
        <MessageList />
      </Provider>
    );
    
    const messages = screen.getAllByRole('article');
    expect(messages).toHaveLength(2);
    expect(messages[0]).toHaveClass(styles.user);
    expect(messages[1]).toHaveClass(styles.ai);
  });

  it('displays loading indicator when isLoading is true', () => {
    const store = createMockStore();
    store.dispatch({ type: 'chat/setLoading', payload: true });
    
    render(
      <Provider store={store}>
        <MessageList />
      </Provider>
    );
    
    const loadingIndicator = screen.getByLabelText('Atomic Guide is typing');
    expect(loadingIndicator).toBeInTheDocument();
  });

  it('formats timestamps correctly', () => {
    const store = createMockStore();
    const testDate = '2025-01-20T15:30:00Z';
    const messageWithTime = {
      ...mockUserMessage,
      timestamp: testDate,
    };
    store.dispatch(addMessage(messageWithTime));
    
    render(
      <Provider store={store}>
        <MessageList />
      </Provider>
    );
    
    const formattedTime = new Date(testDate).toLocaleTimeString('en-US', { 
      hour: '2-digit', 
      minute: '2-digit' 
    });
    expect(screen.getByText(formattedTime)).toBeInTheDocument();
  });

  it('scrolls to bottom when new messages are added', () => {
    const scrollIntoViewMock = vi.fn();
    HTMLElement.prototype.scrollIntoView = scrollIntoViewMock;
    
    const store = createMockStore();
    const { rerender } = render(
      <Provider store={store}>
        <MessageList />
      </Provider>
    );
    
    store.dispatch(addMessage(mockUserMessage));
    rerender(
      <Provider store={store}>
        <MessageList />
      </Provider>
    );
    
    expect(scrollIntoViewMock).toHaveBeenCalledWith({ behavior: 'smooth' });
  });
});