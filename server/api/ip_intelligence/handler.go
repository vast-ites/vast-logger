package ip_intelligence

import (
	"github.com/gin-gonic/gin"
	"github.com/datavast/datavast/server/storage"
    "github.com/datavast/datavast/server/geoip"
	"net/http"
    "time"
)

type IPHandler struct {
	Logs *storage.LogStore
}

func NewIPHandler(store *storage.LogStore) *IPHandler {
	return &IPHandler{Logs: store}
}

// GetIPDetails returns aggregated info about an IP
func (h *IPHandler) GetIPDetails(c *gin.Context) {
    ip := c.Param("ip")
    agentID := c.Query("agent_id") // Optional filter

    // 1. Get Geo Info (from Cache or Live Lookup)
    geo := geoip.GetInstance().Lookup(ip)
    
    // 2. Check Block Status
    blocked, err := h.Logs.IsIPBlocked(ip, agentID)
    if err != nil {
        c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to check block status"})
        return
    }

    // 3. Get Activity Stats
    activity, err := h.Logs.GetIPActivity(ip, agentID)
    if err != nil {
        c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to get activity"})
        return
    }

    c.JSON(http.StatusOK, gin.H{
        "ip": ip,
        "geo": geo,
        "blocked": blocked,
        "activity": activity,
    })
}

// BlockIP blocks an IP for a specific agent
func (h *IPHandler) BlockIP(c *gin.Context) {
    var req struct {
        IP      string `json:"ip"`
        AgentID string `json:"agent_id"`
        Reason  string `json:"reason"`
    }
    if err := c.BindJSON(&req); err != nil {
        c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid request"})
        return
    }

    if req.AgentID == "" {
        c.JSON(http.StatusBadRequest, gin.H{"error": "AgentID is required for blocking"})
        return
    }

    if err := h.Logs.BlockIP(req.IP, req.AgentID, req.Reason); err != nil {
        c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
        return
    }

    c.Status(http.StatusOK)
}

// UnblockIP removes a block
func (h *IPHandler) UnblockIP(c *gin.Context) {
    var req struct {
        IP      string `json:"ip"`
        AgentID string `json:"agent_id"`
    }
    if err := c.BindJSON(&req); err != nil {
        c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid request"})
        return
    }

    if err := h.Logs.UnblockIP(req.IP, req.AgentID); err != nil {
        c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
        return
    }

    c.Status(http.StatusOK)
}
