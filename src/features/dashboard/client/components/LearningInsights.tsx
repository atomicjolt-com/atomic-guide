import React, { useMemo } from 'react';
import styles from '../../styles/components/learning-insights.module.css';

interface InsightMetric {
  label: string;
  value: number | string;
  trend?: 'up' | 'down' | 'neutral';
  change?: string;
}

interface TopicFrequency {
  topic: string;
  count: number;
  percentage: number;
}

interface LearningPattern {
  date: string;
  questionsAsked: number;
  topicsExplored: number;
  averageResponseTime: number;
  learningStyle?: string;
}

interface LearningInsightsProps {
  jwt: string;
  metrics?: InsightMetric[];
  topicFrequencies?: TopicFrequency[];
  learningPatterns?: LearningPattern[];
  learningStyle?: {
    type: 'visual' | 'auditory' | 'kinesthetic' | 'reading_writing';
    confidence: number;
  };
  isLoading?: boolean;
}

// Default mock data for development
const defaultMetrics: InsightMetric[] = [
  { label: 'Total Questions', value: '0', trend: 'neutral' },
  { label: 'Topics Explored', value: '0', trend: 'neutral' },
  { label: 'Avg Response Time', value: '0s', trend: 'neutral' },
  { label: 'Study Sessions', value: '0', trend: 'neutral' }
];

const defaultTopicFrequencies: TopicFrequency[] = [];
const defaultLearningPatterns: LearningPattern[] = [];

