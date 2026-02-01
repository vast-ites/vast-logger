package services

import (
	"database/sql"
	"fmt"
	"time"

	_ "github.com/lib/pq"
)

// PostgreSQLCollector collects metrics from PostgreSQL database
type PostgreSQLCollector struct {
	DSN string
	db  *sql.DB
}

// PostgreSQLStats represents PostgreSQL statistics
type PostgreSQLStats struct {
	Timestamp           time.Time
	TotalConnections    int
	MaxConnections      int
	ActiveConnections   int
	IdleConnections     int
	DatabaseSize        int64
	DeadTuples          int64
	CacheHitRatio       float64
	TransactionsPerSec  float64
	ReplicationLag      int
	LocksCount          int
	LongRunningQueries  int
}

// PostgreSQLActivity represents an active query
type PostgreSQLActivity struct {
	PID         int
	Database    string
	User        string
	ClientAddr  string
	Query       string
	State       string
	Duration    float64
	WaitEvent   string
}

// NewPostgreSQLCollector creates a PostgreSQL collector
func NewPostgreSQLCollector(dsn string) (*PostgreSQLCollector, error) {
	db, err := sql.Open("postgres", dsn)
	if err != nil {
		return nil, fmt.Errorf("failed to connect to PostgreSQL: %w", err)
	}

	if err := db.Ping(); err != nil {
		return nil, fmt.Errorf("failed to ping PostgreSQL: %w", err)
	}

	return &PostgreSQLCollector{
		DSN: dsn,
		db:  db,
	}, nil
}

// GetStats retrieves comprehensive PostgreSQL statistics
func (c *PostgreSQLCollector) GetStats() (*PostgreSQLStats, error) {
	stats := &PostgreSQLStats{
		Timestamp: time.Now(),
	}

	// Get connection stats
	row := c.db.QueryRow(`
		SELECT 
			(SELECT setting::int FROM pg_settings WHERE name = 'max_connections') as max_conn,
			(SELECT count(*) FROM pg_stat_activity WHERE state = 'active') as active,
			(SELECT count(*) FROM pg_stat_activity WHERE state = 'idle') as idle,
			(SELECT count(*) FROM pg_stat_activity) as total
	`)
	
	if err := row.Scan(&stats.MaxConnections, &stats.ActiveConnections, &stats.IdleConnections, &stats.TotalConnections); err != nil {
		return nil, err
	}

	// Get database size
	row = c.db.QueryRow(`SELECT pg_database_size(current_database())`)
	row.Scan(&stats.DatabaseSize)

	// Get cache hit ratio
	row = c.db.QueryRow(`
		SELECT 
			CASE WHEN blks_hit + blks_read = 0 THEN 0 
			ELSE round(100.0 * blks_hit / (blks_hit + blks_read), 2) 
			END as cache_hit_ratio
		FROM pg_stat_database 
		WHERE datname = current_database()
	`)
	row.Scan(&stats.CacheHitRatio)

	// Get transaction rate
	row = c.db.QueryRow(`
		SELECT 
			COALESCE(xact_commit + xact_rollback, 0) / 
			GREATEST(EXTRACT(EPOCH FROM (now() - stats_reset)), 1) as tps
		FROM pg_stat_database 
		WHERE datname = current_database()
	`)
	row.Scan(&stats.TransactionsPerSec)

	// Get dead tuples
	row = c.db.QueryRow(`
		SELECT COALESCE(SUM(n_dead_tup), 0) 
		FROM pg_stat_user_tables
	`)
	row.Scan(&stats.DeadTuples)

	// Get locks count
	row = c.db.QueryRow(`SELECT COUNT(*) FROM pg_locks`)
	row.Scan(&stats.LocksCount)

	// Count long-running queries (> 5 seconds)
	row = c.db.QueryRow(`
		SELECT COUNT(*) 
		FROM pg_stat_activity 
		WHERE state = 'active' 
		AND now() - query_start > interval '5 seconds'
	`)
	row.Scan(&stats.LongRunningQueries)

	// Check replication lag (if replica)
	row = c.db.QueryRow(`
		SELECT COALESCE(EXTRACT(EPOCH FROM now() - pg_last_xact_replay_timestamp())::int, 0)
	`)
	row.Scan(&stats.ReplicationLag)

	return stats, nil
}

