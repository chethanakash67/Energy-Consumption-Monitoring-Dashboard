import { Router } from 'express';
import { DeviceStatus, DeviceType, Role } from '@prisma/client';
import { z } from 'zod';
import { prisma } from '../lib/prisma';
import { asyncHandler, notFound } from '../lib/errors';
import { requireAuth, requireRole } from '../middleware/auth';
import { parseRange } from '../lib/range';
import { wantsRealtimeScope, applyRealtimeScope } from '../lib/realtimeScope';
import { autoGranularity, getSeries } from '../services/analytics';
import { getRealtimeLocationId } from '../services/realtimeIngest';
import { isProducer } from '../services/simulation';

export const devicesRouter = Router();
devicesRouter.use(requireAuth);

const deviceSchema = z.object({
  name: z.string().min(2, 'Name must be at least 2 characters').max(80),
  type: z.nativeEnum(DeviceType),
  locationId: z.string().min(1, 'Pick a location'),
  ratedCapacityKw: z.number().positive('Rated capacity must be greater than zero').max(10_000),
  status: z.nativeEnum(DeviceStatus).optional(),
  thresholdKwh: z.number().positive().max(10_000).nullable().optional(),
});

/**
 * Efficiency score, 0-100.
 *
 * Consumers are scored on how far below nameplate capacity they run (lower
 * utilisation = better); producers are scored on how much of their capacity
 * they actually harvest (higher = better).
 */
function efficiencyScore(
  type: DeviceType,
  ratedCapacityKw: number,
  avgKw: number,
): number {
  if (ratedCapacityKw <= 0) return 0;
  const utilisation = Math.min(1, Math.abs(avgKw) / ratedCapacityKw);
  const score = isProducer(type) ? utilisation * 100 : (1 - utilisation) * 100;
  return Math.round(Math.max(0, Math.min(100, score)));
}

devicesRouter.get(
  '/',
  asyncHandler(async (req, res) => {
    const scopedLocationId = wantsRealtimeScope(req) ? await getRealtimeLocationId() : null;
    const devices = await prisma.device.findMany({
      where: scopedLocationId ? { locationId: scopedLocationId } : undefined,
      include: { location: true },
      orderBy: [{ location: { name: 'asc' } }, { name: 'asc' }],
    });

    // Attach the trailing-24h total and latest reading for the devices table.
    const since = new Date(Date.now() - 24 * 3_600_000);
    const totals = await prisma.reading.groupBy({
      by: ['deviceId'],
      where: {
        timestamp: { gte: since },
        ...(scopedLocationId ? { device: { locationId: scopedLocationId } } : {}),
      },
      _sum: { kwh: true, cost: true },
      _max: { timestamp: true },
    });
    const totalsByDevice = new Map(totals.map((row) => [row.deviceId, row]));

    res.json({
      devices: devices.map((device) => {
        const total = totalsByDevice.get(device.id);
        const kwh24h = total?._sum.kwh ?? 0;
        // 24h energy back to an average power figure for the efficiency score.
        const avgKw = kwh24h / 24;
        return {
          ...device,
          kwh24h: Number(kwh24h.toFixed(2)),
          cost24h: Number((total?._sum.cost ?? 0).toFixed(2)),
          lastReadingAt: total?._max.timestamp ?? null,
          efficiency: efficiencyScore(device.type, device.ratedCapacityKw, avgKw),
          isProducer: isProducer(device.type),
        };
      }),
    });
  }),
);

devicesRouter.get(
  '/:id',
  asyncHandler(async (req, res) => {
    const device = await prisma.device.findUnique({
      where: { id: req.params.id },
      include: { location: true },
    });
    if (!device) throw notFound('Device not found');

    const since = new Date(Date.now() - 24 * 3_600_000);
    const [aggregate, latest, openAlerts] = await Promise.all([
      prisma.reading.aggregate({
        where: { deviceId: device.id, timestamp: { gte: since } },
        _sum: { kwh: true, cost: true },
        _avg: { kwh: true },
        _max: { kwh: true },
      }),
      prisma.reading.findFirst({
        where: { deviceId: device.id },
        orderBy: { timestamp: 'desc' },
      }),
      prisma.alert.count({ where: { deviceId: device.id, acknowledged: false } }),
    ]);

    const kwh24h = aggregate._sum.kwh ?? 0;

    res.json({
      device: {
        ...device,
        isProducer: isProducer(device.type),
        kwh24h: Number(kwh24h.toFixed(2)),
        cost24h: Number((aggregate._sum.cost ?? 0).toFixed(2)),
        peakIntervalKwh: Number((aggregate._max.kwh ?? 0).toFixed(2)),
        avgIntervalKwh: Number((aggregate._avg.kwh ?? 0).toFixed(3)),
        efficiency: efficiencyScore(device.type, device.ratedCapacityKw, kwh24h / 24),
        lastReadingAt: latest?.timestamp ?? null,
        openAlerts,
      },
    });
  }),
);

/** Time series scoped to a single device. */
devicesRouter.get(
  '/:id/series',
  asyncHandler(async (req, res) => {
    const device = await prisma.device.findUnique({ where: { id: req.params.id } });
    if (!device) throw notFound('Device not found');

    const filter = await applyRealtimeScope(req, parseRange(req));
    const result = await getSeries(
      { ...filter, deviceIds: [device.id] },
      filter.granularity ?? autoGranularity(filter.from, filter.to),
    );
    res.json(result);
  }),
);

devicesRouter.post(
  '/',
  requireRole(Role.ADMIN),
  asyncHandler(async (req, res) => {
    const data = deviceSchema.parse(req.body);
    const device = await prisma.device.create({
      data: { ...data, thresholdKwh: data.thresholdKwh ?? null },
      include: { location: true },
    });
    res.status(201).json({ device });
  }),
);

devicesRouter.patch(
  '/:id',
  requireRole(Role.ADMIN),
  asyncHandler(async (req, res) => {
    const data = deviceSchema.partial().parse(req.body);
    const device = await prisma.device.update({
      where: { id: req.params.id },
      data,
      include: { location: true },
    });
    res.json({ device });
  }),
);

devicesRouter.delete(
  '/:id',
  requireRole(Role.ADMIN),
  asyncHandler(async (req, res) => {
    await prisma.device.delete({ where: { id: req.params.id } });
    res.status(204).end();
  }),
);
