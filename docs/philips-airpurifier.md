# Philips Air Purifier Integration

## Overview

This document describes the integration with Philips Air Purifiers using the encrypted CoAP protocol for local network communication.

## Communication Protocol

### CoAP (Constrained Application Protocol)

Philips Air Purifiers use CoAP over UDP on port **5683**. Newer models (post-2019) use an encrypted variant of the protocol.

### Endpoints

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/sys/dev/info` | GET | Device information (name, model, type) |
| `/sys/dev/sync` | POST | Initialize encrypted session, get counter |
| `/sys/dev/status` | GET/OBSERVE | Current device status (supports CoAP observe) |
| `/sys/dev/control` | POST | Send commands to device |

## Encryption

### Key Derivation

The encryption uses AES-128-CBC with key and IV derived from MD5:

```
hash = MD5(SECRET_KEY + counter)
key = hash[0:16]  (first 16 characters as bytes)
iv  = hash[16:32] (last 16 characters as bytes)
```

The `SECRET_KEY` is the hardcoded string `"JiangPan"`.

### Payload Format

Encrypted payloads follow this structure:

```
[counter][ciphertext_hex][sha256_digest]
```

- **counter**: 8 hex characters (4 bytes) - used as salt for key derivation
- **ciphertext_hex**: AES-CBC encrypted JSON, hex encoded, uppercase
- **sha256_digest**: 64 hex characters - SHA256 of (counter + ciphertext_hex)

### Padding

PKCS7 padding is used for the plaintext before encryption.

## Session Management

### Sync Process

1. Generate random 4-byte token (8 hex characters)
2. POST token to `/sys/dev/sync`
3. Device responds with initial counter value
4. Use counter for subsequent encrypted communications
5. Increment counter before each command

### Counter Handling

The counter is an 8-character uppercase hex string representing a 32-bit unsigned integer.

```javascript
// Increment counter
newCounter = ((parseInt(counter, 16) + 1) >>> 0).toString(16).toUpperCase().padStart(8, '0')
```

**Important**: The counter must be incremented BEFORE encrypting each command, not after.

## Command Format

Commands are JSON objects with this structure:

```json
{
  "state": {
    "desired": {
      "CommandType": "app",
      "DeviceId": "",
      "EnduserId": "",
      "<key>": "<value>"
    }
  }
}
```

## Status Properties

| Property | Type | Description |
|----------|------|-------------|
| `pwr` | string | Power state: `"0"` = off, `"1"` = on |
| `mode` | string | Operating mode (see Modes section) |
| `om` | string | Fan speed (see Fan Speeds section) |
| `pm25` | number | PM2.5 reading in µg/m³ |
| `iaql` | number | Indoor Air Quality Level (1-12, lower is better) |
| `tvoc` | number | Total Volatile Organic Compounds |
| `aqil` | number | Air quality indicator light brightness (0-100) |
| `uil` | string | Button light: `"0"` = off, `"1"` = on |
| `cl` | boolean | Child lock state |
| `fltsts0` | number | Pre-filter remaining hours |
| `flttotal0` | number | Pre-filter total hours |
| `fltsts1` | number | HEPA filter remaining hours |
| `flttotal1` | number | HEPA filter total hours |
| `fltsts2` | number | Carbon filter remaining hours |
| `flttotal2` | number | Carbon filter total hours |
| `Runtime` | number | Total runtime in hours |
| `modelid` | string | Device model identifier |
| `name` | string | Device name |
| `err` | number | Error code (0 = no error) |

## Operating Modes

| Value | Description | Notes |
|-------|-------------|-------|
| `P` | Auto (Pollution/General) | Smart auto-adjusting mode |
| `A` | Auto (Alternative) | Some models use this instead of P |
| `AG` | Allergen | Extra-sensitive allergen detection |
| `M` | Manual | Fixed fan speed, user-controlled |
| `S` | Sleep | Quiet operation, lights off |
| `T` | Turbo | Maximum performance |
| `B` | Bacteria & Virus | Enhanced pathogen filtering |

**Note**: Not all modes are available on all models. The device will accept the command but may not change if the mode is unsupported.

## Fan Speeds

| Value | Description |
|-------|-------------|
| `s` | Sleep (lowest) |
| `1` | Speed 1 |
| `2` | Speed 2 |
| `3` | Speed 3 |
| `t` | Turbo (highest) |

Fan speed control is only available in Manual mode (`M`). In other modes, the device auto-adjusts.

## Air Quality Index (iaql)

| Range | Label | Color |
|-------|-------|-------|
| 1-3 | Good | Blue/Green |
| 4-6 | Moderate | Yellow |
| 7-9 | Poor | Orange |
| 10-12 | Very Poor | Red |

## Model Capabilities

Different models support different features. Known configurations:

### AC2729 (Full Featured)
- Modes: P, AG, S, M, T
- Speeds: s, 1, 2, 3, t
- Has manual mode with fan control

### AC2889
- Modes: P, AG, S, T
- Speeds: s, 1, 2, t
- No manual mode

### AC3829
- Modes: P, S, T
- Speeds: s, 1, 2, t
- No manual mode, no allergen mode

### Default (Unknown Models)
- Modes: P, AG, S, M, T
- Speeds: s, 1, 2, 3, t
- Assumes full feature set

## CoAP Observe

The device supports CoAP observe on `/sys/dev/status`. When observing:

1. Device pushes status updates automatically on state changes
2. No additional polling required
3. Updates include all status properties

## Error Handling

### Common Issues

1. **Counter out of sync**: Re-sync by calling `/sys/dev/sync` again
2. **Connection timeout**: Device may have gone to sleep, retry connection
3. **Digest mismatch**: Payload corruption, retry the request

### Response Codes

| Code | Meaning |
|------|---------|
| 2.05 | Content (Success) |
| 4.00 | Bad Request |
| 4.04 | Not Found |
| 5.00 | Internal Server Error |

## Firmware Considerations

- Some newer firmware versions disable local CoAP communication
- Factory reset may re-enable local control
- Official Philips app updates may change behavior

## References

- [py-air-control](https://github.com/rgerganov/py-air-control) - Python CLI tool
- [philips-airpurifier-coap](https://github.com/kongo09/philips-airpurifier-coap) - Home Assistant integration
- [aioairctrl](https://pypi.org/project/aioairctrl/) - Async Python library

## Implementation Notes

### Node.js Dependencies

```json
{
  "node-coap-client": "CoAP client library",
  "aes-js": "AES encryption"
}
```

### Example: Send Power Command

```javascript
// 1. Sync to get counter
const syncResponse = await coap.post('/sys/dev/sync', randomToken);
let counter = syncResponse.payload.toString();

// 2. Increment counter BEFORE encryption
counter = incrementCounter(counter);

// 3. Build command
const command = {
  state: {
    desired: {
      CommandType: 'app',
      DeviceId: '',
      EnduserId: '',
      pwr: '1'  // Turn on
    }
  }
};

// 4. Encrypt and send
const encrypted = encrypt(JSON.stringify(command), counter);
await coap.post('/sys/dev/control', encrypted);
```

### Example: Observe Status

```javascript
await coap.observe('/sys/dev/status', (response) => {
  const decrypted = decrypt(response.payload.toString());
  console.log('Status update:', decrypted);
});
```
