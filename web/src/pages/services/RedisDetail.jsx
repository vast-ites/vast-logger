import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Database, Activity, Zap, HardDrive, TrendingUp } from 'lucide-react';
import StatCard from '../../components/service/StatCard';
import ChartPanel from '../../components/service/ChartPanel';
import TimeRangeSelector from '../../components/service/TimeRangeSelector';
import RefreshRateSelector from '../../components/service/RefreshRateSelector';

const RedisDetail = () => {
    const navigate = useNavigate();
    const [timeRange, setTimeRange] = useState('1h');
    const [refreshRate, setRefreshRate] = useState(10);
    const [loading, setLoading] = useState(true);
    const [stats, setStats] = useState(null);

    const fetchData = async () => {
        try {
            const token = localStorage.getItem('token');
            const headers = { Authorization: `Bearer ${token}` };

            const res = await fetch(`/api/v1/services/redis/status?duration=${timeRange}`, { headers });
            if (res.ok) setStats(await res.json());
            setLoading(false);
        } catch (err) {
            console.error('Failed to fetch Redis data:', err);
            setLoading(false);
        }
    };

    useEffect(() => { fetchData(); }, [timeRange]);
    useEffect(() => {
        if (refreshRate === 0) return;
        const interval = setInterval(fetchData, refreshRate * 1000);
        return () => clearInterval(interval);
    }, [refreshRate, timeRange]);

    if (loading) return <div className="p-6 text-cyan-400">Loading Redis metrics...</div>;

    const memUsage = stats?.max_memory ?
        ((stats.used_memory / stats.max_memory) * 100).toFixed(1) : 0;

    return (
        <div className="p-6 space-y-6">
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-4">
                    <button onClick={() => navigate('/services')}
                        className="p-2 rounded-lg bg-gray-800 hover:bg-gray-700 border border-cyan-500/30">
                        <ArrowLeft className="w-5 h-5 text-cyan-400" />
                    </button>
                    <div>
                        <h1 className="text-2xl font-bold text-white flex items-center gap-2">
                            <Database className="w-6 h-6 text-red-400" />
                            Redis Cache
                        </h1>
                        <p className="text-gray-400 mt-1">
                            Memory & performance monitoring
                            {stats?.role && (
                                <span className="ml-2 px-2 py-0.5 text-xs rounded bg-red-500/20 text-red-300">
                                    {stats.role}
                                </span>
                            )}
                        </p>
                    </div>
                </div>
                <div className="flex gap-3">
                    <TimeRangeSelector value={timeRange} onChange={setTimeRange} />
                    <RefreshRateSelector value={refreshRate} onChange={setRefreshRate} />
                </div>
            </div>

            <div className="grid grid-cols-4 gap-4">
                <StatCard title="Connected Clients" value={stats?.connected_clients || 0}
                    icon={Activity} />
                <StatCard title="Ops/Sec" value={stats?.ops_per_sec || 0}
                    icon={Zap} trend="up" />
                <StatCard title="Hit Rate" value={(stats?.hit_rate || 0).toFixed(1)}
                    unit="%" icon={TrendingUp} status={stats?.hit_rate > 80 ? 'ok' : 'warning'} />
                <StatCard title="Evicted Keys" value={stats?.evicted_keys || 0}
                    icon={Activity} status={stats?.evicted_keys > 1000 ? 'warning' : 'ok'} />
            </div>

            <div className="grid grid-cols-2 gap-4">
                <ChartPanel title="Memory Usage" subtitle="Current vs Maximum">
                    <div className="flex items-center justify-center h-full">
                        <div className="text-center">
                            <div className="text-6xl font-bold text-red-400">{memUsage}%</div>
                            <div className="text-gray-400 mt-2">
                                {(stats?.used_memory / 1024 / 1024 || 0).toFixed(2)} MB /
                                {(stats?.max_memory / 1024 / 1024 || 0).toFixed(2)} MB
                            </div>
                        </div>
                    </div>
                </ChartPanel>

                <div className="bg-gray-800/50 border border-cyan-500/30 rounded-lg p-4">
                    <h3 className="text-lg font-semibold text-white mb-4">Key Metrics</h3>
                    <div className="space-y-3">
                        <div className="flex justify-between">
                            <span className="text-gray-400">Keyspace Hits</span>
                            <span className="text-white font-semibold">{stats?.keyspace_hits?.toLocaleString() || 0}</span>
                        </div>
                        <div className="flex justify-between">
                            <span className="text-gray-400">Keyspace Misses</span>
                            <span className="text-white font-semibold">{stats?.keyspace_misses?.toLocaleString() || 0}</span>
                        </div>
                        <div className="flex justify-between">
                            <span className="text-gray-400">Expired Keys</span>
                            <span className="text-white font-semibold">{stats?.expired_keys?.toLocaleString() || 0}</span>
                        </div>
                        <div className="flex justify-between">
                            <span className="text-gray-400">Memory Fragmentation</span>
                            <span className="text-white font-semibold">{stats?.memory_fragmentation?.toFixed(2) || 0}</span>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default RedisDetail;
