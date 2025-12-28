package main

import (
	"bufio"
	"os"
	"os/exec"
	"regexp"
	"strconv"
	"strings"
)

// Device represents a network device
type Device struct {
	MAC       string  `json:"mac"`
	IP        string  `json:"ip"`
	Hostname  string  `json:"hostname,omitempty"`
	Interface string  `json:"interface,omitempty"`
	Band      string  `json:"band,omitempty"`      // "2.4GHz", "5GHz", or empty for wired
	Signal    int     `json:"signal,omitempty"`    // dBm for wireless
	IsWired   bool    `json:"is_wired"`
	Online    bool    `json:"online"`
	Router    string  `json:"router"`
}

// DeviceCollector collects device information
type DeviceCollector struct {
	routerID    string
	knownDevices map[string]Device
}

// NewDeviceCollector creates a new device collector
func NewDeviceCollector(routerID string) *DeviceCollector {
	return &DeviceCollector{
		routerID:    routerID,
		knownDevices: make(map[string]Device),
	}
}

// Collect gathers all device information
func (c *DeviceCollector) Collect() ([]Device, error) {
	devices := make(map[string]Device)

	// Get DHCP leases (hostname + IP + MAC mapping)
	leases, err := c.getDHCPLeases()
	if err == nil {
		for _, d := range leases {
			d.Router = c.routerID
			d.Online = true
			devices[d.MAC] = d
		}
	}

	// Get ARP table (may have additional devices)
	arpDevices, err := c.getARPDevices()
	if err == nil {
		for _, d := range arpDevices {
			if existing, ok := devices[d.MAC]; ok {
				// Merge ARP info into existing
				if existing.IP == "" {
					existing.IP = d.IP
				}
				devices[d.MAC] = existing
			} else {
				d.Router = c.routerID
				d.Online = true
				devices[d.MAC] = d
			}
		}
	}

	// Get wireless clients with signal strength
	wifiDevices, err := c.getWiFiClients()
	if err == nil {
		for _, d := range wifiDevices {
			if existing, ok := devices[d.MAC]; ok {
				// Add wireless info
				existing.Interface = d.Interface
				existing.Band = d.Band
				existing.Signal = d.Signal
				existing.IsWired = false
				devices[d.MAC] = existing
			} else {
				d.Router = c.routerID
				d.Online = true
				devices[d.MAC] = d
			}
		}
	}

	// Mark wired devices
	for mac, d := range devices {
		if d.Band == "" && d.Interface == "" {
			d.IsWired = true
			devices[mac] = d
		}
	}

	// Convert to slice
	result := make([]Device, 0, len(devices))
	for _, d := range devices {
		result = append(result, d)
	}

	return result, nil
}

// getDHCPLeases reads DHCP lease information
func (c *DeviceCollector) getDHCPLeases() ([]Device, error) {
	var devices []Device

	// OpenWrt stores DHCP leases in /tmp/dhcp.leases
	file, err := os.Open("/tmp/dhcp.leases")
	if err != nil {
		return nil, err
	}
	defer file.Close()

	scanner := bufio.NewScanner(file)
	for scanner.Scan() {
		line := scanner.Text()
		// Format: <timestamp> <mac> <ip> <hostname> <client-id>
		parts := strings.Fields(line)
		if len(parts) >= 4 {
			device := Device{
				MAC:      strings.ToUpper(parts[1]),
				IP:       parts[2],
				Hostname: parts[3],
			}
			if device.Hostname == "*" {
				device.Hostname = ""
			}
			devices = append(devices, device)
		}
	}

	return devices, nil
}

// getARPDevices reads the ARP table
func (c *DeviceCollector) getARPDevices() ([]Device, error) {
	var devices []Device

	file, err := os.Open("/proc/net/arp")
	if err != nil {
		return nil, err
	}
	defer file.Close()

	scanner := bufio.NewScanner(file)
	// Skip header line
	scanner.Scan()

	for scanner.Scan() {
		line := scanner.Text()
		// Format: IP address HW type Flags HW address Mask Device
		parts := strings.Fields(line)
		if len(parts) >= 6 {
			mac := strings.ToUpper(parts[3])
			// Skip incomplete entries
			if mac == "00:00:00:00:00:00" {
				continue
			}
			device := Device{
				MAC: mac,
				IP:  parts[0],
			}
			devices = append(devices, device)
		}
	}

	return devices, nil
}

