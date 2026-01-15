import React, { useState, useEffect } from 'react';
import { Globe, Activity, ArrowUp, ArrowDown, Zap } from 'lucide-react';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';

const Network = () => {
    const [history, setHistory] = useState([]);
    const [loading, setLoading] = useState(true);

    const fetchHistory = async () => {
        try {
            // Fetch last 15 minutes
            const res = await fetch('http://localhost:8080/api/v1/metrics/history?duration=15m');
            if (res.ok) {
                const data = await res.json();
                // Map data for recharts
                const chartData = data.map((d, i) => ({
                    time: i, // Simple index for now, or format timestamp
                    rx: d.net_recv_rate, // already in MB/s
                    cpu: d.cpu
                }));
                setHistory(chartData);
            }
        } catch (err) {
            console.error("Failed to fetch history", err);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchHistory();
        const interval = setInterval(fetchHistory, 5000); // Poll every 5s
        return () => clearInterval(interval);
    }, []);

    const CustomTooltip = ({ active, payload, label }) => {
        if (active && payload && payload.length) {
            return (
                <div className="bg-cyber-black border border-cyber-cyan p-2 rounded shadow-[0_0_10px_rgba(0,243,255,0.3)]">
                    <p className="text-cyber-cyan text-xs font-mono">{`Rx: ${payload[0].value.toFixed(2)} MB/s`}</p>
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
                    Network Analysis
                </h1>
                <div className="flex gap-4 text-xs font-mono">
                    <div className="flex items-center gap-2">
                        <div className="w-3 h-3 bg-cyber-yellow/50 rounded-full" />
                        <span className="text-gray-400">INBOUND TRAFFIC</span>
                    </div>
                </div>
            </div>

            {/* Main Graph */}
            <div className="glass-panel p-6 rounded-xl border border-cyber-gray h-[400px]">
                <h3 className="text-lg font-bold text-cyber-yellow mb-4 flex items-center gap-2">
                    <Activity size={18} /> Bandwidth Usage (Last 15m)
                </h3>
                <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={history}>
                        <defs>
                            <linearGradient id="colorRx" x1="0" y1="0" x2="0" y2="1">
                                <stop offset="5%" stopColor="#f3ff00" stopOpacity={0.8} />
                                <stop offset="95%" stopColor="#f3ff00" stopOpacity={0} />
                            </linearGradient>
                        </defs>
                        <CartesianGrid strokeDasharray="3 3" stroke="#333" />
                        <XAxis dataKey="time" hide />
                        <YAxis stroke="#666" fontSize={10} tickFormatter={(val) => `${val} MB/s`} />
                        <Tooltip content={<CustomTooltip />} />
                        <Area type="monotone" dataKey="rx" stroke="#f3ff00" fillOpacity={1} fill="url(#colorRx)" />
                    </AreaChart>
                </ResponsiveContainer>
            </div>

            {/* Stats Cards */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div className="glass-panel p-6 rounded-xl border border-cyber-gray flex items-center justify-between">
                    <div>
                        <p className="text-gray-500 text-xs font-mono mb-1">CURRENT INBOUND</p>
                        <p className="text-2xl font-bold text-cyber-yellow font-mono">
                            {history.length > 0 ? history[history.length - 1].rx.toFixed(1) : 0} <span className="text-sm">MB/s</span>
                        </p>
                    </div>
                    <ArrowDown className="text-cyber-yellow opacity-50" size={32} />
                </div>

                <div className="glass-panel p-6 rounded-xl border border-cyber-gray flex items-center justify-between">
                    <div>
                        <p className="text-gray-500 text-xs font-mono mb-1">TOTAL DATA (SESSION)</p>
                        <p className="text-2xl font-bold text-cyber-cyan font-mono">
                            -- <span className="text-sm">GB</span>
                        </p>
                    </div>
                    <Activity className="text-cyber-cyan opacity-50" size={32} />
                </div>

                <div className="glass-panel p-6 rounded-xl border border-cyber-gray flex items-center justify-between">
                    <div>
                        <p className="text-gray-500 text-xs font-mono mb-1">ACTIVE CONNECTIONS</p>
                        <p className="text-2xl font-bold text-white font-mono">
                            --
                        </p>
                    </div>
                    <Globe className="text-white opacity-50" size={32} />
                </div>
            </div>
        </div>
    );
};

export default Network;
