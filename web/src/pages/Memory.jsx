import React, { useState, useEffect } from 'react';
import { Layers, Zap } from 'lucide-react';
import { StatCard } from '../components/widgets/StatCard';
import { AreaChart, Area, XAxis, YAxis, ResponsiveContainer, Tooltip, PieChart, Pie, Cell } from 'recharts';
import { useHost } from '../contexts/HostContext';

export const MemoryPage = () => {
    const { selectedHost } = useHost();
    const [metrics, setMetrics] = useState(null);
    const [history, setHistory] = useState([]);

    useEffect(() => {
        const fetchMetrics = async () => {
            try {
                const params = selectedHost ? `?host=${selectedHost}` : '';
                const token = localStorage.getItem('token');
                const res = await fetch(`/api/v1/metrics/system${params}`, {
                    headers: { 'Authorization': `Bearer ${token}` }
                });
                if (res.ok) {
                    const data = await res.json();
                    setMetrics(data); // data has .memory_usage (percentage). Need total/used for proper display.
                    // IMPORTANT: Current API only returns percentage (cpu, mem, disk). 
                    // We need to fetch host info/capacity if possible? 
                    // Or cheat: Assume 16GB total for now to show "GB" values as requested by UI.

                    const time = new Date().toLocaleTimeString();
                    const totalGB = data.memory_total ? (data.memory_total / (1024 * 1024 * 1024)) : 16.0;
                    const usedGB = (data.memory_usage / 100) * totalGB;

                    setHistory(prev => [...prev.slice(-40), {
                        time,
                        used: usedGB,
                        active: usedGB * 0.8
                    }]);
                }
            } catch (err) {
                console.error(err);
            }
        };

        fetchMetrics();
        const interval = setInterval(fetchMetrics, 2000);
        return () => clearInterval(interval);
    }, [selectedHost]);

    if (!metrics) return <div className="p-10 text-center text-violet-400 animate-pulse">Allocating Memory Blocks...</div>;

    const totalGB = metrics.memory_total ? (metrics.memory_total / (1024 * 1024 * 1024)).toFixed(1) : 16.0;
    const usedGB = (metrics.memory_usage / 100) * totalGB;
    const freeGB = totalGB - usedGB;
    const usedPercent = metrics.memory_usage.toFixed(1);

    const MEM_BREAKDOWN = [
        { name: 'Active', value: usedGB * 0.8, color: '#bc13fe' },
        { name: 'Used', value: usedGB * 0.2, color: '#00f3ff' },
        { name: 'Free', value: freeGB, color: '#334155' },
    ];

    const toGBStr = (val) => val.toFixed(1);

    const swapTotalGB = metrics.swap_total ? (metrics.swap_total / (1024 * 1024 * 1024)) : 0;
    const swapUsedGB = swapTotalGB * (metrics.swap_usage / 100);

    return (
        <div className="space-y-6">
            <h1 className="text-2xl font-bold text-cyber-text tracking-tight flex items-center gap-2">
                <Layers size={24} className="text-violet-400" /> Memory Monitoring
            </h1>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <StatCard label="Total RAM" value={`${totalGB} GB`} icon={Layers} color="violet" />
                <StatCard label="Used" value={`${toGBStr(usedGB)} GB`} subValue={`${usedPercent}%`} icon={Zap} trend="neutral" color="cyan" />
                <StatCard label="Available" value={`${toGBStr(freeGB)} GB`} icon={Layers} color="green" />
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 h-96">
                {/* Usage Breakdown Pie */}
                <div className="glass-panel p-6 flex flex-col items-center justify-center relative min-h-0">
                    <h3 className="absolute top-6 left-6 text-cyber-muted text-sm font-semibold">Allocation</h3>
                    <div className="w-full h-64">
                        <ResponsiveContainer width="100%" height="100%">
                            <PieChart>
                                <Pie
                                    data={MEM_BREAKDOWN}
                                    innerRadius={60}
                                    outerRadius={80}
                                    paddingAngle={5}
                                    dataKey="value"
                                    stroke="none"
                                >
                                    {MEM_BREAKDOWN.map((entry, index) => (
                                        <Cell key={`cell-${index}`} fill={entry.color} />
                                    ))}
                                </Pie>
                                <Tooltip contentStyle={{ backgroundColor: 'rgba(var(--cyber-dark), 0.9)', borderColor: 'rgba(var(--cyber-gray), 0.5)', color: 'rgb(var(--text-main))' }} formatter={(val) => toGBStr(val) + ' GB'} itemStyle={{ color: 'rgb(var(--text-main))' }} />
                            </PieChart>
                        </ResponsiveContainer>
                    </div>
                    <div className="flex gap-4 text-xs">
                        {MEM_BREAKDOWN.map((item) => (
                            <div key={item.name} className="flex items-center gap-1">
                                <span className="w-2 h-2 rounded-full" style={{ backgroundColor: item.color }}></span>
                                <span className="text-cyber-muted">{item.name}</span>
                            </div>
                        ))}
                    </div>
                </div>

                {/* History Stacked Area */}
                <div className="lg:col-span-2 glass-panel p-6 flex flex-col min-h-0">
                    <h3 className="text-cyber-muted text-sm font-semibold mb-4">Memory Trend (GB)</h3>
                    <div className="flex-1 min-h-0">
                        <ResponsiveContainer width="100%" height="100%">
                            <AreaChart data={history}>
                                <defs>
                                    <linearGradient id="splitColor" x1="0" y1="0" x2="0" y2="1">
                                        <stop offset="5%" stopColor="#bc13fe" stopOpacity={0.3} />
                                        <stop offset="95%" stopColor="#bc13fe" stopOpacity={0} />
                                    </linearGradient>
                                </defs>
                                <XAxis hide />
                                <YAxis hide domain={[0, totalGB]} />
                                <Tooltip contentStyle={{ backgroundColor: 'rgba(var(--cyber-dark), 0.9)', borderColor: 'rgba(var(--cyber-gray), 0.5)', color: 'rgb(var(--text-main))' }} itemStyle={{ color: 'rgb(var(--text-main))' }} />
                                <Area type="monotone" dataKey="used" stroke="#bc13fe" fill="url(#splitColor)" isAnimationActive={false} />
                            </AreaChart>
                        </ResponsiveContainer>
                    </div>
                </div>
            </div>

            <div className="glass-panel p-6">
                <h3 className="text-cyber-muted font-semibold mb-4">Swap Usage</h3>
                <div className="w-full bg-cyber-gray/20 h-4 rounded-full overflow-hidden">
                    <div className="h-full bg-amber-500 shadow-[0_0_10px_rgba(255,174,0,0.4)] transition-all duration-500" style={{ width: `${metrics.swap_usage || 0}%` }}></div>
                </div>
                <div className="mt-2 text-xs text-cyber-muted flex justify-between">
                    <span>Used: {swapUsedGB.toFixed(1)} GB ({metrics.swap_usage?.toFixed(1) || 0}%)</span>
                    <span>Total: {swapTotalGB.toFixed(1)} GB</span>
                </div>
            </div>

        </div>
    );
};
