package sender

import (
	"bytes"
	"encoding/json"
	"net/http"
	"time"

	"github.com/datavast/datavast/agent/collector"
)

type Client struct {
	BackendURL  string
    AgentSecret string
    Hostname    string
	client      *http.Client
}

func NewClient(backendURL, agentSecret, hostname string) *Client {
	return &Client{
		BackendURL:  backendURL,
        AgentSecret: agentSecret,
        Hostname:    hostname,
		client:      &http.Client{Timeout: 5 * time.Second},
	}
}

func (c *Client) post(endpoint string, data []byte) error {
    req, err := http.NewRequest("POST", c.BackendURL+endpoint, bytes.NewBuffer(data))
    if err != nil {
        return err
    }
    req.Header.Set("Content-Type", "application/json")
    if c.AgentSecret != "" {
        req.Header.Set("X-Agent-Secret", c.AgentSecret)
    }

    resp, err := c.client.Do(req)
    if err != nil {
        return err
    }
    defer resp.Body.Close()
    return nil
}

func (c *Client) SendMetrics(m *collector.SystemMetrics, containers []collector.ContainerMetric) error {
	payload := map[string]interface{}{
        "host":          c.Hostname,
		"cpu_percent":   m.CPUPercent,
		"memory_usage":  m.MemoryUsage,
		"disk_usage":    m.DiskUsage,
		"bytes_sent":    m.BytesSent,
		"bytes_recv":    m.BytesRecv,
        "net_recv_rate": m.NetRecvRate,
        "ddos_status":   m.DDoSStatus,
        "interfaces":    m.Interfaces,
        "containers":    containers,
	}

	data, err := json.Marshal(payload)
	if err != nil {
		return err
	}

	return c.post("/ingest/metrics", data)
}

func (c *Client) SendLog(l *collector.LogLine) error {
	payload := map[string]interface{}{
		"source_path": l.Path,
		"message":     l.Content,
		"timestamp":   l.Timestamp,
		"host":        c.Hostname,
		"service":     "agent",     
		"level":       l.Level,
	}

	data, err := json.Marshal(payload)
	if err != nil {
		return err
	}
	return c.post("/ingest/logs", data)
}

func (c *Client) SendProcesses(procs []collector.ProcessInfo) error {
    payload := map[string]interface{}{
        "host":      c.Hostname,
        "processes": procs,
    }
    data, err := json.Marshal(payload)
    if err != nil {
        return err
    }
    return c.post("/ingest/processes", data)
}

func (c *Client) SendFirewall(rules string) error {
    payload := map[string]interface{}{
        "host":  c.Hostname,
        "rules": rules,
    }
    data, err := json.Marshal(payload)
    if err != nil {
        return err
    }
    return c.post("/ingest/firewall", data)
}
