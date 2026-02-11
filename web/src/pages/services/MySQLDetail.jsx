import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, Database, Activity, Zap, AlertTriangle, Users, Clock, HardDrive } from 'lucide-react';
import { LineChart, Line, AreaChart, Area, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts';
import StatCard from '../../components/service/StatCard';
import ChartPanel from '../../components/service/ChartPanel';
import TimeRangeSelector from '../../components/service/TimeRangeSelector';
import RefreshRateSelector from '../../components/service/RefreshRateSelector';

const MySQLDetail = () => {
    const { serviceName } = useParams();
    const navigate = useNavigate();

    const [timeRange, setTimeRange] = useState('5m');
    const [refreshRate, setRefreshRate] = useState(1);
    const [loading, setLoading] = useState(true);
    const [stats, setStats] = useState(null);
    const [slowQueries, setSlowQueries] = useState([]);
    const [connections, setConnections] = useState([]);

    // Fetch data
    const fetchData = async () => {
        try {
            const token = localStorage.getItem('token');
            const headers = { Authorization: `Bearer ${token}` };
            const baseUrl = `/api/v1/services/mysql`;

            const [statusRes, slowQueriesRes, connectionsRes] = await Promise.all([
                fetch(`${baseUrl}/status?duration=${timeRange}`, { headers }),
                fetch(`${baseUrl}/slow-queries?duration=${timeRange}&limit=50`, { headers }),
                fetch(`${baseUrl}/connections?duration=${timeRange}`, { headers }),
            ]);

            if (statusRes.ok) {
                const data = await statusRes.json();
                setStats(data.stats ? data : data);
            }
            if (slowQueriesRes.ok) {
                const data = await slowQueriesRes.json();
                setSlowQueries(data.queries || []);
            }
            if (connectionsRes.ok) {
                const data = await connectionsRes.json();
                setConnections(data.connections || []);
            }

            setLoading(false);
        } catch (err) {
            console.error('Failed to fetch MySQL data:', err);
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchData();
    }, [timeRange]);

    // Auto-refresh
    useEffect(() => {
        if (refreshRate === 0) return;

        const interval = setInterval(fetchData, refreshRate * 1000);
        return () => clearInterval(interval);
    }, [refreshRate, timeRange]);

    if (loading) {
        return (
            <div className="p-6">
                <div className="text-cyber-cyan">Loading MySQL metrics...</div>
            </div>
        );
    }

    const connUsagePercent = stats?.max_connections ?
        ((stats.threads_connected / stats.max_connections) * 100).toFixed(1) : 0;

    return (
        <div className="p-6 space-y-6">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-4">
                    <button
                        onClick={() => navigate('/services')}
                        className="p-2 rounded-lg bg-cyber-gray/20 hover:bg-cyber-gray/40 border border-cyber-dim transition-colors"
                    >
                        <ArrowLeft className="w-5 h-5 text-cyber-cyan" />
                    </button>
                    <div>
                        <h1 className="text-2xl font-bold text-cyber-text flex items-center gap-2">
                            <Database className="w-6 h-6 text-cyan-400" />
                            MySQL Database
                        </h1>
                        <p className="text-cyber-muted mt-1">
                            Connection monitoring & query performance
                            {stats?.is_master !== undefined && (
                                <span className="ml-2 px-2 py-0.5 text-xs rounded bg-cyan-500/20 text-cyan-300">
                                    {stats.is_master ? 'Master' : 'Slave'}
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

            {/* Stats Cards */}
            <div className="grid grid-cols-4 gap-4">
                <StatCard
                    title="Active Connections"
                    value={stats?.threads_connected || 0}
                    max={stats?.max_connections || 100}
                    icon={Users}
                    status={connUsagePercent > 80 ? 'warning' : 'ok'}
                />
                <StatCard
                    title="Queries/Second"
                    value={(stats?.queries_per_second || 0).toFixed(2)}
                    icon={Zap}
                    trend="up"
                />
                <StatCard
                    title="Slow Queries"
                    value={stats?.slow_queries || 0}
                    icon={Clock}
                    status={stats?.slow_queries > 100 ? 'warning' : 'ok'}
                />
                <StatCard
                    title="Query Cache Hit Rate"
                    value={(stats?.query_cache_hit_rate || 0).toFixed(1)}
                    unit="%"
                    icon={Activity}
                    status={stats?.query_cache_hit_rate > 80 ? 'ok' : 'warning'}
                />
            </div>

            {/* Second Row Cards */}
            <div className="grid grid-cols-4 gap-4">
                <StatCard
                    title="Running Threads"
                    value={stats?.threads_running || 0}
                    icon={Activity}
                />
                <StatCard
                    title="Aborted Connections"
                    value={stats?.aborted_connections || 0}
                    icon={AlertTriangle}
                    status={stats?.aborted_connections > 10 ? 'warning' : 'ok'}
                />
                <StatCard
                    title="InnoDB Buffer Pool"
                    value={(stats?.innodb_buffer_pool_size / 1024 / 1024 / 1024 || 0).toFixed(1)}
                    unit="GB"
                    icon={HardDrive}
                />
                <StatCard
                    title="Replication Lag"
                    value={stats?.replication_lag || 0}
                    unit="sec"
                    icon={Database}
                    status={stats?.replication_lag > 10 ? 'warning' : 'ok'}
                />
            </div>

            {/* Charts Row */}
            <div className="grid grid-cols-2 gap-4">
                <ChartPanel title="Connections by Client IP" subtitle="Top database clients">
                    <ResponsiveContainer width="100%" height="100%">
                        <BarChart data={connections.slice(0, 10)} layout="horizontal">
                            <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
                            <XAxis type="number" stroke="#9ca3af" />
                            <YAxis dataKey="ip" type="category" width={120} stroke="#9ca3af" tick={{ fill: '#9ca3af' }} />
                            <Tooltip
                                contentStyle={{ backgroundColor: 'rgb(var(--cyber-dark))', border: '1px solid rgb(var(--cyber-dim))', color: 'rgb(var(--text-main))' }}
                                itemStyle={{ color: 'rgb(var(--text-main))' }}
                            />
                            <Bar dataKey="count" fill="#06b6d4" name="Connections" />
                        </BarChart>
                    </ResponsiveContainer>
                </ChartPanel>

                <ChartPanel title="Connection Usage" subtitle="Current vs Maximum">
                    <div className="flex items-center justify-center h-full">
                        <div className="text-center">
                            <div className="text-6xl font-bold text-cyan-400">
                                {connUsagePercent}%
                            </div>
                            <div className="text-cyber-muted mt-2">
                                {stats?.threads_connected || 0} / {stats?.max_connections || 0} connections
                            </div>
                            <div className={`mt-4 text-sm font-medium ${connUsagePercent > 80 ? 'text-yellow-400' :
                                connUsagePercent > 90 ? 'text-red-400' : 'text-green-400'
                                }`}>
                                {connUsagePercent > 90 ? 'Critical' :
                                    connUsagePercent > 80 ? 'Warning' : 'Healthy'}
                            </div>
                        </div>
                    </div>
                </ChartPanel>
            </div>

            {/* Slow Queries Table */}
            <div className="glass-panel p-4">
                <h3 className="text-lg font-semibold text-cyber-text mb-4 flex items-center gap-2">
                    <Clock className="w-5 h-5 text-yellow-400" />
                    Slow Queries
                    <span className="ml-auto text-sm font-normal text-cyber-muted">
                        {slowQueries.length} queries
                    </span>
                </h3>
                <div className="overflow-x-auto">
                    <table className="w-full">
                        <thead>
                            <tr className="border-b border-cyber-dim">
                                <th className="text-left py-2 px-4 text-cyber-muted font-medium">Time</th>
                                <th className="text-left py-2 px-4 text-cyber-muted font-medium">Query Time</th>
                                <th className="text-left py-2 px-4 text-cyber-muted font-medium">Rows Examined</th>
                                <th className="text-left py-2 px-4 text-cyber-muted font-medium">Client IP</th>
                                <th className="text-left py-2 px-4 text-cyber-muted font-medium">Query</th>
                            </tr>
                        </thead>
                        <tbody>
                            {slowQueries.length === 0 ? (
                                <tr>
                                    <td colSpan="5" className="text-center py-8 text-cyber-muted">
                                        No slow queries found
                                    </td>
                                </tr>
                            ) : (
                                slowQueries.slice(0, 20).map((query, idx) => (
                                    <tr key={idx} className="border-b border-cyber-gray hover:bg-cyber-gray/30">
                                        <td className="py-3 px-4 text-cyber-text text-sm">
                                            {new Date(query.timestamp).toLocaleTimeString()}
                                        </td>
                                        <td className="py-3 px-4 font-mono text-yellow-400">
                                            {query.query_time.toFixed(3)}s
                                        </td>
                                        <td className="py-3 px-4 text-cyber-text">
                                            {query.rows_examined?.toLocaleString()}
                                        </td>
                                        <td className="py-3 px-4 font-mono text-cyber-cyan">
                                            {query.client_ip || 'N/A'}
                                        </td>
                                        <td className="py-3 px-4 text-cyber-text font-mono text-sm truncate max-w-md">
                                            {query.query_text}
                                        </td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>
            </div>

            {/* Info Message */}
            {!stats && (
                <div className="bg-cyber-yellow/10 border border-cyber-yellow/30 rounded-lg p-4 flex items-start gap-3">
                    <AlertTriangle className="w-5 h-5 text-cyber-yellow mt-0.5" />
                    <div>
                        <p className="text-cyber-text font-medium">No Data Available</p>
                        <p className="text-cyber-muted text-sm mt-1">
                            MySQL monitoring requires agent access to the MySQL database with appropriate credentials.
                        </p>
                    </div>
                </div>
            )}
        </div>
    );
};

export default MySQLDetail;
