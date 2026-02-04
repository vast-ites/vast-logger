package alert

import (
    "bytes"
    "encoding/json"
    "fmt"
    "net/http"
    "net/smtp"
    "strings"
    "time"
    "log"

    "github.com/datavast/datavast/server/storage"
)

type AlertService struct {
    Config *storage.ConfigStore
    Logs   *storage.LogStore
}

func NewAlertService(cfg *storage.ConfigStore, logs *storage.LogStore) *AlertService {
    return &AlertService{Config: cfg, Logs: logs}
}

func (s *AlertService) CheckAndAlert(host string, netReceiveRate float64, ddosStatus string) {
    // Legacy generic check for DDoS
    s.EvaluateRules(host, map[string]float64{
        "net_recv_rate": netReceiveRate,
        "ddos_status": func() float64 {
            if ddosStatus == "DDoS" { return 1.0 }
            return 0.0
        }(),
    })
}

// EvaluateRules checks all active rules against the provided metrics
func (s *AlertService) EvaluateRules(host string, metrics map[string]float64) {
    cfg := s.Config.Get()
    
    // Create lookup map for channels
    channels := make(map[string]storage.NotificationChannel)
    for _, ch := range cfg.NotificationChannels {
        channels[ch.ID] = ch
    }

    for _, rule := range cfg.AlertRules {
        if !rule.Enabled { continue }
        
        // 1. Host Filter
        if rule.Host != "" && rule.Host != "*" && rule.Host != host {
            continue
        }

        // 2. Check Silence
        if expiry, ok := rule.Silenced[host]; ok {
            if time.Now().Before(expiry) {
                continue // Silenced
            }
        }

        // 3. Check Metric
        val, ok := metrics[rule.Metric]
        if !ok { continue }

        triggered := false
        switch rule.Operator {
        case ">":
            triggered = val > rule.Threshold
        case "<":
            triggered = val < rule.Threshold
        case ">=":
            triggered = val >= rule.Threshold
        case "<=":
            triggered = val <= rule.Threshold
        }

        if triggered {
            msg := fmt.Sprintf("ALERT: %s triggered on %s! %s %.2f %s %.2f", 
                rule.Name, host, rule.Metric, val, rule.Operator, rule.Threshold)
            
            // Log to DB
            if s.Logs != nil {
                s.Logs.InsertAlert(storage.AlertEntry{
                    Timestamp: time.Now(),
                    Host:      host,
                    Type:      "Rule: " + rule.Name,
                    Severity:  "WARNING",
                    Message:   msg,
                    Resolved:  false,
                })
            }

            // Dispatch
            s.DispatchRule(rule, channels, msg)
        }
    }
}

func (s *AlertService) DispatchRule(rule storage.AlertRule, channels map[string]storage.NotificationChannel, message string) {
    // 1. Rule Specific Channels
    for _, chID := range rule.Channels {
        if ch, ok := channels[chID]; ok {
            switch ch.Type {
            case "webhook":
                go s.sendWebhook(ch.Config["url"], message)
            case "email":
                go s.sendEmail([]string{ch.Config["email"]}, message)
            }
        }
    }
    
    // 2. Global Legacy Channels (if configured to fallback? Or just migrated?)
    // For now, we respect the Rule definition strictly.
}

// Dispatch Legacy (for backward compat if needed, or migration)
func (s *AlertService) Dispatch(message string) {
    cfg := s.Config.Get()
    for _, url := range cfg.WebhookURLs {
        go s.sendWebhook(url, message)
    }
    if len(cfg.AlertEmails) > 0 {
        go s.sendEmail(cfg.AlertEmails, message)
    }
}

func (s *AlertService) sendWebhook(url, message string) {
    if url == "" { return }
    payload := map[string]string{"content": message}
    data, _ := json.Marshal(payload)
    resp, err := http.Post(url, "application/json", bytes.NewBuffer(data))
    if err != nil {
        log.Printf("Webhook failed: %v", err)
        return
    }
    defer resp.Body.Close()
}

func (s *AlertService) sendEmail(to []string, message string) {
    cfg := s.Config.Get()
    if cfg.SMTPServer == "" || len(to) == 0 { return }
    
    auth := smtp.PlainAuth("", cfg.SMTPUser, cfg.SMTPPassword, cfg.SMTPServer)
    msg := []byte(fmt.Sprintf("To: %s\r\nSubject: DataVast Alert\r\n\r\n%s\r\n", strings.Join(to, ","), message))
    addr := fmt.Sprintf("%s:%d", cfg.SMTPServer, cfg.SMTPPort)
    if err := smtp.SendMail(addr, auth, cfg.SMTPUser, to, msg); err != nil {
        log.Printf("Email failed: %v", err)
    }
}
