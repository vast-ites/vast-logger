# DataVAST Observability Platform

**DataVAST** is a modern, zero-config observability platform for Linux infrastructure. Built with Go, React, ClickHouse, and InfluxDB, it provides real-time monitoring, log aggregation, and intelligent alerting across your entire fleet.

## ✨ Features

### 🔍 **Comprehensive Monitoring**
- **Real-Time Metrics**: CPU, Memory, Disk I/O, Network traffic (1s resolution)
- **Container Monitoring**: Auto-discovery and streaming logs from Docker containers
- **Process Tracking**: Monitor individual processes with resource usage
- **Multi-Host Dashboard**: Centralized view of all connected agents

### 📊 **Advanced Log Management**
- **Smart Log Discovery**: Automatic detection of system, application, and service logs
- **Full-Text Search**: Regex-based search with advanced filtering
- **Service Categorization**: Auto-categorize logs by service (Apache, Nginx, MySQL, etc.)
- **Real-Time Streaming**: Live log tailing with configurable refresh rates
- **Export Capabilities**: Download filtered logs in JSON format

### 🎯 **Services & Integrations Hub**
- **Service Discovery**: Automatic detection of running services across all hosts
- **Integration Wizard**: Quick setup for Apache, Nginx, PM2, and custom log files
- **Deep-Linking**: Click services to view filtered logs instantly
- **Multi-Host Aggregation**: Services from all agents in one unified view

### 🚨 **Intelligent Alerting**
- **Multi-Channel Notifications**: Email (SMTP) and Webhook support
- **DDoS Detection**: Automatic threat detection and alerting
- **Resource Thresholds**: Alert on CPU, Memory, Disk usage
- **Customizable Rules**: Define your own alert conditions

### 🎨 **Modern UI/UX**
- **Sci-Fi Themed Dashboard**: Sleek, dark-mode interface
- **Global Host Context**: Seamless navigation across pages
- **Live Data Visualization**: Real-time charts and metrics
- **Responsive Design**: Works on desktop and tablet

---

## 🚀 Quick Start

### Prerequisites
- **Docker & Docker Compose** (for databases)
- **Go 1.21+** (for agent/server)
- **Node.js 18+** (for frontend)

### 1. Start Infrastructure (Databases)
Initialize ClickHouse and InfluxDB containers.
```bash
cd deployment
docker-compose up -d
```
*Wait ~15 seconds for databases to be ready.*

### 2. Configure Environment
Create `.env` file with your credentials.
```bash
# Copy the example file
cp .env.example .env

# Edit the file
nano .env
```

**Important: Set your admin password in `.env` file:**
```bash
# Line 17 - Change this to your own password
ADMIN_PASSWORD=your-secure-password-here
```

