package collector

import (
	"bytes"
	"crypto/tls"
	"encoding/json"
	"log"
	"net/http"
	"time"

	"github.com/shirou/gopsutil/v3/net"
	"github.com/shirou/gopsutil/v3/process"
)

type ConnectionEntry struct {
	Timestamp   time.Time `json:"timestamp"`
	LocalIP     string    `json:"local_ip"`
	LocalPort   uint16    `json:"local_port"`
	RemoteIP    string    `json:"remote_ip"`
	RemotePort  uint16    `json:"remote_port"`
	Status      string    `json:"status"`
	PID         int32     `json:"pid"`
	ProcessName string    `json:"process_name"`
}

type ConnectionCollector struct {
	ServerURL    string
	Host         string
	AgentSecret  string
	Interval     time.Duration
	ProcessCache map[int32]string
	httpClient   *http.Client
}

func NewConnectionCollector(serverURL, host, agentSecret string) *ConnectionCollector {
	return &ConnectionCollector{
		ServerURL:    serverURL,
		Host:         host,
		AgentSecret:  agentSecret,
		Interval:     1 * time.Second, // 1s Interval (High Frequency)
		ProcessCache: make(map[int32]string),
		httpClient: &http.Client{
			Timeout: 5 * time.Second,
			Transport: &http.Transport{
				TLSClientConfig: &tls.Config{InsecureSkipVerify: true},
			},
		},
	}
}

func (c *ConnectionCollector) Start() {
	ticker := time.NewTicker(c.Interval)
	for range ticker.C {
		c.collect()
	}
}

func (c *ConnectionCollector) collect() {
	// 1. Get Connections from gopsutil
	conns, err := net.Connections("tcp")
	if err != nil {
		log.Printf("[WARN] Failed to get connections: %v", err)
		return
	}

	var entries []ConnectionEntry
	now := time.Now()

	for _, conn := range conns {
		pName := c.resolveProcessName(conn.Pid)

		entries = append(entries, ConnectionEntry{
			Timestamp:   now,
			LocalIP:     conn.Laddr.IP,
			LocalPort:   uint16(conn.Laddr.Port),
			RemoteIP:    conn.Raddr.IP,
			RemotePort:  uint16(conn.Raddr.Port),
			Status:      conn.Status,
			PID:         conn.Pid,
			ProcessName: pName,
		})
	}

	if len(entries) > 0 {
		c.send(entries)
	}
}

func (c *ConnectionCollector) resolveProcessName(pid int32) string {
	if pid == 0 {
		return "kernel"
	}
	if name, ok := c.ProcessCache[pid]; ok {
		return name
	}

	p, err := process.NewProcess(pid)
	if err != nil {
		return ""
	}
	name, err := p.Name()
	if err != nil {
		return ""
	}

	c.ProcessCache[pid] = name
	return name
}

func (c *ConnectionCollector) send(entries []ConnectionEntry) {
	payload := map[string]interface{}{
		"host":        c.Host,
		"connections": entries,
	}

	data, err := json.Marshal(payload)
	if err != nil {
		return
	}

	req, err := http.NewRequest("POST", c.ServerURL+"/api/v1/ingest/connections", bytes.NewBuffer(data))
	if err != nil {
		log.Printf("[WARN] Failed to create connection request: %v", err)
		return
	}
	req.Header.Set("Content-Type", "application/json")
	if c.AgentSecret != "" {
		req.Header.Set("X-Agent-Secret", c.AgentSecret)
	}

	resp, err := c.httpClient.Do(req)
	if err != nil {
		log.Printf("[WARN] Failed to send connections: %v", err)
		return
	}
	defer resp.Body.Close()
}
