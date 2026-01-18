package api

import (
	"net/http"
	"time"

	"github.com/datavast/datavast/server/storage"
	"github.com/gin-gonic/gin"
)

type IngestionHandler struct {
	Metrics *storage.MetricsStore
	Logs    *storage.LogStore
    Config  *storage.ConfigStore
}

type MetricPayload struct {
	CPU       float64 `json:"cpu_percent"`
	Mem       float64 `json:"memory_usage"`
	Disk      float64 `json:"disk_usage"`
	BytesSent uint64  `json:"bytes_sent"`
	BytesRecv uint64  `json:"bytes_recv"`
    NetRecvRate float64 `json:"net_recv_rate"`
    DDoSStatus  string  `json:"ddos_status"`
    Containers []struct {
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
    } `json:"containers"`
}

func (h *IngestionHandler) HandleMetrics(c *gin.Context) {
	var p MetricPayload
	if err := c.BindJSON(&p); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	if err := h.Metrics.WriteSystemMetric(p.CPU, p.Mem, p.Disk, p.BytesSent, p.BytesRecv, p.NetRecvRate, p.DDoSStatus); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to store metric"})
		return
	}
    
    // Store Containers
    for _, cnt := range p.Containers {
        h.Metrics.WriteContainerMetric(
            cnt.ID, cnt.Name, cnt.Image, cnt.State, cnt.Status, cnt.Ports,
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
	data, err := h.Metrics.GetLatestSystemMetrics()
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, data)
}

func (h *IngestionHandler) HandleGetContainers(c *gin.Context) {
	metrics, err := h.Metrics.GetLatestContainerMetrics()
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to query container metrics"})
		return
	}
	c.JSON(http.StatusOK, metrics)
}

func SetupRoutes(r *gin.Engine, h *IngestionHandler) {
	v1 := r.Group("/api/v1")
	{
		v1.POST("/ingest/metrics", h.HandleMetrics)
		v1.POST("/ingest/logs", h.HandleLogs)
        
        // Query Endpoints
        v1.GET("/metrics/system", h.HandleGetLatestMetrics)
        v1.GET("/metrics/containers", h.HandleGetContainers)
        v1.GET("/logs/stream", h.HandleGetLogs)
        v1.GET("/logs/search", h.HandleSearchLogs)
        v1.GET("/metrics/history", h.HandleGetHistory)
        v1.GET("/settings", h.HandleGetSettings)
        v1.POST("/settings", h.HandleSaveSettings)
	}
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
    level := c.Query("level")
    search := c.Query("search")
    
    logs, err := h.Logs.QueryLogs(100, level, search)
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
    if duration == "" {
        duration = "15m"
    }

    history, err := h.Metrics.GetSystemMetricHistory(duration)
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
    var config storage.SystemConfig
    if err := c.BindJSON(&config); err != nil {
        c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
        return
    }

    if err := h.Config.Save(config); err != nil {
        c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to save config"})
        return
    }

    c.Status(http.StatusAccepted)
}
