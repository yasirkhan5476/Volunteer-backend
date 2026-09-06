'use strict';

const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcryptjs');

const prisma = new PrismaClient();

async function main() {
  console.info('🌱  Seeding database...');

  // ─── Admin User ─────────────────────────────────────────────
  const adminPassword = await bcrypt.hash('Admin@12345', 12);
  const admin = await prisma.user.upsert({
    where: { email: 'admin@volunteerplatform.pk' },
    update: { role: 'SUPER_ADMIN', isVerified: true, isActive: true },
    create: {
      email: 'admin@volunteerplatform.pk',
      passwordHash: adminPassword,
      firstName: 'Super',
      lastName: 'Admin',
      role: 'SUPER_ADMIN',
      isVerified: true,
    },
  });
  console.info(`  ✅ Admin created: ${admin.email}`);

  // ─── Organizer User ─────────────────────────────────────────
  const orgPassword = await bcrypt.hash('Organizer@12345', 12);
  const organizer = await prisma.user.upsert({
    where: { email: 'organizer@volunteerplatform.pk' },
    update: {},
    create: {
      email: 'organizer@volunteerplatform.pk',
      passwordHash: orgPassword,
      firstName: 'Event',
      lastName: 'Organizer',
      role: 'ORGANIZER',
      isVerified: true,
    },
  });
  console.info(`  ✅ Organizer created: ${organizer.email}`);

  // ─── Sample Organization ─────────────────────────────────────
  const org = await prisma.organization.upsert({
    where: { id: 'seed-org-001' },
    update: {},
    create: {
      id: 'seed-org-001',
      name: 'Green Pakistan Initiative',
      description: 'A volunteer organization dedicated to environmental conservation.',
      ownerId: organizer.id,
    },
  });
  console.info(`  ✅ Organization created: ${org.name}`);

  // ─── Sample Volunteer ────────────────────────────────────────
  const volPassword = await bcrypt.hash('Volunteer@12345', 12);
  const volunteer = await prisma.user.upsert({
    where: { email: 'volunteer@volunteerplatform.pk' },
    update: {},
    create: {
      email: 'volunteer@volunteerplatform.pk',
      passwordHash: volPassword,
      firstName: 'Ali',
      lastName: 'Hassan',
      role: 'VOLUNTEER',
      isVerified: true,
      volunteerProfile: {
        create: {
          bio: 'Passionate about community service.',
          skills: ['Teaching', 'Tree Planting', 'First Aid'],
          totalHours: 0,
        },
      },
    },
  });
  console.info(`  ✅ Volunteer created: ${volunteer.email}`);

  // ─── Sample Event ────────────────────────────────────────────
  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  const dayAfter = new Date(tomorrow);
  dayAfter.setHours(dayAfter.getHours() + 4);

  await prisma.event.upsert({
    where: { id: 'seed-event-001' },
    update: {},
    create: {
      id: 'seed-event-001',
      title: 'Tree Plantation Drive - Lahore',
      description: 'Join us to plant 500 trees in Model Town Park.',
      organizationId: org.id,
      createdById: organizer.id,
      latitude: 31.5204,
      longitude: 74.3587,
      radiusMeters: 200,
      address: 'Model Town Park, Lahore',
      startTime: tomorrow,
      endTime: dayAfter,
      maxVolunteers: 50,
    },
  });
  console.info('  ✅ Sample event created.');

  console.info('\n🎉  Seeding complete!');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
