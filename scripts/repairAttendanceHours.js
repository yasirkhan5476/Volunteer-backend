'use strict';

require('dotenv').config();
const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

function correctedHours(record) {
  if (!record.checkOutTime || !record.event?.endTime) return record.hoursLogged || 0;

  const effectiveCheckOut = new Date(
    Math.min(new Date(record.checkOutTime).getTime(), new Date(record.event.endTime).getTime()),
  );
  const hours = (effectiveCheckOut - new Date(record.checkInTime)) / 1000 / 3600;
  return Math.max(0, Math.round(hours * 100) / 100);
}

async function main() {
  const records = await prisma.attendance.findMany({
    where: { status: { in: ['CHECKED_OUT', 'AUTO_CLOSED'] } },
    include: { event: { select: { endTime: true } } },
  });

  const totals = new Map();
  let repaired = 0;

  for (const record of records) {
    const hoursLogged = correctedHours(record);
    totals.set(record.userId, (totals.get(record.userId) || 0) + hoursLogged);

    if (Number(record.hoursLogged || 0) !== hoursLogged) {
      const effectiveCheckOut = record.event?.endTime && record.checkOutTime
        ? new Date(Math.min(new Date(record.checkOutTime).getTime(), new Date(record.event.endTime).getTime()))
        : record.checkOutTime;

      await prisma.attendance.update({
        where: { id: record.id },
        data: { hoursLogged, checkOutTime: effectiveCheckOut },
      });
      repaired++;
    }
  }

  const profiles = await prisma.volunteerProfile.findMany({ select: { userId: true } });
  for (const profile of profiles) {
    await prisma.volunteerProfile.update({
      where: { userId: profile.userId },
      data: { totalHours: Math.round((totals.get(profile.userId) || 0) * 100) / 100 },
    });
  }

  console.info(`Repaired ${repaired} attendance record(s) and rebuilt ${profiles.length} volunteer total(s).`);
}

main()
  .catch((error) => {
    console.error(error.message);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
