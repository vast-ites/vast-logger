package api

import (
	"fmt"
	"log"
	"net/http"
    "os"
    "strconv"
	"strings"
	"path/filepath"
	"regexp"
	"time"

	"github.com/datavast/datavast/server/storage"
    "github.com/datavast/datavast/server/geoip"
    "github.com/datavast/datavast/server/auth"
    "github.com/datavast/datavast/server/alert"
	"github.com/gin-gonic/gin"

    "encoding/json"
    "github.com/golang-jwt/jwt/v5"
)

type IngestionHandler struct {
	Metrics *storage.MetricsStore
	Logs    *storage.LogStore
    Config  *storage.ConfigStore
    Auth    *auth.AuthManager
    Alerts  *alert.AlertService
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
    Speed       string `json:"speed"`
    BytesSent   uint64 `json:"bytes_sent"`
    BytesRecv   uint64 `json:"bytes_recv"`
}

// Define ContainerMetric, ProcessMetric, FirewallStatus if they are not already defined elsewhere
// For this change, I'll assume they are simple aliases or need to be defined.
// Based on the instruction "I'll define simplified structs inside handler.go matching agent's JSON."
// but only PartitionStat and InterfaceStat are provided, I will keep the original anonymous struct for Containers
// and add placeholder types for ProcessMetric and FirewallStatus if they are not defined.
// However, the provided diff explicitly changes `Containers []struct{...}` to `Containers []ContainerMetric`.
// To make the code syntactically correct, I will define placeholder structs for `ContainerMetric`, `ProcessMetric`, and `FirewallStatus`.

type ContainerMetric struct {
    ID          string  `json:"id"`
    Name        string  `json:"name"`
    Image       string  `json:"image"`
    State       string  `json:"state"`
    Status      string  `json:"status"`
    Ports       string  `json:"ports"`
    CPUPercent  float64 `json:"cpu_percent"`
    MemoryUsage float64 `json:"memory_usage"`
    NetRx       float64 `json:"net_rx"`
    NetTx       float64 `json:"net_tx"`
}

type ProcessMetric struct {
    // Define fields for process metric
    // Example: PID int `json:"pid"`, Name string `json:"name"`
}

type FirewallStatus struct {
    // Define fields for firewall status
    // Example: Rules string `json:"rules"`
}

type MetricPayload struct {
    Hostname  string  `json:"host"`
	CPU       float64 `json:"cpu_percent"`
	CPUCount  int     `json:"cpu_count"`
    CPUPhysical int   `json:"cpu_physical"`
    CPUModel  string  `json:"cpu_model"`
    CPUFreq   float64 `json:"cpu_freq"`
	Mem       float64 `json:"memory_usage"`
	MemTotal  uint64  `json:"memory_total"`
    SwapUsage float64 `json:"swap_usage"`
    SwapTotal uint64  `json:"swap_total"`
	Disk      float64 `json:"disk_usage"`
	DiskTotal uint64  `json:"disk_total"`
    Partitions []PartitionStat `json:"partitions"`
	BytesSent uint64  `json:"bytes_sent"`
	BytesRecv uint64  `json:"bytes_recv"`
    NetRecvRate float64 `json:"net_recv_rate"`
    NetSentRate float64 `json:"net_sent_rate"`
    DiskReadRate float64 `json:"disk_read_rate"`
    DiskWriteRate float64 `json:"disk_write_rate"`
    DiskReadIOPS float64 `json:"disk_read_iops"`
    DiskWriteIOPS float64 `json:"disk_write_iops"`
    Interfaces []InterfaceStat `json:"interfaces"`
    Uptime     uint64      `json:"uptime"`
	DDoSStatus string  `json:"ddos_status"`
    Containers []ContainerMetric `json:"containers"`
	ProcessList []ProcessMetric  `json:"processes"`
    ProcessRaw  string           `json:"process_raw"`
    Firewall    *FirewallStatus  `json:"firewall"`
}

