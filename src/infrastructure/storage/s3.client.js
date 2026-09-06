'use strict';

const fs = require('node:fs/promises');
const fsSync = require('node:fs');
const path = require('node:path');
const config = require('../../core/config');

// Ensure root uploads directory exists at startup
const UPLOADS_DIR = path.resolve(__dirname, '../../uploads');
if (!fsSync.existsSync(UPLOADS_DIR)) {
  fsSync.mkdirSync(UPLOADS_DIR, { recursive: true });
}

/**
 * Upload a buffer to local disk.
 *
 * @param {{ key: string, body: Buffer, contentType: string }} params
 * @returns {Promise<string>} Static local URL
 */
async function uploadFile({ key, body }) {
  const filePath = path.join(UPLOADS_DIR, key);
  const fileDir = path.dirname(filePath);

  // Ensure target subdirectory (e.g. uploads/passports/userId/) exists
  await fs.mkdir(fileDir, { recursive: true });

  // Write file to disk
  await fs.writeFile(filePath, body);

  // Return static relative path URL (accessible via http://localhost:3000/uploads/...)
  const baseUrl = `http://localhost:${config.port}`;
  return `${baseUrl}/uploads/${key.replace(/\\/g, '/')}`;
}

/**
 * Get static URL for local development (no signing needed).
 *
 * @param {string} key
 * @returns {Promise<string>}
 */
async function getPresignedUrl(key) {
  const baseUrl = `http://localhost:${config.port}`;
  return `${baseUrl}/uploads/${key.replace(/\\/g, '/')}`;
}

/**
 * Delete a file from local disk.
 *
 * @param {string} key
 */
async function deleteFile(key) {
  try {
    const filePath = path.join(UPLOADS_DIR, key);
    await fs.unlink(filePath);
  } catch (err) {
    if (err.code !== 'ENOENT') {
      console.error(`[LocalStorage] Failed to delete file ${key}:`, err.message);
    }
  }
}

module.exports = { uploadFile, getPresignedUrl, deleteFile };
