#!/bin/bash
# OpenWrt Network Monitor Uninstaller
# Usage: ./uninstall.sh <router-ip>

set -e

ROUTER_IP="${1:-}"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

if [ -z "$ROUTER_IP" ]; then
    echo -e "${RED}Error: Router IP address is required${NC}"
    echo "Usage: $0 <router-ip>"
    echo "Example: $0 192.168.1.1"
    exit 1
fi

echo -e "${YELLOW}========================================${NC}"
echo -e "${YELLOW}  OpenWrt Network Monitor Uninstaller${NC}"
echo -e "${YELLOW}========================================${NC}"
echo ""
echo "Router IP: $ROUTER_IP"
echo ""

# Test SSH connection
if ! ssh "root@${ROUTER_IP}" "echo 'Connected'" &>/dev/null; then
    echo -e "${RED}Error: Could not connect to router via SSH${NC}"
    echo "Make sure SSH is enabled and you can connect with: ssh root@${ROUTER_IP}"
    exit 1
fi

echo -e "${YELLOW}Stopping service...${NC}"
ssh "root@${ROUTER_IP}" "/etc/init.d/netmon stop 2>/dev/null || true"
ssh "root@${ROUTER_IP}" "/etc/init.d/netmon disable 2>/dev/null || true"
echo -e "${GREEN}Service stopped${NC}"

echo ""
echo -e "${YELLOW}Removing agent binary...${NC}"
ssh "root@${ROUTER_IP}" "rm -f /usr/bin/netmon-agent"
echo -e "${GREEN}Binary removed${NC}"

echo ""
echo -e "${YELLOW}Removing configuration...${NC}"
ssh "root@${ROUTER_IP}" "rm -f /etc/config/netmon /tmp/netmon-config.yaml"
echo -e "${GREEN}Configuration removed${NC}"

echo ""
echo -e "${YELLOW}Removing init script...${NC}"
ssh "root@${ROUTER_IP}" "rm -f /etc/init.d/netmon"
echo -e "${GREEN}Init script removed${NC}"

echo ""
echo -e "${YELLOW}Removing LuCI interface...${NC}"
ssh "root@${ROUTER_IP}" "rm -f /usr/lib/lua/luci/controller/netmon.lua"
ssh "root@${ROUTER_IP}" "rm -f /usr/lib/lua/luci/model/cbi/netmon.lua"
ssh "root@${ROUTER_IP}" "rm -rf /usr/lib/lua/luci/view/netmon"
ssh "root@${ROUTER_IP}" "rm -f /usr/share/luci/menu.d/luci-app-netmon.json"
ssh "root@${ROUTER_IP}" "rm -rf /www/luci-static/resources/view/netmon"
ssh "root@${ROUTER_IP}" "rm -f /usr/share/rpcd/acl.d/luci-app-netmon.json"
echo -e "${GREEN}LuCI interface removed${NC}"

echo ""
echo -e "${YELLOW}Clearing LuCI cache...${NC}"
ssh "root@${ROUTER_IP}" "rm -rf /tmp/luci-* 2>/dev/null; /etc/init.d/uhttpd restart 2>/dev/null || true"
echo -e "${GREEN}Cache cleared${NC}"

echo ""
echo -e "${GREEN}========================================${NC}"
echo -e "${GREEN}  Uninstallation Complete!${NC}"
echo -e "${GREEN}========================================${NC}"
echo ""
echo "Network Monitor has been removed from the router."
