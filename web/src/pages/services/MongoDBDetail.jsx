import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Database, Activity, HardDrive, FileText } from 'lucide-react';
import StatCard from '../../components/service/StatCard';
import ChartPanel from '../../components/service/ChartPanel';
import TimeRangeSelector from '../../components/service/TimeRangeSelector';
import RefreshRateSelector from '../../components/service/RefreshRateSelector';

const MongoDBDetail = () => {
    const navigate = useNavigate();
    const [timeRange, setTimeRange] = useState('1h');
    const [refreshRate, setRefreshRate] = useState(10);
    const [loading, setLoading] = useState(true);
    const [stats, setStats] = useState(null);

    const fetchData = async () => {
        try {
            const token = localStorage.getItem('token');
            const headers = { Authorization: `Bearer ${token}` };

            const res = await fetch(`/api/v1/services/mongodb/status?duration=${timeRange}`, { headers });
            if (res.ok) setStats(await res.json());
            setLoading(false);
        } catch (err) {
            console.error('Failed to fetch MongoDB data:', err);
            setLoading(false);
        }
    };

    useEffect(() => { fetchData(); }, [timeRange]);
    useEffect(() => {
        if (refreshRate === 0) return;
        const interval = setInterval(fetchData, refreshRate * 1000);
        return () => clearInterval(interval);
    }, [refreshRate, timeRange]);

    if (loading) return <div className="p-6 text-cyan-400">Loading MongoDB metrics...</div>;

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
                            <Database className="w-6 h-6 text-green-400" />
                            MongoDB
                        </h1>
                        <p className="text-gray-400 mt-1">
                            Document database monitoring
                            {stats?.replica_set_name && (
                                <span className="ml-2 px-2 py-0.5 text-xs rounded bg-green-500/20 text-green-300">
                                    {stats.replica_set_name} - {stats.role}
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
                <StatCard title="Connections" value={stats?.connections || 0}
                    max={stats?.max_connections} icon={Activity} />
                <StatCard title="Documents" value={(stats?.doc_count || 0).toLocaleString()}
                    icon={FileText} />
                <StatCard title="Data Size" value={(stats?.data_size / 1024 / 1024 / 1024 || 0).toFixed(2)}
                    unit="GB" icon={HardDrive} />
                <StatCard title="Storage Size" value={(stats?.storage_size / 1024 / 1024 / 1024 || 0).toFixed(2)}
                    unit="GB" icon={HardDrive} />
            </div>

            <div className="grid grid-cols-2 gap-4">
                <div className="bg-gray-800/50 border border-cyan-500/30 rounded-lg p-4">
                    <h3 className="text-lg font-semibold text-white mb-4">Operation Counters</h3>
                    <div className="space-y-3">
                        <div className="flex justify-between">
                            <span className="text-gray-400">Queries</span>
                            <span className="text-white font-semibold">{stats?.op_counters?.query?.toLocaleString() || 0}</span>
                        </div>
                        <div className="flex justify-between">
                            <span className="text-gray-400">Inserts</span>
                            <span className="text-white font-semibold">{stats?.op_counters?.insert?.toLocaleString() || 0}</span>
                        </div>
                        <div className="flex justify-between">
                            <span className="text-gray-400">Updates</span>
                            <span className="text-white font-semibold">{stats?.op_counters?.update?.toLocaleString() || 0}</span>
                        </div>
                        <div className="flex justify-between">
                            <span className="text-gray-400">Deletes</span>
                            <span className="text-white font-semibold">{stats?.op_counters?.delete?.toLocaleString() || 0}</span>
                        </div>
                    </div>
                </div>

                <div className="bg-gray-800/50 border border-cyan-500/30 rounded-lg p-4">
                    <h3 className="text-lg font-semibold text-white mb-4">Server Info</h3>
                    <div className="space-y-3">
                        <div className="flex justify-between">
                            <span className="text-gray-400">Version</span>
                            <span className="text-white font-mono">{stats?.version || 'N/A'}</span>
                        </div>
                        <div className="flex justify-between">
                            <span className="text-gray-400">Uptime</span>
                            <span className="text-white">{Math.floor((stats?.uptime || 0) / 3600)}h</span>
                        </div>
                        <div className="flex justify-between">
                            <span className="text-gray-400">Memory Used</span>
                            <span className="text-white">{(stats?.memory_used / 1024 / 1024 || 0).toFixed(2)} MB</span>
                        </div>
                        <div className="flex justify-between">
                            <span className="text-gray-400">Index Size</span>
                            <span className="text-white">{(stats?.index_size / 1024 / 1024 || 0).toFixed(2)} MB</span>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default MongoDBDetail;
