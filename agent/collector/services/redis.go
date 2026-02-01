package services

import (
	"bufio"
	"fmt"
	"strconv"
	"strings"
	"time"

	"github.com/go-redis/redis/v8"
	"golang.org/x/net/context"
)

// RedisCollector collects metrics from Redis
type RedisCollector struct {
	Address  string
	Password string
	client   *redis.Client
}

// RedisStats represents Redis statistics
type RedisStats struct {
	Timestamp          time.Time
	Version            string
	UptimeSeconds      int64
	ConnectedClients   int
	BlockedClients     int
	UsedMemory         int64
	MaxMemory          int64
	MemoryFragmentation float64
	TotalCommands      int64
	OpsPerSec          int64
	KeyspaceHits       int64
	KeyspaceMisses     int64
	HitRate            float64
	EvictedKeys        int64
	ExpiredKeys        int64
	Role               string
	ReplicationLag     int
}

// NewRedisCollector creates a Redis collector
func NewRedisCollector(address, password string) (*RedisCollector, error) {
	client := redis.NewClient(&redis.Options{
		Addr:     address,
		Password: password,
		DB:       0,
	})

	ctx := context.Background()
	if err := client.Ping(ctx).Err(); err != nil {
		return nil, fmt.Errorf("failed to connect to Redis: %w", err)
	}

	return &RedisCollector{
		Address:  address,
		Password: password,
		client:   client,
	}, nil
}

// GetStats retrieves comprehensive Redis statistics
func (c *RedisCollector) GetStats() (*RedisStats, error) {
	ctx := context.Background()
	stats := &RedisStats{
		Timestamp: time.Now(),
	}

	// Get INFO output
	info, err := c.client.Info(ctx).Result()
	if err != nil {
		return nil, err
	}

	// Parse INFO sections
	lines := strings.Split(info, "\r\n")
	infoMap := make(map[string]string)
	
	for _, line := range lines {
		if strings.Contains(line, ":") && !strings.HasPrefix(line, "#") {
			parts := strings.SplitN(line, ":", 2)
			if len(parts) == 2 {
				infoMap[parts[0]] = parts[1]
			}
		}
	}

	// Parse statistics
	stats.Version = infoMap["redis_version"]
	stats.UptimeSeconds = parseInt64(infoMap["uptime_in_seconds"])
	stats.ConnectedClients = parseInt(infoMap["connected_clients"])
	stats.BlockedClients = parseInt(infoMap["blocked_clients"])
	stats.UsedMemory = parseInt64(infoMap["used_memory"])
	stats.MaxMemory = parseInt64(infoMap["maxmemory"])
	stats.MemoryFragmentation = parseFloat64(infoMap["mem_fragmentation_ratio"])
	stats.TotalCommands = parseInt64(infoMap["total_commands_processed"])
	stats.OpsPerSec = parseInt64(infoMap["instantaneous_ops_per_sec"])
	stats.KeyspaceHits = parseInt64(infoMap["keyspace_hits"])
	stats.KeyspaceMisses = parseInt64(infoMap["keyspace_misses"])
	stats.EvictedKeys = parseInt64(infoMap["evicted_keys"])
	stats.ExpiredKeys = parseInt64(infoMap["expired_keys"])
	stats.Role = infoMap["role"]

	// Calculate hit rate
	totalOps := stats.KeyspaceHits + stats.KeyspaceMisses
	if totalOps > 0 {
		stats.HitRate = (float64(stats.KeyspaceHits) / float64(totalOps)) * 100
	}

	// Get replication lag if slave
	if stats.Role == "slave" {
		stats.ReplicationLag = parseInt(infoMap["master_repl_offset"]) - parseInt(infoMap["slave_repl_offset"])
	}

	return stats, nil
}

// GetKeyspaceInfo retrieves keyspace information
func (c *RedisCollector) GetKeyspaceInfo() ([]map[string]interface{}, error) {
	ctx := context.Background()
	info, err := c.client.Info(ctx, "keyspace").Result()
	if err != nil {
		return nil, err
	}

	var keyspaces []map[string]interface{}
	scanner := bufio.NewScanner(strings.NewReader(info))
	
	for scanner.Scan() {
		line := scanner.Text()
		if strings.HasPrefix(line, "db") {
			parts := strings.SplitN(line, ":", 2)
			if len(parts) == 2 {
				dbName := parts[0]
				dbInfo := make(map[string]interface{})
				dbInfo["database"] = dbName
				
				// Parse db stats: keys=1234,expires=56,avg_ttl=789
				statPairs := strings.Split(parts[1], ",")
				for _, pair := range statPairs {
					kv := strings.SplitN(pair, "=", 2)
					if len(kv) == 2 {
						dbInfo[kv[0]] = kv[1]
					}
				}
				
				keyspaces = append(keyspaces, dbInfo)
			}
		}
	}

	return keyspaces, nil
}

// GetSlowLog retrieves slow log entries
func (c *RedisCollector) GetSlowLog(limit int) ([]map[string]interface{}, error) {
	ctx := context.Background()
	
	// Get slow log
	result, err := c.client.Do(ctx, "SLOWLOG", "GET", limit).Result()
	if err != nil {
		return nil, err
	}

	slowLogs := []map[string]interface{}{}
	
	// Parse slowlog result (it's a nested array)
	if entries, ok := result.([]interface{}); ok {
		for _, entry := range entries {
			if logEntry, ok := entry.([]interface{}); ok && len(logEntry) >= 4 {
				slowLogs = append(slowLogs, map[string]interface{}{
					"id":        logEntry[0],
					"timestamp": logEntry[1],
					"duration":  logEntry[2], // microseconds
					"command":   logEntry[3],
				})
			}
		}
	}

	return slowLogs, nil
}

// Close closes the Redis connection
func (c *RedisCollector) Close() error {
	if c.client != nil {
		return c.client.Close()
	}
	return nil
}

// Helper functions
func parseFloat64(s string) float64 {
	f, _ := strconv.ParseFloat(s, 64)
	return f
}
