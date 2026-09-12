'use strict';

const crypto = require('node:crypto');
const nodemailer = require('nodemailer');
const { signPasswordResetToken } = require('../../../core/security');
const { emailQueue } = require('../../../infrastructure/workers/queue');
const config = require('../../../core/config');

const directMailer = nodemailer.createTransport({
  host: config.smtp.host,
  port: config.smtp.port,
  secure: config.smtp.secure,
  connectionTimeout: 5000,
  greetingTimeout: 5000,
  socketTimeout: 5000,
  auth: {
    user: config.smtp.user,
    pass: config.smtp.pass,
  },
});

/**
 * Request a password reset email.
 * Security behavior: never reveal whether a user exists.
 */
class ForgotPasswordUseCase {
  constructor({ userRepository }) {
    this.userRepository = userRepository;
  }

  async execute(dto) {
    const email = dto.email.trim().toLowerCase();
    const user = await this.userRepository.findByEmail(email);

    if (!user) {
      return {
        message: 'If an account exists for that email, a password reset link has been sent.',
      };
    }

    const token = signPasswordResetToken({
      sub: user.id,
      purpose: 'password-reset',
      jti: crypto.randomUUID(),
    });

    const resetUrl = `${config.app.frontendUrl}/reset-password?token=${encodeURIComponent(token)}`;

    try {
      const emailData = {
        firstName: user.firstName,
        resetUrl,
      };

      if (process.env.VERCEL) {
        // Do not hold the serverless request open on an SMTP connection. The
        // reset response is intentionally generic and must remain fast.
        void directMailer
          .sendMail({
            from: config.smtp.from,
            to: user.email,
            subject: 'Reset your Volunteer Platform password',
            html: `
            <h2>Hello ${emailData.firstName || 'there'}!</h2>
            <p>We received a request to reset your password.</p>
            <p><a href="${emailData.resetUrl}">Choose a new password</a></p>
            <p>If you did not request this, you can ignore this email.</p>
          `,
          })
          .then(() => console.info('[ForgotPassword] Reset email sent'))
          .catch((error) =>
            console.error('[ForgotPassword] Reset email was not sent:', error.message)
          );
      } else {
        await emailQueue.add('send-password-reset-email', {
          to: user.email,
          template: 'password-reset',
          data: emailData,
        });
      }
    } catch (error) {
      // Keep the endpoint intentionally generic and avoid reporting a reset
      // request as failed when the optional queue is unavailable.
      console.error('[ForgotPassword] Reset email was not queued:', error.message);
    }

    return {
      message: 'If an account exists for that email, a password reset link has been sent.',
    };
  }
}

module.exports = { ForgotPasswordUseCase };
