import React, { useState, useCallback, useMemo } from 'react';
import { format, formatDistanceToNow } from 'date-fns';
import styles from '../../styles/components/chat-history.module.css';

interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: string;
}

interface ConversationSummary {
  id: string;
  title: string;
  summary: string;
  messageCount: number;
  topics: string[];
  startedAt: string;
  lastMessageAt: string;
  messages?: ChatMessage[];
}

interface ChatHistoryProps {
  conversations: ConversationSummary[];
  isLoading?: boolean;
  onConversationSelect?: (conversationId: string) => void;
  onConversationDelete?: (conversationId: string) => void;
  onSearch?: (query: string) => void;
}

// Simple text sanitization to prevent XSS
function sanitizeText(text: string): string {
  return text.replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#x27;').replace(/\//g, '&#x2F;');
}

export default function ChatHistory({
  conversations,
  isLoading = false,
  onConversationSelect,
  onConversationDelete,
  onSearch,
}: ChatHistoryProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedConversationId, setSelectedConversationId] = useState<string | null>(null);
  const [filterTopic, setFilterTopic] = useState<string>('');
  const [expandedConversations, setExpandedConversations] = useState<Set<string>>(new Set());

  const allTopics = useMemo(() => {
    const topicsSet = new Set<string>();
    conversations.forEach((conv) => {
      conv.topics.forEach((topic) => topicsSet.add(topic));
    });
    return Array.from(topicsSet).sort();
  }, [conversations]);

  const filteredConversations = useMemo(() => {
    let filtered = conversations;

    if (searchQuery) {
      filtered = filtered.filter(
        (conv) =>
          conv.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
          conv.summary.toLowerCase().includes(searchQuery.toLowerCase()) ||
          conv.topics.some((topic) => topic.toLowerCase().includes(searchQuery.toLowerCase()))
      );
    }

    if (filterTopic) {
      filtered = filtered.filter((conv) => conv.topics.includes(filterTopic));
    }

    return filtered;
  }, [conversations, searchQuery, filterTopic]);

  const handleSearchChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const query = e.target.value;
      setSearchQuery(query);
      if (onSearch) {
        onSearch(query);
      }
    },
    [onSearch]
  );

  const handleConversationClick = useCallback(
    (conversationId: string) => {
      setSelectedConversationId(conversationId);
      if (onConversationSelect) {
        onConversationSelect(conversationId);
      }
    },
    [onConversationSelect]
  );

  const toggleConversationExpanded = useCallback(
    (conversationId: string, e: React.MouseEvent) => {
      e.stopPropagation();
      const newExpanded = new Set(expandedConversations);
      if (newExpanded.has(conversationId)) {
        newExpanded.delete(conversationId);
      } else {
        newExpanded.add(conversationId);
      }
      setExpandedConversations(newExpanded);
    },
    [expandedConversations]
  );

  const handleDelete = useCallback(
    (conversationId: string, e: React.MouseEvent) => {
      e.stopPropagation();
      if (onConversationDelete && window.confirm('Are you sure you want to delete this conversation?')) {
        onConversationDelete(conversationId);
      }
    },
    [onConversationDelete]
  );

  const renderConversationCard = (conversation: ConversationSummary) => {
    const isExpanded = expandedConversations.has(conversation.id);
    const isSelected = selectedConversationId === conversation.id;

    return (
      <div
        key={conversation.id}
        className={`${styles.conversationCard} ${isSelected ? styles.selected : ''}`}
        onClick={() => handleConversationClick(conversation.id)}
      >
        <div className={styles.cardHeader}>
          <div className={styles.cardTitle}>
            <h3>{conversation.title}</h3>
            <button
              className={styles.expandButton}
              onClick={(e) => toggleConversationExpanded(conversation.id, e)}
              aria-label={isExpanded ? 'Collapse' : 'Expand'}
            >
              {isExpanded ? '▼' : '▶'}
            </button>
          </div>
          <button className={styles.deleteButton} onClick={(e) => handleDelete(conversation.id, e)} aria-label="Delete conversation">
            ✕
          </button>
        </div>

        <div className={styles.cardMeta}>
          <span className={styles.messageCount}>{conversation.messageCount} messages</span>
          <span className={styles.timestamp}>{formatDistanceToNow(new Date(conversation.lastMessageAt), { addSuffix: true })}</span>
        </div>

        <p className={styles.summary}>{conversation.summary}</p>

        {conversation.topics.length > 0 && (
          <div className={styles.topics}>
            {conversation.topics.map((topic) => (
              <span
                key={topic}
                className={styles.topicTag}
                onClick={(e) => {
                  e.stopPropagation();
                  setFilterTopic(topic);
                }}
              >
                {topic}
              </span>
            ))}
          </div>
        )}

        {isExpanded && conversation.messages && (
          <div className={styles.expandedContent}>
            <div className={styles.conversationTimeline}>
              <div className={styles.timelineHeader}>
                <span>Started {format(new Date(conversation.startedAt), 'PPp')}</span>
              </div>
              <div className={styles.messages}>
                {conversation.messages.map((message) => (
                  <div key={message.id} className={`${styles.message} ${styles[message.role]}`}>
                    <div className={styles.messageHeader}>
                      <span className={styles.messageRole}>{message.role === 'user' ? 'You' : 'AI Guide'}</span>
                      <span className={styles.messageTime}>{format(new Date(message.timestamp), 'p')}</span>
                    </div>
                    <div className={styles.messageContent}>{sanitizeText(message.content)}</div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>
    );
  };

  return (
    <div className={styles.chatHistory}>
      <div className={styles.header}>
        <h2>Conversation History</h2>
        <div className={styles.controls}>
          <div className={styles.searchContainer}>
            <input
              type="text"
              className={styles.searchInput}
              placeholder="Search conversations..."
              value={searchQuery}
              onChange={handleSearchChange}
              aria-label="Search conversations"
            />
            <span className={styles.searchIcon}>🔍</span>
          </div>

          {filterTopic && (
            <div className={styles.activeFilter}>
              <span>Topic: {filterTopic}</span>
              <button className={styles.clearFilter} onClick={() => setFilterTopic('')} aria-label="Clear topic filter">
                ✕
              </button>
            </div>
          )}

          {allTopics.length > 0 && (
            <select
              className={styles.topicFilter}
              value={filterTopic}
              onChange={(e) => setFilterTopic(e.target.value)}
              aria-label="Filter by topic"
            >
              <option value="">All Topics</option>
              {allTopics.map((topic) => (
                <option key={topic} value={topic}>
                  {topic}
                </option>
              ))}
            </select>
          )}
        </div>
      </div>

      <div className={styles.conversationList}>
        {isLoading ? (
          <div className={styles.loading}>
            <div className={styles.spinner}></div>
            <p>Loading conversations...</p>
          </div>
        ) : filteredConversations.length === 0 ? (
          <div className={styles.empty}>
            <p>
              {searchQuery || filterTopic
                ? 'No conversations match your search criteria.'
                : 'No conversations yet. Start a chat to see your history here!'}
            </p>
          </div>
        ) : (
          filteredConversations.map(renderConversationCard)
        )}
      </div>
    </div>
  );
}
