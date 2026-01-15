package main

import (
	"fmt"
	"log"
	"time"

	"github.com/datavast/datavast/agent/collector"
	"github.com/datavast/datavast/agent/discovery"
	"github.com/datavast/datavast/agent/sender"
)

func main() {
	fmt.Println("🚀 DataVast Agent Starting... [Sci-Fi Mode]")
	fmt.Println(">> Initializing Universal Log Discovery...")

	// 1. Run Log Discovery
	logs, err := discovery.FindLogs()
	if err != nil {
		log.Printf("Error discovering logs: %v", err)
	}
	
	fmt.Printf(">> Discovered %d potential log sources:\n", len(logs))
	for i, l := range logs {
		if i < 5 {
			fmt.Printf("   [%s] %s (Process: %s)\n", l.SourceType, l.Path, l.ProcessName)
		}
	}
	if len(logs) > 5 {
		fmt.Printf("   ... and %d more.\n", len(logs)-5)
	}

	// 2. Start Log Tailers
	logChan := make(chan collector.LogLine, 100)
	senderClient := sender.NewClient("http://localhost:8080/api/v1")

	fmt.Println(">> Starting Log Tailers...")
	// Limit to top 5 logs for prototype to avoid resource exhaustion
	limit := 5
	if len(logs) < limit {
		limit = len(logs)
	}
	
	for i := 0; i < limit; i++ {
		fmt.Printf(">> Tailing: %s\n", logs[i].Path)
		go collector.TailFile(logs[i].Path, logChan)
	}

	// Log Sender Routine
	go func() {
		for l := range logChan {
			// Debug print
			// fmt.Printf(">> Sending log from %s\n", l.Path)
			if err := senderClient.SendLog(&l); err != nil {
				// Silent fail on single log error to avoid noise
			}
		}
	}()

	// 3. Start Metric Loop
    
    // Initialize Docker Collector
    dockerCol, err := collector.NewDockerCollector()
    if err != nil {
        log.Printf("Warning: Failed to initialize Docker Collector: %v", err)
    } else {
        fmt.Println(">> Docker Collector Initialized (Connected to /var/run/docker.sock)")
    }

	fmt.Println(">> Starting System Metrics Collector (1s interval)...")
    
    sysCol := collector.NewSystemCollector()
	ticker := time.NewTicker(1 * time.Second)
	defer ticker.Stop()

	for range ticker.C {
		metrics, err := sysCol.Collect()
		if err != nil {
			log.Printf("Error collecting metrics: %v", err)
			continue
		}
        
        // Collect Docker Metrics
        var containerMetrics []collector.ContainerMetric
        if dockerCol != nil {
            cMetrics, err := dockerCol.GetContainerMetrics()
            if err != nil {
                log.Printf("Error collecting container metrics: %v", err)
            } else {
                containerMetrics = cMetrics
            }
        }

		// Send to Backend
		if err := senderClient.SendMetrics(metrics, containerMetrics); err != nil {
			log.Printf("Failed to send metrics: %v", err)
		} else {
			// Success feedback (verbose for prototype)
			// fmt.Print(".")
            fmt.Printf("\r>> CPU: %.1f%% | Mem: %.1f%% | NetRecv: %d | DoD: %s | Containers: %d  ", 
                metrics.CPUPercent, metrics.MemoryUsage, metrics.BytesRecv, metrics.DDoSStatus, len(containerMetrics))
		}
	}
}
