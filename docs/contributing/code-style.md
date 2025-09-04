# Code Style Guide

This document defines the coding standards and style guidelines for the Atomic Guide project.

## TypeScript Style Guidelines

### 1. Strict Type Safety (MANDATORY)

**All TypeScript must follow strict compiler settings:**

```typescript
// ✅ CORRECT: Explicit types, no any, proper error handling
export async function processUserData(userData: unknown): Promise<ProcessedUserData> {
  const validatedData = UserDataSchema.parse(userData);

  try {
    return await this.process(validatedData);
  } catch (error) {
    if (error instanceof ProcessingError) {
      throw error;
    }
    throw new ProcessingError(`Failed to process user data: ${error.message}`);
  }
}

// ❌ FORBIDDEN: any types, missing return types, no error handling
export async function processUserData(userData: any) {
  return await this.process(userData);
}
```

### 2. Type Definitions

**Use branded types for domain-specific values:**

```typescript
// ✅ CORRECT: Branded types for type safety
import { z } from 'zod';

export const UserIdSchema = z.string().uuid().brand<'UserId'>();
export type UserId = z.infer<typeof UserIdSchema>;

export const CourseIdSchema = z
  .string()
  .regex(/^course_\d+$/)
  .brand<'CourseId'>();
export type CourseId = z.infer<typeof CourseIdSchema>;

// ✅ Usage
const userId = UserIdSchema.parse('550e8400-e29b-41d4-a716-446655440000');
const courseId = CourseIdSchema.parse('course_12345');

// ❌ FORBIDDEN: Plain string types for domain values
type UserId = string;
type CourseId = string;
```

**Interface vs Type preferences:**

```typescript
// ✅ CORRECT: Use interfaces for extensible object shapes
export interface UserProfile {
  id: UserId;
  name: string;
  email: string;
  preferences: UserPreferences;
}

// ✅ CORRECT: Use types for unions, primitives, and computed types
export type UserRole = 'student' | 'instructor' | 'admin';
export type ProcessingStatus = 'pending' | 'processing' | 'completed' | 'failed';

// ✅ CORRECT: Use type for complex computed types
export type APIResponse<T> =
  | {
      success: boolean;
      data: T;
      timestamp: string;
    }
  | {
      success: false;
      error: string;
      timestamp: string;
    };
```

### 3. Function Definitions

**Always provide explicit return types:**

```typescript
// ✅ CORRECT: Explicit return types
export function calculateGrade(score: number, maxScore: number): GradeResult {
  if (maxScore <= 0) {
    throw new Error('Max score must be positive');
  }

  const percentage = (score / maxScore) * 100;
  return {
    score,
    maxScore,
    percentage,
    letterGrade: this.getLetterGrade(percentage),
  };
}

// ✅ CORRECT: Async functions with Promise types
export async function fetchUserData(userId: UserId): Promise<UserData | null> {
  try {
    const response = await this.api.get(`/users/${userId}`);
    return UserDataSchema.parse(response.data);
  } catch (error) {
    if (error instanceof NotFoundError) {
      return null;
    }
    throw error;
  }
}

// ❌ FORBIDDEN: Missing return types
export function calculateGrade(score: number, maxScore: number) {
  return { score, percentage: score / maxScore };
}
```

### 4. Error Handling

**Create domain-specific error classes:**

```typescript
// ✅ CORRECT: Domain-specific error hierarchy
export class AtomicGuideError extends Error {
  constructor(
    message: string,
    public readonly code: string,
    public readonly cause?: Error
  ) {
    super(message);
    this.name = this.constructor.name;
  }
}

export class ValidationError extends AtomicGuideError {
  constructor(message: string, cause?: Error) {
    super(message, 'VALIDATION_ERROR', cause);
  }
}

export class ProcessingError extends AtomicGuideError {
  constructor(
    message: string,
    public readonly stage: string,
    cause?: Error
  ) {
    super(message, 'PROCESSING_ERROR', cause);
  }
}

// ✅ Usage
export async function processVideo(videoId: string): Promise<ProcessedVideo> {
  try {
    const video = await this.getVideo(videoId);
    return await this.process(video);
  } catch (error) {
    throw new ProcessingError(`Failed to process video ${videoId}`, 'transcription', error);
  }
}
```

