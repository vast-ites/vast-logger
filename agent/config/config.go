package config

import (
    "encoding/json"
    "os"
)

type AgentConfig struct {
    ServerURL   string          `json:"server_url"`
    AgentID     string          `json:"agent_id"`
    AgentSecret string          `json:"agent_secret"`
    Collectors  CollectorConfig `json:"collectors"`
    LogConfig   LogStrategy     `json:"log_config"`
}

type CollectorConfig struct {
    System     bool `json:"system"`
    Docker     bool `json:"docker"`
    Kubernetes bool `json:"kubernetes"`
    PM2        bool `json:"pm2"`
    Nginx      bool `json:"nginx"`
    Apache     bool `json:"apache"`
}

type LogStrategy struct {
    Mode         string   `json:"mode"` // "all", "selected", "none"
    SelectedLogs []string `json:"selected_logs"`
}

func LoadConfig() (*AgentConfig, error) {
    data, err := os.ReadFile("agent-config.json")
    if err != nil {
        return nil, err
    }
    var cfg AgentConfig
    if err := json.Unmarshal(data, &cfg); err != nil {
        return nil, err
    }
    return &cfg, nil
}

func SaveConfig(cfg *AgentConfig) error {
    data, err := json.MarshalIndent(cfg, "", "  ")
    if err != nil {
        return err
    }
    return os.WriteFile("agent-config.json", data, 0644)
}
