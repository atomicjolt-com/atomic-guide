/**
 * Canvas Behavioral Signal Monitoring Script
 * 
 * Deployed to Canvas pages to collect real-time behavioral signals
 * for struggle detection. Integrates with Atomic Guide iframe through
 * secure postMessage communication.
 * 
 * Security Features:
 * - Origin validation for all postMessage communication
 * - Rate limiting and signal sampling
 * - Privacy-compliant data collection
 * - Graceful degradation when LTI tool unavailable
 * 
 * Performance Features:
 * - Efficient event delegation
 * - Signal batching and throttling
 * - Memory leak prevention
 * - Minimal DOM impact
 */

(function() {
  'use strict';

  // Configuration
  const CONFIG = {
    // Signal collection settings
    maxSignalsPerMinute: 60,
    batchSize: 5,
    flushIntervalMs: 5000,
    sampleRate: 1.0,
    
    // Behavioral thresholds
    hoverThresholdMs: 3000,    // 3+ seconds indicates confusion
    idleThresholdMs: 30000,    // 30+ seconds indicates idle
    scrollThresholdCount: 3,   // 3+ rapid scrolls indicates difficulty
    
    // Performance settings
    throttleMs: 100,           // Throttle frequent events
    maxEventHistory: 1000,     // Prevent memory leaks
    
    // Privacy and security
    trustedOrigins: [
      'https://guide.atomicjolt.xyz',
      'https://localhost:5988',
      /^https:\/\/[\w-]+\.atomicjolt\.xyz$/
    ],
    
    // Debug mode (set via query parameter or localStorage)
    debugMode: false
  };

  // State management
  let state = {
    isInitialized: false,
    isMonitoring: false,
    sessionId: null,
    atomicGuideFrame: null,
    signalBatch: [],
    eventHistory: [],
    lastFlushTime: Date.now(),
    rateLimitWindow: { start: Date.now(), count: 0 }
  };

  // Signal collection metrics
  let metrics = {
    signalsCollected: 0,
    signalsSent: 0,
    errors: 0,
    startTime: Date.now()
  };

  /**
   * Initialize Canvas monitoring when DOM is ready
   */
  function initialize() {
    if (state.isInitialized) return;

    // Check if we're in a Canvas environment
    if (!isCanvasEnvironment()) {
      debug('Not in Canvas environment, skipping initialization');
      return;
    }

    // Enable debug mode if requested
    CONFIG.debugMode = 
      window.location.search.includes('debug=canvas') ||
      localStorage.getItem('atomic-guide-debug') === 'true';

    debug('Initializing Canvas behavioral monitoring');

    // Find Atomic Guide iframe
    state.atomicGuideFrame = findAtomicGuideFrame();
    if (!state.atomicGuideFrame) {
      debug('Atomic Guide iframe not found, monitoring disabled');
      return;
    }

    // Setup event listeners
    setupEventListeners();
    
    // Setup periodic flushing
    setupPeriodicFlush();
    
    // Request monitoring session from Atomic Guide
    requestMonitoringSession();
    
    state.isInitialized = true;
    debug('Canvas monitoring initialized successfully');
  }

  /**
   * Check if we're running in a Canvas environment
   */
  function isCanvasEnvironment() {
    return (
      window.location.hostname.includes('instructure.com') ||
      window.location.hostname.includes('canvaslms.com') ||
      document.querySelector('[data-react-class="StudentPlanner"]') ||
      document.querySelector('#application') ||
      window.ENV && window.ENV.CONTEXT_BASE_URL
    );
  }

  /**
   * Find Atomic Guide iframe in Canvas page
   */
  function findAtomicGuideFrame() {
    // Look for LTI tool iframe with Atomic Guide
    const iframes = document.querySelectorAll('iframe[src*="guide.atomicjolt"], iframe[src*="localhost:5988"]');
    
    for (const iframe of iframes) {
      if (iframe.src && isValidAtomicGuideOrigin(new URL(iframe.src).origin)) {
        return iframe;
      }
    }

    return null;
  }

  /**
   * Validate Atomic Guide iframe origin
   */
  function isValidAtomicGuideOrigin(origin) {
    return CONFIG.trustedOrigins.some(trusted => {
      if (typeof trusted === 'string') {
        return origin === trusted;
      }
      if (trusted instanceof RegExp) {
        return trusted.test(origin);
      }
      return false;
    });
  }

  /**
   * Setup behavioral signal event listeners
   */
  function setupEventListeners() {
    // Mouse movement and hover detection
    let hoverTimer = null;
    let currentHoverElement = null;
    
    document.addEventListener('mouseover', throttle((event) => {
      if (!state.isMonitoring) return;
      
      currentHoverElement = event.target;
      hoverTimer = setTimeout(() => {
        if (currentHoverElement === event.target) {
          captureSignal('hover', {
            duration: CONFIG.hoverThresholdMs,
            element: getElementDescriptor(event.target),
            coordinates: { x: event.clientX, y: event.clientY }
          });
        }
      }, CONFIG.hoverThresholdMs);
    }, CONFIG.throttleMs));
    
    document.addEventListener('mouseout', (event) => {
      if (hoverTimer && event.target === currentHoverElement) {
        clearTimeout(hoverTimer);
        hoverTimer = null;
      }
    });

    // Scroll pattern detection
    let scrollEvents = [];
    let scrollTimer = null;
    
    window.addEventListener('scroll', throttle(() => {
      if (!state.isMonitoring) return;
      
      const scrollEvent = {
        scrollY: window.scrollY,
        timestamp: Date.now()
      };
      
      scrollEvents.push(scrollEvent);
      
      // Keep only recent scroll events (last 10 seconds)
      scrollEvents = scrollEvents.filter(e => 
        scrollEvent.timestamp - e.timestamp < 10000
      );
      
      // Clear existing timer
      if (scrollTimer) clearTimeout(scrollTimer);
      
      // Analyze scroll patterns after user stops scrolling
      scrollTimer = setTimeout(() => {
        analyzeScrollPattern(scrollEvents);
      }, 500);
      
    }, CONFIG.throttleMs));

    // Click and interaction tracking
    document.addEventListener('click', (event) => {
      if (!state.isMonitoring) return;
      
      captureSignal('click', {
        element: getElementDescriptor(event.target),
        coordinates: { x: event.clientX, y: event.clientY },
        modifiers: {
          ctrl: event.ctrlKey,
          shift: event.shiftKey,
          alt: event.altKey
        }
      });
    });

    // Focus and attention tracking
    let lastActivityTime = Date.now();
    let idleTimer = null;
    
    ['mousedown', 'mousemove', 'keypress', 'scroll', 'touchstart'].forEach(eventType => {
      document.addEventListener(eventType, () => {
        const now = Date.now();
        
        // Reset idle timer
        if (idleTimer) {
          clearTimeout(idleTimer);
        }
        
        // Check for return from idle state
        if (now - lastActivityTime > CONFIG.idleThresholdMs) {
          captureSignal('focus_change', {
            idleDuration: now - lastActivityTime,
            returnedFromIdle: true
          });
        }
        
        lastActivityTime = now;
        
        // Set new idle timer
        idleTimer = setTimeout(() => {
          captureSignal('idle', {
            duration: CONFIG.idleThresholdMs
          });
        }, CONFIG.idleThresholdMs);
        
      }, { passive: true });
    });

    // Page navigation and visibility changes
    document.addEventListener('visibilitychange', () => {
      if (!state.isMonitoring) return;
      
      captureSignal('focus_change', {
        visible: !document.hidden,
        timestamp: Date.now()
      });
    });

    // Help-seeking behavior detection
    detectHelpSeekingBehavior();
    
    debug('Event listeners setup complete');
  }

  /**
   * Analyze scroll patterns for struggle indicators
   */
  function analyzeScrollPattern(scrollEvents) {
    if (scrollEvents.length < 3) return;
    
    const scrollDirection = [];
    for (let i = 1; i < scrollEvents.length; i++) {
      const diff = scrollEvents[i].scrollY - scrollEvents[i-1].scrollY;
      scrollDirection.push(diff > 0 ? 'down' : diff < 0 ? 'up' : 'same');
    }
    
    // Detect rapid scrolling (struggle indicator)
    const rapidScrolls = scrollEvents.filter((event, i) => {
      if (i === 0) return false;
      return event.timestamp - scrollEvents[i-1].timestamp < 200; // Less than 200ms apart
    });
    
    if (rapidScrolls.length >= CONFIG.scrollThresholdCount) {
      captureSignal('scroll', {
        pattern: 'rapid',
        count: rapidScrolls.length,
        direction: scrollDirection
      });
    }
    
    // Detect back-and-forth scrolling (confusion indicator)
    let directionChanges = 0;
    for (let i = 1; i < scrollDirection.length; i++) {
      if (scrollDirection[i] !== scrollDirection[i-1]) {
        directionChanges++;
      }
    }
    
    if (directionChanges >= 4) { // Multiple direction changes
      captureSignal('scroll', {
        pattern: 'backtrack',
        directionChanges: directionChanges,
        totalScrolls: scrollEvents.length
      });
    }
  }

  /**
   * Detect help-seeking behavior patterns
   */
  function detectHelpSeekingBehavior() {
    // Monitor clicks on help-related elements
    const helpSelectors = [
      '[href*="help"]', 
      '[title*="help"]', 
      '[aria-label*="help"]',
      '.help-link', 
      '.support-link',
      '[data-testid*="help"]',
      'a[href*="support"]'
    ];
    
    helpSelectors.forEach(selector => {
      document.addEventListener('click', (event) => {
        if (!state.isMonitoring) return;
        
        if (event.target.matches(selector) || event.target.closest(selector)) {
          captureSignal('help_request', {
            element: getElementDescriptor(event.target),
            helpType: 'link_click'
          });
        }
      });
    });
    
    // Monitor form submissions that might be help requests
    document.addEventListener('submit', (event) => {
      if (!state.isMonitoring) return;
      
      const form = event.target;
      if (form.action && (
        form.action.includes('help') || 
        form.action.includes('support') ||
        form.action.includes('contact')
      )) {
        captureSignal('help_request', {
          helpType: 'form_submission',
          formAction: form.action
        });
      }
    });
  }

  /**
   * Capture behavioral signal
   */
  function captureSignal(signalType, signalData) {
    // Rate limiting check
    if (!checkRateLimit()) {
      return;
    }
    
    // Sampling check
    if (Math.random() > CONFIG.sampleRate) {
      return;
    }
    
    try {
      const signal = {
        id: generateId(),
        sessionId: state.sessionId,
        signalType: signalType,
        durationMs: signalData.duration || 0,
        elementContext: signalData.element || getPageContext(),
        pageContentHash: getPageContentHash(),
        timestamp: new Date(),
        nonce: generateId(),
        origin: window.location.origin,
        metadata: signalData
      };
      
      // Add to batch
      state.signalBatch.push(signal);
      metrics.signalsCollected++;
      
      // Add to event history for pattern analysis
      state.eventHistory.push({
        type: signalType,
        timestamp: Date.now(),
        data: signalData
      });
      
      // Prevent memory leaks
      if (state.eventHistory.length > CONFIG.maxEventHistory) {
        state.eventHistory = state.eventHistory.slice(-CONFIG.maxEventHistory / 2);
      }
      
      debug(`Captured ${signalType} signal:`, signalData);
      
      // Check if batch is full
      if (state.signalBatch.length >= CONFIG.batchSize) {
        flushSignalBatch();
      }
      
    } catch (error) {
      console.error('Failed to capture behavioral signal:', error);
      metrics.errors++;
    }
  }

  /**
   * Check rate limiting
   */
  function checkRateLimit() {
    const now = Date.now();
    const window = state.rateLimitWindow;
    
    // Reset window if more than 1 minute has passed
    if (now - window.start > 60000) {
      window.start = now;
      window.count = 0;
    }
    
    if (window.count >= CONFIG.maxSignalsPerMinute) {
      debug('Rate limit reached, dropping signal');
      return false;
    }
    
    window.count++;
    return true;
  }

  /**
   * Flush signal batch to Atomic Guide iframe
   */
  function flushSignalBatch() {
    if (state.signalBatch.length === 0 || !state.atomicGuideFrame) {
      return;
    }
    
    const batchToFlush = [...state.signalBatch];
    state.signalBatch = [];
    state.lastFlushTime = Date.now();
    
    try {
      const message = {
        type: 'behavioral_signals',
        signals: batchToFlush,
        sessionId: state.sessionId,
        timestamp: new Date(),
        source: 'canvas_monitor'
      };
      
      // Send to Atomic Guide iframe
      const targetOrigin = new URL(state.atomicGuideFrame.src).origin;
      state.atomicGuideFrame.contentWindow.postMessage(message, targetOrigin);
      
      metrics.signalsSent += batchToFlush.length;
      debug(`Flushed ${batchToFlush.length} signals to Atomic Guide`);
      
    } catch (error) {
      console.error('Failed to flush signal batch:', error);
      metrics.errors++;
      
      // Re-add failed signals to batch (with limit to prevent memory issues)
      if (state.signalBatch.length < CONFIG.batchSize * 2) {
        state.signalBatch.unshift(...batchToFlush);
      }
    }
  }

  /**
   * Setup periodic signal batch flushing
   */
  function setupPeriodicFlush() {
    setInterval(() => {
      if (state.signalBatch.length > 0) {
        flushSignalBatch();
      }
    }, CONFIG.flushIntervalMs);
  }

  /**
   * Request monitoring session from Atomic Guide
   */
  function requestMonitoringSession() {
    if (!state.atomicGuideFrame) return;
    
    try {
      const message = {
        type: 'request_monitoring_session',
        canvasUrl: window.location.href,
        canvasContext: getCanvasContext(),
        timestamp: new Date(),
        source: 'canvas_monitor'
      };
      
      const targetOrigin = new URL(state.atomicGuideFrame.src).origin;
      state.atomicGuideFrame.contentWindow.postMessage(message, targetOrigin);
      
      debug('Requested monitoring session from Atomic Guide');
      
    } catch (error) {
      console.error('Failed to request monitoring session:', error);
    }
  }

  /**
   * Handle messages from Atomic Guide iframe
   */
  function handleAtomicGuideMessage(event) {
    // Validate origin
    if (!isValidAtomicGuideOrigin(event.origin)) {
      return;
    }
    
    const message = event.data;
    
    switch (message.type) {
      case 'monitoring_session_started':
        state.isMonitoring = true;
        state.sessionId = message.sessionId;
        debug('Monitoring session started:', message.sessionId);
        break;
        
      case 'monitoring_session_stopped':
        state.isMonitoring = false;
        state.sessionId = null;
        debug('Monitoring session stopped');
        break;
        
      case 'intervention_message':
        displayInterventionMessage(message.intervention);
        break;
        
      case 'config_update':
        updateConfig(message.config);
        break;
        
      default:
        debug('Unknown message from Atomic Guide:', message.type);
    }
  }

  /**
   * Display intervention message to student
   */
  function displayInterventionMessage(intervention) {
    // Create non-intrusive intervention display
    const interventionEl = document.createElement('div');
    interventionEl.className = 'atomic-guide-intervention';
    interventionEl.innerHTML = `
      <div class="intervention-content">
        <div class="intervention-message">${escapeHtml(intervention.message)}</div>
        <div class="intervention-actions">
          <button class="intervention-accept">Yes, help me</button>
          <button class="intervention-dismiss">I'm okay</button>
        </div>
      </div>
    `;
    
    // Add styles
    interventionEl.style.cssText = `
      position: fixed;
      top: 20px;
      right: 20px;
      background: #fff;
      border: 1px solid #ddd;
      border-radius: 8px;
      box-shadow: 0 4px 12px rgba(0,0,0,0.1);
      padding: 16px;
      max-width: 320px;
      z-index: 10000;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      font-size: 14px;
      line-height: 1.4;
    `;
    
    // Handle responses
    interventionEl.querySelector('.intervention-accept').addEventListener('click', () => {
      sendInterventionResponse(intervention.id, 'accepted');
      interventionEl.remove();
    });
    
    interventionEl.querySelector('.intervention-dismiss').addEventListener('click', () => {
      sendInterventionResponse(intervention.id, 'dismissed');
      interventionEl.remove();
    });
    
    // Auto-dismiss after 30 seconds
    setTimeout(() => {
      if (document.contains(interventionEl)) {
        sendInterventionResponse(intervention.id, 'timeout');
        interventionEl.remove();
      }
    }, 30000);
    
    document.body.appendChild(interventionEl);
  }

  /**
   * Send intervention response back to Atomic Guide
   */
  function sendInterventionResponse(interventionId, response) {
    if (!state.atomicGuideFrame) return;
    
    try {
      const message = {
        type: 'intervention_response',
        interventionId: interventionId,
        response: response,
        timestamp: new Date(),
        source: 'canvas_monitor'
      };
      
      const targetOrigin = new URL(state.atomicGuideFrame.src).origin;
      state.atomicGuideFrame.contentWindow.postMessage(message, targetOrigin);
      
    } catch (error) {
      console.error('Failed to send intervention response:', error);
    }
  }

  // Utility functions
  
  function getElementDescriptor(element) {
    if (!element) return 'unknown';
    
    const parts = [];
    if (element.id) parts.push(`#${element.id}`);
    if (element.className) parts.push(`.${element.className.split(' ').join('.')}`);
    parts.push(element.tagName.toLowerCase());
    
    return parts.join(' ').slice(0, 200); // Limit length
  }
  
  function getPageContext() {
    const title = document.title || 'Unknown Page';
    const url = window.location.pathname;
    return `${title} (${url})`.slice(0, 200);
  }
  
  function getPageContentHash() {
    const title = document.title || '';
    const url = window.location.pathname || '';
    const content = `${title}${url}`;
    
    // Simple hash function
    let hash = 0;
    for (let i = 0; i < content.length; i++) {
      const char = content.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // Convert to 32-bit integer
    }
    
    return Math.abs(hash).toString(16);
  }
  
  function getCanvasContext() {
    return {
      courseId: window.ENV && window.ENV.COURSE_ID,
      userId: window.ENV && window.ENV.current_user_id,
      contextType: window.ENV && window.ENV.context_asset_string,
      url: window.location.href
    };
  }
  
  function generateId() {
    return 'xxxx-xxxx-4xxx-yxxx'.replace(/[xy]/g, function(c) {
      const r = Math.random() * 16 | 0;
      const v = c == 'x' ? r : (r & 0x3 | 0x8);
      return v.toString(16);
    });
  }
  
  function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }
  
  function throttle(func, limit) {
    let inThrottle;
    return function() {
      const args = arguments;
      const context = this;
      if (!inThrottle) {
        func.apply(context, args);
        inThrottle = true;
        setTimeout(() => inThrottle = false, limit);
      }
    };
  }
  
  function updateConfig(newConfig) {
    Object.assign(CONFIG, newConfig);
    debug('Configuration updated:', newConfig);
  }
  
  function debug(...args) {
    if (CONFIG.debugMode) {
      console.log('[Canvas Monitor]', ...args);
    }
  }

  // Initialize when DOM is ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initialize);
  } else {
    initialize();
  }

  // Listen for messages from Atomic Guide
  window.addEventListener('message', handleAtomicGuideMessage);

  // Expose debug interface
  window.CanvasMonitor = {
    getState: () => ({ ...state, metrics }),
    getConfig: () => ({ ...CONFIG }),
    startMonitoring: () => { state.isMonitoring = true; },
    stopMonitoring: () => { state.isMonitoring = false; },
    flushSignals: flushSignalBatch,
    enableDebug: () => { CONFIG.debugMode = true; },
    disableDebug: () => { CONFIG.debugMode = false; }
  };

})();