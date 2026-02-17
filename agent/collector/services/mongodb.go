package services

import (
	"context"
	"fmt"
	"time"

	"go.mongodb.org/mongo-driver/bson"
	"go.mongodb.org/mongo-driver/mongo"
	"go.mongodb.org/mongo-driver/mongo/options"
)

// MongoDBCollector collects metrics from MongoDB
type MongoDBCollector struct {
	URI    string
	client *mongo.Client
}

// MongoDBStats represents MongoDB statistics
type MongoDBStats struct {
	Timestamp          time.Time
	Version            string
	Uptime             int64
	Connections        int
	MaxConnections     int
	MemoryUsed         int64
	OpCounters         map[string]int64
	ReplicationLag     int
	Role               string
	ReplicaSetName     string
	DocCount           int64
	DataSize           int64
	StorageSize        int64
	IndexSize          int64
	
	// Performance diagnostics
	CollectionsWithoutIndexes []string            `json:"collections_without_indexes,omitempty"`
	SlowOperations            []MongoSlowOp       `json:"slow_operations,omitempty"`
	CollectionStats           []MongoCollStats    `json:"collection_stats,omitempty"`
	ProfilingEnabled          bool                `json:"profiling_enabled"`
}

type MongoSlowOp struct {
	Op        string `json:"op"`
	Namespace string `json:"ns"`
	Millis    int64  `json:"millis"`
	Command   string `json:"command"`
}

type MongoCollStats struct {
	Collection string  `json:"collection"`
	Size       int64   `json:"size"`
	Count      int64   `json:"count"`
	AvgObjSize int64   `json:"avg_obj_size"`
}

// NewMongoDBCollector creates a MongoDB collector
func NewMongoDBCollector(uri string) (*MongoDBCollector, error) {
	ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()

	client, err := mongo.Connect(ctx, options.Client().ApplyURI(uri))
	if err != nil {
		return nil, fmt.Errorf("failed to connect to MongoDB: %w", err)
	}

	// Ping to verify connection
	if err := client.Ping(ctx, nil); err != nil {
		return nil, fmt.Errorf("failed to ping MongoDB: %w", err)
	}

	return &MongoDBCollector{
		URI:    uri,
		client: client,
	}, nil
}

// GetStats retrieves comprehensive MongoDB statistics
func (c *MongoDBCollector) GetStats() (*MongoDBStats, error) {
	ctx := context.Background()
	stats := &MongoDBStats{
		Timestamp:  time.Now(),
		OpCounters: make(map[string]int64),
	}

	// Get serverStatus
	var serverStatus bson.M
	err := c.client.Database("admin").RunCommand(ctx, bson.D{{Key: "serverStatus", Value: 1}}).Decode(&serverStatus)
	if err != nil {
		return nil, err
	}

	// Parse serverStatus
	if version, ok := serverStatus["version"].(string); ok {
		stats.Version = version
	}

	if uptime, ok := serverStatus["uptime"].(int64); ok {
		stats.Uptime = uptime
	} else if uptime, ok := serverStatus["uptime"].(int32); ok {
		stats.Uptime = int64(uptime)
	}

	// Connections
	if conn, ok := serverStatus["connections"].(bson.M); ok {
		if current, ok := conn["current"].(int32); ok {
			stats.Connections = int(current)
		}
		if available, ok := conn["available"].(int32); ok {
			stats.MaxConnections = int(available) + stats.Connections
		}
	}

	// Memory
	if mem, ok := serverStatus["mem"].(bson.M); ok {
		if resident, ok := mem["resident"].(int32); ok {
			stats.MemoryUsed = int64(resident) * 1024 * 1024 // MB to bytes
		}
	}

	// OpCounters
	if opcounters, ok := serverStatus["opcounters"].(bson.M); ok {
		for key, val := range opcounters {
			if v, ok := val.(int64); ok {
				stats.OpCounters[key] = v
			} else if v, ok := val.(int32); ok {
				stats.OpCounters[key] = int64(v)
			}
		}
	}

	// Replication info
	if repl, ok := serverStatus["repl"].(bson.M); ok {
		if setName, ok := repl["setName"].(string); ok {
			stats.ReplicaSetName = setName
		}
		if isMaster, ok := repl["ismaster"].(bool); ok {
			if isMaster {
				stats.Role = "primary"
			} else {
				stats.Role = "secondary"
			}
		}
	}

	// Get database stats for default database
	var dbStats bson.M
	err = c.client.Database("admin").RunCommand(ctx, bson.D{{Key: "dbStats", Value: 1}}).Decode(&dbStats)
	if err == nil {
		if dataSize, ok := dbStats["dataSize"].(int64); ok {
			stats.DataSize = dataSize
		} else if dataSize, ok := dbStats["dataSize"].(int32); ok {
			stats.DataSize = int64(dataSize)
		}

		if storageSize, ok := dbStats["storageSize"].(int64); ok {
			stats.StorageSize = storageSize
		} else if storageSize, ok := dbStats["storageSize"].(int32); ok {
			stats.StorageSize = int64(storageSize)
		}

		if indexSize, ok := dbStats["indexSize"].(int64); ok {
			stats.IndexSize = indexSize
		} else if indexSize, ok := dbStats["indexSize"].(int32); ok {
			stats.IndexSize = int64(indexSize)
		}

		if objects, ok := dbStats["objects"].(int64); ok {
			stats.DocCount = objects
		} else if objects, ok := dbStats["objects"].(int32); ok {
			stats.DocCount = int64(objects)
		}
	}
	
	// Collect performance diagnostics
	c.CollectDiagnosticsMongo(stats)

	return stats, nil
}