## React Component Style

### 1. Component Definition

**Use function declarations with explicit typing:**

````typescript
// ✅ CORRECT: Function component with explicit props interface
/**
 * Video player component with playback controls and transcription display.
 *
 * @component
 * @example
 * ```tsx
 * <VideoPlayer
 *   videoId="video_123"
 *   autoPlay={false}
 *   onTranscriptionClick={(timestamp) => seekTo(timestamp)}
 * />
 * ```
 */
interface VideoPlayerProps {
  /** Unique identifier for the video */
  videoId: string;

  /** Whether to start playback automatically @default false */
  autoPlay?: boolean;

  /** Callback when user clicks on transcription text */
  onTranscriptionClick?: (timestamp: number) => void;

  /** Additional CSS classes to apply */
  className?: string;
}

export function VideoPlayer({
  videoId,
  autoPlay = false,
  onTranscriptionClick,
  className
}: VideoPlayerProps): ReactElement {
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);

  // Component implementation...

  return (
    <div className={`video-player ${className || ''}`}>
      {/* Component JSX */}
    </div>
  );
}

// ❌ FORBIDDEN: Arrow function exports, missing types
export const VideoPlayer = ({ videoId, autoPlay, onTranscriptionClick }) => {
  return <div>Video Player</div>;
};
````

### 2. Hooks Usage

**Follow React 19 patterns and conventions:**

```typescript
// ✅ CORRECT: Custom hooks with proper typing
/**
 * Hook for managing video playback state and controls.
 *
 * @param videoId - Unique identifier for the video
 * @returns Video playback state and control functions
 */
export function useVideoPlayer(videoId: string) {
  const [state, setState] = useState<VideoPlayerState>({
    isPlaying: false,
    currentTime: 0,
    duration: 0,
    volume: 1,
    isLoading: true
  });

  const play = useCallback((): void => {
    setState(prev => ({ ...prev, isPlaying: true }));
  }, []);

  const pause = useCallback((): void => {
    setState(prev => ({ ...prev, isPlaying: false }));
  }, []);

  const seekTo = useCallback((time: number): void => {
    if (time >= 0 && time <= state.duration) {
      setState(prev => ({ ...prev, currentTime: time }));
    }
  }, [state.duration]);

  return {
    ...state,
    play,
    pause,
    seekTo
  };
}

// ✅ CORRECT: Effect hooks with proper dependencies
export function VideoPlayer({ videoId }: VideoPlayerProps): ReactElement {
  const { state, play, pause } = useVideoPlayer(videoId);

  useEffect(() => {
    // Load video metadata when videoId changes
    const loadVideo = async (): Promise<void> => {
      try {
        const metadata = await fetchVideoMetadata(videoId);
        // Update state with metadata
      } catch (error) {
        console.error('Failed to load video metadata:', error);
      }
    };

    loadVideo();
  }, [videoId]); // Explicit dependency array

  return <div>Video Player</div>;
}
```

### 3. Event Handlers

**Use proper event typing and naming:**

```typescript
// ✅ CORRECT: Proper event handler typing
interface FormProps {
  onSubmit: (data: FormData) => void;
  onCancel: () => void;
}

export function UserForm({ onSubmit, onCancel }: FormProps): ReactElement {
  const [formData, setFormData] = useState<UserFormData>({
    name: '',
    email: ''
  });

  const handleSubmit = (event: React.FormEvent<HTMLFormElement>): void => {
    event.preventDefault();

    const validatedData = UserFormDataSchema.parse(formData);
    onSubmit(validatedData);
  };

  const handleInputChange = (event: React.ChangeEvent<HTMLInputElement>): void => {
    const { name, value } = event.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  return (
    <form onSubmit={handleSubmit}>
      <input
        type="text"
        name="name"
        value={formData.name}
        onChange={handleInputChange}
      />
      <button type="submit">Submit</button>
      <button type="button" onClick={onCancel}>Cancel</button>
    </form>
  );
}
```

