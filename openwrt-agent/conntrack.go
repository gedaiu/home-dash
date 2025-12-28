package main

import (
	"bufio"
	"log"
	"os/exec"
	"regexp"
	"strconv"
	"strings"
)

// ConntrackEvent represents a connection tracking event
type ConntrackEvent struct {
	Action   string `json:"action"`   // NEW, UPDATE, DESTROY
	Protocol string `json:"protocol"` // tcp, udp, icmp
	SrcIP    string `json:"src_ip"`
	DstIP    string `json:"dst_ip"`
	SrcPort  int    `json:"src_port,omitempty"`
	DstPort  int    `json:"dst_port,omitempty"`
	State    string `json:"state,omitempty"` // ESTABLISHED, etc.
	Bytes    int64  `json:"bytes,omitempty"`
	Packets  int64  `json:"packets,omitempty"`
}

// ConntrackCollector streams connection tracking events
type ConntrackCollector struct {
	routerID       string
	maxConnections int
	eventCount     int
}

// NewConntrackCollector creates a new conntrack collector
func NewConntrackCollector(routerID string, maxConnections int) *ConntrackCollector {
	return &ConntrackCollector{
		routerID:       routerID,
		maxConnections: maxConnections,
	}
}

// Stream starts streaming conntrack events
func (c *ConntrackCollector) Stream(eventChan chan<- ConntrackEvent, stopChan <-chan struct{}) error {
	// Use conntrack -E to stream events in real-time
	cmd := exec.Command("conntrack", "-E", "-o", "extended")
	stdout, err := cmd.StdoutPipe()
	if err != nil {
		return err
	}

	if err := cmd.Start(); err != nil {
		log.Printf("conntrack command not available, falling back to polling: %v", err)
		return c.pollConntrack(eventChan, stopChan)
	}

	defer cmd.Process.Kill()

	scanner := bufio.NewScanner(stdout)

	for {
		select {
		case <-stopChan:
			return nil
		default:
			if !scanner.Scan() {
				if err := scanner.Err(); err != nil {
					log.Printf("Conntrack scanner error: %v", err)
				}
				return nil
			}

			line := scanner.Text()
			event, ok := parseConntrackLine(line)
			if ok {
				select {
				case eventChan <- event:
					c.eventCount++
				default:
					// Channel full, drop event
				}
			}
		}
	}
}

// pollConntrack falls back to polling conntrack table
func (c *ConntrackCollector) pollConntrack(eventChan chan<- ConntrackEvent, stopChan <-chan struct{}) error {
	// This is a fallback for systems where conntrack -E doesn't work
	log.Println("Conntrack event streaming not available")
	return nil
}

// parseConntrackLine parses a line from conntrack -E output
func parseConntrackLine(line string) (ConntrackEvent, bool) {
	event := ConntrackEvent{}

	// Example output:
	// [NEW] tcp 6 120 SYN_SENT src=192.168.1.100 dst=8.8.8.8 sport=54321 dport=443
	// [UPDATE] tcp 6 120 ESTABLISHED src=192.168.1.100 dst=8.8.8.8 sport=54321 dport=443
	// [DESTROY] tcp 6 src=192.168.1.100 dst=8.8.8.8 sport=54321 dport=443

	// Parse action
	if strings.HasPrefix(line, "[NEW]") {
		event.Action = "NEW"
	} else if strings.HasPrefix(line, "[UPDATE]") {
		event.Action = "UPDATE"
	} else if strings.HasPrefix(line, "[DESTROY]") {
		event.Action = "DESTROY"
	} else {
		return event, false
	}

	// Parse protocol
	parts := strings.Fields(line)
	if len(parts) < 3 {
		return event, false
	}
	event.Protocol = parts[1]

	// Parse key=value pairs
	srcIP := extractValue(line, "src")
	dstIP := extractValue(line, "dst")
	srcPort := extractValue(line, "sport")
	dstPort := extractValue(line, "dport")

	if srcIP == "" || dstIP == "" {
		return event, false
	}

	event.SrcIP = srcIP
	event.DstIP = dstIP

	if srcPort != "" {
		event.SrcPort, _ = strconv.Atoi(srcPort)
	}
	if dstPort != "" {
		event.DstPort, _ = strconv.Atoi(dstPort)
	}

	// Parse state (if present)
	stateRegex := regexp.MustCompile(`\b(ESTABLISHED|SYN_SENT|SYN_RECV|FIN_WAIT|CLOSE_WAIT|LAST_ACK|TIME_WAIT|CLOSE|LISTEN)\b`)
	if match := stateRegex.FindString(line); match != "" {
		event.State = match
	}

	// Parse bytes (if present)
	if bytes := extractValue(line, "bytes"); bytes != "" {
		event.Bytes, _ = strconv.ParseInt(bytes, 10, 64)
	}

	// Parse packets (if present)
	if packets := extractValue(line, "packets"); packets != "" {
		event.Packets, _ = strconv.ParseInt(packets, 10, 64)
	}

	return event, true
}

// extractValue extracts a value from a key=value string
func extractValue(line, key string) string {
	pattern := key + "=([^ ]+)"
	re := regexp.MustCompile(pattern)
	match := re.FindStringSubmatch(line)
	if len(match) > 1 {
		return match[1]
	}
	return ""
}

// GetActiveConnections returns current active connections (one-time query)
func (c *ConntrackCollector) GetActiveConnections() ([]ConntrackEvent, error) {
	cmd := exec.Command("conntrack", "-L", "-o", "extended")
	output, err := cmd.Output()
	if err != nil {
		return nil, err
	}

	var events []ConntrackEvent
	scanner := bufio.NewScanner(strings.NewReader(string(output)))

	for scanner.Scan() {
		line := scanner.Text()
		event, ok := parseConntrackListLine(line)
		if ok {
			events = append(events, event)
			if len(events) >= c.maxConnections {
				break
			}
		}
	}

	return events, nil
}

// parseConntrackListLine parses a line from conntrack -L output
func parseConntrackListLine(line string) (ConntrackEvent, bool) {
	event := ConntrackEvent{}
	event.Action = "ACTIVE" // For list output

	// Example: tcp 6 431999 ESTABLISHED src=192.168.1.100 dst=8.8.8.8 sport=54321 dport=443 ...
	parts := strings.Fields(line)
	if len(parts) < 4 {
		return event, false
	}

	event.Protocol = parts[0]

	// Find state
	for _, p := range parts {
		if p == "ESTABLISHED" || p == "SYN_SENT" || p == "FIN_WAIT" || p == "TIME_WAIT" {
			event.State = p
			break
		}
	}

	// Parse key=value pairs
	event.SrcIP = extractValue(line, "src")
	event.DstIP = extractValue(line, "dst")

	if event.SrcIP == "" || event.DstIP == "" {
		return event, false
	}

	if srcPort := extractValue(line, "sport"); srcPort != "" {
		event.SrcPort, _ = strconv.Atoi(srcPort)
	}
	if dstPort := extractValue(line, "dport"); dstPort != "" {
		event.DstPort, _ = strconv.Atoi(dstPort)
	}

	if bytes := extractValue(line, "bytes"); bytes != "" {
		event.Bytes, _ = strconv.ParseInt(bytes, 10, 64)
	}
	if packets := extractValue(line, "packets"); packets != "" {
		event.Packets, _ = strconv.ParseInt(packets, 10, 64)
	}

	return event, true
}
