package api

import (
	"fmt"
	"net/http"
    "strconv"
	"time"

	"github.com/datavast/datavast/server/storage"
    "github.com/datavast/datavast/server/auth"
	"github.com/gin-gonic/gin"
    "encoding/json"
    "github.com/golang-jwt/jwt/v5"
)

type IngestionHandler struct {
	Metrics *storage.MetricsStore
	Logs    *storage.LogStore
    Config  *storage.ConfigStore
    Auth    *auth.AuthManager
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

	c.Status(http.StatusAccepted)
}

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
    if hosts == nil {
        hosts = []storage.HostMetadata{}
    }
    c.JSON(http.StatusOK, hosts)
}

func SetupRoutes(r *gin.Engine, h *IngestionHandler) {
	v1 := r.Group("/api/v1")
	{
        // Public / Enrollment
		v1.POST("/agent/register", h.HandleRegisterAgent)

        // Ingestion (Should be protected eventually)
		v1.POST("/ingest/metrics", h.HandleMetrics)
		v1.POST("/ingest/logs", h.HandleLogs)
        v1.GET("/hosts", h.HandleGetHosts) // New Endpoint
        v1.GET("/metrics/system", h.HandleGetLatestMetrics)
        v1.GET("/metrics/containers", h.HandleGetContainers)
        v1.GET("/logs/stream", h.HandleGetLogs)
        v1.GET("/logs/search", h.HandleSearchLogs)
        v1.GET("/metrics/history", h.HandleGetHistory)
        v1.GET("/metrics/interfaces/history", h.HandleGetInterfaceHistory)
        v1.GET("/settings", h.HandleGetSettings) // Read-only public
        
        v1.POST("/auth/login", h.HandleLogin)

        // Protected
        secure := v1.Group("/")
        secure.Use(AuthRequired("admin"))
        {
            secure.POST("/settings", h.HandleSaveSettings)
            secure.POST("/mfa/setup", h.HandleSetupMFA)
            secure.POST("/mfa/enable", h.HandleEnableMFA)
            secure.POST("/mfa/disable", h.HandleDisableMFA)
        }
        
        // Ingest Extensions
        v1.POST("/ingest/processes", h.HandleIngestProcesses)
        v1.POST("/ingest/firewall", h.HandleIngestFirewall)
        
        // Get Extensions
        v1.GET("/processes", h.HandleGetProcesses)
        v1.GET("/firewall", h.HandleGetFirewall)
	}
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
        RetentionDays int     `json:"retention_days"`
        DDoSThreshold float64 `json:"ddos_threshold"`
        EmailAlerts   bool    `json:"email_alerts"`
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
    
    // Save
    if err := h.Config.Save(current); err != nil {
        c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to save config"})
        return
    }

    c.Status(http.StatusAccepted)
}

func (h *IngestionHandler) HandleGetInterfaceHistory(c *gin.Context) {
    duration := c.Query("duration")
    if duration == "" {
        duration = "15m"
    }

    history, err := h.Metrics.GetInterfaceHistory(duration)
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
