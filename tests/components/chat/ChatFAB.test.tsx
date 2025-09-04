import { describe, it, expect, MockFactory, TestDataFactory, ServiceTestHarness } from '@/tests/infrastructure';
import { render, screen, fireEvent } from '@testing-library/react';
import { Provider } from 'react-redux';
import { configureStore } from '../../../client/store';
import { ChatFAB } from '../../../src/features/chat/client/components/ChatFAB';
import styles from '../../../src/features/chat/client/styles/chat.module.css';

import type { MockD1Database, MockKVNamespace, MockQueue } from '@/tests/infrastructure/types/mocks';
describe('ChatFAB', () => {
  const createMockStore = () => {
    return configureStore({ jwt: 'test-jwt', settings: {} });
  };

  it('renders with correct styling and accessibility attributes', () => {
    const store = createMockStore();
    render(
      <Provider store={store}>
        <ChatFAB />
      </Provider>
    );

    const button = screen.getByLabelText('Atomic Guide Assistant - Click for help');
    expect(button).toBeInTheDocument();
    expect(button).toHaveClass(styles.chatFAB);
  });

  it('toggles chat window when clicked', () => {
    const store = createMockStore();
    render(
      <Provider store={store}>
        <ChatFAB />
      </Provider>
    );

    const button = screen.getByLabelText('Atomic Guide Assistant - Click for help');
    fireEvent.click(button);

    const state = store.getState();
    expect(state.chat.isOpen).toBe(true);
  });

  it('handles keyboard navigation with Enter key', () => {
    const store = createMockStore();
    render(
      <Provider store={store}>
        <ChatFAB />
      </Provider>
    );

    const button = screen.getByLabelText('Atomic Guide Assistant - Click for help');
    fireEvent.keyDown(button, { key: 'Enter' });

    const state = store.getState();
    expect(state.chat.isOpen).toBe(true);
  });

  it('handles keyboard navigation with Space key', () => {
    const store = createMockStore();
    render(
      <Provider store={store}>
        <ChatFAB />
      </Provider>
    );

    const button = screen.getByLabelText('Atomic Guide Assistant - Click for help');
    fireEvent.keyDown(button, { key: ' ' });

    const state = store.getState();
    expect(state.chat.isOpen).toBe(true);
  });

  it('applies active class when chat is open', () => {
    const store = createMockStore();
    store.dispatch({ type: 'chat/openChat' });

    render(
      <Provider store={store}>
        <ChatFAB />
      </Provider>
    );

    const button = screen.getByLabelText('Atomic Guide Assistant - Click for help');
    expect(button).toHaveClass(styles.active);
  });

  it('is keyboard accessible with tabIndex', () => {
    const store = createMockStore();
    render(
      <Provider store={store}>
        <ChatFAB />
      </Provider>
    );

    const button = screen.getByLabelText('Atomic Guide Assistant - Click for help');
    expect(button).toHaveAttribute('tabIndex', '0');
  });
});
