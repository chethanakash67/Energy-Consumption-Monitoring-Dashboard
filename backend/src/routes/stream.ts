import { Router } from 'express';
import { requireAuth } from '../middleware/auth';
import { addClient } from '../realtime/hub';

export const streamRouter = Router();

/**
 * SSE endpoint for the live feed.
 *
 * `EventSource` cannot set an Authorization header, so the token arrives as a
 * `?token=` query param — `requireAuth` accepts either form.
 */
streamRouter.get('/', requireAuth, (req, res) => {
  res.writeHead(200, {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache, no-transform',
    Connection: 'keep-alive',
    // Disables response buffering in nginx, which would otherwise hold events.
    'X-Accel-Buffering': 'no',
  });
  res.flushHeaders?.();

  const remove = addClient(res);
  req.on('close', remove);
  req.on('error', remove);
});
