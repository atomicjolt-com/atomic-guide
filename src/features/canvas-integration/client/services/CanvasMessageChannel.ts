/**
 * @fileoverview Canvas Message Channel Service for client-side communication
 * @module features/canvas-integration/client/services/CanvasMessageChannel
 *
 * Handles bidirectional postMessage communication with Canvas parent frame,
 * including automatic reconnection, message queuing, and event handling
 * for Canvas navigation and content changes.
 */

import {
  CanvasMessage,
  CanvasOrigin,
  CanvasPageContent,
  BehavioralSignal,
  InterventionMessage
} from '../../shared/types';

/**
 * Message queue entry
 */
interface QueuedMessage {
  message: CanvasMessage;
  timestamp: number;
  retryCount: number;
}

/**
 * Connection state
 */
interface ConnectionState {
  connected: boolean;
  sessionId: string;
  canvasOrigin: CanvasOrigin | null;
  lastHeartbeat: number;
  reconnectAttempts: number;
}

/**
 * Event listeners for Canvas integration
 */
interface CanvasEventListeners {
  onConnectionChange?: (connected: boolean) => void;
  onContentChange?: (content: CanvasPageContent) => void;
  onNavigationChange?: (url: string, pageType: string) => void;
  onIntervention?: (intervention: InterventionMessage) => void;
  onError?: (error: Error) => void;
}

/**
 * Canvas Message Channel Service
 *
 * Provides robust client-side Canvas postMessage communication with:
 * - Secure bidirectional messaging with HMAC validation
 * - Automatic reconnection with exponential backoff
 * - Message queuing for reliable delivery
 * - Canvas navigation event detection
 * - Real-time content extraction
 * - Intervention message handling
 */
export class CanvasMessageChannel {
  private connectionState: ConnectionState;
  private messageQueue: QueuedMessage[] = [];
  private listeners: CanvasEventListeners = {};
  private heartbeatInterval: number | null = null;
  private reconnectTimeout: number | null = null;
  private contentObserver: MutationObserver | null = null;

  // Configuration
  private readonly HEARTBEAT_INTERVAL_MS = 30000; // 30 seconds
  private readonly MAX_RECONNECT_ATTEMPTS = 10;
  private readonly RECONNECT_BASE_DELAY_MS = 1000; // 1 second
  private readonly MESSAGE_TIMEOUT_MS = 30000; // 30 seconds
  private readonly MAX_QUEUE_SIZE = 100;

  constructor(
    private sessionId: string,
    private hmacSecret: string,
    private atomicGuideOrigin: string
  ) {
    this.connectionState = {
      connected: false,
      sessionId,
      canvasOrigin: null,
      lastHeartbeat: 0,
      reconnectAttempts: 0
    };

    this.initializePostMessageListener();
    this.detectCanvasEnvironment();
  }

  /**
   * Initialize the Canvas message channel
   */
  async initialize(): Promise<void> {
    try {
      // Detect Canvas origin
      const canvasOrigin = this.detectCanvasOrigin();
      if (!canvasOrigin) {
        throw new Error('Unable to detect Canvas origin');
      }

      this.connectionState.canvasOrigin = canvasOrigin;

      // Start handshake process
      await this.initiateHandshake();

      // Start content monitoring
      this.startContentMonitoring();

      // Start heartbeat
      this.startHeartbeat();

      console.log('Canvas message channel initialized successfully');
    } catch (error) {
      console.error('Failed to initialize Canvas message channel:', error);
      this.handleError(error as Error);
      throw error;
    }
  }

  /**
   * Set event listeners
   */
  setEventListeners(listeners: CanvasEventListeners): void {
    this.listeners = { ...this.listeners, ...listeners };
  }

  /**
   * Send behavioral signal to Atomic Guide
   */
  async sendBehavioralSignal(signal: Omit<BehavioralSignal, 'nonce' | 'hmacSignature' | 'origin'>): Promise<void> {
    if (!this.connectionState.canvasOrigin) {
      throw new Error('Canvas origin not detected');
    }

    const completeSignal: Omit<CanvasMessage, 'nonce' | 'hmacSignature'> = {
      type: 'behavioral_signal',
      payload: signal,
      timestamp: new Date(),
      sessionId: this.sessionId,
      origin: this.connectionState.canvasOrigin
    };

    await this.sendSecureMessage(completeSignal);
  }

