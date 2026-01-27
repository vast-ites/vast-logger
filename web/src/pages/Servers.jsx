import { useState, useEffect } from 'react';
import { Server, Cpu, HardDrive, Activity, Plus, Terminal } from 'lucide-react';
import { StatCard } from '../components/widgets/StatCard';
import ConnectAgentModal from '../components/ConnectAgentModal';

export const Servers = () => {
    const [agents, setAgents] = useState([]);
    const [loading, setLoading] = useState(true);
    const [isModalOpen, setIsModalOpen] = useState(false);

    const fetchAgents = async () => {
        try {
            const res = await fetch('/api/v1/hosts');
            const data = await res.json();

            const detailedAgents = await Promise.all(data.map(async (hostname) => {
                try {
                    const metricsRes = await fetch(`/api/v1/metrics/system?host=${hostname}`);
                    const metrics = await metricsRes.json();

                    // Determine online status (if metric is recent < 60s)
                    const lastSeen = new Date(metrics.timestamp).getTime();
                    const now = new Date().getTime();
                    const isOnline = (now - lastSeen) < 60000;

                    return {
                        hostname,
                        platform: metrics.host_info?.os || 'Linux',
                        arch: metrics.host_info?.arch || 'amd64',
                        cpu_percent: metrics.cpu_percent || 0,
                        mem_percent: metrics.memory_usage || 0,
                        disk_percent: metrics.disk_usage || 0,
                        last_seen: metrics.timestamp,
                        status: isOnline ? 'ONLINE' : 'OFFLINE'
                    };
                } catch (e) {
                    return {
                        hostname,
                        platform: 'Unknown',
                        status: 'OFFLINE',
                        cpu_percent: 0,
                        mem_percent: 0,
                        disk_percent: 0,
                        last_seen: new Date().toISOString()
                    };
                }
            }));

            setAgents(detailedAgents);
        } catch (err) {
            console.error(err);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchAgents();
        const interval = setInterval(fetchAgents, 5000); // 5s refresh
        return () => clearInterval(interval);
    }, []);

    const onlineCount = agents.filter(a => a.status === 'ONLINE').length;

    return (
        <div className="space-y-6">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                    <h1 className="text-2xl font-bold text-white tracking-tight flex items-center gap-2">
                        <Server size={24} className="text-blue-400" /> Server Infrastructure
                    </h1>
                    <p className="text-gray-400 text-sm mt-1">
                        Monitor remote servers via Vast Agent
                    </p>
                </div>
                <button
                    onClick={() => setIsModalOpen(true)}
                    className="flex items-center gap-2 bg-blue-600 hover:bg-blue-500 text-white px-4 py-2 rounded-lg transition-colors font-medium"
                >
                    <Plus size={18} /> Connect Server
                </button>
            </div>

            {/* Overview Stats */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <StatCard
                    label="Active Agents"
                    value={onlineCount.toString()}
                    subValue={`Total: ${agents.length}`}
                    icon={Activity}
                    color="green"
                />
                <StatCard
                    label="Total CPU Load"
                    value={`${(agents.reduce((acc, curr) => acc + curr.cpu_percent, 0) / (agents.length || 1)).toFixed(1)}%`}
                    icon={Cpu}
                    color="cyan"
                />
                <StatCard
                    label="Avg Memory"
                    value={`${(agents.reduce((acc, curr) => acc + curr.mem_percent, 0) / (agents.length || 1)).toFixed(1)}%`}
                    icon={HardDrive}
                    color="violet"
                />
            </div>

            {/* Agent Grid */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {agents.map((agent) => (
                    <div key={agent.hostname} className="glass-panel p-6 border border-white/5 relative overflow-hidden group transition-all hover:border-cyan-500/30">
                        <div className={`absolute top-0 right-0 w-24 h-24 bg-${agent.status === 'ONLINE' ? 'green' : 'red'}-500/10 rounded-bl-full -mr-12 -mt-12 transition-all group-hover:scale-110`} />

                        <div className="flex justify-between items-start mb-6 relative">
                            <div className="flex items-center gap-4">
                                <div className={`p-3 rounded-lg bg-${agent.status === 'ONLINE' ? 'green' : 'red'}-500/20 text-${agent.status === 'ONLINE' ? 'green' : 'red'}-400`}>
                                    <Terminal size={24} />
                                </div>
                                <div>
                                    <h3 className="text-lg font-bold text-white">{agent.hostname}</h3>
                                    <p className="text-xs text-gray-400 font-mono">{agent.platform}</p>
                                </div>
                            </div>
                            <span className={`px-2 py-1 rounded text-[10px] font-bold tracking-wider ${agent.status === 'ONLINE' ? 'bg-green-500/20 text-green-400' : 'bg-red-500/20 text-red-400'
                                }`}>
                                {agent.status}
                            </span>
                        </div>

                        <div className="grid grid-cols-3 gap-4">
                            <div className="bg-white/5 p-3 rounded-lg text-center">
                                <span className="text-gray-400 text-xs block mb-1">CPU</span>
                                <span className={`text-lg font-bold font-mono ${agent.cpu_percent > 80 ? 'text-red-400' : 'text-white'}`}>
                                    {agent.cpu_percent.toFixed(1)}%
                                </span>
                            </div>
                            <div className="bg-white/5 p-3 rounded-lg text-center">
                                <span className="text-gray-400 text-xs block mb-1">Memory</span>
                                <span className={`text-lg font-bold font-mono ${agent.mem_percent > 80 ? 'text-red-400' : 'text-white'}`}>
                                    {agent.mem_percent.toFixed(1)}%
                                </span>
                            </div>
                            <div className="bg-white/5 p-3 rounded-lg text-center">
                                <span className="text-gray-400 text-xs block mb-1">Disk</span>
                                <span className={`text-lg font-bold font-mono ${agent.disk_percent > 80 ? 'text-red-400' : 'text-white'}`}>
                                    {agent.disk_percent.toFixed(1)}%
                                </span>
                            </div>
                        </div>

                        <div className="mt-4 pt-4 border-t border-white/5 flex justify-between items-center text-xs text-gray-500">
                            <span>{agent.platform} ({agent.arch})</span>
                            <span>Seen: {new Date(agent.last_seen).toLocaleTimeString()}</span>
                        </div>
                    </div>
                ))}

                {agents.length === 0 && !loading && (
                    <div className="col-span-full p-12 text-center text-gray-500 border border-white/5 border-dashed rounded-xl">
                        <Server size={48} className="mx-auto mb-4 opacity-20" />
                        <p>No agents connected.</p>
                        <p className="text-sm">Click "Connect Server" to deploy an agent.</p>
                    </div>
                )}
            </div>

            <ConnectAgentModal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} />
        </div>
    );
};
