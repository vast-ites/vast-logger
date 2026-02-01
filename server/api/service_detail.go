package api

import (
	"fmt"
	"net/http"
	"time"

	"github.com/gin-gonic/gin"
)

// Service detail endpoints

// HandleGetServiceStats returns comprehensive stats for a service
func (h *IngestionHandler) HandleGetServiceStats(c *gin.Context) {
	serviceName := c.Param("service")
	host := c.Query("host")
	duration := c.DefaultQuery("duration", "1h")

	// Parse duration
	dur, err := parseDuration(duration)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid duration"})
		return
	}

	startTime := time.Now().Add(-dur)

	// Query access logs for stats
	query := `
		SELECT 
			count() as total_requests,
			sum(bytes_sent) as total_bytes,
			countIf(status_code >= 200 AND status_code < 300) as status_2xx,
			countIf(status_code >= 300 AND status_code < 400) as status_3xx,
			countIf(status_code >= 400 AND status_code < 500) as status_4xx,
			countIf(status_code >= 500 AND status_code < 600) as status_5xx
		FROM datavast.access_logs
		WHERE service = ? AND timestamp >= ?
	`

	args := []interface{}{serviceName, startTime}
	if host != "" {
		query += " AND host = ?"
		args = append(args, host)
	}

	rows, err := h.Logs.Query(query, args...)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "query failed"})
		return
	}
	defer rows.Close()

	stats := gin.H{
		"service":       serviceName,
		"host":          host,
		"period":        duration,
		"total_requests": 0,
		"total_bytes":   0,
		"status_2xx":    0,
		"status_3xx":    0,
		"status_4xx":    0,
		"status_5xx":    0,
	}

	if rows.Next() {
		var totalReq, totalBytes, s2xx, s3xx, s4xx, s5xx int64
		if err := rows.Scan(&totalReq, &totalBytes, &s2xx, &s3xx, &s4xx, &s5xx); err == nil {
			stats["total_requests"] = totalReq
			stats["total_bytes"] = totalBytes
			stats["status_2xx"] = s2xx
			stats["status_3xx"] = s3xx
			stats["status_4xx"] = s4xx
			stats["status_5xx"] = s5xx
			
			// Calculate requests per second
			if dur.Seconds() > 0 {
				stats["requests_per_second"] = float64(totalReq) / dur.Seconds()
			}
		}
	}

	c.JSON(http.StatusOK, stats)
}

// HandleGetAccessLogs returns recent access logs for web servers
func (h *IngestionHandler) HandleGetAccessLogs(c *gin.Context) {
	serviceName := c.Param("service")
	host := c.Query("host")
	limit := c.DefaultQuery("limit", "100")
	duration := c.DefaultQuery("duration", "1h")

	dur, err := parseDuration(duration)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid duration"})
		return
	}

	startTime := time.Now().Add(-dur)

	query := `
		SELECT timestamp, ip, method, path, status_code, bytes_sent, country, city
		FROM datavast.access_logs
		WHERE service = ? AND timestamp >= ?
	`

	args := []interface{}{serviceName, startTime}
	if host != "" {
		query += " AND host = ?"
		args = append(args, host)
	}

	query += fmt.Sprintf(" ORDER BY timestamp DESC LIMIT %s", limit)

	rows, err := h.Logs.Query(query, args...)
	if err != nil {
		c.JSON(http.StatusOK, gin.H{"logs": []gin.H{}, "count": 0})
		return
	}
	defer rows.Close()

	var logs []gin.H
	for rows.Next() {
		var timestamp time.Time
		var ip, method, path, country, city string
		var statusCode int
		var bytesSent int64

		if err := rows.Scan(&timestamp, &ip, &method, &path, &statusCode, &bytesSent, &country, &city); err == nil {
			logs = append(logs, gin.H{
				"timestamp":   timestamp,
				"ip":          ip,
				"method":      method,
				"path":        path,
				"status_code": statusCode,
				"bytes_sent":  bytesSent,
				"country":     country,
				"city":        city,
			})
		}
	}

	c.JSON(http.StatusOK, gin.H{
		"logs":  logs,
		"count": len(logs),
	})
}

