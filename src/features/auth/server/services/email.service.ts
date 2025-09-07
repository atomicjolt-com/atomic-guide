/**
 * @fileoverview Email service for authentication
 * Epic 0: Developer Experience & Testing Infrastructure
 * 
 * TODO: Integrate with actual email service (Resend, SendGrid, etc.)
 */

export class EmailService {
  private readonly appUrl: string;
  private readonly fromEmail: string;

  constructor(config: {
    appUrl: string;
    fromEmail?: string;
  }) {
    this.appUrl = config.appUrl;
    this.fromEmail = config.fromEmail || 'noreply@atomicguide.com';
  }

  /**
   * Send verification email
   */
  async sendVerificationEmail(email: string, token: string): Promise<void> {
    const verificationUrl = `${this.appUrl}/auth/verify-email?token=${token}`;
    
    // TODO: Implement actual email sending
    console.log(`[EMAIL] Verification email would be sent to ${email}`);
    console.log(`[EMAIL] Verification URL: ${verificationUrl}`);
    
    // In development, log the verification URL
    if (process.env.NODE_ENV === 'development') {
      console.log(`
        ========================================
        EMAIL VERIFICATION LINK
        To: ${email}
        Link: ${verificationUrl}
        ========================================
      `);
    }
  }

  /**
   * Send password reset email
   */
  async sendPasswordResetEmail(email: string, token: string): Promise<void> {
    const resetUrl = `${this.appUrl}/auth/reset-password?token=${token}`;
    
    // TODO: Implement actual email sending
    console.log(`[EMAIL] Password reset email would be sent to ${email}`);
    console.log(`[EMAIL] Reset URL: ${resetUrl}`);
    
    // In development, log the reset URL
    if (process.env.NODE_ENV === 'development') {
      console.log(`
        ========================================
        PASSWORD RESET LINK
        To: ${email}
        Link: ${resetUrl}
        ========================================
      `);
    }
  }

  /**
   * Send welcome email after successful registration
   */
  async sendWelcomeEmail(email: string, name?: string): Promise<void> {
    // TODO: Implement actual email sending
    console.log(`[EMAIL] Welcome email would be sent to ${email}`);
    
    // In development, log the welcome message
    if (process.env.NODE_ENV === 'development') {
      console.log(`
        ========================================
        WELCOME EMAIL
        To: ${email}
        Hi ${name || 'there'},
        Welcome to Atomic Guide!
        ========================================
      `);
    }
  }

  /**
   * Send password changed notification
   */
  async sendPasswordChangedEmail(email: string): Promise<void> {
    // TODO: Implement actual email sending
    console.log(`[EMAIL] Password changed notification would be sent to ${email}`);
    
    // In development, log the notification
    if (process.env.NODE_ENV === 'development') {
      console.log(`
        ========================================
        PASSWORD CHANGED NOTIFICATION
        To: ${email}
        Your password has been successfully changed.
        If you didn't make this change, please contact support immediately.
        ========================================
      `);
    }
  }
}