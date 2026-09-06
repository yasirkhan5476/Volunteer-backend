'use strict';

const { Worker } = require('bullmq');
const PDFDocument = require('pdfkit');
const { getRedis } = require('../../core/redis');
const { uploadFile } = require('../storage/s3.client');
const { getDatabase } = require('../../core/database');

/**
 * PDF Worker
 *
 * Generates a signed volunteer passport PDF and uploads it to S3.
 * Updates the passport record with the PDF URL.
 */
const pdfWorker = new Worker(
  'pdf',
  async (job) => {
    const { passportId, userId, fullName, totalHours, issuedAt, expiresAt } = job.data;

    console.info(`[PdfWorker] Generating passport PDF for user ${userId}`);

    // ─── Generate PDF buffer ─────────────────────────────────
    const pdfBuffer = await generatePassportPdf({
      passportId,
      fullName,
      totalHours,
      issuedAt,
      expiresAt,
    });

    // ─── Upload to S3 ────────────────────────────────────────
    const key = `passports/${userId}/${passportId}.pdf`;
    const pdfUrl = await uploadFile({
      key,
      body: pdfBuffer,
      contentType: 'application/pdf',
    });

    // ─── Update passport record ──────────────────────────────
    const db = getDatabase();
    await db.passport.update({
      where: { id: passportId },
      data: { pdfUrl },
    });

    console.info(`[PdfWorker] Passport PDF uploaded: ${pdfUrl}`);
    return { pdfUrl };
  },
  {
    connection: getRedis(),
    concurrency: 2,
  }
);

/**
 * Generate a volunteer passport PDF.
 * @returns {Promise<Buffer>}
 */
function generatePassportPdf({ passportId, fullName, totalHours, issuedAt, expiresAt }) {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ size: 'A4', margin: 60 });
    const buffers = [];

    doc.on('data', (chunk) => buffers.push(chunk));
    doc.on('end', () => resolve(Buffer.concat(buffers)));
    doc.on('error', reject);

    // ─── Header ───────────────────────────────────────────────
    doc
      .fontSize(28)
      .font('Helvetica-Bold')
      .fillColor('#1a5276')
      .text('VOLUNTEER PASSPORT', { align: 'center' });

    doc.moveDown(0.5);
    doc
      .fontSize(14)
      .font('Helvetica')
      .fillColor('#555')
      .text('Volunteer Platform Pakistan', { align: 'center' });

    doc.moveDown(2);
    doc.moveTo(60, doc.y).lineTo(535, doc.y).stroke('#1a5276');
    doc.moveDown(1);

    // ─── Details ─────────────────────────────────────────────
    const addField = (label, value) => {
      doc
        .fontSize(12)
        .font('Helvetica-Bold')
        .fillColor('#333')
        .text(`${label}:`, { continued: true })
        .font('Helvetica')
        .fillColor('#000')
        .text(` ${value}`);
      doc.moveDown(0.5);
    };

    addField('Name', fullName);
    addField('Total Hours Volunteered', `${totalHours} hours`);
    addField('Issued On', new Date(issuedAt).toLocaleDateString('en-PK'));
    addField('Valid Until', new Date(expiresAt).toLocaleDateString('en-PK'));
    addField('Passport ID', passportId);

    doc.moveDown(2);
    doc.moveTo(60, doc.y).lineTo(535, doc.y).stroke('#1a5276');
    doc.moveDown(1);

    // ─── Footer ───────────────────────────────────────────────
    doc
      .fontSize(10)
      .fillColor('#888')
      .text(
        'This certificate is digitally signed and verifiable at volunteerplatform.pk/verify',
        { align: 'center' }
      );

    doc.end();
  });
}

pdfWorker.on('completed', (job) => {
  console.info(`[PdfWorker] Job ${job.id} completed`);
});

pdfWorker.on('failed', (job, err) => {
  console.error(`[PdfWorker] Job ${job?.id} failed:`, err.message);
});

module.exports = { pdfWorker };