func (h *IngestionHandler) HandleMetrics(c *gin.Context) {
	var p MetricPayload
	if err := c.BindJSON(&p); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}
	// Debug Logging for Capacity Metrics
    fmt.Printf("DEBUG INGEST [%s]: CPU_Count=%d Phys=%d Freq=%.2f Parts=%d Ifaces=%d\n", 
        p.Hostname, p.CPUCount, p.CPUPhysical, p.CPUFreq, len(p.Partitions), len(p.Interfaces))

    // Marshal List Metrics to JSON strings for Influx
    partitionsJSON, _ := json.Marshal(p.Partitions)
    interfacesJSON, _ := json.Marshal(p.Interfaces)

	if err := h.Metrics.WriteSystemMetric(
        p.Hostname, 
        p.CPU, p.CPUCount, p.CPUPhysical, p.CPUModel, p.CPUFreq,
        p.Mem, p.MemTotal, p.SwapUsage, p.SwapTotal,
        p.Disk, p.DiskTotal, string(partitionsJSON),
        p.BytesSent, p.BytesRecv, p.NetRecvRate, p.NetSentRate,
        p.DiskReadRate, p.DiskWriteRate, p.DiskReadIOPS, p.DiskWriteIOPS,
        string(interfacesJSON), p.DDoSStatus, p.ProcessRaw,
        p.Uptime,
    ); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to store metric"})
		return
	}
    
    // Store Containers
    for _, cnt := range p.Containers {
        h.Metrics.WriteContainerMetric(
            p.Hostname, cnt.ID, cnt.Name, cnt.Image, cnt.State, cnt.Status, cnt.Ports,
            cnt.CPUPercent, cnt.MemoryUsage, cnt.NetRx, cnt.NetTx,
        )
    }

    // Store Interface Metrics (for History)
    for _, iface := range p.Interfaces {
        h.Metrics.WriteInterfaceMetric(p.Hostname, iface.Name, iface.BytesSent, iface.BytesRecv)
    }

	c.Status(http.StatusAccepted)
    
    // Check Alerts
    if h.Alerts != nil {
        // Build Generic Metric Map using Bytes/s for consistency with Thresholds
        // Agent sends MB/s for Rates -> Convert to Bytes/s
        m := map[string]float64{
            "cpu_percent":    p.CPU,
            "memory_usage":   p.Mem,
            "disk_usage":     p.Disk,
            "net_recv_rate":  p.NetRecvRate * 1024 * 1024,
            "net_sent_rate":  p.NetSentRate * 1024 * 1024,
            "net_total_rate": (p.NetRecvRate + p.NetSentRate) * 1024 * 1024,
            "swap_usage":     p.SwapUsage,
            "cpu_freq":       p.CPUFreq,
            "disk_read_rate": p.DiskReadRate * 1024 * 1024,
            "disk_write_rate": p.DiskWriteRate * 1024 * 1024,
            "disk_read_op":   p.DiskReadIOPS,
            "disk_write_op":  p.DiskWriteIOPS,
        }
        if p.DDoSStatus == "DDoS" { m["ddos_status"] = 1.0 }
        
        // Build IP Info string
        var ips []string
        for _, iface := range p.Interfaces {
            if iface.IP != "" && iface.IP != "127.0.0.1" && iface.IP != "::1" {
                ips = append(ips, iface.IP)
            }
        }
        ipInfo := strings.Join(ips, ", ")
        if ipInfo == "" { ipInfo = "Unknown IP" }
        
        h.Alerts.EvaluateRules(p.Hostname, m, ipInfo)
    }
}


// Pre-compile regex for performance
var commonLogFormat = regexp.MustCompile(`^(\S+) \S+ \S+ \[([^\]]+)\] "(\S+) (\S+) ([^"]+)" (\d+) (\d+)`)

