import React, { useState, useEffect } from 'react';
import { useHost } from '../contexts/HostContext';
import { Network, Activity, Search, Server, ArrowRight, X, Clock, Shield } from 'lucide-react';

const Connections = () => {
    const { selectedHost } = useHost();
    const [summary, setSummary] = useState([]);
    const [loading, setLoading] = useState(true);
    const [selectedPort, setSelectedPort] = useState(null);
    const [details, setDetails] = useState([]);
    const [detailsLoading, setDetailsLoading] = useState(false);
    const [refreshInterval, setRefreshInterval] = useState(1000); // 1 sec default

    // Fetch Summary (Cards)
    const fetchSummary = async () => {
        if (!selectedHost) return;
        try {
            const token = localStorage.getItem('token');
            const headers = { Authorization: `Bearer ${token}` };
            const res = await fetch(`/api/v1/connections/summary?host=${selectedHost}`, { headers });
            if (res.ok) {
                const data = await res.json();
                setSummary(data || []);
            }
        } catch (err) {
            console.error("Failed to fetch connection summary", err);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        setLoading(true);
        fetchSummary();
        const interval = setInterval(fetchSummary, refreshInterval);
        return () => clearInterval(interval);
    }, [selectedHost, refreshInterval]);

    // Fetch Details (Modal)
    useEffect(() => {
        if (selectedPort) {
            const fetchDetails = async () => {
                setDetailsLoading(true);
                try {
                    const token = localStorage.getItem('token');
                    const headers = { Authorization: `Bearer ${token}` };
                    const res = await fetch(`/api/v1/connections/details?host=${selectedHost}&port=${selectedPort}`, { headers });
                    if (res.ok) {
                        const data = await res.json();
                        setDetails(data || []);
                    }
                } catch (err) {
                    console.error("Failed to fetch details", err);
                } finally {
                    setDetailsLoading(false);
                }
            };
            fetchDetails();
            // Polling for details if modal is open
            const interval = setInterval(fetchDetails, refreshInterval);
            return () => clearInterval(interval);
        }
    }, [selectedPort, selectedHost, refreshInterval]);

    const getStatusColor = (status) => {
        switch (status) {
            case 'ESTABLISHED': return 'text-green-400';
            case 'TIME_WAIT': return 'text-yellow-400';
            case 'CLOSE_WAIT': return 'text-orange-400';
            case 'SYN_SENT': return 'text-blue-400';
            default: return 'text-gray-400';
        }
    };

    return (
        <div className="space-y-6">
            <div className="flex justify-between items-center">
                <div>
                    <h1 className="text-2xl font-bold font-display text-cyber-text flex items-center gap-3">
                        <Network className="text-cyan-400" />
                        Connection Tracking
                    </h1>
                    <p className="text-cyber-muted text-sm mt-1">
                        Live monitoring of active ports and network connections on <span className="text-cyan-400 font-mono">{selectedHost || 'Select a Host'}</span>
                    </p>
                </div>
                <div className="flex items-center gap-2">
                    <span className="text-xs text-cyber-muted font-mono">UPDATE RATE:</span>
                    <select
                        value={refreshInterval}
                        onChange={(e) => setRefreshInterval(Number(e.target.value))}
                        className="bg-cyber-gray/10 border border-cyber-gray/20 rounded px-2 py-1 text-xs text-cyan-400 focus:outline-none"
                    >
                        <option value={1000}>1s (Realtime)</option>
                        <option value={5000}>5s</option>
                        <option value={10000}>10s</option>
                    </select>
                </div>
            </div>

            {loading && summary.length === 0 ? (
                <div className="p-12 text-center text-cyber-muted animate-pulse font-mono">SCANNING NETWORK INTERFACES...</div>
            ) : summary.length === 0 ? (
                <div className="glass-panel p-8 text-center text-cyber-muted">
                    <Shield size={48} className="mx-auto mb-4 opacity-20" />
                    <p>No active connections detected or agent not reporting.</p>
                </div>
            ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                    {summary.map((item) => (
                        <div
                            key={item.local_port}
                            onClick={() => setSelectedPort(item.local_port)}
                            className="glass-panel p-4 rounded-xl border border-cyber-gray/20 hover:border-cyan-500/50 hover:bg-cyber-gray/20 transition-all cursor-pointer group relative overflow-hidden"
                        >
                            <div className="absolute top-0 right-0 p-2 opacity-10 group-hover:opacity-20 transition-opacity">
                                <Activity size={64} />
                            </div>

                            <div className="flex justify-between items-start mb-4 relative z-10">
                                <div className="p-2 rounded bg-cyan-900/20 text-cyan-400 font-mono text-xl font-bold">
                                    :{item.local_port}
                                </div>
                                <div className="text-xs font-mono bg-cyber-gray/30 px-2 py-1 rounded text-cyber-text">
                                    {item.process_name || 'unknown'}
                                </div>
                            </div>

                            <div className="relative z-10">
                                <div className="text-4xl font-bold text-cyber-text mb-1 group-hover:text-cyan-400 transition-colors">
                                    {item.count}
                                </div>
                                <div className="text-xs text-cyber-muted font-mono tracking-wider">ACTIVE CONNECTIONS</div>
                            </div>

                            <div className="mt-4 flex items-center gap-2 text-xs text-cyan-500/80 opacity-0 group-hover:opacity-100 transition-opacity">
                                View Details <ArrowRight size={12} />
                            </div>
                        </div>
                    ))}
                </div>
            )}

            {/* Detail Modal */}
            {selectedPort && (
                <div className="fixed inset-0 bg-cyber-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
                    <div className="glass-panel w-full max-w-4xl max-h-[80vh] flex flex-col rounded-xl border border-cyber-cyan/30 shadow-[0_0_50px_rgba(var(--cyber-cyan),0.1)]">
                        <div className="flex justify-between items-center p-4 border-b border-cyber-gray/20">
                            <h2 className="text-xl font-bold font-display text-cyber-text flex items-center gap-3">
                                <Activity className="text-cyber-cyan" />
                                Port {selectedPort} Details
                            </h2>
                            <button
                                onClick={() => setSelectedPort(null)}
                                className="p-2 hover:bg-red-500/20 hover:text-red-400 rounded-full transition-colors"
                            >
                                <X size={20} />
                            </button>
                        </div>

                        <div className="flex-1 overflow-auto custom-scrollbar p-0">
                            <table className="w-full text-left text-sm">
                                <thead className="bg-cyber-gray/20 text-cyber-muted font-mono text-xs uppercase sticky top-0 backdrop-blur-md">
                                    <tr>
                                        <th className="p-4">Remote Address</th>
                                        <th className="p-4">State</th>
                                        <th className="p-4">Process</th>
                                        <th className="p-4">Last Seen</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-cyber-gray/10">
                                    {detailsLoading && details.length === 0 ? (
                                        <tr>
                                            <td colSpan="4" className="p-8 text-center text-cyber-cyan font-mono animate-pulse">
                                                Loading Connections...
                                            </td>
                                        </tr>
                                    ) : details.map((conn, idx) => (
                                        <tr key={idx} className="hover:bg-cyber-gray/10 transition-colors font-mono text-xs">
                                            <td className="p-4 text-cyber-text">
                                                {conn.remote_ip}:{conn.remote_port}
                                            </td>
                                            <td className={`p-4 font-bold ${getStatusColor(conn.status)}`}>
                                                {conn.status}
                                            </td>
                                            <td className="p-4 text-cyber-muted">
                                                {conn.process_name} <span className="opacity-50">({conn.pid})</span>
                                            </td>
                                            <td className="p-4 text-cyber-muted">
                                                {new Date(conn.timestamp).toLocaleTimeString()}
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>

                        <div className="p-3 border-t border-cyber-gray/20 text-xs text-cyber-muted font-mono flex justify-between">
                            <span>Total Active: {details.length}</span>
                            <span className="flex items-center gap-1"><Clock size={12} /> Auto-refreshing (1s)</span>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default Connections;
