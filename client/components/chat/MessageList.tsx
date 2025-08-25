import React, { useEffect, useRef, useCallback } from 'react';
import { useAppSelector } from '../../store';
import RichMessage from './RichMessage';
import styles from '../../styles/components/chat.module.css';

export const MessageList: React.FC = () => {
  const { messages, isLoading, mediaPreferences } = useAppSelector((state) => state.chat);
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

  const handleMediaLoad = useCallback((type: string, loadTime: number) => {
    console.log(`Media loaded: ${type} in ${loadTime}ms`);
    // In a real implementation, this would be sent to analytics
  }, []);

  const handleMediaInteraction = useCallback((type: string, action: string) => {
    console.log(`Media interaction: ${type} - ${action}`);
    // Track user interactions for effectiveness measurement
  }, []);

  const handleMediaError = useCallback((type: string, error: Error) => {
    console.error(`Media error for ${type}:`, error);
    // Handle media loading errors gracefully
  }, []);

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
            {message.sender === 'ai' && (message.rich_media?.length || message.from_faq) ? (
              <RichMessage
                message={{
                  id: message.id,
                  content: message.content,
                  sender_type: message.sender === 'user' ? 'learner' : 'ai',
                  created_at: message.timestamp,
                  rich_media: message.rich_media,
                  from_faq: message.from_faq,
                  media_load_time_ms: message.media_load_time_ms
                }}
                learnerPreferences={mediaPreferences}
                onMediaLoad={handleMediaLoad}
                onMediaInteraction={handleMediaInteraction}
                onMediaError={handleMediaError}
              />
            ) : (
              <div>{message.content}</div>
            )}
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