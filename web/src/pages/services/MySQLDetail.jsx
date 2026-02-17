import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, Database, Activity, Zap, AlertTriangle, Users, Clock, HardDrive } from 'lucide-react';
import StatCard from '../../components/service/StatCard';
import ChartPanel from '../../components/service/ChartPanel';
import TimeRangeSelector from '../../components/service/TimeRangeSelector';
import RefreshRateSelector from '../../components/service/RefreshRateSelector';
import SetupInstructionBanner from '../../components/service/SetupInstructionBanner';
import { TablesWithoutIndexes, HighIOTables, SlowQueries } from '../../components/service/DiagnosticSections';

const MySQLDetail = () => {
    const navigate = useNavigate();
    const [timeRange, setTimeRange] = useState('5m');
    const [refreshRate, setRefreshRate] = useState(5);
    const [loading, setLoading] = useState(true);
    const [stats, setStats] = useState(null);
    const [lastUpdated, setLastUpdated] = useState(null);

    const fetchData = async () => {
        try {
            const token = localStorage.getItem('token');
            const headers = { Authorization: `Bearer ${token}` };

            const res = await fetch(`/api/v1/services/mysql/db-stats`, { headers });
            if (res.ok) {
                const data = await res.json();
                if (data.stats) {
                    setStats(data.stats);
                    setLastUpdated(data.timestamp);
                }
            }
            setLoading(false);
        } catch (err) {
            console.error('Failed to fetch MySQL data:', err);
            setLoading(false);
        }
    };

    useEffect(() => { fetchData(); }, [timeRange]);
    useEffect(() => {
        if (refreshRate === 0) return;
        const interval = setInterval(fetchData, refreshRate * 1000);
        return () => clearInterval(interval);
    }, [refreshRate, timeRange]);

    if (loading) return <div className="p-6 text-cyber-cyan">Loading MySQL metrics...</div>;

    const s = stats || {};
    const connUsagePercent = s.max_connections ? ((s.threads_connected / s.max_connections) * 100).toFixed(1) : 0;
    const processList = s.process_list || [];

    return (
        <div className="p-6 space-y-6">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-4">
                    <button onClick={() => navigate('/services')}
                        className="p-2 rounded-lg bg-cyber-gray/50 hover:bg-cyber-gray/80 border border-cyber-dim transition-colors">
                        <ArrowLeft className="w-5 h-5 text-cyber-cyan" />
                    </button>
                    <div>
                        <h1 className="text-2xl font-bold text-cyber-text flex items-center gap-2">
                            <Database className="w-6 h-6 text-cyan-400" />
                            MySQL Database
                        </h1>
                        <p className="text-cyber-muted mt-1">
                            Connection monitoring & query performance
                            {s.is_master !== undefined && (
                                <span className={`ml-2 px-2 py-0.5 text-xs rounded ${s.is_master ? 'bg-green-500/20 text-green-300' : 'bg-yellow-500/20 text-yellow-300'}`}>
                                    {s.is_master ? '● Master' : '● Slave'}
                                </span>
                            )}
                            {s.replication_lag > 0 && (
                                <span className="ml-2 px-2 py-0.5 text-xs rounded bg-red-500/20 text-red-300">
                                    Lag: {s.replication_lag}s
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

            {/* Stats Cards Row 1 */}
            <div className="grid grid-cols-4 gap-4">
                <StatCard title="Active Connections" value={s.threads_connected || 0}
                    max={s.max_connections || 100} icon={Users}
                    status={connUsagePercent > 80 ? 'warning' : 'ok'} />
                <StatCard title="Queries/Second" value={(s.queries_per_second || 0).toFixed(2)}
                    icon={Zap} trend="up" />
                <StatCard title="Slow Queries" value={s.slow_queries || 0}
                    icon={Clock} status={s.slow_queries > 100 ? 'warning' : 'ok'} />
                <StatCard title="Cache Hit Rate" value={(s.query_cache_hit_rate || 0).toFixed(1)}
                    unit="%" icon={Activity} status={s.query_cache_hit_rate > 80 ? 'ok' : 'warning'} />
            </div>

            {/* Stats Cards Row 2 */}
            <div className="grid grid-cols-4 gap-4">
                <StatCard title="Running Threads" value={s.threads_running || 0} icon={Activity} />
                <StatCard title="Aborted Connections" value={s.aborted_connections || 0}
                    icon={AlertTriangle} status={s.aborted_connections > 10 ? 'warning' : 'ok'} />
                <StatCard title="InnoDB Buffer Pool"
                    value={(s.innodb_buffer_pool_size / 1024 / 1024 / 1024 || 0).toFixed(1)}
                    unit="GB" icon={HardDrive} />
                <StatCard title="Replication Lag" value={s.replication_lag || 0}
                    unit="sec" icon={Database} status={s.replication_lag > 10 ? 'warning' : 'ok'} />
            </div>

            {/* Replication & Connection Usage */}
            <div className="grid grid-cols-2 gap-4">
                <ChartPanel title="Connection Usage" subtitle="Current vs Maximum">
                    <div className="flex items-center justify-center h-full">
                        <div className="text-center">
                            <div className="text-6xl font-bold text-cyan-400">{connUsagePercent}%</div>
                            <div className="text-cyber-muted mt-2">
                                {s.threads_connected || 0} / {s.max_connections || 0} connections
                            </div>
                            <div className={`mt-4 text-sm font-medium ${connUsagePercent > 90 ? 'text-red-400' : connUsagePercent > 80 ? 'text-yellow-400' : 'text-green-400'}`}>
                                {connUsagePercent > 90 ? 'Critical' : connUsagePercent > 80 ? 'Warning' : 'Healthy'}
                            </div>
                        </div>
                    </div>
                </ChartPanel>

                <div className="glass-panel p-4">
                    <h3 className="text-lg font-semibold text-cyber-text mb-4">Replication Status</h3>
                    <div className="space-y-3">
                        <div className="flex justify-between">
                            <span className="text-cyber-muted">Role</span>
                            <span className={`font-semibold ${s.is_master ? 'text-green-400' : 'text-yellow-400'}`}>
                                {s.is_master ? 'Master' : 'Slave'}
                            </span>
                        </div>
                        <div className="flex justify-between">
                            <span className="text-cyber-muted">Replication Lag</span>
                            <span className={`font-semibold ${s.replication_lag > 5 ? 'text-red-400' : 'text-green-400'}`}>
                                {s.replication_lag || 0} seconds
                            </span>
                        </div>
                        <div className="flex justify-between">
                            <span className="text-cyber-muted">Uptime</span>
                            <span className="text-cyber-text">{Math.floor((s.uptime || 0) / 3600)}h {Math.floor(((s.uptime || 0) % 3600) / 60)}m</span>
                        </div>
                        <div className="flex justify-between">
                            <span className="text-cyber-muted">Total Connections</span>
                            <span className="text-cyber-text font-semibold">{(s.total_connections || 0).toLocaleString()}</span>
                        </div>
                    </div>
                </div>
            </div>

            {/* Performance Diagnostics */}
            <SetupInstructionBanner
                database="MySQL"
                prerequisite="performance_schema"
                enabled={s.performance_schema?.enabled}
                setupInstructions={`1. Edit MySQL configuration file (my.cnf or my.ini):
   [mysqld]
   performance_schema=ON

2. Restart MySQL:
   sudo systemctl restart mysql

3. Verify:
   SELECT @@performance_schema;`}
            />

            {/* Diagnostic Sections */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
                <TablesWithoutIndexes tables={s.tables_without_indexes || []} />
                <HighIOTables tables={s.high_io_tables || []} />
            </div>

            <div className="mb-6">
                <SlowQueries queries={s.slow_queries_perf || []} />
            </div>

            {/* Active Queries (Process List) */}
            <div className="glass-panel p-4">
                <h3 className="text-lg font-semibold text-cyber-text mb-4 flex items-center gap-2">
                    <Activity className="w-5 h-5 text-cyan-400" />
                    Active Queries (Process List)
                    <span className="ml-auto text-sm font-normal text-cyber-muted">
                        {processList.length} active
                    </span>
                </h3>
                <div className="overflow-x-auto">
                    <table className="w-full">
                        <thead>
                            <tr className="border-b border-cyber-dim">
                                <th className="text-left py-2 px-3 text-cyber-muted font-medium">ID</th>
                                <th className="text-left py-2 px-3 text-cyber-muted font-medium">User</th>
                                <th className="text-left py-2 px-3 text-cyber-muted font-medium">Host</th>
                                <th className="text-left py-2 px-3 text-cyber-muted font-medium">DB</th>
                                <th className="text-left py-2 px-3 text-cyber-muted font-medium">Command</th>
                                <th className="text-left py-2 px-3 text-cyber-muted font-medium">Time</th>
                                <th className="text-left py-2 px-3 text-cyber-muted font-medium">State</th>
                                <th className="text-left py-2 px-3 text-cyber-muted font-medium">Query</th>
                            </tr>
                        </thead>
                        <tbody>
                            {processList.length === 0 ? (
                                <tr><td colSpan="8" className="text-center py-8 text-cyber-muted">No active queries</td></tr>
                            ) : (
                                processList.slice(0, 25).map((p, idx) => (
                                    <tr key={idx} className="border-b border-cyber-gray hover:bg-cyber-gray/30">
                                        <td className="py-2 px-3 text-cyber-text font-mono text-sm">{p.ID || p.id}</td>
                                        <td className="py-2 px-3 text-cyber-cyan text-sm">{p.User || p.user}</td>
                                        <td className="py-2 px-3 text-cyber-muted text-sm font-mono">{p.Host || p.host}</td>
                                        <td className="py-2 px-3 text-cyber-text text-sm">{p.Database || p.database || '-'}</td>
                                        <td className="py-2 px-3 text-cyber-text text-sm">{p.Command || p.command}</td>
                                        <td className={`py-2 px-3 text-sm font-mono ${(p.Time || p.time || 0) > 5 ? 'text-yellow-400' : 'text-cyber-text'}`}>
                                            {p.Time || p.time || 0}s
                                        </td>
                                        <td className="py-2 px-3 text-cyber-muted text-sm">{p.State || p.state || '-'}</td>
                                        <td className="py-2 px-3 text-cyber-text text-sm font-mono truncate max-w-xs">{p.Info || p.info || '-'}</td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>
            </div>

            {/* No Data Warning */}
            {!stats && (
                <div className="bg-cyber-yellow/10 border border-cyber-yellow/30 rounded-lg p-4 flex items-start gap-3">
                    <AlertTriangle className="w-5 h-5 text-cyber-yellow mt-0.5" />
                    <div>
                        <p className="text-cyber-text font-medium">No Data Available</p>
                        <p className="text-cyber-muted text-sm mt-1">
                            MySQL monitoring requires the agent to have access to MySQL on port 3306.
                        </p>
                    </div>
                </div>
            )}

            {lastUpdated && (
                <div className="text-right text-cyber-muted text-xs">
                    Last updated: {new Date(lastUpdated).toLocaleString()}
                </div>
            )}
        </div>
    );
};

export default MySQLDetail;