// GetCollectionStats retrieves statistics for all collections
func (c *MongoDBCollector) GetCollectionStats(database string) ([]map[string]interface{}, error) {
	ctx := context.Background()
	db := c.client.Database(database)

	collections, err := db.ListCollectionNames(ctx, bson.D{})
	if err != nil {
		return nil, err
	}

	var collStats []map[string]interface{}
	for _, collName := range collections {
		var stats bson.M
		err := db.RunCommand(ctx, bson.D{{Key: "collStats", Value: collName}}).Decode(&stats)
		if err != nil {
			continue
		}

		collStat := map[string]interface{}{
			"name": collName,
		}

		if count, ok := stats["count"].(int64); ok {
			collStat["count"] = count
		} else if count, ok := stats["count"].(int32); ok {
			collStat["count"] = int64(count)
		}

		if size, ok := stats["size"].(int64); ok {
			collStat["size"] = size
		} else if size, ok := stats["size"].(int32); ok {
			collStat["size"] = int64(size)
		}

		collStats = append(collStats, collStat)
	}

	return collStats, nil
}

// GetCurrentOps retrieves current operations
func (c *MongoDBCollector) GetCurrentOps() ([]map[string]interface{}, error) {
	ctx := context.Background()
	
	var result bson.M
	err := c.client.Database("admin").RunCommand(ctx, bson.D{{Key: "currentOp", Value: 1}}).Decode(&result)
	if err != nil {
		return nil, err
	}

	var ops []map[string]interface{}
	if inprog, ok := result["inprog"].(bson.A); ok {
		for _, op := range inprog {
			if opMap, ok := op.(bson.M); ok {
				operation := make(map[string]interface{})
				
				if opid, ok := opMap["opid"].(int64); ok {
					operation["opid"] = opid
				}
				if op, ok := opMap["op"].(string); ok {
					operation["op"] = op
				}
				if ns, ok := opMap["ns"].(string); ok {
					operation["ns"] = ns
				}
				if secs, ok := opMap["secs_running"].(int64); ok {
					operation["secs_running"] = secs
				} else if secs, ok := opMap["secs_running"].(int32); ok {
					operation["secs_running"] = int64(secs)
				}
				
				ops = append(ops, operation)
			}
		}
	}

	return ops, nil
}

// Close closes the MongoDB connection
func (c *MongoDBCollector) Close() error {
	if c.client != nil {
		ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
		defer cancel()
		return c.client.Disconnect(ctx)
	}
	return nil
}