// getWiFiClients gets wireless client information
func (c *DeviceCollector) getWiFiClients() ([]Device, error) {
	var devices []Device

	// Get list of wireless interfaces
	interfaces, err := getWirelessInterfaces()
	if err != nil {
		return nil, err
	}

	for _, iface := range interfaces {
		clients, err := getInterfaceClients(iface)
		if err != nil {
			continue
		}
		devices = append(devices, clients...)
	}

	return devices, nil
}

// getWirelessInterfaces returns a list of wireless interface names
func getWirelessInterfaces() ([]string, error) {
	// Try to get interfaces from /sys/class/net
	entries, err := os.ReadDir("/sys/class/net")
	if err != nil {
		return nil, err
	}

	var interfaces []string
	for _, entry := range entries {
		name := entry.Name()
		// Check if it's a wireless interface
		if _, err := os.Stat("/sys/class/net/" + name + "/wireless"); err == nil {
			interfaces = append(interfaces, name)
		}
	}

	// Also check for common OpenWrt naming
	for _, prefix := range []string{"wlan", "ath", "ra"} {
		for i := 0; i < 4; i++ {
			iface := prefix + strconv.Itoa(i)
			if _, err := os.Stat("/sys/class/net/" + iface); err == nil {
				found := false
				for _, existing := range interfaces {
					if existing == iface {
						found = true
						break
					}
				}
				if !found {
					interfaces = append(interfaces, iface)
				}
			}
		}
	}

	return interfaces, nil
}

// getInterfaceClients gets clients connected to a wireless interface
func getInterfaceClients(iface string) ([]Device, error) {
	var devices []Device

	// Use iwinfo to get associated clients
	cmd := exec.Command("iwinfo", iface, "assoclist")
	output, err := cmd.Output()
	if err != nil {
		return nil, err
	}

	// Determine band from interface name or frequency
	band := getBandForInterface(iface)

	// Parse iwinfo output
	// Example:
	// AA:BB:CC:DD:EE:FF  -65 dBm / -95 dBm (SNR 30)  340 ms ago
	//         RX: 866.7 MBit/s, VHT-MCS 9, 80MHz, VHT-NSS 2, short GI
	//         TX: 866.7 MBit/s, VHT-MCS 9, 80MHz, VHT-NSS 2, short GI
	//         expected throughput: 667.5 MBit/s

	macRegex := regexp.MustCompile(`([0-9A-Fa-f]{2}[:-]){5}[0-9A-Fa-f]{2}`)
	signalRegex := regexp.MustCompile(`(-?\d+)\s*dBm`)

	lines := strings.Split(string(output), "\n")
	for _, line := range lines {
		if match := macRegex.FindString(line); match != "" {
			device := Device{
				MAC:       strings.ToUpper(match),
				Interface: iface,
				Band:      band,
				IsWired:   false,
			}

			// Extract signal strength
			if signalMatch := signalRegex.FindStringSubmatch(line); len(signalMatch) > 1 {
				device.Signal, _ = strconv.Atoi(signalMatch[1])
			}

			devices = append(devices, device)
		}
	}

	return devices, nil
}

// getBandForInterface determines the WiFi band for an interface
func getBandForInterface(iface string) string {
	// Try to get frequency from iwinfo
	cmd := exec.Command("iwinfo", iface, "freqlist")
	output, err := cmd.Output()
	if err != nil {
		// Default guess based on interface name
		if strings.Contains(iface, "5") || strings.HasSuffix(iface, "1") {
			return "5GHz"
		}
		return "2.4GHz"
	}

	// Check if 5GHz frequencies are present
	if strings.Contains(string(output), "5.") {
		return "5GHz"
	}
	return "2.4GHz"
}
