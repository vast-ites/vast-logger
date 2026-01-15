package collector

import (
	"strings"
)

// ParseLogLine analyzes a raw log line to extract metadata like Level.
func ParseLogLine(line string) string {
	lower := strings.ToLower(line)
	
    // Critical/Error
	if strings.Contains(lower, "error") || 
       strings.Contains(lower, "fail") || 
       strings.Contains(lower, "calamity") || // Sci-fi keywords ;)
       strings.Contains(lower, "critical") ||
       strings.Contains(lower, "exception") ||
       strings.Contains(lower, "panic") {
		return "ERROR"
	}

    // Warnings
	if strings.Contains(lower, "warn") || 
       strings.Contains(lower, "alert") {
		return "WARN"
	}

    // Debug
    if strings.Contains(lower, "debug") ||
       strings.Contains(lower, "trace") {
        return "DEBUG"
    }

	return "INFO"
}
