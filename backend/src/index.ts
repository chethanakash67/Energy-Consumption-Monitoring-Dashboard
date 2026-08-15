import cors from 'cors';
import express from 'express';
import morgan from 'morgan';
import { config } from './lib/config';
import { errorHandler, notFoundHandler } from './middleware/errorHandler';
import { alertsRouter } from './routes/alerts';
import { analyticsRouter } from './routes/analytics';
import { authRouter } from './routes/auth';
import { devicesRouter } from './routes/devices';
import { locationsRouter } from './routes/locations';
import { realtimeRouter } from './routes/realtime';
import { settingsRouter } from './routes/settings';
import { streamRouter } from './routes/stream';
import { usersRouter } from './routes/users';
import { clientCount } from './realtime/hub';
import { getRealtimeStatus, startRealtimeIngest, stopRealtimeIngest } from './services/realtimeIngest';
import { startSimulator, stopSimulator } from './services/simulator';

const app = express();

app.use(
  cors({
    origin: config.corsOrigins,
    credentials: true,
  }),
);
app.use(express.json({ limit: '1mb' }));
if (!config.isProduction) app.use(morgan('dev'));

app.get('/health', (_req, res) => {
  res.json({
    status: 'ok',
    uptimeSeconds: Math.round(process.uptime()),
    sseClients: clientCount(),
    realtime: getRealtimeStatus(),
    simulator: config.simulatorEnabled ? 'enabled' : 'disabled',
  });
});

app.use('/api/auth', authRouter);
app.use('/api/devices', devicesRouter);
app.use('/api/locations', locationsRouter);
app.use('/api/analytics', analyticsRouter);
app.use('/api/alerts', alertsRouter);
app.use('/api/realtime', realtimeRouter);
app.use('/api/users', usersRouter);
app.use('/api/settings', settingsRouter);
app.use('/api/stream', streamRouter);

app.use(notFoundHandler);
app.use(errorHandler);

const server = app.listen(config.port, () => {
  console.log(`API listening on http://localhost:${config.port}`);
  startRealtimeIngest().catch((error) => {
    console.error('Failed to start realtime ingestion:', error);
  });
  if (config.simulatorEnabled) {
    startSimulator().catch((error) => {
      console.error('Failed to start simulator:', error);
    });
  }
});

// SSE connections are long-lived; without this Node's 2-minute default would
// silently drop idle streams.
server.headersTimeout = 0;
server.requestTimeout = 0;

function shutdown(signal: string) {
  console.log(`\n${signal} received — shutting down.`);
  stopRealtimeIngest();
  stopSimulator();
  server.close(() => process.exit(0));
  // Force-exit if open SSE streams keep the server from closing cleanly.
  setTimeout(() => process.exit(0), 5_000).unref();
}

process.on('SIGINT', () => shutdown('SIGINT'));
process.on('SIGTERM', () => shutdown('SIGTERM'));
