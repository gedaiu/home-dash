package main

import (
	"encoding/json"
	"log"
	"sync"
	"time"
)

// Message types
const (
	TypeConntrack = "conntrack"
	TypeDevice    = "device"
	TypeStats     = "stats"
	TypeTraffic   = "traffic"
)

// Message represents a message sent to the server
type Message struct {
	Type     string      `json:"type"`
	Router   string      `json:"router"`
	Time     int64       `json:"time"`
	Data     interface{} `json:"data"`
}

// Agent manages data collection and server communication
type Agent struct {
	config    *Config
	ws        *WebSocketClient
	stopChan  chan struct{}
	wg        sync.WaitGroup

	// Data collectors
	conntrack *ConntrackCollector
	devices   *DeviceCollector
	stats     *StatsCollector

	// Message batching
	msgChan   chan Message
	batchLock sync.Mutex
	batch     []Message
}

// NewAgent creates a new agent instance
func NewAgent(cfg *Config) *Agent {
	return &Agent{
		config:   cfg,
		stopChan: make(chan struct{}),
		msgChan:  make(chan Message, 1000),
		batch:    make([]Message, 0, 100),
	}
}

// Run starts the agent
func (a *Agent) Run() {
	log.Println("Starting agent...")

	// Initialize WebSocket client
	a.ws = NewWebSocketClient(a.config.ServerURL, a.config.RouterID)

	// Start WebSocket connection in background
	a.wg.Add(1)
	go func() {
		defer a.wg.Done()
		a.ws.Run(a.stopChan)
	}()

	// Start collectors based on config
	if a.config.DeviceEnabled {
		a.devices = NewDeviceCollector(a.config.RouterID)
		a.wg.Add(1)
		go func() {
			defer a.wg.Done()
			a.runDeviceCollector()
		}()
	}

	if a.config.ConntrackEnabled {
		a.conntrack = NewConntrackCollector(a.config.RouterID, a.config.MaxConnections)
		a.wg.Add(1)
		go func() {
			defer a.wg.Done()
			a.runConntrackCollector()
		}()
	}

	// Always collect stats
	a.stats = NewStatsCollector(a.config.RouterID)
	a.wg.Add(1)
	go func() {
		defer a.wg.Done()
		a.runStatsCollector()
	}()

	// Start message batcher
	a.wg.Add(1)
	go func() {
		defer a.wg.Done()
		a.runBatcher()
	}()

	log.Println("Agent running")
}

// Stop stops the agent gracefully
func (a *Agent) Stop() {
	log.Println("Stopping agent...")
	close(a.stopChan)
	a.wg.Wait()
	if a.ws != nil {
		a.ws.Close()
	}
}

// SendMessage queues a message for sending
func (a *Agent) SendMessage(msg Message) {
	select {
	case a.msgChan <- msg:
	default:
		log.Println("Warning: message queue full, dropping message")
	}
}

// runBatcher batches messages and sends them periodically
func (a *Agent) runBatcher() {
	ticker := time.NewTicker(time.Duration(a.config.BatchInterval) * time.Millisecond)
	defer ticker.Stop()

	for {
		select {
		case <-a.stopChan:
			// Send any remaining messages
			a.flushBatch()
			return
		case msg := <-a.msgChan:
			a.batchLock.Lock()
			a.batch = append(a.batch, msg)
			a.batchLock.Unlock()
		case <-ticker.C:
			a.flushBatch()
		}
	}
}

// flushBatch sends all batched messages
func (a *Agent) flushBatch() {
	a.batchLock.Lock()
	if len(a.batch) == 0 {
		a.batchLock.Unlock()
		return
	}
	messages := a.batch
	a.batch = make([]Message, 0, 100)
	a.batchLock.Unlock()

	// Group messages by type
	grouped := make(map[string][]interface{})
	for _, msg := range messages {
		grouped[msg.Type] = append(grouped[msg.Type], msg.Data)
	}

	// Send grouped messages
	for msgType, data := range grouped {
		envelope := map[string]interface{}{
			"type":   msgType,
			"router": a.config.RouterID,
			"name":   a.config.RouterName,
			"role":   a.config.Role,
			"time":   time.Now().UnixMilli(),
			"data":   data,
		}

		jsonData, err := json.Marshal(envelope)
		if err != nil {
			log.Printf("Error marshaling message: %v", err)
			continue
		}

		if err := a.ws.Send(jsonData); err != nil {
			log.Printf("Error sending message: %v", err)
		}
	}
}

// runDeviceCollector periodically collects device information
func (a *Agent) runDeviceCollector() {
	// Initial collection
	a.collectDevices()

	ticker := time.NewTicker(15 * time.Second)
	defer ticker.Stop()

	for {
		select {
		case <-a.stopChan:
			return
		case <-ticker.C:
			a.collectDevices()
		}
	}
}

func (a *Agent) collectDevices() {
	devices, err := a.devices.Collect()
	if err != nil {
		log.Printf("Error collecting devices: %v", err)
		return
	}

	for _, device := range devices {
		a.SendMessage(Message{
			Type:   TypeDevice,
			Router: a.config.RouterID,
			Time:   time.Now().UnixMilli(),
			Data:   device,
		})
	}
}

// runConntrackCollector streams conntrack events
func (a *Agent) runConntrackCollector() {
	eventChan := make(chan ConntrackEvent, 100)

	go func() {
		if err := a.conntrack.Stream(eventChan, a.stopChan); err != nil {
			log.Printf("Conntrack stream error: %v", err)
		}
	}()

	for {
		select {
		case <-a.stopChan:
			return
		case event := <-eventChan:
			a.SendMessage(Message{
				Type:   TypeConntrack,
				Router: a.config.RouterID,
				Time:   time.Now().UnixMilli(),
				Data:   event,
			})
		}
	}
}

// runStatsCollector periodically collects system stats
func (a *Agent) runStatsCollector() {
	// Initial collection
	a.collectStats()

	ticker := time.NewTicker(time.Duration(a.config.StatsInterval) * time.Millisecond)
	defer ticker.Stop()

	for {
		select {
		case <-a.stopChan:
			return
		case <-ticker.C:
			a.collectStats()
		}
	}
}

func (a *Agent) collectStats() {
	stats, err := a.stats.Collect()
	if err != nil {
		log.Printf("Error collecting stats: %v", err)
		return
	}

	// Send stats directly (not batched, as they're periodic)
	envelope := map[string]interface{}{
		"type":   TypeStats,
		"router": a.config.RouterID,
		"name":   a.config.RouterName,
		"role":   a.config.Role,
		"time":   time.Now().UnixMilli(),
		"data":   stats,
	}

	jsonData, err := json.Marshal(envelope)
	if err != nil {
		log.Printf("Error marshaling stats: %v", err)
		return
	}

	if err := a.ws.Send(jsonData); err != nil {
		log.Printf("Error sending stats: %v", err)
	}
}
