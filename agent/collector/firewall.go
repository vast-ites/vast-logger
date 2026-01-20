package collector

import (
	"os/exec"
)

type FirewallCollector struct{}

func NewFirewallCollector() *FirewallCollector {
	return &FirewallCollector{}
}

func (c *FirewallCollector) Collect() (string, error) {
	// Try UFW first
	out, err := exec.Command("sudo", "ufw", "status").CombinedOutput()
	if err == nil {
		return string(out), nil
	}

	// Fallback to iptables
	out, err = exec.Command("sudo", "iptables", "-L", "-n").CombinedOutput()
	if err == nil {
		return string(out), nil
	}

	return "Firewall info unavailable (requires sudo)", nil
}
