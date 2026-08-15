import { Router } from 'express';
import { Role } from '@prisma/client';
import { z } from 'zod';
import { asyncHandler } from '../lib/errors';
import { requireAuth, requireRole } from '../middleware/auth';
import { getSettings, updateSettings } from '../services/settings';

export const settingsRouter = Router();
settingsRouter.use(requireAuth);

settingsRouter.get(
  '/',
  asyncHandler(async (_req, res) => {
    res.json({ settings: await getSettings() });
  }),
);

const patchSchema = z.object({
  tariffPerKwh: z.number().min(0).max(100).optional(),
  carbonKgPerKwh: z.number().min(0).max(10).optional(),
  currency: z.string().length(3, 'Use a 3-letter ISO currency code').optional(),
});

settingsRouter.patch(
  '/',
  requireRole(Role.ADMIN),
  asyncHandler(async (req, res) => {
    const patch = patchSchema.parse(req.body);

    // The Setting table stores strings; normalise before writing.
    const asStrings = Object.fromEntries(
      Object.entries(patch).map(([key, value]) => [
        key,
        typeof value === 'string' ? value.toUpperCase() : String(value),
      ]),
    );

    res.json({ settings: await updateSettings(asStrings) });
  }),
);
