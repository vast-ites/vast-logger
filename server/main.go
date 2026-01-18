package main

import (
	"log"
	"time"

	"github.com/datavast/datavast/server/api"
	"github.com/datavast/datavast/server/storage"
	"github.com/gin-contrib/cors"
	"github.com/gin-gonic/gin"
)

func main() {
	log.Println("🚀 DataVast Backend Starting...")

	// 1. Storage
	influx := storage.NewMetricsStore("http://localhost:8086", "my-super-secret-auth-token", "datavast", "metrics")
	defer influx.Close()

	clickh, err := storage.NewLogStore()
	if err != nil {
		log.Fatalf("ClickHouse conn failed: %v", err)
	}

	// 2. Load Config
    config := storage.NewConfigStore("server-config.json")

	// 3. API Setup
	r := gin.Default()
	r.Use(cors.New(cors.Config{
		AllowOrigins:     []string{"http://localhost:5173", "*"},
		AllowMethods:     []string{"GET", "POST"},
		AllowHeaders:     []string{"Origin", "Content-Type"},
		ExposeHeaders:    []string{"Content-Length"},
		AllowCredentials: true,
		MaxAge:           12 * time.Hour,
	}))

	handler := &api.IngestionHandler{
		Metrics: influx,
		Logs:    clickh,
        Config:  config,
	}
	api.SetupRoutes(r, handler)

	// 3. Start
	log.Println(">> Ingestion API listening on :8080")
	if err := r.Run(":8080"); err != nil {
		log.Fatal(err)
	}
}
