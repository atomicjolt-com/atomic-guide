/**
 * @fileoverview OAuth provider service for Atomic Guide
 * Epic 0: Developer Experience & Testing Infrastructure
 */

import { UserRepository } from '../repositories/user.repository';
import { AuthService } from './auth.service';
import { EmailService } from './email.service';
import { UserIdSchema } from '../../shared/schemas/auth.schema';
import type { User } from '../../shared/types/auth.types';

export interface OAuthConfig {
  google?: {
    clientId: string;
    clientSecret: string;
    redirectUri: string;
  };
  github?: {
    clientId: string;
    clientSecret: string;
    redirectUri: string;
  };
}

export interface OAuthUserInfo {
  id: string;
  email: string;
  name?: string;
  picture?: string;
  provider: 'google' | 'github';
}

export class OAuthService {
  constructor(
    private userRepository: UserRepository,
    private authService: AuthService,
    private config: OAuthConfig
  ) {}

  /**
   * Get OAuth authorization URL
   */
  getAuthorizationUrl(provider: 'google' | 'github'): string {
    switch (provider) {
      case 'google': {
        if (!this.config.google) throw new Error('Google OAuth not configured');
        const googleParams = new URLSearchParams({
          client_id: this.config.google.clientId,
          redirect_uri: this.config.google.redirectUri,
          response_type: 'code',
          scope: 'openid email profile',
          access_type: 'offline',
          prompt: 'consent'
        });
        return `https://accounts.google.com/o/oauth2/v2/auth?${googleParams}`;
      }
      
      case 'github': {
        if (!this.config.github) throw new Error('GitHub OAuth not configured');
        const githubParams = new URLSearchParams({
          client_id: this.config.github.clientId,
          redirect_uri: this.config.github.redirectUri,
          scope: 'user:email'
        });
        return `https://github.com/login/oauth/authorize?${githubParams}`;
      }
      
      default:
        throw new Error(`Unsupported OAuth provider: ${provider}`);
    }
  }

  /**
   * Exchange authorization code for access token
   */
  async exchangeCodeForToken(provider: 'google' | 'github', code: string): Promise<string> {
    switch (provider) {
      case 'google': {
        if (!this.config.google) throw new Error('Google OAuth not configured');

        const googleTokenResponse = await fetch('https://oauth2.googleapis.com/token', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/x-www-form-urlencoded',
          },
          body: new URLSearchParams({
            code,
            client_id: this.config.google.clientId,
            client_secret: this.config.google.clientSecret,
            redirect_uri: this.config.google.redirectUri,
            grant_type: 'authorization_code'
          })
        });

        if (!googleTokenResponse.ok) {
          throw new Error('Failed to exchange code for Google token');
        }

        const googleData = await googleTokenResponse.json();
        return googleData.access_token;
      }
      
      case 'github': {
        if (!this.config.github) throw new Error('GitHub OAuth not configured');

        const githubTokenResponse = await fetch('https://github.com/login/oauth/access_token', {
          method: 'POST',
          headers: {
            'Accept': 'application/json',
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            client_id: this.config.github.clientId,
            client_secret: this.config.github.clientSecret,
            code,
            redirect_uri: this.config.github.redirectUri
          })
        });

        if (!githubTokenResponse.ok) {
          throw new Error('Failed to exchange code for GitHub token');
        }

        const githubData = await githubTokenResponse.json();
        return githubData.access_token;
      }
      
      default:
        throw new Error(`Unsupported OAuth provider: ${provider}`);
    }
  }

  /**
   * Get user info from OAuth provider
   */
  async getUserInfo(provider: 'google' | 'github', accessToken: string): Promise<OAuthUserInfo> {
    switch (provider) {
      case 'google': {
        const googleUserResponse = await fetch('https://www.googleapis.com/oauth2/v2/userinfo', {
          headers: {
            'Authorization': `Bearer ${accessToken}`
          }
        });

        if (!googleUserResponse.ok) {
          throw new Error('Failed to get Google user info');
        }

        const googleUser = await googleUserResponse.json();
        return {
          id: googleUser.id,
          email: googleUser.email,
          name: googleUser.name,
          picture: googleUser.picture,
          provider: 'google'
        };
      }
      
      case 'github': {
        // Get user info
        const githubUserResponse = await fetch('https://api.github.com/user', {
          headers: {
            'Authorization': `Bearer ${accessToken}`,
            'Accept': 'application/vnd.github.v3+json'
          }
        });

        if (!githubUserResponse.ok) {
          throw new Error('Failed to get GitHub user info');
        }

        const githubUser = await githubUserResponse.json();

        // Get primary email
        const githubEmailResponse = await fetch('https://api.github.com/user/emails', {
          headers: {
            'Authorization': `Bearer ${accessToken}`,
            'Accept': 'application/vnd.github.v3+json'
          }
        });

        if (!githubEmailResponse.ok) {
          throw new Error('Failed to get GitHub user email');
        }

        const githubEmails = await githubEmailResponse.json();
        const primaryEmail = githubEmails.find((e: any) => e.primary)?.email || githubUser.email;

        return {
          id: githubUser.id.toString(),
          email: primaryEmail,
          name: githubUser.name || githubUser.login,
          picture: githubUser.avatar_url,
          provider: 'github'
        };
      }
      
      default:
        throw new Error(`Unsupported OAuth provider: ${provider}`);
    }
  }

  /**
   * Handle OAuth callback and create/login user
   */
  async handleOAuthCallback(
    provider: 'google' | 'github', 
    code: string,
    userAgent?: string,
    ipAddress?: string
  ): Promise<{ user: User; token: string; refreshToken: string }> {
    // Exchange code for token
    const accessToken = await this.exchangeCodeForToken(provider, code);
    
    // Get user info from provider
    const oauthUserInfo = await this.getUserInfo(provider, accessToken);
    
    // Check if user exists
    let user = await this.userRepository.findByEmail(oauthUserInfo.email);
    
    if (!user) {
      // Create new user from OAuth info
      user = await this.userRepository.createUser({
        email: oauthUserInfo.email,
        passwordHash: '', // OAuth users don't have passwords
        name: oauthUserInfo.name
      });
      
      // Mark email as verified since it comes from OAuth provider
      await this.userRepository.markEmailVerified(user.id);
      
      // Store OAuth provider info (you may want to create an oauth_accounts table)
      await this.storeOAuthAccount(user.id, provider, oauthUserInfo.id);
    }
    
    // Generate tokens using the standard auth service
    const sessionId = crypto.randomUUID();
    const token = await this.authService['generateToken']({
      userId: user.id,
      email: user.email,
      sessionId: UserIdSchema.parse(sessionId)
    });
    const refreshToken = await this.authService['generateRefreshToken']({
      userId: user.id,
      email: user.email,
      sessionId: UserIdSchema.parse(sessionId)
    });
    
    // Create session
    await this.userRepository.createSession({
      userId: user.id,
      tokenHash: await this.authService['hashToken'](token),
      refreshTokenHash: await this.authService['hashToken'](refreshToken),
      expiresAt: new Date(Date.now() + 86400000), // 24 hours
      userAgent,
      ipAddress
    });
    
    return {
      user,
      token,
      refreshToken
    };
  }
  
  /**
   * Store OAuth account info (simplified - you'd want a proper oauth_accounts table)
   */
  private async storeOAuthAccount(userId: string, provider: string, providerId: string): Promise<void> {
    // In a real implementation, you'd have an oauth_accounts table
    // For now, we'll just log this
    console.log(`OAuth account stored: User ${userId} linked to ${provider} account ${providerId}`);
  }
}