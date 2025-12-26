# API Reference

## Hue Bridge

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/hue/discover` | Discover bridges on network |
| GET | `/api/hue/bridge` | Get configured bridge info |
| POST | `/api/hue/bridge/pair` | Pair with bridge |
| DELETE | `/api/hue/bridge` | Remove bridge config |
| GET | `/api/hue/lights` | List all lights |
| GET | `/api/hue/rooms` | List rooms with lights |

### POST /api/hue/bridge/pair

```json
{ "ip": "192.168.1.100" }
```

## Nanoleaf

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/nanoleaf/discover` | Discover devices on network |
| GET | `/api/nanoleaf/device` | Get configured device info |
| POST | `/api/nanoleaf/device/pair` | Pair with device |
| DELETE | `/api/nanoleaf/device` | Remove device config |
| GET | `/api/nanoleaf/config` | Get brightness config |
| PUT | `/api/nanoleaf/config` | Update brightness config |

### POST /api/nanoleaf/device/pair

```json
{ "ip": "192.168.1.101", "port": 16021 }
```

### PUT /api/nanoleaf/config

```json
{ "minBrightness": 5, "maxBrightness": 100 }
```

## Sync

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/sync/config` | Get sync configuration |
| PUT | `/api/sync/config` | Set sync config |
| POST | `/api/sync/start` | Start sync process |
| POST | `/api/sync/stop` | Stop sync process |
| GET | `/api/sync/status` | Get current sync status |

### PUT /api/sync/config

```json
{ "hueDeviceId": 1, "hueDeviceName": "Living Room Light" }
```

### GET /api/sync/status

```json
{
  "running": true,
  "lastSync": "2025-12-26T14:30:00.000Z",
  "lastError": null,
  "currentColor": { "r": 255, "g": 128, "b": 64 }
}
```

## WebSocket

Connect to `ws://localhost:3000` for real-time updates.

### Server to Client

| Event | Description |
|-------|-------------|
| `status` | Sync status update |
| `log` | Log message |
| `config` | Configuration changed |

### Client to Server

| Event | Description |
|-------|-------------|
| `ping` | Keep-alive (responds with `pong`) |
| `subscribe` | Request current status |

### Message Format

```json
{
  "type": "status",
  "data": {
    "running": true,
    "currentColor": { "r": 255, "g": 128, "b": 64 }
  }
}
```
