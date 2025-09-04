import { Hono } from 'hono';
import { sanitizeInput, sanitizeUrl } from '@shared/server/utils/sanitizer';
import xss from 'xss';

type Bindings = {
  AI: any;
  KV_CACHE: any;
  DB: any;
};

type Variables = {
  tenantId?: string;
  userId?: string;
};

const richMedia = new Hono<{ Bindings: Bindings; Variables: Variables }>();

// Middleware to extract tenant and user information
richMedia.use('*', async (c, next) => {
  const tenantId = c.req.header('x-tenant-id') || 'default';
  const userId = c.req.header('x-user-id') || 'anonymous';

  c.set('tenantId', tenantId);
  c.set('userId', userId);

  await next();
});

// POST /api/chat/media/render - Rich media processing endpoint
richMedia.post('/render', async (c) => {
  try {
    const body = await c.req.json();
    const { content, media_type, context } = body;

    if (!content) {
      return c.json({ error: 'Content is required' }, 400);
    }

    if (!['latex', 'code', 'diagram', 'video'].includes(media_type)) {
      return c.json({ error: 'Invalid media_type. Must be one of: latex, code, diagram, video' }, 400);
    }

    // Sanitize content based on media type
    let sanitizedContent: string;
    let processingMetadata: any = {};

    switch (media_type) {
      case 'latex': {
        // Sanitize LaTeX - remove dangerous commands but keep math notation
        sanitizedContent = sanitizeInput(content);

        // Additional LaTeX-specific validation
        const dangerousLatexCommands = [
          '\\write',
          '\\input',
          '\\include',
          '\\openout',
          '\\closeout',
          '\\immediate',
          '\\special',
          '\\catcode',
          '\\let',
          '\\def',
        ];

        for (const cmd of dangerousLatexCommands) {
          if (sanitizedContent.includes(cmd)) {
            return c.json(
              {
                error: `Dangerous LaTeX command detected: ${cmd}`,
                code: 'LATEX_SECURITY_VIOLATION',
              },
              400
            );
          }
        }

        // Check complexity limits (AC requirement)
        const nestedBraces = (sanitizedContent.match(/\{/g) || []).length;
        if (nestedBraces > 50) {
          // Configurable limit
          return c.json(
            {
              error: 'LaTeX expression too complex (too many nested braces)',
              code: 'LATEX_COMPLEXITY_LIMIT',
            },
            400
          );
        }

        processingMetadata = {
          inline: context?.inline || false,
          complexity_score: nestedBraces,
          estimated_render_time: Math.min(nestedBraces * 10, 500), // ms
        };
        break;
      }

      case 'code': {
        sanitizedContent = sanitizeInput(content);

        // Code-specific validation
        const lineCount = sanitizedContent.split('\n').length;
        if (lineCount > 500) {
          // AC requirement: 500 line limit
          return c.json(
            {
              error: 'Code snippet exceeds maximum length (500 lines)',
              code: 'CODE_LENGTH_LIMIT',
            },
            400
          );
        }

        // Detect language if not provided
        const detectedLanguage = detectProgrammingLanguage(sanitizedContent);
        processingMetadata = {
          language: context?.language || detectedLanguage,
          line_count: lineCount,
          estimated_highlight_time: Math.min(lineCount * 2, 200), // ms
        };
        break;
      }

      case 'diagram': {
        // For SVG diagrams, use xss with custom configuration
        sanitizedContent = xss(content, {
          whiteList: {
            svg: ['viewBox', 'width', 'height'],
            g: [],
            path: ['d', 'fill', 'stroke', 'stroke-width'],
            circle: ['cx', 'cy', 'r', 'fill', 'stroke', 'stroke-width'],
            rect: ['x', 'y', 'width', 'height', 'fill', 'stroke', 'stroke-width'],
            text: ['x', 'y'],
            line: ['x1', 'y1', 'x2', 'y2', 'stroke', 'stroke-width'],
            polygon: ['points', 'fill', 'stroke', 'stroke-width'],
          },
          stripIgnoreTag: true,
          stripIgnoreTagBody: ['script', 'style'],
        });

        processingMetadata = {
          complexity: context?.complexity || 'detailed',
          format: content.startsWith('<svg') ? 'svg' : 'description',
          estimated_load_time: content.length / 1000, // rough estimate
        };
        break;
      }

      case 'video':
        // For video, content should be a URL or video description
        if (content.startsWith('http')) {
          // URL validation
          sanitizedContent = sanitizeUrl(content);
          if (!sanitizedContent) {
            return c.json({ error: 'Invalid video URL' }, 400);
          }
        } else {
          sanitizedContent = sanitizeInput(content);
        }

        processingMetadata = {
          is_url: content.startsWith('http'),
          duration: context?.duration || null,
          estimated_load_time: 1000, // default for videos
        };
        break;
    }

    // Generate content hash for caching
    const contentHash = await generateContentHash(sanitizedContent + media_type);

    // Check cache first
    const cacheKey = `rich_media:${contentHash}`;
    const cached = await c.env.KV_CACHE.get(cacheKey);

    if (cached) {
      const cachedData = JSON.parse(cached);

      // Update access count
      await c.env.DB.prepare(
        `
        UPDATE rich_media_cache
        SET access_count = access_count + 1, last_accessed = ?
        WHERE content_hash = ?
      `
      )
        .bind(new Date().toISOString(), contentHash)
        .run();

      return c.json({
        success: true,
        processed_content: cachedData.processed_content,
        metadata: {
          ...cachedData.metadata,
          cached: true,
          cache_age_ms: Date.now() - new Date(cachedData.created_at).getTime(),
        },
      });
    }

    // Process the content (simplified - in production this would involve actual rendering)
    let processedContent = sanitizedContent;
    const renderStartTime = Date.now();

    switch (media_type) {
      case 'latex':
        // In production, this would render LaTeX to HTML or MathML
        processedContent = `<span class="katex-processed">${sanitizedContent}</span>`;
        break;

      case 'code': {
        // In production, this would apply syntax highlighting
        const language = processingMetadata.language;
        processedContent = `<pre class="code-processed language-${language}"><code>${sanitizedContent}</code></pre>`;
        break;
      }

      case 'diagram':
        if (processingMetadata.format === 'svg') {
          processedContent = sanitizedContent; // Already SVG
        } else {
          // In production, this might generate actual diagrams from descriptions
          processedContent = `<div class="diagram-placeholder">${sanitizedContent}</div>`;
        }
        break;

      case 'video':
        if (processingMetadata.is_url) {
          processedContent = `<video controls src="${sanitizedContent}"></video>`;
        } else {
          processedContent = `<div class="video-placeholder">${sanitizedContent}</div>`;
        }
        break;
    }

    const renderTime = Date.now() - renderStartTime;

    // Store in cache
    const cacheData = {
      processed_content: processedContent,
      metadata: {
        ...processingMetadata,
        render_time_ms: renderTime,
        cached: false,
      },
      created_at: new Date().toISOString(),
    };

    await c.env.KV_CACHE.put(cacheKey, JSON.stringify(cacheData), {
      expirationTtl: 3600, // 1 hour cache
    });

    // Store in database cache table
    await c.env.DB.prepare(
      `
      INSERT OR REPLACE INTO rich_media_cache (
        id, content_hash, media_type, content_data, original_content,
        cache_metadata, access_count, last_accessed, created_at, expires_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `
    )
      .bind(
        `cache_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        contentHash,
        media_type,
        processedContent,
        sanitizedContent,
        JSON.stringify(processingMetadata),
        1,
        new Date().toISOString(),
        new Date().toISOString(),
        new Date(Date.now() + 3600000).toISOString() // 1 hour
      )
      .run();

    return c.json({
      success: true,
      processed_content: processedContent,
      metadata: cacheData.metadata,
    });
  } catch (error) {
    console.error('Rich media processing error:', error);
    return c.json({ error: 'Failed to process rich media content' }, 500);
  }
});

// GET /api/learner/media-preferences - Retrieve media preferences
richMedia.get('/preferences', async (c) => {
  try {
    const tenantId = c.get('tenantId')!;
    const userId = c.get('userId')!;

    const result = await c.env.DB.prepare(
      `
      SELECT media_preferences FROM learner_profiles
      WHERE tenant_id = ? AND lti_user_id = ?
    `
    )
      .bind(tenantId, userId)
      .first();

    if (!result) {
      // Return default preferences
      return c.json({
        preferences: {
          prefers_visual: true,
          math_notation_style: 'latex',
          code_highlight_theme: 'light',
          diagram_complexity: 'detailed',
          bandwidth_preference: 'high',
        },
        is_default: true,
      });
    }

    const preferences = result.media_preferences
      ? JSON.parse(result.media_preferences)
      : {
          prefers_visual: true,
          math_notation_style: 'latex',
          code_highlight_theme: 'light',
          diagram_complexity: 'detailed',
          bandwidth_preference: 'high',
        };

    return c.json({
      preferences,
      is_default: false,
    });
  } catch (error) {
    console.error('Media preferences retrieval error:', error);
    return c.json({ error: 'Failed to retrieve media preferences' }, 500);
  }
});

// PUT /api/learner/media-preferences - Update media preferences
richMedia.put('/preferences', async (c) => {
  try {
    const tenantId = c.get('tenantId')!;
    const userId = c.get('userId')!;

    const body = await c.req.json();
    const { preferences } = body;

    if (!preferences) {
      return c.json({ error: 'Preferences object is required' }, 400);
    }

    // Validate preferences
    const validPreferences = {
      prefers_visual: typeof preferences.prefers_visual === 'boolean' ? preferences.prefers_visual : true,
      math_notation_style: ['latex', 'ascii', 'spoken'].includes(preferences.math_notation_style)
        ? preferences.math_notation_style
        : 'latex',
      code_highlight_theme: ['light', 'dark'].includes(preferences.code_highlight_theme) ? preferences.code_highlight_theme : 'light',
      diagram_complexity: ['simple', 'detailed'].includes(preferences.diagram_complexity) ? preferences.diagram_complexity : 'detailed',
      bandwidth_preference: ['high', 'medium', 'low'].includes(preferences.bandwidth_preference)
        ? preferences.bandwidth_preference
        : 'high',
    };

    // Update learner profile
    await c.env.DB.prepare(
      `
      UPDATE learner_profiles
      SET media_preferences = ?, updated_at = ?
      WHERE tenant_id = ? AND lti_user_id = ?
    `
    )
      .bind(JSON.stringify(validPreferences), new Date().toISOString(), tenantId, userId)
      .run();

    return c.json({
      success: true,
      preferences: validPreferences,
    });
  } catch (error) {
    console.error('Media preferences update error:', error);
    return c.json({ error: 'Failed to update media preferences' }, 500);
  }
});

// Helper function to generate content hash
async function generateContentHash(content: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(content);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map((b) => b.toString(16).padStart(2, '0')).join('');
}

// Helper function for programming language detection
function detectProgrammingLanguage(code: string): string {
  const patterns = [
    { lang: 'python', pattern: /^(import |from |def |class |if __name__|print\(|range\()/m },
    { lang: 'javascript', pattern: /^(function |const |let |var |console\.log|=>|\{\s*\})/m },
    { lang: 'typescript', pattern: /^(interface |type |enum |import.*from|export |: (string|number|boolean))/m },
    { lang: 'java', pattern: /^(public class |import java\.|System\.out|public static void)/m },
    { lang: 'cpp', pattern: /^(#include|using namespace|int main\(|cout <<|cin >>)/m },
    { lang: 'c', pattern: /^(#include.*\.h|int main\(|printf\(|scanf\()/m },
    { lang: 'sql', pattern: /^(SELECT |FROM |WHERE |INSERT |UPDATE |DELETE |CREATE TABLE)/im },
    { lang: 'html', pattern: /^(<html|<!DOCTYPE|<div|<span|<p>)/im },
    { lang: 'css', pattern: /^(\.|#|@media|\w+\s*\{)/m },
    { lang: 'bash', pattern: /^(#!\/bin\/|cd |ls |grep |awk |sed |echo )/m },
    { lang: 'json', pattern: /^\s*[{[].*[}\]]\s*$/s },
    { lang: 'xml', pattern: /^<\?xml|^\s*<\w+/m },
  ];

  for (const { lang, pattern } of patterns) {
    if (pattern.test(code)) {
      return lang;
    }
  }

  return 'text';
}

export default richMedia;
