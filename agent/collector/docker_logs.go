package collector

import (
	"bufio"
	"context"
	"fmt"
	"io"
	"strings"
	"time"

	"github.com/docker/docker/api/types/container" 
	"github.com/docker/docker/pkg/stdcopy"
)

// StreamLogs attaches to a container and streams logs to the channel
func (dc *DockerCollector) StreamLogs(ctx context.Context, id string, name string, out chan<- LogLine) {
	options := container.LogsOptions{
		ShowStdout: true,
		ShowStderr: true,
		Follow:     true,
		Tail:       "0", // Only new logs to avoid flood
        Timestamps: true,
	}

	reader, err := dc.cli.ContainerLogs(ctx, id, options)
	if err != nil {
		fmt.Printf("Error streaming logs for %s: %v\n", name, err)
		return
	}
	defer reader.Close()

    // Docker logs (when TTY=false) have a header. stdcopy handles demultiplexing.
    // We'll use pipes to separate stdout and stderr and scan them line by line.
    
    outReader, outWriter := io.Pipe()
    errReader, errWriter := io.Pipe()

    // Start stdcopy in a goroutine
    go func() {
        // stdcopy.StdCopy(stdout, stderr, src)
        _, _ = stdcopy.StdCopy(outWriter, errWriter, reader)
        outWriter.Close()
        errWriter.Close()
    }()

    // Scan Stdout
    go func() {
        scanner := bufio.NewScanner(outReader)
        for scanner.Scan() {
            text := scanner.Text()
            // Parse Timestamp if possible (Docker returns "2024-01-01T... Z content")
            // But stdcopy strips the header, not the content. 
            // If Timestamps: true, the line starts with timestamp.
            
            ts, content := parseDockerTimestamp(text)
            
            out <- LogLine{
                Path:      "docker://" + id, // Virtual path
                Content:   content,
                Level:     ParseLogLine(content), // Heuristic level
                Service:   name,
                Timestamp: ts,
            }
        }
    }()

    // Scan Stderr
    go func() {
        scanner := bufio.NewScanner(errReader)
        for scanner.Scan() {
            text := scanner.Text()
            ts, content := parseDockerTimestamp(text)

            out <- LogLine{
                Path:      "docker://" + id,
                Content:   content,
                Level:     "ERROR", // All stderr is technically error/warn usually, or we parse it too
                Service:   name,
                Timestamp: ts,
            }
        }
    }()

    // Block until context done or stream ends
    <-ctx.Done()
}

func parseDockerTimestamp(line string) (time.Time, string) {
    // Format: 2026-01-28T10:14:48.282773Z actual_message
    parts := strings.SplitN(line, " ", 2)
    if len(parts) == 2 {
        if t, err := time.Parse(time.RFC3339Nano, parts[0]); err == nil {
            return t, parts[1]
        }
    }
    return time.Now(), line
}
