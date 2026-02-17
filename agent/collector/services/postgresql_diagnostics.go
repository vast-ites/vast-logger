package services

// PostgreSQL diagnostic structs
type PgTableInfo struct {
	Schema string `json:"schema"`
	Table  string `json:"table"`
	Size   string `json:"size"`
}

type PgTableIOStats struct {
	Schema     string `json:"schema"`
	Table      string `json:"table"`
	HeapReads  int64  `json:"heap_reads"`
	HeapHits   int64  `json:"heap_hits"`
	IdxReads   int64  `json:"idx_reads"`
	IdxHits    int64  `json:"idx_hits"`
	TotalReads int64  `json:"total_reads"`
}

type PgSlowQueryInfo struct {
	Query     string  `json:"query"`
	Calls     int64   `json:"calls"`
	AvgTime   float64 `json:"avg_time_sec"`
	TotalTime float64 `json:"total_time_sec"`
}

type PgStatementsInfo struct {
	Enabled bool `json:"enabled"`
}

// checkPgStatStatements verifies if pg_stat_statements extension is enabled
func (c *PostgreSQLCollector) checkPgStatStatements() bool {
	var exists bool
	err := c.db.QueryRow(`
		SELECT EXISTS(
			SELECT 1 FROM pg_extension WHERE extname = 'pg_stat_statements'
		)
	`).Scan(&exists)
	/*
	if err != nil {
		log.Printf("[postgresql] checkPgStatStatements error: %v", err)
		return false
	}
	log.Printf("[postgresql] pg_stat_statements enabled: %v", exists)
	*/
	if err != nil {
		return false
	}
	return exists
}

// getTablesWithoutIndexes finds tables that have no indexes
func (c *PostgreSQLCollector) getTablesWithoutIndexesPg() ([]PgTableInfo, error) {
	query := `
		SELECT 
			schemaname,
			tablename,
			pg_size_pretty(pg_total_relation_size(schemaname||'.'||tablename)) AS size
		FROM pg_tables
		WHERE schemaname NOT IN ('pg_catalog', 'information_schema')
		  AND tablename NOT IN (
			  SELECT DISTINCT tablename 
			  FROM pg_indexes 
			  WHERE schemaname NOT IN ('pg_catalog', 'information_schema')
		  )
		ORDER BY pg_total_relation_size(schemaname||'.'||tablename) DESC
		LIMIT 20
	`
	
	rows, err := c.db.Query(query)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	
	var tables []PgTableInfo
	for rows.Next() {
		var t PgTableInfo
		if err := rows.Scan(&t.Schema, &t.Table, &t.Size); err == nil {
			tables = append(tables, t)
		}
	}
	
	return tables, nil
}

// getHighIOTablesPg retrieves tables with high I/O activity
func (c *PostgreSQLCollector) getHighIOTablesPg() ([]PgTableIOStats, error) {
	query := `
		SELECT 
			schemaname,
			relname AS table_name,
			heap_blks_read,
			heap_blks_hit,
			idx_blks_read,
			idx_blks_hit,
			(heap_blks_read + idx_blks_read) AS total_reads
		FROM pg_statio_user_tables
		WHERE (heap_blks_read + idx_blks_read) > 0
		ORDER BY total_reads DESC
		LIMIT 20
	`
	
	rows, err := c.db.Query(query)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	
	var tables []PgTableIOStats
	for rows.Next() {
		var t PgTableIOStats
		if err := rows.Scan(&t.Schema, &t.Table, &t.HeapReads, &t.HeapHits, 
			&t.IdxReads, &t.IdxHits, &t.TotalReads); err == nil {
			tables = append(tables, t)
		}
	}
	
	return tables, nil
}

// getSlowQueriesFromPgStatStatements retrieves slow queries from pg_stat_statements
func (c *PostgreSQLCollector) getSlowQueriesFromPgStatStatements() ([]PgSlowQueryInfo, error) {
	query := `
		SELECT 
			LEFT(query, 200) AS query,
			calls,
			mean_exec_time / 1000 AS avg_time_sec,
			total_exec_time / 1000 AS total_time_sec
		FROM pg_stat_statements
		WHERE query NOT LIKE '%pg_stat_statements%'
		  AND mean_exec_time > 0
		ORDER BY mean_exec_time DESC
		LIMIT 20
	`
	
	rows, err := c.db.Query(query)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	
	var queries []PgSlowQueryInfo
	for rows.Next() {
		var q PgSlowQueryInfo
		if err := rows.Scan(&q.Query, &q.Calls, &q.AvgTime, &q.TotalTime); err == nil {
			queries = append(queries, q)
		}
	}
	
	return queries, nil
}

// CollectDiagnosticsPg gathers all PostgreSQL performance diagnostics
func (c *PostgreSQLCollector) CollectDiagnosticsPg(stats *PostgreSQLStats) {
	// Check if pg_stat_statements is enabled
	stats.PgStatStatements.Enabled = c.checkPgStatStatements()
	
	// Always try to get tables without indexes
	if tables, err := c.getTablesWithoutIndexesPg(); err == nil {
		stats.TablesWithoutIndexes = tables
	}
	
	// Always try to get I/O stats
	if ioTables, err := c.getHighIOTablesPg(); err == nil {
		stats.HighIOTables = ioTables
	}
	
	// Only collect pg_stat_statements-based diagnostics if enabled
	if stats.PgStatStatements.Enabled {
		if slowQueries, err := c.getSlowQueriesFromPgStatStatements(); err == nil {
			stats.SlowQueries = slowQueries
		}
	}
}
