package storage

import (
	"context"
	"fmt"
	"time"

	"github.com/ClickHouse/clickhouse-go/v2"
	"github.com/ClickHouse/clickhouse-go/v2/lib/driver"
)

type LogStore struct {
	conn driver.Conn
}

type LogEntry struct {
	Timestamp   time.Time `json:"timestamp"`
	Host        string    `json:"host"`
	Service     string    `json:"service"`
	Level       string    `json:"level"`
	Message     string    `json:"message"`
	SourcePath  string    `json:"source_path"`
}

func NewLogStore() (*LogStore, error) {
	conn, err := clickhouse.Open(&clickhouse.Options{
		Addr: []string{"127.0.0.1:9000"},
		Auth: clickhouse.Auth{
			Database: "default", // Connect to default
			Username: "datavast",
			Password: "securepass",
		},
	})
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

	return &LogStore{conn: conn}, nil
}

func (s *LogStore) InsertLog(entry LogEntry) error {
	return s.conn.Exec(context.Background(), `
		INSERT INTO datavast.logs (timestamp, host, service, level, message, source_path)
		VALUES (?, ?, ?, ?, ?, ?)
	`, entry.Timestamp, entry.Host, entry.Service, entry.Level, entry.Message, entry.SourcePath)
}

func (s *LogStore) GetRecentLogs(limit int) ([]LogEntry, error) {
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

func (s *LogStore) QueryLogs(limit int, level string, search string) ([]LogEntry, error) {
	if limit <= 0 {
		limit = 100
	}
	
	query := "SELECT timestamp, host, service, level, message, source_path FROM datavast.logs WHERE 1=1"
	var args []interface{}

	if level != "" && level != "ALL" {
		query += " AND level = ?"
		args = append(args, level)
	}

	if search != "" {
		query += " AND (message ILIKE ? OR source_path ILIKE ?)"
		// ILIKE is case insensitive in ClickHouse
		pattern := "%" + search + "%"
		args = append(args, pattern, pattern)
	}

	query += fmt.Sprintf(" ORDER BY timestamp DESC LIMIT %d", limit)

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

