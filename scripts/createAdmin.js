'use strict';

require('dotenv').config();
const bcrypt = require('bcryptjs');
const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

async function main() {
  const [email, password, firstName = 'Super', lastName = 'Admin'] = process.argv.slice(2);
  if (!email || !password) {
    throw new Error('Usage: npm run create-admin -- email password [firstName] [lastName]');
  }

  const passwordHash = await bcrypt.hash(password, 12);
  const admin = await prisma.user.upsert({
    where: { email: email.toLowerCase() },
    update: { passwordHash, firstName, lastName, role: 'SUPER_ADMIN', isVerified: true, isActive: true },
    create: { email: email.toLowerCase(), passwordHash, firstName, lastName, role: 'SUPER_ADMIN', isVerified: true },
    select: { id: true, email: true, role: true },
  });

  console.info(`Super admin ready: ${admin.email} (${admin.role})`);
}

main()
  .catch((error) => {
    console.error(error.message);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());