import { Router } from 'express';
import { Role } from '@prisma/client';
import { asyncHandler } from '../lib/errors';
import { requireAuth, requireRole } from '../middleware/auth';
import {
  getRealtimeStatus,
  ingestRealtimeData,
  realtimeSources,
} from '../services/realtimeIngest';

export const realtimeRouter = Router();
realtimeRouter.use(requireAuth);

realtimeRouter.get('/status', (_req, res) => {
  res.json(getRealtimeStatus());
});

realtimeRouter.get('/latest', (_req, res) => {
  res.json({ latest: getRealtimeStatus().latest });
});

realtimeRouter.get('/sources', (_req, res) => {
  res.json({ sources: realtimeSources() });
});

realtimeRouter.post(
  '/pull-now',
  requireRole(Role.ADMIN),
  asyncHandler(async (_req, res) => {
    res.json({ latest: await ingestRealtimeData() });
  }),
);
