import React, { useState, useRef, KeyboardEvent } from 'react';
import { useAppDispatch, useAppSelector } from '../../store';
import { addMessage, setLoading, setError, setConversationId } from '../../store/slices/chatSlice';
import { useSendMessageMutation } from '../../store/api/chatApi';
import { useContentExtractor } from '../../hooks/useContentExtractor';
import styles from '../../styles/components/chat.module.css';

export const MessageInput: React.FC = () => {
  const dispatch = useAppDispatch();
  const { isLoading, conversationId } = useAppSelector((state) => state.chat);
  const [message, setMessage] = useState('');
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const [sendMessage] = useSendMessageMutation();
  const pageContext = useContentExtractor();

  const generateMessageId = () => {
    return `msg-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  };

  const getSessionId = () => {
    const launchSettings = (window as any).LAUNCH_SETTINGS;
    return launchSettings?.session_id || `session-${Date.now()}`;
  };

  const handleSend = async() => {
    if (!message.trim() || isLoading) {
      return;
    }

    const userMessage = {
      id: generateMessageId(),
      content: message.trim(),
      sender: 'user' as const,
      timestamp: new Date().toISOString(),
    };

    dispatch(addMessage(userMessage));
    setMessage('');
    dispatch(setLoading(true));
    dispatch(setError(null));

    try {
      const response = await sendMessage({
        session_id: getSessionId(),
        message: userMessage.content,
        page_context: {
          course_id: pageContext.course_id,
          module_id: pageContext.module_id,
          page_content: pageContext.page_content,
          current_element: pageContext.current_element,
        },
        conversation_id: conversationId || undefined,
      }).unwrap();

      if (!conversationId && response.conversation_id) {
        dispatch(setConversationId(response.conversation_id));
      }

      const aiResponse = {
        id: response.message_id,
        content: response.content,
        sender: 'ai' as const,
        timestamp: response.timestamp,
      };
      
      dispatch(addMessage(aiResponse));
    } catch (error: any) {
      dispatch(setError(error?.error || 'Failed to send message. Please try again.'));
      
      if (error?.retry_after) {
        setTimeout(() => {
          dispatch(setError(null));
        }, error.retry_after * 1000);
      }
    } finally {
      dispatch(setLoading(false));
    }
  };

  const handleKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  return (
    <div className={styles.messageInput}>
      <textarea
        ref={inputRef}
        className={styles.inputField}
        value={message}
        onChange={(e) => setMessage(e.target.value)}
        onKeyDown={handleKeyDown}
        placeholder="Type your message..."
        disabled={isLoading}
        aria-label="Message input"
        rows={1}
      />
      <button
        className={styles.sendButton}
        onClick={handleSend}
        disabled={!message.trim() || isLoading}
        aria-label="Send message"
      >
        <svg width="20" height="20" viewBox="0 0 20 20" fill="currentColor">
          <path d="M2.925 5.025l14.96-4.98a.5.5 0 0 1 .628.628l-4.98 14.96a.5.5 0 0 1-.933.039l-2.85-5.7a.5.5 0 0 0-.2-.2l-5.7-2.85a.5.5 0 0 1 .039-.933l.036.036zm7.825 4.225l5.536-5.536L3.858 4.642l4.036 2.018a1.5 1.5 0 0 1 .6.6l2.256 4.49z" />
        </svg>
      </button>
    </div>
  );
};