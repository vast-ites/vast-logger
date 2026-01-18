package sender

import (
	"bytes"
	"encoding/json"
	"net/http"
	"time"

	"github.com/datavast/datavast/agent/collector"
)

type Client struct {
	BackendURL string
	client     *http.Client
}

func NewClient(backendURL string) *Client {
	return &Client{
		BackendURL: backendURL,
		client:     &http.Client{Timeout: 5 * time.Second},
	}
}

func (c *Client) SendMetrics(m *collector.SystemMetrics, containers []collector.ContainerMetric) error {
	payload := map[string]interface{}{
		"cpu_percent":  m.CPUPercent,
		"memory_usage": m.MemoryUsage,
		"disk_usage":   m.DiskUsage,
		"bytes_sent":   m.BytesSent,
		"bytes_recv":   m.BytesRecv,
        "net_recv_rate": m.NetRecvRate,
        "ddos_status":   m.DDoSStatus,
        "interfaces":    m.Interfaces,
        "containers":    containers,
	}

	data, err := json.Marshal(payload)
	if err != nil {
		return err
	}

	resp, err := c.client.Post(c.BackendURL+"/ingest/metrics", "application/json", bytes.NewBuffer(data))
	if err != nil {
		return err
	}
	defer resp.Body.Close()

	return nil
}

func (c *Client) SendLog(l *collector.LogLine) error {
	payload := map[string]interface{}{
		"source_path": l.Path,
		"message":     l.Content,
		"timestamp":   l.Timestamp,
		"host":        "localhost", // Hardcoded for now
		"service":     "agent",     // Hardcoded for now
		"level":       l.Level,
	}

	data, err := json.Marshal(payload)
	if err != nil {
		return err
	}

	// Async send to avoid blocking tailer (conceptually)
	// In production, we'd batch these.
	resp, err := c.client.Post(c.BackendURL+"/ingest/logs", "application/json", bytes.NewBuffer(data))
	if err != nil {
		return err
	}
	defer resp.Body.Close()
	return nil
}