func (h *IngestionHandler) HandleLogs(c *gin.Context) {
	// Simple map for now, will map to LogEntry properly
	var entry storage.LogEntry
	if err := c.BindJSON(&entry); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}
	
	if entry.Timestamp.IsZero() {
		entry.Timestamp = time.Now()
	}

	// Try to detect and parse Apache/Nginx Access Logs
	// Filter by service name or source path
	isWebLog := false
	svc := strings.ToLower(entry.Service)
	if svc == "apache" || svc == "nginx" || svc == "httpd" || strings.Contains(svc, "web") {
		isWebLog = true
	}

	if isWebLog {
		matches := commonLogFormat.FindStringSubmatch(entry.Message)
        // Check for vhost_combined format (starts with vhost:port then IP)
        // If standard regex fails, try skipping the first token
        if len(matches) < 8 {
            if firstSpace := strings.Index(entry.Message, " "); firstSpace > 0 {
                trimmed := entry.Message[firstSpace+1:]
                matches = commonLogFormat.FindStringSubmatch(trimmed)
            }
        }

		if len(matches) >= 8 {
			// Found structured log!
			ip := matches[1]
			// tsStr := matches[2] // We rely on Agent timestamp for now, or parse this if needed?
			// Agent timestamp is usually accurate to when the log was read.
			method := matches[3]
			path := matches[4]
			// matches[5] is Protocol (HTTP/1.1)
			status, _ := strconv.Atoi(matches[6])
			bytesSent, _ := strconv.Atoi(matches[7])
			
			// User Agent is usually in the next quoted block but our regex captures basic CLF
			// To capture UserAgent we need extended regex or just keep it simple.
			// Let's improve regex to catch User-Agent if possible, or leave empty
			
			// Extended regex for Combined Log Format: ... "Referer" "User-Agent"
			// ^(\S+) \S+ \S+ \[([^\]]+)\] "(\S+) (\S+) \S+" (\d+) (\d+) "(.*?)" "(.*?)"
			
			accessEntry := storage.AccessLogEntry{
				Timestamp:  entry.Timestamp,
				Service:    entry.Service,
				Host:       entry.Host,
				IP:         ip,
				Method:     method,
				Path:       path,
				StatusCode: uint16(status),
				BytesSent:  uint64(bytesSent),
				UserAgent:  "Unknown", // Placeholder unless we parse CLF+
			}

            // Extract Domain from SourcePath (e.g. example.com-access.log)
            filename := filepath.Base(entry.SourcePath)
            if strings.HasSuffix(filename, "-access.log") {
                accessEntry.Domain = strings.TrimSuffix(filename, "-access.log")
            } else if strings.HasSuffix(filename, "access.log") {
                if filename == "access.log" {
                     accessEntry.Domain = "default"
                } else {
                     accessEntry.Domain = strings.TrimSuffix(filename, "access.log")
                }
            } else {
                accessEntry.Domain = "unknown"
            }
			
			// Resolve GeoIP
			if geoInfo, err := geoip.GetInstance().Lookup(ip); err == nil {
				accessEntry.Country = geoInfo.Country
				accessEntry.Region = geoInfo.Region
				accessEntry.City = geoInfo.City
				accessEntry.Latitude = geoInfo.Latitude
				accessEntry.Longitude = geoInfo.Longitude
			}
			
			// Attempt to parse UserAgent if message is longer
			if parts := strings.Split(entry.Message, "\""); len(parts) >= 6 {
				// 0: ip... [ts] 
				// 1: GET / ...
				// 2: 200 1234 
				// 3: Referer
				// 4: 
				// 5: UserAgent
				accessEntry.UserAgent = parts[5]
			}

			if err := h.Logs.InsertAccessLog(accessEntry); err != nil {
				fmt.Printf("[ERROR] Failed to insert access log: %v\n", err)
				// Fallback to generic log insertion? No, allow it to fail for now or log error
			} else {
				// Successfully stored as structured log
				// data is safe, but we ALSO want it in the generic table so it shows up in "Logs" explorer
			}
		}
	}

	if err := h.Logs.InsertLog(entry); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to store log"})
		return
	}

	c.Status(http.StatusAccepted)
}

func (h *IngestionHandler) HandleGetLatestMetrics(c *gin.Context) {
    host := c.Query("host")
	data, err := h.Metrics.GetLatestSystemMetrics(host)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, data)
}

func (h *IngestionHandler) HandleGetContainers(c *gin.Context) {
    host := c.Query("host")
	metrics, err := h.Metrics.GetLatestContainerMetrics(host)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to query container metrics"})
		return
	}
	c.JSON(http.StatusOK, metrics)
}

func (h *IngestionHandler) HandleGetHosts(c *gin.Context) {
    hosts, err := h.Metrics.GetHosts()
    if err != nil {
        c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
        return
    }
    
    // Filter Ignored Hosts
    cfg := h.Config.Get()
    ignored := make(map[string]bool)
    for _, host := range cfg.IgnoredHosts {
        ignored[host] = true
    }
    
    var visibleHosts []storage.HostMetadata
    if hosts != nil {
        for _, host := range hosts {
            if !ignored[host.Hostname] {
                visibleHosts = append(visibleHosts, host)
            }
        }
    } else {
        visibleHosts = []storage.HostMetadata{}
    }

    c.JSON(http.StatusOK, visibleHosts)
}

func (h *IngestionHandler) HandleDeleteHost(c *gin.Context) {
    host := c.Query("host")
    if host == "" {
        c.JSON(http.StatusBadRequest, gin.H{"error": "Host required"})
        return
    }
    
    // Add to ignored list
    cfg := h.Config.Get()
    
    // Check if already ignored
    for _, h := range cfg.IgnoredHosts {
        if h == host {
             c.Status(http.StatusOK)
             return
        }
    }
    
    cfg.IgnoredHosts = append(cfg.IgnoredHosts, host)
    if err := h.Config.Save(cfg); err != nil {
        c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to save config"})
        return
    }
    
    c.Status(http.StatusOK)
}

