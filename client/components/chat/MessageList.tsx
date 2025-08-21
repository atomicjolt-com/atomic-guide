import React, { useEffect, useRef } from 'react';
import { useAppSelector } from '../../store';
import styles from '../../styles/components/chat.module.css';

export const MessageList: React.FC = () => {
  const { messages, isLoading } = useAppSelector((state) => state.chat);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const formatTimestamp = (timestamp: string) => {
    const date = new Date(timestamp);
    return date.toLocaleTimeString('en-US', { 
      hour: '2-digit', 
      minute: '2-digit' 
    });
  };

  return (
    <div className={styles.messageList} role="log" aria-label="Chat messages">
      {messages.map((message) => (
        <div
          key={message.id}
          className={`${styles.message} ${styles[message.sender]}`}
          role="article"
          aria-label={`${message.sender === 'user' ? 'You' : 'Atomic Guide'}: ${message.content}`}
        >
          <div className={styles.messageBubble}>
            <div>{message.content}</div>
            <div className={styles.messageTimestamp}>
              {formatTimestamp(message.timestamp)}
            </div>
          </div>
        </div>
      ))}
      
      {isLoading && (
        <div className={`${styles.message} ${styles.ai}`}>
          <div className={styles.loadingIndicator} aria-label="Atomic Guide is typing">
            <span className={styles.loadingDot}></span>
            <span className={styles.loadingDot}></span>
            <span className={styles.loadingDot}></span>
          </div>
        </div>
      )}
      
      <div ref={messagesEndRef} />
    </div>
  );
};