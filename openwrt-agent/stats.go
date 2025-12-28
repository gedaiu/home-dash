package main

import (
	"os"
	"os/exec"
	"regexp"
	"strconv"
	"strings"
)

// SystemStats represents system statistics
type SystemStats struct {
	Router      string    `json:"router"`
	IP          string    `json:"ip,omitempty"`
	CPU         CPUStats  `json:"cpu"`
	Memory      MemStats  `json:"memory"`
	Uptime      int64     `json:"uptime"`
	Temps       []TempReading `json:"temps,omitempty"`
	LoadAvg     []float64 `json:"load_avg"`
}

// CPUStats represents CPU statistics
type CPUStats struct {
	User    float64 `json:"user"`
	System  float64 `json:"system"`
	Idle    float64 `json:"idle"`
	Usage   float64 `json:"usage"` // 100 - idle
}

// MemStats represents memory statistics
type MemStats struct {
	Total     int64   `json:"total"`
	Used      int64   `json:"used"`
	Free      int64   `json:"free"`
	Buffers   int64   `json:"buffers"`
	Cached    int64   `json:"cached"`
	Available int64   `json:"available"`
	Percent   float64 `json:"percent"`
}

// TempReading represents a temperature sensor reading
type TempReading struct {
	Name  string  `json:"name"`
	Value float64 `json:"value"` // Celsius
}

// StatsCollector collects system statistics
type StatsCollector struct {
	routerID string
	prevCPU  []int64
}

// NewStatsCollector creates a new stats collector
func NewStatsCollector(routerID string) *StatsCollector {
	return &StatsCollector{
		routerID: routerID,
	}
}

// Collect gathers system statistics
func (c *StatsCollector) Collect() (*SystemStats, error) {
	stats := &SystemStats{
		Router: c.routerID,
	}

	// Get router's IP address
	stats.IP = c.getRouterIP()

	// Get CPU stats
	cpu, err := c.getCPUStats()
	if err == nil {
		stats.CPU = cpu
	}

	// Get memory stats
	mem, err := c.getMemStats()
	if err == nil {
		stats.Memory = mem
	}

	// Get uptime
	stats.Uptime = c.getUptime()

	// Get load average
	stats.LoadAvg = c.getLoadAvg()

	// Get temperatures
	stats.Temps = c.getTemperatures()

	return stats, nil
}

// getRouterIP gets the router's primary IP address
func (c *StatsCollector) getRouterIP() string {
	// Try ubus first (OpenWrt)
	cmd := exec.Command("ubus", "call", "network.interface.lan", "status")
	output, err := cmd.Output()
	if err == nil {
		ip := extractIPFromUbus(string(output))
		if ip != "" {
			return ip
		}
	}

	// Fallback: use ip command
	cmd = exec.Command("ip", "-4", "addr", "show", "br-lan")
	output, err = cmd.Output()
	if err == nil {
		ip := extractIPFromIpCmd(string(output))
		if ip != "" {
			return ip
		}
	}

	// Try eth0 if br-lan doesn't exist
	cmd = exec.Command("ip", "-4", "addr", "show", "eth0")
	output, err = cmd.Output()
	if err == nil {
		ip := extractIPFromIpCmd(string(output))
		if ip != "" {
			return ip
		}
	}

	return ""
}

// extractIPFromUbus extracts IP from ubus network.interface.lan status output
func extractIPFromUbus(output string) string {
	// Look for "address": "x.x.x.x" pattern
	re := regexp.MustCompile(`"address"\s*:\s*"(\d+\.\d+\.\d+\.\d+)"`)
	match := re.FindStringSubmatch(output)
	if len(match) > 1 {
		return match[1]
	}
	return ""
}

// extractIPFromIpCmd extracts IP from 'ip addr show' output
func extractIPFromIpCmd(output string) string {
	// Look for inet x.x.x.x/xx pattern
	re := regexp.MustCompile(`inet\s+(\d+\.\d+\.\d+\.\d+)/`)
	match := re.FindStringSubmatch(output)
	if len(match) > 1 {
		return match[1]
	}
	return ""
}

