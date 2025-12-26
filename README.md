# Hue Nanoleaf Sync

Sync your Philips Hue lights with Nanoleaf panels in real-time. Features a retro terminal-style web UI.

## Quick Start

```bash
npm install
npm start
```

Open http://localhost:3000 and follow the setup:
1. Click the search icon next to "HUE BRIDGE" to discover and pair
2. Click the search icon next to "NANOLEAF" to discover and pair
3. Select a light from the rooms list to sync
4. Click "START" to begin syncing

## Features

- Automatic discovery of Hue Bridge and Nanoleaf panels
- Real-time color sync with smart animations
- Configurable brightness mapping
- Live WebSocket updates
- Sensor monitoring with history graphs
- VT320-inspired retro terminal UI

## Configuration

Configuration is stored in `network-config.json`:

```json
{
  "hue": { "ip": "192.168.x.x", "username": "api-key" },
  "nanoleaf": { "ip": "192.168.x.x", "port": 16021, "authToken": "token" },
  "sync": { "hueDeviceId": 1, "hueDeviceName": "Living Room Light" }
}
```

| Environment Variable | Default | Description |
|---------------------|---------|-------------|
| `PORT` | 3000 | Server port |

## Development

```bash
npm run dev      # Watch mode
npm test         # Run tests
npm run test:watch
```

## CLI Tools

```bash
npm run scan        # Discover and pair devices
npm run verify      # Verify connections
npm run setup-sync  # Select sync light (CLI)
npm run sync        # Run sync in CLI mode
```

## Documentation

- [API Reference](docs/API.md)
- [Data Storage Format](docs/STORAGE.md)

## License

MIT
