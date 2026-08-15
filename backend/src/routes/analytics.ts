import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../lib/prisma';
import { asyncHandler } from '../lib/errors';
import { requireAuth } from '../middleware/auth';
import { parseRange } from '../lib/range';
import { applyRealtimeScope } from '../lib/realtimeScope';
import {
  autoGranularity,
  getBreakdown,
  getComparison,
  getHeatmap,
  getProjection,
  getSeries,
  getSummary,
} from '../services/analytics';
import { getSettings } from '../services/settings';

export const analyticsRouter = Router();
analyticsRouter.use(requireAuth);

analyticsRouter.get(
  '/summary',
  asyncHandler(async (req, res) => {
    res.json(await getSummary(await applyRealtimeScope(req, parseRange(req))));
  }),
);

analyticsRouter.get(
  '/series',
  asyncHandler(async (req, res) => {
    const filter = await applyRealtimeScope(req, parseRange(req));
    res.json(
      await getSeries(filter, filter.granularity ?? autoGranularity(filter.from, filter.to)),
    );
  }),
);

analyticsRouter.get(
  '/breakdown',
  asyncHandler(async (req, res) => {
    const dimension = z
      .enum(['type', 'location', 'device'])
      .catch('type')
      .parse(req.query.dimension);
    res.json({
      dimension,
      slices: await getBreakdown(await applyRealtimeScope(req, parseRange(req)), dimension),
    });
  }),
);

analyticsRouter.get(
  '/heatmap',
  asyncHandler(async (req, res) => {
    res.json({ cells: await getHeatmap(await applyRealtimeScope(req, parseRange(req))) });
  }),
);

analyticsRouter.get(
  '/projection',
  asyncHandler(async (req, res) => {
    const timezone = typeof req.query.tz === 'string' ? req.query.tz : 'UTC';
    res.json(await getProjection(timezone));
  }),
);

analyticsRouter.get(
  '/comparison',
  asyncHandler(async (req, res) => {
    const dimension = z.enum(['device', 'location']).catch('device').parse(req.query.dimension);
    const filter = await applyRealtimeScope(req, parseRange(req));
    res.json(
      await getComparison(
        filter,
        dimension,
        filter.granularity ?? autoGranularity(filter.from, filter.to),
      ),
    );
  }),
);

/**
 * CSV export of raw readings for a range.
 *
 * Streams row-by-row rather than buffering: a 90-day export across every
 * device is ~800k rows, which would otherwise sit in memory as one string.
 */
analyticsRouter.get(
  '/export',
  asyncHandler(async (req, res) => {
    const filter = await applyRealtimeScope(req, parseRange(req));
    const settings = await getSettings();

    const filename = `energy-report-${filter.from.toISOString().slice(0, 10)}-to-${filter.to
      .toISOString()
      .slice(0, 10)}.csv`;

    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.write(`timestamp,location,device,type,kwh,cost_${settings.currency.toLowerCase()}\n`);

    const PAGE_SIZE = 5_000;
    let cursor: bigint | undefined;

    for (;;) {
      const page = await prisma.reading.findMany({
        where: {
          timestamp: { gte: filter.from, lt: filter.to },
          ...(filter.deviceIds?.length ? { deviceId: { in: filter.deviceIds } } : {}),
          ...(filter.locationIds?.length
            ? { device: { locationId: { in: filter.locationIds } } }
            : {}),
        },
        include: { device: { include: { location: true } } },
        orderBy: { id: 'asc' },
        take: PAGE_SIZE,
        ...(cursor ? { skip: 1, cursor: { id: cursor } } : {}),
      });

      if (page.length === 0) break;

      for (const reading of page) {
        res.write(
          [
            reading.timestamp.toISOString(),
            csvEscape(reading.device.location.name),
            csvEscape(reading.device.name),
            reading.device.type,
            reading.kwh.toFixed(4),
            reading.cost.toFixed(4),
          ].join(',') + '\n',
        );
      }

      if (page.length < PAGE_SIZE) break;
      cursor = page[page.length - 1].id;
    }

    res.end();
  }),
);

/** Wraps a field in quotes when it contains a comma, quote, or newline. */
function csvEscape(value: string): string {
  if (/[",\n\r]/.test(value)) return `"${value.replace(/"/g, '""')}"`;
  return value;
}
