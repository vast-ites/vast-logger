package services

import (
	"context"
	"strconv"
	"strings"
)

// Redis diagnostic methods

// getLargestKeys identifies the largest keys in Redis
func (c *RedisCollector) getLargestKeys() ([]RedisKeyInfo, error) {
	ctx := context.Background()
	
	// Sample keys using SCAN
	var cursor uint64
	var keys []string
	var err error
	
	for len(keys) < 100 {
		var scanKeys []string
		scanKeys, cursor, err = c.client.Scan(ctx, cursor, "*", 100).Result()
		if err != nil {
			break
		}
		
		keys = append(keys, scanKeys...)
		
		if cursor == 0 {
			break
		}
	}
	
	// Get memory usage for sampled keys
	type keyWithSize struct {
		key  string
		size int64
		typ  string
		ttl  int64
	}
	
	var keysSized []keyWithSize
	for _, key := range keys {
		// Get memory usage
		memUsage, err := c.client.MemoryUsage(ctx, key).Result()
		if err != nil {
			continue
		}
		
		// Get type
		keyType, _ := c.client.Type(ctx, key).Result()
		
		// Get TTL
		ttl, _ := c.client.TTL(ctx, key).Result()
		
		keysSized = append(keysSized, keyWithSize{
			key:  key,
			size: memUsage,
			typ:  keyType,
			ttl:  int64(ttl.Seconds()),
		})
	}
	
	// Sort by size (simple bubble sort for top 20)
	for i := 0; i < len(keysSized)-1; i++ {
		for j := 0; j < len(keysSized)-i-1; j++ {
			if keysSized[j].size < keysSized[j+1].size {
				keysSized[j], keysSized[j+1] = keysSized[j+1], keysSized[j]
			}
		}
	}
	
	// Take top 20
	limit := 20
	if len(keysSized) < limit {
		limit = len(keysSized)
	}
	
	var result []RedisKeyInfo
	for i := 0; i < limit; i++ {
		result = append(result, RedisKeyInfo{
			Key:       keysSized[i].key,
			SizeBytes: keysSized[i].size,
			Type:      keysSized[i].typ,
			TTL:       keysSized[i].ttl,
		})
	}
	
	return result, nil
}

// getExpensiveCommands retrieves CPU-heavy commands from INFO COMMANDSTATS
func (c *RedisCollector) getExpensiveCommands() ([]RedisCommandStat, error) {
	ctx := context.Background()
	
	info, err := c.client.Info(ctx, "commandstats").Result()
	if err != nil {
		return nil, err
	}
	
	lines := strings.Split(info, "\r\n")
	var commands []RedisCommandStat
	
	for _, line := range lines {
		if strings.HasPrefix(line, "cmdstat_") {
			// Format: cmdstat_get:calls=123,usec=456,usec_per_call=3.71
			parts := strings.SplitN(line, ":", 2)
			if len(parts) != 2 {
				continue
			}
			
			cmdName := strings.TrimPrefix(parts[0], "cmdstat_")
			statsStr := parts[1]
			
			cmd := RedisCommandStat{Command: cmdName}
			
			// Parse stats
			statPairs := strings.Split(statsStr, ",")
			for _, pair := range statPairs {
				kv := strings.SplitN(pair, "=", 2)
				if len(kv) != 2 {
					continue
				}
				
				switch kv[0] {
				case "calls":
					cmd.Calls, _ = strconv.ParseInt(kv[1], 10, 64)
				case "usec":
					cmd.TotalUsec, _ = strconv.ParseInt(kv[1], 10, 64)
				case "usec_per_call":
					cmd.UsecPerCall, _ = strconv.ParseFloat(kv[1], 64)
				}
			}
			
			commands = append(commands, cmd)
		}
	}
	
	// Sort by usec_per_call (simple bubble sort for top 20)
	for i := 0; i < len(commands)-1; i++ {
		for j := 0; j < len(commands)-i-1; j++ {
			if commands[j].UsecPerCall < commands[j+1].UsecPerCall {
				commands[j], commands[j+1] = commands[j+1], commands[j]
			}
		}
	}
	
	// Take top 20
	limit := 20
	if len(commands) < limit {
		limit = len(commands)
	}
	
	return commands[:limit], nil
}

// calculateEvictionRate calculates eviction rate per second
func (c *RedisCollector) calculateEvictionRate(evictedKeys int64, uptimeSeconds int64) float64 {
	if uptimeSeconds > 0 {
		return float64(evictedKeys) / float64(uptimeSeconds)
	}
	return 0
}

// CollectDiagnosticsRedis gathers all Redis performance diagnostics
func (c *RedisCollector) CollectDiagnosticsRedis(stats *RedisStats) {
	// Calculate eviction rate
	stats.EvictionRate = c.calculateEvictionRate(stats.EvictedKeys, stats.UptimeSeconds)
	
	// Get largest keys (this can be slow, limit sampling)
	if keys, err := c.getLargestKeys(); err == nil {
		stats.LargestKeys = keys
	}
	
	// Get expensive commands
	if commands, err := c.getExpensiveCommands(); err == nil {
		stats.ExpensiveCommands = commands
	}
}
