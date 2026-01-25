package main

import (
	"fmt"
	"time"
    "strings"
	"github.com/shirou/gopsutil/v3/disk"
)

func main() {
	fmt.Println("Checking Disk IO Counters...")
    
    for i := 0; i < 5; i++ {
        counters, err := disk.IOCounters()
        if err != nil {
            fmt.Printf("Error: %v\n", err)
            return
        }
        
        fmt.Printf("--- Sample %d ---\n", i)
        for name, io := range counters {
            // Same filter as Agent
            if strings.HasPrefix(name, "loop") || strings.HasPrefix(name, "ram") { continue }
            fmt.Printf("Disk: %s | Read: %d | Write: %d\n", name, io.ReadBytes, io.WriteBytes)
        }
        time.Sleep(1 * time.Second)
    }
}
