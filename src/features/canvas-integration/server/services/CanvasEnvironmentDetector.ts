/**
 * @fileoverview Canvas Environment Detector Service
 * @module features/canvas-integration/server/services/CanvasEnvironmentDetector
 *
 * Detects and configures Canvas environment settings for multi-tenant support,
 * including Canvas version detection, API endpoint discovery, and environment-specific
 * feature configuration for different Canvas deployments.
 */

import {
  CanvasEnvironmentConfig,
  CanvasOrigin
} from '../../shared/types';

/**
 * Canvas environment information
 */
interface CanvasEnvironmentInfo {
  baseUrl: string;
  version: string;
  edition: 'cloud' | 'hosted' | 'local';
  deployment: 'instructure' | 'custom';
  features: {
    postMessageSupported: boolean;
    apiVersions: string[];
    mobileAppSupported: boolean;
    customDomainSupported: boolean;
  };
  security: {
    httpsRequired: boolean;
    corsEnabled: boolean;
    csrfProtection: boolean;
  };
  limits: {
    maxApiRequestsPerSecond: number;
    maxFileUploadSize: number;
    maxContentLength: number;
  };
}

/**
 * Canvas deployment patterns for recognition
 */
interface CanvasDeploymentPattern {
  name: string;
  urlPatterns: RegExp[];
  indicators: string[];
  defaultConfig: Partial<CanvasEnvironmentConfig>;
}

/**
 * Canvas Environment Detector Service
 *
 * Provides automatic Canvas environment detection and configuration:
 * - Multi-tenant Canvas instance support
 * - Canvas version and feature detection
 * - API endpoint discovery and validation
 * - Environment-specific security configuration
 * - Custom domain and subdirectory support
 */
export class CanvasEnvironmentDetector {
  private environmentCache: Map<string, CanvasEnvironmentInfo> = new Map();
  private configCache: Map<string, CanvasEnvironmentConfig> = new Map();

  // Known Canvas deployment patterns
  private readonly DEPLOYMENT_PATTERNS: CanvasDeploymentPattern[] = [
    {
      name: 'Instructure Cloud',
      urlPatterns: [
        /^https:\/\/[\w.-]+\.instructure\.com$/,
        /^https:\/\/canvas\.instructure\.com$/
      ],
      indicators: ['ic-app', 'instructure-ui'],
      defaultConfig: {
        apiVersion: 'v1',
        features: {
          postMessageEnabled: true,
          contentExtractionEnabled: true,
          mobileSupported: true
        },
        security: {
          requireHttps: true,
          hmacAlgorithm: 'SHA-256',
          maxMessageSize: 1048576, // 1MB
          rateLimitWindow: 60000 // 1 minute
        }
      }
    },
    {
      name: 'Canvas LMS Cloud',
      urlPatterns: [
        /^https:\/\/[\w.-]+\.canvaslms\.com$/
      ],
      indicators: ['canvas-lms', 'ic-app'],
      defaultConfig: {
        apiVersion: 'v1',
        features: {
          postMessageEnabled: true,
          contentExtractionEnabled: true,
          mobileSupported: true
        },
        security: {
          requireHttps: true,
          hmacAlgorithm: 'SHA-256',
          maxMessageSize: 1048576,
          rateLimitWindow: 60000
        }
      }
    },
    {
      name: 'Hosted Canvas',
      urlPatterns: [
        /^https:\/\/canvas\./,
        /^https:\/\/lms\./,
        /^https:\/\/[\w.-]+\/canvas/
      ],
      indicators: ['canvas', 'ic-app'],
      defaultConfig: {
        apiVersion: 'v1',
        features: {
          postMessageEnabled: true,
          contentExtractionEnabled: true,
          mobileSupported: false // Often limited in hosted environments
        },
        security: {
          requireHttps: true,
          hmacAlgorithm: 'SHA-256',
          maxMessageSize: 524288, // 512KB (more conservative)
          rateLimitWindow: 60000
        }
      }
    }
  ];

  // API version compatibility matrix
  private readonly API_COMPATIBILITY = {
    'v1': {
      minCanvasVersion: '2018.01.01',
      maxCanvasVersion: null,
      features: ['assignments', 'courses', 'users', 'discussions', 'quizzes']
    },
    'v2': {
      minCanvasVersion: '2020.01.01',
      maxCanvasVersion: null,
      features: ['assignments', 'courses', 'users', 'discussions', 'quizzes', 'analytics']
    }
  };

  constructor(
    private defaultAllowedOrigins: string[] = [],
    private enableCaching: boolean = true
  ) {
    // Add default trusted origins
    this.defaultAllowedOrigins.push(
      'https://canvas.instructure.com',
      'https://atomicjolt.instructure.com'
    );
  }

