#!/bin/sh

# Traffic Capture Script for OpenWRT
# Captures ALL traffic to/from the air purifier

# Configuration
PURIFIER_IP="${1:-192.168.1.237}"
OUTPUT_FILE="${2:-/tmp/purifier_capture.pcap}"
MODE="${3:-all}"

echo "=== Air Purifier Traffic Capture ==="
echo "Air Purifier IP: $PURIFIER_IP"
echo "Output file: $OUTPUT_FILE"
echo "Mode: $MODE"
echo ""

# Find capture tool
CAPTURE_TOOL=""
if command -v tcpdump > /dev/null 2>&1; then
    CAPTURE_TOOL="tcpdump"
elif [ -f /usr/sbin/tcpdump-mini ]; then
    CAPTURE_TOOL="/usr/sbin/tcpdump-mini"
fi

if [ -z "$CAPTURE_TOOL" ]; then
    echo "ERROR: No tcpdump found"
    exit 1
fi

echo "Using: $CAPTURE_TOOL"
echo ""
echo "Instructions:"
echo "1. Keep this running"
echo "2. Open Philips Air+ app on your phone"
echo "3. Connect to the air purifier"
echo "4. Interact with it (change fan speed, etc.)"
echo "5. Press Ctrl+C to stop"
echo ""

case "$MODE" in
    coap)
        FILTER="host $PURIFIER_IP and udp port 5683"
        echo "Capturing CoAP (UDP 5683) only..."
        ;;
    udp)
        FILTER="host $PURIFIER_IP and udp"
        echo "Capturing all UDP traffic..."
        ;;
    tcp)
        FILTER="host $PURIFIER_IP and tcp"
        echo "Capturing all TCP traffic..."
        ;;
    *)
        FILTER="host $PURIFIER_IP"
        echo "Capturing ALL traffic to/from $PURIFIER_IP..."
        ;;
esac

echo ""
echo "Filter: $FILTER"
echo ""

# Save to pcap and show on console
$CAPTURE_TOOL -i br-lan -nn -X -s 0 -w "$OUTPUT_FILE" "$FILTER" &
PID=$!

# Also show summary on console
$CAPTURE_TOOL -i br-lan -nn -q "$FILTER" &
PID2=$!

echo "Capture started (PIDs: $PID, $PID2)"
echo "Press Ctrl+C to stop..."
echo ""

cleanup() {
    echo ""
    echo "Stopping capture..."
    kill $PID 2>/dev/null
    kill $PID2 2>/dev/null
    sleep 1
    echo ""
    echo "Saved to: $OUTPUT_FILE"
    echo ""
    echo "Quick analysis:"
    $CAPTURE_TOOL -r "$OUTPUT_FILE" -nn 2>/dev/null | head -50
    echo ""
    echo "Ports used:"
    $CAPTURE_TOOL -r "$OUTPUT_FILE" -nn 2>/dev/null | grep -oE ':[0-9]+' | sort | uniq -c | sort -rn | head -20
}

trap cleanup INT TERM
wait $PID
