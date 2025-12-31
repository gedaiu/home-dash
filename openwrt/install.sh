#!/bin/bash

set -e

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
PROJECT_DIR="$(dirname "$SCRIPT_DIR")"

APP_NAME="home-dashboard"
REMOTE_APP_DIR="/opt/$APP_NAME"
REMOTE_CONFIG_DIR="/etc/$APP_NAME"
REMOTE_DATA_DIR="/var/$APP_NAME/data"
INIT_SCRIPT="/etc/init.d/$APP_NAME"

usage() {
    echo "Usage: $0 <server-ip>"
    echo ""
    echo "Deploy Home Dashboard to an OpenWrt server."
    echo ""
    echo "Arguments:"
    echo "  server-ip    IP address or hostname of the OpenWrt server"
    echo ""
    echo "Examples:"
    echo "  $0 192.168.1.1"
    echo "  $0 router.local"
    exit 1
}

if [ -z "$1" ]; then
    usage
fi

SERVER="$1"
SSH_TARGET="root@$SERVER"

echo "=== Home Dashboard Deployment ==="
echo "Target: $SSH_TARGET"
echo ""

# Check SSH connectivity
echo "Checking SSH connectivity..."
if ! ssh -o ConnectTimeout=5 -o BatchMode=yes "$SSH_TARGET" "echo ok" >/dev/null 2>&1; then
    echo "ERROR: Cannot connect to $SSH_TARGET"
    echo "Make sure SSH key authentication is configured."
    exit 1
fi
echo "SSH connection OK"
echo ""

# Check if this is a fresh install or update
FRESH_INSTALL=false
if ! ssh "$SSH_TARGET" "[ -d $REMOTE_APP_DIR ]"; then
    FRESH_INSTALL=true
    echo "Fresh install detected"
else
    echo "Existing installation detected - updating"
fi
echo ""

if [ "$FRESH_INSTALL" = true ]; then
    echo "=== Setting up OpenWrt server ==="

    # Check and install Node.js
    echo "Checking for Node.js..."
    if ! ssh "$SSH_TARGET" "which node >/dev/null 2>&1"; then
        echo "Installing Node.js..."
        ssh "$SSH_TARGET" "opkg update && opkg install node node-npm"
    else
        echo "Node.js already installed"
    fi

    # Create directories
    echo "Creating directories..."
    ssh "$SSH_TARGET" "mkdir -p $REMOTE_APP_DIR $REMOTE_CONFIG_DIR $REMOTE_DATA_DIR"

    # Install init script
    echo "Installing init script..."
    scp "$SCRIPT_DIR/home-dashboard.init" "$SSH_TARGET:$INIT_SCRIPT"
    ssh "$SSH_TARGET" "chmod +x $INIT_SCRIPT && $INIT_SCRIPT enable"
    echo ""
fi

# Sync application files
echo "=== Syncing application files ==="
rsync -avz --delete \
    --exclude 'node_modules/' \
    --exclude '.git/' \
    --exclude 'coverage/' \
    --exclude 'data/' \
    --exclude 'network-config.json' \
    --exclude 'openwrt/' \
    "$PROJECT_DIR/" "$SSH_TARGET:$REMOTE_APP_DIR/"
echo ""

# Handle data folder (only on fresh install)
if [ "$FRESH_INSTALL" = true ]; then
    if [ -d "$PROJECT_DIR/data" ]; then
        echo "=== Syncing data folder (first install) ==="
        rsync -avz "$PROJECT_DIR/data/" "$SSH_TARGET:$REMOTE_DATA_DIR/"
        echo ""
    fi
fi

# Handle config file
if [ -f "$PROJECT_DIR/network-config.json" ]; then
    REMOTE_CONFIG="$REMOTE_CONFIG_DIR/config.json"

    if [ "$FRESH_INSTALL" = true ]; then
        echo "=== Installing config file ==="
        scp "$PROJECT_DIR/network-config.json" "$SSH_TARGET:$REMOTE_CONFIG"
        echo ""
    else
        # Check if configs differ
        LOCAL_MD5=$(md5sum "$PROJECT_DIR/network-config.json" 2>/dev/null | cut -d' ' -f1 || md5 -q "$PROJECT_DIR/network-config.json")
        REMOTE_MD5=$(ssh "$SSH_TARGET" "md5sum $REMOTE_CONFIG 2>/dev/null | cut -d' ' -f1" || echo "")

        if [ "$LOCAL_MD5" != "$REMOTE_MD5" ] && [ -n "$REMOTE_MD5" ]; then
            echo "Config file differs from server version."
            read -p "Update config on server? [y/N] " -n 1 -r
            echo ""
            if [[ $REPLY =~ ^[Yy]$ ]]; then
                scp "$PROJECT_DIR/network-config.json" "$SSH_TARGET:$REMOTE_CONFIG"
                echo "Config updated."
            else
                echo "Config preserved."
            fi
            echo ""
        fi
    fi
fi

# Install dependencies
echo "=== Installing dependencies ==="
ssh "$SSH_TARGET" "cd $REMOTE_APP_DIR && npm install --production --no-optional"
echo ""

# Restart service
echo "=== Restarting service ==="
ssh "$SSH_TARGET" "$INIT_SCRIPT restart"
sleep 2

# Show status
echo ""
echo "=== Service Status ==="
ssh "$SSH_TARGET" "$INIT_SCRIPT status" || true
echo ""
echo "=== Recent Logs ==="
ssh "$SSH_TARGET" "logread | grep $APP_NAME | tail -20" || true

echo ""
echo "=== Deployment complete ==="
echo "Dashboard should be available at: http://$SERVER:3001"
