import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, Globe, Activity, HardDrive, Users, TrendingUp, AlertCircle } from 'lucide-react';
import { LineChart, Line, AreaChart, Area, BarChart, Bar, PieChart, Pie, Cell, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import StatCard from '../../components/service/StatCard';
import ChartPanel from '../../components/service/ChartPanel';
import TimeRangeSelector from '../../components/service/TimeRangeSelector';
import RefreshRateSelector from '../../components/service/RefreshRateSelector';

const ApacheDetail = () => {
    const { serviceName } = useParams();
    const navigate = useNavigate();

    const [timeRange, setTimeRange] = useState('5m');
    const [refreshRate, setRefreshRate] = useState(1);
    const [loading, setLoading] = useState(true);
    const [stats, setStats] = useState(null);
    const [accessLogs, setAccessLogs] = useState([]);
    const [geoStats, setGeoStats] = useState(null);
    const [topIPs, setTopIPs] = useState([]);

    // Fetch data
    const fetchData = async () => {
        try {
            const token = localStorage.getItem('token');
            const headers = { Authorization: `Bearer ${token}` };
            const baseUrl = `/api/v1/services/${serviceName}`;

            // Fetch all data in parallel
            const [statsRes, logsRes, geoRes, ipsRes] = await Promise.all([
                fetch(`${baseUrl}/stats?duration=${timeRange}`, { headers }),
                fetch(`${baseUrl}/access-logs?duration=${timeRange}&limit=1000`, { headers }),
                fetch(`${baseUrl}/geo?duration=${timeRange}`, { headers }),
                fetch(`${baseUrl}/top-ips?duration=${timeRange}&limit=10`, { headers }),
            ]);

            if (statsRes.ok) setStats(await statsRes.json());
            if (logsRes.ok) setAccessLogs((await logsRes.json()).logs || []);
            if (geoRes.ok) setGeoStats(await geoRes.json());
            if (ipsRes.ok) setTopIPs((await ipsRes.json()).by_requests || []);

            setLoading(false);
        } catch (err) {
            console.error('Failed to fetch service data:', err);
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchData();
    }, [timeRange, serviceName]);

    // Auto-refresh
    useEffect(() => {
        if (refreshRate === 0) return;

        const interval = setInterval(fetchData, refreshRate * 1000);
        return () => clearInterval(interval);
    }, [refreshRate, timeRange]);

    // Process status code data for pie chart
    const statusCodeData = stats ? [
        { name: '2xx Success', value: stats.status_2xx || 0, color: '#10b981' },
        { name: '3xx Redirect', value: stats.status_3xx || 0, color: '#3b82f6' },
        { name: '4xx Client Error', value: stats.status_4xx || 0, color: '#f59e0b' },
        { name: '5xx Server Error', value: stats.status_5xx || 0, color: '#ef4444' },
    ].filter(d => d.value > 0) : [];

    if (loading) {
        return (
            <div className="p-6">
                <div className="text-cyan-400">Loading {serviceName} metrics...</div>
            </div>
        );
    }

    return (
        <div className="p-6 space-y-6">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-4">
                    <button
                        onClick={() => navigate('/services')}
                        className="p-2 rounded-lg bg-gray-800 hover:bg-gray-700 border border-cyan-500/30 transition-colors"
                    >
                        <ArrowLeft className="w-5 h-5 text-cyan-400" />
                    </button>
                    <div>
                        <h1 className="text-2xl font-bold text-white capitalize flex items-center gap-2">
                            <Globe className="w-6 h-6 text-cyan-400" />
                            {serviceName} Web Server
                        </h1>
                        <p className="text-gray-400 mt-1">Real-time traffic analysis & monitoring</p>
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
                    title="Total Requests"
                    value={stats?.total_requests || 0}
                    icon={Activity}
                    trend="up"
                    subtitle={`${timeRange} period`}
                />
                <StatCard
                    title="Success Rate"
                    value={stats?.total_requests ? ((stats.status_2xx / stats.total_requests) * 100).toFixed(1) : 0}
                    unit="%"
                    icon={TrendingUp}
                    status={stats?.status_2xx / stats?.total_requests > 0.9 ? 'ok' : 'warning'}
                />
                <StatCard
                    title="Bandwidth"
                    value={(stats?.total_bytes / 1024 / 1024 || 0).toFixed(2)}
                    unit="MB"
                    icon={HardDrive}
                />
                <StatCard
                    title="Errors (4xx/5xx)"
                    value={(stats?.status_4xx || 0) + (stats?.status_5xx || 0)}
                    icon={AlertCircle}
                    status={(stats?.status_4xx + stats?.status_5xx) > 100 ? 'warning' : 'ok'}
                />
            </div>

            {/* Charts Row 1 */}
            <div className="grid grid-cols-2 gap-4">
                <ChartPanel title="HTTP Status Codes" subtitle="Request distribution by status">
                    <ResponsiveContainer width="100%" height="100%">
                        <PieChart>
                            <Pie
                                data={statusCodeData}
                                cx="50%"
                                cy="50%"
                                labelLine={false}
                                label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                                outerRadius={80}
                                fill="#8884d8"
                                dataKey="value"
                            >
                                {statusCodeData.map((entry, index) => (
                                    <Cell key={`cell-${index}`} fill={entry.color} />
                                ))}
                            </Pie>
                            <Tooltip />
                        </PieChart>
                    </ResponsiveContainer>
                </ChartPanel>

                <ChartPanel title="Top Countries" subtitle="Requests by geographic location">
                    <ResponsiveContainer width="100%" height="100%">
                        <BarChart data={geoStats?.top_countries || []}>
                            <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
                            <XAxis dataKey="country" stroke="#9ca3af" />
                            <YAxis stroke="#9ca3af" />
                            <Tooltip
                                contentStyle={{ backgroundColor: '#1f2937', border: '1px solid #374151' }}
                                labelStyle={{ color: '#fff' }}
                            />
                            <Bar dataKey="count" fill="#06b6d4" />
                        </BarChart>
                    </ResponsiveContainer>
                </ChartPanel>
            </div>

            {/* Top IPs Table */}
            <div className="bg-gray-800/50 border border-cyan-500/30 rounded-lg p-4">
                <h3 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
                    <Users className="w-5 h-5 text-cyan-400" />
                    Top Client IPs
                </h3>
                <div className="overflow-x-auto">
                    <table className="w-full">
                        <thead className="bg-white/5 text-gray-400 text-xs uppercase">
                            <tr>
                                <th className="py-3 px-4 text-left">IP Address</th>
                                <th className="py-3 px-4 text-left">Source Domain</th>
                                <th className="py-3 px-4 text-left">Country</th>
                                <th className="py-3 px-4 text-left">City</th>
                                <th className="py-3 px-4 text-left">State</th>
                                <th className="py-3 px-4 text-left">Requests</th>
                                <th className="py-3 px-4 text-left">Bandwidth</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-white/10 text-sm">
                            {topIPs.length === 0 ? (
                                <tr>
                                    <td colSpan="6" className="py-4 text-center text-gray-500">
                                        No recent activity
                                    </td>
                                </tr>
                            ) : (
                                topIPs.map((ip, i) => (
                                    <tr key={i} className="hover:bg-white/5 transition-colors">
                                        <td className="py-3 px-4 font-mono text-cyan-400">{ip.ip}</td>
                                        <td className="py-3 px-4 text-gray-300">{ip.domain || '-'}</td>
                                        <td className="py-3 px-4 text-gray-300">{ip.country || 'Unknown'}</td>
                                        <td className="py-3 px-4 text-gray-300">{ip.city || '-'}</td>
                                        <td className="py-3 px-4 text-gray-300">{ip.region || '-'}</td>
                                        <td className="py-3 px-4 text-white">{ip.requests?.toLocaleString()}</td>
                                        <td className="py-3 px-4 text-white">
                                            {(ip.bytes / 1024 / 1024).toFixed(2)} MB
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
                <div className="bg-yellow-500/10 border border-yellow-500/30 rounded-lg p-4 flex items-start gap-3">
                    <AlertCircle className="w-5 h-5 text-yellow-400 mt-0.5" />
                    <div>
                        <p className="text-yellow-200 font-medium">No Data Available</p>
                        <p className="text-yellow-300/70 text-sm mt-1">
                            Access log collection requires the agent to parse {serviceName} logs.
                            Ensure the agent has read access to the log files.
                        </p>
                    </div>
                </div>
            )}
        </div>
    );
};

export default ApacheDetail;