  /**
   * Send content extraction data
   */
  async sendContentExtraction(content: CanvasPageContent): Promise<void> {
    if (!this.connectionState.canvasOrigin) {
      throw new Error('Canvas origin not detected');
    }

    const message: Omit<CanvasMessage, 'nonce' | 'hmacSignature'> = {
      type: 'content_extraction',
      payload: content,
      timestamp: new Date(),
      sessionId: this.sessionId,
      origin: this.connectionState.canvasOrigin
    };

    await this.sendSecureMessage(message);
  }

  /**
   * Send page context update
   */
  async sendPageContextUpdate(context: any): Promise<void> {
    if (!this.connectionState.canvasOrigin) {
      throw new Error('Canvas origin not detected');
    }

    const message: Omit<CanvasMessage, 'nonce' | 'hmacSignature'> = {
      type: 'page_context_update',
      payload: context,
      timestamp: new Date(),
      sessionId: this.sessionId,
      origin: this.connectionState.canvasOrigin
    };

    await this.sendSecureMessage(message);
  }

  /**
   * Disconnect and cleanup
   */
  disconnect(): void {
    // Clear intervals and timeouts
    if (this.heartbeatInterval) {
      clearInterval(this.heartbeatInterval);
      this.heartbeatInterval = null;
    }

    if (this.reconnectTimeout) {
      clearTimeout(this.reconnectTimeout);
      this.reconnectTimeout = null;
    }

    // Stop content monitoring
    if (this.contentObserver) {
      this.contentObserver.disconnect();
      this.contentObserver = null;
    }

    // Clear message queue
    this.messageQueue = [];

    // Update connection state
    this.connectionState.connected = false;
    this.notifyConnectionChange(false);

    console.log('Canvas message channel disconnected');
  }

  /**
   * Detect Canvas origin from current window
   */
  private detectCanvasOrigin(): CanvasOrigin | null {
    // Check if we're in an iframe
    if (window.parent === window) {
      console.warn('Not running in iframe, Canvas integration may not work');
      return null;
    }

    // Try to determine Canvas origin from referrer
    const referrer = document.referrer;
    if (referrer) {
      try {
        const url = new URL(referrer);
        const origin = `${url.protocol}//${url.hostname}`;

        // Validate against known Canvas patterns
        if (this.isValidCanvasOrigin(origin)) {
          return origin as CanvasOrigin;
        }
      } catch (error) {
        console.warn('Failed to parse referrer URL:', error);
      }
    }

    // Fallback: try common Canvas origins
    const commonOrigins = [
      'https://canvas.instructure.com',
      'https://atomicjolt.instructure.com'
    ];

    for (const origin of commonOrigins) {
      if (this.isValidCanvasOrigin(origin)) {
        return origin as CanvasOrigin;
      }
    }

    return null;
  }

  /**
   * Validate Canvas origin
   */
  private isValidCanvasOrigin(origin: string): boolean {
    const patterns = [
      /^https:\/\/[\w.-]+\.instructure\.com$/,
      /^https:\/\/[\w.-]+\.canvaslms\.com$/
    ];

    return patterns.some(pattern => pattern.test(origin));
  }

  /**
   * Initialize postMessage event listener
   */
  private initializePostMessageListener(): void {
    window.addEventListener('message', (event) => {
      this.handleIncomingMessage(event);
    });
  }

  /**
   * Handle incoming postMessage events
   */
  private handleIncomingMessage(event: MessageEvent): void {
    try {
      // Validate origin
      if (!this.connectionState.canvasOrigin || event.origin !== this.connectionState.canvasOrigin) {
        console.warn('Received message from invalid origin:', event.origin);
        return;
      }

      const message = event.data;

      // Handle different message types
      switch (message.type) {
        case 'handshake_response':
          this.handleHandshakeResponse(message);
          break;
        case 'struggle_intervention':
          this.handleInterventionMessage(message);
          break;
        case 'content_request':
          this.handleContentRequest(message);
          break;
        case 'heartbeat_response':
          this.handleHeartbeatResponse(message);
          break;
        default:
          console.warn('Unknown message type:', message.type);
      }
    } catch (error) {
      console.error('Error handling incoming message:', error);
      this.handleError(error as Error);
    }
  }

