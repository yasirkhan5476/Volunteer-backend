'use strict';

const { Router } = require('express');
const { validate } = require('../middlewares/validate');
const { authenticate } = require('../middlewares/authenticate');
const { authorize } = require('../middlewares/authorize');
const { createEventSchema, updateEventSchema, listEventsSchema } = require('../../../application/dtos/event.dto');
const { EventRepository } = require('../../../infrastructure/db/repositories/event.repository');
const { UserRepository } = require('../../../infrastructure/db/repositories/user.repository');
const { NotFoundError, ForbiddenError } = require('../../../core/exceptions');
const { requireVerifiedOrganizer } = require('../middlewares/auth');

const router = Router();
const eventRepository = new EventRepository();
const userRepository = new UserRepository();

/**
 * GET /events  — List events (public)
 */
router.get('/', validate(listEventsSchema), async (req, res, next) => {
  try {
    const result = await eventRepository.findAll(req.query);
    res.status(200).json({ success: true, data: result });
  } catch (err) {
    next(err);
  }
});

/**
 * GET /events/:id  — Get single event (public)
 */
router.get('/:id', async (req, res, next) => {
  try {
    const event = await eventRepository.findById(req.params.id);
    if (!event) throw new NotFoundError('Event');
    res.status(200).json({ success: true, data: event });
  } catch (err) {
    next(err);
  }
});
/**
 * POST /events  — Create event (ORGANIZER, ADMIN)
 */
router.post(
  '/',
  authenticate,
  authorize('ORGANIZER', 'SUPER_ADMIN', 'ADMIN'),
  requireVerifiedOrganizer,
  validate(createEventSchema),
  async (req, res, next) => {
    try {
      const db = eventRepository.db;
      let organizationId = req.body.organizationId;

      // Organizers may only publish into an organization they own. If an approved
      // organizer has no organization yet, create a default one for them.
      if (!['ADMIN', 'SUPER_ADMIN'].includes(req.user.role)) {
        let organization = await db.organization.findFirst({
          where: { ownerId: req.user.id, isActive: true },
          orderBy: { createdAt: 'asc' },
        });

        if (!organization) {
          const owner = await db.user.findUnique({
            where: { id: req.user.id },
            select: { firstName: true, lastName: true },
          });
          organization = await db.organization.create({
            data: {
              name: `${owner?.firstName || 'Organizer'} ${owner?.lastName || ''}`.trim(),
              description: 'Organizer profile created by the Volunteer Platform',
              ownerId: req.user.id,
            },
          });
        }

        organizationId = organization.id;
      } else {
        const organization = await db.organization.findUnique({ where: { id: organizationId } });
        if (!organization) throw new NotFoundError('Organization');
      }

      const event = await eventRepository.create({
        ...req.body,
        organizationId,
        createdById: req.user.id,
        startTime: new Date(req.body.startTime),
        endTime: new Date(req.body.endTime),
      });
      res.status(201).json({ success: true, data: event });
    } catch (err) {
      next(err);
    }
  }
);

/**
 * PATCH /events/:id  — Update event (creator or ADMIN)
 */
router.patch(
  '/:id',
  authenticate,
  authorize('ORGANIZER', 'SUPER_ADMIN', 'ADMIN'),
  requireVerifiedOrganizer,
  validate(updateEventSchema),
  async (req, res, next) => {
    try {
      const event = await eventRepository.findById(req.params.id);
      if (!event) throw new NotFoundError('Event');
      if (event.createdById !== req.user.id && !['ADMIN', 'SUPER_ADMIN'].includes(req.user.role)) {
        throw new ForbiddenError();
      }
      const updated = await eventRepository.update(req.params.id, req.body);
      res.status(200).json({ success: true, data: updated });
    } catch (err) {
      next(err);
    }
  }
);

/**
 * DELETE /events/:id  — Soft-delete (ADMIN only)
 */
router.delete('/:id', authenticate, authorize('SUPER_ADMIN', 'ADMIN'), async (req, res, next) => {
  try {
    await eventRepository.update(req.params.id, { isActive: false });
    res.status(200).json({ success: true, message: 'Event deactivated' });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