func SetupRoutes(r *gin.Engine, h *IngestionHandler) {
	v1 := r.Group("/api/v1")
	{
        // Public (always accessible)
        v1.POST("/auth/login", h.HandleLogin)
        
        // Agent Ingestion (no auth - agents use internal network trust)
		v1.POST("/agent/register", h.HandleRegisterAgent)
        v1.POST("/ingest/metrics", h.HandleMetrics)
	    v1.POST("/ingest/logs", h.HandleLogs)
        v1.POST("/ingest/processes", h.HandleIngestProcesses)
        v1.POST("/ingest/firewall", h.HandleIngestFirewall)
        v1.POST("/ingest/connections", h.HandleIngestConnections)

        // User-facing endpoints (optional auth based on AUTH_ENABLED)
        userRoutes := v1.Group("/")
        userRoutes.Use(OptionalAuth("user"))
        {
            userRoutes.GET("/hosts", h.HandleGetHosts) 
            userRoutes.DELETE("/hosts", h.HandleDeleteHost)
            userRoutes.GET("/metrics/system", h.HandleGetLatestMetrics)
            userRoutes.GET("/metrics/containers", h.HandleGetContainers)
            userRoutes.GET("/logs/stream", h.HandleGetLogs)
            userRoutes.GET("/logs/search", h.HandleSearchLogs)
            userRoutes.GET("/metrics/history", h.HandleGetHistory)
            userRoutes.GET("/metrics/interfaces/history", h.HandleGetInterfaceHistory)
            userRoutes.GET("/settings", h.HandleGetSettings)
            userRoutes.GET("/logs/services", h.HandleGetServices)
            userRoutes.GET("/processes", h.HandleGetProcesses)
            userRoutes.GET("/firewall", h.HandleGetFirewall)
            userRoutes.GET("/connections/summary", h.HandleGetConnectionSummary)
            userRoutes.GET("/connections/details", h.HandleGetConnectionDetails)
            
            // Service detail endpoints
            userRoutes.GET("/services/:service/stats", h.HandleGetServiceStats)
            userRoutes.GET("/services/:service/access-logs", h.HandleGetAccessLogs)
            userRoutes.GET("/services/:service/geo", h.HandleGetGeoStats)
            userRoutes.GET("/services/:service/top-ips", h.HandleGetTopIPs)
            
            // MySQL endpoints
            userRoutes.GET("/services/mysql/status", h.HandleGetMySQLStatus)
            userRoutes.GET("/services/mysql/slow-queries", h.HandleGetMySQLSlowQueries)
            userRoutes.GET("/services/mysql/connections", h.HandleGetMySQLConnections)
        }

        // Admin endpoints (always require auth when AUTH_ENABLED=true)
        adminRoutes := v1.Group("/")
        adminRoutes.Use(OptionalAuth("admin"))
        {
            adminRoutes.POST("/settings", h.HandleSaveSettings)
            adminRoutes.POST("/mfa/setup", h.HandleSetupMFA)
            adminRoutes.POST("/mfa/enable", h.HandleEnableMFA)
            adminRoutes.POST("/mfa/disable", h.HandleDisableMFA)
            
            // Alert Management
            adminRoutes.GET("/alerts/rules", h.HandleGetAlertRules)
            adminRoutes.POST("/alerts/rules", h.HandleCreateAlertRule)
            adminRoutes.PUT("/alerts/rules/:id", h.HandleUpdateAlertRule)
            adminRoutes.POST("/alerts/rules/:id/toggle", h.HandleToggleAlertRule)
            adminRoutes.DELETE("/alerts/rules/:id", h.HandleDeleteAlertRule)
            
            adminRoutes.GET("/alerts/channels", h.HandleGetChannels)
            adminRoutes.POST("/alerts/channels", h.HandleCreateChannel)
            adminRoutes.DELETE("/alerts/channels/:id", h.HandleDeleteChannel)
            
            adminRoutes.POST("/alerts/silence", h.HandleSilenceAlert)
            adminRoutes.POST("/alerts/unsilence", h.HandleUnsilenceAlert)
        }
	}
}

func (h *IngestionHandler) HandleGetServices(c *gin.Context) {
    host := c.Query("host")
    fmt.Printf("DEBUG: HandleGetServices called for host='%s'\n", host)
    
    // 1. Get Services from Logs (Historical)
    services, err := h.Logs.GetUniqueServices(host)
    if err != nil {
        log.Printf("Error getting log services: %v", err)
        services = []string{}
    }
    if services == nil {
        services = []string{}
    }
    
    // 2. Get Running Containers from Metrics (Live)
    if host != "" {
        if containers, err := h.Metrics.GetContainerNames(host); err == nil {
            log.Printf("DEBUG: Found Active Containers for %s: %v", host, containers)
            // Merge unique
            seen := make(map[string]bool)
            for _, s := range services { seen[s] = true }

            for _, c := range containers {
                if !seen[c] {
                    services = append(services, c)
                    seen[c] = true
                }
            }
        } else {
             log.Printf("DEBUG: Error getting container names: %v", err)
        }
    }

    c.Header("X-Debug", "Active")
    c.JSON(http.StatusOK, services)
}

