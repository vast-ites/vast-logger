package services

import (
	"encoding/json"
	"fmt"
	"os/exec"
	"time"
)

// PM2Process represents a single PM2-managed process
type PM2Process struct {
	Name      string  `json:"name"`
	PID       int     `json:"pid"`
	PMID      int     `json:"pm_id"`
	Status    string  `json:"status"`
	CPU       float64 `json:"cpu"`
	Memory    int64   `json:"memory"`
	Uptime    int64   `json:"uptime"`
	Restarts  int     `json:"restarts"`
	Instances int     `json:"instances"`
	ExecMode  string  `json:"exec_mode"`
	NodeVersion string `json:"node_version,omitempty"`
}

// PM2Stats represents the collected PM2 metrics
type PM2Stats struct {
	Timestamp     time.Time    `json:"timestamp"`
	TotalProcesses int         `json:"total_processes"`
	OnlineCount   int          `json:"online_count"`
	ErrorCount    int          `json:"error_count"`
	StoppedCount  int          `json:"stopped_count"`
	TotalMemory   int64        `json:"total_memory"`
	TotalCPU      float64      `json:"total_cpu"`
	TotalRestarts int          `json:"total_restarts"`
	Processes     []PM2Process `json:"processes"`
}

// PM2Collector collects metrics from PM2 process manager
type PM2Collector struct{}

// NewPM2Collector creates a new PM2 collector
func NewPM2Collector() *PM2Collector {
	return &PM2Collector{}
}

// GetStats collects PM2 process list via `pm2 jlist`
func (c *PM2Collector) GetStats() (*PM2Stats, error) {
	// Execute pm2 jlist to get JSON output of all processes
	out, err := exec.Command("pm2", "jlist").Output()
	if err != nil {
		return nil, fmt.Errorf("failed to run pm2 jlist: %w", err)
	}

	// Parse the JSON output
	var rawProcesses []struct {
		Name string `json:"name"`
		PID  int    `json:"pid"`
		PMID int    `json:"pm_id"`
		PM2Env struct {
			Status      string  `json:"status"`
			PMUptime    int64   `json:"pm_uptime"`
			RestartTime int     `json:"restart_time"`
			Instances   int     `json:"instances"`
			ExecMode    string  `json:"exec_mode"`
			NodeVersion string  `json:"node_version"`
		} `json:"pm2_env"`
		Monit struct {
			Memory int64   `json:"memory"`
			CPU    float64 `json:"cpu"`
		} `json:"monit"`
	}

	if err := json.Unmarshal(out, &rawProcesses); err != nil {
		return nil, fmt.Errorf("failed to parse pm2 output: %w", err)
	}

	stats := &PM2Stats{
		Timestamp:  time.Now(),
		Processes:  make([]PM2Process, 0, len(rawProcesses)),
	}

	now := time.Now().UnixMilli()
	for _, rp := range rawProcesses {
		proc := PM2Process{
			Name:        rp.Name,
			PID:         rp.PID,
			PMID:        rp.PMID,
			Status:      rp.PM2Env.Status,
			CPU:         rp.Monit.CPU,
			Memory:      rp.Monit.Memory,
			Restarts:    rp.PM2Env.RestartTime,
			Instances:   rp.PM2Env.Instances,
			ExecMode:    rp.PM2Env.ExecMode,
			NodeVersion: rp.PM2Env.NodeVersion,
		}

		// Calculate uptime in seconds from pm_uptime (epoch ms)
		if rp.PM2Env.PMUptime > 0 {
			proc.Uptime = (now - rp.PM2Env.PMUptime) / 1000
		}

		stats.Processes = append(stats.Processes, proc)
		stats.TotalMemory += rp.Monit.Memory
		stats.TotalCPU += rp.Monit.CPU
		stats.TotalRestarts += rp.PM2Env.RestartTime

		switch rp.PM2Env.Status {
		case "online":
			stats.OnlineCount++
		case "errored":
			stats.ErrorCount++
		case "stopped":
			stats.StoppedCount++
		}
	}

	stats.TotalProcesses = len(rawProcesses)

	return stats, nil
}
