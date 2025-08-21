import React from 'react';
import { useAppDispatch, useAppSelector } from '../../store';
import { toggleChat } from '../../store/slices/chatSlice';
import styles from '../../styles/components/chat.module.css';

export const ChatFAB: React.FC = () => {
  const dispatch = useAppDispatch();
  const isOpen = useAppSelector((state) => state.chat.isOpen);

  const handleClick = () => {
    dispatch(toggleChat());
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      handleClick();
    }
  };

  return (
    <button
      className={`${styles.chatFAB} ${isOpen ? styles.active : ''}`}
      onClick={handleClick}
      onKeyDown={handleKeyDown}
      aria-label="Atomic Guide Assistant - Click for help"
      tabIndex={0}
    >
      <svg
        width="24"
        height="24"
        viewBox="0 0 24 24"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        aria-hidden="true"
      >
        <path
          d="M12 2C6.48 2 2 6.48 2 12C2 13.86 2.5 15.6 3.38 17.08L2.05 21.42C1.97 21.65 2.04 21.9 2.21 22.07C2.34 22.2 2.52 22.27 2.7 22.27C2.75 22.27 2.81 22.26 2.86 22.25L7.2 20.92C8.68 21.8 10.34 22.3 12.1 22.3C17.62 22.3 22.1 17.82 22.1 12.3C22.1 6.78 17.52 2 12 2ZM12 20C10.59 20 9.27 19.58 8.14 18.85L7.71 18.59L4.79 19.47L5.67 16.55L5.41 16.12C4.68 14.99 4.26 13.67 4.26 12.26C4.26 7.76 7.76 4.26 12.26 4.26C16.76 4.26 20.26 7.76 20.26 12.26C20.26 16.76 16.5 20 12 20Z"
          fill="currentColor"
        />
        <circle cx="8" cy="12" r="1" fill="currentColor" />
        <circle cx="12" cy="12" r="1" fill="currentColor" />
        <circle cx="16" cy="12" r="1" fill="currentColor" />
      </svg>
    </button>
  );
};