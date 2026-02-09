package services

import (
	"bufio"
	"fmt"
	"os"
	"regexp"
	"strconv"
	"time"
)

// AccessLogEntry represents a parsed web server access log entry
type AccessLogEntry struct {
	Timestamp  time.Time
	IP         string
	Method     string
	Path       string
	StatusCode int
	BytesSent  int64
	UserAgent  string
	Service    string
}

// WebServerCollector collects access logs from web servers
type WebServerCollector struct {
	LogPath string
	Service string // "apache" or "nginx"
}

// NewWebServerCollector creates a new web server collector
func NewWebServerCollector(logPath, service string) *WebServerCollector {
	return &WebServerCollector{
		LogPath: logPath,
		Service: service,
	}
}

// ParseCombinedLog parses Apache/Nginx combined log format
// Example: 127.0.0.1 - - [01/Feb/2026:23:00:00 +0000] "GET /api HTTP/1.1" 200 1234 "-" "Mozilla/5.0"
func (c *WebServerCollector) ParseCombinedLog(line string) (*AccessLogEntry, error) {
	// Combined log format regex
	re := regexp.MustCompile(`^(\S+) \S+ \S+ \[([^\]]+)\] "(\S+) (\S+) \S+" (\d{3}) (\d+|-) "([^"]*)" "([^"]*)"`)
	matches := re.FindStringSubmatch(line)
	
	if len(matches) < 9 {
		return nil, fmt.Errorf("invalid log format")
	}

	// Parse timestamp
	timeStr := matches[2]
	timestamp, err := time.Parse("02/Jan/2006:15:04:05 -0700", timeStr)
	if err != nil {
		timestamp = time.Now()
	}

	// Parse status code
	statusCode, _ := strconv.Atoi(matches[5])

	// Parse bytes sent
	var bytesSent int64
	if matches[6] != "-" {
		bytesSent, _ = strconv.ParseInt(matches[6], 10, 64)
	}

	return &AccessLogEntry{
		Timestamp:  timestamp,
		IP:         matches[1],
		Method:     matches[3],
		Path:       matches[4],
		StatusCode: statusCode,
		BytesSent:  bytesSent,
		UserAgent:  matches[8],
		Service:    c.Service,
	}, nil
}

// TailLogs reads the last N lines from the log file
func (c *WebServerCollector) TailLogs(numLines int) ([]AccessLogEntry, error) {
	file, err := os.Open(c.LogPath)
	if err != nil {
		return nil, fmt.Errorf("failed to open log file: %w", err)
	}
	defer file.Close()

	var lines []string
	scanner := bufio.NewScanner(file)
	
	// Read all lines into memory (for simplicity; in production, use a circular buffer)
	for scanner.Scan() {
		lines = append(lines, scanner.Text())
	}

	if err := scanner.Err(); err != nil {
		return nil, err
	}

	// Get last N lines
	start := 0
	if len(lines) > numLines {
		start = len(lines) - numLines
	}
	
	var entries []AccessLogEntry
	for _, line := range lines[start:] {
		if entry, err := c.ParseCombinedLog(line); err == nil {
			entries = append(entries, *entry)
		}
	}

	return entries, nil
}

// GetStats calculates statistics from access logs
func (c *WebServerCollector) GetStats(entries []AccessLogEntry) map[string]interface{} {
	stats := make(map[string]interface{})
	
	var totalBytes int64
	statusCodes := make(map[int]int)
	methods := make(map[string]int)
	
	for _, entry := range entries {
		totalBytes += entry.BytesSent
		statusCodes[entry.StatusCode]++
		methods[entry.Method]++
	}

	// Count by status code category
	var count2xx, count3xx, count4xx, count5xx int
	for code, count := range statusCodes {
		switch code / 100 {
		case 2:
			count2xx += count
		case 3:
			count3xx += count
		case 4:
			count4xx += count
		case 5:
			count5xx += count
		}
	}

	stats["total_requests"] = len(entries)
	stats["total_bytes"] = totalBytes
	stats["status_2xx"] = count2xx
	stats["status_3xx"] = count3xx
	stats["status_4xx"] = count4xx
	stats["status_5xx"] = count5xx
	
	// Calculate time span for rate
	if len(entries) > 0 {
		duration := entries[len(entries)-1].Timestamp.Sub(entries[0].Timestamp).Seconds()
		if duration > 0 {
			stats["requests_per_second"] = float64(len(entries)) / duration
		}
	}

	return stats
}

// GetTopIPs returns the top N IPs by request count
func (c *WebServerCollector) GetTopIPs(entries []AccessLogEntry, limit int) []map[string]interface{} {
	ipCounts := make(map[string]int)
	ipBytes := make(map[string]int64)
	
	for _, entry := range entries {
		ipCounts[entry.IP]++
		ipBytes[entry.IP] += entry.BytesSent
	}

	// Convert to slice for sorting
	type ipStat struct {
		IP       string
		Requests int
		Bytes    int64
	}
	
	var stats []ipStat
	for ip, count := range ipCounts {
		stats = append(stats, ipStat{
			IP:       ip,
			Requests: count,
			Bytes:    ipBytes[ip],
		})
	}

	// Simple sort by request count (bubble sort for simplicity)
	for i := 0; i < len(stats); i++ {
		for j := i + 1; j < len(stats); j++ {
			if stats[j].Requests > stats[i].Requests {
				stats[i], stats[j] = stats[j], stats[i]
			}
		}
	}

	// Limit results
	if len(stats) > limit {
		stats = stats[:limit]
	}

	// Convert to map array
	var result []map[string]interface{}
	for _, stat := range stats {
		result = append(result, map[string]interface{}{
			"ip":       stat.IP,
			"requests": stat.Requests,
			"bytes":    stat.Bytes,
		})
	}

	return result
}
