/**
 * @fileoverview Mobile optimization utilities for Story 3.4
 * @module features/dashboard/client/utils/MobileOptimization
 */

import { z } from 'zod';

/**
 * Schema for device capabilities
 */
const DeviceCapabilitiesSchema = z.object({
  isMobile: z.boolean(),
  isTablet: z.boolean(),
  isTouch: z.boolean(),
  screenSize: z.enum(['small', 'medium', 'large']),
  pixelRatio: z.number(),
  connectionType: z.enum(['slow-2g', '2g', '3g', '4g', 'wifi', 'unknown']),
  memoryLimit: z.number().optional(),
  hardwareConcurrency: z.number(),
  reducedMotion: z.boolean(),
  highContrast: z.boolean(),
  darkMode: z.boolean(),
});

export type DeviceCapabilities = z.infer<typeof DeviceCapabilitiesSchema>;

/**
 * Schema for performance budget
 */
const PerformanceBudgetSchema = z.object({
  maxImageSize: z.number(),
  maxBundleSize: z.number(),
  maxRenderTime: z.number(),
  enableAnimations: z.boolean(),
  enableLazyLoading: z.boolean(),
  enablePrefetch: z.boolean(),
  chartComplexity: z.enum(['minimal', 'standard', 'full']),
  concurrentRequests: z.number(),
});

export type PerformanceBudget = z.infer<typeof PerformanceBudgetSchema>;

/**
 * Mobile optimization utility class
 * 
 * Provides device detection, performance budgeting, and optimization
 * strategies for mobile and low-end devices.
 */
export class MobileOptimization {
  private static instance: MobileOptimization;
  private capabilities: DeviceCapabilities;
  private performanceBudget: PerformanceBudget;
  private observers: Set<(capabilities: DeviceCapabilities) => void> = new Set();

  private constructor() {
    this.capabilities = this.detectDeviceCapabilities();
    this.performanceBudget = this.calculatePerformanceBudget(this.capabilities);
    this.setupEventListeners();
  }

  /**
   * Get singleton instance
   */
  public static getInstance(): MobileOptimization {
    if (!MobileOptimization.instance) {
      MobileOptimization.instance = new MobileOptimization();
    }
    return MobileOptimization.instance;
  }

  /**
   * Detect device capabilities
   */
  private detectDeviceCapabilities(): DeviceCapabilities {
    const userAgent = navigator.userAgent.toLowerCase();
    const isMobile = /android|webos|iphone|ipad|ipod|blackberry|iemobile|opera mini/i.test(userAgent);
    const isTablet = /ipad|android(?!.*mobile)|tablet/i.test(userAgent);
    const isTouch = 'ontouchstart' in window || navigator.maxTouchPoints > 0;

    // Screen size detection
    const screenWidth = window.screen.width;
    let screenSize: 'small' | 'medium' | 'large';
    if (screenWidth < 768) {
      screenSize = 'small';
    } else if (screenWidth < 1024) {
      screenSize = 'medium';
    } else {
      screenSize = 'large';
    }

    // Connection type detection
    const connection = (navigator as any).connection || (navigator as any).mozConnection || (navigator as any).webkitConnection;
    const connectionType = connection?.effectiveType || 'unknown';

    // Memory detection
    const memoryLimit = (navigator as any).deviceMemory;

    // Hardware concurrency
    const hardwareConcurrency = navigator.hardwareConcurrency || 4;

    // Accessibility preferences
    const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const highContrast = window.matchMedia('(prefers-contrast: high)').matches;
    const darkMode = window.matchMedia('(prefers-color-scheme: dark)').matches;

    return {
      isMobile,
      isTablet,
      isTouch,
      screenSize,
      pixelRatio: window.devicePixelRatio || 1,
      connectionType,
      memoryLimit,
      hardwareConcurrency,
      reducedMotion,
      highContrast,
      darkMode,
    };
  }