  /**
   * Detect Canvas environment from origin URL
   */
  async detectEnvironment(origin: string): Promise<CanvasEnvironmentInfo> {
    // Check cache first
    if (this.enableCaching && this.environmentCache.has(origin)) {
      return this.environmentCache.get(origin)!;
    }

    const environment = await this.performEnvironmentDetection(origin);

    // Cache the result
    if (this.enableCaching) {
      this.environmentCache.set(origin, environment);
    }

    return environment;
  }

  /**
   * Generate Canvas environment configuration
   */
  async generateConfig(origin: string): Promise<CanvasEnvironmentConfig> {
    // Check cache first
    if (this.enableCaching && this.configCache.has(origin)) {
      return this.configCache.get(origin)!;
    }

    const environment = await this.detectEnvironment(origin);
    const deploymentPattern = this.matchDeploymentPattern(origin);

    const config: CanvasEnvironmentConfig = {
      canvasBaseUrl: environment.baseUrl,
      allowedOrigins: this.generateAllowedOrigins(origin, environment),
      apiVersion: environment.features.apiVersions[0] || 'v1',
      features: {
        postMessageEnabled: environment.features.postMessageSupported,
        contentExtractionEnabled: this.isContentExtractionSupported(environment),
        mobileSupported: environment.features.mobileAppSupported
      },
      security: {
        requireHttps: environment.security.httpsRequired,
        hmacAlgorithm: 'SHA-256',
        maxMessageSize: environment.limits.maxContentLength,
        rateLimitWindow: 60000 // 1 minute default
      }
    };

    // Apply deployment-specific overrides
    if (deploymentPattern?.defaultConfig) {
      this.applyConfigOverrides(config, deploymentPattern.defaultConfig);
    }

    // Cache the configuration
    if (this.enableCaching) {
      this.configCache.set(origin, config);
    }

    return config;
  }

  /**
   * Validate Canvas origin against known patterns
   */
  validateOrigin(origin: string): boolean {
    try {
      const url = new URL(origin);

      // Must be HTTPS for security
      if (url.protocol !== 'https:') {
        return false;
      }

      // Check against deployment patterns
      const deploymentPattern = this.matchDeploymentPattern(origin);
      if (deploymentPattern) {
        return true;
      }

      // Check against default allowed origins
      if (this.defaultAllowedOrigins.includes(origin)) {
        return true;
      }

      // Additional validation for custom domains
      return this.validateCustomCanvasOrigin(origin);
    } catch (error) {
      return false;
    }
  }

  /**
   * Discover Canvas API endpoints
   */
  async discoverApiEndpoints(origin: string): Promise<Record<string, string>> {
    const environment = await this.detectEnvironment(origin);
    const baseApiUrl = `${environment.baseUrl}/api/${environment.features.apiVersions[0] || 'v1'}`;

    return {
      courses: `${baseApiUrl}/courses`,
      assignments: `${baseApiUrl}/courses/{courseId}/assignments`,
      quizzes: `${baseApiUrl}/courses/{courseId}/quizzes`,
      discussions: `${baseApiUrl}/courses/{courseId}/discussion_topics`,
      users: `${baseApiUrl}/users`,
      files: `${baseApiUrl}/files`,
      pages: `${baseApiUrl}/courses/{courseId}/pages`,
      modules: `${baseApiUrl}/courses/{courseId}/modules`,
      enrollment: `${baseApiUrl}/courses/{courseId}/enrollments`,
      grades: `${baseApiUrl}/courses/{courseId}/gradebook_history`
    };
  }