**Default credentials (if you don't change):**
- **Username:** `admin`
- **Password:** `admin123`

### 3. Start Backend Server
Runs on port `8080`. Connects to databases.
```bash
cd server
go mod tidy
go build -o datavast-server
./datavast-server
```

**✅ Server will automatically load credentials from `.env` file**

### 4. Start Agent
Runs as `root` to discover logs and metrics. Sends data to Server.
```bash
cd agent
go mod tidy
go build -o datavast-agent
sudo ./datavast-agent
```

### 5. Start Frontend Dashboard
Runs on port `5173`.
```bash
cd web
npm install
npm run dev
```

### 6. Access the Platform
Open your browser and navigate to:
**http://localhost:5173**

**Login with the credentials you set in Step 2:**
- **Username:** `admin`
- **Password:** (the one you set in `.env` file)

---

## 🏗️ Architecture

```
┌─────────────────┐      ┌─────────────────┐      ┌─────────────────┐
│  Agent (Go)     │─────▶│  Server (Go)    │─────▶│  Frontend       │
│  - Log Tailing  │      │  - API Gateway  │      │  (React + Vite) │
│  - Metrics      │      │  - ClickHouse   │      │  - Dashboard    │
│  - Discovery    │      │  - InfluxDB     │      │  - Charts       │
└─────────────────┘      └─────────────────┘      └─────────────────┘
```

### Components

**Agent**:
- Multi-strategy log discovery (filesystem, /proc, manual)
- Smart service tagging (Apache, Nginx, PM2, etc.)
- Docker log streaming
- System metric collection (CPU, RAM, Disk, Network)
- Container metric collection

**Server**:
- RESTful API (Gin framework)
- ClickHouse for log storage (high-throughput writes)
- InfluxDB for time-series metrics
- HTTP polling for real-time updates
- JWT-based authentication with session management

**Frontend**:
- React 18 with Vite
- Redux Toolkit for state management
- Recharts for visualizations
- Lucide React for icons
- Tailwind CSS for styling

**Security**:
- **Authentication**: JWT-based auth encapsulated in `OptionalAuth` middleware.
- **Default State**: Secure by default (`AUTH_ENABLED=true`).
- **Authorization**: Role-based access control (RBAC) foundation.
- **Frontend Security**: Automatic token injection and session management.

---

## 🔐 Authentication

The platform uses a secure-by-default approach:
- **Credentials**: Set in `.env` file (`ADMIN_PASSWORD`)
- **Default Username**: `admin`
- **Default Password**: `admin123` (if you use the provided `.env` file as-is)
- **Enforcement**: Public API endpoints require a valid JWT token.
- **Disable Auth**: Set `AUTH_ENABLED=false` in `.env` (NOT recommended for production).
- **Frontend**: Automatically handles token storage and injection in `HostContext`.

**To change password:**
1. Edit the `.env` file in your project root
2. Update `ADMIN_PASSWORD=your-new-password`
3. Restart the server

---

## 📦 Deployment

### Production Setup

1. **Deploy Databases**:
   ```bash
   cd deployment
   docker-compose -f docker-compose.yml up -d
   ```

2. **Build Server**:
   ```bash
   cd server
   go build -o server
   ./server
   ```

3. **Build Frontend**:
   ```bash
   cd web
   npm run build
   # Serve dist/ with Nginx or copy to server
   ```

4. **Deploy Agent** (on each monitored host):
   ```bash
   cd agent
   go build -o datavast-agent
   
   # Copy binary
   sudo mkdir -p /opt/datavast
   sudo cp datavast-agent /opt/datavast/
   
   # Create systemd service
   sudo tee /etc/systemd/system/datavast-agent.service << 'EOF'
[Unit]
Description=DataVast Agent
After=network.target

[Service]
Type=simple
User=root
WorkingDirectory=/opt/datavast
ExecStart=/opt/datavast/datavast-agent
Restart=always
RestartSec=10

[Install]
WantedBy=multi-user.target
EOF
   
   # Enable and start service
   sudo systemctl daemon-reload
   sudo systemctl enable datavast-agent
   sudo systemctl start datavast-agent
   ```

### Agent Configuration
Create `/opt/datavast/agent-config.json`:
```json
{
  "server_url": "http://your-server:8080",
  "agent_id": "production-web-1",
  "collectors": {
    "system": true,
    "docker": true,
    "apache": true
  },
  "log_config": {
    "mode": "selected",
    "selected_logs": [
      "/var/log/apache2/access.log",
      "/var/log/apache2/error.log"
    ]
  }
}
```

---

## 🔧 Configuration

### Environment Variables

**Server**:
- `CLICKHOUSE_ADDR` - ClickHouse address (default: localhost:9000)
- `INFLUXDB_URL` - InfluxDB URL (default: http://localhost:8086)
- `SERVER_PORT` - API port (default: 8080)

**Agent**:
- `SERVER_URL` - Backend server URL (default: http://localhost:8080)
- `AGENT_ID` - Unique agent identifier

---

## 🎯 Use Cases

### Web Application Monitoring
Monitor Apache/Nginx access logs, error logs, and application logs in real-time. Set alerts for HTTP 500 errors or traffic spikes.

### Infrastructure Monitoring
Track CPU, memory, disk usage across multiple servers. Get alerted when thresholds are exceeded.

### Container Orchestration
Auto-discover and monitor Docker containers. Stream logs from all containers in one centralized view.

### Security Monitoring
Monitor auth.log for failed login attempts. Detect DDoS attacks based on traffic patterns.

---

## 📚 Documentation

- **API Reference**: `/server/api/` - REST endpoints
- **Agent Discovery**: `/agent/discovery/` - Log & metric collection strategies
- **Frontend Components**: `/web/src/components/` - Reusable UI components

---

## 🛠️ Development

### Tech Stack
- **Backend**: Go, Gin, ClickHouse, InfluxDB
- **Frontend**: React 18, Vite, Redux Toolkit, Tailwind CSS
- **Agent**: Go (privileged execution)
- **Deployment**: Docker, Systemd

### Running Tests
```bash
# Backend
cd server
go test ./...

# Frontend
cd web
npm test
```

---

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

---

## 📝 License

This project is proprietary software. All rights reserved.

---

## 🚧 Roadmap

### Completed Phases

<details>
<summary><strong>🏗️ Foundation (Phases 1–7)</strong></summary>

#### Phase 1: Production Hardening & Settings ✅
- [x] Settings module with JSON-backed persistence (retention policies, alert thresholds)
- [x] JWT-based authentication & secrets management (env vars for DB tokens)
- [x] Per-interface network breakdown with InfluxDB derivatives

#### Phase 2: Network Telemetry ✅
- [x] Per-interface traffic analysis with stacked area charts
- [x] Live interface throughput HUD

#### Phase 3: Security Framework ✅
- [x] JWT auth, RBAC foundation, frontend token injection

#### Phase 4: Agent Enrollment & MFA ✅
- [x] Interactive agent handshake with System API Keys
- [x] TOTP-based MFA for admin actions
- [x] Authenticated agent sessions

#### Phase 5: Modular Agent Configuration ✅
- [x] Togglable collectors (System, Docker, Kubernetes, Nginx, Apache, PM2)
- [x] Permission-aware discovery for non-root execution
- [x] Persistent config via `agent-config.json`

#### Phase 6: Production Deployment ✅
- [x] Single-binary backend serving React frontend via `gin-contrib/static`
- [x] Remote provisioning automation (SSH/SCP)
- [x] Security hardening (localhost-bound databases, random admin password)

#### Phase 7: Multi-Node Architecture ✅
- [x] Global host selector with reactive UI pivoting
- [x] Dynamic node discovery via InfluxDB/ClickHouse tagging
- [x] Agent self-identification and persistence

</details>

<details>
<summary><strong>🔍 Core Features (Phases 8–19)</strong></summary>

#### Phase 8: UX Enhancements ✅
- [x] Configurable refresh rates (1s–60s), log export (CSV/JSON), advanced filtering

#### Phase 9: UI Refinements & Pagination ✅
- [x] Client-side pagination for 5000+ log results, universal refresh controls

#### Phase 10: Integrated Agent Enrollment ✅
- [x] In-HUD "Connect Agent" modal with auto-generated install commands

#### Phase 11: UI Stability & Bug Fixes ✅
- [x] Host selection persistence via `localStorage`, regex search stability

#### Phase 12: Advanced Search ✅
- [x] Omnibox syntax (`host:`, `level:`, `service:`, `before:`, `after:`, `order:`)
- [x] Dynamic ClickHouse query engine with structured filtering

#### Phase 13: Enhanced Node Insight ✅
- [x] Real-time process monitoring, firewall rule auditing (iptables/ufw)

#### Phase 14: UI Overhaul & Migration ✅
- [x] High-fidelity UI migration from `vast-pulse` repository

#### Phase 15: Detailed Resource Monitoring ✅
- [x] Specialized CPU, Memory, Disk, Network pages with `StatCard` and `ResourceChart` widgets

#### Phase 16: Capacity, Discovery & Stabilization ✅
- [x] Auto-detection of CPU model, Swap, partitions, network interfaces
- [x] Fixed OFFLINE false positives and 0% display bugs

#### Phase 17: Dashboard UI Overhaul ✅
- [x] High-density OverviewCard row (Uptime, Load, RAM, Disk), dark-card neon aesthetic

#### Phase 18: Live Terminal View ✅
- [x] Real-time `top -b` stream with ANSI-aware rendering

#### Phase 19: Real-Time Storage Analytics ✅
- [x] Kernel I/O counters, dynamic GB/TB scaling, ClickHouse TTL maintenance

</details>

<details>
<summary><strong>⚡ Scale & Reliability (Phases 20–29)</strong></summary>

#### Phase 20: Schema & UI Resilience ✅
- [x] API schema standardization, VFS filtering (overlay/snap), React purity enforcement

#### Phase 21: Performance Optimization ✅
- [x] Tiered metric collection (1s volatile / 10s hardware), `atomic.Value` decoupling, cache busting

#### Phase 22: Fleet Hardening ✅
- [x] Fleet-wide systemd migration, `SERVER_URL` standardization, self-monitoring hub

#### Phase 23: UI Metadata & Orchestration ✅
- [x] Source selector shows `Hostname (IP)`, real-time Online/Offline status, node removal

#### Phase 24: High-Frequency Monitoring ✅
- [x] Container network I/O delta rates, enhanced log discovery, global refresh state

#### Phase 25: Reliability & Resource Governance ✅
- [x] CPU/RAM limits for databases, feedback loop protection, emergency space recovery

#### Phase 26: Advanced Alerting & Notification Hub ✅
- [x] Webhook integration (Slack/Discord/PagerDuty), email notifications, threshold evaluation

#### Phase 27: Docker Log Streaming ✅
- [x] Native Docker SDK log streaming with `stdcopy`, auto container-name tagging

#### Phase 28: Services & Integrations Hub ✅
- [x] Categorized service dashboard, integration wizard, cross-page deep-linking

#### Phase 29: Optional API Authentication ✅
- [x] Environment-driven JWT enforcement (`AUTH_ENABLED`), role-based access, open ingestion paths

</details>

<details>
<summary><strong>🔬 Deep Monitoring (Phases 30–31)</strong></summary>

#### Phase 30: Per-Service Deep Monitoring ✅
- [x] Apache/Nginx access log forensics with GeoIP enrichment
- [x] MySQL/MariaDB connection & slow query auditing
- [x] PostgreSQL performance introspection (`pg_stat_activity`)
- [x] Redis memory & hit-rate analysis
- [x] MongoDB document statistics

#### Phase 31: Production Hardening & Remediation ✅
- [x] SQL injection mitigation (type-safe integer casting)
- [x] Git history sanitization (multi-branch `git-filter-repo` cleanup)
- [x] GeoIP deployment (`GeoLite2-City.mmdb`)
- [x] Connection retry logic with exponential backoff
- [x] 10-test automated API health suite (100% pass rate)

</details>

<details>
<summary><strong>🚀 Advanced Platform (Phases 32–38)</strong></summary>

#### Phase 32: Historical Network Analytics ✅
- [x] InfluxDB derivative rate calculation (B/s)
- [x] Multi-tier downsampling (10s, 1m, 5m, 1h) for time ranges
- [x] Dual-mode UI (Live real-time vs. Historical aggregated views)
- [x] Strict host-context isolation in multi-agent queries

#### Phase 33: User-Configurable Alerting Engine ✅
- [x] Generic rule engine for all telemetry metrics
- [x] CRUD API for rules, channels, and silencing
- [x] Pluggable notifications (Email, Webhooks, Slack)
- [x] Alert silencing with duration controls (15m–3d)
- [x] Rule editing, toggling, and network metric expansion

#### Phase 34: Dynamic Theme System ✅
- [x] Full Light/Dark mode with RGB-channel CSS variables
- [x] Theme persistence via `localStorage` + system preference detection

#### Phase 35: Dark Mode Contrast Hardening ✅
- [x] Boosted `--text-muted` contrast, semantic token migration, native dropdown fixes

#### Phase 36: Per-Container Log Discovery ✅
- [x] Docker container name tagging in Log Explorer
- [x] `<optgroup>` categorization separating containers from host services

#### Phase 37: L4 Connection Tracking ✅
- [x] ClickHouse `datavast.connections` table with TTL
- [x] Backend ingest, summary, and detail API handlers
- [x] High-frequency (1s) agent collector with process resolution

#### Phase 38: Dependency Security Hardening ✅
- [x] Upgraded `golang.org/x/crypto` to v0.45.0 (SSH handshake CVE fix)
- [x] Upgraded `github.com/quic-go/quic-go` to v0.57.0 (QUIC vulnerability fix)
- [x] 3 moderate-severity Dependabot alerts resolved
- [x] Full fleet redeployment with MD5 integrity verification

</details>

### Upcoming

#### Connection Tracking UI
- [ ] Frontend module for L4 connection monitoring
- [ ] Configurable connection thresholds with visual alarms
- [ ] Dynamic retention controls for connection history

#### Integrations
- [ ] Kubernetes support
- [ ] Cloud provider metrics (AWS, GCP, Azure)

#### Security & Architecture
- [ ] Extensible agent module loading
- [ ] SSH brute-force detection
- [ ] Automated IP blocking remediation

#### Observability Enhancements
- [ ] Resource speedometer gauges (RAM, Disk, CPU)
- [ ] Webhook URL masking (click-to-reveal)
- [ ] Browser notification system
- [ ] Mobile-native dashboard app

---

## 🙏 Acknowledgments

Built with ❤️ using:
- [ClickHouse](https://clickhouse.com/) - Fast columnar database
- [InfluxDB](https://www.influxdata.com/) - Time-series database
- [React](https://react.dev/) - UI library
- [Gin](https://gin-gonic.com/) - Go web framework