export default function LearningInsights({
  jwt,
  metrics = defaultMetrics,
  topicFrequencies = defaultTopicFrequencies,
  learningPatterns = defaultLearningPatterns,
  learningStyle,
  isLoading = false
}: LearningInsightsProps) {
  const maxTopicCount = useMemo(() => {
    return Math.max(...topicFrequencies.map(t => t.count), 1);
  }, [topicFrequencies]);

  const chartData = useMemo(() => {
    return learningPatterns.slice(-7).map(pattern => ({
      ...pattern,
      date: new Date(pattern.date).toLocaleDateString('en-US', { 
        weekday: 'short',
        month: 'short',
        day: 'numeric'
      })
    }));
  }, [learningPatterns]);

  const renderMetricCard = (metric: InsightMetric) => {
    return (
      <div key={metric.label} className={styles.metricCard}>
        <div className={styles.metricHeader}>
          <span className={styles.metricLabel}>{metric.label}</span>
          {metric.trend && (
            <span className={`${styles.trend} ${styles[metric.trend]}`}>
              {metric.trend === 'up' ? '↑' : metric.trend === 'down' ? '↓' : '→'}
              {metric.change && ` ${metric.change}`}
            </span>
          )}
        </div>
        <div className={styles.metricValue}>{metric.value}</div>
      </div>
    );
  };

  const renderTopicBar = (topic: TopicFrequency) => {
    const width = (topic.count / maxTopicCount) * 100;
    
    return (
      <div key={topic.topic} className={styles.topicBar}>
        <div className={styles.topicHeader}>
          <span className={styles.topicName}>{topic.topic}</span>
          <span className={styles.topicCount}>
            {topic.count} ({topic.percentage}%)
          </span>
        </div>
        <div className={styles.barContainer}>
          <div 
            className={styles.barFill}
            style={{ width: `${width}%` }}
            aria-label={`${topic.topic}: ${topic.count} questions`}
          />
        </div>
      </div>
    );
  };

  const renderTimelineChart = () => {
    const maxQuestions = Math.max(...chartData.map(d => d.questionsAsked), 1);
    
    return (
      <div className={styles.timeline}>
        <div className={styles.timelineChart}>
          {chartData.map((day, index) => {
            const height = (day.questionsAsked / maxQuestions) * 100;
            
            return (
              <div key={index} className={styles.timelineDay}>
                <div className={styles.barWrapper}>
                  <div 
                    className={styles.timelineBar}
                    style={{ height: `${height}%` }}
                    aria-label={`${day.date}: ${day.questionsAsked} questions`}
                  >
                    <span className={styles.barValue}>{day.questionsAsked}</span>
                  </div>
                </div>
                <span className={styles.dayLabel}>{day.date}</span>
              </div>
            );
          })}
        </div>
      </div>
    );
  };

  const getLearningStyleDescription = (type: string) => {
    const descriptions: { [key: string]: string } = {
      visual: 'You learn best through diagrams, charts, and visual representations',
      auditory: 'You prefer verbal explanations and learn through listening',
      kinesthetic: 'You learn by doing and prefer hands-on practice',
      reading_writing: 'You excel with written materials and note-taking'
    };
    return descriptions[type] || 'Your learning style is being analyzed';
  };

  const getLearningStyleIcon = (type: string) => {
    const icons: { [key: string]: string } = {
      visual: '👁️',
      auditory: '👂',
      kinesthetic: '✋',
      reading_writing: '📝'
    };
    return icons[type] || '🧠';
  };

  if (isLoading) {
    return (
      <div className={styles.learningInsights}>
        <div className={styles.loading}>
          <div className={styles.spinner}></div>
          <p>Analyzing your learning patterns...</p>
        </div>
      </div>
    );
  }

  // Show empty state if no data
  if (metrics.length === 0 && topicFrequencies.length === 0 && learningPatterns.length === 0) {
    return (
      <div className={styles.learningInsights}>
        <div className={styles.header}>
          <h2>Learning Insights</h2>
          <p className={styles.subtitle}>
            Track your progress and understand your learning patterns
          </p>
        </div>
        <div className={styles.emptyState}>
          <p>No learning data available yet. Start using the chat assistant to see your insights!</p>
        </div>
      </div>
    );
  }

  return (
    <div className={styles.learningInsights}>
      <div className={styles.header}>
        <h2>Learning Insights</h2>
        <p className={styles.subtitle}>
          Track your progress and understand your learning patterns
        </p>
      </div>

      {learningStyle && (
        <div className={styles.learningStyleCard}>
          <div className={styles.styleHeader}>
            <span className={styles.styleIcon}>
              {getLearningStyleIcon(learningStyle.type)}
            </span>
            <div>
              <h3>Your Learning Style: {learningStyle.type.replace('_', ' ').toUpperCase()}</h3>
              <p className={styles.styleDescription}>
                {getLearningStyleDescription(learningStyle.type)}
              </p>
              <div className={styles.confidenceBar}>
                <span className={styles.confidenceLabel}>
                  Confidence: {Math.round(learningStyle.confidence * 100)}%
                </span>
                <div className={styles.confidenceTrack}>
                  <div 
                    className={styles.confidenceFill}
                    style={{ width: `${learningStyle.confidence * 100}%` }}
                  />
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      <div className={styles.metricsGrid}>
        {metrics.map(renderMetricCard)}
      </div>

      <div className={styles.insightsGrid}>
        <div className={styles.insightSection}>
          <h3>Activity Timeline</h3>
          <p className={styles.sectionSubtitle}>Questions asked over the past week</p>
          {chartData.length > 0 ? (
            renderTimelineChart()
          ) : (
            <div className={styles.emptyState}>
              <p>No activity data available yet</p>
            </div>
          )}
        </div>

        <div className={styles.insightSection}>
          <h3>Top Topics</h3>
          <p className={styles.sectionSubtitle}>Your most frequently discussed subjects</p>
          {topicFrequencies.length > 0 ? (
            <div className={styles.topicsList}>
              {topicFrequencies.slice(0, 5).map(renderTopicBar)}
            </div>
          ) : (
            <div className={styles.emptyState}>
              <p>Topics will appear as you ask questions</p>
            </div>
          )}
        </div>
      </div>

      <div className={styles.patternsSummary}>
        <h3>Learning Patterns</h3>
        <div className={styles.patternsGrid}>
          <div className={styles.patternCard}>
            <span className={styles.patternIcon}>📊</span>
            <div>
              <h4>Peak Learning Time</h4>
              <p>Most active between 2-4 PM</p>
            </div>
          </div>
          <div className={styles.patternCard}>
            <span className={styles.patternIcon}>🎯</span>
            <div>
              <h4>Focus Areas</h4>
              <p>Mathematics and Science concepts</p>
            </div>
          </div>
          <div className={styles.patternCard}>
            <span className={styles.patternIcon}>📈</span>
            <div>
              <h4>Progress Trend</h4>
              <p>Increasing complexity in questions</p>
            </div>
          </div>
          <div className={styles.patternCard}>
            <span className={styles.patternIcon}>💡</span>
            <div>
              <h4>Learning Velocity</h4>
              <p>Above average comprehension speed</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}