## Naming Conventions

### 1. Variables and Functions

```typescript
// ✅ CORRECT: Descriptive camelCase names
const userAuthenticationToken = 'abc123';
const isVideoProcessingComplete = true;
const maxUploadSizeBytes = 100 * 1024 * 1024;

function calculateUserEngagementScore(userId: UserId): number {}
function generateVideoTranscription(videoFile: File): Promise<string> {}

// ❌ FORBIDDEN: Abbreviated or unclear names
const token = 'abc123';
const flag = true;
const max = 100;

function calc(id: string): number {}
function gen(file: File): Promise<string> {}
```

### 2. Constants

```typescript
// ✅ CORRECT: SCREAMING_SNAKE_CASE for constants
export const MAX_VIDEO_SIZE_BYTES = 500 * 1024 * 1024; // 500MB
export const DEFAULT_TRANSCRIPTION_LANGUAGE = 'en-US';
export const API_RATE_LIMIT_PER_MINUTE = 100;

export const VIDEO_PROCESSING_STAGES = {
  UPLOAD: 'upload',
  TRANSCRIPTION: 'transcription',
  ANALYSIS: 'analysis',
  COMPLETE: 'complete',
} as const;

// ✅ CORRECT: Enum-like objects with const assertion
export const UserRoles = {
  STUDENT: 'student',
  INSTRUCTOR: 'instructor',
  ADMIN: 'admin',
} as const;

export type UserRole = (typeof UserRoles)[keyof typeof UserRoles];
```

### 3. Types and Interfaces

```typescript
// ✅ CORRECT: PascalCase for types and interfaces
export interface UserProfile {
  id: UserId;
  displayName: string;
  emailAddress: string;
}

export type VideoProcessingStatus = 'pending' | 'processing' | 'completed' | 'failed';

export interface APIResponse<TData> {
  success: boolean;
  data: TData;
  timestamp: string;
}

// ✅ CORRECT: Suffix interfaces with descriptive terms
export interface VideoPlayerProps {}
export interface ProcessingOptions {}
export interface DatabaseConnection {}
```

### 4. Files and Directories

```bash
# ✅ CORRECT: File naming conventions
src/features/chat/client/components/ChatWindow.tsx
src/features/chat/client/components/MessageList.tsx
src/features/chat/server/services/ChatService.ts
src/features/chat/shared/types/ChatMessage.ts
src/features/chat/shared/schemas/chatMessageSchema.ts

# ✅ CORRECT: Test file naming
src/features/chat/client/components/__tests__/ChatWindow.test.tsx
src/features/chat/server/services/__tests__/ChatService.test.ts

# ❌ FORBIDDEN: Inconsistent naming
src/features/chat/components/chatwindow.tsx
src/features/chat/Services/chatservice.ts
src/features/chat/Types/message.ts
```

## Code Organization

### 1. Import Organization

**Group imports by source with blank lines:**

```typescript
// ✅ CORRECT: Import organization
// 1. React and external libraries
import React, { useState, useCallback, ReactElement } from 'react';
import { z } from 'zod';

// 2. Internal shared modules
import { Button } from '@shared/client/components';
import { useAuth } from '@shared/client/hooks';
import { APIError } from '@shared/server/errors';

// 3. Feature-specific imports
import { ChatMessage } from '../types';
import { chatMessageSchema } from '../schemas';
import { ChatService } from '../services';

// 4. Relative imports
import './ChatWindow.css';

// ❌ FORBIDDEN: Mixed import order
import { ChatService } from '../services';
import React from 'react';
import { Button } from '@shared/client/components';
import { z } from 'zod';
```

