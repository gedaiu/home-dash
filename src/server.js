const http = require('node:http');
const app = require('./app');
const websocket = require('./websocket');
const syncService = require('./services/sync');
const storage = require('./services/storage');

const PORT = process.env.PORT || 3001;

const server = http.createServer(app);
websocket.init(server);

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
