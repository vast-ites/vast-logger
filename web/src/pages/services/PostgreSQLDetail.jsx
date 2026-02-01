import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, Database, Activity, Lock, AlertCircle, HardDrive } from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import StatCard from '../../components/service/StatCard';
import ChartPanel from '../../components/service/ChartPanel';
import TimeRangeSelector from '../../components/service/TimeRangeSelector';
import RefreshRateSelector from '../../components/service/RefreshRateSelector';

const PostgreSQLDetail = () => {
    const navigate = useNavigate();
    const [timeRange, setTimeRange] = useState('1h');
    const [refreshRate, setRefreshRate] = useState(10);
    const [loading, setLoading] = useState(true);
    const [stats, setStats] = useState(null);

    const fetchData = async () => {
        try {
            const token = localStorage.getItem('token');
            const headers = { Authorization: `Bearer ${token}` };

            const res = await fetch(`/api/v1/services/postgresql/status?duration=${timeRange}`, { headers });
            if (res.ok) {
                setStats(await res.json());
            }
            setLoading(false);
        } catch (err) {
            console.error('Failed to fetch PostgreSQL data:', err);
            setLoading(false);
        }
    };

    useEffect(() => { fetchData(); }, [timeRange]);
    useEffect(() => {
        if (refreshRate === 0) return;
        const interval = setInterval(fetchData, refreshRate * 1000);
        return () => clearInterval(interval);
    }, [refreshRate, timeRange]);

    if (loading) return <div className="p-6 text-cyan-400">Loading PostgreSQL metrics...</div>;

    const connUsage = stats?.max_connections ?
        ((stats.total_connections / stats.max_connections) * 100).toFixed(1) : 0;

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
                            <Database className="w-6 h-6 text-cyan-400" />
                            PostgreSQL Database
                        </h1>
                        <p className="text-gray-400 mt-1">Advanced connection & query monitoring</p>
                    </div>
                </div>
                <div className="flex gap-3">
                    <TimeRangeSelector value={timeRange} onChange={setTimeRange} />
                    <RefreshRateSelector value={refreshRate} onChange={setRefreshRate} />
                </div>
            </div>

            <div className="grid grid-cols-4 gap-4">
                <StatCard title="Active Connections" value={stats?.active_connections || 0}
                    icon={Activity} status="ok" />
                <StatCard title="Idle Connections" value={stats?.idle_connections || 0}
                    icon={Database} />
                <StatCard title="Cache Hit Ratio" value={(stats?.cache_hit_ratio || 0).toFixed(1)}
                    unit="%" icon={Activity} status={stats?.cache_hit_ratio > 90 ? 'ok' : 'warning'} />
                <StatCard title="TPS" value={(stats?.transactions_per_sec || 0).toFixed(2)}
                    icon={Activity} trend="up" />
            </div>

            <div className="grid grid-cols-4 gap-4">
                <StatCard title="Database Size" value={(stats?.database_size / 1024 / 1024 / 1024 || 0).toFixed(2)}
                    unit="GB" icon={HardDrive} />
                <StatCard title="Dead Tuples" value={stats?.dead_tuples || 0}
                    icon={AlertCircle} status={stats?.dead_tuples > 10000 ? 'warning' : 'ok'} />
                <StatCard title="Locks" value={stats?.locks_count || 0}
                    icon={Lock} status={stats?.locks_count > 50 ? 'warning' : 'ok'} />
                <StatCard title="Long Queries" value={stats?.long_running_queries || 0}
                    icon={AlertCircle} status={stats?.long_running_queries > 5 ? 'warning' : 'ok'} />
            </div>

            <ChartPanel title="Connection Usage" subtitle="Current vs Maximum">
                <div className="flex items-center justify-center h-full">
                    <div className="text-center">
                        <div className="text-6xl font-bold text-cyan-400">{connUsage}%</div>
                        <div className="text-gray-400 mt-2">
                            {stats?.total_connections || 0} / {stats?.max_connections || 0} connections
                        </div>
                    </div>
                </div>
            </ChartPanel>

            {!stats && (
                <div className="bg-yellow-500/10 border border-yellow-500/30 rounded-lg p-4">
                    <AlertCircle className="w-5 h-5 text-yellow-400 inline mr-2" />
                    <span className="text-yellow-200">No data available. Ensure agent has PostgreSQL access.</span>
                </div>
            )}
        </div>
    );
};

export default PostgreSQLDetail;
