# Hue Nanoleaf Sync

Sync your Philips Hue lights with Nanoleaf panels in real-time. Features a retro terminal-style web UI.

```
╔══════════════════════════════════════════════════════════════╗
║                    HUE NANOLEAF SYNC                         ║
╠══════════════════════════════════════════════════════════════╣
║  Sync Hue light colors to Nanoleaf panels automatically      ║
║  Real-time WebSocket updates                                 ║
║  Retro terminal UI                                           ║
╚══════════════════════════════════════════════════════════════╝
```

## Quick Start

1. Install dependencies:
```bash
npm install
```

2. Start the server:
```bash
npm start
```

3. Open http://localhost:3000 in your browser

4. Follow the setup wizard:
   - Click the search icon next to "HUE BRIDGE" to discover and pair
   - Click the search icon next to "NANOLEAF" to discover and pair
   - Select a light from the rooms list to sync
   - Click "START" to begin syncing

## Features

- **Device Discovery**: Automatic discovery of Hue Bridge and Nanoleaf panels on your network
- **Real-time Sync**: Polls Hue light state and updates Nanoleaf colors
- **Smart Animations**: Uses animated effects for saturated colors, static for whites
- **Brightness Mapping**: Configurable min/max brightness range for Nanoleaf
- **WebSocket Updates**: Live UI updates without page refresh
- **Retro Terminal UI**: VT320-inspired hacker aesthetic

## Configuration

Configuration is stored in `data/config.json`. The file is created automatically during setup.

### Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `PORT` | 3000 | Server port |

### Config Structure

```json
{
  "hue": {
    "ip": "192.168.x.x",
    "username": "api-key-from-bridge"
  },
  "nanoleaf": {
    "ip": "192.168.x.x",
    "port": 16021,
    "authToken": "auth-token-from-device",
    "minBrightness": 5,
    "maxBrightness": 100
  },
  "sync": {
    "hueDeviceId": 1,
    "hueDeviceName": "Living Room Light"
  }
}
```

## Development

Run in watch mode:
```bash
npm run dev
```

Run tests:
```bash
npm test
```

Run tests in watch mode:
```bash
npm test:watch
```

## CLI Tools

The original CLI tools are still available for manual setup and troubleshooting:

```bash
# Discover and pair devices
npm run scan

# Verify device connections
npm run verify

# Select which light to sync (CLI)
npm run setup-sync

# Run sync in CLI mode
npm run sync
```

## API Reference

### Hue Bridge

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/hue/discover` | Discover bridges on network |
| GET | `/api/hue/bridge` | Get configured bridge info |
| POST | `/api/hue/bridge/pair` | Pair with bridge (body: `{ip}`) |
| DELETE | `/api/hue/bridge` | Remove bridge config |
| GET | `/api/hue/lights` | List all lights |
| GET | `/api/hue/rooms` | List rooms with lights |

### Nanoleaf

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/nanoleaf/discover` | Discover devices on network |
| GET | `/api/nanoleaf/device` | Get configured device info |
| POST | `/api/nanoleaf/device/pair` | Pair with device (body: `{ip, port}`) |
| DELETE | `/api/nanoleaf/device` | Remove device config |
| GET | `/api/nanoleaf/config` | Get brightness config |
| PUT | `/api/nanoleaf/config` | Update brightness config |

### Sync

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/sync/config` | Get sync configuration |
| PUT | `/api/sync/config` | Set sync config (body: `{hueDeviceId, hueDeviceName}`) |
| POST | `/api/sync/start` | Start sync process |
| POST | `/api/sync/stop` | Stop sync process |
| GET | `/api/sync/status` | Get current sync status |

### WebSocket Events

Connect to `ws://localhost:3000` for real-time updates:

**Server → Client:**
- `status` - Sync status update
- `log` - Log message
- `config` - Config changed

**Client → Server:**
- `ping` - Keep-alive (responds with `pong`)
- `subscribe` - Request current status

## Sensor Data Storage

Sensor history is stored in `data/sensors/` with one file per sensor per day:
```
data/sensors/{YYYY-MM-DD}_{sensorUniqueId}.json
```

### Compact Encoding Format

To minimize storage, sensor history uses a space-efficient delta encoding:

```json
{
  "h": [7200, 4814, 600, -22, 300, 0],
  "dailyStats": { "date": "2025-12-26", "min": 23.96, "max": 24.07 }
}
```

The `h` array contains pairs of zigzag-encoded values: `[timeDelta, valueDelta, ...]`

**Decoding:**
1. **Time**: Cumulative seconds since midnight (zigzag decoded)
2. **Value**: Cumulative value in centiunits (zigzag decoded, divide by 100)

**Example decoding `[7200, 4814, 600, -22]`:**
```
Entry 1: time = zigzag(7200) = 3600s (01:00:00), value = zigzag(4814)/100 = 24.07
Entry 2: time = 3600 + zigzag(600) = 3900s (01:05:00), value = 24.07 + zigzag(-22)/100 = 23.96
```

**Zigzag encoding:**
- Encodes signed integers as unsigned: `(n << 1) ^ (n >> 31)`
- Small negative numbers become small positive numbers
- Decode: `(n >>> 1) ^ -(n & 1)`

**Space savings:**
- Only stores entries when value changes (not every poll)
- Timestamps as seconds-since-midnight deltas (small numbers)
- Values as deltas from previous (typically small changes)
- Flat array instead of nested objects

## License

MIT
