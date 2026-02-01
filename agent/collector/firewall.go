package collector

import (
	"os/exec"
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