### 2. Export Organization

**Use named exports with explicit export statements:**

```typescript
// ✅ CORRECT: Named exports at the bottom
function VideoUploader(props: VideoUploaderProps): ReactElement {
  // Component implementation
}

function useVideoUpload(options: UploadOptions) {
  // Hook implementation
}

const VIDEO_UPLOAD_CONFIG = {
  maxSize: 500 * 1024 * 1024,
  allowedTypes: ['mp4', 'mov', 'avi'],
};

// Export section
export { VideoUploader };
export { useVideoUpload };
export { VIDEO_UPLOAD_CONFIG };
export type { VideoUploaderProps, UploadOptions };

// ✅ CORRECT: Default export for main component
export default VideoUploader;

// ❌ FORBIDDEN: Inline exports throughout file
export function VideoUploader() {}
export const useVideoUpload = () => {};
```

### 3. Function Organization

**Organize functions logically with helper functions at the bottom:**

```typescript
// ✅ CORRECT: Main functions first, helpers at bottom
export class VideoProcessor {
  // Public methods first
  async processVideo(video: VideoFile): Promise<ProcessedVideo> {
    this.validateVideoFile(video);

    const transcription = await this.generateTranscription(video);
    const analysis = await this.analyzeContent(transcription);

    return this.createProcessedVideo(video, transcription, analysis);
  }

  async batchProcessVideos(videos: VideoFile[]): Promise<ProcessedVideo[]> {
    return Promise.all(videos.map((video) => this.processVideo(video)));
  }

  // Private helper methods at bottom
  private validateVideoFile(video: VideoFile): void {
    if (video.size > MAX_VIDEO_SIZE_BYTES) {
      throw new ValidationError('Video file too large');
    }
  }

  private async generateTranscription(video: VideoFile): Promise<string> {
    // Implementation
  }

  private createProcessedVideo(video: VideoFile, transcription: string, analysis: ContentAnalysis): ProcessedVideo {
    return {
      id: crypto.randomUUID(),
      originalVideo: video,
      transcription,
      analysis,
      processedAt: new Date().toISOString(),
    };
  }
}
```

## Documentation Style

### 1. JSDoc Standards

**All public APIs must have comprehensive JSDoc:**

````typescript
/**
 * Service for managing video processing operations including upload,
 * transcription, and content analysis.
 *
 * This service integrates with Cloudflare Workers AI for transcription
 * generation and provides caching mechanisms for improved performance.
 *
 * @example
 * ```typescript
 * const processor = new VideoProcessor(env.AI, env.DB);
 * const result = await processor.processVideo(videoFile, {
 *   generateTranscription: true,
 *   analyzeContent: true,
 *   cacheResults: true
 * });
 * ```
 */
export class VideoProcessor {
  /**
   * Process a video file through the complete pipeline.
   *
   * The processing pipeline includes:
   * 1. File validation and format checking
   * 2. Transcription generation using Workers AI
   * 3. Content analysis and insight extraction
   * 4. Result caching and storage
   *
   * @param videoFile - The video file to process (max 500MB)
   * @param options - Processing configuration options
   * @returns Promise resolving to the processed video data
   *
   * @throws {ValidationError} When video file is invalid or too large
   * @throws {ProcessingError} When processing fails at any stage
   * @throws {APIError} When external API calls fail
   *
   * @example
   * ```typescript
   * try {
   *   const result = await processor.processVideo(file, {
   *     generateTranscription: true,
   *     language: 'en-US'
   *   });
   *   console.log('Transcription:', result.transcription);
   * } catch (error) {
   *   if (error instanceof ValidationError) {
   *     console.error('Invalid file:', error.message);
   *   }
   * }
   * ```
   */
  async processVideo(videoFile: VideoFile, options: ProcessingOptions = {}): Promise<ProcessedVideo> {
    // Implementation
  }
}
````

