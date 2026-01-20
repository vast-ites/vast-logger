package main

import (
	"flag"
	"os"
    "fmt"
    "log"
    "time"
	"bufio"
    "strconv"
	"strings"
	"encoding/json"
    "net/http"
    "bytes"

	"github.com/datavast/datavast/agent/collector"
	"github.com/datavast/datavast/agent/discovery"
	"github.com/datavast/datavast/agent/sender"
    "github.com/datavast/datavast/agent/config"
)

func main() {
    setupMode := flag.Bool("setup", false, "Run interactive setup")
    flag.Parse()

	fmt.Println("🚀 DataVast Agent Starting... [Sci-Fi Mode]")
    
    // Load Config
    cfg, err := config.LoadConfig()
    if err != nil {
        // No config
        if *setupMode {
            runSetup()
            return
        }
        
        // Legacy/Env Fallback
        serverURL := os.Getenv("SERVER_URL")
        if serverURL == "" {
            serverURL = "http://localhost:8080"
        }
        fmt.Println(">> No config found. Using Fallback/Env URL:", serverURL)
        fmt.Println(">> Tip: Run './datavast-agent --setup' for secure enrollment.")
        
        cfg = &config.AgentConfig{
             ServerURL: serverURL,
        }
    } else {
        fmt.Println(">> Loaded Config for Agent:", cfg.AgentID)
    }

	// Default to enabled if not set (first run or legacy config)
    if cfg.Collectors == (config.CollectorConfig{}) {
        cfg.Collectors.System = true
        cfg.Collectors.Docker = true
        cfg.LogConfig.Mode = "all"
    }

	fmt.Println(">> Initializing Log Discovery...")
    var logs []discovery.DiscoveredLog
    
    if cfg.LogConfig.Mode != "none" {
        if cfg.LogConfig.Mode == "selected" {
            for _, path := range cfg.LogConfig.SelectedLogs {
                logs = append(logs, discovery.DiscoveredLog{Path: path, SourceType: "manual_selection"})
            }
        } else {
            // Auto Discover "all"
            dLogs, err := discovery.FindLogs()
            if err != nil {
                log.Printf("Error discovering logs: %v", err)
            }
            logs = append(logs, dLogs...)
            
            // Add Enabled Service Logs
            if cfg.Collectors.Nginx { logs = append(logs, discovery.FindServiceLogs("nginx")...) }
            if cfg.Collectors.Apache { logs = append(logs, discovery.FindServiceLogs("apache")...) }
            if cfg.Collectors.PM2 { logs = append(logs, discovery.FindServiceLogs("pm2")...) }
        }
        
        // Dedup
        seen := make(map[string]bool)
        var unique []discovery.DiscoveredLog
        for _, l := range logs {
            if !seen[l.Path] {
                unique = append(unique, l)
                seen[l.Path] = true
            }
        }
        logs = unique
    
    	fmt.Printf(">> Targeting %d log sources:\n", len(logs))
    	for i, l := range logs {
    		if i < 5 {
    			fmt.Printf("   [%s] %s\n", l.SourceType, l.Path)
    		}
    	}
    	if len(logs) > 5 {
    		fmt.Printf("   ... and %d more.\n", len(logs)-5)
    	}
    
    	// 2. Start Log Tailers
    	logChan := make(chan collector.LogLine, 100)
    	// Use Config URL/Secret
    	senderClient := sender.NewClient(strings.TrimSuffix(cfg.ServerURL, "/")+"/api/v1", cfg.AgentSecret, cfg.AgentID)
    
    	fmt.Println(">> Starting Log Tailers...")
    	for _, l := range logs {
    		go collector.TailFile(l.Path, logChan)
    	}
    
    	// Log Sender Routine
    	go func() {
    		for l := range logChan {
    			if err := senderClient.SendLog(&l); err != nil {
    			}
    		}
    	}()
        
        // Keep definition of senderClient visible for below
    }

    // Re-declare senderClient if skipped (ugly hack, better refactor later)
    // Actually simpler: Move senderClient init up.
    senderClient := sender.NewClient(strings.TrimSuffix(cfg.ServerURL, "/")+"/api/v1", cfg.AgentSecret, cfg.AgentID)


	// 3. Start Metric Loop
    
    // Initialize Docker Collector
    var dockerCol *collector.DockerCollector
    if cfg.Collectors.Docker {
        dCol, err := collector.NewDockerCollector()
        if err != nil {
            log.Printf("Warning: Failed to initialize Docker Collector: %v", err)
        } else {
            fmt.Println(">> Docker Collector Initialized")
            dockerCol = dCol
        }
    }

    // Initialize System Collector
    var sysCol *collector.SystemCollector
    if cfg.Collectors.System {
        sysCol = collector.NewSystemCollector()
        fmt.Println(">> Starting System Metrics Collector (1s interval)...")
    }
    
    // Initialize Enhanced Collectors (Process/Firewall)
    procCol := collector.NewProcessCollector()
    fwCol := collector.NewFirewallCollector()
    fmt.Println(">> Starting Enhanced Telemetry (30s interval)...")

	ticker := time.NewTicker(1 * time.Second)
    slowTicker := time.NewTicker(30 * time.Second) // For heavy tasks
	defer ticker.Stop()
    defer slowTicker.Stop()

    // Initial hydration
    go func() {
        if procs, err := procCol.Collect(); err == nil { senderClient.SendProcesses(procs) }
        if fw, err := fwCol.Collect(); err == nil { senderClient.SendFirewall(fw) }
    }()

    go func() {
        for range slowTicker.C {
            // Collect Processes
            if procs, err := procCol.Collect(); err == nil {
                if err := senderClient.SendProcesses(procs); err != nil {
                     log.Printf("Failed to send processes: %v", err)
                }
            }
            
            // Collect Firewall
            if fw, err := fwCol.Collect(); err == nil {
                if err := senderClient.SendFirewall(fw); err != nil {
                    log.Printf("Failed to send firewall: %v", err)
                }
            }
        }
    }()

	for range ticker.C {
        var metrics *collector.SystemMetrics
        if sysCol != nil {
    		m, err := sysCol.Collect()
    		if err != nil {
    			log.Printf("Error collecting metrics: %v", err)
    		} else {
                metrics = m
            }
        } else {
            // Send empty/heartbeat?
            // For now, if system is disabled, we simulate basic host info or skip?
            // If metrics is nil, sender might crash? 
            // Check sender implementation.
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
        
        // Only send if we have data or need heartbeat
        if metrics != nil || len(containerMetrics) > 0 {
    		// Send to Backend
            // If metrics nil, create dummy/empty?
            if metrics == nil { metrics = &collector.SystemMetrics{} }
            
    		if err := senderClient.SendMetrics(metrics, containerMetrics); err != nil {
    			log.Printf("Failed to send metrics: %v", err)
    		} else {
// fmt.Printf("\r>> CPU: %.1f%% | Mem: %.1f%% | Containers: %d  ", 
            //     metrics.CPUPercent, metrics.MemoryUsage, len(containerMetrics))
    		}
        }
	}
}

func runSetup() {
    reader := bufio.NewReader(os.Stdin)
    fmt.Println("\n=== DataVast Agent Enrollment ===")
    
    // 1. Server URL
    fmt.Print("Enter Server URL [http://localhost:8080]: ")
    url, _ := reader.ReadString('\n')
    url = strings.TrimSpace(url)
    if url == "" {
        url = "http://localhost:8080"
    }
    
    // 2. Hostname
    hostname, _ := os.Hostname()
    fmt.Printf("Agent Hostname [%s]: ", hostname)
    hostInput, _ := reader.ReadString('\n')
    hostInput = strings.TrimSpace(hostInput)
    if hostInput != "" {
        hostname = hostInput
    }

    // 3. System API Key
    fmt.Print("Enter System API Key: ")
    apiKey, _ := reader.ReadString('\n')
    apiKey = strings.TrimSpace(apiKey)
    
    // 4. Register
    fmt.Println("\n>> Contacting Server...")
    
    // Register Request
    reqPayload := map[string]string{
        "api_key": apiKey,
        "hostname": hostname,
    }
    
    resp, err := postRegister(url, reqPayload)
    if err != nil {
        log.Fatal("Registration Failed: ", err)
    }
    
    // Handle MFA
    if resp.StatusCode == http.StatusUnauthorized {
         // MFA Required
         fmt.Println(">> MFA REQUIRED: Please enter the code from your authenticator app.")
         fmt.Print("MFA Code: ")
         mfaCode, _ := reader.ReadString('\n')
         mfaCode = strings.TrimSpace(mfaCode)
         
         reqPayload["mfa_code"] = mfaCode
         resp, err = postRegister(url, reqPayload)
         if err != nil {
             log.Fatal("Registration Failed: ", err)
         }
    }
    
    if resp.StatusCode != http.StatusOK {
        log.Fatalf("Registration Failed: Status %s", resp.Status)
    }
    
    // Success
    var result struct {
        AgentID string `json:"agent_id"`
        Secret  string `json:"secret"`
    }
    json.NewDecoder(resp.Body).Decode(&result)
    
    fmt.Println(">> SUCCESS! Agent Enrolled.")
    
    // --- Modular Configuration ---
    fmt.Println("\n=== Data Collection Configuration ===")
    
    collectors := config.CollectorConfig{}
    
    collectors.System = askBool(reader, "Enable System Metrics (CPU/RAM/Disk)?", true)
    collectors.Docker = askBool(reader, "Enable Docker Monitoring?", true)
    
    fmt.Println("\n--- Service Integrations ---")
    collectors.Kubernetes = askBool(reader, "Enable Kubernetes?", false)
    collectors.Nginx = askBool(reader, "Enable Nginx Logs?", false)
    collectors.Apache = askBool(reader, "Enable Apache Logs?", false)
    collectors.PM2 = askBool(reader, "Enable PM2 Process Manager?", false)
    
    fmt.Println("\n--- Log Collection Strategy ---")
    fmt.Println("1) Auto-Discover & Tail ALL (Standard)")
    fmt.Println("2) Select Specific Logs")
    fmt.Println("3) Disable Log Collection")
    fmt.Print("Select Mode [1]: ")
    
    modeStr, _ := reader.ReadString('\n')
    modeStr = strings.TrimSpace(modeStr)
    
    logStrategy := config.LogStrategy{Mode: "all"}
    if modeStr == "2" {
        logStrategy.Mode = "selected"
        // Run discovery to show options
        fmt.Println(">> Discovering available logs...")
        candidates, _ := discovery.FindLogs()
        
        // Add service logs if enabled
        if collectors.Nginx { candidates = append(candidates, discovery.FindServiceLogs("nginx")...) }
        if collectors.Apache { candidates = append(candidates, discovery.FindServiceLogs("apache")...) }
        if collectors.PM2 { candidates = append(candidates, discovery.FindServiceLogs("pm2")...) }
        
        seen := make(map[string]bool)
        var unique []discovery.DiscoveredLog
        for _, l := range candidates {
            if !seen[l.Path] {
                unique = append(unique, l)
                seen[l.Path] = true
            }
        }
        candidates = unique

        if len(candidates) == 0 {
            fmt.Println("No logs found. Disabling log collection.")
            logStrategy.Mode = "none"
        } else {
            fmt.Println("\nAvailable Logs:")
            for i, l := range candidates {
                fmt.Printf("[%d] %s (%s)\n", i+1, l.Path, l.SourceType)
            }
            fmt.Print("\nEnter comma-separated IDs to tail (e.g. 1,3,5): ")
            selection, _ := reader.ReadString('\n')
            ids := strings.Split(strings.TrimSpace(selection), ",")
            for _, id := range ids {
                 if idx, err := strconv.Atoi(strings.TrimSpace(id)); err == nil && idx > 0 && idx <= len(candidates) {
                     logStrategy.SelectedLogs = append(logStrategy.SelectedLogs, candidates[idx-1].Path)
                 }
            }
            fmt.Printf(">> Selected %d logs.\n", len(logStrategy.SelectedLogs))
        }
    } else if modeStr == "3" {
        logStrategy.Mode = "none"
    }
    
    // Save Config
    cfg := &config.AgentConfig{
        ServerURL: url,
        AgentID: result.AgentID,
        AgentSecret: result.Secret,
        Collectors: collectors,
        LogConfig: logStrategy,
    }
    if err := config.SaveConfig(cfg); err != nil {
        log.Fatal("Failed to save config:", err)
    }
    fmt.Println(">> Configuration saved to agent-config.json")
    fmt.Println(">> You can now start the agent normally.")
}

func askBool(r *bufio.Reader, prompt string, def bool) bool {
    defStr := "Y/n"
    if !def { defStr = "y/N" }
    fmt.Printf("%s [%s]: ", prompt, defStr)
    ans, _ := r.ReadString('\n')
    ans = strings.TrimSpace(strings.ToLower(ans))
    if ans == "" { return def }
    return ans == "y" || ans == "yes"
}

func postRegister(url string, payload interface{}) (*http.Response, error) {
    data, _ := json.Marshal(payload)
    return http.Post(url+"/api/v1/agent/register", "application/json", bytes.NewBuffer(data))
}