  /**
   * Calculate performance budget based on device capabilities
   */
  private calculatePerformanceBudget(capabilities: DeviceCapabilities): PerformanceBudget {
    const isLowEnd = 
      capabilities.memoryLimit && capabilities.memoryLimit <= 4 ||
      capabilities.hardwareConcurrency <= 2 ||
      ['slow-2g', '2g'].includes(capabilities.connectionType);

    const isMidTier = 
      capabilities.memoryLimit && capabilities.memoryLimit <= 8 ||
      capabilities.hardwareConcurrency <= 4 ||
      capabilities.connectionType === '3g';

    if (isLowEnd) {
      return {
        maxImageSize: 100 * 1024, // 100KB
        maxBundleSize: 500 * 1024, // 500KB
        maxRenderTime: 100, // 100ms
        enableAnimations: false,
        enableLazyLoading: true,
        enablePrefetch: false,
        chartComplexity: 'minimal',
        concurrentRequests: 2,
      };
    } else if (isMidTier) {
      return {
        maxImageSize: 200 * 1024, // 200KB
        maxBundleSize: 1024 * 1024, // 1MB
        maxRenderTime: 200, // 200ms
        enableAnimations: !capabilities.reducedMotion,
        enableLazyLoading: true,
        enablePrefetch: true,
        chartComplexity: 'standard',
        concurrentRequests: 4,
      };
    } else {
      return {
        maxImageSize: 500 * 1024, // 500KB
        maxBundleSize: 2048 * 1024, // 2MB
        maxRenderTime: 500, // 500ms
        enableAnimations: !capabilities.reducedMotion,
        enableLazyLoading: false,
        enablePrefetch: true,
        chartComplexity: 'full',
        concurrentRequests: 6,
      };
    }
  }

  /**
   * Setup event listeners for capability changes
   */
  private setupEventListeners(): void {
    // Listen for connection changes
    const connection = (navigator as any).connection;
    if (connection) {
      connection.addEventListener('change', () => {
        this.capabilities = this.detectDeviceCapabilities();
        this.performanceBudget = this.calculatePerformanceBudget(this.capabilities);
        this.notifyObservers();
      });
    }

    // Listen for media query changes
    const reducedMotionQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
    const highContrastQuery = window.matchMedia('(prefers-contrast: high)');
    const darkModeQuery = window.matchMedia('(prefers-color-scheme: dark)');

    const handleMediaChange = () => {
      this.capabilities = this.detectDeviceCapabilities();
      this.performanceBudget = this.calculatePerformanceBudget(this.capabilities);
      this.notifyObservers();
    };

    reducedMotionQuery.addEventListener('change', handleMediaChange);
    highContrastQuery.addEventListener('change', handleMediaChange);
    darkModeQuery.addEventListener('change', handleMediaChange);

    // Listen for orientation changes
    window.addEventListener('orientationchange', () => {
      setTimeout(() => {
        this.capabilities = this.detectDeviceCapabilities();
        this.notifyObservers();
      }, 100);
    });
  }

  /**
   * Notify observers of capability changes
   */
  private notifyObservers(): void {
    this.observers.forEach(observer => observer(this.capabilities));
  }

  /**
   * Subscribe to capability changes
   */
  public onCapabilitiesChange(callback: (capabilities: DeviceCapabilities) => void): () => void {
    this.observers.add(callback);
    
    return () => {
      this.observers.delete(callback);
    };
  }

  /**
   * Get current device capabilities
   */
  public getCapabilities(): DeviceCapabilities {
    return this.capabilities;
  }

  /**
   * Get current performance budget
   */
  public getPerformanceBudget(): PerformanceBudget {
    return this.performanceBudget;
  }

  /**
   * Check if device is low-end
   */
  public isLowEndDevice(): boolean {
    return this.performanceBudget.chartComplexity === 'minimal';
  }

  /**
   * Get optimal image loading strategy
   */
  public getImageLoadingStrategy(): 'eager' | 'lazy' | 'auto' {
    if (this.performanceBudget.enableLazyLoading) {
      return 'lazy';
    } else if (this.capabilities.connectionType === 'wifi') {
      return 'eager';
    } else {
      return 'auto';
    }
  }

  /**
   * Get optimal chart configuration for device
   */
  public getChartConfiguration(): {
    maxDataPoints: number;
    enableAnimations: boolean;
    renderingStrategy: 'canvas' | 'svg';
    updateThrottle: number;
  } {
    const budget = this.performanceBudget;
    
    switch (budget.chartComplexity) {
      case 'minimal':
        return {
          maxDataPoints: 50,
          enableAnimations: false,
          renderingStrategy: 'canvas',
          updateThrottle: 500,
        };
      
      case 'standard':
        return {
          maxDataPoints: 100,
          enableAnimations: budget.enableAnimations,
          renderingStrategy: 'canvas',
          updateThrottle: 200,
        };
      
      case 'full':
        return {
          maxDataPoints: 250,
          enableAnimations: budget.enableAnimations,
          renderingStrategy: 'svg',
          updateThrottle: 100,
        };
    }
  }

