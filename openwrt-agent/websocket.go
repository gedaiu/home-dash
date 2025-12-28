package main

import (
	"log"
	"sync"
	"time"

	"github.com/gorilla/websocket"
)

// WebSocketClient manages the connection to the server
type WebSocketClient struct {
	url      string
	routerID string
	conn     *websocket.Conn
	mu       sync.Mutex
	connected bool
}

// NewWebSocketClient creates a new WebSocket client
func NewWebSocketClient(url, routerID string) *WebSocketClient {
	return &WebSocketClient{
		url:      url,
		routerID: routerID,
	}
}

// Run maintains the WebSocket connection with auto-reconnect
func (c *WebSocketClient) Run(stopChan chan struct{}) {
	for {
		select {
		case <-stopChan:
			return
		default:
			if err := c.connect(); err != nil {
				log.Printf("WebSocket connection failed: %v", err)
				time.Sleep(5 * time.Second)
				continue
			}

			// Read messages (to detect disconnection)
			c.readLoop(stopChan)

			// Connection lost, try to reconnect
			log.Println("WebSocket disconnected, reconnecting...")
			time.Sleep(2 * time.Second)
		}
	}
}

// connect establishes the WebSocket connection
func (c *WebSocketClient) connect() error {
	c.mu.Lock()
	defer c.mu.Unlock()

	dialer := websocket.Dialer{
		HandshakeTimeout: 10 * time.Second,
	}

	conn, _, err := dialer.Dial(c.url, nil)
	if err != nil {
		return err
	}

	c.conn = conn
	c.connected = true
	log.Printf("WebSocket connected to %s", c.url)

	// Send initial identification
	identify := map[string]string{
		"type":     "identify",
		"router":   c.routerID,
	}
	if err := conn.WriteJSON(identify); err != nil {
		log.Printf("Error sending identification: %v", err)
	}

	return nil
}

// readLoop reads messages from the server
func (c *WebSocketClient) readLoop(stopChan chan struct{}) {
	for {
		select {
		case <-stopChan:
			return
		default:
			c.mu.Lock()
			conn := c.conn
			c.mu.Unlock()

			if conn == nil {
				return
			}

			// Set read deadline
			conn.SetReadDeadline(time.Now().Add(60 * time.Second))

			_, _, err := conn.ReadMessage()
			if err != nil {
				if websocket.IsUnexpectedCloseError(err, websocket.CloseGoingAway, websocket.CloseAbnormalClosure) {
					log.Printf("WebSocket read error: %v", err)
				}
				c.mu.Lock()
				c.connected = false
				c.mu.Unlock()
				return
			}
		}
	}
}

// Send sends data to the server
func (c *WebSocketClient) Send(data []byte) error {
	c.mu.Lock()
	defer c.mu.Unlock()

	if !c.connected || c.conn == nil {
		return nil // Silently drop if not connected
	}

	c.conn.SetWriteDeadline(time.Now().Add(10 * time.Second))
	return c.conn.WriteMessage(websocket.TextMessage, data)
}

// Close closes the WebSocket connection
func (c *WebSocketClient) Close() {
	c.mu.Lock()
	defer c.mu.Unlock()

	if c.conn != nil {
		c.conn.WriteMessage(websocket.CloseMessage, websocket.FormatCloseMessage(websocket.CloseNormalClosure, ""))
		c.conn.Close()
		c.conn = nil
	}
	c.connected = false
}

// IsConnected returns true if connected to server
func (c *WebSocketClient) IsConnected() bool {
	c.mu.Lock()
	defer c.mu.Unlock()
	return c.connected
}
