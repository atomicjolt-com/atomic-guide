/**
 * @fileoverview Enhanced embed handler with authentication
 * Epic 0: Developer Experience & Testing Infrastructure
 */

import type { Context } from 'hono';
import embedHtml from '../../../features/site/server/html/embed_html';
import { getClientAssetPath } from '../../../../shared/server/utils/manifest';

/**
 * Create auth page HTML for login/signup
 */
function authPageHtml(scriptName: string): string {
  const head = `
    <link href="https://fonts.googleapis.com/icon?family=Material+Icons+Outlined" rel="stylesheet">
    <link href="/styles.css" rel="stylesheet">
    <style>
      /* Import auth styles */
      ${getAuthStyles()}
    </style>
    <script type="text/javascript">
      window.AUTH_MODE = true;
      window.API_BASE_URL = window.location.origin;
    </script>
  `;
  
  const body = `
    <div id="root"></div>
    <script type="module" src="/${scriptName}"></script>
  `;
  
  return `<!DOCTYPE html>
    <html lang="en">
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>Atomic Guide - Sign In</title>
      ${head}
    </head>
    <body>
      ${body}
    </body>
    </html>`;
}

/**
 * Get auth styles inline
 */
function getAuthStyles(): string {
  // Return the auth styles inline for now
  // In production, this would be loaded from a file
  return `
    .auth-container {
      min-height: 100vh;
      display: flex;
      align-items: center;
      justify-content: center;
      background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
      padding: 2rem;
    }
    
    .auth-card {
      background: white;
      border-radius: 12px;
      box-shadow: 0 10px 40px rgba(0, 0, 0, 0.1);
      width: 100%;
      max-width: 420px;
      padding: 2.5rem;
    }
    
    .auth-header {
      text-align: center;
      margin-bottom: 2rem;
    }
    
    .auth-header h1 {
      font-size: 1.875rem;
      font-weight: 700;
      color: #1a202c;
      margin-bottom: 0.5rem;
    }
    
    .auth-header p {
      color: #718096;
      font-size: 0.9375rem;
    }
    
    .form-group {
      margin-bottom: 1.25rem;
    }
    
    .form-group label {
      display: block;
      font-size: 0.875rem;
      font-weight: 500;
      color: #4a5568;
      margin-bottom: 0.5rem;
    }
    
    .form-group input {
      width: 100%;
      padding: 0.75rem 1rem;
      font-size: 0.9375rem;
      border: 1px solid #e2e8f0;
      border-radius: 6px;
      transition: all 0.2s;
    }
    
    .form-group input:focus {
      outline: none;
      border-color: #667eea;
      box-shadow: 0 0 0 3px rgba(102, 126, 234, 0.1);
    }
    
    .btn {
      padding: 0.75rem 1.5rem;
      font-size: 0.9375rem;
      font-weight: 500;
      border-radius: 6px;
      border: none;
      cursor: pointer;
      transition: all 0.2s;
      display: inline-flex;
      align-items: center;
      justify-content: center;
    }
    
    .btn-primary {
      background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
      color: white;
      width: 100%;
    }
    
    .btn-primary:hover:not(:disabled) {
      transform: translateY(-1px);
      box-shadow: 0 4px 12px rgba(102, 126, 234, 0.35);
    }
    
    .btn-primary:disabled {
      opacity: 0.6;
      cursor: not-allowed;
    }
    
    .alert {
      padding: 0.75rem 1rem;
      border-radius: 6px;
      margin-bottom: 1.25rem;
      font-size: 0.875rem;
    }
    
    .alert-error {
      background-color: #fed7d7;
      color: #c53030;
      border: 1px solid #fc8181;
    }
    
    .link-primary {
      color: #667eea;
      text-decoration: none;
      font-weight: 500;
    }
    
    .link-primary:hover {
      color: #5a67d8;
      text-decoration: underline;
    }
    
    .password-input-wrapper {
      position: relative;
    }
    
    .password-toggle {
      position: absolute;
      right: 0.75rem;
      top: 50%;
      transform: translateY(-50%);
      background: none;
      border: none;
      cursor: pointer;
      padding: 0.25rem;
      font-size: 1.25rem;
      opacity: 0.6;
    }
    
    .password-toggle:hover {
      opacity: 1;
    }
  `;
}

/**
 * Handle embed endpoint with authentication check
 */
export async function handleEmbedWithAuth(c: Context): Promise<Response> {
  // Check for authentication token in cookie or header
  const token = c.req.cookie('auth_token') || c.req.header('Authorization')?.replace('Bearer ', '');
  
  // For development, check if auth is bypassed
  const bypassAuth = c.env.BYPASS_AUTH === 'true' || c.req.query('bypass_auth') === 'true';
  
  if (bypassAuth) {
    // Return the regular embed page without auth
    const launchScriptName = getClientAssetPath(c.env.NODE_ENV, 'launch');
    return c.html(embedHtml(launchScriptName));
  }
  
  // If no token, return auth page
  if (!token) {
    const authScriptName = getClientAssetPath(c.env.NODE_ENV, 'auth');
    return c.html(authPageHtml(authScriptName));
  }
  
  // Verify token
  try {
    // Import auth service to verify token
    const { AuthService } = await import('../services/auth.service');
    const { UserRepository } = await import('../repositories/user.repository');
    const { EmailService } = await import('../services/email.service');
    
    const userRepository = new UserRepository(c.env.DB);
    const emailService = new EmailService({ appUrl: c.env.APP_URL || 'http://localhost:5989' });
    const authService = new AuthService(userRepository, emailService, c.env.JWT_SECRET || 'dev-secret');
    
    const user = await authService.checkSession(token);
    
    if (!user) {
      // Invalid token, return auth page
      const authScriptName = getClientAssetPath(c.env.NODE_ENV, 'auth');
      return c.html(authPageHtml(authScriptName));
    }
    
    // Valid token, return embed page with user context
    const launchScriptName = getClientAssetPath(c.env.NODE_ENV, 'launch');
    return c.html(embedHtml(launchScriptName));
    
  } catch (error) {
    console.error('Auth verification error:', error);
    // On error, return auth page
    const authScriptName = getClientAssetPath(c.env.NODE_ENV, 'auth');
    return c.html(authPageHtml(authScriptName));
  }
}