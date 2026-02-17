package services

import (
	"database/sql"
)

// MySQL Performance Diagnostics Methods

// checkPerformanceSchema verifies if performance_schema is enabled
func (c *MySQLCollector) checkPerformanceSchema() bool {
	var value string
	err := c.db.QueryRow("SELECT @@performance_schema").Scan(&value)
	return err == nil && (value == "1" || value == "ON")
}

// getTablesWithoutIndexes finds tables that have no indexes
func (c *MySQLCollector) getTablesWithoutIndexes() ([]TableInfo, error) {
	query := `
		SELECT 
			table_schema, 
			table_name,
			table_rows
		FROM information_schema.tables
		WHERE table_schema NOT IN ('mysql', 'information_schema', 'performance_schema', 'sys')
		  AND table_name NOT IN (
			  SELECT DISTINCT table_name 
			  FROM information_schema.statistics
			  WHERE table_schema NOT IN ('mysql', 'information_schema', 'performance_schema', 'sys')
		  )
		ORDER BY table_rows DESC
		LIMIT 20
	`
	
	rows, err := c.db.Query(query)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	
	var tables []TableInfo
	for rows.Next() {
		var t TableInfo
		var tableRows sql.NullInt64
		if err := rows.Scan(&t.Schema, &t.Table, &tableRows); err == nil {
			if tableRows.Valid {
				t.Rows = tableRows.Int64
			}
			tables = append(tables, t)
		}
	}
	
	return tables, nil
}

// getHighIOTables retrieves tables with high I/O activity (requires performance_schema)
func (c *MySQLCollector) getHighIOTables() ([]TableIOStats, error) {
	query := `
		SELECT 
			object_schema AS db_name,
			object_name AS table_name,
			count_read,
			count_write,
			sum_timer_read / 1000000000000 AS read_time_sec,
			sum_timer_write / 1000000000000 AS write_time_sec
		FROM performance_schema.table_io_waits_summary_by_table
		WHERE object_schema NOT IN ('mysql', 'performance_schema', 'sys')
		  AND count_read + count_write > 0
		ORDER BY (count_read + count_write) DESC
		LIMIT 20
	`
	
	rows, err := c.db.Query(query)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	
	var tables []TableIOStats
	for rows.Next() {
		var t TableIOStats
		if err := rows.Scan(&t.Database, &t.Table, &t.Reads, &t.Writes, &t.ReadTime, &t.WriteTime); err == nil {
			tables = append(tables, t)
		}
	}
	
	return tables, nil
}

// getSlowQueriesFromPerfSchema retrieves slow queries from performance_schema
func (c *MySQLCollector) getSlowQueriesFromPerfSchema() ([]SlowQueryInfo, error) {
	query := `
		SELECT 
			SUBSTRING(digest_text, 1, 200) AS query,
			count_star AS exec_count,
			avg_timer_wait / 1000000000000 AS avg_time_sec,
			CASE 
				WHEN count_star > 0 THEN sum_rows_examined / count_star 
				ELSE 0 
			END AS avg_rows_examined
		FROM performance_schema.events_statements_summary_by_digest
		WHERE schema_name IS NOT NULL
		  AND schema_name NOT IN ('mysql', 'performance_schema', 'sys')
		  AND avg_timer_wait > 0
		ORDER BY avg_timer_wait DESC
		LIMIT 20
	`
	
	rows, err := c.db.Query(query)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	
	var queries []SlowQueryInfo
	for rows.Next() {
		var q SlowQueryInfo
		var avgRowsExam sql.NullFloat64
		if err := rows.Scan(&q.Query, &q.ExecCount, &q.AvgTime, &avgRowsExam); err == nil {
			if avgRowsExam.Valid {
				q.AvgRowsExam = avgRowsExam.Float64
			}
			queries = append(queries, q)
		}
	}
	
	return queries, nil
}

// CollectDiagnostics gathers all performance diagnostics
func (c *MySQLCollector) CollectDiagnostics(stats *MySQLStats) {
	// Check if performance_schema is enabled
	stats.PerformanceSchema.Enabled = c.checkPerformanceSchema()
	
	// Always try to get tables without indexes (uses information_schema)
	if tables, err := c.getTablesWithoutIndexes(); err == nil {
		stats.TablesWithoutIndexes = tables
	}
	
	// Only collect performance_schema-based diagnostics if it's enabled
	if stats.PerformanceSchema.Enabled {
		if ioTables, err := c.getHighIOTables(); err == nil {
			stats.HighIOTables = ioTables
		}
		
		if slowQueries, err := c.getSlowQueriesFromPerfSchema(); err == nil {
			stats.SlowQueriesFromPerfSchema = slowQueries
		}
	}
}
