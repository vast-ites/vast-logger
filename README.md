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

### 2. Start Backend Server
Runs on port `8080`. Connects to databases.
```bash
cd server
go mod tidy
go build -o datavast-server
./datavast-server
```

### 3. Start Agent
Runs as `root` to discover logs and metrics. Sends data to Server.
```bash
cd agent
go mod tidy
go build -o datavast-agent
sudo ./datavast-agent
```

### 4. Start Frontend Dashboard
Runs on port `5173`.
```bash
cd web
npm install
npm run dev
```

### 5. Access the Platform
Open your browser and navigate to:
**http://localhost:5173**

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
- **Default Credentials**: `admin` / `admin`
- **Enforcement**: Public API endpoints require a valid JWT token.
- **Bypass**: Set `AUTH_ENABLED=false` environment variable (NOT recommended for production).
- **Frontend**: Automatically handles token storage and injection in `HostContext`.

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

### Phase 41: Integrations
- [ ] Kubernetes support
- [ ] Cloud provider metrics (AWS, GCP, Azure)
- [ ] Slack/Teams notifications

### Phase 42: Performance
- [x] Log compression
- [x] Metric aggregation
- [x] Query optimization

### Phase 43: Security & Core Architecture

**1. Feature: IP Intelligence (Source Filter + GeoIP)**
*Goal: Dedicated page for IP search, analysis, and management with full source-scoping.*

*   **Source Filter Behavior:**
    *   Strict adherence to selected Source (Server/Agent).
    *   Data aggregation respects source selection.
    *   No cross-server data leakage unless "All Sources" is active.

*   **IP Search & GeoIP:**
    *   Search displays: Total occurrences, First/Last seen, Services, Block status.
    *   **Automatic Geo Lookup** (MaxMind DB): Country, State, City.
    *   Composite view when "All Sources" is selected.

*   **Activity Aggregation:**
    *   Breakdown by service (Apache, Nginx, SSH, DB).
    *   Request counts and last activity timestamps.

*   **Source-Aware Blocking:**
    *   Block/Unblock actions apply ONLY to the selected source.
    *   Visual indicators for Blocked/Active status.
    *   Safety: Blocking disabled or requires specific source when "All Sources" is active.

*   **Backend & Optimization:**
    *   **GeoIP Integration**: Local MaxMind DB with caching layer (`ip_geo_cache` table) to minimize lookups.
    *   **Data Model**: `ip_activity` (tracking counts/services) and `blocked_ips` (source-specific blocking).
    *   **Performance**: Composite index on `(agent_id, ip_address)`.

**2. Architecture: Extensible Agent Design**
*   **Goal**: Modularize agent functionality.
*   New capabilities (e.g., log parsers) must be added as separate files/modules.
*   Dynamic loading of modules to prevent core logic modification.

**3. Integration: 1Password Watchtower**
*   **Goal**: Fetch and display security insights.
*   UI to show: Security alerts, compromised items, weak passwords, actionable recommendations.

### Phase 44: Enhanced Observability & UI

**1. Resource Speedometer**
*   Visual gauges for RAM, Disk, CPU.
*   Configurable thresholds with color states (Green/Red).

**2. Webhook Security**
*   Hide Webhook URLs by default.
*   "Show URL" click-to-reveal interaction.

**3. Search UI Update**
*   Remove `Cmd+K` icon.
*   Move keyboard shortcuts to Help (?) section.

**4. Data Retention & Log Management**
*   User-defined data retention periods.
*   Auto-archival of logs older than retention period.
*   UI for manual retrieval of archived logs.

**5. Connection Monitoring (`/connections`)**
*   Configurable connection thresholds (default: 50).
*   Visual alarms (color change) when thresholds exceeded.
*   Sorting options (highest connections first).

**6. Notification System**
*   Browser notification popups.
*   In-app notification center and controls.

---

## 🙏 Acknowledgments

Built with ❤️ using:
- [ClickHouse](https://clickhouse.com/) - Fast columnar database
- [InfluxDB](https://www.influxdata.com/) - Time-series database
- [React](https://react.dev/) - UI library
- [Gin](https://gin-gonic.com/) - Go web framework