func (h *IngestionHandler) HandleIngestProcesses(c *gin.Context) {
    var req struct {
        Host      string                  `json:"host"`
        Processes []storage.ProcessEntry  `json:"processes"`
    }
    if err := c.BindJSON(&req); err != nil {
        c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
        return
    }
    
    // Enrich with timestamp/host if missing in items
    ts := time.Now()
    for i := range req.Processes {
        if req.Processes[i].Timestamp.IsZero() {
            req.Processes[i].Timestamp = ts
        }
        if req.Processes[i].Host == "" {
            req.Processes[i].Host = req.Host
        }
    }
    
    if err := h.Logs.InsertProcesses(req.Processes); err != nil {
        c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to insert processes"})
        return
    }
    c.Status(http.StatusAccepted)
}

func (h *IngestionHandler) HandleIngestFirewall(c *gin.Context) {
    var req struct {
        Host  string `json:"host"`
        Rules string `json:"rules"`
    }
    if err := c.BindJSON(&req); err != nil {
        c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
        return
    }
    
    if err := h.Logs.InsertFirewall(time.Now(), req.Host, req.Rules); err != nil {
         c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to insert firewall rules"})
         return
    }
    c.Status(http.StatusAccepted)
}

func (h *IngestionHandler) HandleGetProcesses(c *gin.Context) {
    host := c.Query("host")
    procs, err := h.Logs.GetLatestProcesses(host)
    if err != nil {
         c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
         return
    }
    if procs == nil {
        procs = []storage.ProcessEntry{}
    }
    c.JSON(http.StatusOK, procs)
}

func (h *IngestionHandler) HandleGetFirewall(c *gin.Context) {
    host := c.Query("host")
    rules, err := h.Logs.GetLatestFirewall(host)
    if err != nil {
         // Return empty if not found, don't error 500
         rules = ""
    }
    c.JSON(http.StatusOK, gin.H{"rules": rules})
}

func (h *IngestionHandler) HandleGetLogs(c *gin.Context) {
	logs, err := h.Logs.GetRecentLogs(50)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	// Return empty array instead of null for consistency
	if logs == nil {
		logs = []storage.LogEntry{}
	}
	c.JSON(http.StatusOK, logs)
}

func (h *IngestionHandler) HandleSearchLogs(c *gin.Context) {
    filter := storage.LogFilter{
        Level:      c.Query("level"),
        SearchTerm: c.Query("search"),
        Host:       c.Query("host"),
        Service:    c.Query("service"),
        Order:      c.Query("order"),
    }
    
    limitStr := c.Query("limit")
    filter.Limit = 100
    if limitStr != "" {
        if l, err := strconv.Atoi(limitStr); err == nil && l > 0 {
            filter.Limit = l
        }
    }
    
    // Parse Time
    if beforeStr := c.Query("before"); beforeStr != "" {
        // Try standardized formats or just ISO
        if t, err := time.Parse(time.RFC3339, beforeStr); err == nil {
             filter.Before = t
        } else if t, err := time.Parse("2006-01-02", beforeStr); err == nil {
             filter.Before = t
        } else if t, err := time.Parse("2006-01-02 15:04", beforeStr); err == nil {
             filter.Before = t
        }
    }
    
    if afterStr := c.Query("after"); afterStr != "" {
        if t, err := time.Parse(time.RFC3339, afterStr); err == nil {
             filter.After = t
        } else if t, err := time.Parse("2006-01-02", afterStr); err == nil {
             filter.After = t
        } else if t, err := time.Parse("2006-01-02 15:04", afterStr); err == nil {
             filter.After = t
        }
    }
    
    logs, err := h.Logs.QueryLogs(filter)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
    if logs == nil {
        logs = []storage.LogEntry{}
    }
    c.JSON(http.StatusOK, logs)
}

func (h *IngestionHandler) HandleGetHistory(c *gin.Context) {
    duration := c.Query("duration")
    host := c.Query("host")
    if duration == "" {
        duration = "15m"
    }

    history, err := h.Metrics.GetSystemMetricHistory(duration, host)
    if err != nil {
        c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
        return
    }
    if history == nil {
        history = []storage.SystemMetricData{}
    }
    c.JSON(http.StatusOK, history)
}

func (h *IngestionHandler) HandleGetSettings(c *gin.Context) {
    c.JSON(http.StatusOK, h.Config.Get())
}

