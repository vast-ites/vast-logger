package geoip

import (
	"fmt"
	"net"
	"os"
	"sync"

	"github.com/oschwald/geoip2-golang"
)

// GeoIPInfo contains geographic information for an IP
type GeoIPInfo struct {
	Country     string  `json:"country"`
	CountryCode string  `json:"country_code"`
	Region      string  `json:"region"`
	City        string  `json:"city"`
	Latitude    float64 `json:"latitude"`
	Longitude   float64 `json:"longitude"`
}

// GeoIPService provides IP geolocation lookups
type GeoIPService struct {
	db     *geoip2.Reader
	mu     sync.RWMutex
	dbPath string
}

var (
	instance *GeoIPService
	once     sync.Once
)

// GetInstance returns the singleton GeoIP service instance
func GetInstance() *GeoIPService {
	once.Do(func() {
		instance = &GeoIPService{}
	})
	return instance
}

// Initialize loads the GeoIP database
func (g *GeoIPService) Initialize(dbPath string) error {
	g.mu.Lock()
	defer g.mu.Unlock()

	// Check if file exists
	if _, err := os.Stat(dbPath); os.IsNotExist(err) {
		return fmt.Errorf("GeoIP database not found at %s", dbPath)
	}

	db, err := geoip2.Open(dbPath)
	if err != nil {
		return fmt.Errorf("failed to open GeoIP database: %w", err)
	}

	g.db = db
	g.dbPath = dbPath
	return nil
}

// Lookup performs a GeoIP lookup for the given IP address
func (g *GeoIPService) Lookup(ipAddr string) (*GeoIPInfo, error) {
	g.mu.RLock()
	defer g.mu.RUnlock()

	if g.db == nil {
		return nil, fmt.Errorf("GeoIP database not initialized")
	}

	ip := net.ParseIP(ipAddr)
	if ip == nil {
		return nil, fmt.Errorf("invalid IP address: %s", ipAddr)
	}

	// Skip private/local IPs
	if isPrivateIP(ip) {
		return &GeoIPInfo{
			Country:     "Local",
			CountryCode: "XX",
			Region:      "Local",
			City:        "Local",
		}, nil
	}

	record, err := g.db.City(ip)
	if err != nil {
		return nil, fmt.Errorf("lookup failed: %w", err)
	}

	info := &GeoIPInfo{
		Country:     record.Country.Names["en"],
		CountryCode: record.Country.IsoCode,
		Latitude:    record.Location.Latitude,
		Longitude:   record.Location.Longitude,
	}

	if len(record.Subdivisions) > 0 {
		info.Region = record.Subdivisions[0].Names["en"]
	}

	info.City = record.City.Names["en"]

	return info, nil
}

// Close closes the GeoIP database
func (g *GeoIPService) Close() error {
	g.mu.Lock()
	defer g.mu.Unlock()

	if g.db != nil {
		return g.db.Close()
	}
	return nil
}

// isPrivateIP checks if an IP is private/local
func isPrivateIP(ip net.IP) bool {
	if ip.IsLoopback() || ip.IsLinkLocalUnicast() || ip.IsLinkLocalMulticast() {
		return true
	}

	// Check for private IP ranges
	privateIPBlocks := []string{
		"10.0.0.0/8",
		"172.16.0.0/12",
		"192.168.0.0/16",
		"fc00::/7",
	}

	for _, cidr := range privateIPBlocks {
		_, block, _ := net.ParseCIDR(cidr)
		if block.Contains(ip) {
			return true
		}
	}

	return false
}
