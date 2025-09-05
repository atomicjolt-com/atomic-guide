import xss from 'xss';

/**
 * HTML Sanitization utility for Cloudflare Workers
 * Uses js-xss library which is compatible with Workers runtime
 */

// Custom whitelist configuration for different sanitization levels
const STRICT_WHITELIST = {
  whiteList: {}, // No tags allowed
  stripIgnoreTag: true,
  stripIgnoreTagBody: ['script', 'style'],
};

const CONTENT_WHITELIST = {
  whiteList: {
    p: [],
    strong: [],
    em: [],
    ul: [],
    ol: [],
    li: [],
    code: [],
    pre: [],
    blockquote: [],
    br: [],
    a: ['href', 'title'],
    h1: [],
    h2: [],
    h3: [],
    h4: [],
    h5: [],
    h6: [],
  },
  stripIgnoreTag: true,
  stripIgnoreTagBody: ['script', 'style'],
  onIgnoreTagAttr: function(tag: string, name: string, value: string) {
    // Allow class attributes for styling but strip dangerous event handlers
    if (name === 'class') {
      // Sanitize class names to prevent injection
      return `${name}="${value.replace(/[^a-zA-Z0-9\s\-_]/g, '')}"`;
    }
    // Strip all other attributes not in whitelist
    return '';
  },
};

const MINIMAL_WHITELIST = {
  whiteList: {
    p: [],
    strong: [],
    em: [],
    br: [],
  },
  stripIgnoreTag: true,
  stripIgnoreTagBody: ['script', 'style'],
};

/**
 * Sanitization levels for different use cases
 */
export enum SanitizationLevel {
  STRICT = 'strict', // No HTML tags allowed
  CONTENT = 'content', // Rich text content with safe formatting
  MINIMAL = 'minimal', // Only basic formatting tags
}

/**
 * Sanitize HTML input based on the specified level
 * @param html - The HTML string to sanitize
 * @param level - The sanitization level to apply
 * @returns Sanitized HTML string
 */
export function sanitizeHTML(html: string, level: SanitizationLevel = SanitizationLevel.STRICT): string {
  if (!html) {
    return '';
  }

  // Convert to string if not already
  const htmlString = String(html);

  switch (level) {
    case SanitizationLevel.STRICT:
      return xss(htmlString, STRICT_WHITELIST);
    case SanitizationLevel.CONTENT:
      return xss(htmlString, CONTENT_WHITELIST);
    case SanitizationLevel.MINIMAL:
      return xss(htmlString, MINIMAL_WHITELIST);
    default:
      // Default to strict if unknown level
      return xss(htmlString, STRICT_WHITELIST);
  }
}

/**
 * Sanitize user input for safe display
 * Removes all HTML tags and dangerous content
 * @param input - User input string
 * @returns Sanitized string safe for display
 */
export function sanitizeInput(input: string): string {
  return sanitizeHTML(input, SanitizationLevel.STRICT);
}

/**
 * Sanitize rich text content
 * Allows safe formatting tags for content display
 * @param content - Rich text content
 * @returns Sanitized HTML with safe formatting preserved
 */
export function sanitizeRichContent(content: string): string {
  return sanitizeHTML(content, SanitizationLevel.CONTENT);
}

/**
 * Sanitize minimal content
 * Allows only basic text formatting
 * @param content - Text content with minimal formatting
 * @returns Sanitized HTML with basic formatting preserved
 */
export function sanitizeMinimalContent(content: string): string {
  return sanitizeHTML(content, SanitizationLevel.MINIMAL);
}

/**
 * Custom sanitization with specific whitelist
 * @param html - HTML string to sanitize
 * @param allowedTags - Array of allowed tag names
 * @returns Sanitized HTML string
 */
export function sanitizeWithCustomTags(html: string, allowedTags: string[]): string {
  if (!html) {
    return '';
  }

  const whiteList: Record<string, string[]> = {};
  allowedTags.forEach((tag) => {
    whiteList[tag] = [];
  });

  return xss(html, {
    whiteList,
    stripIgnoreTag: true,
    stripIgnoreTagBody: ['script', 'style'],
  });
}

/**
 * Escape HTML entities for safe text display
 * @param text - Text to escape
 * @returns Escaped text safe for HTML context
 */
export function escapeHtml(text: string): string {
  if (!text) {
    return '';
  }

  return String(text)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
    .replace(/\//g, '&#x2F;');
}

/**
 * Validate and sanitize URLs
 * @param url - URL string to validate and sanitize
 * @returns Sanitized URL or empty string if invalid
 */
export function sanitizeUrl(url: string): string {
  if (!url) {
    return '';
  }

  try {
    const parsed = new URL(url);
    // Only allow http(s) and relative URLs
    if (!['http:', 'https:'].includes(parsed.protocol)) {
      return '';
    }
    return parsed.href;
  } catch {
    // If not a valid absolute URL, check if it's a safe relative URL
    const relative = String(url).trim();
    // Block javascript:, data:, and other dangerous protocols
    if (/^(javascript|data|vbscript|file|about|blob):/i.test(relative)) {
      return '';
    }
    // Allow relative URLs that start with / or are simple paths
    if (relative.startsWith('/') || /^[a-zA-Z0-9\-._~:/?#[\]@!$&'()*+,;=]+$/.test(relative)) {
      return relative;
    }
    return '';
  }
}

/**
 * Sanitize JSON data for safe storage
 * Removes any HTML/script content from JSON values
 * @param data - JSON object to sanitize
 * @returns Sanitized JSON object
 */
export function sanitizeJson(data: any): any {
  if (typeof data === 'string') {
    return sanitizeInput(data);
  }

  if (Array.isArray(data)) {
    return data.map(sanitizeJson);
  }

  if (data && typeof data === 'object') {
    const sanitized: any = {};
    for (const key in data) {
      if (Object.prototype.hasOwnProperty.call(data, key)) {
        // Sanitize the key as well
        const safeKey = sanitizeInput(key);
        sanitized[safeKey] = sanitizeJson(data[key]);
      }
    }
    return sanitized;
  }

  return data;
}
