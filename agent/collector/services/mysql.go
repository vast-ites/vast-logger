package services

import (
	"bufio"
	"database/sql"
	"fmt"
	"os"
	"regexp"
	"strconv"
	"strings"
	"time"

	_ "github.com/go-sql-driver/mysql"
)

// MySQLCollector collects metrics from MySQL database
type MySQLCollector struct {
	DSN string // Data Source Name: "user:password@tcp(host:port)/database"
	db  *sql.DB
}

// MySQLStats represents MySQL server statistics
type MySQLStats struct {
	Timestamp            time.Time
	TotalConnections     int
	MaxConnections       int
	ThreadsConnected     int
	ThreadsRunning       int
	SlowQueries          int64
	QueriesPerSecond     float64
	IsMaster             bool
	ReplicationLag       int
	QueryCacheHitRate    float64
	InnoDBBufferPoolSize int64
	AbortedConnections   int
	Uptime               int64
}

// SlowQuery represents a slow query log entry
type SlowQuery struct {
	Timestamp    time.Time
	QueryTime    float64
	LockTime     float64
	RowsExamined int64
	RowsSent     int64
	QueryText    string
	ClientIP     string
}

// ProcessListEntry represents an active connection
type ProcessListEntry struct {
	ID       int
	User     string
	Host     string
	Database string
	Command  string
	Time     int
	State    string
	Info     string
}

// NewMySQLCollector creates a new MySQL collector
func NewMySQLCollector(dsn string) (*MySQLCollector, error) {
	db, err := sql.Open("mysql", dsn)
	if err != nil {
		return nil, fmt.Errorf("failed to connect to MySQL: %w", err)
	}

	// Test connection
	if err := db.Ping(); err != nil {
		return nil, fmt.Errorf("failed to ping MySQL: %w", err)
	}

	return &MySQLCollector{
		DSN: dsn,
		db:  db,
	}, nil
}

// GetStats retrieves comprehensive MySQL statistics
func (c *MySQLCollector) GetStats() (*MySQLStats, error) {
	stats := &MySQLStats{
		Timestamp: time.Now(),
	}

	// Get SHOW STATUS variables
	statusVars, err := c.getStatusVariables()
	if err != nil {
		return nil, err
	}

	// Get SHOW VARIABLES
	configVars, err := c.getConfigVariables()
	if err != nil {
		return nil, err
	}

	// Parse status variables
	stats.ThreadsConnected = parseInt(statusVars["Threads_connected"])
	stats.ThreadsRunning = parseInt(statusVars["Threads_running"])
	stats.SlowQueries = parseInt64(statusVars["Slow_queries"])
	stats.AbortedConnections = parseInt(statusVars["Aborted_connects"])
	stats.Uptime = parseInt64(statusVars["Uptime"])

	// Parse config variables
	stats.MaxConnections = parseInt(configVars["max_connections"])

	// Calculate QPS
	questions := parseInt64(statusVars["Questions"])
	if stats.Uptime > 0 {
		stats.QueriesPerSecond = float64(questions) / float64(stats.Uptime)
	}

	// Calculate query cache hit rate
	qcHits := parseInt64(statusVars["Qcache_hits"])
	qcInserts := parseInt64(statusVars["Qcache_inserts"])
	if qcHits+qcInserts > 0 {
		stats.QueryCacheHitRate = float64(qcHits) / float64(qcHits+qcInserts) * 100
	}

	// Get replication status
	isMaster, lag := c.getReplicationStatus()
	stats.IsMaster = isMaster
	stats.ReplicationLag = lag

	// Get InnoDB buffer pool size
	stats.InnoDBBufferPoolSize = parseInt64(configVars["innodb_buffer_pool_size"])

	// Get current connection count
	stats.TotalConnections = stats.ThreadsConnected

	return stats, nil
}

// getStatusVariables retrieves SHOW STATUS variables
func (c *MySQLCollector) getStatusVariables() (map[string]string, error) {
	rows, err := c.db.Query("SHOW GLOBAL STATUS")
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	vars := make(map[string]string)
	for rows.Next() {
		var name, value string
		if err := rows.Scan(&name, &value); err == nil {
			vars[name] = value
		}
	}

	return vars, nil
}

// getConfigVariables retrieves SHOW VARIABLES
func (c *MySQLCollector) getConfigVariables() (map[string]string, error) {
	rows, err := c.db.Query("SHOW VARIABLES")
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	vars := make(map[string]string)
	for rows.Next() {
		var name, value string
		if err := rows.Scan(&name, &value); err == nil {
			vars[name] = value
		}
	}

	return vars, nil
}

