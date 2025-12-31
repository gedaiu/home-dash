# OpenWrt Deployment

Deploy Home Dashboard to an OpenWrt server with automatic service management.

## Prerequisites

- OpenWrt server with x86_64 architecture
- SSH key authentication configured for root access
- Sufficient storage space (approximately 100MB)

## Directory Structure on OpenWrt

```
/opt/home-dashboard/           # Application code
/etc/home-dashboard/config.json  # Configuration
/var/home-dashboard/data/      # Runtime data (sensors, logs, caches)
/etc/init.d/home-dashboard     # procd init script
```

## Deployment

### Fresh Install or Update

```bash
./openwrt/install.sh 192.168.1.1
```

The script automatically detects whether this is a fresh install or update:

**Fresh Install:**
- Installs Node.js via opkg if not present
- Creates required directories
- Syncs application files
- Syncs local `data/` folder to server
- Copies `network-config.json` to `/etc/home-dashboard/config.json`
- Installs and enables the init script

**Update:**
- Syncs application files (preserves server data)
- Prompts before overwriting config if it differs
- Reinstalls dependencies
- Restarts the service

## Configuration

The configuration file is stored at `/etc/home-dashboard/config.json` on the server.

You can set the server port in the config:

```json
{
  "port": 3001,
  "hue": { ... },
  "nanoleaf": { ... }
}
```

## Service Management

```bash
# Start/stop/restart
/etc/init.d/home-dashboard start
/etc/init.d/home-dashboard stop
/etc/init.d/home-dashboard restart

# Enable/disable auto-start
/etc/init.d/home-dashboard enable
/etc/init.d/home-dashboard disable

# Check status
/etc/init.d/home-dashboard status
```

## Logs

```bash
# View recent logs
logread | grep home-dashboard

# Follow logs in real-time
logread -f | grep home-dashboard
```

## Troubleshooting

**Service won't start:**
```bash
# Check if Node.js is installed
which node
node --version

# Check for errors
logread | grep home-dashboard | tail -50
```

**Permission issues:**
```bash
# Ensure directories have correct permissions
chown -R root:root /opt/home-dashboard
chmod -R 755 /opt/home-dashboard
```

**Config issues:**
```bash
# Validate JSON config
cat /etc/home-dashboard/config.json | json_pp
```
