'use strict';

const { Worker } = require('bullmq');
const nodemailer = require('nodemailer');
const { getRedis } = require('../../core/redis');
const config = require('../../core/config');

// ─── Nodemailer Transport ─────────────────────────────────────
const transporter = nodemailer.createTransport({
  host: config.smtp.host,
  port: config.smtp.port,
  secure: config.smtp.secure,
  auth: {
    user: config.smtp.user,
    pass: config.smtp.pass,
  },
});

// ─── Email Templates ─────────────────────────────────────────

function getWelcomeTemplate(data) {
  return {
    subject: 'Welcome to Volunteer Platform!',
    html: `
      <h2>Welcome, ${data.firstName}!</h2>
      <p>Your account has been created successfully.</p>
      <p>Start exploring volunteer opportunities at <strong>Volunteer Platform</strong>.</p>
    `,
  };
}

function getPassportIssuedTemplate(data) {
  return {
    subject: 'Your Volunteer Passport has been issued!',
    html: `
      <h2>Congratulations, ${data.fullName}!</h2>
      <p>Your Volunteer Passport has been issued for <strong>${data.totalHours} hours</strong> of service.</p>
      <p>Your passport is valid until <strong>${new Date(data.expiresAt).toLocaleDateString()}</strong>.</p>
      ${data.pdfUrl ? `<p><a href="${data.pdfUrl}">Download your Passport PDF</a></p>` : ''}
    `,
  };
}

function getCheckInConfirmationTemplate(data) {
  return {
    subject: `Check-in confirmed: ${data.eventTitle}`,
    html: `
      <h2>You're checked in!</h2>
      <p>You have successfully checked in to <strong>${data.eventTitle}</strong>.</p>
      <p>Check-in time: ${new Date(data.checkInTime).toLocaleString()}</p>
    `,
  };
}

function getPasswordResetTemplate(data) {
  return {
    subject: 'Reset your Volunteer Platform password',
    html: `
      <h2>Hello ${data.firstName || 'there'}!</h2>
      <p>We received a request to reset your password.</p>
      <p>Click the button below to choose a new password:</p>
      <p>
        <a href="${data.resetUrl}" style="display:inline-block;background:#1a73e8;color:#fff;padding:12px 20px;text-decoration:none;border-radius:6px;">
          Reset Password
        </a>
      </p>
      <p>If you didn’t request this, you can ignore this email.</p>
      <p>This link expires in 1 hour.</p>
    `,
  };
}

const TEMPLATES = {
  'welcome': getWelcomeTemplate,
  'passport-issued': getPassportIssuedTemplate,
  'checkin-confirmation': getCheckInConfirmationTemplate,
  'password-reset': getPasswordResetTemplate,
};

// ─── Worker ──────────────────────────────────────────────────
const emailWorker = new Worker(
  'email',
  async (job) => {
    const { to, template, data } = job.data;

    const templateFn = TEMPLATES[template];
    if (!templateFn) {
      throw new Error(`Unknown email template: ${template}`);
    }

    const { subject, html } = templateFn(data);

    await transporter.sendMail({
      from: config.smtp.from,
      to,
      subject,
      html,
    });

    console.info(`[EmailWorker] Sent "${template}" email to ${to}`);
  },
  {
    connection: getRedis(),
    concurrency: 5,
  }
);

emailWorker.on('completed', (job) => {
  console.info(`[EmailWorker] Job ${job.id} completed`);
});

emailWorker.on('failed', (job, err) => {
  console.error(`[EmailWorker] Job ${job?.id} failed:`, err.message);
});

module.exports = { emailWorker };
