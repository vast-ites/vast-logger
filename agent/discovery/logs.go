package discovery

import (
	"os"
	"path/filepath"
	"strconv"
	"strings"
)

// DiscoveredLog represents a log file found on the system
type DiscoveredLog struct {
	Path       string `json:"path"`
	SourceType string `json:"source_type"` // e.g., "process_open_file", "var_log", "systemd"
	ProcessName string `json:"process_name,omitempty"`
}

// FindLogs via multiple strategies
func FindLogs() ([]DiscoveredLog, error) {
	var logs []DiscoveredLog
	seen := make(map[string]bool)

    // Strategy 0: High Priority System Logs & Package Managers
    priorityLogs := []string{
        // Core System
        "/var/log/syslog",
        "/var/log/auth.log",
        "/var/log/kern.log",
        "/var/log/messages",  // RHEL/CentOS
        "/var/log/secure",    // RHEL/CentOS
        "/var/log/maillog",
        "/var/log/mail.log",
        "/var/log/dmesg",
        "/var/log/boot.log",
        "/var/log/faillog",
        
        // Package Managers
        "/var/log/dpkg.log",
        "/var/log/apt/history.log",
        "/var/log/apt/term.log",
        "/var/log/yum.log",
        "/var/log/dnf.log",
        "/var/log/dnf.rpm.log",
        "/var/log/pacman.log",
        "/var/log/alternatives.log",
    }
    
    for _, path := range priorityLogs {
        if canRead(path) {
             logs = append(logs, DiscoveredLog{
                Path: path,
                SourceType: "system_core",
                ProcessName: "system",
             })
             seen[path] = true
        }
    }

	// Strategy 1: /proc walker (Process Introspection)
	procLogs, err := scanProcForOpenLogs()
	if err == nil {
		for _, log := range procLogs {
			if !seen[log.Path] && canRead(log.Path) {
				logs = append(logs, log)
				seen[log.Path] = true
			}
		}
	}

	// Strategy 2: Common paths scanner (Recursive)
	commonRoots := []string{"/var/log", "/opt", "/home"}
	for _, root := range commonRoots {
		pathLogs := scanDirectory(root)
		for _, log := range pathLogs {
			if !seen[log.Path] {
				logs = append(logs, log)
				seen[log.Path] = true
			}
		}
	}

	return logs, nil
}

// scanProcForOpenLogs iterates over /proc/[pid]/fd to find open .log files
func scanProcForOpenLogs() ([]DiscoveredLog, error) {
	var results []DiscoveredLog
	
	// Read all PIDs
	entries, err := os.ReadDir("/proc")
	if err != nil {
		return nil, err
	}

	for _, entry := range entries {
		if !entry.IsDir() {
			continue
		}
		
		pid := entry.Name()
		if _, err := strconv.Atoi(pid); err != nil {
			continue // Not a PID
		}

		// Read process name
		commBytes, _ := os.ReadFile(filepath.Join("/proc", pid, "comm"))
		procName := strings.TrimSpace(string(commBytes))

		// Check file descriptors
		fdPath := filepath.Join("/proc", pid, "fd")
		fds, err := os.ReadDir(fdPath)
		if err != nil {
			continue
		}

		for _, fd := range fds {
			linkPath, err := os.Readlink(filepath.Join(fdPath, fd.Name()))
			if err != nil {
				continue
			}

			// Capture if it looks like a log file
			if strings.HasSuffix(linkPath, ".log") || strings.Contains(linkPath, "/log/") {
				// Basic filter to avoid system devices
				if strings.HasPrefix(linkPath, "/dev") || strings.HasPrefix(linkPath, "socket:") || strings.HasPrefix(linkPath, "pipe:") {
					continue
				}

                // Avoid collecting docker json logs via file (handled by Docker Collector)
                if strings.Contains(linkPath, "/var/lib/docker") || strings.Contains(linkPath, "/containers/") {
                    continue
                }

				results = append(results, DiscoveredLog{
					Path:        linkPath,
					SourceType:  "process_open_file",
					ProcessName: procName,
				})
			}
		}
	}

	return results, nil
}

// Helper to check read permissions
func canRead(path string) bool {
    f, err := os.Open(path)
    if err != nil {
        return false
    }
    f.Close()
    return true
}

func scanDirectory(root string) []DiscoveredLog {
	var results []DiscoveredLog
	
	filepath.Walk(root, func(path string, info os.FileInfo, err error) error {
		if err != nil {
			return nil // Skip permission errors
		}
		if info.IsDir() {
			// Skip hidden dirs and common noisy dirs
			if strings.HasPrefix(info.Name(), ".") || info.Name() == "node_modules" || info.Name() == "vendor" {
				return filepath.SkipDir
			}
            // Skip Docker internal storage to avoid duplication
            if info.Name() == "docker" && strings.Contains(path, "/var/lib") {
                return filepath.SkipDir
            }
			return nil
		}

        name := info.Name()
        
        // Skip compressed/binary/noisy files
        if strings.HasSuffix(name, ".gz") || strings.HasSuffix(name, ".zip") || 
           strings.HasSuffix(name, ".tar") || strings.HasSuffix(name, ".xz") ||
           strings.HasSuffix(name, "utmp") || strings.HasSuffix(name, "wtmp") ||
           strings.HasSuffix(name, "btmp") || strings.HasSuffix(name, "lastlog") ||
           strings.HasSuffix(name, ".1") || strings.HasSuffix(name, ".2") ||
           strings.HasSuffix(name, ".old") || strings.HasSuffix(name, ".bak") ||
           strings.Contains(name, "datavast") || strings.Contains(name, "agent.log") {
            return nil
        }

        // Accept .log, .err, .out
		if strings.HasSuffix(name, ".log") || strings.HasSuffix(name, ".err") || strings.HasSuffix(name, ".out") {
            if canRead(path) {
                results = append(results, DiscoveredLog{
                    Path:       path,
                    SourceType: "filesystem_scan",
                })
            }
		}
		return nil
	})

	return results
}

// FindServiceLogs looks for standard service logs
func FindServiceLogs(service string) []DiscoveredLog {
    var logs []DiscoveredLog
    var patterns []string
    
    switch service {
    case "nginx":
        patterns = []string{"/var/log/nginx/*.log"}
    case "apache":
        patterns = []string{"/var/log/apache2/*.log", "/var/log/httpd/*.log"}
    case "pm2":
        home, _ := os.UserHomeDir()
        patterns = []string{filepath.Join(home, ".pm2/logs/*.log")}
    }
    
    for _, pattern := range patterns {
        matches, _ := filepath.Glob(pattern)
        for _, path := range matches {
            if canRead(path) {
                logs = append(logs, DiscoveredLog{
                    Path: path,
                    SourceType: service,
                    ProcessName: service,
                })
            }
        }
    }
    return logs
}
