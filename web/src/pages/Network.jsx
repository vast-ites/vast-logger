import React, { useState, useEffect } from 'react';
import { Globe, Activity, ArrowUp, ArrowDown, Zap } from 'lucide-react';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';

const Network = () => {
    const [history, setHistory] = useState([]);
    const [interfaces, setInterfaces] = useState([]);
    const [loading, setLoading] = useState(true);

    const fetchHistory = async () => {
        try {
            const res = await fetch('http://localhost:8080/api/v1/metrics/interfaces/history?duration=15m');
            if (res.ok) {
                const rawData = await res.json();

                // 1. Group by Timestamp
                const grouped = {};
                const ifaceSet = new Set();

                rawData.forEach(d => {
                    const timeKey = new Date(d.time).toLocaleTimeString();
                    if (!grouped[timeKey]) grouped[timeKey] = { time: timeKey };

                    // Add Interface Data (MB/s)
                    const rxMB = (d.bytes_recv / (1024 * 1024));
                    grouped[timeKey][`${d.interface}`] = rxMB;
                    ifaceSet.add(d.interface);
                });

                // 2. Convert to Array
                const chartData = Object.values(grouped);
                setHistory(chartData);
                setInterfaces(Array.from(ifaceSet));
            }
        } catch (err) {
            console.error("Failed to fetch history", err);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchHistory();
        const interval = setInterval(fetchHistory, 5000);
        return () => clearInterval(interval);
    }, []);

    const colors = ["#00f3ff", "#f3ff00", "#ff0099", "#00ff66", "#ffffff"];

    const CustomTooltip = ({ active, payload, label }) => {
        if (active && payload && payload.length) {
            return (
                <div className="bg-cyber-black border border-cyber-cyan p-2 rounded shadow-[0_0_10px_rgba(0,243,255,0.3)]">
                    <p className="text-gray-400 text-xs mb-1">{label}</p>
                    {payload.map((p, i) => (
                        <p key={i} style={{ color: p.color }} className="text-xs font-mono">
                            {`${p.name}: ${p.value.toFixed(2)} MB/s`}
                        </p>
                    ))}
                </div>
            );
        }
        return null;
    };

    return (
        <div className="space-y-6">
            <div className="flex justify-between items-center">
                <h1 className="text-2xl font-bold font-display text-white flex items-center gap-3">
                    <Globe className="text-cyber-yellow" />
                    Network Breakdown
                </h1>
                <div className="flex gap-4 text-xs font-mono">
                    {interfaces.map((iface, i) => (
                        <div key={iface} className="flex items-center gap-2">
                            <div className="w-3 h-3 rounded-full" style={{ backgroundColor: colors[i % colors.length] }} />
                            <span className="text-gray-400 uppercase">{iface}</span>
                        </div>
                    ))}
                </div>
            </div>

            {/* Main Graph */}
            <div className="glass-panel p-6 rounded-xl border border-cyber-gray h-[400px]">
                <h3 className="text-lg font-bold text-cyber-yellow mb-4 flex items-center gap-2">
                    <Activity size={18} /> Interface Traffic (Rx)
                </h3>
                <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={history}>
                        <defs>
                            {interfaces.map((iface, i) => (
                                <linearGradient key={iface} id={`color-${iface}`} x1="0" y1="0" x2="0" y2="1">
                                    <stop offset="5%" stopColor={colors[i % colors.length]} stopOpacity={0.8} />
                                    <stop offset="95%" stopColor={colors[i % colors.length]} stopOpacity={0} />
                                </linearGradient>
                            ))}
                        </defs>
                        <CartesianGrid strokeDasharray="3 3" stroke="#333" />
                        <XAxis dataKey="time" hide />
                        <YAxis stroke="#666" fontSize={10} tickFormatter={(val) => `${val.toFixed(1)} MB/s`} />
                        <Tooltip content={<CustomTooltip />} />

                        {interfaces.map((iface, i) => (
                            <Area
                                key={iface}
                                type="monotone"
                                dataKey={iface}
                                stroke={colors[i % colors.length]}
                                fillOpacity={1}
                                fill={`url(#color-${iface})`}
                                stackId="1" // Stacked area chart? Or separate? Stacked shows total better.
                            />
                        ))}
                    </AreaChart>
                </ResponsiveContainer>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="glass-panel p-6 rounded-xl border border-cyber-gray">
                    <h3 className="text-lg font-bold text-white mb-4">Live Throughput</h3>
                    <div className="space-y-4">
                        {interfaces.map((iface, i) => {
                            const latest = history.length > 0 ? history[history.length - 1][iface] || 0 : 0;
                            return (
                                <div key={iface} className="flex items-center justify-between p-3 bg-black/40 rounded border border-gray-800">
                                    <span className="text-cyber-cyan font-mono">{iface}</span>
                                    <span className="text-white font-mono text-xl">{latest.toFixed(2)} <span className="text-xs text-gray-500">MB/s</span></span>
                                </div>
                            )
                        })}
                    </div>
                </div>
            </div>
        </div>
    );
};

export default Network;