### 2. Component Documentation

**React components need usage examples:**

````typescript
/**
 * Interactive video player with transcription overlay and playback controls.
 *
 * Features:
 * - Play/pause controls with keyboard shortcuts
 * - Scrubbing timeline with thumbnail previews
 * - Interactive transcription with timestamp navigation
 * - Volume control and playback speed adjustment
 * - Fullscreen support with responsive design
 *
 * @component
 * @example
 * ```tsx
 * // Basic usage
 * <VideoPlayer videoId="video_123" />
 *
 * // With transcription interaction
 * <VideoPlayer
 *   videoId="video_123"
 *   showTranscription={true}
 *   onTranscriptionClick={(timestamp) => {
 *     console.log('Seek to:', timestamp);
 *   }}
 * />
 *
 * // With custom styling
 * <VideoPlayer
 *   videoId="video_123"
 *   className="custom-player"
 *   theme="dark"
 *   autoPlay={false}
 * />
 * ```
 */
interface VideoPlayerProps {
  /** Unique identifier for the video to play */
  videoId: string;

  /** Whether to display transcription overlay @default true */
  showTranscription?: boolean;

  /** Color theme for the player @default "light" */
  theme?: 'light' | 'dark';

  /** Start playback automatically when component mounts @default false */
  autoPlay?: boolean;

  /** Callback fired when user clicks on transcription text */
  onTranscriptionClick?: (timestamp: number) => void;

  /** Callback fired when playback state changes */
  onPlaybackChange?: (isPlaying: boolean) => void;

  /** Additional CSS classes to apply to the player container */
  className?: string;
}

export function VideoPlayer(props: VideoPlayerProps): ReactElement {
  // Component implementation
}
````

## CSS and Styling

### 1. CSS Modules

**Use CSS modules for component styling:**

```css
/* VideoPlayer.module.css */

.videoPlayer {
  position: relative;
  width: 100%;
  max-width: 800px;
  background: #000;
  border-radius: 8px;
  overflow: hidden;
}

.videoElement {
  width: 100%;
  height: auto;
  display: block;
}

.controls {
  position: absolute;
  bottom: 0;
  left: 0;
  right: 0;
  background: linear-gradient(transparent, rgba(0, 0, 0, 0.7));
  padding: 1rem;
  display: flex;
  align-items: center;
  gap: 0.5rem;
}

.playButton {
  background: none;
  border: none;
  color: white;
  font-size: 1.25rem;
  cursor: pointer;
  padding: 0.5rem;
  border-radius: 4px;
  transition: background-color 0.2s;
}

.playButton:hover {
  background-color: rgba(255, 255, 255, 0.1);
}

.playButton:focus {
  outline: 2px solid #007cba;
  outline-offset: 2px;
}

/* Dark theme variant */
.videoPlayer[data-theme='dark'] {
  border: 1px solid #333;
}

.videoPlayer[data-theme='dark'] .controls {
  background: linear-gradient(transparent, rgba(0, 0, 0, 0.9));
}
```

```typescript
// VideoPlayer.tsx
import styles from './VideoPlayer.module.css';

export function VideoPlayer({ theme = 'light', className }: VideoPlayerProps): ReactElement {
  return (
    <div
      className={`${styles.videoPlayer} ${className || ''}`}
      data-theme={theme}
    >
      <video className={styles.videoElement}>
        {/* Video element */}
      </video>

      <div className={styles.controls}>
        <button className={styles.playButton}>
          Play
        </button>
      </div>
    </div>
  );
}
```

### 2. Responsive Design

**Use mobile-first responsive design:**