func (h *IngestionHandler) HandleSaveSettings(c *gin.Context) {
    var req struct {
        RetentionDays int      `json:"retention_days"`
        DDoSThreshold float64  `json:"ddos_threshold"`
        EmailAlerts   bool     `json:"email_alerts"`
        AlertEmails   []string `json:"alert_emails"`
        WebhookURLs   []string `json:"webhook_urls"`
        SMTPServer    string   `json:"smtp_server"`
        SMTPPort      int      `json:"smtp_port"`
        SMTPUser      string   `json:"smtp_user"`
        SMTPPassword  string   `json:"smtp_password"`
    }
    if err := c.BindJSON(&req); err != nil {
        c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
        return
    }

    // Get existing config
    current := h.Config.Get()
    
    // Update only allowed fields
    current.RetentionDays = req.RetentionDays
    current.DDoSThreshold = req.DDoSThreshold
    current.EmailAlerts = req.EmailAlerts
    current.AlertEmails = req.AlertEmails
    current.WebhookURLs = req.WebhookURLs
    current.SMTPServer = req.SMTPServer
    current.SMTPPort = req.SMTPPort
    current.SMTPUser = req.SMTPUser
    current.SMTPPassword = req.SMTPPassword
    
    // Save
    if err := h.Config.Save(current); err != nil {
        c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to save config"})
        return
    }

    c.Status(http.StatusAccepted)
}

func (h *IngestionHandler) HandleGetInterfaceHistory(c *gin.Context) {
    duration := c.Query("duration")
    host := c.Query("host")
    if duration == "" {
        duration = "15m"
    }

    history, err := h.Metrics.GetInterfaceHistory(duration, host)
    if err != nil {
        c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
        return
    }
    if history == nil {
        history = []storage.InterfaceMetricData{}
    }
    c.JSON(http.StatusOK, history)
}

func (h *IngestionHandler) HandleLogin(c *gin.Context) {
    var req struct {
        Password string `json:"password"`
    }
    if err := c.BindJSON(&req); err != nil {
        c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid request"})
        return
    }
    
    if !h.Auth.ValidatePassword(req.Password) {
        c.JSON(http.StatusUnauthorized, gin.H{"error": "Invalid password"})
        return
    }
    
    token, err := h.Auth.GenerateToken()
    if err != nil {
        c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to generate token"})
        return
    }
    
    c.JSON(http.StatusOK, gin.H{"token": token})
}

func (h *IngestionHandler) HandleRegisterAgent(c *gin.Context) {
    var req struct {
        APIKey   string `json:"api_key"`
        Hostname string `json:"hostname"`
        MFACode  string `json:"mfa_code"`
    }
    if err := c.BindJSON(&req); err != nil {
        c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid request"})
        return
    }

    // 1. Validate System API Key
    sysKey := h.Config.Get().SystemAPIKey
    if sysKey == "" || req.APIKey != sysKey {
        c.JSON(http.StatusForbidden, gin.H{"error": "Invalid API Key"})
        return
    }

    // 2. Validate MFA (if enabled)
    config := h.Config.Get()
    if config.MFAEnabled {
        if req.MFACode == "" {
            c.JSON(http.StatusUnauthorized, gin.H{"error": "MFA_REQUIRED", "message": "MFA Code required"})
            return
        }
        if !auth.ValidateMFA(req.MFACode, config.MFASecret) {
            c.JSON(http.StatusForbidden, gin.H{"error": "Invalid MFA Code"})
            return
        }
    }

    // 3. Generate Agent Secret
    secret := auth.GenerateRandomString(32) // Reuse existing rand logic or new
    
    // 4. Save to Config
    // Note: ConfigStore.SaveAgentSecret needs to be implemented or we update map directly
    // Ideally we should add a helper in ConfigStore. For now, doing direct update.
    cfg := h.Config.Get()
    cfg.AgentSecrets[req.Hostname] = secret
    h.Config.Save(cfg)

    c.JSON(http.StatusOK, gin.H{
        "agent_id": req.Hostname,
        "secret":   secret,
    })
}

// MFA Setup
func (h *IngestionHandler) HandleSetupMFA(c *gin.Context) {
    secret, url, err := auth.GenerateMFA("admin@datavast")
    if err != nil {
        c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to generate MFA"})
        return
    }
    c.JSON(http.StatusOK, gin.H{
        "secret": secret,
        "url":    url,
    })
}

func (h *IngestionHandler) HandleEnableMFA(c *gin.Context) {
    var req struct {
        Code   string `json:"code"`
        Secret string `json:"secret"`
    }
    if err := c.BindJSON(&req); err != nil {
        c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid request"})
        return
    }

    if !auth.ValidateMFA(req.Code, req.Secret) {
        c.JSON(http.StatusForbidden, gin.H{"error": "Invalid Code"})
        return
    }

    // Save
    config := h.Config.Get()
    config.MFAEnabled = true
    config.MFASecret = req.Secret
    h.Config.Save(config)

    c.JSON(http.StatusOK, gin.H{"message": "MFA Enabled"})
}

