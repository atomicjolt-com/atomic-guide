import React from 'react';
import { useAppSelector, useAppDispatch } from '@shared/client/store';
import { setError } from '@features/chat/client/store/chatSlice';
import styles from './ErrorMessage.module.css';

export const ErrorMessage: React.FC = () => {
  const dispatch = useAppDispatch();
  const error = useAppSelector((state) => state.chat.error);

  if (!error) {
    return null;
  }

  const handleDismiss = () => {
    dispatch(setError(null));
  };

  return (
    <div className={styles.errorMessage} role="alert">
      <div className={styles.errorContent}>
        <svg 
          className={styles.errorIcon}
          width="16" 
          height="16" 
          viewBox="0 0 16 16" 
          fill="currentColor"
        >
          <path d="M8 1a7 7 0 1 0 0 14A7 7 0 0 0 8 1zM7 4h2v5H7V4zm0 6h2v2H7v-2z"/>
        </svg>
        <span className={styles.errorText}>{error}</span>
      </div>
      <button
        className={styles.errorDismiss}
        onClick={handleDismiss}
        aria-label="Dismiss error"
      >
        <svg width="14" height="14" viewBox="0 0 14 14" fill="currentColor">
          <path d="M13.3.7a1 1 0 0 0-1.4 0L7 5.6 2.1.7A1 1 0 0 0 .7 2.1L5.6 7 .7 11.9a1 1 0 0 0 1.4 1.4L7 8.4l4.9 4.9a1 1 0 0 0 1.4-1.4L8.4 7l4.9-4.9a1 1 0 0 0 0-1.4z"/>
        </svg>
      </button>
    </div>
  );
};