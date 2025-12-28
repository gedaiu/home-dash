#!/bin/bash
# OpenWrt Network Monitor Installer
# Usage: ./install.sh <router-ip> [server-url] [router-id] [router-name] [role]

set -e

ROUTER_IP="${1:-}"
SERVER_URL="${2:-}"
ROUTER_ID="${3:-router}"
ROUTER_NAME="${4:-Router}"
ROLE="${5:-main}"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

print_usage() {
    echo "Usage: $0 <router-ip> [server-url] [router-id] [router-name] [role]"
    echo ""
    echo "Arguments:"
    echo "  router-ip    IP address of the OpenWrt router (required)"
    echo "  server-url   WebSocket URL of dashboard server (optional, can configure later in LuCI)"
    echo "               Example: ws://192.168.1.100:3000/ws/agent"
    echo "  router-id    Unique identifier for this router (default: router)"
    echo "  router-name  Friendly name for dashboard (default: Router)"
    echo "  role         Router role: 'main' or 'ap' (default: main)"
    echo ""
    echo "Examples:"
    echo "  $0 192.168.1.1"
    echo "  $0 192.168.1.1 ws://192.168.1.100:3000/ws/agent main \"Main Router\" main"
    echo "  $0 192.168.1.2 ws://192.168.1.100:3000/ws/agent ap \"Upstairs AP\" ap"
}

if [ -z "$ROUTER_IP" ]; then
    echo -e "${RED}Error: Router IP address is required${NC}"
    echo ""
    print_usage
    exit 1
fi

echo -e "${GREEN}========================================${NC}"
echo -e "${GREEN}  OpenWrt Network Monitor Installer${NC}"
echo -e "${GREEN}========================================${NC}"
echo ""
echo "Router IP:    $ROUTER_IP"
echo "Server URL:   ${SERVER_URL:-<not set - configure in LuCI>}"
echo "Router ID:    $ROUTER_ID"
echo "Router Name:  $ROUTER_NAME"
echo "Role:         $ROLE"
echo ""

# Get script directory
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

# Detect architecture
echo -e "${YELLOW}Detecting router architecture...${NC}"
ARCH=$(ssh "root@${ROUTER_IP}" "uname -m" 2>/dev/null)

if [ -z "$ARCH" ]; then
    echo -e "${RED}Error: Could not connect to router via SSH${NC}"
    echo "Make sure SSH is enabled and you can connect with: ssh root@${ROUTER_IP}"
    exit 1
fi

echo "Architecture: $ARCH"

# Map architecture to binary name
case "$ARCH" in
    x86_64|amd64)
        BINARY="netmon-agent-linux-amd64"
        ;;
    mips)
        BINARY="netmon-agent-linux-mips"
        ;;
    mipsel|mipsle)
        BINARY="netmon-agent-linux-mipsle"
        ;;
    armv7l|armv7)
        BINARY="netmon-agent-linux-arm"
        ;;
    aarch64|arm64)
        BINARY="netmon-agent-linux-arm64"
        ;;
    *)
        echo -e "${RED}Error: Unsupported architecture: $ARCH${NC}"
        echo "Supported: x86_64, mips, mipsle, arm, arm64"
        exit 1
        ;;
esac

# Check if binary exists
BINARY_PATH="${SCRIPT_DIR}/build/${BINARY}"
if [ ! -f "$BINARY_PATH" ]; then
    echo -e "${YELLOW}Binary not found. Attempting to build agent...${NC}"

    # Check if Go is installed
    if command -v go &> /dev/null; then
        cd "$SCRIPT_DIR"

        # Ensure dependencies are downloaded
        echo -e "${YELLOW}Downloading Go dependencies...${NC}"
        go mod tidy

        # Build all platforms
        make all

        if [ ! -f "$BINARY_PATH" ]; then
            echo -e "${RED}Error: Failed to build binary${NC}"
            exit 1
        fi
    else
        echo -e "${RED}Error: Go is not installed on this machine${NC}"
        echo ""
        echo "To install Go:"
        echo "  macOS:  brew install go"
        echo "  Ubuntu: sudo apt install golang-go"
        echo ""
        echo "Or build the binaries manually first:"
        echo "  cd ${SCRIPT_DIR}"
        echo "  make all"
        echo ""
        echo "Then run this script again."
        exit 1
    fi
fi

echo ""
echo -e "${YELLOW}Installing agent binary...${NC}"

# Copy binary to router
scp "$BINARY_PATH" "root@${ROUTER_IP}:/tmp/netmon-agent"
ssh "root@${ROUTER_IP}" "mv /tmp/netmon-agent /usr/bin/netmon-agent && chmod +x /usr/bin/netmon-agent"

echo -e "${GREEN}Binary installed to /usr/bin/netmon-agent${NC}"

echo ""
echo -e "${YELLOW}Installing configuration...${NC}"

