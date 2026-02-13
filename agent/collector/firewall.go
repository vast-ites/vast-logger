package collector

import (
	"fmt"
	"os/exec"
	"regexp"
	"strings"
)

type FirewallCollector struct{}

func NewFirewallCollector() *FirewallCollector {
	return &FirewallCollector{}
}

func (c *FirewallCollector) Collect() (string, error) {
	// Try UFW first
	out, err := exec.Command("sudo", "ufw", "status", "verbose").CombinedOutput()
	if err == nil {
		output := string(out)
		// If UFW is active, return its output
		if !strings.Contains(output, "Status: inactive") {
			return output, nil
		}
		// If UFW is inactive, fall through to iptables
	}

	// Check iptables (used when UFW is inactive or not installed)
	out, err = exec.Command("sudo", "iptables", "-L", "-n").CombinedOutput()
	if err == nil {
		return string(out), nil
	}

	return "Firewall info unavailable (requires sudo)", nil
}

// CollectBlockedIPs parses iptables for DROP/REJECT rules across ALL chains
// (including fail2ban chains like f2b-sshd) and returns the blocked IPs.
// Uses iptables-save which dumps all chains, unlike iptables -L INPUT which
// only shows the INPUT chain and misses fail2ban/custom chains.
var ipRegex = regexp.MustCompile(`\b(\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3})\b`)

func (c *FirewallCollector) CollectBlockedIPs() ([]string, error) {
	out, err := exec.Command("sudo", "iptables-save").CombinedOutput()
	if err != nil {
		return nil, fmt.Errorf("iptables-save failed: %w: %s", err, string(out))
	}

	var blocked []string
	seen := make(map[string]bool)
	lines := strings.Split(string(out), "\n")

	for _, line := range lines {
		trimmed := strings.TrimSpace(line)
		// iptables-save format: "-A f2b-sshd -s 45.164.39.253/32 -j REJECT ..."
		//                    or "-A INPUT -s 178.185.136.57/32 -j DROP"
		// Match any rule with -j DROP or -j REJECT targeting a source IP
		if !strings.HasPrefix(trimmed, "-A ") {
			continue
		}
		if !strings.Contains(trimmed, "-j DROP") && !strings.Contains(trimmed, "-j REJECT") {
			continue
		}
		// Extract source IP from -s flag
		// Format: -s IP/MASK or -s IP
		parts := strings.Fields(trimmed)
		for i, part := range parts {
			if part == "-s" && i+1 < len(parts) {
				ipStr := parts[i+1]
				// Strip CIDR mask (e.g., /32)
				if idx := strings.Index(ipStr, "/"); idx > 0 {
					ipStr = ipStr[:idx]
				}
				// Skip 0.0.0.0, 127.x, broadcast
				if ipStr != "0.0.0.0" && !strings.HasPrefix(ipStr, "127.") && !seen[ipStr] {
					seen[ipStr] = true
					blocked = append(blocked, ipStr)
				}
				break
			}
		}
	}

	return blocked, nil
}

// ExecuteIPTablesCommand applies or removes iptables rules for an IP.
// For blocking: inserts a DROP rule at the top of the INPUT chain.
// For unblocking: scans ALL chains (including fail2ban's f2b-*) and removes
// every DROP/REJECT rule matching the source IP.
func (c *FirewallCollector) ExecuteIPTablesCommand(action, ip string) (string, error) {
	switch action {
	case "block_ip":
		// Insert at top of INPUT chain for immediate effect
		args := []string{"iptables", "-I", "INPUT", "-s", ip, "-j", "DROP"}
		out, err := exec.Command("sudo", args...).CombinedOutput()
		if err != nil {
			return string(out), fmt.Errorf("iptables block failed: %w: %s", err, string(out))
		}
		return string(out), nil

	case "unblock_ip":
		// Smart unblock: find ALL rules matching this IP across all chains
		// and remove them. This handles fail2ban (f2b-sshd REJECT) and
		// manual blocks (INPUT DROP) alike.
		saveOut, err := exec.Command("sudo", "iptables-save").CombinedOutput()
		if err != nil {
			return "", fmt.Errorf("iptables-save failed: %w: %s", err, string(saveOut))
		}

		var removed int
		var lastErr error
		lines := strings.Split(string(saveOut), "\n")
		for _, line := range lines {
			trimmed := strings.TrimSpace(line)
			// Match rules like: -A f2b-sshd -s 134.209.93.41/32 -j REJECT ...
			//                or: -A INPUT -s 134.209.93.41/32 -j DROP
			if !strings.HasPrefix(trimmed, "-A ") {
				continue
			}
			if !strings.Contains(trimmed, ip) {
				continue
			}
			if !strings.Contains(trimmed, "-j DROP") && !strings.Contains(trimmed, "-j REJECT") {
				continue
			}

			// Convert -A (append) to -D (delete) to build the delete command
			// e.g., "-A f2b-sshd -s 134.209.93.41/32 -j REJECT --reject-with icmp-port-unreachable"
			// becomes "iptables -D f2b-sshd -s 134.209.93.41/32 -j REJECT --reject-with icmp-port-unreachable"
			deleteRule := strings.Replace(trimmed, "-A ", "-D ", 1)
			deleteArgs := strings.Fields(deleteRule)

			out, err := exec.Command("sudo", append([]string{"iptables"}, deleteArgs...)...).CombinedOutput()
			if err != nil {
				lastErr = fmt.Errorf("iptables delete failed for chain rule '%s': %w: %s", trimmed, err, string(out))
			} else {
				removed++
			}
		}

		if removed == 0 && lastErr != nil {
			return "", lastErr
		}
		if removed == 0 {
			return "", fmt.Errorf("no matching iptables rules found for IP %s", ip)
		}
		return fmt.Sprintf("Removed %d rule(s) for %s", removed, ip), nil

	default:
		return "", fmt.Errorf("unknown action: %s", action)
	}
}