// getReplicationStatus checks if this is master/slave and gets replication lag
func (c *MySQLCollector) getReplicationStatus() (isMaster bool, lagSeconds int) {
	// Try to get slave status
	row := c.db.QueryRow("SHOW SLAVE STATUS")
	
	var (
		slaveIORunning  sql.NullString
		slaveSQLRunning sql.NullString
		secondsBehind   sql.NullInt64
		// Other columns (MySQL has many columns in SHOW SLAVE STATUS)
		dummyStrings [50]sql.NullString
	)

	err := row.Scan(
		&dummyStrings[0], &slaveIORunning, &dummyStrings[1], &dummyStrings[2],
		&slaveSQLRunning, &dummyStrings[3], &dummyStrings[4], &dummyStrings[5],
		&dummyStrings[6], &dummyStrings[7], &secondsBehind,
		// ... (SHOW SLAVE STATUS has ~40 columns, this is simplified)
	)

	if err != nil {
		// Error means likely not a slave or no replication configured
		return true, 0 // Assume master
	}

	// If we got slave status, this is a slave
	if secondsBehind.Valid {
		return false, int(secondsBehind.Int64)
	}

	return false, 0
}

// GetProcessList retrieves active connections
func (c *MySQLCollector) GetProcessList() ([]ProcessListEntry, error) {
	rows, err := c.db.Query("SHOW FULL PROCESSLIST")
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var entries []ProcessListEntry
	for rows.Next() {
		var entry ProcessListEntry
		var info sql.NullString
		var state sql.NullString
		var db sql.NullString

		err := rows.Scan(
			&entry.ID,
			&entry.User,
			&entry.Host,
			&db,
			&entry.Command,
			&entry.Time,
			&state,
			&info,
		)

		if err == nil {
			if db.Valid {
				entry.Database = db.String
			}
			if state.Valid {
				entry.State = state.String
			}
			if info.Valid {
				entry.Info = info.String
			}
			entries = append(entries, entry)
		}
	}

	return entries, nil
}

// ParseSlowQueryLog parses MySQL slow query log
func (c *MySQLCollector) ParseSlowQueryLog(logPath string, limit int) ([]SlowQuery, error) {
	file, err := os.Open(logPath)
	if err != nil {
		return nil, fmt.Errorf("failed to open slow query log: %w", err)
	}
	defer file.Close()

	var queries []SlowQuery
	scanner := bufio.NewScanner(file)
	
	// Simple parser (production should be more robust)
	var currentQuery *SlowQuery
	queryText := ""

	for scanner.Scan() {
		line := scanner.Text()

		// Time line: # Time: 2026-02-01T23:30:00.123456Z
		if strings.HasPrefix(line, "# Time:") {
			if currentQuery != nil && queryText != "" {
				currentQuery.QueryText = strings.TrimSpace(queryText)
				queries = append(queries, *currentQuery)
				if len(queries) >= limit {
					break
				}
			}
			currentQuery = &SlowQuery{}
			queryText = ""
			
			// Parse timestamp
			timeStr := strings.TrimPrefix(line, "# Time: ")
			if t, err := time.Parse("2006-01-02T15:04:05.999999Z", timeStr); err == nil {
				currentQuery.Timestamp = t
			}
		}

		// Query time line: # Query_time: 1.234567  Lock_time: 0.000123 Rows_sent: 100  Rows_examined: 10000
		if strings.HasPrefix(line, "# Query_time:") {
			re := regexp.MustCompile(`Query_time:\s+([\d.]+)\s+Lock_time:\s+([\d.]+)\s+Rows_sent:\s+(\d+)\s+Rows_examined:\s+(\d+)`)
			matches := re.FindStringSubmatch(line)
			if len(matches) == 5 {
				currentQuery.QueryTime, _ = strconv.ParseFloat(matches[1], 64)
				currentQuery.LockTime, _ = strconv.ParseFloat(matches[2], 64)
				currentQuery.RowsSent, _ = strconv.ParseInt(matches[3], 10, 64)
				currentQuery.RowsExamined, _ = strconv.ParseInt(matches[4], 10, 64)
			}
		}

		// User/Host line: # User@Host: root[root] @ localhost []
		if strings.HasPrefix(line, "# User@Host:") {
			re := regexp.MustCompile(`@\s+([\w.-]+)\s+\[([^\]]*)\]`)
			matches := re.FindStringSubmatch(line)
			if len(matches) >= 3 {
				currentQuery.ClientIP = matches[2]
				if currentQuery.ClientIP == "" {
					currentQuery.ClientIP = matches[1]
				}
			}
		}

		// Query text (doesn't start with #)
		if !strings.HasPrefix(line, "#") && strings.TrimSpace(line) != "" {
			queryText += line + " "
		}
	}

	// Add last query
	if currentQuery != nil && queryText != "" {
		currentQuery.QueryText = strings.TrimSpace(queryText)
		queries = append(queries, *currentQuery)
	}

	return queries, nil
}

// Close closes the database connection
func (c *MySQLCollector) Close() error {
	if c.db != nil {
		return c.db.Close()
	}
	return nil
}

// Helper functions
func parseInt(s string) int {
	i, _ := strconv.Atoi(s)
	return i
}

func parseInt64(s string) int64 {
	i, _ := strconv.ParseInt(s, 10, 64)
	return i
}
