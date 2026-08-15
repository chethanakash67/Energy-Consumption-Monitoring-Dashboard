import { Router } from 'express';
import { AlertType, Prisma, Role, Severity } from '@prisma/client';
import { z } from 'zod';
import { prisma } from '../lib/prisma';
import { asyncHandler } from '../lib/errors';
import { requireAuth, requireRole } from '../middleware/auth';
import { getRealtimeLocationId } from '../services/realtimeIngest';
import { wantsRealtimeScope } from '../lib/realtimeScope';

export const alertsRouter = Router();
alertsRouter.use(requireAuth);

const listQuerySchema = z.object({
  status: z.enum(['open', 'acknowledged', 'all']).catch('all'),
  severity: z.nativeEnum(Severity).optional(),
  type: z.nativeEnum(AlertType).optional(),
  deviceId: z.string().optional(),
  limit: z.coerce.number().int().min(1).max(200).catch(50),
  cursor: z.string().optional(),
});

alertsRouter.get(
  '/',
  asyncHandler(async (req, res) => {
    const query = listQuerySchema.parse(req.query);
    const scopedLocationId = wantsRealtimeScope(req) ? await getRealtimeLocationId() : null;

    const where: Prisma.AlertWhereInput = {
      ...(query.status === 'open' ? { acknowledged: false } : {}),
      ...(query.status === 'acknowledged' ? { acknowledged: true } : {}),
      ...(query.severity ? { severity: query.severity } : {}),
      ...(query.type ? { type: query.type } : {}),
      ...(query.deviceId ? { deviceId: query.deviceId } : {}),
      ...(scopedLocationId ? { device: { locationId: scopedLocationId } } : {}),
    };

    const alerts = await prisma.alert.findMany({
      where,
      include: {
        device: { include: { location: true } },
        acknowledgedBy: { select: { id: true, name: true } },
      },
      orderBy: { timestamp: 'desc' },
      take: query.limit + 1, // one extra row tells us whether more exist
      ...(query.cursor ? { skip: 1, cursor: { id: query.cursor } } : {}),
    });

    const hasMore = alerts.length > query.limit;
    const page = hasMore ? alerts.slice(0, query.limit) : alerts;

    const counts = await prisma.alert.groupBy({
      by: ['severity'],
      where: {
        acknowledged: false,
        ...(scopedLocationId ? { device: { locationId: scopedLocationId } } : {}),
      },
      _count: { _all: true },
    });

    res.json({
      alerts: page,
      nextCursor: hasMore ? page[page.length - 1].id : null,
      openCounts: {
        total: counts.reduce((sum, group) => sum + group._count._all, 0),
        critical: counts.find((c) => c.severity === Severity.CRITICAL)?._count._all ?? 0,
        warning: counts.find((c) => c.severity === Severity.WARNING)?._count._all ?? 0,
        info: counts.find((c) => c.severity === Severity.INFO)?._count._all ?? 0,
      },
    });
  }),
);

alertsRouter.post(
  '/:id/acknowledge',
  asyncHandler(async (req, res) => {
    const alert = await prisma.alert.update({
      where: { id: req.params.id },
      data: {
        acknowledged: true,
        acknowledgedAt: new Date(),
        acknowledgedById: req.user!.sub,
      },
      include: {
        device: { include: { location: true } },
        acknowledgedBy: { select: { id: true, name: true } },
      },
    });
    res.json({ alert });
  }),
);

/** Bulk-acknowledge everything currently open — the "clear the board" action. */
alertsRouter.post(
  '/acknowledge-all',
  asyncHandler(async (req, res) => {
    const scopedLocationId = wantsRealtimeScope(req) ? await getRealtimeLocationId() : null;
    const result = await prisma.alert.updateMany({
      where: {
        acknowledged: false,
        ...(scopedLocationId ? { device: { locationId: scopedLocationId } } : {}),
      },
      data: {
        acknowledged: true,
        acknowledgedAt: new Date(),
        acknowledgedById: req.user!.sub,
      },
    });
    res.json({ acknowledged: result.count });
  }),
);

alertsRouter.delete(
  '/:id',
  requireRole(Role.ADMIN),
  asyncHandler(async (req, res) => {
    await prisma.alert.delete({ where: { id: req.params.id } });
    res.status(204).end();
  }),
);
