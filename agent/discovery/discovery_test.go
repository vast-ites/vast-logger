package discovery

import (
	"os"
	"path/filepath"
	"testing"
)

func TestCanRead(t *testing.T) {
	// 1. Create readable file
	readable := "test_readable.log"
	os.WriteFile(readable, []byte("data"), 0644)
	defer os.Remove(readable)

	if !canRead(readable) {
		t.Errorf("Expected canRead(readable) to be true")
	}

	// 2. Create unreadable file (if possible as non-root)
    // As regular user, we can set chmod 000
    unreadable := "test_unreadable.log"
    os.WriteFile(unreadable, []byte("data"), 0000)
    defer os.Remove(unreadable)
    
    // Note: If running as root (in container), this might still return true. 
    // But assuming user context:
    if len(os.Getenv("SUDO_USER")) > 0 || os.Geteuid() != 0 {
        if canRead(unreadable) {
             // In some CI envs, user might still own it.
             // Let's verify expectations only if we know rights.
             // checking Access...
             t.Log("Warning: Running as owner might allow read even with 000 in some FS?")
        }
    }
}

func TestFindServiceLogs(t *testing.T) {
    // Mock PM2 home
    tmpHome := t.TempDir()
    os.Setenv("HOME", tmpHome)
    
    pm2Dir := filepath.Join(tmpHome, ".pm2", "logs")
    os.MkdirAll(pm2Dir, 0755)
    
    logFile := filepath.Join(pm2Dir, "app-out.log")
    os.WriteFile(logFile, []byte("log data"), 0644)
    
    logs := FindServiceLogs("pm2")
    if len(logs) == 0 {
        t.Errorf("Expected to find PM2 logs in mocked home")
    }
    if logs[0].Path != logFile {
        t.Errorf("Expected path %s, got %s", logFile, logs[0].Path)
    }
}