  /**
   * Check Canvas API connectivity and permissions
   */
  async validateApiAccess(origin: string, apiToken?: string): Promise<{
    accessible: boolean;
    permissions: string[];
    rateLimits: {
      remaining: number;
      resetTime: Date;
    };
    errors: string[];
  }> {
    const errors: string[] = [];
    let accessible = false;
    let permissions: string[] = [];
    let rateLimits = {
      remaining: 0,
      resetTime: new Date()
    };

    try {
      const environment = await this.detectEnvironment(origin);
      const baseApiUrl = `${environment.baseUrl}/api/${environment.features.apiVersions[0] || 'v1'}`;

      // Test basic API connectivity
      const headers: Record<string, string> = {
        'Accept': 'application/json'
      };

      if (apiToken) {
        headers['Authorization'] = `Bearer ${apiToken}`;
      }

      const response = await fetch(`${baseApiUrl}/users/self`, {
        method: 'GET',
        headers,
        signal: AbortSignal.timeout(10000) // 10 second timeout
      });

      if (response.ok) {
        accessible = true;

        // Extract rate limit information
        const remaining = response.headers.get('X-Rate-Limit-Remaining');
        const resetTime = response.headers.get('X-Rate-Limit-Reset');

        rateLimits = {
          remaining: remaining ? parseInt(remaining) : 0,
          resetTime: resetTime ? new Date(parseInt(resetTime) * 1000) : new Date()
        };

        // Get user permissions if authenticated
        if (apiToken) {
          permissions = await this.extractUserPermissions(response);
        }
      } else {
        errors.push(`API access failed: ${response.status} ${response.statusText}`);
      }
    } catch (error) {
      errors.push(`API connectivity test failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }

    return {
      accessible,
      permissions,
      rateLimits,
      errors
    };
  }

  /**
   * Get supported Canvas features for environment
   */
  getSupportedFeatures(origin: string): Promise<string[]> {
    return this.detectEnvironment(origin).then(env => {
      const features: string[] = [];

      if (env.features.postMessageSupported) {
        features.push('postMessage', 'real_time_communication');
      }

      if (env.features.apiVersions.includes('v1')) {
        features.push('api_v1', 'assignments', 'courses', 'users');
      }

      if (env.features.apiVersions.includes('v2')) {
        features.push('api_v2', 'advanced_analytics');
      }

      if (env.features.mobileAppSupported) {
        features.push('mobile_app', 'responsive_design');
      }

      if (env.security.corsEnabled) {
        features.push('cors', 'cross_origin_requests');
      }

      return features;
    });
  }

  /**
   * Clear environment cache
   */
  clearCache(): void {
    this.environmentCache.clear();
    this.configCache.clear();
  }

  /**
   * Perform actual environment detection
   */
  private async performEnvironmentDetection(origin: string): Promise<CanvasEnvironmentInfo> {
    const url = new URL(origin);
    const baseUrl = `${url.protocol}//${url.hostname}${url.port ? ':' + url.port : ''}`;

    // Detect Canvas version and features
    const versionInfo = await this.detectCanvasVersion(baseUrl);
    const features = await this.detectCanvasFeatures(baseUrl);
    const security = await this.detectSecuritySettings(baseUrl);
    const limits = await this.detectCanvasLimits(baseUrl);

    const deployment = this.determineDeploymentType(origin);

    return {
      baseUrl,
      version: versionInfo.version,
      edition: deployment.edition,
      deployment: deployment.type,
      features,
      security,
      limits
    };
  }

  /**
   * Detect Canvas version
   */
  private async detectCanvasVersion(baseUrl: string): Promise<{ version: string; build: string }> {
    try {
      // Try to fetch Canvas version from common endpoints
      const endpoints = [
        `${baseUrl}/api/v1/accounts/self`,
        `${baseUrl}/login/canvas`,
        `${baseUrl}/`
      ];

      for (const endpoint of endpoints) {
        try {
          const response = await fetch(endpoint, {
            method: 'HEAD',
            signal: AbortSignal.timeout(5000)
          });

          // Look for version in headers
          const versionHeader = response.headers.get('X-Canvas-Version') ||
                               response.headers.get('X-Canvas-Release');

          if (versionHeader) {
            return {
              version: versionHeader,
              build: response.headers.get('X-Canvas-Build') || 'unknown'
            };
          }
        } catch (error) {
          // Continue to next endpoint
        }
      }

      return { version: 'unknown', build: 'unknown' };
    } catch (error) {
      return { version: 'unknown', build: 'unknown' };
    }
  }

  /**
   * Detect Canvas features
   */
  private async detectCanvasFeatures(baseUrl: string): Promise<CanvasEnvironmentInfo['features']> {
    const features: CanvasEnvironmentInfo['features'] = {
      postMessageSupported: true, // Assume supported unless proven otherwise
      apiVersions: ['v1'], // Default API version
      mobileAppSupported: true,
      customDomainSupported: true
    };

    try {
      // Test API v1 availability
      const v1Response = await fetch(`${baseUrl}/api/v1/users/self`, {
        method: 'HEAD',
        signal: AbortSignal.timeout(5000)
      });

      if (!v1Response.ok && v1Response.status !== 401) {
        features.apiVersions = [];
      }

      // Test API v2 availability
      try {
        const v2Response = await fetch(`${baseUrl}/api/v2/courses`, {
          method: 'HEAD',
          signal: AbortSignal.timeout(5000)
        });

        if (v2Response.ok || v2Response.status === 401) {
          features.apiVersions.push('v2');
        }
      } catch (error) {
        // v2 not available
      }

      // Check for mobile app support indicators
      const deploymentPattern = this.matchDeploymentPattern(baseUrl);
      if (deploymentPattern?.name === 'Hosted Canvas') {
        features.mobileAppSupported = false; // Often limited in self-hosted
      }

    } catch (error) {
      // Use defaults on error
    }

    return features;
  }

  /**
   * Detect security settings
   */
  private async detectSecuritySettings(baseUrl: string): Promise<CanvasEnvironmentInfo['security']> {
    const url = new URL(baseUrl);

    return {
      httpsRequired: url.protocol === 'https:',
      corsEnabled: true, // Assume enabled for Canvas
      csrfProtection: true // Canvas always has CSRF protection
    };
  }

  /**
   * Detect Canvas limits
   */
  private async detectCanvasLimits(baseUrl: string): Promise<CanvasEnvironmentInfo['limits']> {
    // Default limits - in production, these might be discovered via API
    return {
      maxApiRequestsPerSecond: 10, // Conservative default
      maxFileUploadSize: 50 * 1024 * 1024, // 50MB
      maxContentLength: 10000 // 10KB for postMessage content
    };
  }

  /**
   * Determine deployment type
   */
  private determineDeploymentType(origin: string): { edition: CanvasEnvironmentInfo['edition']; type: CanvasEnvironmentInfo['deployment'] } {
    const deploymentPattern = this.matchDeploymentPattern(origin);

    if (deploymentPattern) {
      switch (deploymentPattern.name) {
        case 'Instructure Cloud':
        case 'Canvas LMS Cloud':
          return { edition: 'cloud', type: 'instructure' };
        case 'Hosted Canvas':
          return { edition: 'hosted', type: 'custom' };
        default:
          return { edition: 'local', type: 'custom' };
      }
    }

    return { edition: 'local', type: 'custom' };
  }

  /**
   * Match deployment pattern
   */
  private matchDeploymentPattern(origin: string): CanvasDeploymentPattern | null {
    for (const pattern of this.DEPLOYMENT_PATTERNS) {
      if (pattern.urlPatterns.some(regex => regex.test(origin))) {
        return pattern;
      }
    }
    return null;
  }

  /**
   * Generate allowed origins list
   */
  private generateAllowedOrigins(origin: string, environment: CanvasEnvironmentInfo): string[] {
    const origins = new Set([origin, ...this.defaultAllowedOrigins]);

    // Add common variations for the detected environment
    const url = new URL(origin);

    if (environment.deployment === 'instructure') {
      // Add common Instructure subdomains
      origins.add(`https://${url.hostname.replace(/^[^.]+\./, 'canvas.')}`);
      origins.add(`https://${url.hostname.replace(/^[^.]+\./, 'mobile.')}`);
    }

    return Array.from(origins);
  }

  /**
   * Check if content extraction is supported
   */
  private isContentExtractionSupported(environment: CanvasEnvironmentInfo): boolean {
    // Content extraction requires API access and modern Canvas version
    return environment.features.apiVersions.length > 0 &&
           environment.features.postMessageSupported;
  }

  /**
   * Apply configuration overrides
   */
  private applyConfigOverrides(
    config: CanvasEnvironmentConfig,
    overrides: Partial<CanvasEnvironmentConfig>
  ): void {
    if (overrides.features) {
      config.features = { ...config.features, ...overrides.features };
    }
    if (overrides.security) {
      config.security = { ...config.security, ...overrides.security };
    }
    if (overrides.apiVersion) {
      config.apiVersion = overrides.apiVersion;
    }
  }

  /**
   * Validate custom Canvas origin
   */
  private validateCustomCanvasOrigin(origin: string): boolean {
    // Basic validation for custom Canvas deployments
    const url = new URL(origin);

    // Should use HTTPS
    if (url.protocol !== 'https:') {
      return false;
    }

    // Common Canvas path indicators
    const canvasIndicators = [
      '/canvas',
      '/lms',
      'canvas.',
      'lms.'
    ];

    return canvasIndicators.some(indicator =>
      url.hostname.includes(indicator) || url.pathname.includes(indicator)
    );
  }

  /**
   * Extract user permissions from API response
   */
  private async extractUserPermissions(response: Response): Promise<string[]> {
    try {
      const userData = await response.json();
      const permissions: string[] = [];

      // Extract permissions based on user roles and capabilities
      if (userData.permissions) {
        permissions.push(...Object.keys(userData.permissions).filter(
          key => userData.permissions[key] === true
        ));
      }

      // Add default permissions based on user type
      if (userData.enrollments) {
        userData.enrollments.forEach((enrollment: any) => {
          if (enrollment.type === 'teacher') {
            permissions.push('course_management', 'grade_management', 'content_creation');
          } else if (enrollment.type === 'student') {
            permissions.push('content_viewing', 'assignment_submission');
          }
        });
      }

      return [...new Set(permissions)]; // Remove duplicates
    } catch (error) {
      return [];
    }
  }
}