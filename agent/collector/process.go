package collector

import (
	"sort"
	"strings"
    "os/exec"

	"github.com/shirou/gopsutil/v3/process"
)

type ProcessInfo struct {
	PID           int32   `json:"pid"`
	Name          string  `json:"name"`
	Username      string  `json:"username"`
	CPUPercent    float64 `json:"cpu_percent"`
	MemoryPercent float64 `json:"memory_percent"`
	Cmdline       string  `json:"cmdline"`
}

type ProcessCollector struct{}

func NewProcessCollector() *ProcessCollector {
	return &ProcessCollector{}
}

func (c *ProcessCollector) Collect() ([]ProcessInfo, error) {
	procs, err := process.Processes()
	if err != nil {
		return nil, err
	}

	var results []ProcessInfo
	for _, p := range procs {
		name, _ := p.Name()
		user, _ := p.Username()
		cpuP, _ := p.CPUPercent()
		memP, _ := p.MemoryPercent()
		cmd, _ := p.Cmdline()

		if len(cmd) > 100 {
			cmd = cmd[:100] + "..."
		}

		results = append(results, ProcessInfo{
			PID:           p.Pid,
			Name:          name,
			Username:      user,
			CPUPercent:    cpuP,
			MemoryPercent: float64(memP),
			Cmdline:       strings.TrimSpace(cmd),
		})
	}

	// Sort by CPU usage and take top 50
	sort.Slice(results, func(i, j int) bool {
		return results[i].CPUPercent > results[j].CPUPercent
	})

	if len(results) > 50 {
		results = results[:50]
	}

    return results, nil
}

func (c *ProcessCollector) CollectRaw() (string, error) {
    // Use top -b -n 1
    // Hardcoded absolute path to avoid PATH issues in cron/nohup env
    // Also include TERM environment variable just in case
    
    cmd := exec.Command("bash", "-c", "TERM=xterm /usr/bin/top -b -n 1 -w 512 | head -n 20")
    
    out, err := cmd.Output()
    if err != nil {
        return "", err
    }
    
    if len(out) == 0 {
         return "No output from top command", nil
    }

    return string(out), nil
}
