import React from 'react';
import { useAppDispatch, useAppSelector } from '../../store';
import { closeChat, minimizeChat, maximizeChat } from '../../store/slices/chatSlice';
import { MessageList } from './MessageList';
import { MessageInput } from './MessageInput';
import { ErrorMessage } from './ErrorMessage';
import styles from '../../styles/components/chat.module.css';

export const ChatWindow: React.FC = () => {
  const dispatch = useAppDispatch();
  const { isOpen, isMinimized } = useAppSelector((state) => state.chat);

  if (!isOpen) {
    return null;
  }

  const handleMinimize = () => {
    dispatch(minimizeChat());
  };

  const handleMaximize = () => {
    dispatch(maximizeChat());
  };

  const handleClose = () => {
    dispatch(closeChat());
  };

  return (
    <div className={`${styles.chatWindow} ${isMinimized ? styles.minimized : ''}`}>
      <div className={styles.chatHeader}>
        <h2 className={styles.chatTitle}>Atomic Guide</h2>
        <div className={styles.chatControls}>
          {isMinimized ? (
            <button
              className={styles.chatControlBtn}
              onClick={handleMaximize}
              aria-label="Maximize chat"
            >
              <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
                <path d="M3 5h10v2H3z" />
                <path d="M3 9h10v2H3z" />
              </svg>
            </button>
          ) : (
            <button
              className={styles.chatControlBtn}
              onClick={handleMinimize}
              aria-label="Minimize chat"
            >
              <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
                <path d="M3 8h10v2H3z" />
              </svg>
            </button>
          )}
          <button
            className={styles.chatControlBtn}
            onClick={handleClose}
            aria-label="Close chat"
          >
            <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
              <path d="M12.354 4.354a.5.5 0 0 0-.708-.708L8 7.293 4.354 3.646a.5.5 0 1 0-.708.708L7.293 8l-3.647 3.646a.5.5 0 0 0 .708.708L8 8.707l3.646 3.647a.5.5 0 0 0 .708-.708L8.707 8l3.647-3.646z" />
            </svg>
          </button>
        </div>
      </div>
      {!isMinimized && (
        <div className={styles.chatBody}>
          <ErrorMessage />
          <MessageList />
          <MessageInput />
        </div>
      )}
    </div>
  );
};