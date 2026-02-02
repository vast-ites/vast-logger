package main

import (
	"log"
    "os"
	"time"

	"github.com/datavast/datavast/server/api"
    "github.com/datavast/datavast/server/auth"
    "github.com/datavast/datavast/server/alert"
	"github.com/datavast/datavast/server/storage"
	"github.com/datavast/datavast/server/geoip"
	"github.com/gin-contrib/cors"
    "github.com/gin-contrib/static"
	"github.com/gin-gonic/gin"
)

func main() {
	log.Println("🚀 DataVast Backend Starting...")

	// 1. Secrets & Config
	influxURL := os.Getenv("INFLUX_URL")
	if influxURL == "" {
		influxURL = "http://localhost:8086"
	}
	influxToken := os.Getenv("INFLUX_TOKEN")
	if influxToken == "" {
		influxToken = "my-super-secret-auth-token" // Fallback for dev
	}
	clickhouseDSN := os.Getenv("CLICKHOUSE_DSN")

	// 2. Storage
	influx := storage.NewMetricsStore(influxURL, influxToken, "datavast", "metrics")
	defer influx.Close()

	clickh, err := storage.NewLogStore(clickhouseDSN) // Updated constructor
	if err != nil {
		log.Fatalf("ClickHouse conn failed: %v", err)
	}

    // 3. Load Persistent Config
    config := storage.NewConfigStore("server-config.json")
    authMgr := auth.NewAuthManager(config)
    alertMgr := alert.NewAlertService(config)

    // Initialize GeoIP
    if err := geoip.GetInstance().Initialize("GeoLite2-City.mmdb"); err != nil {
        log.Printf("[WARNING] GeoIP init failed (maps will be empty): %v", err)
    } else {
        log.Println("🌍 GeoIP Service Initialized")
    }

	// 3. API Setup
	r := gin.Default()
	r.Use(cors.New(cors.Config{
		AllowOrigins:     []string{"http://localhost:5173", "*"},
		AllowMethods:     []string{"GET", "POST", "OPTIONS", "PUT"},
		AllowHeaders:     []string{"Origin", "Content-Type", "Authorization"},
		ExposeHeaders:    []string{"Content-Length"},
		AllowCredentials: true,
		MaxAge:           12 * time.Hour,
	}))

	handler := &api.IngestionHandler{
		Metrics: influx,
		Logs:    clickh,
        Config:  config,
        Auth:    authMgr,
        Alerts:  alertMgr,
	}
	api.SetupRoutes(r, handler)

    // Serve Frontend (Static Files)
    // accessible at root "/"
    r.Use(static.Serve("/", static.LocalFile("./dist", true)))
    
    // SPA Fallback: For React Router paths that don't match API or static files
    r.NoRoute(func(c *gin.Context) {
        // Avoid hijacking API 404s if possible, but for simplicity:
        // Only serve index.html if it looks like a page request? 
        // Actually, typical SPA fallback serves index.html for everything non-api.
        c.File("./dist/index.html")
    })

	// 3. Start
	log.Println(">> Ingestion API listening on :8080")
	if err := r.Run(":8080"); err != nil {
		log.Fatal(err)
	}
}
