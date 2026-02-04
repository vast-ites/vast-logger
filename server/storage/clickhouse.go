package storage

import (
	"context"
	"fmt"
	"time"
	"sync"

	"github.com/ClickHouse/clickhouse-go/v2"
	"github.com/ClickHouse/clickhouse-go/v2/lib/driver"
)

type LogStore struct {
	conn driver.Conn
	mu   sync.Mutex
}

type LogEntry struct {
	Timestamp   time.Time `json:"timestamp"`
	Host        string    `json:"host"`
	Service     string    `json:"service"`
	Level       string    `json:"level"`
	Message     string    `json:"message"`
	SourcePath  string    `json:"source_path"`
}

func NewLogStore(dsn string) (*LogStore, error) {
    var opts *clickhouse.Options
    var err error

    if dsn != "" {
        opts, err = clickhouse.ParseDSN(dsn)
        if err != nil {
            return nil, fmt.Errorf("invalid dsn: %w", err)
        }
    } else {
        opts = &clickhouse.Options{
            Addr: []string{"127.0.0.1:9000"},
            Auth: clickhouse.Auth{
                Database: "default",
                Username: "datavast",
                Password: "securepass",
            },
        }
    }

	conn, err := clickhouse.Open(opts)
	if err != nil {
		return nil, err
	}

	if err := conn.Ping(context.Background()); err != nil {
		return nil, err
	}
	
	// Create Database
	err = conn.Exec(context.Background(), `CREATE DATABASE IF NOT EXISTS datavast`)
	if err != nil {
		return nil, fmt.Errorf("failed to create db: %w", err)
	}

	// Create table
	err = conn.Exec(context.Background(), `
		CREATE TABLE IF NOT EXISTS datavast.logs (
			timestamp DateTime,
			host String,
			service String,
			level String,
			message String,
			source_path String
		) ENGINE = MergeTree()
		ORDER BY (timestamp, service)
	`)
	if err != nil {
		return nil, err
	}

	// Create Process Table
	err = conn.Exec(context.Background(), `
		CREATE TABLE IF NOT EXISTS datavast.processes (
			timestamp DateTime,
			host String,
			pid Int32,
			name String,
			username String,
			cpu_percent Float64,
			memory_percent Float64,
			cmdline String
		) ENGINE = MergeTree()
		ORDER BY (timestamp, host)
		TTL timestamp + INTERVAL 1 DAY
	`)
	if err != nil {
		return nil, err
	}

    // Create Firewall Table
    err = conn.Exec(context.Background(), `
        CREATE TABLE IF NOT EXISTS datavast.firewall (
            timestamp DateTime,
            host String,
            rules String
        ) ENGINE = MergeTree()
        ORDER BY (timestamp, host)
        TTL timestamp + INTERVAL 1 DAY
    `)
    if err != nil {
        return nil, err
    }

	// Create Access Logs Table (for Apache/Nginx web traffic)
	err = conn.Exec(context.Background(), `
		CREATE TABLE IF NOT EXISTS datavast.access_logs (
			timestamp DateTime,
			service String,
			host String,
			ip String,
			method String,
			path String,
			status_code UInt16,
			bytes_sent UInt64,
			user_agent String,
			country String,
			region String,
			city String,
			latitude Float32,
			longitude Float32,
			domain String
		) ENGINE = MergeTree()
		ORDER BY (timestamp, service, host)
	`)
	if err != nil {
		return nil, err
	}

    // Create Alerts Table
    err = conn.Exec(context.Background(), `
        CREATE TABLE IF NOT EXISTS datavast.alerts (
            timestamp DateTime,
            host String,
            type String,
            severity String,
            message String,
            resolved UInt8
        ) ENGINE = MergeTree()
        ORDER BY (timestamp, host)
        TTL timestamp + INTERVAL 30 DAY
    `)
    if err != nil {
        return nil, err
    }

	return &LogStore{conn: conn}, nil
}

// Query executes a query with parameters
func (s *LogStore) Query(query string, args ...interface{}) (driver.Rows, error) {
	s.mu.Lock()
	defer s.mu.Unlock()
	return s.conn.Query(context.Background(), query, args...)
}

// ... InsertLog ...

type ProcessEntry struct {
    Timestamp     time.Time `json:"timestamp"`
    Host          string    `json:"host"`
    PID           int32     `json:"pid"`
    Name          string    `json:"name"`
    Username      string    `json:"username"`
    CPUPercent    float64   `json:"cpu_percent"`
    MemoryPercent float64   `json:"memory_percent"`
    Cmdline       string    `json:"cmdline"`
}

func (s *LogStore) InsertProcesses(entries []ProcessEntry) error {
	s.mu.Lock()
	defer s.mu.Unlock()
	batch, err := s.conn.PrepareBatch(context.Background(), "INSERT INTO datavast.processes")
	if err != nil {
		return err
	}
	for _, e := range entries {
		err := batch.Append(
			e.Timestamp, e.Host, e.PID, e.Name, e.Username, 
			e.CPUPercent, e.MemoryPercent, e.Cmdline,
		)
		if err != nil {
			return err
		}
	}
	return batch.Send()
}

