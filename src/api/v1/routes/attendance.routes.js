'use strict';

const { Router } = require('express');
const { validate } = require('../middlewares/validate');
const { authenticate } = require('../middlewares/authenticate');
const { authorize } = require('../middlewares/authorize');
const { checkInSchema, checkOutSchema } = require('../../../application/dtos/attendance.dto');
const { CheckInUseCase } = require('../../../application/use_cases/attendance/checkIn.usecase');
const { CheckOutUseCase } = require('../../../application/use_cases/attendance/checkOut.usecase');
const { AttendanceRepository } = require('../../../infrastructure/db/repositories/attendance.repository');
const { EventRepository } = require('../../../infrastructure/db/repositories/event.repository');
const { UserRepository } = require('../../../infrastructure/db/repositories/user.repository');
const { rejectPendingOrganizer } = require('../middlewares/auth');

const router = Router();

// ─── DI ──────────────────────────────────────────────────────
const attendanceRepository = new AttendanceRepository();
const eventRepository = new EventRepository();
const userRepository = new UserRepository();
const checkInUseCase = new CheckInUseCase({ eventRepository, attendanceRepository });
const checkOutUseCase = new CheckOutUseCase({ attendanceRepository, userRepository });

/**
 * POST /attendance/check-in
 */
router.post('/check-in', authenticate, rejectPendingOrganizer, validate(checkInSchema), async (req, res, next) => {
  try {
    const attendance = await checkInUseCase.execute(req.user.id, req.body);
    res.status(201).json({ success: true, message: 'Checked in successfully', data: attendance });
  } catch (err) {
    next(err);
  }
});

/**
 * POST /attendance/check-out
 */
router.post('/check-out', authenticate, rejectPendingOrganizer, validate(checkOutSchema), async (req, res, next) => {
  try {
    const attendance = await checkOutUseCase.execute(req.user.id, req.body);
    res.status(200).json({ success: true, message: 'Checked out successfully', data: attendance });
  } catch (err) {
    next(err);
  }
});

/**
 * GET /attendance/my  — Current user's attendance history
 */
router.get('/my', authenticate, async (req, res, next) => {
  try {
    const { page = 1, limit = 20 } = req.query;
    const records = await attendanceRepository.findAll({
      userId: req.user.id,
      page: Number(page),
      limit: Number(limit),
    });
    res.status(200).json({ success: true, data: records });
  } catch (err) {
    next(err);
  }
});

/**
 * GET /attendance/all  — All attendance records with user & event info (ORGANIZER / ADMIN)
 */
router.get('/all', authenticate, authorize('ORGANIZER', 'SUPER_ADMIN', 'ADMIN'), async (req, res, next) => {
  try {
    const { page = 1, limit = 50, eventId } = req.query;
    const db = attendanceRepository.db;

    const records = await db.attendance.findMany({
      where: {
        ...(eventId && { eventId }),
      },
      skip: (Number(page) - 1) * Number(limit),
      take: Number(limit),
      orderBy: { checkInTime: 'desc' },
      include: {
        user: {
          select: { id: true, firstName: true, lastName: true, email: true, role: true },
        },
        event: {
          select: { id: true, title: true, address: true, startTime: true },
        },
      },
    });

    res.status(200).json({ success: true, data: records });
  } catch (err) {
    next(err);
  }
});

/**
 * GET /attendance/event/:eventId  — Event attendance (ORGANIZER/ADMIN)
 */
router.get('/event/:eventId', authenticate, authorize('ORGANIZER', 'SUPER_ADMIN', 'ADMIN'), async (req, res, next) => {
  try {
    const db = attendanceRepository.db;
    const records = await db.attendance.findMany({
      where: { eventId: req.params.eventId },
      orderBy: { checkInTime: 'desc' },
      include: {
        user: {
          select: { id: true, firstName: true, lastName: true, email: true },
        },
      },
    });
    res.status(200).json({ success: true, data: records });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
