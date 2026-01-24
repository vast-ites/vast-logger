import React, { useState, useEffect } from 'react';
import { Network, ArrowDown, ArrowUp, Shield } from 'lucide-react';
import { StatCard } from '../components/widgets/StatCard';
import { AreaChart, Area, XAxis, YAxis, ResponsiveContainer, Tooltip } from 'recharts';
import { useHost } from '../contexts/HostContext';

export const NetworkPage = () => {
    const { selectedHost } = useHost();
    const [metrics, setMetrics] = useState(null);
    const [history, setHistory] = useState([]);

    useEffect(() => {
        const fetchMetrics = async () => {
            try {
                const params = selectedHost ? `?host=${selectedHost}` : '';
                const res = await fetch(`/api/v1/metrics/system${params}`);
                if (res.ok) {
                    const data = await res.json();
                    setMetrics(data);

                    const time = new Date().toLocaleTimeString();
                    setHistory(prev => [...prev.slice(-60), {
                        time,
                        rx: (data.net_recv_rate || 0) / 1024, // KB/s
                        tx: (data.net_sent_rate || 0) / 1024  // KB/s
                    }]);
                }
            } catch (err) {
                console.error(err);
            }
        };

        fetchMetrics();
        const interval = setInterval(fetchMetrics, 2000); // 2s polling
        return () => clearInterval(interval);
    }, [selectedHost]);

    if (!metrics) return <div className="p-10 text-center text-cyan-400 animate-pulse">Scanning Network Topology...</div>;

    const formatSpeed = (bytesPerSec) => {
        if (!bytesPerSec) return '0 B/s';
        if (bytesPerSec > 1024 * 1024) return `${(bytesPerSec / 1024 / 1024).toFixed(1)} MB/s`;
        if (bytesPerSec > 1024) return `${(bytesPerSec / 1024).toFixed(1)} KB/s`;
        return `${bytesPerSec.toFixed(0)} B/s`;
    };

    return (
        <div className="space-y-6">
            <h1 className="text-2xl font-bold text-white tracking-tight flex items-center gap-2">
                <Network size={24} className="text-cyan-400" /> Network Traffic
            </h1>

            <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
                <StatCard label="Active Interfaces" value={(metrics.interfaces || []).filter(i => i.is_up).length} icon={Network} color="cyan" />
                <StatCard label="Total Download" value={formatSpeed(metrics.net_recv_rate)} icon={ArrowDown} trend="neutral" color="green" />
                <StatCard label="Total Upload" value={formatSpeed(metrics.net_sent_rate)} icon={ArrowUp} trend="neutral" color="amber" />
                <StatCard label="Public Access" value="Secured" icon={Shield} trend="neutral" color="violet" />
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 h-96">
                {/* Main Traffic Chart */}
                <div className="lg:col-span-2 glass-panel p-4 flex flex-col min-h-0">
                    <h3 className="text-gray-300 font-semibold text-sm mb-4">Total Bandwidth History (KB/s)</h3>
                    <div className="flex-1 min-h-0">
                        <ResponsiveContainer width="100%" height="100%">
                            <AreaChart data={history}>
                                <defs>
                                    <linearGradient id="splitRx" x1="0" y1="0" x2="0" y2="1">
                                        <stop offset="5%" stopColor="#22c55e" stopOpacity={0.3} />
                                        <stop offset="95%" stopColor="#22c55e" stopOpacity={0} />
                                    </linearGradient>
                                    <linearGradient id="splitTx" x1="0" y1="0" x2="0" y2="1">
                                        <stop offset="5%" stopColor="#f59e0b" stopOpacity={0.3} />
                                        <stop offset="95%" stopColor="#f59e0b" stopOpacity={0} />
                                    </linearGradient>
                                </defs>
                                <XAxis hide />
                                <YAxis hide />
                                <Tooltip contentStyle={{ backgroundColor: '#0a0b1e', borderColor: '#334155' }} />
                                <Area type="monotone" dataKey="rx" stroke="#22c55e" fill="url(#splitRx)" strokeWidth={2} isAnimationActive={false} name="Download" />
                                <Area type="monotone" dataKey="tx" stroke="#f59e0b" fill="url(#splitTx)" strokeWidth={2} isAnimationActive={false} name="Upload" />
                            </AreaChart>
                        </ResponsiveContainer>
                    </div>
                </div>

                {/* Interface List */}
                <div className="glass-panel p-4 flex flex-col min-h-0">
                    <h3 className="text-gray-300 font-semibold text-sm mb-4">Interface Status</h3>
                    <div className="space-y-3 flex-1 overflow-y-auto min-h-0 scrollbar-thin">
                        {(metrics.interfaces || []).slice(0, 5).map((iface, idx) => (
                            <div key={idx} className="flex items-center justify-between p-2 rounded bg-white/5 border border-white/5">
                                <div className="flex items-center gap-3">
                                    <div className={`w-2 h-2 rounded-full ${iface.is_up ? 'bg-green-500 shadow-[0_0_5px_#22c55e]' : 'bg-red-500'}`}></div>
                                    <div className="overflow-hidden">
                                        <div className="text-xs font-bold text-gray-200 truncate w-20">{iface.name}</div>
                                        <div className="text-[10px] text-gray-500 font-mono truncate w-20">{iface.ip || "No IP"}</div>
                                    </div>
                                </div>
                                <div className="text-right">
                                    <div className="text-[10px] text-green-400">{iface.is_up ? "UP" : "DOWN"}</div>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            </div>

            {/* Detailed Table */}
            <div className="glass-panel overflow-hidden">
                <table className="w-full text-left text-sm text-gray-400">
                    <thead className="bg-white/5 text-gray-300 font-semibold border-b border-white/10">
                        <tr>
                            <th className="p-4 w-32">Interface</th>
                            <th className="p-4 w-24">Type</th>
                            <th className="p-4">IP Address (v4)</th>
                            <th className="p-4">MAC Address</th>
                            <th className="p-4 w-24">Status</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-white/5">
                        {(metrics.interfaces || []).map((iface, idx) => (
                            <tr key={idx} className="hover:bg-white/5 transition-colors">
                                <td className="p-4 font-mono text-cyan-400">{iface.name}</td>
                                <td className="p-4">{iface.name === "lo" ? "virtual" : "physical"}</td>
                                <td className="p-4 font-mono">{iface.ip || "-"}</td>
                                <td className="p-4 font-mono text-gray-500">{iface.mac || "-"}</td>
                                <td className="p-4">
                                    <span className={`px-2 py-0.5 rounded text-[10px] border ${iface.is_up ? 'bg-green-500/20 text-green-400 border-green-500/20' : 'bg-red-500/20 text-red-400 border-red-500/20'}`}>
                                        {iface.is_up ? "UP" : "DOWN"}
                                    </span>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
        </div>
    );
};