// GetActivity retrieves active connections and queries
func (c *PostgreSQLCollector) GetActivity() ([]PostgreSQLActivity, error) {
	rows, err := c.db.Query(`
		SELECT 
			pid,
			COALESCE(datname, '') as database,
			COALESCE(usename, '') as username,
			COALESCE(client_addr::text, '') as client_addr,
			COALESCE(query, '') as query,
			COALESCE(state, '') as state,
			COALESCE(EXTRACT(EPOCH FROM (now() - query_start)), 0) as duration,
			COALESCE(wait_event, '') as wait_event
		FROM pg_stat_activity
		WHERE state != 'idle'
		AND pid != pg_backend_pid()
		ORDER BY query_start DESC
		LIMIT 50
	`)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var activities []PostgreSQLActivity
	for rows.Next() {
		var a PostgreSQLActivity
		if err := rows.Scan(&a.PID, &a.Database, &a.User, &a.ClientAddr, 
			&a.Query, &a.State, &a.Duration, &a.WaitEvent); err == nil {
			activities = append(activities, a)
		}
	}

	return activities, nil
}

// GetLocks retrieves lock information
func (c *PostgreSQLCollector) GetLocks() ([]map[string]interface{}, error) {
	rows, err := c.db.Query(`
		SELECT 
			l.locktype,
			l.mode,
			COALESCE(l.relation::regclass::text, '') as relation,
			a.pid,
			a.usename,
			COALESCE(a.query, '') as query
		FROM pg_locks l
		LEFT JOIN pg_stat_activity a ON l.pid = a.pid
		WHERE NOT l.granted
		LIMIT 20
	`)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var locks []map[string]interface{}
	for rows.Next() {
		var lockType, mode, relation, query, usename string
		var pid int
		
		if err := rows.Scan(&lockType, &mode, &relation, &pid, &usename, &query); err == nil {
			locks = append(locks, map[string]interface{}{
				"lock_type": lockType,
				"mode":      mode,
				"relation":  relation,
				"pid":       pid,
				"user":      usename,
				"query":     query,
			})
		}
	}

	return locks, nil
}

// GetTableStats retrieves table statistics
func (c *PostgreSQLCollector) GetTableStats() ([]map[string]interface{}, error) {
	rows, err := c.db.Query(`
		SELECT 
			schemaname || '.' || tablename as table_name,
			pg_size_pretty(pg_total_relation_size(schemaname||'.'||tablename)) as size,
			n_live_tup as live_tuples,
			n_dead_tup as dead_tuples,
			n_tup_ins as inserts,
			n_tup_upd as updates,
			n_tup_del as deletes,
			seq_scan,
			idx_scan
		FROM pg_stat_user_tables
		ORDER BY pg_total_relation_size(schemaname||'.'||tablename) DESC
		LIMIT 10
	`)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var tables []map[string]interface{}
	for rows.Next() {
		var tableName, size string
		var liveTup, deadTup, inserts, updates, deletes, seqScan, idxScan int64
		
		if err := rows.Scan(&tableName, &size, &liveTup, &deadTup, &inserts, 
			&updates, &deletes, &seqScan, &idxScan); err == nil {
			tables = append(tables, map[string]interface{}{
				"table_name":   tableName,
				"size":         size,
				"live_tuples":  liveTup,
				"dead_tuples":  deadTup,
				"inserts":      inserts,
				"updates":      updates,
				"deletes":      deletes,
				"seq_scans":    seqScan,
				"index_scans":  idxScan,
			})
		}
	}

	return tables, nil
}

// Close closes the database connection
func (c *PostgreSQLCollector) Close() error {
	if c.db != nil {
		return c.db.Close()
	}
	return nil
}
