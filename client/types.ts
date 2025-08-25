import type { InitSettings, LaunchSettings } from '@atomicjolt/lti-client';

declare global {
  interface Window {
    INIT_SETTINGS: InitSettings;
    LAUNCH_SETTINGS: LaunchSettings;
  }
}

// Rich Media Types for Story 2.2
export interface RichMediaContent {
  type: 'latex' | 'code' | 'diagram' | 'video';
  content: string;
  metadata?: {
    language?: string; // for code
    complexity?: 'beginner' | 'advanced'; // for diagrams
    duration?: number; // for videos
    inline?: boolean; // for latex - inline vs block
  };
}

export interface MediaPreferences {
  prefers_visual: boolean;
  math_notation_style: 'latex' | 'ascii' | 'spoken';
  code_highlight_theme: 'light' | 'dark';
  diagram_complexity: 'simple' | 'detailed';
  bandwidth_preference: 'high' | 'medium' | 'low';
}

export interface ChatMessage {
  id: string;
  content: string;
  sender_type: 'learner' | 'ai' | 'system';
  created_at: string;
  rich_media?: RichMediaContent[];
  from_faq?: {
    faq_id: string;
    confidence: number;
  };
  media_load_time_ms?: number;
}

export interface FAQEntry {
  id: string;
  question: string;
  answer: string;
  rich_media_content?: RichMediaContent[];
  usage_count: number;
  effectiveness_score: number;
  created_at: string;
  updated_at: string;
}

export interface FAQSearchResult {
  faq_id: string;
  question: string;
  answer: string;
  rich_media_content?: RichMediaContent[];
  confidence: number;
  usage_count: number;
}

export interface MediaEffectivenessTracking {
  id: string;
  learner_id: string;
  media_type: 'latex' | 'code' | 'diagram' | 'video';
  content_context: string;
  shown_at: string;
  interaction_score?: number; // 0-1 based on engagement
  comprehension_followup?: boolean;
  engagement_time_seconds: number;
  copy_clipboard_count: number;
  fullscreen_activated: boolean;
}
