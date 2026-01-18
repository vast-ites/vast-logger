package storage

import (
	"encoding/json"
	"os"
	"sync"
)

type SystemConfig struct {
	RetentionDays  int     `json:"retention_days"`
	DDoSThreshold  float64 `json:"ddos_threshold"`
	EmailAlerts    bool    `json:"email_alerts"`
}

type ConfigStore struct {
	FilePath string
	mu       sync.RWMutex
	Config   SystemConfig
}

func NewConfigStore(path string) *ConfigStore {
	// Default config
	defaults := SystemConfig{
		RetentionDays:  7,
		DDoSThreshold:  50.0,
		EmailAlerts:    true,
	}
	
	store := &ConfigStore{
		FilePath: path,
		Config:   defaults,
	}
	
	// Load existing if available
	store.Load()
	return store
}

func (s *ConfigStore) Load() error {
	s.mu.Lock()
	defer s.mu.Unlock()

	data, err := os.ReadFile(s.FilePath)
	if err != nil {
		if os.IsNotExist(err) {
			return s.saveInternal() // Create default
		}
		return err
	}

	return json.Unmarshal(data, &s.Config)
}

func (s *ConfigStore) Save(config SystemConfig) error {
	s.mu.Lock()
	defer s.mu.Unlock()
	s.Config = config
	return s.saveInternal()
}

func (s *ConfigStore) saveInternal() error {
	data, err := json.MarshalIndent(s.Config, "", "  ")
	if err != nil {
		return err
	}
	return os.WriteFile(s.FilePath, data, 0644)
}

func (s *ConfigStore) Get() SystemConfig {
	s.mu.RLock()
	defer s.mu.RUnlock()
	return s.Config
}
