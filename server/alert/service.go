package alert

import (
    "bytes"
    "encoding/json"
    "fmt"
    "net/http"
    "net/smtp"
    "strings"
    "log"

    "github.com/datavast/datavast/server/storage"
)

type AlertService struct {
    Config *storage.ConfigStore
}

func NewAlertService(cfg *storage.ConfigStore) *AlertService {
    return &AlertService{Config: cfg}
}

func (s *AlertService) CheckAndAlert(host string, netReceiveRate float64, ddosStatus string) {
    cfg := s.Config.Get()
    
    // 1. Check Master Switch
    if !cfg.EmailAlerts {
        return
    }
    
    // 2. Check Thresholds
    // Convert Threshold (MB/s) to B/s
    thresholdBytes := cfg.DDoSThreshold * 1024 * 1024
    
    isDDoS := ddosStatus == "DDoS" || (netReceiveRate > thresholdBytes && thresholdBytes > 0)
    
    if isDDoS {
        msg := fmt.Sprintf("CRITICAL: DDoS Detected on %s! Rate: %.2f MB/s", host, netReceiveRate/1024/1024)
        s.Dispatch(msg)
    }
}

func (s *AlertService) Dispatch(message string) {
    cfg := s.Config.Get()
    
    // Webhooks
    for _, url := range cfg.WebhookURLs {
        go s.sendWebhook(url, message)
    }
    
    // Emails
    if len(cfg.AlertEmails) > 0 {
        go s.sendEmail(cfg.AlertEmails, message)
    }
}

func (s *AlertService) sendWebhook(url, message string) {
    payload := map[string]string{"content": message} // Discord/Slack friendly
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
    if cfg.SMTPServer == "" {
        log.Println("SMTP not configured, skipping email.")
        return
    }
    
    auth := smtp.PlainAuth("", cfg.SMTPUser, cfg.SMTPPassword, cfg.SMTPServer)
    
    msg := []byte(fmt.Sprintf("To: %s\r\n"+
        "Subject: DataVast Alert\r\n"+
        "\r\n"+
        "%s\r\n", strings.Join(to, ","), message))
        
    addr := fmt.Sprintf("%s:%d", cfg.SMTPServer, cfg.SMTPPort)
    if err := smtp.SendMail(addr, auth, cfg.SMTPUser, to, msg); err != nil {
        log.Printf("Email failed: %v", err)
    }
}
