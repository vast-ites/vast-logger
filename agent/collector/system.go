package collector

import (
	"time"
    "fmt"
    "runtime"
    "strings"
    "net"


	"github.com/shirou/gopsutil/v3/cpu"
	"github.com/shirou/gopsutil/v3/disk"
	"github.com/shirou/gopsutil/v3/mem"
	gnet "github.com/shirou/gopsutil/v3/net"
)

type InterfaceMetric struct {
    Name      string  `json:"name"`
    BytesSent uint64  `json:"bytes_sent"`
    BytesRecv uint64  `json:"bytes_recv"`
}

type PartitionStat struct {
    MountPoint string  `json:"mount_point"`
    Fstype     string  `json:"fstype"`
    Total      uint64  `json:"total"`
    Used       uint64  `json:"used"`
}

type InterfaceStat struct {
    Name        string `json:"name"`
    IP          string `json:"ip"`
    MAC         string `json:"mac"`
    IsUp        bool   `json:"is_up"` 
    Speed       string `json:"speed"` // derived or raw
}

type SystemMetrics struct {
	CPUPercent  float64 `json:"cpu_percent"`
	CPUCount    int     `json:"cpu_count"`
    CPUPhysical int     `json:"cpu_physical"`
    CPUModel    string  `json:"cpu_model"`
    CPUFreq     float64 `json:"cpu_freq"`
	MemoryUsage float64 `json:"memory_usage"`
	MemoryTotal uint64  `json:"memory_total"`
    SwapUsage   float64 `json:"swap_usage"`
    SwapTotal   uint64  `json:"swap_total"`
	DiskUsage   float64 `json:"disk_usage"`
	DiskTotal   uint64  `json:"disk_total"`
    Partitions  []PartitionStat `json:"partitions"`
	BytesSent   uint64  `json:"bytes_sent"`
	BytesRecv   uint64  `json:"bytes_recv"`
    NetRecvRate float64 `json:"net_recv_rate"`
    NetSentRate float64 `json:"net_sent_rate"`
    DiskReadRate float64 `json:"disk_read_rate"`
    DiskWriteRate float64 `json:"disk_write_rate"`
    DiskReadIOPS float64 `json:"disk_read_iops"`
    DiskWriteIOPS float64 `json:"disk_write_iops"`
    Interfaces  []InterfaceStat `json:"interfaces"`
	DDoSStatus  string  `json:"ddos_status"`   // OK, WARNING, CRITICAL
	Timestamp   int64   `json:"timestamp"`
}

