/**
 * Prisma seed — local development bootstrap.
 *
 * Creates a single demo user + workspace so the dev environment is
 * immediately interactive after `pnpm db:migrate`. Idempotent — re-running
 * the seed updates existing rows rather than failing.
 *
 * NEVER run this against staging or production. The seed entrypoint refuses
 * to run when NODE_ENV === 'production' as a guard rail.
 */
import * as argon2 from 'argon2';

import { PrismaClient, WorkspaceRole } from '@prisma/client';

const prisma = new PrismaClient();

const DEMO_EMAIL = 'demo@agile-ish.local';
const DEMO_PASSWORD = 'AgileIshDemo!2026';

async function main(): Promise<void> {
  if (process.env.NODE_ENV === 'production') {
    throw new Error('Refusing to seed against a production database.');
  }

  console.log('▶ Seeding local development data...');

  const passwordHash = await argon2.hash(DEMO_PASSWORD, {
    type: argon2.argon2id,
    memoryCost: 19456,
    timeCost: 2,
    parallelism: 1,
  });

  const user = await prisma.user.upsert({
    where: { email: DEMO_EMAIL },
    create: {
      email: DEMO_EMAIL,
      passwordHash,
      displayName: 'Demo User',
      emailVerifiedAt: new Date(),
      timezone: 'UTC',
      locale: 'en',
    },
    update: { passwordHash },
  });

  const workspace = await prisma.workspace.upsert({
    where: { slug: 'demo' },
    create: {
      slug: 'demo',
      name: 'Demo Workspace',
      description: 'Auto-created by the dev seed script.',
      ownerId: user.id,
    },
    update: {},
  });

  await prisma.workspaceMember.upsert({
    where: { userId_workspaceId: { userId: user.id, workspaceId: workspace.id } },
    create: { userId: user.id, workspaceId: workspace.id, role: WorkspaceRole.OWNER },
    update: { role: WorkspaceRole.OWNER },
  });

  await prisma.user.update({
    where: { id: user.id },
    data: { defaultWorkspaceId: workspace.id },
  });

  console.log(`✔ Seed complete. Login: ${DEMO_EMAIL} / ${DEMO_PASSWORD}`);
}

main()
  .catch((err: unknown) => {
    console.error('Seed failed:', err);
    process.exit(1);
  })
  .finally(() => {
    void prisma.$disconnect();
  });
