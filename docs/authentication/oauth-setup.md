# OAuth Provider Setup Guide

This guide explains how to set up OAuth authentication with Google and GitHub for Atomic Guide.

## Google OAuth Setup

### 1. Create a Google Cloud Project

1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Create a new project or select an existing one
3. Enable the Google+ API for your project

### 2. Create OAuth 2.0 Credentials

1. Navigate to **APIs & Services** > **Credentials**
2. Click **Create Credentials** > **OAuth client ID**
3. Configure the OAuth consent screen if prompted:
   - Application name: "Atomic Guide"
   - User support email: Your email
   - Authorized domains: Your domain (for production)
4. Select **Web application** as the application type
5. Add authorized redirect URIs:
   - Development: `http://localhost:5990/api/auth/oauth/google/callback`
   - Production: `https://yourdomain.com/api/auth/oauth/google/callback`
6. Save your credentials

### 3. Configure Environment Variables

Add to your `.dev.vars` file:
```env
GOOGLE_CLIENT_ID=your-client-id.apps.googleusercontent.com
GOOGLE_CLIENT_SECRET=your-client-secret
```

## GitHub OAuth Setup

### 1. Create a GitHub OAuth App

1. Go to [GitHub Developer Settings](https://github.com/settings/developers)
2. Click **New OAuth App**
3. Fill in the application details:
   - Application name: "Atomic Guide"
   - Homepage URL: `http://localhost:5990` (for development)
   - Authorization callback URL: `http://localhost:5990/api/auth/oauth/github/callback`
4. Register the application

### 2. Configure Environment Variables

Add to your `.dev.vars` file:
```env
GITHUB_CLIENT_ID=your-github-client-id
GITHUB_CLIENT_SECRET=your-github-client-secret
```

## Production Deployment

For production deployment on Cloudflare Workers:

### 1. Add Secrets to Wrangler

```bash
# Google OAuth
wrangler secret put GOOGLE_CLIENT_ID
wrangler secret put GOOGLE_CLIENT_SECRET

# GitHub OAuth
wrangler secret put GITHUB_CLIENT_ID
wrangler secret put GITHUB_CLIENT_SECRET

# App URL
wrangler secret put APP_URL
```

### 2. Update OAuth Redirect URIs

Update your OAuth app settings with production URLs:
- Google: `https://guide.atomicjolt.xyz/api/auth/oauth/google/callback`
- GitHub: `https://guide.atomicjolt.xyz/api/auth/oauth/github/callback`

## Testing OAuth

1. Start the development server:
   ```bash
   npm run dev
   ```

2. Navigate to the login page:
   ```
   http://localhost:5990/auth/login
   ```

3. Click "Continue with Google" or "Continue with GitHub"

4. Authorize the application

5. You should be redirected to `/embed` with a valid session

## Security Considerations

1. **Never commit OAuth secrets** to version control
2. **Use environment variables** for all sensitive configuration
3. **Validate redirect URIs** to prevent open redirect vulnerabilities
4. **Use HTTPS in production** for all OAuth flows
5. **Implement CSRF protection** for OAuth state parameter
6. **Store minimal user data** from OAuth providers

## Troubleshooting

### Common Issues

1. **"redirect_uri_mismatch" error**
   - Ensure the callback URL in your OAuth app matches exactly
   - Check for trailing slashes and protocol (http vs https)

2. **"invalid_client" error**
   - Verify your client ID and secret are correct
   - Check that the OAuth app is not disabled

3. **Cookie not being set**
   - Ensure you're using HTTPS in production
   - Check SameSite cookie settings

4. **User already exists error**
   - This happens when an email is already registered
   - Consider implementing account linking for existing users

## OAuth User Data

When a user signs in with OAuth, we store:
- Email address (verified by provider)
- Name (if provided)
- Provider ID (for account linking)

We do NOT store:
- OAuth access tokens (except temporarily during login)
- Profile pictures (unless explicitly needed)
- Other personal information from the provider

## Account Linking

Users can link multiple OAuth providers to the same account if they share the same email address. This is handled automatically by the system.

## Revoking Access

Users can revoke OAuth access from:
- Google: [Google Account Permissions](https://myaccount.google.com/permissions)
- GitHub: [GitHub Applications](https://github.com/settings/applications)