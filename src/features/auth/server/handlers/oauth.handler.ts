/**
 * @fileoverview OAuth request handlers
 * Epic 0: Developer Experience & Testing Infrastructure
 */

import type { Context } from 'hono';
import type { D1Database } from '@cloudflare/workers-types';
import { UserRepository } from '../repositories/user.repository';
import { AuthService } from '../services/auth.service';
import { EmailService } from '../services/email.service';
import { OAuthService } from '../services/oauth.service';

/**
 * Create OAuth handlers
 */
export function createOAuthHandlers(env: { 
  DB: D1Database; 
  JWT_SECRET: string; 
  APP_URL: string;
  GOOGLE_CLIENT_ID?: string;
  GOOGLE_CLIENT_SECRET?: string;
  GITHUB_CLIENT_ID?: string;
  GITHUB_CLIENT_SECRET?: string;
}) {
  const userRepository = new UserRepository(env.DB);
  const emailService = new EmailService({ appUrl: env.APP_URL });
  const authService = new AuthService(userRepository, emailService, env.JWT_SECRET);
  
  const oauthService = new OAuthService(userRepository, authService, {
    google: env.GOOGLE_CLIENT_ID && env.GOOGLE_CLIENT_SECRET ? {
      clientId: env.GOOGLE_CLIENT_ID,
      clientSecret: env.GOOGLE_CLIENT_SECRET,
      redirectUri: `${env.APP_URL}/api/auth/oauth/google/callback`
    } : undefined,
    github: env.GITHUB_CLIENT_ID && env.GITHUB_CLIENT_SECRET ? {
      clientId: env.GITHUB_CLIENT_ID,
      clientSecret: env.GITHUB_CLIENT_SECRET,
      redirectUri: `${env.APP_URL}/api/auth/oauth/github/callback`
    } : undefined
  });

  return {
    /**
     * GET /api/auth/oauth/google
     * Redirect to Google OAuth
     */
    async googleAuth(c: Context): Promise<Response> {
      try {
        const authUrl = oauthService.getAuthorizationUrl('google');
        return c.redirect(authUrl);
      } catch (error) {
        console.error('Google OAuth error:', error);
        return c.json({ error: 'Google OAuth not configured' }, 501);
      }
    },

    /**
     * GET /api/auth/oauth/google/callback
     * Handle Google OAuth callback
     */
    async googleCallback(c: Context): Promise<Response> {
      try {
        const code = c.req.query('code');
        const error = c.req.query('error');
        
        if (error) {
          return c.redirect(`/auth/login?error=${encodeURIComponent(error)}`);
        }
        
        if (!code) {
          return c.redirect('/auth/login?error=missing_code');
        }
        
        const userAgent = c.req.header('User-Agent');
        const ipAddress = c.req.header('CF-Connecting-IP') || c.req.header('X-Forwarded-For');
        
        const result = await oauthService.handleOAuthCallback('google', code, userAgent, ipAddress);
        
        // Set cookies
        c.cookie('refresh_token', result.refreshToken, {
          httpOnly: true,
          secure: true,
          sameSite: 'Strict',
          maxAge: 604800, // 7 days
          path: '/'
        });
        
        c.cookie('auth_token', result.token, {
          httpOnly: true,
          secure: true,
          sameSite: 'Strict',
          maxAge: 86400, // 24 hours
          path: '/'
        });
        
        // Redirect to app
        return c.redirect('/embed');
      } catch (error) {
        console.error('Google OAuth callback error:', error);
        return c.redirect('/auth/login?error=oauth_failed');
      }
    },

    /**
     * GET /api/auth/oauth/github
     * Redirect to GitHub OAuth
     */
    async githubAuth(c: Context): Promise<Response> {
      try {
        const authUrl = oauthService.getAuthorizationUrl('github');
        return c.redirect(authUrl);
      } catch (error) {
        console.error('GitHub OAuth error:', error);
        return c.json({ error: 'GitHub OAuth not configured' }, 501);
      }
    },

    /**
     * GET /api/auth/oauth/github/callback
     * Handle GitHub OAuth callback
     */
    async githubCallback(c: Context): Promise<Response> {
      try {
        const code = c.req.query('code');
        const error = c.req.query('error');
        
        if (error) {
          return c.redirect(`/auth/login?error=${encodeURIComponent(error)}`);
        }
        
        if (!code) {
          return c.redirect('/auth/login?error=missing_code');
        }
        
        const userAgent = c.req.header('User-Agent');
        const ipAddress = c.req.header('CF-Connecting-IP') || c.req.header('X-Forwarded-For');
        
        const result = await oauthService.handleOAuthCallback('github', code, userAgent, ipAddress);
        
        // Set cookies
        c.cookie('refresh_token', result.refreshToken, {
          httpOnly: true,
          secure: true,
          sameSite: 'Strict',
          maxAge: 604800, // 7 days
          path: '/'
        });
        
        c.cookie('auth_token', result.token, {
          httpOnly: true,
          secure: true,
          sameSite: 'Strict',
          maxAge: 86400, // 24 hours
          path: '/'
        });
        
        // Redirect to app
        return c.redirect('/embed');
      } catch (error) {
        console.error('GitHub OAuth callback error:', error);
        return c.redirect('/auth/login?error=oauth_failed');
      }
    }
  };
}