  /**
   * Optimize image for device capabilities
   */
  public optimizeImageUrl(baseUrl: string, width: number, height: number): string {
    const capabilities = this.capabilities;
    const budget = this.performanceBudget;

    // Calculate optimal dimensions based on pixel ratio and budget
    const optimalWidth = Math.min(width, Math.floor(width / capabilities.pixelRatio));
    const optimalHeight = Math.min(height, Math.floor(height / capabilities.pixelRatio));

    // Choose format based on capabilities
    const format = capabilities.isMobile ? 'webp' : 'png';
    
    // Determine quality based on connection and memory
    let quality = 85;
    if (this.isLowEndDevice() || ['slow-2g', '2g'].includes(capabilities.connectionType)) {
      quality = 60;
    } else if (capabilities.connectionType === '3g') {
      quality = 75;
    }

    return `${baseUrl}?w=${optimalWidth}&h=${optimalHeight}&f=${format}&q=${quality}`;
  }

  /**
   * Get request queue configuration
   */
  public getRequestQueueConfig(): {
    maxConcurrent: number;
    timeout: number;
    retryAttempts: number;
    priorityLevels: string[];
  } {
    const budget = this.performanceBudget;
    const isSlowConnection = ['slow-2g', '2g', '3g'].includes(this.capabilities.connectionType);

    return {
      maxConcurrent: budget.concurrentRequests,
      timeout: isSlowConnection ? 30000 : 10000,
      retryAttempts: isSlowConnection ? 1 : 3,
      priorityLevels: ['critical', 'high', 'normal', 'low'],
    };
  }

  /**
   * Check if feature should be enabled based on device capabilities
   */
  public shouldEnableFeature(feature: string): boolean {
    const capabilities = this.capabilities;
    const budget = this.performanceBudget;

    switch (feature) {
      case 'animations':
        return budget.enableAnimations && !capabilities.reducedMotion;
      
      case 'hapticFeedback':
        return capabilities.isTouch && 'vibrate' in navigator;
      
      case 'offlineMode':
        return 'serviceWorker' in navigator && capabilities.isMobile;
      
      case 'backgroundSync':
        return !this.isLowEndDevice() && 'serviceWorker' in navigator;
      
      case 'pushNotifications':
        return 'Notification' in window && !this.isLowEndDevice();
      
      case 'webWorkers':
        return 'Worker' in window && capabilities.hardwareConcurrency > 2;
      
      case 'intersectionObserver':
        return 'IntersectionObserver' in window;
      
      case 'resizeObserver':
        return 'ResizeObserver' in window;
      
      case 'webGL':
        return this.hasWebGLSupport() && !this.isLowEndDevice();
      
      default:
        return true;
    }
  }

  /**
   * Check WebGL support
   */
  private hasWebGLSupport(): boolean {
    try {
      const canvas = document.createElement('canvas');
      return !!(canvas.getContext('webgl') || canvas.getContext('experimental-webgl'));
    } catch {
      return false;
    }
  }

  /**
   * Get touch gesture configuration
   */
  public getTouchGestureConfig(): {
    swipeThreshold: number;
    tapTimeout: number;
    longPressTimeout: number;
    enablePinchZoom: boolean;
  } {
    return {
      swipeThreshold: this.capabilities.isTablet ? 50 : 30,
      tapTimeout: 300,
      longPressTimeout: 500,
      enablePinchZoom: !this.capabilities.isMobile, // Disable on mobile for better UX
    };
  }

  /**
   * Measure and report performance metrics
   */
  public measurePerformance(name: string, startTime: number): void {
    const duration = performance.now() - startTime;
    const budget = this.performanceBudget.maxRenderTime;

    if (duration > budget) {
      console.warn(`Performance budget exceeded for ${name}: ${duration}ms (budget: ${budget}ms)`);
    }

    // Send to analytics if available
    if ('performance' in window && performance.mark) {
      performance.mark(`${name}-end`);
      performance.measure(name, `${name}-start`, `${name}-end`);
    }
  }

  /**
   * Get memory usage information
   */
  public getMemoryUsage(): {
    used: number;
    limit: number;
    available: number;
    percentage: number;
  } | null {
    const memory = (performance as any).memory;
    if (!memory) return null;

    return {
      used: memory.usedJSHeapSize,
      limit: memory.jsHeapSizeLimit,
      available: memory.jsHeapSizeLimit - memory.usedJSHeapSize,
      percentage: (memory.usedJSHeapSize / memory.jsHeapSizeLimit) * 100,
    };
  }

  /**
   * Cleanup resources
   */
  public destroy(): void {
    this.observers.clear();
  }
}