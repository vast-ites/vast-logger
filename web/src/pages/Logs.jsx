import React, { useState, useEffect } from 'react';
import { Search, Filter, Terminal, AlertTriangle, Bug, Info, Download, ChevronLeft, ChevronRight, RefreshCw } from 'lucide-react';
import { useLocation } from 'react-router-dom';
import { useHost } from '../contexts/HostContext';

const Logs = () => {
    const { selectedHost, setSelectedHost } = useHost(); // Use Global Host Context
    const location = useLocation();
    const [logs, setLogs] = useState([]);
    const [filterLevel, setFilterLevel] = useState('ALL');
    const [filterService, setFilterService] = useState('');
    const [services, setServices] = useState([]);
    const [limit, setLimit] = useState(100);
    const [searchTerm, setSearchTerm] = useState('');
    const [loading, setLoading] = useState(false);

    // Initialize from URL Params
    useEffect(() => {
        const params = new URLSearchParams(location.search);
        const svc = params.get('service');
        const hst = params.get('host');

        if (hst && setSelectedHost) {
            setSelectedHost(hst);
        }
        if (svc) {
            setFilterService(svc);
        }
    }, [location.search, setSelectedHost]);

    // Pagination & Refresh
    const [currentPage, setCurrentPage] = useState(1);
    const [itemsPerPage] = useState(50);
    const [refreshInterval, setRefreshInterval] = useState(2000);

    // Search Parser
    const parseSearchQuery = (query) => {
        const params = { q: '', host: '', level: '', service: '', before: '', after: '', order: '' };
        const parts = query.split(' ');
        const freeText = [];

        parts.forEach(part => {
            if (part.includes(':')) {
                const [key, value] = part.split(':');
                if (['host', 'level', 'service', 'before', 'after', 'order'].includes(key.toLowerCase())) {
                    params[key.toLowerCase()] = value;
                    return;
                }
            }
            freeText.push(part);
        });
        params.q = freeText.join(' ');
        return params;
    };

    const fetchLogs = async () => {
        setLoading(true);
        try {
            const params = new URLSearchParams();
            const searchParams = parseSearchQuery(searchTerm);

            // Filters priority: Search Bar > Dropdown > Default
            if (searchParams.level) params.append('level', searchParams.level.toUpperCase());
            else if (filterLevel !== 'ALL') params.append('level', filterLevel);

            if (searchParams.host) params.append('host', searchParams.host);
            else if (selectedHost) params.append('host', selectedHost);

            if (searchParams.service) params.append('service', searchParams.service);
            else if (filterService) params.append('service', filterService);
            if (searchParams.before) params.append('before', searchParams.before);
            if (searchParams.after) params.append('after', searchParams.after);
            if (searchParams.order) params.append('order', searchParams.order.toUpperCase());

            if (searchParams.q) params.append('search', searchParams.q);

            params.append('limit', limit);

            params.append('limit', limit);

            const token = localStorage.getItem('token');
            const headers = {
                'Content-Type': 'application/json',
                ...(token && { 'Authorization': `Bearer ${token}` })
            };

            const res = await fetch(`/api/v1/logs/search?${params.toString()}`, { headers });
            if (res.status === 401) { window.location.href = '/login'; return; }
            if (res.ok) {
                const data = await res.json();
                setLogs(data);
            }
        } catch (err) {
            console.error("Failed to fetch logs", err);
        } finally {
            setLoading(false);
        }
    };

    // Debounce search
    // Debounce search & Poll
    useEffect(() => {
        // Reset page on search/filter change
        setCurrentPage(1);

        fetchLogs();
        const interval = setInterval(fetchLogs, refreshInterval);
        return () => clearInterval(interval);
    }, [filterLevel, filterService, searchTerm, selectedHost, limit, refreshInterval]);

    // Fetch Services List when host changes
    useEffect(() => {
        const fetchServices = async () => {
            try {
                let url = '/api/v1/logs/services';
                if (selectedHost) url += `?host=${selectedHost}`;

                const token = localStorage.getItem('token');
                const headers = {
                    'Content-Type': 'application/json',
                    ...(token && { 'Authorization': `Bearer ${token}` })
                };

                const res = await fetch(url, { headers });

                if (res.status === 401) return; // Don't redirect on background fetch, maybe just fail silent
                if (res.ok) {
                    const data = await res.json();
                    setServices(data);
                }
            } catch (err) {
                console.error("Failed to fetch services", err);
            }
        };
        fetchServices();
        // Note: Don't reset filterService here - it would conflict with URL params
    }, [selectedHost]);

    // Pagination Logic
    const indexOfLastLog = currentPage * itemsPerPage;
    const indexOfFirstLog = indexOfLastLog - itemsPerPage;
    const currentLogs = logs.slice(indexOfFirstLog, indexOfLastLog);
    const totalPages = Math.ceil(logs.length / itemsPerPage);

    const paginate = (pageNumber) => setCurrentPage(pageNumber);

    const getLevelIcon = (level) => {
        switch (level) {
            case 'ERROR': return <AlertTriangle size={14} className="text-red-500" />;
            case 'WARN': return <AlertTriangle size={14} className="text-cyber-yellow" />;
            case 'DEBUG': return <Bug size={14} className="text-gray-400" />;
            default: return <Info size={14} className="text-cyber-cyan" />;
        }
    };

    const getLevelClass = (level) => {
        switch (level) {
            case 'ERROR': return 'text-red-500 bg-red-500/10 border-red-500/30';
            case 'WARN': return 'text-cyber-yellow bg-cyber-yellow/10 border-cyber-yellow/30';
            case 'DEBUG': return 'text-gray-400 bg-gray-500/10 border-gray-500/30';
            default: return 'text-cyber-cyan bg-cyber-cyan/10 border-cyber-cyan/30';
        }
    };

    const handleExport = () => {
        if (!logs.length) return;
        const headers = ['Timestamp', 'Host', 'Level', 'Component', 'Message'];
        const csv = [
            headers.join(','),
            ...logs.map(log => [
                new Date(log.timestamp).toISOString(),
                log.host,
                log.level,
                log.source_path,
                `"${log.message.replace(/"/g, '""')}"` // Escape quotes
            ].join(','))
        ].join('\n');

        const blob = new Blob([csv], { type: 'text/csv' });
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `datavast_logs_${new Date().getTime()}.csv`;
        a.click();
        window.URL.revokeObjectURL(url);
    };

    return (
        <div className="space-y-6">
            <div className="flex justify-between items-center">
                <h1 className="text-2xl font-bold font-display text-white flex items-center gap-3">
                    <Terminal className="text-cyber-cyan" />
                    System Log Explorer
                </h1>
                <div className="text-xs font-mono text-gray-500">
                    Live Query Interface
                </div>
            </div>

            {/* Search Bar */}
            <div className="glass-panel p-4 rounded-xl flex flex-wrap gap-4 items-center">
                <div className="relative flex-1 min-w-[300px] group">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" size={18} />
                    <input
                        type="text"
                        placeholder="Search logs (e.g. host:worker-1 service:nginx error)"
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        className="w-full bg-black/40 border border-cyber-gray rounded pl-10 pr-10 py-2 text-sm text-white focus:border-cyber-cyan focus:outline-none focus:ring-1 focus:ring-cyber-cyan transition-all"
                    />
                    {/* Tooltip / Hint Icon */}
                    <div className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-cyber-cyan cursor-help group-hover:block" title="Advanced Search:
host:hostname
level:INFO|WARN|ERROR
service:service_name
before:YYYY-MM-DD
after:YYYY-MM-DD
order:ASC|DESC">
                        <Info size={16} />
                    </div>
                </div>

                <div className="flex items-center gap-2">
                    <Filter size={18} className="text-gray-500" />
                    <select
                        value={filterLevel}
                        onChange={(e) => setFilterLevel(e.target.value)}
                        className="bg-black/40 border border-cyber-gray rounded px-4 py-2 text-sm text-white focus:border-cyber-cyan focus:outline-none appearance-none cursor-pointer hover:bg-cyber-gray/20"
                    >
                        <option value="ALL">All Levels</option>
                        <option value="INFO">INFO</option>
                        <option value="WARN">WARN</option>
                        <option value="ERROR">ERROR</option>
                        <option value="DEBUG">DEBUG</option>
                    </select>

                    <select
                        value={filterService}
                        onChange={(e) => setFilterService(e.target.value)}
                        className="bg-black/40 border border-cyber-gray rounded px-4 py-2 text-sm text-white focus:border-cyber-cyan focus:outline-none appearance-none cursor-pointer hover:bg-cyber-gray/20 max-w-[200px]"
                    >
                        <option value="">All Services</option>
                        {services.map(svc => (
                            <option key={svc} value={svc}>{svc}</option>
                        ))}
                    </select>
                </div>

                <div className="flex items-center gap-2 border-l border-gray-700 pl-4">
                    <span className="text-xs text-gray-400 font-mono">LIMIT:</span>
                    <select
                        value={limit}
                        onChange={(e) => setLimit(Number(e.target.value))}
                        className="bg-black/40 border border-cyber-gray rounded px-2 py-2 text-sm text-white focus:border-cyber-cyan focus:outline-none cursor-pointer"
                    >
                        <option value={100}>100</option>
                        <option value={500}>500</option>
                        <option value={1000}>1000</option>
                        <option value={5000}>5000</option>
                    </select>

                    <button
                        onClick={handleExport}
                        disabled={!logs.length}
                        className="flex items-center gap-2 bg-cyber-cyan/10 hover:bg-cyber-cyan/20 text-cyber-cyan border border-cyber-cyan/50 px-3 py-2 rounded text-sm transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                        <Download size={16} />
                        Export
                    </button>

                    <div className="flex items-center gap-2 border-l border-gray-700 pl-4">
                        <RefreshCw size={14} className="text-gray-500" />
                        <select
                            value={refreshInterval}
                            onChange={(e) => setRefreshInterval(Number(e.target.value))}
                            className="bg-black/40 border border-cyber-gray rounded px-2 py-2 text-xs text-cyber-cyan focus:outline-none cursor-pointer"
                        >
                            <option value={1000}>1s</option>
                            <option value={2000}>2s</option>
                            <option value={5000}>5s</option>
                            <option value={10000}>10s</option>
                        </select>
                    </div>
                </div>
            </div>

            {/* Results Table */}
            <div className="glass-panel rounded-xl overflow-hidden min-h-[500px] flex flex-col">
                <div className="bg-cyber-dark/80 px-4 py-3 border-b border-cyber-gray flex justify-between items-center">
                    <span className="text-xs font-mono text-gray-400">{logs.length} EVENTS FOUND</span>
                    {loading && <span className="text-xs font-mono text-cyber-cyan animate-pulse">QUERYING...</span>}
                </div>

                <div className="flex-1 overflow-auto custom-scrollbar bg-black/20">
                    {logs.length === 0 && !loading ? (
                        <div className="flex flex-col items-center justify-center h-full text-gray-500 gap-4">
                            <Terminal size={40} className="opacity-20" />
                            <p>No logs matching query</p>
                        </div>
                    ) : (
                        <div className="font-mono text-xs">
                            {currentLogs.map((log, i) => (
                                <div key={i} className="flex gap-4 p-2 hover:bg-white/5 border-b border-white/5 transition-colors items-start">
                                    <span className="text-gray-500 shrink-0 w-40 font-mono text-[11px]">
                                        {new Date(log.timestamp).toLocaleString('sv')}
                                    </span>
                                    <div className={`shrink-0 w-20 flex items-center justify-center gap-1 px-1 py-0.5 rounded border text-[10px] font-bold ${getLevelClass(log.level)}`}>
                                        {getLevelIcon(log.level)}
                                        {log.level || 'INFO'}
                                    </div>
                                    <span className="text-cyber-magenta shrink-0 w-32 truncate" title={log.host}>
                                        {log.host || 'localhost'}
                                    </span>
                                    <span className="text-cyber-green shrink-0 w-40 truncate" title={log.source_path}>
                                        {log.source_path.split('/').pop()}
                                    </span>
                                    <span className="text-gray-300 break-all">
                                        {log.message}
                                    </span>
                                </div>
                            ))}
                        </div>
                    )}
                </div>

                {/* Pagination Controls */}
                {logs.length > 0 && (
                    <div className="bg-cyber-dark/80 px-4 py-3 border-t border-cyber-gray flex justify-between items-center">
                        <span className="text-xs text-gray-500 font-mono">
                            Showing {indexOfFirstLog + 1}-{Math.min(indexOfLastLog, logs.length)} of {logs.length}
                        </span>
                        <div className="flex gap-2">
                            <button
                                onClick={() => paginate(currentPage - 1)}
                                disabled={currentPage === 1}
                                className="p-1 rounded bg-black/40 border border-cyber-gray text-cyber-cyan disabled:opacity-30 disabled:cursor-not-allowed hover:bg-cyber-gray/20"
                            >
                                <ChevronLeft size={16} />
                            </button>
                            <span className="px-3 py-1 text-sm font-mono text-white bg-black/20 rounded">
                                {currentPage} / {totalPages}
                            </span>
                            <button
                                onClick={() => paginate(currentPage + 1)}
                                disabled={currentPage === totalPages}
                                className="p-1 rounded bg-black/40 border border-cyber-gray text-cyber-cyan disabled:opacity-30 disabled:cursor-not-allowed hover:bg-cyber-gray/20"
                            >
                                <ChevronRight size={16} />
                            </button>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
};

export default Logs;
