package collector

import (
	"time"

	"github.com/shirou/gopsutil/v3/cpu"
	"github.com/shirou/gopsutil/v3/disk"
	"github.com/shirou/gopsutil/v3/mem"
	"github.com/shirou/gopsutil/v3/net"
)

type SystemMetrics struct {
	CPUPercent  float64 `json:"cpu_percent"`
	MemoryUsage float64 `json:"memory_usage"`
	DiskUsage   float64 `json:"disk_usage"`
	BytesSent   uint64  `json:"bytes_sent"`
	BytesRecv   uint64  `json:"bytes_recv"`
    NetRecvRate float64 `json:"net_recv_rate"` // MB/s
    DDoSStatus  string  `json:"ddos_status"`   // OK, WARNING, CRITICAL
	Timestamp   int64   `json:"timestamp"`
}

type SystemCollector struct {
    lastBytesRecv uint64
    lastTimestamp int64
}

func NewSystemCollector() *SystemCollector {
    return &SystemCollector{}
}

func (sc *SystemCollector) Collect() (*SystemMetrics, error) {
	// CPU
	cpuP, err := cpu.Percent(0, false)
	if err != nil {
		return nil, err
	}

	// Memory
	vMem, err := mem.VirtualMemory()
	if err != nil {
		return nil, err
	}

	// Disk
	diskStat, err := disk.Usage("/")
	if err != nil {
		return nil, err
	}

	// Network
	netStat, err := net.IOCounters(false)
	if err != nil {
		return nil, err
	}
    
    currentBytesRecv := netStat[0].BytesRecv
    currentTimestamp := time.Now().Unix()
    
    // Calculate Rate
    var rateMBps float64
    if sc.lastTimestamp > 0 && currentTimestamp > sc.lastTimestamp {
        deltaBytes := float64(currentBytesRecv - sc.lastBytesRecv)
        deltaTime := float64(currentTimestamp - sc.lastTimestamp)
        rateMBps = (deltaBytes / deltaTime) / (1024 * 1024) // MB/s
    }
    
    // DDoS Heuristic
    status := "OK"
    if rateMBps > 50.0 {
        status = "CRITICAL"
    } else if rateMBps > 10.0 {
        status = "WARNING"
    }
    
    // Update State
    sc.lastBytesRecv = currentBytesRecv
    sc.lastTimestamp = currentTimestamp

	return &SystemMetrics{
		CPUPercent:  cpuP[0],
		MemoryUsage: vMem.UsedPercent,
		DiskUsage:   diskStat.UsedPercent,
		BytesSent:   netStat[0].BytesSent,
		BytesRecv:   currentBytesRecv,
        NetRecvRate: rateMBps,
        DDoSStatus:  status,
		Timestamp:   currentTimestamp,
	}, nil
}
