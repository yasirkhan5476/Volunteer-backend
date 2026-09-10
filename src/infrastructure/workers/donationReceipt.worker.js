'use strict';

const { Worker } = require('bullmq');
const PDFDocument = require('pdfkit');
const nodemailer = require('nodemailer');
const { getRedis } = require('../../core/redis');
const { getDatabase } = require('../../core/database');
const config = require('../../core/config');

const transporter = nodemailer.createTransport({
  host: config.smtp.host,
  port: config.smtp.port,
  secure: config.smtp.secure,
  auth: { user: config.smtp.user, pass: config.smtp.pass },
});

function createReceiptPdf(donation) {
  return new Promise((resolve, reject) => {
    const document = new PDFDocument({ size: 'A4', margin: 60 });
    const chunks = [];
    document.on('data', (chunk) => chunks.push(chunk));
    document.on('end', () => resolve(Buffer.concat(chunks)));
    document.on('error', reject);
    document.fontSize(24).text('Donation receipt', { align: 'center' });
    document.moveDown();
    document.fontSize(12).text(`Receipt ID: ${donation.id}`);
    document.text(`Amount: ${donation.currency} ${donation.amount}`);
    document.text(
      `Payment reference: ${donation.safepayPaymentId || donation.gatewayRef || 'N/A'}`
    );
    document.text(`Completed: ${donation.updatedAt.toISOString()}`);
    document.text(`Campaign: ${donation.event.title}`);
    document.end();
  });
}

const donationReceiptWorker = new Worker(
  'donation-receipt',
  async (job) => {
    const donation = await getDatabase().donation.findUnique({
      where: { id: job.data.donationId },
      include: { user: true, event: true },
    });
    if (!donation || donation.status !== 'COMPLETED') return;

    const pdf = await createReceiptPdf(donation);
    await transporter.sendMail({
      from: config.smtp.from,
      to: donation.user.email,
      subject: 'Your donation receipt',
      text: 'Thank you for your donation. Your receipt is attached.',
      attachments: [{ filename: `donation-${donation.id}.pdf`, content: pdf }],
    });
  },
  { connection: getRedis(), concurrency: 2 }
);

donationReceiptWorker.on('failed', (job, error) => {
  console.error(`[DonationReceiptWorker] Job ${job?.id} failed:`, error.message);
});

module.exports = { donationReceiptWorker };