func (s *LogStore) GetLatestProcesses(host string) ([]ProcessEntry, error) {
	s.mu.Lock()
	defer s.mu.Unlock()
    // efficient latest query
    query := `
        SELECT timestamp, host, pid, name, username, cpu_percent, memory_percent, cmdline
        FROM datavast.processes
        WHERE host = ? AND timestamp > now() - INTERVAL 5 MINUTE
        ORDER BY timestamp DESC
        LIMIT 50
    `
    // Actually we want the full list from the *latest snapshot*. 
    // Assuming agent sends all in one go or batches closely. 
    // Better approach: Select * where timestamp = (select max(timestamp) from processes where host=?)
    
    query = `
        SELECT timestamp, host, pid, name, username, cpu_percent, memory_percent, cmdline
        FROM datavast.processes
        WHERE host = ? AND timestamp = (
            SELECT max(timestamp) FROM datavast.processes WHERE host = ?
        )
        ORDER BY cpu_percent DESC
        LIMIT 50
    `
    
    rows, err := s.conn.Query(context.Background(), query, host, host)
    if err != nil {
        return nil, err
    }
    defer rows.Close()
    
    var procs []ProcessEntry
    for rows.Next() {
        var p ProcessEntry
        if err := rows.Scan(&p.Timestamp, &p.Host, &p.PID, &p.Name, &p.Username, &p.CPUPercent, &p.MemoryPercent, &p.Cmdline); err != nil {
            return nil, err
        }
        procs = append(procs, p)
    }
    return procs, nil
}

func (s *LogStore) InsertFirewall(timestamp time.Time, host, rules string) error {
	s.mu.Lock()
	defer s.mu.Unlock()
     return s.conn.Exec(context.Background(), `
        INSERT INTO datavast.firewall (timestamp, host, rules) VALUES (?, ?, ?)
     `, timestamp, host, rules)
}

func (s *LogStore) GetLatestFirewall(host string) (string, error) {
	s.mu.Lock()
	defer s.mu.Unlock()
    var rules string
    err := s.conn.QueryRow(context.Background(), `
        SELECT rules FROM datavast.firewall 
        WHERE host = ? ORDER BY timestamp DESC LIMIT 1
    `, host).Scan(&rules)
    if err != nil {
        return "", err
    }
    return rules, nil
}

type AlertEntry struct {
    Timestamp DateTime `json:"timestamp"`
    Host      string   `json:"host"`
    Type      string   `json:"type"`
    Severity  string   `json:"severity"`
    Message   string   `json:"message"`
    Resolved  bool     `json:"resolved"` // stored as UInt8
}

// DateTime alias to standard time.Time for JSON
type DateTime = time.Time

func (s *LogStore) InsertAlert(entry AlertEntry) error {
    s.mu.Lock()
    defer s.mu.Unlock()
    
    resolvedInt := uint8(0)
    if entry.Resolved { resolvedInt = 1 }

    return s.conn.Exec(context.Background(), `
        INSERT INTO datavast.alerts (timestamp, host, type, severity, message, resolved)
        VALUES (?, ?, ?, ?, ?, ?)
    `, entry.Timestamp, entry.Host, entry.Type, entry.Severity, entry.Message, resolvedInt)
}

func (s *LogStore) GetRecentAlerts(limit int) ([]AlertEntry, error) {
    s.mu.Lock()
    defer s.mu.Unlock()
    
    if limit <= 0 { limit = 50 }
    
    rows, err := s.conn.Query(context.Background(), fmt.Sprintf(`
        SELECT timestamp, host, type, severity, message, resolved 
        FROM datavast.alerts
        ORDER BY timestamp DESC
        LIMIT %d
    `, limit))
    if err != nil {
        return nil, err
    }
    defer rows.Close()
    
    var alerts []AlertEntry
    for rows.Next() {
        var a AlertEntry
        var res uint8
        if err := rows.Scan(&a.Timestamp, &a.Host, &a.Type, &a.Severity, &a.Message, &res); err != nil {
            return nil, err
        }
        a.Resolved = (res == 1)
        alerts = append(alerts, a)
    }
    return alerts, nil
}

type AccessLogEntry struct {
	Timestamp   time.Time `json:"timestamp"`
	Service     string    `json:"service"`
	Host        string    `json:"host"`
	IP          string    `json:"ip"`
	Method      string    `json:"method"`
	Path        string    `json:"path"`
	StatusCode  uint16    `json:"status_code"`
	BytesSent   uint64    `json:"bytes_sent"`
	UserAgent   string    `json:"user_agent"`
	Country     string    `json:"country"`
	Region      string    `json:"region"`
	City        string    `json:"city"`
	Latitude    float64   `json:"latitude"`
	Longitude   float64   `json:"longitude"`
	Domain      string    `json:"domain"`
}

