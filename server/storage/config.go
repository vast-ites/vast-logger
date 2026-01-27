package storage

import (
	"encoding/json"
    "math/rand"
	"os"
	"sync"
)

type SystemConfig struct {
	RetentionDays  int     `json:"retention_days"`
	DDoSThreshold  float64 `json:"ddos_threshold"`
	EmailAlerts    bool    `json:"email_alerts"`
    AdminPassword  string  `json:"admin_password"`
    SystemAPIKey   string  `json:"system_api_key"` // For Agent Registration
    MFAEnabled     bool    `json:"mfa_enabled"`
    MFASecret      string  `json:"mfa_secret"`     // TOTP Secret
    AgentSecrets   map[string]string `json:"agent_secrets"` // Hostname -> Secret
    IgnoredHosts   []string `json:"ignored_hosts"` // List of hosts to hide
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

	if err := json.Unmarshal(data, &s.Config); err != nil {
        return err
    }
    
    // Ensure System API Key exists
    if s.Config.SystemAPIKey == "" {
        s.Config.SystemAPIKey = generateRandomKey(32)
        s.saveInternal() // Save back to file
    }
    
    // Ensure AgentSecrets map is initialized
    if s.Config.AgentSecrets == nil {
        s.Config.AgentSecrets = make(map[string]string)
    }

    return nil
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
func generateRandomKey(n int) string {
    const letters = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789"
    b := make([]byte, n)
    for i := range b {
        b[i] = letters[rand.Intn(len(letters))]
    }
    return string(b)
}
