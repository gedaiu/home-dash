package main

import (
	"flag"
	"log"
	"os"
	"os/signal"
	"syscall"
	"time"
)

var (
	configPath = flag.String("config", "/etc/netmon/config.yaml", "Path to config file")
	serverURL  = flag.String("server", "", "WebSocket server URL (overrides config)")
	routerID   = flag.String("id", "", "Router ID (overrides config)")
	routerName = flag.String("name", "", "Router name (overrides config)")
	role       = flag.String("role", "main", "Router role: main or ap")
	debug      = flag.Bool("debug", false, "Enable debug logging")
)

func main() {
	flag.Parse()

	log.SetFlags(log.Ltime | log.Lshortfile)
	log.Println("OpenWrt Network Monitor Agent starting...")

	// Load configuration
	cfg, err := LoadConfig(*configPath)
	if err != nil {
		log.Printf("Warning: Could not load config file: %v", err)
		cfg = &Config{}
	}

	// Override with command line flags
	if *serverURL != "" {
		cfg.ServerURL = *serverURL
	}
	if *routerID != "" {
		cfg.RouterID = *routerID
	}
	if *routerName != "" {
		cfg.RouterName = *routerName
	}
	if *role != "" {
		cfg.Role = *role
	}

	// Validate required config
	if cfg.ServerURL == "" {
		log.Fatal("Server URL is required. Use -server flag or set in config file.")
	}
	if cfg.RouterID == "" {
		cfg.RouterID = getHostname()
	}
	if cfg.RouterName == "" {
		cfg.RouterName = cfg.RouterID
	}

	// Set defaults based on role
	cfg.ApplyDefaults()

	log.Printf("Router ID: %s", cfg.RouterID)
	log.Printf("Router Name: %s", cfg.RouterName)
	log.Printf("Role: %s", cfg.Role)
	log.Printf("Server: %s", cfg.ServerURL)

	// Create agent
	agent := NewAgent(cfg)

	// Handle graceful shutdown
	sigChan := make(chan os.Signal, 1)
	signal.Notify(sigChan, syscall.SIGINT, syscall.SIGTERM)

	// Start agent
	go agent.Run()

	// Wait for shutdown signal
	sig := <-sigChan
	log.Printf("Received signal %v, shutting down...", sig)
	agent.Stop()

	// Give time for graceful shutdown
	time.Sleep(500 * time.Millisecond)
	log.Println("Agent stopped")
}

func getHostname() string {
	hostname, err := os.Hostname()
	if err != nil {
		return "unknown"
	}
	return hostname
}
