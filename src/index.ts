import type { Context, Next } from 'hono';
import { Hono } from 'hono';
import { HTTPException } from 'hono/http-exception';
import { etag } from 'hono/etag';
import { cors } from 'hono/cors';
import { logger } from 'hono/logger';
import { getCookie } from 'hono/cookie';
import {
  handleInit,
  handleJwks,
  handleRedirect,
  handleDynamicRegistrationInit,
  handleDynamicRegistrationFinish,
  handleNamesAndRoles,
  handleSignDeepLink,
  validateLaunchRequest,
} from '@atomicjolt/lti-endpoints';
import { dynamicRegistrationHtml } from './features/lti/server/html/dynamic_registration_html';
import { getToolConfiguration } from './features/lti/server/config/config';
import {
  LTI_INIT_PATH,
  LTI_REDIRECT_PATH,
  LTI_LAUNCH_PATH,
  LTI_JWKS_PATH,
  LTI_REGISTRATION_PATH,
  LTI_REGISTRATION_FINISH_PATH,
  LTI_NAMES_AND_ROLES_PATH,
  LTI_SIGN_DEEP_LINK_PATH,
} from '../definitions';
import { getToolJwt } from './features/lti/server/services/tool_jwt';
import { handlePlatformResponse } from './features/lti/server/services/register';
import indexHtml from './features/site/server/html/index_html';
import launchHtml from './features/lti/server/html/launch_html';
import { getClientAssetPath } from './shared/server/utils/manifest';
import dbTestApp from './shared/server/db/test-connection';
import {
  handleChatMessage,
  searchChatHistory,
  getChatConversation,
  deleteChatConversation,
  exportUserData,
} from './features/chat/server/handlers/chat';
import { handleChatStream } from './features/chat/server/handlers/chatStream';
import {
  getConversations,
  getLearningInsights,
  updateLearningStyle,
  getConversationSummary,
} from './features/dashboard/server/handlers/dashboard';
import { createAnalyticsApi } from './features/dashboard/server/handlers/analyticsApi';
import { createPreferencesApi } from './features/dashboard/server/handlers/preferencesApi';
import { createAuthHandlers, requireAuth } from './features/auth/server/handlers/auth.handler';
import { createOAuthHandlers } from './features/auth/server/handlers/oauth.handler';
import { createCrossCourseApi, createInstructorCrossCourseApi } from './features/cross-course-intelligence/server/handlers/createCrossCourseApi';
import faqHandler from './features/faq/server/handlers/faq';
import richMediaHandler from './features/chat/server/handlers/richMedia';
import suggestionHandler from './features/chat/server/handlers/suggestions';
import contentHandler from './features/content/server/handlers/content';
import embedHtml from './features/site/server/html/embed_html';
import { AssessmentHandler } from './features/ai-assessment/server/handlers/AssessmentHandler';
import { ConversationalAssessmentEngine } from './features/ai-assessment/server/services/ConversationalAssessmentEngine';
import { AssessmentAIService } from './features/ai-assessment/server/services/AssessmentAIService';
import { AssessmentSessionRepository } from './features/ai-assessment/server/repositories/AssessmentSessionRepository';
import { CanvasGradePassbackService } from './features/ai-assessment/server/services/CanvasGradePassbackService';
import { AssessmentContentGenerator } from './features/ai-assessment/server/services/AssessmentContentGenerator';
import { createDeepLinkingHandler } from './features/deep-linking/server/handlers/DeepLinkingHandler';
import { handleAssessmentLaunch, handleAssessmentSubmission, getAssessmentHistory } from './api/handlers/assessmentLaunch';

// Export durable objects
export { OIDCStateDurableObject } from '@atomicjolt/lti-endpoints';
export { StruggleDetectorDO } from './features/dashboard/server/durable-objects/StruggleDetectorDO';
export { ChatConversationDO } from './features/chat/server/durable-objects/ChatConversationDO';