type SystemCollector struct {
    lastBytesRecv uint64
    lastBytesSent uint64
    lastDiskReadBytes uint64
    lastDiskWriteBytes uint64
    lastDiskReadCount uint64
    lastDiskWriteCount uint64
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

	// Network Aggregated
	netStat, err := gnet.IOCounters(false)
	if err != nil {
		return nil, err
	}
    

    
    // Build Interface List (for traffic stats per interface if needed, currently unused in main struct but good for future)
    // Actually we need to match with net.Interfaces() for IPs.
    // The previous code had a loop for InterfaceMetric (simple stats).
    // Now we use net.Interfaces() for detailing.
    
    currentBytesRecv := netStat[0].BytesRecv
    currentBytesSent := netStat[0].BytesSent
    
    // Disk counters
    diskIO, _ := disk.IOCounters() // Returns map[string]IOCountersStat
    var currentReadBytes, currentWriteBytes, currentReadCount, currentWriteCount uint64
    
    currentTimestamp := time.Now().Unix()

    // Debug Log once per minute (roughly)
    if currentTimestamp % 60 == 0 {
         // fmt.Printf("DEBUG DISK MAP: %+v\n", diskIO) -- too verbose for prod, but useful for now
    }

    // Aggregate across all drives
    for k, stat := range diskIO {
        // Skip loop devices or ram
        if strings.HasPrefix(k, "loop") || strings.HasPrefix(k, "ram") { continue }
        
        currentReadBytes += stat.ReadBytes
        currentWriteBytes += stat.WriteBytes
        currentReadCount += stat.ReadCount
        currentWriteCount += stat.WriteCount
    }
    
    // Calculate Rates
    var recvRate, sentRate float64
    var diskReadRate, diskWriteRate float64
    var diskReadIOPS, diskWriteIOPS float64
    
    if sc.lastTimestamp > 0 && currentTimestamp > sc.lastTimestamp {
        deltaTime := float64(currentTimestamp - sc.lastTimestamp)
        
        // Network Rates (MB/s)
        deltaBytesRecv := float64(currentBytesRecv - sc.lastBytesRecv)
        recvRate = (deltaBytesRecv / deltaTime) / (1024 * 1024) 
        
        deltaBytesSent := float64(currentBytesSent - sc.lastBytesSent)
        sentRate = (deltaBytesSent / deltaTime) / (1024 * 1024)
        
        // Disk Rates (MB/s)
        if currentReadBytes >= sc.lastDiskReadBytes {
             diskReadRate = (float64(currentReadBytes - sc.lastDiskReadBytes) / deltaTime) / (1024 * 1024)
        }
        if currentWriteBytes >= sc.lastDiskWriteBytes {
             diskWriteRate = (float64(currentWriteBytes - sc.lastDiskWriteBytes) / deltaTime) / (1024 * 1024)
        }
        
         // DEBUG: Re-enable for diagnosis
        if (currentTimestamp % 10 == 0) || (diskWriteRate > 0) || (currentWriteBytes > sc.lastDiskWriteBytes) {
            fmt.Printf("DEBUG: Cur=%d Last=%d Delta=%d Rate=%.2f TimeDelta=%.2f\n", 
                currentWriteBytes, sc.lastDiskWriteBytes, currentWriteBytes-sc.lastDiskWriteBytes, diskWriteRate, deltaTime)
        }

        // Disk IOPS
        if currentReadCount >= sc.lastDiskReadCount {
            diskReadIOPS = float64(currentReadCount - sc.lastDiskReadCount) / deltaTime
        }
        if currentWriteCount >= sc.lastDiskWriteCount {
            diskWriteIOPS = float64(currentWriteCount - sc.lastDiskWriteCount) / deltaTime
        }
    }
    
    // DDoS Heuristic
    ddosStatus := "OK"
    if recvRate > 50.0 {
        ddosStatus = "CRITICAL"
    } else if recvRate > 10.0 {
        ddosStatus = "WARNING"
    }
    
    // Update State
    // Update State
    sc.lastBytesRecv = currentBytesRecv
    sc.lastBytesSent = currentBytesSent
    sc.lastDiskReadBytes = currentReadBytes
    sc.lastDiskWriteBytes = currentWriteBytes
    sc.lastDiskReadCount = currentReadCount
    sc.lastDiskWriteCount = currentWriteCount
    sc.lastTimestamp = currentTimestamp
    
	// CPU Count (Logical)
	cpuCount, _ := cpu.Counts(true)
    if cpuCount == 0 {
        cpuCount = runtime.NumCPU()
    }

    // CPU Physical
    cpuPhysical, _ := cpu.Counts(false)
    if cpuPhysical == 0 { cpuPhysical = 1 }

    // CPU Model & Freq
    cpuModel := "Unknown"
    cpuFreq := 0.0
    if info, err := cpu.Info(); err == nil && len(info) > 0 {
        cpuModel = info[0].ModelName
        cpuFreq = info[0].Mhz / 1000.0 // Convert to GHz
    }

    // Swap
    vSwap, _ := mem.SwapMemory()

    // Partitions
    var partitions []PartitionStat
    if parts, err := disk.Partitions(false); err == nil {
        for _, p := range parts {
            if strings.HasPrefix(p.Mountpoint, "/snap") || strings.HasPrefix(p.Mountpoint, "/boot") { continue }
            if u, err := disk.Usage(p.Mountpoint); err == nil {
                partitions = append(partitions, PartitionStat{
                    MountPoint: p.Mountpoint,
                    Fstype:     p.Fstype,
                    Total:      u.Total,
                    Used:       u.Used,
                })
            }
        }
    }

    // Network Interfaces
    var interfaces []InterfaceStat
    if ifaces, err := net.Interfaces(); err == nil {
        for _, i := range ifaces {
            // Get IP
            ip := ""
            if addrs, err := i.Addrs(); err == nil {
                for _, addr := range addrs {
                    if ipnet, ok := addr.(*net.IPNet); ok && !ipnet.IP.IsLoopback() {
                        if ipnet.IP.To4() != nil {
                            ip = ipnet.IP.String()
                            break
                        }
                    }
                }
            }
            // If no non-loopback IPv4 found, and it's an up loopback, assign 127.0.0.1
            if ip == "" && (i.Flags&net.FlagUp) != 0 && (i.Flags&net.FlagLoopback) != 0 { ip = "127.0.0.1" }

            interfaces = append(interfaces, InterfaceStat{
                Name: i.Name,
                MAC:  i.HardwareAddr.String(),
                IP:   ip,
                IsUp: (i.Flags & net.FlagUp) != 0,
            })
        }
    }

	return &SystemMetrics{
		CPUPercent:  cpuP[0],
		CPUCount:    cpuCount,
        CPUPhysical: cpuPhysical,
        CPUModel:    cpuModel,
        CPUFreq:     cpuFreq,
		MemoryUsage: vMem.UsedPercent,
		MemoryTotal: vMem.Total,
        SwapUsage:   vSwap.UsedPercent,
        SwapTotal:   vSwap.Total,
		DiskUsage:   diskStat.UsedPercent,
		DiskTotal:   diskStat.Total,
        Partitions:  partitions,
		BytesSent:   currentBytesSent,
		BytesRecv:   currentBytesRecv,
        NetRecvRate: recvRate,
        NetSentRate: sentRate,
        DiskReadRate: diskReadRate,
        DiskWriteRate: diskWriteRate,
        DiskReadIOPS: diskReadIOPS,
        DiskWriteIOPS: diskWriteIOPS,
        Interfaces:  interfaces,
		DDoSStatus:  ddosStatus,
		Timestamp:   currentTimestamp,
	}, nil
}
