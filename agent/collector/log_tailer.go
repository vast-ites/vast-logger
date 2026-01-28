package collector

import (
	"log"
	"time"

	"github.com/hpcloud/tail"
)

type LogLine struct {
	Path      string
	Content   string
    Level     string
    Service   string // "agent", "nginx", "mysql", etc.
	Timestamp time.Time
}

// TailFile starts a goroutine that tails a specific file and sends lines to the channel
func TailFile(path string, out chan<- LogLine) {
	t, err := tail.TailFile(path, tail.Config{
		Follow: true,
		ReOpen: true,
		// Start at end for now to avoid re-ingesting old logs on restart
		Location: &tail.SeekInfo{Offset: 0, Whence: 2}, 
		Logger: tail.DiscardingLogger,
	})
	if err != nil {
		log.Printf("Error tailing %s: %v", path, err)
		return
	}

	// Read lines
	go func() {
		for line := range t.Lines {
			out <- LogLine{
				Path:      path,
				Content:   line.Text,
                Level:     ParseLogLine(line.Text),
				Timestamp: line.Time,
			}
		}
	}()
}
