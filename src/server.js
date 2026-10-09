const storage = require('./services/storage');

const config = storage.load();

const http = require('node:http');
const app = require('./app');
const server = http.createServer(app);

const websocket = require('./websocket');
websocket.init(server);

const syncService = require('./services/sync');
const SHUTDOWN_FORCE_EXIT_MS = 1000;

function gracefulShutdown(signal) {
  console.log(`\n[server] Received ${signal}, shutting down gracefully...`);

  syncService.stop();
  websocket.close();

  server.close(() => {
    console.log('[server] HTTP server closed');
    process.exit(0);
  });

  setTimeout(() => {
    console.log('[server] Shutdown complete');
    process.exit(0);
  }, SHUTDOWN_FORCE_EXIT_MS);
}

process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));

function printBanner({ displayHost, port }) {
  console.log(`
╔══════════════════════════════════════════════════════════════╗
║                     HOME DASHBOARD                           ║
╠══════════════════════════════════════════════════════════════╣
║  Server running at http://${displayHost}:${port}
║  Press Ctrl+C to stop                                        ║
╚══════════════════════════════════════════════════════════════╝
  `);
}

async function autoStartAirPurifiers() {
  if (!config.airPurifiers || config.airPurifiers.length === 0) {
    return;
  }

  console.log('Auto-starting air purifier polling...');
  const airpurifierService = require('./services/airpurifier');
  await airpurifierService.startAllPolling();
}

async function autoStartSync() {
  if (!isSyncConfigured(config)) {
    return;
  }

  console.log('Auto-starting sync...');
  const result = await syncService.start();

  if (!result.success) {
    console.log(`Auto-start failed: ${result.error}`);

    return;
  }

  console.log(`Syncing: ${config.sync.hueDeviceName} -> Nanoleaf`);
}

function isSyncConfigured(settings) {
  return Boolean(settings.hue?.username && settings.nanoleaf?.authToken && settings.sync?.hueDeviceId);
}

const DEFAULT_PORT = 3001;
const HOST = process.env.HOST || config.host || '0.0.0.0';
const PORT = process.env.PORT || config.port || DEFAULT_PORT;

server.listen(PORT, HOST, async () => {
  printBanner({ displayHost: HOST === '0.0.0.0' ? 'localhost' : HOST, port: PORT });
  await autoStartAirPurifiers();
  await autoStartSync();
});
