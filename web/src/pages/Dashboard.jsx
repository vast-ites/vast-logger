import React from 'react';
import { Cpu, HardDrive, Zap, Network } from 'lucide-react';
import { OverviewCard } from '../components/widgets/OverviewCard';



import { useHost } from '../contexts/HostContext';

const Dashboard = () => {
    const { selectedHost, refreshInterval } = useHost();
    // const [refreshInterval, setRefreshInterval] = React.useState(2000); // Now global
    const [metrics, setMetrics] = React.useState({
        cpu_percent: 0,
        memory_usage: 0,
        disk_usage: 0,
        net_sent_rate: 0,
        net_recv_rate: 0,
        uptime: 0,
        process_raw: ""
    });

    const [logs, setLogs] = React.useState([]);
    const [containers, setContainers] = React.useState([]);
    const [processes, setProcesses] = React.useState([]);

    React.useEffect(() => {
        const fetchTelemetry = async () => {
            try {
                const token = localStorage.getItem('token');
                const headers = {
                    'Content-Type': 'application/json',
                    ...(token && { 'Authorization': `Bearer ${token}` })
                };

                const params = selectedHost ? `?host=${selectedHost}` : '';
                const cacheBuster = `&_t=${Date.now()}`;

                // Fetch Metrics
                const resMetrics = await fetch(`/api/v1/metrics/system${params}${!params ? '?' : ''}${cacheBuster}`, { headers });
                if (resMetrics.status === 401) { window.location.href = '/login'; return; }
                if (resMetrics.ok) setMetrics(await resMetrics.json());

                // Fetch Logs
                const logParams = selectedHost ? `?host=${selectedHost}` : '';
                const resLogsSearch = await fetch(`/api/v1/logs/search${logParams}${!logParams ? '?' : ''}&limit=50${cacheBuster}`, { headers });
                if (resLogsSearch.ok) {
                    const logData = await resLogsSearch.json();
                    if (Array.isArray(logData)) setLogs(logData);
                }

                // Fetch Containers
                const resContainers = await fetch(`/api/v1/metrics/containers${params}${!params ? '?' : ''}${cacheBuster}`, { headers });
                if (resContainers.ok) {
                    const contData = await resContainers.json();
                    if (Array.isArray(contData)) {
                        setContainers(contData);
                    }
                }

                // Fetch Processes
                const resProc = await fetch(`/api/v1/processes${params}${!params ? '?' : ''}${cacheBuster}`, { headers });
                if (resProc.ok) {
                    const procData = await resProc.json();
                    if (Array.isArray(procData)) setProcesses(procData);
                }

            } catch (err) {
                console.error("Failed to fetch telemetry", err);
            }
        };

        fetchTelemetry();
        const interval = setInterval(fetchTelemetry, refreshInterval);
        return () => clearInterval(interval);
    }, [selectedHost, refreshInterval]);

    // Helper to format bytes
    const formatNetRate = (bytes) => {
        if (!bytes || bytes <= 0) return "0 B/s";
        const k = 1024;
        const sizes = ['B/s', 'KB/s', 'MB/s', 'GB/s', 'TB/s'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));

        // Safety check for index
        if (i < 0) return "0 B/s";
        if (i >= sizes.length) return parseFloat((bytes / Math.pow(k, sizes.length - 1)).toFixed(1)) + ' ' + sizes[sizes.length - 1];

        return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
    };

    const totalNetFlow = (metrics.net_sent_rate || 0) + (metrics.net_recv_rate || 0);

    // Alert State
    const isDDoS = metrics.ddos_status === 'CRITICAL';

    return (
        <div className="space-y-6">

            {/* DDoS Alert Banner */}
            {isDDoS && (
                <div className="bg-red-900/40 border-2 border-red-500 rounded-lg p-6 mb-8 relative overflow-hidden animate-pulse shadow-[0_0_50px_rgba(239,68,68,0.5)]">
                    <div className="flex items-center gap-4">
                        <div className="bg-red-500 p-3 rounded-full animate-bounce">
                            <Zap size={32} className="text-white" />
                        </div>
                        <div>
                            <h2 className="text-2xl font-bold text-red-500 font-display tracking-widest">SECURITY ALERT: HIGH NETWORK LOAD</h2>
                            <p className="text-red-300 font-mono text-lg">DDoS Traffic Detected: {formatNetRate((metrics.net_recv_rate || 0) * 1024 * 1024)}</p>
                        </div>
                    </div>
                </div>
            )}



            {/* Setup Guide */}
            <div className={`border rounded-lg p-6 mb-8 relative overflow-hidden ${isDDoS ? 'border-red-500/20 bg-red-900/10' : 'border-cyber-cyan/20 bg-cyber-cyan/5'}`}>
                <div className={`absolute -right-10 -top-10 transform rotate-12 ${isDDoS ? 'text-red-500/10' : 'text-cyber-cyan/10'}`}>
                    <Zap size={200} />
                </div>
                <h2 className="text-xl font-bold text-cyber-text mb-2 font-display">
                    {isDDoS ? 'SYSTEM UNDER ATTACK' : 'Zero-Config Agent Active'}
                </h2>
                <p className="text-cyber-muted mb-4 max-w-2xl">
                    {isDDoS ? 'Traffic thresholds exceeded. Automatic mitigation protocols recommended.' : 'Receiving deep telemetry from host. Universal log discovery engaged.'}
                </p>
                <div className={`p-3 rounded font-mono text-sm border inline-block bg-cyber-black/50 ${isDDoS ? 'text-red-500 border-red-500 font-bold' : 'text-cyber-cyan border-cyber-gray'}`}>
                    Status: {isDDoS ? 'CRITICAL WARN' : 'ONLINE'}
                </div>
            </div>

            {/* Metrics Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                <OverviewCard
                    label="SYSTEM UPTIME"
                    value={metrics.uptime ? `${(metrics.uptime / 3600 / 24).toFixed(1)}d` : "..."}
                    subValue={metrics.hostname || "local"}
                    icon={Cpu}
                    color="cyan"
                />
                <OverviewCard
                    label="AVG CPU LOAD"
                    value={`${(metrics.cpu_percent || 0).toFixed(1)}%`}
                    subValue={`${metrics.cpu_count || 0} Cores`}
                    icon={Cpu}
                    color="green"
                />
                <OverviewCard
                    label="MEMORY USAGE"
                    value={`${(metrics.memory_usage || 0).toFixed(1)}%`}
                    subValue={`${((metrics.memory_total || 0) / 1024 / 1024 / 1024).toFixed(1)} GB Total`}
                    icon={Zap}
                    color="violet"
                />
                <OverviewCard
                    label="DISK USAGE"
                    value={`${(metrics.disk_usage || 0).toFixed(1)}%`}
                    subValue={`${((metrics.disk_total || 0) / 1024 / 1024 / 1024).toFixed(1)} GB Total`}
                    icon={HardDrive}
                    color="green"
                />
            </div>

            {/* Live Log Stream & Containers */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <div className="glass-panel rounded-xl p-0 overflow-hidden flex flex-col h-96">
                    <div className="p-4 border-b border-cyber-gray/20 flex justify-between items-center bg-cyber-dark/80">
                        <h3 className="font-mono text-sm text-cyber-cyan uppercase">Live Log Stream (Centralized)</h3>
                        <div className="flex gap-2 text-xs">
                            <div className="text-[10px] text-cyber-muted font-mono">LATEST 50</div>
                        </div>
                    </div>
                    <div className="flex-1 bg-cyber-black/40 p-4 font-mono text-xs overflow-auto custom-scrollbar">
                        <div className="space-y-1">
                            {logs.length === 0 && (
                                <div className="text-cyber-muted italic p-4">Waiting for incoming logs...</div>
                            )}
                            {logs.map((log, i) => {
                                let levelColor = "text-cyber-text";
                                if (log.level === "ERROR") levelColor = "text-red-500 font-bold";
                                if (log.level === "WARN") levelColor = "text-cyber-yellow";
                                if (log.level === "DEBUG") levelColor = "text-cyber-muted";

                                return (
                                    <div key={i} className="flex gap-3 text-cyber-muted hover:bg-cyber-gray/20 p-0.5 rounded transistion-colors">
                                        <span className="text-cyber-cyan/60 shrink-0">{new Date(log.timestamp).toLocaleTimeString()}</span>
                                        <span className="text-cyber-magenta shrink-0 w-20 truncate">[{log.host || 'local'}]</span>
                                        <span className={`shrink-0 w-12 text-center text-xs border border-cyber-gray/20 rounded px-1 ${levelColor} bg-cyber-gray/20`}>{log.level || 'INFO'}</span>
                                        <span className="text-cyber-green shrink-0 truncate w-32" title={log.source_path}>{log.source_path.split('/').pop()}</span>
                                        <span className={`${levelColor} truncate`}>{log.message}</span>
                                    </div>
                                );
                            })}
                        </div>
                    </div>
                </div>

                {/* Container Monitor */}
                <div className="glass-panel rounded-xl p-0 overflow-hidden flex flex-col h-96">
                    <div className="p-4 border-b border-cyber-gray/20 flex justify-between items-center bg-cyber-dark/80">
                        <h3 className="font-mono text-sm text-cyber-cyan uppercase">Active Containers</h3>
                        <span className="text-xs font-mono text-cyber-green animate-pulse">{containers.length} RUNNING</span>
                    </div>
                    <div className="flex-1 bg-cyber-black/40 overflow-auto custom-scrollbar">
                        <table className="w-full text-left font-mono text-xs">
                            <thead>
                                <tr className="border-b border-cyber-gray/50 text-cyber-magenta bg-cyber-black/20 dark:bg-cyber-black/40">
                                    <th className="p-3">NAME</th>
                                    <th className="p-3">STATUS</th>
                                    <th className="p-3">CPU</th>
                                    <th className="p-3">MEM</th>
                                    <th className="p-3">NET I/O</th>
                                </tr>
                            </thead>
                            <tbody>
                                {containers.length === 0 ? (
                                    <tr><td colSpan="5" className="p-4 text-center text-cyber-muted">No active containers found</td></tr>
                                ) : (
                                    containers.map((c, i) => (
                                        <tr key={i} className="border-b border-cyber-gray/20 hover:bg-cyber-gray/10 transition-colors">
                                            <td className="p-3 font-bold text-cyber-text truncate max-w-[150px]" title={c.name}>{c.name}</td>
                                            <td className="p-3">
                                                <span className={`px-2 py-0.5 rounded w-fit ${c.state === 'running' ? 'bg-cyber-green/20 text-cyber-green' : 'bg-red-500/20 text-red-500'}`}>
                                                    {c.state.toUpperCase()}
                                                </span>
                                            </td>
                                            <td className="p-3 text-cyber-cyan">{c.cpu.toFixed(1)}%</td>
                                            <td className="p-3 text-cyber-magenta">{Math.round(c.mem / 1024 / 1024)} MB</td>
                                            <td className="p-3 text-cyber-yellow">
                                                <div className="flex flex-col text-[10px]">
                                                    <span>↓ {formatNetRate(c.net_rx)}</span>
                                                    <span>↑ {formatNetRate(c.net_tx)}</span>
                                                </div>
                                            </td>
                                        </tr>
                                    ))
                                )}
                            </tbody>
                        </table>
                    </div>
                </div>
            </div>

            {/* Top Processes (Live Terminal) */}
            <div className="glass-panel rounded-xl p-0 overflow-hidden flex flex-col h-96">
                <div className="p-4 border-b border-cyber-gray/20 flex justify-between items-center bg-cyber-dark/80">
                    <h3 className="font-mono text-sm text-cyber-cyan uppercase">Live Terminal (top)</h3>
                    <div className="flex gap-2">
                        <span className="text-[10px] font-mono text-green-400 animate-pulse">● LIVE</span>
                    </div>
                </div>
                <div className="flex-1 bg-cyber-black p-4 overflow-auto custom-scrollbar">
                    <pre className="font-mono text-[10px] text-green-400 whitespace-pre-wrap leading-snug">
                        {metrics.process_raw ? metrics.process_raw
                            .replace(/\\\\n/g, '\n') // Handle double escaped
                            .replace(/\\n/g, '\n')   // Handle single escaped
                            .replace(/\\t/g, '\t')   // Handle tabs
                            : (
                                <span className="text-cyber-muted italic">
                                    No live terminal data received.<br />
                                    1. Ensure Host Agent is updated (v2.2+).<br />
                                    2. Select a specific Host from the Sidebar.
                                </span>
                            )}
                    </pre>
                </div>
            </div>

        </div>
    );
};

export default Dashboard;