  /**
   * Initiate handshake with Canvas
   */
  private async initiateHandshake(): Promise<void> {
    if (!this.connectionState.canvasOrigin) {
      throw new Error('Canvas origin not set');
    }

    const handshakeMessage = {
      type: 'handshake_request',
      sessionId: this.sessionId,
      timestamp: Date.now(),
      atomicGuideVersion: '1.0.0',
      capabilities: ['content_extraction', 'behavioral_tracking', 'real_time_context']
    };

    // Send handshake to Canvas parent
    window.parent.postMessage(handshakeMessage, this.connectionState.canvasOrigin);

    console.log('Handshake initiated with Canvas');
  }

  /**
   * Handle handshake response
   */
  private handleHandshakeResponse(message: any): void {
    if (message.sessionId === this.sessionId && message.status === 'accepted') {
      this.connectionState.connected = true;
      this.connectionState.reconnectAttempts = 0;
      this.notifyConnectionChange(true);

      // Process queued messages
      this.processMessageQueue();

      console.log('Handshake completed successfully');
    } else {
      console.error('Handshake failed:', message);
      this.scheduleReconnect();
    }
  }

  /**
   * Start heartbeat mechanism
   */
  private startHeartbeat(): void {
    this.heartbeatInterval = window.setInterval(async () => {
      if (this.connectionState.connected) {
        await this.sendHeartbeat();
      }
    }, this.HEARTBEAT_INTERVAL_MS);
  }

  /**
   * Send heartbeat message
   */
  private async sendHeartbeat(): Promise<void> {
    const heartbeat: Omit<CanvasMessage, 'nonce' | 'hmacSignature'> = {
      type: 'session_heartbeat',
      payload: { timestamp: Date.now() },
      timestamp: new Date(),
      sessionId: this.sessionId,
      origin: this.connectionState.canvasOrigin!
    };

    try {
      await this.sendSecureMessage(heartbeat);
      this.connectionState.lastHeartbeat = Date.now();
    } catch (error) {
      console.warn('Heartbeat failed:', error);
      this.handleConnectionLoss();
    }
  }

  /**
   * Handle heartbeat response
   */
  private handleHeartbeatResponse(message: any): void {
    if (message.sessionId === this.sessionId) {
      this.connectionState.lastHeartbeat = Date.now();
    }
  }

  /**
   * Start content monitoring
   */
  private startContentMonitoring(): void {
    // Monitor Canvas navigation changes
    this.monitorCanvasNavigation();

    // Monitor content changes
    this.monitorContentChanges();

    // Extract initial page content
    this.extractCurrentPageContent();
  }

  /**
   * Monitor Canvas navigation using history API and hash changes
   */
  private monitorCanvasNavigation(): void {
    let currentUrl = window.location.href;

    // Monitor history changes
    const originalPushState = history.pushState;
    const originalReplaceState = history.replaceState;

    history.pushState = function(...args) {
      originalPushState.apply(history, args);
      if (window.location.href !== currentUrl) {
        currentUrl = window.location.href;
        this.handleNavigationChange(currentUrl);
      }
    }.bind(this);

    history.replaceState = function(...args) {
      originalReplaceState.apply(history, args);
      if (window.location.href !== currentUrl) {
        currentUrl = window.location.href;
        this.handleNavigationChange(currentUrl);
      }
    }.bind(this);

    // Monitor hash changes
    window.addEventListener('hashchange', () => {
      if (window.location.href !== currentUrl) {
        currentUrl = window.location.href;
        this.handleNavigationChange(currentUrl);
      }
    });

    // Monitor popstate events
    window.addEventListener('popstate', () => {
      if (window.location.href !== currentUrl) {
        currentUrl = window.location.href;
        this.handleNavigationChange(currentUrl);
      }
    });
  }

  /**
   * Monitor content changes using MutationObserver
   */
  private monitorContentChanges(): void {
    this.contentObserver = new MutationObserver((mutations) => {
      let contentChanged = false;

      mutations.forEach((mutation) => {
        if (mutation.type === 'childList' && mutation.addedNodes.length > 0) {
          // Check if significant content was added
          mutation.addedNodes.forEach((node) => {
            if (node.nodeType === Node.ELEMENT_NODE) {
              const element = node as Element;
              if (this.isSignificantContentElement(element)) {
                contentChanged = true;
              }
            }
          });
        }
      });

      if (contentChanged) {
        // Debounce content extraction
        setTimeout(() => {
          this.extractCurrentPageContent();
        }, 1000);
      }
    });

    this.contentObserver.observe(document.body, {
      childList: true,
      subtree: true
    });
  }

