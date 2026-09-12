'use strict';

const { Router } = require('express');
const multer = require('multer');
const { del, put } = require('@vercel/blob');
const config = require('../../../core/config');
const { authenticate } = require('../middlewares/authenticate');
const { UserRepository } = require('../../../infrastructure/db/repositories/user.repository');

const router = Router();
const userRepository = new UserRepository();
const MAX_FILE_SIZE = 1 * 1024 * 1024;
const ALLOWED_MIME_TYPES = new Set(['image/png', 'image/jpeg', 'image/jpg']);
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: MAX_FILE_SIZE },
  fileFilter: (_req, file, callback) => {
    if (!ALLOWED_MIME_TYPES.has(file.mimetype)) {
      const error = new Error('Only PNG, JPG, and JPEG images are allowed.');
      error.code = 'INVALID_FILE_TYPE';
      return callback(error);
    }
    callback(null, true);
  },
});

const handleProfileImageUpload = (req, res, next) => {
  upload.single('profile_image')(req, res, (error) => {
    if (!error) return next();

    if (error instanceof multer.MulterError && error.code === 'LIMIT_FILE_SIZE') {
      return res.status(400).json({ error: 'File size exceeds the 1 MB limit.' });
    }

    if (error.code === 'INVALID_FILE_TYPE') {
      return res.status(400).json({ error: 'Only PNG, JPG, and JPEG images are allowed.' });
    }

    return res.status(400).json({ error: error.message || 'Invalid profile image upload.' });
  });
};

const isVercelBlobUrl = (value) =>
  typeof value === 'string' && value.includes('.public.blob.vercel-storage.com');

const getExtension = (mimeType) => {
  if (mimeType === 'image/png') return 'png';
  return 'jpg';
};

router.post('/profile-image', authenticate, handleProfileImageUpload, async (req, res, next) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'A profile image is required.' });
    }

    if (!config.blob.readWriteToken) {
      return res.status(500).json({
        success: false,
        code: 'PROFILE_IMAGE_STORAGE_NOT_CONFIGURED',
        error: 'Profile image storage is not configured on the deployed backend.',
      });
    }

    const profile = await userRepository.findByIdWithProfile(req.user.id);
    if (!profile) {
      return res.status(404).json({ error: 'User not found.' });
    }

    const existingImageUrl = profile.volunteerProfile?.avatarUrl;
    if (isVercelBlobUrl(existingImageUrl)) {
      await del(existingImageUrl, { token: config.blob.readWriteToken });
    }

    const extension = getExtension(req.file.mimetype);
    const blob = await put(
      `avatars/user_${req.user.id}_${Date.now()}.${extension}`,
      req.file.buffer,
      {
        access: 'public',
        contentType: req.file.mimetype,
        token: config.blob.readWriteToken,
      }
    );

    await userRepository.upsertVolunteerProfile(req.user.id, { avatarUrl: blob.url });

    return res.status(200).json({
      success: true,
      profile_image_url: blob.url,
    });
  } catch (error) {
    return next(error);
  }
});

module.exports = router;
