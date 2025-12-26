# Data Storage Format

## Sensor History

Sensor data is stored in `data/sensors/` with one file per sensor per day:

```
data/sensors/{YYYY-MM-DD}_{sensorUniqueId}.json
```

### Compact Encoding

To minimize storage, history uses delta encoding with zigzag integers:

```json
{
  "h": [7200, 4814, 600, -22, 300, 0],
  "dailyStats": { "date": "2025-12-26", "min": 23.96, "max": 24.07 }
}
```

The `h` array contains pairs: `[timeDelta, valueDelta, timeDelta, valueDelta, ...]`

### Decoding Algorithm

1. **Time**: Cumulative seconds since midnight (zigzag decoded)
2. **Value**: Cumulative value in centiunits (zigzag decoded, divide by 100)

### Example

Decoding `[7200, 4814, 600, 21]`:

| Encoded | Zigzag Decoded | Cumulative | Result |
|---------|----------------|------------|--------|
| 7200 | 3600 | 3600s | 01:00:00 |
| 4814 | 2407 | 24.07 | 24.07 C |
| 600 | 300 | 3900s | 01:05:00 |
| 21 | -11 | 23.96 | 23.96 C |

### Zigzag Encoding

Converts signed integers to unsigned for efficient storage:

```javascript
// Encode: small negatives become small positives
encode(n) = (n << 1) ^ (n >> 31)

// Decode
decode(n) = (n >>> 1) ^ -(n & 1)
```

| Value | Encoded |
|-------|---------|
| 0 | 0 |
| -1 | 1 |
| 1 | 2 |
| -2 | 3 |
| 2 | 4 |

### Space Savings

- Only stores entries when value changes
- Timestamps as seconds-since-midnight deltas
- Values as deltas from previous reading
- Flat array instead of nested objects

## Light Change Logs

Light sync events are logged to `data/logs/{YYYY-MM-DD}_lights.log`:

```
14:30:45.123 [Living Room] RGB(255,128,64) animation bri:200
14:31:00.456 [Living Room] RGB(0,0,0) off OFF
```

Format: `{time} [{light}] RGB({r},{g},{b}) {mode} {state}`

Modes: `animation`, `static`, `off`
