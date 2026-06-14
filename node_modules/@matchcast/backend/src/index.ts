import 'dotenv/config';
import express from 'express';
import { startPoller, pollerEmitter } from './poller';
import { startEventProcessor } from './events/processor';
import { startDeliveryService } from './events/delivery';
import { startSponsorInjector } from './sponsors/injector';
import { setupSubscriptionRoutes, startSubscriptionCron } from './subscriptions';
import { getLiveMatches } from './db/matches';
import apiRouter from './api/routes';

// Initialise bot (side-effectful — registers all Telegram command handlers)
import './bot';

const PORT = Number(process.env.PORT) || 3000;

// Track poller health via emitter events
let pollerActive = false;
pollerEmitter.on('eventsReady', () => { pollerActive = true; });

export const app = express();

// Mount the white-label API router BEFORE global express.json() middleware
app.use('/v1', apiRouter);

app.use(express.json());

// Register subscription routes (webhook uses express.raw internally)
setupSubscriptionRoutes(app);

app.get('/health', async (_req, res) => {
  let liveMatchCount = 0;
  try {
    const liveMatches = await getLiveMatches();
    liveMatchCount = liveMatches.length;
  } catch {
    // non-fatal — health check still responds
  }
  res.json({
    status: 'ok',
    uptime: process.uptime(),
    liveMatchCount,
    pollerActive,
  });
});

export function startServer(): void {
  app.listen(PORT, () => {
    console.log(JSON.stringify({
      level: 'info',
      message: `Server listening on port ${PORT}`,
      port: PORT,
      env: process.env.NODE_ENV ?? 'development',
    }));

    // Start the pipeline in order: Delivery → EventProcessor → Poller
    startSponsorInjector();
    startDeliveryService();
    startEventProcessor();
    startPoller();
    startSubscriptionCron();

    console.log(JSON.stringify({ level: 'info', message: 'All modules started' }));
  });
}

startServer();