func (s *LogStore) InsertAccessLog(entry AccessLogEntry) error {
	s.mu.Lock()
	defer s.mu.Unlock()
	return s.conn.Exec(context.Background(), `
		INSERT INTO datavast.access_logs (timestamp, service, host, ip, method, path, status_code, bytes_sent, user_agent, country, region, city, latitude, longitude, domain)
		VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
	`, entry.Timestamp, entry.Service, entry.Host, entry.IP, entry.Method, entry.Path, entry.StatusCode, entry.BytesSent, entry.UserAgent, entry.Country, entry.Region, entry.City, entry.Latitude, entry.Longitude, entry.Domain)
}

func (s *LogStore) InsertLog(entry LogEntry) error {
	s.mu.Lock()
	defer s.mu.Unlock()
	return s.conn.Exec(context.Background(), `
		INSERT INTO datavast.logs (timestamp, host, service, level, message, source_path)
		VALUES (?, ?, ?, ?, ?, ?)
	`, entry.Timestamp, entry.Host, entry.Service, entry.Level, entry.Message, entry.SourcePath)
}

func (s *LogStore) GetRecentLogs(limit int) ([]LogEntry, error) {
	s.mu.Lock()
	defer s.mu.Unlock()

	if limit <= 0 {
		limit = 50
	}
	rows, err := s.conn.Query(context.Background(), fmt.Sprintf(`
		SELECT timestamp, host, service, level, message, source_path
		FROM datavast.logs
		ORDER BY timestamp DESC
		LIMIT %d
	`, limit))
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var logs []LogEntry
	for rows.Next() {
		var l LogEntry
		if err := rows.Scan(&l.Timestamp, &l.Host, &l.Service, &l.Level, &l.Message, &l.SourcePath); err != nil {
			return nil, err
		}
		logs = append(logs, l)
	}
	return logs, nil
}

type LogFilter struct {
	Limit      int
	Level      string
	Host       string
	Service    string
	SearchTerm string
	Before     time.Time
	After      time.Time
	Order      string // "DESC" or "ASC"
}

func (s *LogStore) QueryLogs(filter LogFilter) ([]LogEntry, error) {
	s.mu.Lock()
	defer s.mu.Unlock()

	if filter.Limit <= 0 {
		filter.Limit = 100
	}
	
	query := "SELECT timestamp, host, service, level, message, source_path FROM datavast.logs WHERE 1=1"
	var args []interface{}

    if filter.Host != "" {
        query += " AND host = ?"
        args = append(args, filter.Host)
    }

	if filter.Level != "" && filter.Level != "ALL" {
		query += " AND level = ?"
		args = append(args, filter.Level)
	}
	
	if filter.Service != "" {
	    query += " AND (service ILIKE ? OR source_path ILIKE ?)"
	    pattern := "%" + filter.Service + "%"
	    args = append(args, pattern, pattern)
	}
	
	if !filter.Before.IsZero() {
	    query += " AND timestamp < ?"
	    args = append(args, filter.Before)
	}
	
	if !filter.After.IsZero() {
	    query += " AND timestamp > ?"
	    args = append(args, filter.After)
	}

	if filter.SearchTerm != "" {
		query += " AND (message ILIKE ? OR source_path ILIKE ? OR host ILIKE ?)"
		// ILIKE is case insensitive in ClickHouse
		pattern := "%" + filter.SearchTerm + "%"
		args = append(args, pattern, pattern, pattern)
	}

    order := "DESC"
    if filter.Order == "ASC" {
        order = "ASC"
    }

	query += fmt.Sprintf(" ORDER BY timestamp %s LIMIT %d", order, filter.Limit)

	rows, err := s.conn.Query(context.Background(), query, args...)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var logs []LogEntry
	for rows.Next() {
		var l LogEntry
		if err := rows.Scan(&l.Timestamp, &l.Host, &l.Service, &l.Level, &l.Message, &l.SourcePath); err != nil {
			return nil, err
		}
		logs = append(logs, l)
	}
	return logs, nil
}

func (s *LogStore) GetUniqueServices(host string) ([]string, error) {
	s.mu.Lock()
	defer s.mu.Unlock()

	var services []string
	seen := make(map[string]bool)

	// Helper function to query a table
	queryTable := func(table string) error {
		var query string
		var args []interface{}
		
		if host != "" {
			query = fmt.Sprintf("SELECT DISTINCT service FROM %s WHERE host = ?", table)
			args = append(args, host)
		} else {
			query = fmt.Sprintf("SELECT DISTINCT service FROM %s", table)
		}

		rows, err := s.conn.Query(context.Background(), query, args...)
		if err != nil {
			return err
		}
		defer rows.Close()

		for rows.Next() {
			var svc string
			if err := rows.Scan(&svc); err != nil {
				return err
			}
			if svc != "" && !seen[svc] {
				services = append(services, svc)
				seen[svc] = true
			}
		}
		return nil
	}

	// 1. Query generic logs
	if err := queryTable("datavast.logs"); err != nil {
		fmt.Printf("[ERROR] Failed to query datavast.logs services: %v\n", err)
		// Continue to next table even if this fails? better to Log and continue
	}

	// 2. Query access logs
	if err := queryTable("datavast.access_logs"); err != nil {
		fmt.Printf("[ERROR] Failed to query datavast.access_logs services: %v\n", err)
	}

	return services, nil
}
