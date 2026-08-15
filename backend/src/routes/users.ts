import { Router } from 'express';
import bcrypt from 'bcryptjs';
import { Role } from '@prisma/client';
import { z } from 'zod';
import { prisma } from '../lib/prisma';
import { asyncHandler, badRequest, conflict } from '../lib/errors';
import { requireAuth, requireRole } from '../middleware/auth';

/** Every route here is admin-only — user management is a privileged surface. */
export const usersRouter = Router();
usersRouter.use(requireAuth, requireRole(Role.ADMIN));

const publicUserSelect = {
  id: true,
  email: true,
  name: true,
  role: true,
  createdAt: true,
} as const;

usersRouter.get(
  '/',
  asyncHandler(async (_req, res) => {
    const users = await prisma.user.findMany({
      select: publicUserSelect,
      orderBy: { createdAt: 'asc' },
    });
    res.json({ users });
  }),
);

const createUserSchema = z.object({
  email: z.string().email(),
  name: z.string().min(2).max(80),
  password: z.string().min(8, 'Password must be at least 8 characters'),
  role: z.nativeEnum(Role).default(Role.VIEWER),
});

usersRouter.post(
  '/',
  asyncHandler(async (req, res) => {
    const data = createUserSchema.parse(req.body);
    const email = data.email.toLowerCase().trim();

    if (await prisma.user.findUnique({ where: { email } })) {
      throw conflict('An account with that email already exists');
    }

    const user = await prisma.user.create({
      data: {
        email,
        name: data.name.trim(),
        role: data.role,
        passwordHash: await bcrypt.hash(data.password, 10),
      },
      select: publicUserSelect,
    });
    res.status(201).json({ user });
  }),
);

usersRouter.patch(
  '/:id',
  asyncHandler(async (req, res) => {
    const data = z
      .object({ name: z.string().min(2).max(80).optional(), role: z.nativeEnum(Role).optional() })
      .parse(req.body);

    // Guard against an admin demoting themselves out of the last admin seat,
    // which would leave the instance with no way to manage users.
    if (data.role === Role.VIEWER) {
      await assertNotLastAdmin(req.params.id);
    }

    const user = await prisma.user.update({
      where: { id: req.params.id },
      data,
      select: publicUserSelect,
    });
    res.json({ user });
  }),
);

usersRouter.delete(
  '/:id',
  asyncHandler(async (req, res) => {
    if (req.params.id === req.user!.sub) {
      throw badRequest('You cannot delete your own account');
    }
    await assertNotLastAdmin(req.params.id);
    await prisma.user.delete({ where: { id: req.params.id } });
    res.status(204).end();
  }),
);

async function assertNotLastAdmin(userId: string) {
  const target = await prisma.user.findUnique({ where: { id: userId } });
  if (target?.role !== Role.ADMIN) return;

  const adminCount = await prisma.user.count({ where: { role: Role.ADMIN } });
  if (adminCount <= 1) {
    throw badRequest('This is the only administrator account — promote another user first');
  }
}
