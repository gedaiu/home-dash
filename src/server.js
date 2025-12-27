const http = require('node:http');
const app = require('./app');
const websocket = require('./websocket');
const syncService = require('./services/sync');
const airpurifierService = require('./services/airpurifier');
const storage = require('./services/storage');

const PORT = process.env.PORT || 3001;

const server = http.createServer(app);
websocket.init(server);

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
  }, 1000);
}

process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));

server.listen(PORT, async () => {
  console.log(`
╔══════════════════════════════════════════════════════════════╗
║                    HUE NANOLEAF SYNC                         ║
╠══════════════════════════════════════════════════════════════╣
║  Server running at http://localhost:${PORT}                     ║
║  Press Ctrl+C to stop                                        ║
╚══════════════════════════════════════════════════════════════╝
  `);

  const config = storage.load();

  if (config.airPurifiers && config.airPurifiers.length > 0) {
    console.log('Auto-starting air purifier polling...');
    await airpurifierService.startAllPolling();
  }

  if (config.hue?.username && config.nanoleaf?.authToken && config.sync?.hueDeviceId) {
    console.log('Auto-starting sync...');
    const result = await syncService.start();
    if (result.success) {
      console.log(`Syncing: ${config.sync.hueDeviceName} -> Nanoleaf`);
    } else {
      console.log(`Auto-start failed: ${result.error}`);
    }
  }
});
