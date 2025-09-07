/**
 * @fileoverview Authentication request handlers
 * Epic 0: Developer Experience & Testing Infrastructure
 */

import type { Context } from 'hono';
import { setCookie } from 'hono/cookie';
import type { D1Database } from '@cloudflare/workers-types';
import { UserRepository } from '../repositories/user.repository';
import { AuthService } from '../services/auth.service';
import { EmailService } from '../services/email.service';
import { AuthError } from '../../shared/types/auth.types';

/**
 * Create authentication handlers
 */
export function createAuthHandlers(env: { DB: D1Database; JWT_SECRET: string; APP_URL: string }) {
  const userRepository = new UserRepository(env.DB);
  const emailService = new EmailService({ appUrl: env.APP_URL });
  const authService = new AuthService(userRepository, emailService, env.JWT_SECRET);

  return {
    /**
     * POST /api/auth/login
     */
    async login(c: Context): Promise<Response> {
      try {
        const body = await c.req.json();
        const userAgent = c.req.header('User-Agent');
        const ipAddress = c.req.header('CF-Connecting-IP') || c.req.header('X-Forwarded-For');

        const response = await authService.login(body, userAgent, ipAddress);

        // Set secure cookies for tokens
        setCookie(c, 'refresh_token', response.refreshToken, {
          httpOnly: true,
          secure: true,
          sameSite: 'Strict',
          maxAge: 604800, // 7 days
          path: '/'
        });
        
        // Also set auth token cookie for easy access
        setCookie(c, 'auth_token', response.token, {
          httpOnly: true,
          secure: true,
          sameSite: 'Strict',
          maxAge: 86400, // 24 hours
          path: '/'
        });

        return c.json({
          user: response.user,
          token: response.token
        });
      } catch (error) {
        if (error instanceof Error) {
          switch (error.message) {
            case AuthError.INVALID_CREDENTIALS:
              return c.json({ error: 'Invalid email or password' }, 401);
            case AuthError.EMAIL_NOT_VERIFIED:
              return c.json({ error: 'Please verify your email first' }, 403);
            default:
              console.error('Login error:', error);
              return c.json({ error: 'Login failed' }, 500);
          }
        }
        return c.json({ error: 'Login failed' }, 500);
      }
    },

    /**
     * POST /api/auth/signup
     */
    async signup(c: Context): Promise<Response> {
      try {
        const body = await c.req.json();
        const userAgent = c.req.header('User-Agent');
        const ipAddress = c.req.header('CF-Connecting-IP') || c.req.header('X-Forwarded-For');

        const response = await authService.signup(body, userAgent, ipAddress);

        // Set secure cookies for tokens
        setCookie(c, 'refresh_token', response.refreshToken, {
          httpOnly: true,
          secure: true,
          sameSite: 'Strict',
          maxAge: 604800, // 7 days
          path: '/'
        });
        
        // Also set auth token cookie for easy access
        setCookie(c, 'auth_token', response.token, {
          httpOnly: true,
          secure: true,
          sameSite: 'Strict',
          maxAge: 86400, // 24 hours
          path: '/'
        });

        return c.json({
          user: response.user,
          token: response.token,
          emailVerificationSent: response.emailVerificationSent
        }, 201);
      } catch (error) {
        if (error instanceof Error) {
          switch (error.message) {
            case AuthError.EMAIL_ALREADY_EXISTS:
              return c.json({ error: 'Email already registered' }, 409);
            case AuthError.WEAK_PASSWORD:
              return c.json({ error: 'Password does not meet requirements' }, 400);
            default:
              console.error('Signup error:', error);
              return c.json({ error: 'Signup failed' }, 500);
          }
        }
        return c.json({ error: 'Signup failed' }, 500);
      }
    },

    /**
     * POST /api/auth/logout
     */
    async logout(c: Context): Promise<Response> {
      try {
        const authHeader = c.req.header('Authorization');
        if (!authHeader?.startsWith('Bearer ')) {
          return c.json({ error: 'Unauthorized' }, 401);
        }

        const token = authHeader.substring(7);
        const payload = await authService.verifyToken(token);
        
        await authService.logout(payload.sessionId);

        // Clear cookies
        setCookie(c, 'refresh_token', '', {
          httpOnly: true,
          secure: true,
          sameSite: 'Strict',
          maxAge: 0,
          path: '/'
        });
        
        setCookie(c, 'auth_token', '', {
          httpOnly: true,
          secure: true,
          sameSite: 'Strict',
          maxAge: 0,
          path: '/'
        });

        return c.json({ message: 'Logged out successfully' });
      } catch (error) {
        console.error('Logout error:', error);
        return c.json({ error: 'Logout failed' }, 500);
      }
    },

    /**
     * POST /api/auth/forgot-password
     */
    async forgotPassword(c: Context): Promise<Response> {
      try {
        const body = await c.req.json();
        await authService.forgotPassword(body);

        // Always return success to prevent email enumeration
        return c.json({ 
          message: 'If an account exists with this email, a password reset link has been sent' 
        });
      } catch (error) {
        console.error('Forgot password error:', error);
        return c.json({ error: 'Failed to process request' }, 500);
      }
    },

    /**
     * POST /api/auth/reset-password
     */
    async resetPassword(c: Context): Promise<Response> {
      try {
        const body = await c.req.json();
        await authService.resetPassword(body);

        return c.json({ message: 'Password reset successfully' });
      } catch (error) {
        if (error instanceof Error && error.message === AuthError.TOKEN_INVALID) {
          return c.json({ error: 'Invalid or expired reset token' }, 400);
        }
        console.error('Reset password error:', error);
        return c.json({ error: 'Failed to reset password' }, 500);
      }
    },

    /**
     * POST /api/auth/verify-email
     */
    async verifyEmail(c: Context): Promise<Response> {
      try {
        const body = await c.req.json();
        await authService.verifyEmail(body);

        return c.json({ message: 'Email verified successfully' });
      } catch (error) {
        if (error instanceof Error && error.message === AuthError.TOKEN_INVALID) {
          return c.json({ error: 'Invalid or expired verification token' }, 400);
        }
        console.error('Verify email error:', error);
        return c.json({ error: 'Failed to verify email' }, 500);
      }
    },

    /**
     * GET /api/auth/session
     */
    async checkSession(c: Context): Promise<Response> {
      try {
        const authHeader = c.req.header('Authorization');
        if (!authHeader?.startsWith('Bearer ')) {
          return c.json({ authenticated: false }, 401);
        }

        const token = authHeader.substring(7);
        const user = await authService.checkSession(token);

        if (!user) {
          return c.json({ authenticated: false }, 401);
        }

        return c.json({ 
          authenticated: true,
          user 
        });
      } catch (error) {
        console.error('Check session error:', error);
        return c.json({ authenticated: false }, 401);
      }
    },

    /**
     * POST /api/auth/refresh
     */
    async refreshToken(c: Context): Promise<Response> {
      try {
        const refreshToken = c.req.cookie('refresh_token');
        if (!refreshToken) {
          return c.json({ error: 'Refresh token not found' }, 401);
        }

        const response = await authService.refreshToken({ refreshToken });

        // Update refresh token cookie
        setCookie(c, 'refresh_token', response.refreshToken, {
          httpOnly: true,
          secure: true,
          sameSite: 'Strict',
          maxAge: 604800, // 7 days
          path: '/'
        });

        return c.json({ token: response.token });
      } catch (error) {
        if (error instanceof Error) {
          switch (error.message) {
            case AuthError.TOKEN_INVALID:
            case AuthError.SESSION_EXPIRED:
              return c.json({ error: 'Invalid refresh token' }, 401);
            default:
              console.error('Refresh token error:', error);
              return c.json({ error: 'Failed to refresh token' }, 500);
          }
        }
        return c.json({ error: 'Failed to refresh token' }, 500);
      }
    }
  };
}

/**
 * Middleware to require authentication
 */
export async function requireAuth(c: Context, next: Function): Promise<Response | void> {
  const authHeader = c.req.header('Authorization');
  if (!authHeader?.startsWith('Bearer ')) {
    return c.json({ error: 'Unauthorized' }, 401);
  }

  const token = authHeader.substring(7);
  
  try {
    // Get auth service from context
    const env = c.env as { DB: D1Database; JWT_SECRET: string; APP_URL: string };
    const userRepository = new UserRepository(env.DB);
    const emailService = new EmailService({ appUrl: env.APP_URL });
    const authService = new AuthService(userRepository, emailService, env.JWT_SECRET);

    const user = await authService.checkSession(token);
    if (!user) {
      return c.json({ error: 'Invalid session' }, 401);
    }

    // Add user to context
    c.set('user', user);
    await next();
  } catch (error) {
    console.error('Auth middleware error:', error);
    return c.json({ error: 'Authentication failed' }, 401);
  }
}