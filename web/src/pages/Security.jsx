import React, { useState, useEffect } from 'react';
import { Shield, AlertTriangle, Lock, Unlock, Wifi, Zap } from 'lucide-react';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, ReferenceLine } from 'recharts';

import { useHost } from '../contexts/HostContext';

const Security = () => {
    const { selectedHost } = useHost();
    const [history, setHistory] = useState([]);
    const [currentStatus, setCurrentStatus] = useState('SAFE');
    const [loading, setLoading] = useState(true);
    const [firewallRules, setFirewallRules] = useState('Loading firewall configuration...');

    const fetchHistory = async () => {
        try {
            const params = selectedHost ? `?host=${selectedHost}` : '';
            const res = await fetch(`/api/v1/metrics/history${params}&duration=30m`); // Assuming history supports host param
            if (res.ok) {
                const data = await res.json();

                // Transform for charts
                const historyData = data.map(d => ({
                    time: new Date(d.timestamp).toLocaleTimeString(),
                    ddos_score: d.ddos_status === 'CRITICAL' ? 100 : (d.ddos_status === 'WARNING' ? 50 : 0),
                    traffic: (d.net_recv_rate || 0) + (d.net_sent_rate || 0)
                })).reverse();

                setHistory(historyData);

                // Determine current status from latest data point
                if (historyData.length > 0) {
                    const last = historyData[historyData.length - 1];
                    // Use ddos_score for status
                    if (last.ddos_score === 100) setCurrentStatus('CRITICAL');
                    else if (last.ddos_score === 50) setCurrentStatus('WARNING');
                    else setCurrentStatus('SAFE');
                }
            }

            // Fetch Firewall
            const resFw = await fetch(`/api/v1/firewall${params}`);
            if (resFw.ok) {
                const data = await resFw.json();
                setFirewallRules(data.rules || 'No active firewall rules found or agent not reporting.');
            }
        } catch (err) {
            console.error("Failed to fetch security history", err);
            setFirewallRules("Connection Error: Failed to retrieve firewall rules.");
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchHistory();
        const interval = setInterval(fetchHistory, 5000);
        return () => clearInterval(interval);
    }, [selectedHost]);

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

            {/* Firewall Rules */}
            <div className="glass-panel p-6 rounded-xl border border-cyber-gray flex flex-col">
                <h3 className="text-lg font-bold text-cyber-cyan mb-4 flex items-center gap-2">
                    <Lock size={18} /> Host Firewall Configuration
                </h3>
                <div className="bg-black/50 p-4 rounded font-mono text-xs text-green-400 overflow-auto max-h-96 whitespace-pre custom-scrollbar border border-white/10">
                    {firewallRules}
                </div>
            </div>
        </div>
    );
};

export default Security;
