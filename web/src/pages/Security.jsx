import React, { useState, useEffect } from 'react';
import { Shield, AlertTriangle, Lock, Unlock, Wifi, Zap } from 'lucide-react';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, ReferenceLine } from 'recharts';

const Security = () => {
    const [history, setHistory] = useState([]);
    const [currentStatus, setCurrentStatus] = useState('SAFE');
    const [loading, setLoading] = useState(true);

    const fetchHistory = async () => {
        try {
            const res = await fetch('http://localhost:8080/api/v1/metrics/history?duration=30m');
            if (res.ok) {
                const data = await res.json();
                // Map data
                const chartData = data.map((d, i) => ({
                    time: i,
                    rx: d.net_recv_rate,
                    status: d.ddos_status
                }));
                setHistory(chartData);

                // Determine current status from latest data point
                if (chartData.length > 0) {
                    const last = chartData[chartData.length - 1];
                    // Fallback logic if string was lost in aggregate
                    if (last.rx > 50) setCurrentStatus('CRITICAL');
                    else if (last.rx > 10) setCurrentStatus('WARNING');
                    else setCurrentStatus('SAFE');
                }
            }
        } catch (err) {
            console.error("Failed to fetch security history", err);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchHistory();
        const interval = setInterval(fetchHistory, 2000);
        return () => clearInterval(interval);
    }, []);

    const isCritical = currentStatus === 'CRITICAL';
    const color = isCritical ? '#ef4444' : (currentStatus === 'WARNING' ? '#f3ff00' : '#0aff0a');

    return (
        <div className="space-y-6">
            <div className="flex justify-between items-center">
                <h1 className="text-2xl font-bold font-display text-white flex items-center gap-3">
                    <Shield className={isCritical ? "text-red-500 animate-pulse" : "text-cyber-green"} />
                    Security Operations Center
                </h1>
                <div className={`px-4 py-1 rounded border font-mono text-sm font-bold flex items-center gap-2 ${isCritical ? 'bg-red-500/20 text-red-500 border-red-500 animate-pulse' :
                        (currentStatus === 'WARNING' ? 'bg-yellow-500/20 text-yellow-500 border-yellow-500' : 'bg-green-500/20 text-green-500 border-green-500')
                    }`}>
                    {isCritical ? <Unlock size={14} /> : <Lock size={14} />}
                    STATUS: {currentStatus}
                </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                {/* Main Status Panel */}
                <div className={`col-span-1 glass-panel p-8 rounded-xl border relative overflow-hidden flex flex-col items-center justify-center text-center ${isCritical ? 'border-red-500 shadow-[0_0_30px_rgba(239,68,68,0.3)]' : 'border-cyber-gray'
                    }`}>
                    <div className={`w-32 h-32 rounded-full border-4 flex items-center justify-center mb-6 ${isCritical ? 'border-red-500 bg-red-500/10 animate-ping' : 'border-cyber-green bg-cyber-green/10'
                        }`}>
                        <Shield size={64} className={isCritical ? 'text-red-500' : 'text-cyber-green'} />
                    </div>
                    <h2 className="text-3xl font-bold text-white mb-2 font-display">THREAT LEVEL</h2>
                    <p className={`text-xl font-mono ${isCritical ? 'text-red-500' : 'text-cyber-green'}`}>
                        {currentStatus === 'SAFE' ? 'NORMAL' : (isCritical ? 'EXTREME' : 'ELEVATED')}
                    </p>
                    {isCritical && <p className="text-red-400 mt-4 animate-bounce">DDoS MITIGATION PROTOCOLS RECOMMENDED</p>}
                </div>

                {/* Traffic Graph */}
                <div className="col-span-2 glass-panel p-6 rounded-xl border border-cyber-gray flex flex-col">
                    <h3 className="text-lg font-bold text-gray-300 mb-4 flex items-center gap-2">
                        <Zap size={18} className="text-cyber-yellow" /> Network Intensity (Attack Signature)
                    </h3>
                    <div className="flex-1 min-h-[300px]">
                        <ResponsiveContainer width="100%" height="100%">
                            <AreaChart data={history}>
                                <defs>
                                    <linearGradient id="colorSecurity" x1="0" y1="0" x2="0" y2="1">
                                        <stop offset="5%" stopColor={color} stopOpacity={0.8} />
                                        <stop offset="95%" stopColor={color} stopOpacity={0} />
                                    </linearGradient>
                                </defs>
                                <CartesianGrid strokeDasharray="3 3" stroke="#333" />
                                <XAxis dataKey="time" hide />
                                <YAxis stroke="#666" fontSize={10} domain={[0, 'auto']} />
                                <Tooltip
                                    contentStyle={{ backgroundColor: '#000', borderColor: color }}
                                    itemStyle={{ color: color }}
                                    formatter={(value) => [`${value.toFixed(2)} MB/s`, 'Traffic']}
                                />
                                <ReferenceLine y={50} label="CRITICAL THRESHOLD" stroke="red" strokeDasharray="3 3" />
                                <Area type="step" dataKey="rx" stroke={color} fill="url(#colorSecurity)" strokeWidth={2} />
                            </AreaChart>
                        </ResponsiveContainer>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default Security;