  /**
   * Check if element contains significant content
   */
  private isSignificantContentElement(element: Element): boolean {
    const significantSelectors = [
      '.assignment-description',
      '.quiz-description',
      '.discussion-section',
      '.user_content',
      '#quiz_questions',
      '.question_content'
    ];

    return significantSelectors.some(selector =>
      element.matches(selector) || element.querySelector(selector)
    );
  }

  /**
   * Handle navigation change
   */
  private handleNavigationChange(url: string): void {
    const pageType = this.detectPageTypeFromUrl(url);

    console.log('Navigation detected:', { url, pageType });

    // Notify listeners
    if (this.listeners.onNavigationChange) {
      this.listeners.onNavigationChange(url, pageType);
    }

    // Extract content for new page
    setTimeout(() => {
      this.extractCurrentPageContent();
    }, 2000); // Give Canvas time to load content
  }

  /**
   * Detect page type from URL
   */
  private detectPageTypeFromUrl(url: string): string {
    if (url.includes('/assignments/')) return 'assignment';
    if (url.includes('/quizzes/')) return 'quiz';
    if (url.includes('/discussion_topics/')) return 'discussion';
    if (url.includes('/modules/')) return 'module';
    if (url.includes('/pages/')) return 'page';
    if (url.includes('/courses/') && !url.includes('/')) return 'course';
    return 'unknown';
  }

  /**
   * Extract current page content
   */
  private async extractCurrentPageContent(): Promise<void> {
    try {
      const pageType = this.detectPageTypeFromUrl(window.location.href);
      const content = await this.extractContentByPageType(pageType);

      if (content) {
        // Send content to Atomic Guide
        await this.sendContentExtraction(content);

        // Notify listeners
        if (this.listeners.onContentChange) {
          this.listeners.onContentChange(content);
        }
      }
    } catch (error) {
      console.error('Content extraction failed:', error);
    }
  }

  /**
   * Extract content based on page type
   */
  private async extractContentByPageType(pageType: string): Promise<CanvasPageContent | null> {
    const selectors = this.getContentSelectorsForPageType(pageType);
    let contentText = '';

    // Extract content from multiple selectors
    for (const selector of selectors) {
      const elements = document.querySelectorAll(selector);
      elements.forEach(element => {
        const text = element.textContent?.trim();
        if (text && text.length > 10) {
          contentText += text + '\n';
        }
      });
    }

    if (!contentText) {
      return null;
    }

    // Create content object
    const content: CanvasPageContent = {
      pageType: pageType as CanvasPageContent['pageType'],
      courseId: this.extractCourseIdFromUrl(),
      assignmentTitle: this.extractTitleFromPage(),
      contentText: contentText.substring(0, 10000), // Limit size
      contentHash: this.generateContentHash(contentText),
      extractedAt: new Date(),
      extractionMethod: 'dom_fallback',
      metadata: {
        url: window.location.href,
        title: document.title
      }
    };

    return content;
  }

  /**
   * Get content selectors for page type
   */
  private getContentSelectorsForPageType(pageType: string): string[] {
    const selectorMap: Record<string, string[]> = {
      assignment: ['.assignment-description', '#assignment_show .description', '.user_content'],
      quiz: ['.quiz-description', '#quiz_description', '.question_content'],
      discussion: ['.discussion-section', '.message_wrapper', '.user_content'],
      module: ['.context_module_items', '.content-details', '.module-sequence-footer-content'],
      page: ['.show-content', '.page-content', '.user_content'],
      course: ['.course-description', '.syllabus_course_summary']
    };

    return selectorMap[pageType] || ['.user_content', '.content'];
  }

  /**
   * Extract course ID from URL
   */
  private extractCourseIdFromUrl(): string | undefined {
    const match = window.location.pathname.match(/\/courses\/(\d+)/);
    return match ? match[1] : undefined;
  }

  /**
   * Extract title from page
   */
  private extractTitleFromPage(): string | undefined {
    const selectors = ['h1', '.page-title', '.assignment-title', '.quiz-title'];

    for (const selector of selectors) {
      const element = document.querySelector(selector);
      if (element?.textContent?.trim()) {
        return element.textContent.trim();
      }
    }

    return document.title;
  }