# Create UCI config
ssh "root@${ROUTER_IP}" "cat > /etc/config/netmon << 'EOF'
config netmon 'main'
	option enabled '1'
	option server_url '${SERVER_URL}'
	option router_id '${ROUTER_ID}'
	option router_name '${ROUTER_NAME}'
	option role '${ROLE}'
	option batch_interval '100'
	option stats_interval '10000'
	option conntrack_enabled '1'
	option traffic_enabled '1'
	option max_connections '1000'
EOF"

echo -e "${GREEN}Configuration created at /etc/config/netmon${NC}"

echo ""
echo -e "${YELLOW}Installing init script...${NC}"

# Copy init script
scp "${SCRIPT_DIR}/luci-app-netmon/root/etc/init.d/netmon" "root@${ROUTER_IP}:/etc/init.d/netmon"
ssh "root@${ROUTER_IP}" "chmod +x /etc/init.d/netmon"

echo -e "${GREEN}Init script installed${NC}"

echo ""
echo -e "${YELLOW}Installing LuCI interface...${NC}"

# Create LuCI directories (support both old Lua-based and new JS-based LuCI)
ssh "root@${ROUTER_IP}" "mkdir -p /usr/lib/lua/luci/controller /usr/lib/lua/luci/model/cbi /usr/lib/lua/luci/view/netmon /usr/share/luci/menu.d /www/luci-static/resources/view/netmon"

# Copy JSON menu (works with new LuCI)
scp "${SCRIPT_DIR}/luci-app-netmon/root/usr/share/luci/menu.d/luci-app-netmon.json" "root@${ROUTER_IP}:/usr/share/luci/menu.d/"

# Copy JS views (new LuCI)
scp "${SCRIPT_DIR}/luci-app-netmon/htdocs/luci-static/resources/view/netmon/"*.js "root@${ROUTER_IP}:/www/luci-static/resources/view/netmon/" 2>/dev/null || true

# Copy Lua files (old LuCI fallback)
scp "${SCRIPT_DIR}/luci-app-netmon/luasrc/controller/netmon.lua" "root@${ROUTER_IP}:/usr/lib/lua/luci/controller/" 2>/dev/null || true
scp "${SCRIPT_DIR}/luci-app-netmon/luasrc/model/cbi/netmon.lua" "root@${ROUTER_IP}:/usr/lib/lua/luci/model/cbi/" 2>/dev/null || true
scp "${SCRIPT_DIR}/luci-app-netmon/luasrc/view/netmon/"*.htm "root@${ROUTER_IP}:/usr/lib/lua/luci/view/netmon/" 2>/dev/null || true

# Copy ACL file for rpcd permissions
scp "${SCRIPT_DIR}/luci-app-netmon/root/usr/share/rpcd/acl.d/luci-app-netmon.json" "root@${ROUTER_IP}:/usr/share/rpcd/acl.d/"

# Fix file permissions (web server needs read access)
ssh "root@${ROUTER_IP}" "chmod 644 /usr/share/luci/menu.d/luci-app-netmon.json /www/luci-static/resources/view/netmon/*.js /usr/share/rpcd/acl.d/luci-app-netmon.json 2>/dev/null; chmod 644 /usr/lib/lua/luci/controller/netmon.lua /usr/lib/lua/luci/model/cbi/netmon.lua /usr/lib/lua/luci/view/netmon/*.htm 2>/dev/null || true"

# Restart rpcd to apply ACL changes
ssh "root@${ROUTER_IP}" "/etc/init.d/rpcd restart 2>/dev/null || true"

echo -e "${GREEN}LuCI interface installed${NC}"

echo ""
echo -e "${YELLOW}Enabling and starting service...${NC}"

# Enable and start service
ssh "root@${ROUTER_IP}" "/etc/init.d/netmon enable && /etc/init.d/netmon start"

# Clear LuCI cache and restart web server
ssh "root@${ROUTER_IP}" "rm -rf /tmp/luci-* 2>/dev/null; /etc/init.d/uhttpd restart 2>/dev/null || true"

echo ""
echo -e "${GREEN}========================================${NC}"
echo -e "${GREEN}  Installation Complete!${NC}"
echo -e "${GREEN}========================================${NC}"
echo ""
echo "Next steps:"
echo "  1. Open LuCI: http://${ROUTER_IP}/cgi-bin/luci/admin/services/netmon"
echo "  2. Configure the Server URL if not set"
echo "  3. Click 'Save & Apply'"
echo ""

if [ -z "$SERVER_URL" ]; then
    echo -e "${YELLOW}Note: Server URL was not provided.${NC}"
    echo "The agent won't connect until you configure it in LuCI."
    echo ""
fi

# Check if service is running
if ssh "root@${ROUTER_IP}" "pgrep -f netmon-agent > /dev/null 2>&1"; then
    echo -e "${GREEN}Service Status: Running${NC}"
else
    if [ -z "$SERVER_URL" ]; then
        echo -e "${YELLOW}Service Status: Not running (no server URL configured)${NC}"
    else
        echo -e "${RED}Service Status: Not running (check logs with 'logread | grep netmon')${NC}"
    fi
fi
