'use strict';

const { Router } = require('express');
const { z } = require('zod');
const { getDatabase } = require('../../../core/database');
const { NotFoundError, ValidationError } = require('../../../core/exceptions');
const { authenticateToken, requireSuperAdmin } = require('../middlewares/auth');

const router = Router();
const db = getDatabase();
const statusSchema = z.object({ status: z.enum(['APPROVED', 'REJECTED']) });

router.use(authenticateToken, requireSuperAdmin);

router.get('/analytics', async (_req, res, next) => {
  try {
    const [usersByRole, activeUsers, events, activeEvents, donations, completedDonations, attendance, recentLogins] = await Promise.all([
      db.user.groupBy({ by: ['role'], _count: { role: true } }),
      db.user.count({ where: { isActive: true } }),
      db.event.count(),
      db.event.count({ where: { isActive: true } }),
      db.donation.count(),
      db.donation.aggregate({ where: { status: 'COMPLETED' }, _count: { id: true }, _sum: { amount: true } }),
      db.attendance.count(),
      db.user.count({ where: { lastLoginAt: { gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000) } } }),
    ]);

    const counts = Object.fromEntries(usersByRole.map((row) => [row.role, row._count.role]));
    res.json({
      success: true,
      data: {
        users: {
          total: Object.values(counts).reduce((sum, count) => sum + count, 0),
          active: activeUsers,
          volunteers: counts.VOLUNTEER || 0,
          pendingOrganizers: counts.ORGANIZER_PENDING || 0,
          organizers: counts.ORGANIZER || 0,
          superAdmins: counts.SUPER_ADMIN || 0,
          recentLogins,
        },
        events: { total: events, active: activeEvents },
        attendance: { total: attendance },
        donations: {
          total: donations,
          completed: completedDonations._count.id,
          received: completedDonations._sum.amount || 0,
        },
      },
    });
  } catch (error) {
    next(error);
  }
});

router.get('/approvals', async (_req, res, next) => {
  try {
    const users = await db.user.findMany({
      where: { role: 'ORGANIZER_PENDING' },
      select: {
        id: true,
        email: true,
        firstName: true,
        lastName: true,
        phone: true,
        isVerified: true,
        createdAt: true,
      },
      orderBy: { createdAt: 'asc' },
    });

    res.json({ success: true, data: users });
  } catch (error) {
    next(error);
  }
});

router.patch('/organizers/:id/status', async (req, res, next) => {
  try {
    const parsed = statusSchema.safeParse(req.body);
    if (!parsed.success) {
      throw new ValidationError('Status must be APPROVED or REJECTED', parsed.error.issues);
    }

    const pending = await db.user.findFirst({
      where: { id: req.params.id, role: 'ORGANIZER_PENDING' },
      select: { id: true, email: true, role: true },
    });
    if (!pending) throw new NotFoundError('Pending organizer application');

    const nextRole = parsed.data.status === 'APPROVED' ? 'ORGANIZER' : 'VOLUNTEER';
    const updated = await db.$transaction(async (transaction) => {
      const user = await transaction.user.update({
        where: { id: pending.id },
        data: { role: nextRole, isVerified: nextRole === 'ORGANIZER' },
        select: { id: true, email: true, firstName: true, lastName: true, role: true, isVerified: true },
      });

      await transaction.auditLog.create({
        data: {
          actorId: req.user.id,
          action: `ORGANIZER_${parsed.data.status}`,
          target: pending.id,
        },
      });
      return user;
    });

    res.json({ success: true, data: updated });
  } catch (error) {
    next(error);
  }
});

module.exports = router;