func (h *IngestionHandler) HandleDisableMFA(c *gin.Context) {
     // Verify password via JSON body before disabling? 
     // For simplicity using JWT Auth check.
     config := h.Config.Get()
     config.MFAEnabled = false
     config.MFASecret = ""
     h.Config.Save(config)
     
     c.JSON(http.StatusOK, gin.H{"message": "MFA Disabled"})
}

// OptionalAuth wraps AuthRequired but makes it optional based on AUTH_ENABLED env var
// SECURITY: Authentication is ENABLED by default for production
func OptionalAuth(role string) gin.HandlerFunc {
	return func(c *gin.Context) {
		authEnabled := os.Getenv("AUTH_ENABLED")
		// Default to TRUE - auth enabled unless explicitly disabled
		if authEnabled == "false" {
			// Auth explicitly disabled - allow all requests
			c.Next()
			return
		}
		// Auth enabled (default) - enforce token check
		AuthRequired(role)(c)
	}
}

// Middleware
func AuthRequired(role string) gin.HandlerFunc {
	return func(c *gin.Context) {
        tokenString := c.GetHeader("Authorization")
        if tokenString == "" {
             c.AbortWithStatusJSON(http.StatusUnauthorized, gin.H{"error": "No token provided"})
             return
        }
        
        // Remove Bearer prefix if present
        if len(tokenString) > 7 && tokenString[:7] == "Bearer " {
            tokenString = tokenString[7:]
        }
        
        token, err := jwt.ParseWithClaims(tokenString, &auth.Claims{}, func(token *jwt.Token) (interface{}, error) {
			return auth.JwtSecret, nil
		})

		if err != nil || !token.Valid {
			c.AbortWithStatusJSON(http.StatusUnauthorized, gin.H{"error": "Invalid token"})
			return
		}

		c.Next()
	}
}

// -- Alert System Handlers --

func (h *IngestionHandler) HandleGetAlertRules(c *gin.Context) {
    c.JSON(http.StatusOK, h.Config.Get().AlertRules)
}

func (h *IngestionHandler) HandleCreateAlertRule(c *gin.Context) {
    var rule storage.AlertRule
    if err := c.BindJSON(&rule); err != nil {
        c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
        return
    }
    if rule.ID == "" { rule.ID = fmt.Sprintf("rule_%d", time.Now().UnixNano()) }
    if rule.Silenced == nil { rule.Silenced = make(map[string]time.Time) }
    rule.Enabled = true // Force Enable on Create
    
    cfg := h.Config.Get()
    cfg.AlertRules = append(cfg.AlertRules, rule)
    if err := h.Config.Save(cfg); err != nil {
        c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to save rule"})
        return
    }
    c.JSON(http.StatusOK, rule)
}

func (h *IngestionHandler) HandleToggleAlertRule(c *gin.Context) {
    id := c.Param("id")
    cfg := h.Config.Get()
    found := false
    for i, r := range cfg.AlertRules {
        if r.ID == id {
            cfg.AlertRules[i].Enabled = !cfg.AlertRules[i].Enabled
            found = true
            break
        }
    }
    
    if !found {
        c.Status(http.StatusNotFound)
        return
    }
    
    h.Config.Save(cfg)
    c.Status(http.StatusOK)
}

func (h *IngestionHandler) HandleUpdateAlertRule(c *gin.Context) {
    id := c.Param("id")
    var req storage.AlertRule
    if err := c.BindJSON(&req); err != nil {
        c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
        return
    }

    cfg := h.Config.Get()
    found := false
    for i, r := range cfg.AlertRules {
        if r.ID == id {
            // Update fields but preserve ID and Silenced state if not provided (though UI sends full object usually)
            // We consciously choose to overwrite basics
            cfg.AlertRules[i].Name = req.Name
            cfg.AlertRules[i].Metric = req.Metric
            cfg.AlertRules[i].Host = req.Host
            cfg.AlertRules[i].Operator = req.Operator
            cfg.AlertRules[i].Threshold = req.Threshold
            cfg.AlertRules[i].Channels = req.Channels
            // Enabled is handled by toggle, but let's allow it here too if UI sends it
            // cfg.AlertRules[i].Enabled = req.Enabled 
            
            found = true
            break
        }
    }
    
    if !found {
        c.Status(http.StatusNotFound)
        return
    }
    
    h.Config.Save(cfg)
    c.Status(http.StatusOK)
}

func (h *IngestionHandler) HandleDeleteAlertRule(c *gin.Context) {
    id := c.Param("id")
    cfg := h.Config.Get()
    newRules := []storage.AlertRule{}
    for _, r := range cfg.AlertRules {
        if r.ID != id {
            newRules = append(newRules, r)
        }
    }
    cfg.AlertRules = newRules
    h.Config.Save(cfg)
    c.Status(http.StatusOK)
}