// HandleGetGeoStats returns geographic distribution for a service
func (h *IngestionHandler) HandleGetGeoStats(c *gin.Context) {
	serviceName := c.Param("service")
	host := c.Query("host")
	duration := c.DefaultQuery("duration", "1h")

	dur, err := parseDuration(duration)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid duration"})
		return
	}

	startTime := time.Now().Add(-dur)

	// Query for top countries
	countryQuery := `
		SELECT country, count() as count
		FROM datavast.access_logs
		WHERE service = ? AND timestamp >= ? AND country != ''
	`

	args := []interface{}{serviceName, startTime}
	if host != "" {
		countryQuery += " AND host = ?"
		args = append(args, host)
	}

	countryQuery += " GROUP BY country ORDER BY count DESC LIMIT 10"

	rows, err := h.Logs.Query(countryQuery, args...)
	if err != nil {
		c.JSON(http.StatusOK, gin.H{"top_countries": []gin.H{}, "top_cities": []gin.H{}})
		return
	}
	defer rows.Close()

	var countries []gin.H
	for rows.Next() {
		var country string
		var count int64
		if err := rows.Scan(&country, &count); err == nil {
			countries = append(countries, gin.H{
				"country": country,
				"count":   count,
			})
		}
	}

	// Query for top cities
	cityQuery := `
		SELECT city, country, count() as count
		FROM datavast.access_logs
		WHERE service = ? AND timestamp >= ? AND city != ''
	`

	cityArgs := []interface{}{serviceName, startTime}
	if host != "" {
		cityQuery += " AND host = ?"
		cityArgs = append(cityArgs, host)
	}

	cityQuery += " GROUP BY city, country ORDER BY count DESC LIMIT 10"

	cityRows, err := h.Logs.Query(cityQuery, cityArgs...)
	if err == nil {
		defer cityRows.Close()
		var cities []gin.H
		for cityRows.Next() {
			var city, country string
			var count int64
			if err := cityRows.Scan(&city, &country, &count); err == nil {
				cities = append(cities, gin.H{
					"city":    city,
					"country": country,
					"count":   count,
				})
			}
		}

		c.JSON(http.StatusOK, gin.H{
			"top_countries": countries,
			"top_cities":    cities,
		})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"top_countries": countries,
		"top_cities":    []gin.H{},
	})
}

// HandleGetTopIPs returns top IPs by requests or bandwidth
func (h *IngestionHandler) HandleGetTopIPs(c *gin.Context) {
	serviceName := c.Param("service")
	host := c.Query("host")
	limit := c.DefaultQuery("limit", "10")
	duration := c.DefaultQuery("duration", "1h")

	dur, err := parseDuration(duration)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid duration"})
		return
	}

	startTime := time.Now().Add(-dur)

	// Query for top IPs by request count
	query := `
		SELECT ip, count() as requests, sum(bytes_sent) as bytes, any(country) as country
		FROM datavast.access_logs
		WHERE service = ? AND timestamp >= ?
	`

	args := []interface{}{serviceName, startTime}
	if host != "" {
		query += " AND host = ?"
		args = append(args, host)
	}

	query += fmt.Sprintf(" GROUP BY ip ORDER BY requests DESC LIMIT %s", limit)

	rows, err := h.Logs.Query(query, args...)
	if err != nil {
		c.JSON(http.StatusOK, gin.H{"by_requests": []gin.H{}})
		return
	}
	defer rows.Close()

	var topIPs []gin.H
	for rows.Next() {
		var ip, country string
		var requests int64
		var bytes int64

		if err := rows.Scan(&ip, &requests, &bytes, &country); err == nil {
			topIPs = append(topIPs, gin.H{
				"ip":       ip,
				"requests": requests,
				"bytes":    bytes,
				"country":  country,
			})
		}
	}

	c.JSON(http.StatusOK, gin.H{
		"by_requests": topIPs,
	})
}

// parseDuration converts string duration to time.Duration
func parseDuration(s string) (time.Duration, error) {
	switch s {
	case "5m":
		return 5 * time.Minute, nil
	case "15m":
		return 15 * time.Minute, nil
	case "1h":
		return time.Hour, nil
	case "6h":
		return 6 * time.Hour, nil
	case "24h":
		return 24 * time.Hour, nil
	case "7d":
		return 7 * 24 * time.Hour, nil
	default:
		return time.ParseDuration(s)
	}
}
// MySQL-specific API endpoints

