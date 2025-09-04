import {  describe, it, expect , MockFactory, TestDataFactory, ServiceTestHarness } from '@/tests/infrastructure';
import { render, screen, fireEvent } from '@testing-library/react';
import { Provider } from 'react-redux';
import { configureStore } from '../../../client/store';
import { ChatWindow } from '../../../src/features/chat/client/components/ChatWindow';

import type { MockD1Database, MockKVNamespace, MockQueue } from '@/tests/infrastructure/types/mocks';
describe('ChatWindow', () => {
  const createMockStore = (openChat = false) => {
    const store = configureStore({ jwt: 'test-jwt', settings: {} });
    if (openChat) {
      store.dispatch({ type: 'chat/openChat' });
    }
    return store;
  };

  it('does not render when chat is closed', () => {
    const store = createMockStore();
    render(
      <Provider store={store}>
        <ChatWindow />
      </Provider>,
    );

    expect(screen.queryByText('Atomic Guide')).not.toBeInTheDocument();
  });

  it('renders when chat is open', () => {
    const store = createMockStore(true);
    render(
      <Provider store={store}>
        <ChatWindow />
      </Provider>,
    );

    expect(screen.getByText('Atomic Guide')).toBeInTheDocument();
  });

  it('minimizes chat when minimize button is clicked', () => {
    const store = createMockStore(true);
    render(
      <Provider store={store}>
        <ChatWindow />
      </Provider>,
    );

    const minimizeButton = screen.getByLabelText('Minimize chat');
    fireEvent.click(minimizeButton);

    const state = store.getState();
    expect(state.chat.isMinimized).toBe(true);
  });

  it('maximizes chat when maximize button is clicked', () => {
    const store = createMockStore(true);
    store.dispatch({ type: 'chat/minimizeChat' });

    render(
      <Provider store={store}>
        <ChatWindow />
      </Provider>,
    );

    const maximizeButton = screen.getByLabelText('Maximize chat');
    fireEvent.click(maximizeButton);

    const state = store.getState();
    expect(state.chat.isMinimized).toBe(false);
  });

  it('closes chat when close button is clicked', () => {
    const store = createMockStore(true);
    render(
      <Provider store={store}>
        <ChatWindow />
      </Provider>,
    );

    const closeButton = screen.getByLabelText('Close chat');
    fireEvent.click(closeButton);

    const state = store.getState();
    expect(state.chat.isOpen).toBe(false);
  });

  it('hides body content when minimized', () => {
    const store = createMockStore(true);
    store.dispatch({ type: 'chat/minimizeChat' });

    render(
      <Provider store={store}>
        <ChatWindow />
      </Provider>,
    );

    expect(screen.queryByRole('log')).not.toBeInTheDocument();
    expect(screen.queryByLabelText('Message input')).not.toBeInTheDocument();
  });

  it('shows body content when not minimized', () => {
    const store = createMockStore(true);
    render(
      <Provider store={store}>
        <ChatWindow />
      </Provider>,
    );

    expect(screen.getByRole('log')).toBeInTheDocument();
    expect(screen.getByLabelText('Message input')).toBeInTheDocument();
  });
});