func (h *IngestionHandler) HandleGetChannels(c *gin.Context) {
    c.JSON(http.StatusOK, h.Config.Get().NotificationChannels)
}

func (h *IngestionHandler) HandleCreateChannel(c *gin.Context) {
    var ch storage.NotificationChannel
    if err := c.BindJSON(&ch); err != nil {
        c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
        return
    }
    if ch.ID == "" { ch.ID = fmt.Sprintf("chan_%d", time.Now().UnixNano()) }
    
    cfg := h.Config.Get()
    cfg.NotificationChannels = append(cfg.NotificationChannels, ch)
    if err := h.Config.Save(cfg); err != nil {
        c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to save channel"})
        return
    }
    c.JSON(http.StatusOK, ch)
}

func (h *IngestionHandler) HandleDeleteChannel(c *gin.Context) {
    id := c.Param("id")
    cfg := h.Config.Get()
    newChans := []storage.NotificationChannel{}
    for _, ch := range cfg.NotificationChannels {
        if ch.ID != id {
            newChans = append(newChans, ch)
        }
    }
    cfg.NotificationChannels = newChans
    h.Config.Save(cfg)
    c.Status(http.StatusOK)
}

func (h *IngestionHandler) HandleSilenceAlert(c *gin.Context) {
    var req struct {
        RuleID   string `json:"rule_id"`
        Host     string `json:"host"`
        Duration string `json:"duration"` // e.g. "1h"
    }
    if err := c.BindJSON(&req); err != nil {
        c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
        return
    }

    d, err := time.ParseDuration(req.Duration)
    if err != nil {
        c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid duration format (e.g., 1h, 30m)"})
        return
    }
    
    // Normalize Host
    req.Host = strings.TrimSpace(req.Host)
    if req.Host == "" { req.Host = "*" }

    cfg := h.Config.Get()
    found := false
    for i, r := range cfg.AlertRules {
        if r.ID == req.RuleID {
            if cfg.AlertRules[i].Silenced == nil {
                cfg.AlertRules[i].Silenced = make(map[string]time.Time)
            }
            cfg.AlertRules[i].Silenced[req.Host] = time.Now().Add(d)
            found = true
            break
        }
    }
    
    if !found {
        c.JSON(http.StatusNotFound, gin.H{"error": "Rule not found"})
        return
    }
    
    h.Config.Save(cfg)
    c.Status(http.StatusOK)
}

func (h *IngestionHandler) HandleUnsilenceAlert(c *gin.Context) {
    var req struct {
        RuleID string `json:"rule_id"`
        Host   string `json:"host"`
    }
    if err := c.BindJSON(&req); err != nil {
        c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
        return
    }

    cfg := h.Config.Get()
    for i, r := range cfg.AlertRules {
        if r.ID == req.RuleID {
            delete(cfg.AlertRules[i].Silenced, req.Host)
            break
        }
    }
    
    h.Config.Save(cfg)
    c.Status(http.StatusOK)
}

func (h *IngestionHandler) HandleIngestConnections(c *gin.Context) {
    var req struct {
        Host        string                    `json:"host"`
        Connections []storage.ConnectionEntry `json:"connections"`
    }
    if err := c.BindJSON(&req); err != nil {
        c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
        return
    }

    // Enrich with timestamp if missing
    now := time.Now()
    for i := range req.Connections {
        if req.Connections[i].Timestamp.IsZero() {
            req.Connections[i].Timestamp = now
        }
        if req.Connections[i].Host == "" {
            req.Connections[i].Host = req.Host
        }
    }

    if err := h.Logs.InsertConnections(req.Connections); err != nil {
        c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to insert connections"})
        return
    }
    c.Status(http.StatusAccepted)
}

func (h *IngestionHandler) HandleGetConnectionSummary(c *gin.Context) {
    host := c.Query("host")
    summary, err := h.Logs.GetConnectionSummary(host)
    if err != nil {
        c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
        return
    }
    if summary == nil {
        summary = []storage.ConnectionSummary{}
    }
    c.JSON(http.StatusOK, summary)
}

func (h *IngestionHandler) HandleGetConnectionDetails(c *gin.Context) {
    host := c.Query("host")
    portStr := c.Query("port")
    port, err := strconv.Atoi(portStr)
    if err != nil {
        c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid port"})
        return
    }

    details, err := h.Logs.GetConnectionDetails(host, uint16(port))
    if err != nil {
        c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
        return
    }
    if details == nil {
        details = []storage.ConnectionEntry{}
    }
    c.JSON(http.StatusOK, details)
}
