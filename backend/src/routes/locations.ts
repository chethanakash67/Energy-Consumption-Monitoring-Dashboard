import { Router } from 'express';
import { Role } from '@prisma/client';
import { z } from 'zod';
import { prisma } from '../lib/prisma';
import { asyncHandler, badRequest, notFound } from '../lib/errors';
import { requireAuth, requireRole } from '../middleware/auth';

export const locationsRouter = Router();
locationsRouter.use(requireAuth);

const locationSchema = z.object({
  name: z.string().min(2, 'Name must be at least 2 characters').max(80),
  address: z.string().max(200).nullable().optional(),
  timezone: z.string().max(60).optional(),
});

locationsRouter.get(
  '/',
  asyncHandler(async (_req, res) => {
    const locations = await prisma.location.findMany({
      orderBy: { name: 'asc' },
      include: { _count: { select: { devices: true } } },
    });

    res.json({
      locations: locations.map(({ _count, ...location }) => ({
        ...location,
        deviceCount: _count.devices,
      })),
    });
  }),
);

locationsRouter.post(
  '/',
  requireRole(Role.ADMIN),
  asyncHandler(async (req, res) => {
    const data = locationSchema.parse(req.body);
    const location = await prisma.location.create({ data });
    res.status(201).json({ location: { ...location, deviceCount: 0 } });
  }),
);

locationsRouter.patch(
  '/:id',
  requireRole(Role.ADMIN),
  asyncHandler(async (req, res) => {
    const data = locationSchema.partial().parse(req.body);
    const location = await prisma.location.update({ where: { id: req.params.id }, data });
    res.json({ location });
  }),
);

locationsRouter.delete(
  '/:id',
  requireRole(Role.ADMIN),
  asyncHandler(async (req, res) => {
    const location = await prisma.location.findUnique({
      where: { id: req.params.id },
      include: { _count: { select: { devices: true } } },
    });
    if (!location) throw notFound('Location not found');

    // Deleting a location cascades to its devices and their entire reading
    // history, so require the caller to empty it first.
    if (location._count.devices > 0) {
      throw badRequest(
        `Move or delete this location's ${location._count.devices} device(s) before removing it`,
      );
    }

    await prisma.location.delete({ where: { id: location.id } });
    res.status(204).end();
  }),
);
