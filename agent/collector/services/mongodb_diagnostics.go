package services

import (
	"context"
	"time"
	
	"go.mongodb.org/mongo-driver/bson"
)

// MongoDB diagnostic methods

// checkProfilingEnabled verifies if profiling is enabled
func (c *MongoDBCollector) checkProfilingEnabled() bool {
	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()
	
	var result bson.M
	err := c.client.Database("admin").RunCommand(ctx, bson.D{{Key: "profile", Value: -1}}).Decode(&result)
	if err != nil {
		return false
	}
	
	if was, ok := result["was"].(int32); ok {
		return was > 0
	}
	if was, ok := result["was"].(int); ok {
		return was > 0
	}
	if was, ok := result["was"].(int64); ok {
		return was > 0
	}
	if was, ok := result["was"].(float64); ok {
		return was > 0
	}
	return false
}

// getCollectionsWithoutIndexes finds collections with only _id index
func (c *MongoDBCollector) getCollectionsWithoutIndexes() ([]string, error) {
	ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()
	
	databases, err := c.client.ListDatabaseNames(ctx, bson.D{})
	if err != nil {
		return nil, err
	}
	
	var colls []string
	for _, dbName := range databases {
		// Skip system databases
		if dbName == "admin" || dbName == "local" || dbName == "config" {
			continue
		}
		
		db := c.client.Database(dbName)
		collections, err := db.ListCollectionNames(ctx, bson.D{})
		if err != nil {
			continue
		}
		
		for _, collName := range collections {
			indexes, err := db.Collection(collName).Indexes().List(ctx)
			if err != nil {
				continue
			}
			
			indexCount := 0
			for indexes.Next(ctx) {
				indexCount++
			}
			
			// Only _id index exists
			if indexCount <= 1 {
				colls = append(colls, dbName+"."+collName)
			}
		}
	}
	
	return colls, nil
}

// getSlowOperations retrieves slow operations from system.profile
func (c *MongoDBCollector) getSlowOperations() ([]MongoSlowOp, error) {
	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()
	
	// Query system.profile for slow operations
	cursor, err := c.client.Database("admin").Collection("system.profile").Find(
		ctx,
		bson.M{"millis": bson.M{"$gt": 100}},
	)
	if err != nil {
		return nil, err
	}
	defer cursor.Close(ctx)
	
	var ops []MongoSlowOp
	for cursor.Next(ctx) && len(ops) < 20 {
		var doc bson.M
		if err := cursor.Decode(&doc); err != nil {
			continue
		}
		
		op := MongoSlowOp{}
		if opType, ok := doc["op"].(string); ok {
			op.Op = opType
		}
		if ns, ok := doc["ns"].(string); ok {
			op.Namespace = ns
		}
		if millis, ok := doc["millis"].(int64); ok {
			op.Millis = millis
		} else if millis, ok := doc["millis"].(int32); ok {
			op.Millis = int64(millis)
		}
		// Simplified command representation
		op.Command = "query"
		
		ops = append(ops, op)
	}
	
	return ops, nil
}

// getCollectionStatsDetailed retrieves detailed stats for collections
func (c *MongoDBCollector) getCollectionStatsDetailed() ([]MongoCollStats, error) {
	ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()
	
	databases, err := c.client.ListDatabaseNames(ctx, bson.D{})
	if err != nil {
		return nil, err
	}
	
	var stats []MongoCollStats
	for _, dbName := range databases {
		if dbName == "admin" || dbName == "local" || dbName == "config" {
			continue
		}
		
		db := c.client.Database(dbName)
		collections, err := db.ListCollectionNames(ctx, bson.D{})
		if err != nil {
			continue
		}
		
		for _, collName := range collections {
			if len(stats) >= 20 {
				break
			}
			
			var collStats bson.M
			err := db.RunCommand(ctx, bson.D{{Key: "collStats", Value: collName}}).Decode(&collStats)
			if err != nil {
				continue
			}
			
			stat := MongoCollStats{
				Collection: dbName + "." + collName,
			}
			
			if size, ok := collStats["size"].(int64); ok {
				stat.Size = size
			} else if size, ok := collStats["size"].(int32); ok {
				stat.Size = int64(size)
			}
			
			if count, ok := collStats["count"].(int64); ok {
				stat.Count = count
			} else if count, ok := collStats["count"].(int32); ok {
				stat.Count = int64(count)
			}
			
			if avgObjSize, ok := collStats["avgObjSize"].(int64); ok {
				stat.AvgObjSize = avgObjSize
			} else if avgObjSize, ok := collStats["avgObjSize"].(int32); ok {
				stat.AvgObjSize = int64(avgObjSize)
			}
			
			stats = append(stats, stat)
		}
	}
	
	return stats, nil
}

// CollectDiagnosticsMongo gathers all MongoDB performance diagnostics
func (c *MongoDBCollector) CollectDiagnosticsMongo(stats *MongoDBStats) {
	// Check profiling status
	stats.ProfilingEnabled = c.checkProfilingEnabled()
	
	// Get collections without indexes (always try)
	if colls, err := c.getCollectionsWithoutIndexes(); err == nil {
		stats.CollectionsWithoutIndexes = colls
	}
	
	// Get collection stats
	if collStats, err := c.getCollectionStatsDetailed(); err == nil {
		stats.CollectionStats = collStats
	}
	
	// Only get slow operations if profiling is enabled
	if stats.ProfilingEnabled {
		if slowOps, err := c.getSlowOperations(); err == nil {
			stats.SlowOperations = slowOps
		}
	}
}