// HandleGetMySQLStatus returns MySQL server status and metrics
func (h *IngestionHandler) HandleGetMySQLStatus(c *gin.Context) {
	host := c.Query("host")
	duration := c.DefaultQuery("duration", "1h")

	dur, err := parseDuration(duration)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid duration"})
		return
	}

	startTime := time.Now().Add(-dur)

	// Query mysql_stats table for latest stats
	query := `
		SELECT 
			timestamp,
			total_connections,
			max_connections,
			threads_connected,
			threads_running,
			slow_queries,
			queries_per_second,
			is_master,
			replication_lag_seconds,
			query_cache_hit_rate,
			innodb_buffer_pool_size,
			aborted_connections
		FROM datavast.mysql_stats
		WHERE timestamp >= ?
	`

	args := []interface{}{startTime}
	if host != "" {
		query += " AND host = ?"
		args = append(args, host)
	}

	query += " ORDER BY timestamp DESC LIMIT 1"

	rows, err := h.Logs.Query(query, args...)
	if err != nil {
		c.JSON(http.StatusOK, gin.H{"stats": nil})
		return
	}
	defer rows.Close()

	if rows.Next() {
		var (
			timestamp            time.Time
			totalConn, maxConn   int
			threadsConn, threadsRun int
			slowQueries          int64
			qps                  float64
			isMaster             bool
			repLag               int
			queryCacheHitRate    float64
			bufferPool           int64
			abortedConn          int
		)

		if err := rows.Scan(&timestamp, &totalConn, &maxConn, &threadsConn, &threadsRun,
			&slowQueries, &qps, &isMaster, &repLag, &queryCacheHitRate, &bufferPool, &abortedConn); err == nil {
			
			c.JSON(http.StatusOK, gin.H{
				"timestamp":            timestamp,
				"total_connections":     totalConn,
				"max_connections":       maxConn,
				"threads_connected":     threadsConn,
				"threads_running":       threadsRun,
				"slow_queries":          slowQueries,
				"queries_per_second":    qps,
				"is_master":             isMaster,
				"replication_lag":       repLag,
				"query_cache_hit_rate":  queryCacheHitRate,
				"innodb_buffer_pool_size": bufferPool,
				"aborted_connections":   abortedConn,
			})
			return
		}
	}

	c.JSON(http.StatusOK, gin.H{"stats": nil})
}

// HandleGetMySQLSlowQueries returns slow query log entries
func (h *IngestionHandler) HandleGetMySQLSlowQueries(c *gin.Context) {
	host := c.Query("host")
	limit := c.DefaultQuery("limit", "50")
	duration := c.DefaultQuery("duration", "1h")

	dur, err := parseDuration(duration)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid duration"})
		return
	}

	startTime := time.Now().Add(-dur)

	query := `
		SELECT timestamp, query_time, lock_time, rows_examined, rows_sent, query_text, client_ip
		FROM datavast.slow_queries
		WHERE service = 'mysql' AND timestamp >= ?
	`

	args := []interface{}{startTime}
	if host != "" {
		query += " AND host = ?"
		args = append(args, host)
	}

	query += fmt.Sprintf(" ORDER BY query_time DESC LIMIT %s", limit)

	rows, err := h.Logs.Query(query, args...)
	if err != nil {
		c.JSON(http.StatusOK, gin.H{"queries": []gin.H{}})
		return
	}
	defer rows.Close()

	var queries []gin.H
	for rows.Next() {
		var (
			timestamp              time.Time
			queryTime, lockTime    float64
			rowsExam, rowsSent     int64
			queryText, clientIP    string
		)

		if err := rows.Scan(&timestamp, &queryTime, &lockTime, &rowsExam, &rowsSent, &queryText, &clientIP); err == nil {
			queries = append(queries, gin.H{
				"timestamp":      timestamp,
				"query_time":     queryTime,
				"lock_time":      lockTime,
				"rows_examined":  rowsExam,
				"rows_sent":      rowsSent,
				"query_text":     queryText,
				"client_ip":      clientIP,
			})
		}
	}

	c.JSON(http.StatusOK, gin.H{
		"queries": queries,
		"count":   len(queries),
	})
}

// HandleGetMySQLConnections returns connection statistics
func (h *IngestionHandler) HandleGetMySQLConnections(c *gin.Context) {
	host := c.Query("host")
	duration := c.DefaultQuery("duration", "1h")

	dur, err := parseDuration(duration)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid duration"})
		return
	}

	startTime := time.Now().Add(-dur)

	// Get connections by IP from service_connections table
	query := `
		SELECT client_ip, count() as connection_count, any(country) as country
		FROM datavast.service_connections
		WHERE service = 'mysql' AND timestamp >= ?
	`

	args := []interface{}{startTime}
	if host != "" {
		query += " AND host = ?"
		args = append(args, host)
	}

	query += " GROUP BY client_ip ORDER BY connection_count DESC LIMIT 20"

	rows, err := h.Logs.Query(query, args...)
	if err != nil {
		c.JSON(http.StatusOK, gin.H{"connections": []gin.H{}})
		return
	}
	defer rows.Close()

	var connections []gin.H
	for rows.Next() {
		var ip, country string
		var count int64

		if err := rows.Scan(&ip, &count, &country); err == nil {
			connections = append(connections, gin.H{
				"ip":      ip,
				"count":   count,
				"country": country,
			})
		}
	}

	c.JSON(http.StatusOK, gin.H{
		"connections": connections,
	})
}
