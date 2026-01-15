# DataVast Observability Platform

DataVast is a zero-config, sci-fi themed observability platform for Linux systems. It features a privileged Agent for auto-discovery, a high-performance Go Backend (ClickHouse+InfluxDB), and a React-based Dashboard.

## 🚀 Quick Start Guide

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

## Features
- **Auto-Discovery**: Automatically finds and matches logs (syslog, auth.log, etc.).
- **Real-Time Metrics**: CPU, RAM, Disk, and Network flow (1s resolution).
- **Container Monitoring**: Auto-detects Docker containers.
- **Log Search**: Full-text regex search over logs.
- **Security**: DDoS detection and alert system.