// getCPUStats reads CPU statistics
func (c *StatsCollector) getCPUStats() (CPUStats, error) {
	stats := CPUStats{}

	data, err := os.ReadFile("/proc/stat")
	if err != nil {
		return stats, err
	}

	lines := strings.Split(string(data), "\n")
	for _, line := range lines {
		if strings.HasPrefix(line, "cpu ") {
			fields := strings.Fields(line)
			if len(fields) >= 5 {
				user, _ := strconv.ParseInt(fields[1], 10, 64)
				nice, _ := strconv.ParseInt(fields[2], 10, 64)
				system, _ := strconv.ParseInt(fields[3], 10, 64)
				idle, _ := strconv.ParseInt(fields[4], 10, 64)

				current := []int64{user + nice, system, idle}

				if c.prevCPU != nil {
					userDiff := float64(current[0] - c.prevCPU[0])
					systemDiff := float64(current[1] - c.prevCPU[1])
					idleDiff := float64(current[2] - c.prevCPU[2])
					total := userDiff + systemDiff + idleDiff

					if total > 0 {
						stats.User = (userDiff / total) * 100
						stats.System = (systemDiff / total) * 100
						stats.Idle = (idleDiff / total) * 100
						stats.Usage = 100 - stats.Idle
					}
				}

				c.prevCPU = current
			}
			break
		}
	}

	return stats, nil
}

// getMemStats reads memory statistics
func (c *StatsCollector) getMemStats() (MemStats, error) {
	stats := MemStats{}

	data, err := os.ReadFile("/proc/meminfo")
	if err != nil {
		return stats, err
	}

	lines := strings.Split(string(data), "\n")
	for _, line := range lines {
		parts := strings.Fields(line)
		if len(parts) >= 2 {
			value, _ := strconv.ParseInt(parts[1], 10, 64)
			value *= 1024 // Convert from KB to bytes

			switch {
			case strings.HasPrefix(line, "MemTotal:"):
				stats.Total = value
			case strings.HasPrefix(line, "MemFree:"):
				stats.Free = value
			case strings.HasPrefix(line, "MemAvailable:"):
				stats.Available = value
			case strings.HasPrefix(line, "Buffers:"):
				stats.Buffers = value
			case strings.HasPrefix(line, "Cached:"):
				stats.Cached = value
			}
		}
	}

	// Calculate used memory
	if stats.Available > 0 {
		stats.Used = stats.Total - stats.Available
	} else {
		stats.Used = stats.Total - stats.Free - stats.Buffers - stats.Cached
	}

	// Calculate percentage
	if stats.Total > 0 {
		stats.Percent = (float64(stats.Used) / float64(stats.Total)) * 100
	}

	return stats, nil
}

// getUptime reads system uptime in seconds
func (c *StatsCollector) getUptime() int64 {
	data, err := os.ReadFile("/proc/uptime")
	if err != nil {
		return 0
	}

	parts := strings.Fields(string(data))
	if len(parts) > 0 {
		uptime, _ := strconv.ParseFloat(parts[0], 64)
		return int64(uptime)
	}

	return 0
}

// getLoadAvg reads load average
func (c *StatsCollector) getLoadAvg() []float64 {
	data, err := os.ReadFile("/proc/loadavg")
	if err != nil {
		return nil
	}

	parts := strings.Fields(string(data))
	if len(parts) >= 3 {
		load1, _ := strconv.ParseFloat(parts[0], 64)
		load5, _ := strconv.ParseFloat(parts[1], 64)
		load15, _ := strconv.ParseFloat(parts[2], 64)
		return []float64{load1, load5, load15}
	}

	return nil
}

// getTemperatures reads temperature sensors
func (c *StatsCollector) getTemperatures() []TempReading {
	var temps []TempReading

	// Check thermal zones
	entries, err := os.ReadDir("/sys/class/thermal")
	if err != nil {
		return temps
	}

	for _, entry := range entries {
		if !strings.HasPrefix(entry.Name(), "thermal_zone") {
			continue
		}

		zonePath := "/sys/class/thermal/" + entry.Name()

		// Read temperature
		tempData, err := os.ReadFile(zonePath + "/temp")
		if err != nil {
			continue
		}

		tempVal, err := strconv.ParseInt(strings.TrimSpace(string(tempData)), 10, 64)
		if err != nil {
			continue
		}

		// Temperature is in millidegrees Celsius
		tempCelsius := float64(tempVal) / 1000.0

		// Try to get sensor name
		name := entry.Name()
		typeData, err := os.ReadFile(zonePath + "/type")
		if err == nil {
			name = strings.TrimSpace(string(typeData))
		}

		temps = append(temps, TempReading{
			Name:  name,
			Value: tempCelsius,
		})
	}

	return temps
}