// Define context variables type
type Variables = {
  requestId: string;
};

const app = new Hono<{ Bindings: Env; Variables: Variables }>();

// Initialize asset paths once at startup
const homeScriptName = getClientAssetPath('client/home.ts');
const initScriptName = getClientAssetPath('client/app-init.ts');
const launchScriptName = getClientAssetPath('client/app.tsx');

// Request logging middleware
app.use('/*', logger());

// ETag middleware for caching
app.use('/*', etag());

// CORS configuration for LTI services
app.use(
  '/lti/*',
  cors({
    origin: '*', // LTI tools need to work across different LMS domains
    allowMethods: ['GET', 'POST', 'OPTIONS'],
    allowHeaders: ['Content-Type', 'Authorization'],
    exposeHeaders: ['Content-Length', 'X-Request-Id'],
    maxAge: 86400,
    credentials: true,
  })
);

// Security headers middleware
app.use('/*', async (c: Context, next: Next) => {
  // Generate request ID for tracking
  const requestId = crypto.randomUUID();
  c.set('requestId', requestId);
  c.header('X-Request-Id', requestId);

  await next();

  // Security headers
  c.header('X-Frame-Options', 'ALLOWALL'); // Required for LTI iframe embedding
  c.header('X-Content-Type-Options', 'nosniff');
  c.header('X-XSS-Protection', '1; mode=block');
  c.header('Referrer-Policy', 'strict-origin-when-cross-origin');

  // Content Security Policy - adjust as needed
  const isDevelopment = c.env.ENVIRONMENT === 'development';
  const csp = [
    "default-src 'self'",
    "script-src 'self' 'unsafe-inline' 'unsafe-eval'", // Needed for some LMS platforms
    "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
    "img-src 'self' data: https:",
    "font-src 'self' data: https://fonts.gstatic.com",
    isDevelopment
      ? "connect-src 'self' ws://localhost:5988 wss://localhost:5988 ws://atomic-guide.atomicjolt.win wss://atomic-guide.atomicjolt.win"
      : "connect-src 'self'",
    'frame-ancestors *', // Allow embedding in any domain for LTI
  ].join('; ');
  c.header('Content-Security-Policy', csp);
});