  /**
   * Generate content hash
   */
  private generateContentHash(content: string): string {
    let hash = 0;
    for (let i = 0; i < content.length; i++) {
      const char = content.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash;
    }
    return Math.abs(hash).toString(16);
  }

  /**
   * Send secure message with HMAC signature
   */
  private async sendSecureMessage(message: Omit<CanvasMessage, 'nonce' | 'hmacSignature'>): Promise<void> {
    const nonce = crypto.randomUUID();
    const completeMessage: CanvasMessage = {
      ...message,
      nonce,
      hmacSignature: await this.generateHmacSignature(message, nonce)
    };

    if (this.connectionState.connected) {
      // Send immediately if connected
      window.parent.postMessage(completeMessage, this.atomicGuideOrigin);
    } else {
      // Queue message for later delivery
      this.queueMessage(completeMessage);
    }
  }

  /**
   * Generate HMAC signature for message
   */
  private async generateHmacSignature(message: any, nonce: string): Promise<string> {
    const messageData = {
      ...message,
      nonce
    };

    const encoder = new TextEncoder();
    const payloadString = JSON.stringify(messageData);

    const key = await crypto.subtle.importKey(
      'raw',
      encoder.encode(this.hmacSecret),
      { name: 'HMAC', hash: 'SHA-256' },
      false,
      ['sign']
    );

    const signature = await crypto.subtle.sign(
      'HMAC',
      key,
      encoder.encode(payloadString)
    );

    return Array.from(new Uint8Array(signature))
      .map(b => b.toString(16).padStart(2, '0'))
      .join('');
  }

  /**
   * Queue message for later delivery
   */
  private queueMessage(message: CanvasMessage): void {
    if (this.messageQueue.length >= this.MAX_QUEUE_SIZE) {
      this.messageQueue.shift(); // Remove oldest message
    }

    this.messageQueue.push({
      message,
      timestamp: Date.now(),
      retryCount: 0
    });
  }

  /**
   * Process queued messages
   */
  private async processMessageQueue(): Promise<void> {
    const now = Date.now();
    const validMessages = this.messageQueue.filter(
      item => now - item.timestamp < this.MESSAGE_TIMEOUT_MS
    );

    for (const item of validMessages) {
      try {
        window.parent.postMessage(item.message, this.atomicGuideOrigin);
      } catch (error) {
        console.warn('Failed to send queued message:', error);
      }
    }

    this.messageQueue = [];
  }

  /**
   * Handle intervention message
   */
  private handleInterventionMessage(message: any): void {
    if (this.listeners.onIntervention) {
      this.listeners.onIntervention(message.payload);
    }
  }

  /**
   * Handle content request
   */
  private async handleContentRequest(_message: any): Promise<void> {
    await this.extractCurrentPageContent();
  }

  /**
   * Detect Canvas environment
   */
  private detectCanvasEnvironment(): void {
    // Check for Canvas-specific elements and classes
    const canvasIndicators = [
      'body.ic-app',
      '#application',
      '.ic-Layout'
    ];

    const isCanvas = canvasIndicators.some(selector =>
      document.querySelector(selector) !== null
    );

    if (!isCanvas) {
      console.warn('Canvas environment not detected');
    }
  }

  /**
   * Handle connection loss
   */
  private handleConnectionLoss(): void {
    this.connectionState.connected = false;
    this.notifyConnectionChange(false);
    this.scheduleReconnect();
  }

  /**
   * Schedule reconnection attempt
   */
  private scheduleReconnect(): void {
    if (this.connectionState.reconnectAttempts >= this.MAX_RECONNECT_ATTEMPTS) {
      console.error('Max reconnection attempts reached');
      return;
    }

    const delay = this.RECONNECT_BASE_DELAY_MS * Math.pow(2, this.connectionState.reconnectAttempts);
    this.connectionState.reconnectAttempts++;

    this.reconnectTimeout = window.setTimeout(async () => {
      try {
        await this.initiateHandshake();
      } catch (error) {
        console.error('Reconnection failed:', error);
        this.scheduleReconnect();
      }
    }, delay);
  }

  /**
   * Notify connection change
   */
  private notifyConnectionChange(connected: boolean): void {
    if (this.listeners.onConnectionChange) {
      this.listeners.onConnectionChange(connected);
    }
  }

  /**
   * Handle error
   */
  private handleError(error: Error): void {
    if (this.listeners.onError) {
      this.listeners.onError(error);
    }
  }
}