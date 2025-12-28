package main

import (
	"os"
	"os/exec"
	"strings"

	"gopkg.in/yaml.v3"
)

// Config holds the agent configuration
type Config struct {
	ServerURL   string `yaml:"server_url"`
	RouterID    string `yaml:"router_id"`
	RouterName  string `yaml:"router_name"`
	Role        string `yaml:"role"` // "main" or "ap"

	// Performance tuning
	BatchInterval     int  `yaml:"batch_interval"`      // ms between batches
	StatsInterval     int  `yaml:"stats_interval"`      // ms between stats updates
	ConntrackEnabled  bool `yaml:"conntrack_enabled"`   // stream conntrack events
	TrafficEnabled    bool `yaml:"traffic_enabled"`     // poll nlbwmon traffic data
	MaxConnections    int  `yaml:"max_connections"`     // limit tracked connections
	DeviceEnabled     bool `yaml:"device_enabled"`      // track device presence
}

// LoadConfig loads configuration from a YAML file
func LoadConfig(path string) (*Config, error) {
	// First try to read from UCI (OpenWrt config system)
	cfg, err := loadFromUCI()
	if err == nil && cfg.ServerURL != "" {
		return cfg, nil
	}

	// Fall back to YAML file
	data, err := os.ReadFile(path)
	if err != nil {
		return nil, err
	}

	cfg = &Config{}
	if err := yaml.Unmarshal(data, cfg); err != nil {
		return nil, err
	}

	return cfg, nil
}

// loadFromUCI reads configuration from OpenWrt's UCI system
func loadFromUCI() (*Config, error) {
	cfg := &Config{}

	// Try to read UCI values
	cfg.ServerURL = uciGet("netmon.main.server_url")
	cfg.RouterID = uciGet("netmon.main.router_id")
	cfg.RouterName = uciGet("netmon.main.router_name")
	cfg.Role = uciGet("netmon.main.role")

	// Parse boolean/integer values
	cfg.ConntrackEnabled = uciGet("netmon.main.conntrack_enabled") != "0"
	cfg.TrafficEnabled = uciGet("netmon.main.traffic_enabled") != "0"
	cfg.DeviceEnabled = uciGet("netmon.main.device_enabled") != "0"

	if batchStr := uciGet("netmon.main.batch_interval"); batchStr != "" {
		cfg.BatchInterval = parseInt(batchStr, 100)
	}
	if statsStr := uciGet("netmon.main.stats_interval"); statsStr != "" {
		cfg.StatsInterval = parseInt(statsStr, 10000)
	}
	if maxStr := uciGet("netmon.main.max_connections"); maxStr != "" {
		cfg.MaxConnections = parseInt(maxStr, 1000)
	}

	return cfg, nil
}

// uciGet reads a value from UCI
func uciGet(key string) string {
	cmd := exec.Command("uci", "get", key)
	output, err := cmd.Output()
	if err != nil {
		return ""
	}
	return strings.TrimSpace(string(output))
}

// parseInt parses an integer with a default fallback
func parseInt(s string, defaultVal int) int {
	var val int
	if _, err := os.Stdout.WriteString(""); err == nil {
		// Use fmt.Sscanf equivalent
		for i, c := range s {
			if c < '0' || c > '9' {
				if i == 0 {
					return defaultVal
				}
				break
			}
			val = val*10 + int(c-'0')
		}
		if val == 0 && s != "0" {
			return defaultVal
		}
	}
	return val
}

// ApplyDefaults sets default values based on role
func (c *Config) ApplyDefaults() {
	if c.Role == "" {
		c.Role = "main"
	}

	// Apply defaults based on role
	if c.Role == "ap" {
		// AP mode: lighter defaults
		if c.BatchInterval == 0 {
			c.BatchInterval = 500
		}
		if c.StatsInterval == 0 {
			c.StatsInterval = 30000
		}
		if c.MaxConnections == 0 {
			c.MaxConnections = 100
		}
		// AP mode typically doesn't need full conntrack/traffic
		// These can be explicitly enabled if needed
	} else {
		// Main router: full defaults
		if c.BatchInterval == 0 {
			c.BatchInterval = 100
		}
		if c.StatsInterval == 0 {
			c.StatsInterval = 10000
		}
		if c.MaxConnections == 0 {
			c.MaxConnections = 1000
		}
		c.ConntrackEnabled = true
		c.TrafficEnabled = true
	}

	// Always enable device tracking
	c.DeviceEnabled = true
}