// Serve static assets
app.get('/assets/*', async (c) => {
  const path = c.req.path.replace(/^\//, '');
  const assetPath = `public/${path}`;

  // Try to read the asset from the public directory
  const asset = c.env.ASSETS?.fetch(new Request(`https://fake-host/${assetPath}`));
  if (asset) {
    return asset;
  }

  return c.notFound();
});

// Home page
app.get('/', (c) => c.html(indexHtml(homeScriptName)));

// Auth pages
app.get('/auth/login', (c) => {
  const authScriptName = getClientAssetPath('client/auth.tsx');
  return c.html(authPageHtml(authScriptName, 'login'));
});

app.get('/auth/signup', (c) => {
  const authScriptName = getClientAssetPath('client/auth.tsx');
  return c.html(authPageHtml(authScriptName, 'signup'));
});

// Helper function for auth pages
function authPageHtml(scriptName: string, mode: 'login' | 'signup'): string {
  return `<!DOCTYPE html>
    <html lang="en">
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>Atomic Guide - ${mode === 'login' ? 'Sign In' : 'Sign Up'}</title>
      <link href="/styles.css" rel="stylesheet">
      <script type="text/javascript">
        window.AUTH_MODE = '${mode}';
        window.API_BASE_URL = window.location.origin;
      </script>
    </head>
    <body>
      <div id="root"></div>
      <script type="module" src="/${scriptName}"></script>
    </body>
    </html>`;
}

// Embed endpoint - allows Atomic Guide to be embedded in external webpages (with auth)
app.get('/embed', async (c) => {
  // Check for auth token in Authorization header or cookie
  const authHeader = c.req.header('Authorization');
  const token = authHeader?.startsWith('Bearer ') ? authHeader.substring(7) : getCookie(c, 'auth_token');
  
  if (!token) {
    // No token, redirect to login page
    return c.redirect('/auth/login?returnUrl=/embed');
  }
  
  if (token) {
    // Verify token
    try {
      const _authHandlers = createAuthHandlers(c.env as any);
      // Simple check - just verify the token is valid
      const { AuthService } = await import('./features/auth/server/services/auth.service');
      const { UserRepository } = await import('./features/auth/server/repositories/user.repository');
      const { EmailService } = await import('./features/auth/server/services/email.service');
      
      const userRepository = new UserRepository(c.env.DB);
      const emailService = new EmailService({ appUrl: c.env.APP_URL || 'http://localhost:5989' });
      const authService = new AuthService(userRepository, emailService, c.env.JWT_SECRET || 'dev-secret');
      
      const user = await authService.checkSession(token);
      if (!user) {
        // Invalid token, redirect to login
        return c.redirect('/auth/login?returnUrl=/embed');
      }
    } catch (error) {
      console.error('Token verification error:', error);
      return c.redirect('/auth/login?returnUrl=/embed');
    }
  }
  
  // Valid auth, return embed page
  return c.html(embedHtml(launchScriptName));
});

// Health check and monitoring endpoints
app.get('/up', (c) => {
  const requestId = c.get('requestId') || 'unknown';
  return c.json({
    up: true,
    version: '1.3.3',
    timestamp: new Date().toISOString(),
    requestId,
  });
});

// LTI routes
app.get(LTI_JWKS_PATH, (c) => handleJwks(c));
app.post(LTI_INIT_PATH, (c) => handleInit(c, initScriptName));
app.post(LTI_REDIRECT_PATH, (c) => handleRedirect(c));

app.post(LTI_LAUNCH_PATH, async (c) => {
  // validateLaunchRequest will throw an exception if the request is invalid
  // and will return the idTokenWrapper and launchSettings
  // which allow the application to retrive values from the LTI launch
  const { launchSettings } = await validateLaunchRequest(c, getToolJwt);
  return c.html(launchHtml(launchSettings, launchScriptName));
});

// LTI Dynamic Registration routes
app.get(LTI_REGISTRATION_PATH, (c) => handleDynamicRegistrationInit(c, dynamicRegistrationHtml));
app.post(LTI_REGISTRATION_FINISH_PATH, (c) => handleDynamicRegistrationFinish(c, getToolConfiguration, handlePlatformResponse));

// LTI services
app.get(LTI_NAMES_AND_ROLES_PATH, (c) => handleNamesAndRoles(c));
app.post(LTI_SIGN_DEEP_LINK_PATH, (c) => handleSignDeepLink(c));

// Mount database test routes (development only)
app.route('/db', dbTestApp);

// Authentication routes (Epic 0: Developer Experience & Testing Infrastructure)
app.post('/api/auth/login', (c) => {
  const authHandlers = createAuthHandlers(c.env as any);
  return authHandlers.login(c);
});
app.post('/api/auth/signup', (c) => {
  const authHandlers = createAuthHandlers(c.env as any);
  return authHandlers.signup(c);
});
app.post('/api/auth/logout', (c) => {
  const authHandlers = createAuthHandlers(c.env as any);
  return authHandlers.logout(c);
});
app.post('/api/auth/forgot-password', (c) => {
  const authHandlers = createAuthHandlers(c.env as any);
  return authHandlers.forgotPassword(c);
});
app.post('/api/auth/reset-password', (c) => {
  const authHandlers = createAuthHandlers(c.env as any);
  return authHandlers.resetPassword(c);
});
app.post('/api/auth/verify-email', (c) => {
  const authHandlers = createAuthHandlers(c.env as any);
  return authHandlers.verifyEmail(c);
});
app.get('/api/auth/session', (c) => {
  const authHandlers = createAuthHandlers(c.env as any);
  return authHandlers.checkSession(c);
});
app.post('/api/auth/refresh', (c) => {
  const authHandlers = createAuthHandlers(c.env as any);
  return authHandlers.refreshToken(c);
});

// OAuth routes (Epic 0: OAuth Provider Integration)
app.get('/api/auth/oauth/google', (c) => {
  const oauthHandlers = createOAuthHandlers(c.env as any);
  return oauthHandlers.googleAuth(c);
});
app.get('/api/auth/oauth/google/callback', (c) => {
  const oauthHandlers = createOAuthHandlers(c.env as any);
  return oauthHandlers.googleCallback(c);
});
app.get('/api/auth/oauth/github', (c) => {
  const oauthHandlers = createOAuthHandlers(c.env as any);
  return oauthHandlers.githubAuth(c);
});
app.get('/api/auth/oauth/github/callback', (c) => {
  const oauthHandlers = createOAuthHandlers(c.env as any);
  return oauthHandlers.githubCallback(c);
});

// API routes (with auth protection)
app.post('/api/chat/message', requireAuth, (c) => handleChatMessage(c));
app.post('/api/chat/stream', requireAuth, (c) => handleChatStream(c));
app.get('/api/chat/search', requireAuth, (c) => searchChatHistory(c));
app.get('/api/chat/conversation/:conversationId', requireAuth, (c) => getChatConversation(c));
app.delete('/api/chat/conversation/:conversationId', requireAuth, (c) => deleteChatConversation(c));
app.get('/api/user/export', requireAuth, (c) => exportUserData(c));

// Dashboard API routes
app.get('/api/dashboard/conversations', requireAuth, (c) => getConversations(c));
app.get('/api/dashboard/insights', requireAuth, (c) => getLearningInsights(c));
app.post('/api/learner/learning-style', requireAuth, (c) => updateLearningStyle(c));
app.get('/api/dashboard/summary/:conversationId', requireAuth, (c) => getConversationSummary(c));

// Rich Media and FAQ API routes (Story 2.2)
app.route('/api/chat/faq', faqHandler);
app.route('/api/dashboard/faq', faqHandler);
app.route('/api/chat/media', richMediaHandler);
app.route('/api/learner/media', richMediaHandler);

// Proactive Suggestion API routes (Story 2.3)
app.route('/api/chat/suggestions', suggestionHandler);
app.route('/api/learner/suggestion-preferences', suggestionHandler);
app.route('/api/dashboard/suggestions', suggestionHandler);

// Mount content extraction and analysis routes
app.route('/api/content', contentHandler);

// Mount analytics API routes
const analyticsApi = createAnalyticsApi('default'); // TODO: Get tenant ID from context
app.route('/api/analytics', analyticsApi);

// Mount preferences API routes
const preferencesApi = createPreferencesApi('default'); // TODO: Get tenant ID from context
app.route('/api/preferences', preferencesApi);

// Mount cross-course intelligence API routes (Story 6.1)
const crossCourseApi = createCrossCourseApi('default'); // TODO: Get tenant ID from context
app.route('/api/cross-course', crossCourseApi);

// Mount instructor cross-course intelligence API routes (Story 6.1)
const instructorCrossCourseApi = createInstructorCrossCourseApi('default'); // TODO: Get tenant ID from context
app.route('/api/instructor/cross-course', instructorCrossCourseApi);

// Create AI Assessment handler and dependencies
async function createAssessmentHandler(env: Env): Promise<AssessmentHandler> {
  const sessionRepository = new AssessmentSessionRepository(env.DB);
  const aiService = new AssessmentAIService(env.AI, env);
  const gradePassbackService = new CanvasGradePassbackService();
  const contentGenerator = new AssessmentContentGenerator(env.AI, env);
  const assessmentEngine = new ConversationalAssessmentEngine(
    sessionRepository,
    aiService,
    env
  );

  return new AssessmentHandler(
    assessmentEngine,
    aiService,
    sessionRepository,
    gradePassbackService,
    contentGenerator
  );
}

// AI Assessment API routes (Story 7.1)
app.post('/api/ai-assessment/sessions', requireAuth, async (c) => {
  const handler = await createAssessmentHandler(c.env);
  return handler.createSession(c);
});

app.get('/api/ai-assessment/sessions/:sessionId', requireAuth, async (c) => {
  const handler = await createAssessmentHandler(c.env);
  return handler.getSession(c);
});

app.post('/api/ai-assessment/sessions/:sessionId/respond', requireAuth, async (c) => {
  const handler = await createAssessmentHandler(c.env);
  return handler.submitResponse(c);
});

app.post('/api/ai-assessment/sessions/:sessionId/retry', requireAuth, async (c) => {
  const handler = await createAssessmentHandler(c.env);
  return handler.retryResponse(c);
});

app.post('/api/ai-assessment/sessions/:sessionId/grade', requireAuth, async (c) => {
  const handler = await createAssessmentHandler(c.env);
  return handler.calculateGrade(c);
});

app.get('/api/ai-assessment/sessions', requireAuth, async (c) => {
  const handler = await createAssessmentHandler(c.env);
  return handler.listSessions(c);
});

app.post('/api/ai-assessment/generate-content', requireAuth, async (c) => {
  const handler = await createAssessmentHandler(c.env);
  return handler.generateContent(c);
});

app.get('/api/ai-assessment/analytics', requireAuth, async (c) => {
  const handler = await createAssessmentHandler(c.env);
  return handler.getAnalytics(c);
});

app.get('/api/ai-assessment/health', async (c) => {
  const handler = await createAssessmentHandler(c.env);
  return handler.healthCheck(c);
});

// Deep Linking API routes (Story 7.2)
app.post('/lti/deep-link/request', async (c) => {
  const handler = createDeepLinkingHandler(c.env.DB, c.env.AI, c.env);
  return handler.handleDeepLinkingRequest(c);
});

app.get('/lti/deep-link/configure/:sessionId', async (c) => {
  const handler = createDeepLinkingHandler(c.env.DB, c.env.AI, c.env);
  return handler.serveConfigurationInterface(c);
});

app.post('/lti/deep-link/submit', async (c) => {
  const handler = createDeepLinkingHandler(c.env.DB, c.env.AI, c.env);
  return handler.processConfigurationSubmission(c);
});

app.get('/lti/deep-link/validate/:sessionId', async (c) => {
  const handler = createDeepLinkingHandler(c.env.DB, c.env.AI, c.env);
  return handler.validateLTIAccess(c);
});

// Assessment Launch API routes (Legacy support)
app.post('/api/assessment/launch', requireAuth, handleAssessmentLaunch);
app.post('/api/assessment/submit/:attempt_id', requireAuth, handleAssessmentSubmission);
app.get('/api/assessment/history', requireAuth, getAssessmentHistory);

// Error handling
app.onError((err: Error, c) => {
  const requestId = c.get('requestId') || 'unknown';
  const timestamp = new Date().toISOString();

  // Structured error logging
  const errorLog = {
    requestId,
    timestamp,
    method: c.req.method,
    path: c.req.path,
    error: {
      name: err.name,
      message: err.message,
      stack: err.stack,
    },
  };

  console.error('Request error:', JSON.stringify(errorLog));

  if (err instanceof HTTPException) {
    return err.getResponse();
  }

  // Determine if it's a client or server error
  const isClientError = err.message.includes('validation') || err.message.includes('invalid') || err.message.includes('required');

  const statusCode = isClientError ? 400 : 500;
  const errorMessage = isClientError ? err.message : 'Internal server error';

  return c.json(
    {
      error: errorMessage,
      requestId,
      timestamp,
    },
    statusCode
  );
});

app.notFound((c) => {
  const requestId = c.get('requestId') || 'unknown';
  return c.json(
    {
      error: 'Not found',
      path: c.req.path,
      requestId,
    },
    404
  );
});

export default app;