```css
/* Mobile first (320px+) */
.videoPlayer {
  width: 100%;
  margin: 0 auto;
}

.controls {
  padding: 0.5rem;
  flex-wrap: wrap;
}

/* Tablet (768px+) */
@media (min-width: 768px) {
  .videoPlayer {
    max-width: 600px;
  }

  .controls {
    padding: 1rem;
    flex-wrap: nowrap;
  }
}

/* Desktop (1024px+) */
@media (min-width: 1024px) {
  .videoPlayer {
    max-width: 800px;
  }
}

/* Large screens (1440px+) */
@media (min-width: 1440px) {
  .videoPlayer {
    max-width: 1200px;
  }
}
```

## Performance Guidelines

### 1. React Performance

**Optimize re-renders with proper memoization:**

```typescript
// ✅ CORRECT: Proper memoization (React 19 handles most cases automatically)
export function VideoList({ videos, onVideoSelect }: VideoListProps): ReactElement {
  // React 19 compiler handles memoization automatically
  // Only manual optimization if profiling shows issues

  return (
    <div className="video-list">
      {videos.map(video => (
        <VideoCard
          key={video.id}
          video={video}
          onSelect={onVideoSelect}
        />
      ))}
    </div>
  );
}

// ✅ CORRECT: Manual memoization only when needed
export const ExpensiveComponent = React.memo(function ExpensiveComponent({
  data,
  computeExpensiveValue
}: ExpensiveComponentProps): ReactElement {
  // Only memoize if this component has expensive computations
  // and profiling shows performance issues

  const expensiveValue = useMemo(() => {
    return computeExpensiveValue(data);
  }, [data, computeExpensiveValue]);

  return <div>{expensiveValue}</div>;
});
```

### 2. Bundle Size Optimization

**Use code splitting and lazy loading:**

```typescript
// ✅ CORRECT: Lazy load heavy components
import { lazy, Suspense, ReactElement } from 'react';

const VideoEditor = lazy(() => import('./VideoEditor'));
const AnalyticsDashboard = lazy(() => import('./AnalyticsDashboard'));

export function App(): ReactElement {
  const [currentView, setCurrentView] = useState<string>('home');

  return (
    <div className="app">
      <Suspense fallback={<div>Loading...</div>}>
        {currentView === 'editor' && <VideoEditor />}
        {currentView === 'analytics' && <AnalyticsDashboard />}
      </Suspense>
    </div>
  );
}

// ✅ CORRECT: Dynamic imports for large libraries
async function loadChartLibrary() {
  const { Chart } = await import('chart.js/auto');
  return Chart;
}
```

## Linting Configuration

The project uses ESLint with strict rules:

```json
{
  "extends": ["@typescript-eslint/recommended-requiring-type-checking", "plugin:react/recommended", "plugin:react-hooks/recommended"],
  "rules": {
    "@typescript-eslint/no-explicit-any": "error",
    "@typescript-eslint/explicit-function-return-type": "error",
    "@typescript-eslint/no-unused-vars": "error",
    "@typescript-eslint/prefer-nullish-coalescing": "error",
    "@typescript-eslint/prefer-optional-chain": "error",
    "react/prop-types": "off",
    "react/react-in-jsx-scope": "off",
    "no-console": ["warn", { "allow": ["warn", "error"] }]
  }
}
```

All code must pass linting before merge. Use `npm run lint-fix` to automatically fix issues where possible.

## Tools and Editor Setup

### Recommended VS Code Extensions

```json
{
  "recommendations": [
    "bradlc.vscode-tailwindcss",
    "esbenp.prettier-vscode",
    "ms-vscode.vscode-typescript-next",
    "dbaeumer.vscode-eslint",
    "bradlc.vscode-tailwindcss",
    "ms-vscode.vscode-json"
  ]
}
```

### VS Code Settings

```json
{
  "editor.formatOnSave": true,
  "editor.codeActionsOnSave": {
    "source.fixAll.eslint": true,
    "source.organizeImports": true
  },
  "typescript.preferences.importModuleSpecifier": "relative",
  "typescript.suggest.autoImports": true
}
```

Following these style guidelines ensures consistent, maintainable, and high-quality code across the Atomic Guide project.
