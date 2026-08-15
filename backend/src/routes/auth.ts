import { Router } from 'express';
import bcrypt from 'bcryptjs';
import { Role } from '@prisma/client';
import { z } from 'zod';
import { prisma } from '../lib/prisma';
import { asyncHandler, conflict, unauthorized } from '../lib/errors';
import { requireAuth, signToken } from '../middleware/auth';

export const authRouter = Router();

const credentialsSchema = z.object({
  email: z.string().email('Enter a valid email address'),
  password: z.string().min(8, 'Password must be at least 8 characters'),
});

const signupSchema = credentialsSchema.extend({
  name: z.string().min(2, 'Name must be at least 2 characters').max(80),
});

/** Fields safe to return to the client — never includes `passwordHash`. */
const publicUserSelect = {
  id: true,
  email: true,
  name: true,
  role: true,
  theme: true,
  notifyInApp: true,
  notifyEmail: true,
  notifyMinLevel: true,
  createdAt: true,
} as const;

authRouter.post(
  '/signup',
  asyncHandler(async (req, res) => {
    const { email, password, name } = signupSchema.parse(req.body);
    const normalisedEmail = email.toLowerCase().trim();

    const existing = await prisma.user.findUnique({ where: { email: normalisedEmail } });
    if (existing) throw conflict('An account with that email already exists');

    // The very first account to register becomes the admin; everyone after
    // that signs up as a viewer and must be promoted by an existing admin.
    const isFirstUser = (await prisma.user.count()) === 0;

    const user = await prisma.user.create({
      data: {
        email: normalisedEmail,
        name: name.trim(),
        passwordHash: await bcrypt.hash(password, 10),
        role: isFirstUser ? Role.ADMIN : Role.VIEWER,
      },
      select: publicUserSelect,
    });

    const token = signToken({ sub: user.id, email: user.email, role: user.role });
    res.status(201).json({ token, user });
  }),
);

authRouter.post(
  '/login',
  asyncHandler(async (req, res) => {
    const { email, password } = credentialsSchema.parse(req.body);
    const user = await prisma.user.findUnique({ where: { email: email.toLowerCase().trim() } });

    // Compare unconditionally against a dummy hash when the user is missing so
    // that response timing does not reveal which emails are registered.
    const hash = user?.passwordHash ?? '$2a$10$invalidinvalidinvalidinvalidinvalidinvalidinvalidinvalid';
    const valid = await bcrypt.compare(password, hash);

    if (!user || !valid) throw unauthorized('Incorrect email or password');

    const token = signToken({ sub: user.id, email: user.email, role: user.role });
    const { passwordHash: _omit, ...safeUser } = user;
    res.json({ token, user: safeUser });
  }),
);

authRouter.get(
  '/me',
  requireAuth,
  asyncHandler(async (req, res) => {
    const user = await prisma.user.findUnique({
      where: { id: req.user!.sub },
      select: publicUserSelect,
    });
    if (!user) throw unauthorized('Account no longer exists');
    res.json({ user });
  }),
);

const preferencesSchema = z.object({
  name: z.string().min(2).max(80).optional(),
  theme: z.enum(['light', 'dark', 'system']).optional(),
  notifyInApp: z.boolean().optional(),
  notifyEmail: z.boolean().optional(),
  notifyMinLevel: z.enum(['INFO', 'WARNING', 'CRITICAL']).optional(),
});

authRouter.patch(
  '/me',
  requireAuth,
  asyncHandler(async (req, res) => {
    const patch = preferencesSchema.parse(req.body);
    const user = await prisma.user.update({
      where: { id: req.user!.sub },
      data: patch,
      select: publicUserSelect,
    });
    res.json({ user });
  }),
);

const passwordChangeSchema = z.object({
  currentPassword: z.string().min(1, 'Current password is required'),
  newPassword: z.string().min(8, 'New password must be at least 8 characters'),
});

authRouter.post(
  '/change-password',
  requireAuth,
  asyncHandler(async (req, res) => {
    const { currentPassword, newPassword } = passwordChangeSchema.parse(req.body);
    const user = await prisma.user.findUnique({ where: { id: req.user!.sub } });
    if (!user) throw unauthorized();

    if (!(await bcrypt.compare(currentPassword, user.passwordHash))) {
      throw unauthorized('Current password is incorrect');
    }

    await prisma.user.update({
      where: { id: user.id },
      data: { passwordHash: await bcrypt.hash(newPassword, 10) },
    });
    res.json({ ok: true });
  }),
);
